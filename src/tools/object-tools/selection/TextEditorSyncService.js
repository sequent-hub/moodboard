import * as PIXI from 'pixi.js';
import { Events } from '../../../core/events/Events.js';
import { registerEditorListeners } from './InlineEditorListenersRegistry.js';
import {
    computeTextRightPadPx,
    resolveLineHeightRatio,
    computeSingleLineCenterDelta,
    TEXT_BOX_BOTTOM_PAD_PX,
} from '../../../services/text/TextBoxMetrics.js';

// Максимальное число визуальных строк в записке. По достижении лимита ввод
// блокируется (см. note inputHandler), шрифт до этого сжимается без нижнего предела,
// чтобы строки помещались по высоте записки.
export const NOTE_MAX_LINES = 25;
// Жёсткий пол только чтобы шрифт не стал 0/отрицательным. Ограничения по размеру нет —
// единственный лимит ввода это NOTE_MAX_LINES.
const NOTE_MIN_FONT_PX = 1;

// Измеряет ширину текста textarea по реальным глифам через скрытый span.
// Возвращает ширину самой длинной строки в CSS-px (white-space: pre — без переносов),
// либо 0, если измерение невозможно (jsdom без layout).
function measureTextareaContentWidth(textarea, value) {
    if (!value) return 0;
    try {
        if (typeof document === 'undefined' || !window.getComputedStyle) return 0;
        const cs = window.getComputedStyle(textarea);
        const m = document.createElement('span');
        m.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;top:-9999px;left:-9999px;padding:0;margin:0;';
        m.style.fontFamily = cs.fontFamily;
        m.style.fontSize = cs.fontSize;
        m.style.fontWeight = cs.fontWeight;
        m.style.fontStyle = cs.fontStyle;
        m.style.letterSpacing = cs.letterSpacing;
        m.textContent = value;
        document.body.appendChild(m);
        const w = m.getBoundingClientRect().width;
        m.remove();
        return Number.isFinite(w) ? w : 0;
    } catch (_) {
        return 0;
    }
}

// Высота блока текста (px) при заданном шрифте и ширине, измеренная скрытым div c
// тем же переносом, что и редактор. Возвращает 0, если layout недоступен (jsdom).
function measureNoteBlockHeight(text, boxW, fontPx, fontFamily, ratio) {
    try {
        if (typeof document === 'undefined' || !document.body) return 0;
        const m = document.createElement('div');
        m.style.cssText = 'position:absolute;visibility:hidden;top:-9999px;left:-9999px;padding:0;margin:0;white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere;';
        m.style.width = `${boxW}px`;
        m.style.fontFamily = fontFamily || '';
        m.style.fontSize = `${fontPx}px`;
        m.style.lineHeight = `${ratio}`;
        // \u200b в конце сохраняет высоту хвостового перевода строки при измерении.
        m.textContent = text && text.length ? `${text}\u200b` : 'W';
        document.body.appendChild(m);
        const h = m.getBoundingClientRect().height;
        m.remove();
        return Number.isFinite(h) ? h : 0;
    } catch (_) {
        return 0;
    }
}

// Считает число визуальных строк текста при ЕСТЕСТВЕННОМ размере шрифта (effectiveFontPx),
// не зависящем от сжатия для отображения. Сжатие меняет fitFont, но не количество строк —
// поэтому лимит строк должен меряться по неизменному шрифту, иначе блокировка срабатывает
// преждевременно (при просевшем fitFont деление давало раздутый счёт).
function countNoteVisualLines(text, boxW, fontPx, fontFamily) {
    const ratio = resolveLineHeightRatio(fontPx);
    const oneLine = measureNoteBlockHeight('W', boxW, fontPx, fontFamily, ratio);
    if (!(oneLine > 0)) return 1;
    const fullH = measureNoteBlockHeight(text, boxW, fontPx, fontFamily, ratio);
    return Math.max(1, Math.round(fullH / oneLine));
}

// Подгоняет inline-редактор записки под её внутренние границы так же, как
// NoteObject._fitTextToBounds: текст переносится по фиксированной ширине блока (boxW),
// размер шрифта уменьшается, пока высота контента не влезет в innerH (без нижнего предела).
// Число строк (для лимита) меряется отдельно по естественному шрифту effectiveFontPx.
export function applyNoteEditorBox(textarea, backdrop, { boxW, innerH, effectiveFontPx }) {
    // line-height задаём коэффициентом по текущему размеру (как NoteObject), чтобы
    // высота строки совпадала с отрисованной запиской.
    const setWrapStyles = (el, fontPx) => {
        if (!el) return;
        el.style.whiteSpace = 'pre-wrap';
        el.style.wordBreak = 'break-word';
        el.style.overflowWrap = 'anywhere';
        el.style.textAlign = 'center';
        el.style.boxSizing = 'content-box';
        el.style.padding = '0';
        el.style.overflow = 'hidden';
        el.style.fontSize = `${fontPx}px`;
        el.style.lineHeight = `${resolveLineHeightRatio(fontPx)}`;
        el.style.width = `${boxW}px`;
    };

    const fontFamily = (typeof window !== 'undefined' && window.getComputedStyle)
        ? window.getComputedStyle(textarea).fontFamily
        : (textarea.style.fontFamily || '');
    const naturalFont = Math.max(NOTE_MIN_FONT_PX, Math.round(effectiveFontPx));
    const value = textarea.value || '';
    const lineCount = countNoteVisualLines(value, boxW, naturalFont, fontFamily);

    // Подбор шрифта детерминированный — высоту блока меряем скрытым div
    // (measureNoteBlockHeight), а НЕ textarea.scrollHeight. Chromium при быстрых
    // правках возвращает устаревший (завышенный) scrollHeight даже после смены
    // font-size, из-за чего цикл уводил шрифт в минимум (1px), а скачок contentH
    // дёргал каретку. Скрытый div пересоздаётся на каждом замере и стейл-значения
    // не накапливает. Тот же подход уже применён в createRegularTextAutoSize.
    let fitFont = naturalFont;
    let measuredH = measureNoteBlockHeight(value, boxW, fitFont, fontFamily, resolveLineHeightRatio(fitFont));
    // measuredH === 0 → layout недоступен (jsdom): сжимать нечем, оставляем естественный шрифт.
    if (measuredH > 0) {
        for (let safety = 0; safety < 256; safety++) {
            if (measuredH <= innerH || fitFont <= NOTE_MIN_FONT_PX) break;
            fitFont = Math.max(NOTE_MIN_FONT_PX, fitFont - 1);
            measuredH = measureNoteBlockHeight(value, boxW, fitFont, fontFamily, resolveLineHeightRatio(fitFont));
        }
    }

    setWrapStyles(textarea, fitFont);
    textarea.style.minHeight = '0px';

    const naturalH = measuredH > 0
        ? Math.max(1, Math.ceil(measuredH))
        : Math.max(1, Math.ceil(textarea.scrollHeight));
    const contentH = Math.max(1, Math.min(innerH, naturalH));

    textarea.style.height = `${contentH}px`;
    setWrapStyles(backdrop, fitFont);
    if (backdrop) {
        backdrop.style.height = `${contentH}px`;
    }

    // Единственный лимит — число строк, посчитанное по естественному шрифту.
    const fits = lineCount <= NOTE_MAX_LINES;
    const full = lineCount >= NOTE_MAX_LINES;

    return { fitFont, contentH, naturalH, lineCount, fits, full };
}

export function createRegularTextAutoSize({
    textarea,
    wrapper,
    minWBound,
    minHBound,
    onSizeChange,
    getFixedWidthPx = null,
}) {
    // Минимальные границы хранятся в мутабельном объекте: при зуме они
    // пересчитываются (см. createRegularTextEditorUpdater), чтобы рамка
    // редактора масштабировалась так же, как статический .mb-text.
    const bounds = { minW: minWBound, minH: minHBound };
    // Видимый текст рисует backdrop. applyEditorSizing проставляет ему фиксированную
    // высоту в px на момент открытия; без пересчёта при зуме увеличенные глифы
    // обрезаются снизу (overflow: hidden). Держим размеры backdrop равными textarea.
    const backdrop = wrapper.querySelector('.moodboard-text-backdrop');

    const autoSize = () => {
        // Режим фиксированной ширины (пользователь задал ширину боковой ручкой):
        // ширину не подгоняем под контент, текст переносится по словам, высота растёт.
        const fixedWidthPx = typeof getFixedWidthPx === 'function' ? getFixedWidthPx() : null;
        if (fixedWidthPx && fixedWidthPx > 0) {
            const targetW = Math.round(fixedWidthPx);
            textarea.style.whiteSpace = 'pre-wrap';
            textarea.style.overflowWrap = 'break-word';
            textarea.style.width = `${targetW}px`;
            wrapper.style.width = `${targetW}px`;
            textarea.style.paddingTop = '0px';
            textarea.style.paddingBottom = '0px';
            if (backdrop) {
                backdrop.style.whiteSpace = 'pre-wrap';
                backdrop.style.overflowWrap = 'break-word';
                backdrop.style.width = `${targetW}px`;
                backdrop.style.paddingTop = '0px';
                backdrop.style.paddingBottom = '0px';
            }
            // Высоту меряем по фактическому переносу на видимом слое (backdrop), как в
            // статическом .mb-text: scrollHeight + центр-дельта (одна строка) либо нижний
            // запас (многострочный).
            let naturalH;
            const measureEl = backdrop || textarea;
            const prevH = measureEl.style.height;
            measureEl.style.height = 'auto';
            const sh = measureEl.scrollHeight;
            const d = computeSingleLineCenterDelta(measureEl);
            const extra = (d === null) ? TEXT_BOX_BOTTOM_PAD_PX : d;
            naturalH = Math.max(1, Math.round(sh + extra));
            if (measureEl === backdrop) measureEl.style.height = prevH;
            const targetH = Math.round(Math.max(bounds.minH, naturalH));
            textarea.style.height = `${targetH}px`;
            wrapper.style.height = `${targetH}px`;
            if (backdrop) backdrop.style.height = `${targetH}px`;
            if (typeof onSizeChange === 'function') {
                onSizeChange({ widthPx: targetW, heightPx: targetH });
            }
            return;
        }

        textarea.style.width = 'auto';
        textarea.style.height = 'auto';

        const fontPx = parseFloat(textarea.style.fontSize) || 16;
        const rightPad = computeTextRightPadPx(fontPx);
        const value = typeof textarea.value === 'string' ? textarea.value : '';
        // Ширину контента меряем отдельным скрытым span, а НЕ textarea.scrollWidth:
        // у textarea при width:auto ширина определяется атрибутом cols (~20 символов),
        // поэтому scrollWidth не сжимается до реального текста и рамка остаётся широкой.
        // span с white-space:pre отдаёт ширину самой длинной строки по тем же глифам.
        const contentW = measureTextareaContentWidth(textarea, value);
        const naturalW = Math.max(1, Math.ceil(contentW + rightPad));
        // bounds.minW (ширина плейсхолдера/исходного бокса) применяется только к пустому
        // полю, чтобы плейсхолдер не обрезался. Как только введён текст — рамка облегает
        // контент; иначе ширина залипает на ширине плейсхолдера и не совпадает со
        // статическим .mb-text после выхода из редактора (рамка скачком сужается).
        const widthFloor = value.length ? 1 : bounds.minW;
        const targetW = Math.round(Math.max(widthFloor, naturalW));
        textarea.style.width = `${targetW}px`;
        wrapper.style.width = `${targetW}px`;

        // Высоту считаем ДЕТЕРМИНИРОВАННО — число строк × line-height + вертикальные
        // паддинги — а НЕ через textarea.scrollHeight. При быстром zoom-out Chromium
        // держит устаревшую (бо́льшую) высоту строки в scrollHeight даже после
        // форсированного reflow, и последний autoSize за серию колёс фиксировал
        // завышенную высоту: под текстом оставался пустой зазор, не уходивший до blur.
        // Текст в поле не переносится (white-space: pre, ширина по контенту), поэтому
        // число визуальных строк = число переводов строки.
        let lhRatio = parseFloat(textarea.style.lineHeight);
        if (!isFinite(lhRatio) || lhRatio <= 0 || lhRatio > 4) lhRatio = 1.2;
        const lineCount = value.length ? (value.split('\n').length) : 1;
        // Вертикальная геометрия должна совпадать со статическим .mb-text
        // (HtmlTextLayer.updateOne): высота = line-box + extra, где extra для одиночной
        // строки — дельта центрирования глифов, иначе нижний запас TEXT_BOX_BOTTOM_PAD_PX.
        // Паддинги textarea/backdrop обнуляем: статический слой кладёт весь запас снизу
        // (padding 0), поэтому прежний 1px сверху уводил текст в редакторе ниже, чем после
        // блюра, и менял высоту рамки. Backdrop делит кеш дельты со статикой (один ключ),
        // поэтому высота поля совпадает со статикой пиксель в пиксель.
        textarea.style.paddingTop = '0px';
        textarea.style.paddingBottom = '0px';
        if (backdrop) {
            backdrop.style.paddingTop = '0px';
            backdrop.style.paddingBottom = '0px';
        }
        let naturalH;
        if (lineCount === 1 && backdrop) {
            // Одиночную строку считаем ровно как статический .mb-text
            // (HtmlTextLayer.updateOne): height auto → scrollHeight → + центр-дельта.
            // Детерминированная формула round(fontPx*lhRatio) расходилась со scrollHeight
            // на 1px при дробном devicePixelRatio (масштаб Windows 110/125/150%), из-за чего
            // высота рамки ввода отличалась от статики. Общий scrollHeight + общий кеш дельты
            // гарантируют совпадение при любом dpr.
            backdrop.style.height = 'auto';
            const sh = backdrop.scrollHeight;
            const d = computeSingleLineCenterDelta(backdrop);
            const extra = (d === null) ? TEXT_BOX_BOTTOM_PAD_PX : d;
            naturalH = Math.max(1, Math.round(sh + extra));
        } else {
            naturalH = Math.max(1, lineCount * Math.round(fontPx * lhRatio) + TEXT_BOX_BOTTOM_PAD_PX);
        }
        const targetH = Math.round(Math.max(bounds.minH, naturalH));
        textarea.style.height = `${targetH}px`;
        wrapper.style.height = `${targetH}px`;

        if (backdrop) {
            backdrop.style.width = `${targetW}px`;
            backdrop.style.height = `${targetH}px`;
        }

        if (typeof onSizeChange === 'function') {
            onSizeChange({ widthPx: targetW, heightPx: targetH });
        }
    };

    autoSize.getBounds = () => ({ minW: bounds.minW, minH: bounds.minH });
    autoSize.setBounds = ({ minW, minH }) => {
        if (typeof minW === 'number' && isFinite(minW)) bounds.minW = minW;
        if (typeof minH === 'number' && isFinite(minH)) bounds.minH = minH;
    };

    return autoSize;
}

export function createNoteEditorUpdater(controller, {
    objectId,
    position,
    noteWidth,
    noteHeight,
    view,
    textarea,
    wrapper,
    horizontalPadding,
    computeLineHeightPx,
    effectiveFontPx,
    toScreen,
}) {
    const minNoteEditorHeightPx = Math.max(1, computeLineHeightPx(effectiveFontPx));

    return () => {
        let result = null;
        try {
            const posDataNow = { objectId, position: null };
            const sizeDataNow = { objectId, size: null };
            controller.eventBus.emit(Events.Tool.GetObjectPosition, posDataNow);
            controller.eventBus.emit(Events.Tool.GetObjectSize, sizeDataNow);
            const posNow = posDataNow.position || position;
            const sizeNow = sizeDataNow.size || { width: noteWidth, height: noteHeight };
            const screenNow = toScreen(posNow.x, posNow.y);
            const worldLayerRef = controller.textEditor.world || (controller.app?.stage);
            const scaleX = worldLayerRef?.scale?.x || 1;
            // worldScale без /res: screenNow приходит из toScreen→toGlobal (CSS-px, res-независим),
            // а записка — PIXI (1 мир. ед. = worldScale CSS-px). Деление на res уводило бы редактор
            // влево и сжимало блок при зуме браузера ≠100% (res≠1). См. NoteInlineEditorController.
            const scaleCss = scaleX;
            // Внутренний блок текста = границы записки минус отступы, ограничение
            // ширины 360 — как в NoteObject._getVisibleTextWidth.
            const innerWorldW = Math.max(1, Math.min(360, sizeNow.width - (horizontalPadding * 2)));
            const innerWorldH = Math.max(1, sizeNow.height - (horizontalPadding * 2));
            const boxW = Math.max(1, Math.round(innerWorldW * scaleCss));
            const innerH = Math.max(minNoteEditorHeightPx, Math.round(innerWorldH * scaleCss));

            const backdrop = wrapper.querySelector('.moodboard-text-backdrop');

            result = applyNoteEditorBox(textarea, backdrop, {
                boxW,
                innerH,
                effectiveFontPx,
            });
            const contentH = result.contentH;

            wrapper.style.width = `${boxW}px`;
            wrapper.style.height = `${contentH}px`;

            // Центрируем блок контента внутри записки по обеим осям (как PIXI-текст).
            const left = Math.round(screenNow.x + (sizeNow.width * scaleCss) / 2 - (boxW / 2));
            const top = Math.round(screenNow.y + (sizeNow.height * scaleCss) / 2 - (contentH / 2));
            wrapper.style.left = `${left}px`;
            wrapper.style.top = `${top}px`;
        } catch (_) {}
        return result;
    };
}

// Держит inline-редактор обычного текста выровненным по объекту при зуме/пэне.
// Позиция считается напрямую от мирового трансформа (как в HtmlTextLayer.updateOne),
// поэтому не зависит от порядка обработчиков событий относительно статического слоя.
// Шрифт и line-height масштабируются пропорционально текущему зуму от значений на момент
// открытия редактора (baseFontPxAtOpen / sCssAtOpen) — сохраняется вертикальное выравнивание.
export function createRegularTextEditorUpdater(controller, {
    objectId,
    position,
    view,
    textarea,
    wrapper,
    autoSize,
    baseFontPxAtOpen,
    sCssAtOpen,
}) {
    const baseWorldFont = (baseFontPxAtOpen && sCssAtOpen) ? (baseFontPxAtOpen / sCssAtOpen) : null;
    // Базовые минимальные границы рамки на момент открытия редактора (в CSS-px при sCssAtOpen).
    // Захватываются лениво при первом обновлении и масштабируются под текущий зум.
    let baseBounds = null;

    return () => {
        try {
            const worldLayer = controller.textEditor.world || (controller.app?.stage);
            if (!worldLayer || !view || !view.parentElement) {
                return;
            }
            const res = (controller.app?.renderer?.resolution) || 1;
            const scaleX = worldLayer.scale?.x || 1;
            const sCssNow = scaleX / res;

            const backdrop = wrapper.querySelector('.moodboard-text-backdrop');
            const getCs = (typeof window !== 'undefined' && window.getComputedStyle)
                ? window.getComputedStyle.bind(window)
                : null;

            // Актуальная мировая позиция (top-left); fallback на исходную для нового текста.
            const posReq = { objectId, position: null };
            controller.eventBus.emit(Events.Tool.GetObjectPosition, posReq);
            const pos = posReq.position || position;

            const containerRect = view.parentElement.getBoundingClientRect();
            const viewRect = view.getBoundingClientRect();
            const offsetLeft = viewRect.left - containerRect.left;
            const offsetTop = viewRect.top - containerRect.top;
            const tl = worldLayer.toGlobal(new PIXI.Point(pos.x, pos.y));
            const baseLeft = Math.round(offsetLeft + tl.x);
            const baseTop = Math.round(offsetTop + tl.y);

            // Перемасштабируем только font-size. line-height задан безразмерным
            // коэффициентом (applyTextStyles, например "1.34") и масштабируется браузером
            // вместе с font-size без округления — точно как в статическом HtmlTextLayer.
            // Прежний код читал этот коэффициент как пиксели (parseFloat → 1.34) и
            // схлопывал строку до ~1px, из-за чего текст «уезжал» вверх при зуме.
            const prevFont = parseFloat(textarea.style.fontSize) || baseFontPxAtOpen || 16;
            const fontSizePx = baseWorldFont
                ? Math.max(1, Math.round(baseWorldFont * sCssNow))
                : prevFont;
            textarea.style.fontSize = `${fontSizePx}px`;
            if (backdrop) {
                backdrop.style.fontSize = `${fontSizePx}px`;
            }

            // Пересчитываем min-height по текущему шрифту. applyEditorSizing проставляет
            // фиксированный min-height в px на момент открытия; без пересчёта при отдалении
            // scrollHeight не может стать меньше него, и высота рамки не уменьшается вслед
            // за текстом (рамка остаётся высокой при мелком шрифте).
            let lhRatio = parseFloat(textarea.style.lineHeight);
            if (!isFinite(lhRatio) || lhRatio <= 0 || lhRatio > 4) lhRatio = 1.2;
            const lineMinPx = Math.max(1, Math.round(fontSizePx * lhRatio));
            textarea.style.minHeight = `${lineMinPx}px`;
            if (backdrop) {
                backdrop.style.minHeight = `${lineMinPx}px`;
            }

            // Смещение обёртки на паддинги textarea + паддинг статического .mb-text (для list/markdown).
            const taCs = getCs ? getCs(textarea) : null;
            const padTop = taCs ? (parseFloat(taCs.paddingTop) || 0) : 0;
            const padLeft = taCs ? (parseFloat(taCs.paddingLeft) || 0) : 0;
            let staticPadTop = 0;
            try {
                const layer = (typeof window !== 'undefined') ? window.moodboardHtmlTextLayer : null;
                const el = (layer && objectId) ? layer.idToEl.get(objectId) : null;
                if (el && getCs) {
                    const sp = parseFloat(getCs(el).paddingTop);
                    if (isFinite(sp) && sp > 0) staticPadTop = sp;
                }
            } catch (_) {}

            const leftPx = Math.round(baseLeft - padLeft);
            // Текст в редакторе выровнен по верху (padding 0, как статический .mb-text),
            // поэтому верх обёртки = верх объекта + статический верхний отступ. Прежний
            // «+1» компенсировал убранный теперь 1px верхнего паддинга textarea и опускал
            // строку ниже статики.
            const topPx = Math.round(baseTop + staticPadTop - padTop);
            wrapper.style.left = `${leftPx}px`;
            wrapper.style.top = `${topPx}px`;
            controller.textEditor._cssLeftPx = leftPx;
            controller.textEditor._cssTopPx = topPx;

            if (typeof autoSize === 'function') {
                // Масштабируем минимальные границы рамки пропорционально зуму, чтобы
                // при отдалении поле уменьшалось вместе с текстом (как статический слой),
                // а не оставалось зафиксированным в px на момент открытия.
                if (sCssAtOpen
                    && typeof autoSize.getBounds === 'function'
                    && typeof autoSize.setBounds === 'function') {
                    if (!baseBounds) baseBounds = autoSize.getBounds();
                    const zoomRatio = sCssNow / sCssAtOpen;
                    if (isFinite(zoomRatio) && zoomRatio > 0) {
                        autoSize.setBounds({
                            minW: Math.max(1, Math.round(baseBounds.minW * zoomRatio)),
                            minH: Math.max(1, Math.round(baseBounds.minH * zoomRatio)),
                        });
                    }
                }
                autoSize();
            }
        } catch (_) {}
    };
}

export function registerRegularTextEditorSync(controller, { updateEditor, updateCaret }) {
    // Таймер дебаунса: скрываем каретку на время зума, показываем через 150 мс тишины.
    // Во время серии событий ZoomPercent/Viewport.Changed каретка остаётся скрытой,
    // что убирает артефакт «каретка осталась старого размера» при промежуточных кадрах.
    let caretHideTimer = null;
    const CARET_SHOW_DELAY_MS = 150;

    const onZoom = () => {
        updateEditor();
        if (typeof updateCaret === 'function') {
            if (caretHideTimer !== null) {
                clearTimeout(caretHideTimer);
                caretHideTimer = null;
            }
            // Скрываем каретку и блокируем caretUpdateHandler через флаг,
            // чтобы selectionchange не перерисовал её в промежуточных кадрах.
            try {
                if (controller.textEditor) controller.textEditor._caretSuppressed = true;
                const caret = controller.textEditor && controller.textEditor.caret;
                if (caret) caret.style.display = 'none';
            } catch (_) {}
            // Показываем и пересчитываем после завершения серии зума
            caretHideTimer = setTimeout(() => {
                caretHideTimer = null;
                try {
                    if (controller.textEditor) controller.textEditor._caretSuppressed = false;
                    updateCaret();
                } catch (_) {}
            }, CARET_SHOW_DELAY_MS);
        }
    };

    const onViewportChange = () => updateEditor();

    // Только зум/пэн/вьюпорт: ResizeUpdate сюда подключать нельзя — autoSize внутри
    // updateEditor эмитит ResizeUpdate, что создало бы рекурсивную петлю.
    const listeners = [
        [Events.UI.ZoomPercent, onZoom],
        [Events.Tool.PanUpdate, onViewportChange],
        [Events.Viewport.Changed, onViewportChange],
    ];

    registerEditorListeners(controller.eventBus, listeners);
    controller.textEditor._listeners = listeners;
    // Сохраняем ссылку на таймер для очистки при закрытии редактора
    controller.textEditor._caretHideTimer = () => {
        if (caretHideTimer !== null) {
            clearTimeout(caretHideTimer);
            caretHideTimer = null;
        }
    };
    return listeners;
}

export function registerNoteEditorSync(controller, { objectId, updateNoteEditor }) {
    const onZoom = () => updateNoteEditor();
    const onPan = () => updateNoteEditor();
    const onDrag = (e) => { if (e && e.object === objectId) updateNoteEditor(); };
    const onResize = (e) => { if (e && e.object === objectId) updateNoteEditor(); };
    const onRotate = (e) => { if (e && e.object === objectId) updateNoteEditor(); };

    const listeners = [
        [Events.UI.ZoomPercent, onZoom],
        [Events.Tool.PanUpdate, onPan],
        [Events.Viewport.Changed, onPan],
        [Events.Tool.DragUpdate, onDrag],
        [Events.Tool.ResizeUpdate, onResize],
        [Events.Tool.RotateUpdate, onRotate],
    ];

    registerEditorListeners(controller.eventBus, listeners);
    controller.textEditor._listeners = listeners;
    return listeners;
}
