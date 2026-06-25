import * as PIXI from 'pixi.js';
import { Events } from '../../../core/events/Events.js';
import { registerEditorListeners } from './InlineEditorListenersRegistry.js';
import { computeTextRightPadPx } from '../../../services/text/TextBoxMetrics.js';

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

export function createRegularTextAutoSize({
    textarea,
    wrapper,
    minWBound,
    minHBound,
    onSizeChange,
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
        const cs = (typeof window !== 'undefined' && window.getComputedStyle)
            ? window.getComputedStyle(textarea)
            : null;
        const padV = cs
            ? ((parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0))
            : 0;
        const lineCount = value.length ? (value.split('\n').length) : 1;
        const naturalH = Math.max(1, Math.ceil(lineCount * fontPx * lhRatio + padV));
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
    const minNoteEditorWidthPx = 20;
    const minNoteEditorHeightPx = Math.max(1, computeLineHeightPx(effectiveFontPx));

    return () => {
        try {
            const posDataNow = { objectId, position: null };
            const sizeDataNow = { objectId, size: null };
            controller.eventBus.emit(Events.Tool.GetObjectPosition, posDataNow);
            controller.eventBus.emit(Events.Tool.GetObjectSize, sizeDataNow);
            const posNow = posDataNow.position || position;
            const sizeNow = sizeDataNow.size || { width: noteWidth, height: noteHeight };
            const screenNow = toScreen(posNow.x, posNow.y);
            const viewRes = (controller.app?.renderer?.resolution) || (view.width && view.clientWidth ? (view.width / view.clientWidth) : 1);
            const worldLayerRef = controller.textEditor.world || (controller.app?.stage);
            const scaleX = worldLayerRef?.scale?.x || 1;
            const scaleCss = scaleX / viewRes;
            const maxWpx = Math.max(1, Math.round((sizeNow.width - (horizontalPadding * 2)) * scaleCss));
            const maxHpx = Math.max(1, Math.round((sizeNow.height - (horizontalPadding * 2)) * scaleCss));

            textarea.style.width = 'auto';
            textarea.style.height = 'auto';
            const naturalW = Math.ceil(textarea.scrollWidth + 1);
            const naturalH = Math.ceil(textarea.scrollHeight);
            const widthPx = Math.min(maxWpx, Math.max(minNoteEditorWidthPx, naturalW));
            const heightPx = Math.min(maxHpx, Math.max(minNoteEditorHeightPx, naturalH));

            textarea.style.width = `${widthPx}px`;
            wrapper.style.width = `${widthPx}px`;
            textarea.style.height = `${heightPx}px`;
            wrapper.style.height = `${heightPx}px`;

            // backdrop рисует видимые глифы и имеет фиксированную высоту в px с момента
            // открытия (applyEditorSizing — одна строка). Без синхронизации с textarea
            // многострочный ввод (Enter) обрезается снизу (overflow: hidden).
            const backdrop = wrapper.querySelector('.moodboard-text-backdrop');
            if (backdrop) {
                backdrop.style.width = `${widthPx}px`;
                backdrop.style.height = `${heightPx}px`;
            }

            const left = Math.round(screenNow.x + (sizeNow.width * scaleCss) / 2 - (widthPx / 2));
            const top = Math.round(screenNow.y + (sizeNow.height * scaleCss) / 2 - (heightPx / 2));
            wrapper.style.left = `${left}px`;
            wrapper.style.top = `${top}px`;
            textarea.style.width = `${widthPx}px`;
            textarea.style.height = `${heightPx}px`;
        } catch (_) {}
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
            const topPx = Math.round(baseTop + staticPadTop - padTop + 1);
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
