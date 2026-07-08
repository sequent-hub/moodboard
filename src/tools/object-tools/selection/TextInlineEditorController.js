import { Events } from '../../../core/events/Events.js';
import {
    createTextEditorToScreen,
    positionRegularTextEditor,
    syncCreatedTextEditorWorldPosition,
} from './TextEditorPositioningService.js';
import {
    applyTextEditorCaretFromClick,
    bindTextEditorInteractions,
    closeTextEditorFromState,
    createTextEditorFinalize,
} from './TextEditorInteractionController.js';
import {
    updateGlobalTextEditorHandlesLayer,
    hideNotePixiText,
    hideStaticTextDuringEditing,
} from './TextEditorLifecycleRegistry.js';
import {
    applyInitialTextEditorTextareaStyles,
    attachTextEditorPlaceholderStyle,
    computeTextEditorLineHeightPx,
    createTextEditorTextarea,
    createTextEditorWrapper,
    measureTextEditorPlaceholderWidth,
} from './TextEditorDomFactory.js';
import { setupNoteInlineEditor } from './NoteInlineEditorController.js';
import {
    createRegularTextAutoSize,
    createRegularTextEditorUpdater,
    registerRegularTextEditorSync,
} from './TextEditorSyncService.js';
import { updateCustomCaret } from './TextEditorCaretService.js';
import { TEXT_BOX_BOTTOM_PAD_PX } from '../../../services/text/TextBoxMetrics.js';
import { buildHtmlWithRanges } from '../../../ui/HtmlTextLayer.js';

export function openTextEditor(object, create = false) {

    // Проверяем структуру объекта и извлекаем данные
    let objectId, objectType, position, properties;

    if (create) {
        // Для создания нового объекта - данные в object.object
        const objData = object.object || object;
        objectId = objData.id || null;
        objectType = objData.type || 'text';
        position = objData.position;
        properties = objData.properties || {};
    } else {
        // Для редактирования существующего объекта - данные в корне
        objectId = object.id;
        objectType = object.type || 'text';
        position = object.position;
        properties = object.properties || {};
    }


    let { fontSize = 32, content = '', initialSize } = properties;

    // Определяем тип объекта
    const isNote = objectType === 'note';
    const isShape = objectType === 'shape';

    // Проверяем, что position существует
    if (!position) {
        console.error('❌ SelectTool: position is undefined in _openTextEditor', { object, create });
        return;
    }

    // Закрываем предыдущий редактор, если он открыт.
    // Защита от повторного открытия того же объекта в один цикл событий:
    // не пересоздаём textarea/обёртку, если уже редактируем этот объект.
    if (this.textEditor.active) {
        const sameEditorObject = !!(
            objectId &&
            this.textEditor.objectId &&
            this.textEditor.objectId === objectId &&
            this.textEditor.objectType === objectType
        );
        if (sameEditorObject && this.textEditor.textarea) {
            try { this.textEditor.textarea.focus({ preventScroll: true }); } catch (_) {}
            return;
        }
        this._closeTextEditor(true);
    }

    // Если это редактирование существующего объекта, получаем его данные
    if (!create && objectId) {
        const posData = { objectId, position: null };
        const sizeData = { objectId, size: null };
        const pixiReq = { objectId, pixiObject: null };
        this.eventBus.emit(Events.Tool.GetObjectPosition, posData);
        this.eventBus.emit(Events.Tool.GetObjectSize, sizeData);
        this.eventBus.emit(Events.Tool.GetObjectPixi, pixiReq);

        // Обновляем данные из полученной информации
        if (posData.position) position = posData.position;
        if (sizeData.size) initialSize = sizeData.size;

        const meta = pixiReq.pixiObject && pixiReq.pixiObject._mb ? pixiReq.pixiObject._mb.properties || {} : {};
        if (meta.content) properties.content = meta.content;
        if (meta.fontSize) properties.fontSize = meta.fontSize;
    }

    // Уведомляем о начале редактирования (для разных типов отдельно)
    if (objectType === 'note') {
        this.eventBus.emit(Events.UI.NoteEditStart, { objectId: objectId || null });
    } else {
        this.eventBus.emit(Events.UI.TextEditStart, { objectId: objectId || null });
    }
    // Подавляем пересоздание ручек при паразитных ResizeUpdate (тач double-tap):
    // host.update() внутри HandlesEventBridge вызывается при каждом ResizeUpdate,
    // _handlesSuppressed=true гарантирует что showBounds не создаст ручки поверх textarea.
    try {
        if (typeof window !== 'undefined' && window.moodboardHtmlHandlesLayer) {
            window.moodboardHtmlHandlesLayer._handlesSuppressed = true;
        }
    } catch (_) {}
    // Обновляем глобальные HTML-ручки на время редактирования, чтобы осталась только рамка без точек
    updateGlobalTextEditorHandlesLayer();

    const app = this.app;
    const world = app?.stage?.getChildByName && app.stage.getChildByName('worldLayer');
    this.textEditor.world = world || null;
    const view = app?.view;
    if (!view) return;
    // Рассчитываем эффективный размер шрифта ДО вставки textarea в DOM, чтобы избежать скачка размера
    const worldLayerEarly = world || (this.app?.stage);
    const sEarly = worldLayerEarly?.scale?.x || 1;
    const viewResEarly = (this.app?.renderer?.resolution) || (view.width && view.clientWidth ? (view.width / view.clientWidth) : 1);
    const sCssEarly = sEarly / viewResEarly;
    let effectiveFontPx = Math.max(1, Math.round((fontSize || 14) * sCssEarly));
    // Точное выравнивание размеров:
    if (objectId) {
        if (objectType === 'note') {
            try {
                const pixiReq = { objectId, pixiObject: null };
                this.eventBus.emit(Events.Tool.GetObjectPixi, pixiReq);
                const inst = pixiReq.pixiObject && pixiReq.pixiObject._mb && pixiReq.pixiObject._mb.instance;
                if (inst && inst.textField) {
                    const wt = inst.textField.worldTransform;
                    const scaleY = Math.max(0.0001, Math.hypot(wt.c || 0, wt.d || 0));
                    const baseFS = parseFloat(inst.textField.style?.fontSize || fontSize || 14) || (fontSize || 14);
                    // worldTransform.scaleY = worldScale; CSS-размер глифа PIXI-записки = baseFS*worldScale
                    // (res в трансформ сцены не входит). Деление на viewResEarly делало шрифт редактора
                    // мельче статического при res≠1 и рассогласовывало перенос строк с записанным текстом.
                    effectiveFontPx = Math.max(1, Math.round(baseFS * scaleY));
                }
            } catch (_) {}
        } else if (typeof window !== 'undefined' && window.moodboardHtmlTextLayer) {
            const el = window.moodboardHtmlTextLayer.idToEl.get(objectId);
            if (el && typeof window.getComputedStyle === 'function') {
                const cs = window.getComputedStyle(el);
                const f = parseFloat(cs.fontSize);
                if (isFinite(f) && f > 0) effectiveFontPx = Math.round(f);
            }
        }
    }
    // Используем только HTML-ручки во время редактирования текста
    // Обертка для рамки + textarea + ручек
    const { wrapper, caret } = createTextEditorWrapper();

    // Базовые стили вынесены в CSS (.moodboard-text-editor)

    const textarea = createTextEditorTextarea(content || '');
    const backdrop = wrapper.querySelector('.moodboard-text-backdrop');

    // Собираем текстовые параметры из статического .mb-text (для существующих объектов)
    // или из properties. Единый источник гарантирует идентичный рендер в обоих режимах.
    let resolvedFontFamily = properties.fontFamily || 'Caveat, Arial, cursive';
    let resolvedColor = properties.color || '#111';
    let lhInitial = computeTextEditorLineHeightPx(effectiveFontPx);

    try {
        if (objectId) {
            if (objectType === 'note') {
                const pixiReq = { objectId, pixiObject: null };
                this.eventBus.emit(Events.Tool.GetObjectPixi, pixiReq);
                const inst = pixiReq.pixiObject && pixiReq.pixiObject._mb && pixiReq.pixiObject._mb.instance;
                if (inst && inst.textField) {
                    const wt = inst.textField.worldTransform;
                    const scaleY = Math.max(0.0001, Math.hypot(wt.c || 0, wt.d || 0));
                    const baseLH = parseFloat(inst.textField.style?.lineHeight || (fontSize * 1.2)) || (fontSize * 1.2);
                    lhInitial = Math.max(1, Math.round(baseLH * (scaleY / viewResEarly)));
                    const ff = (inst.textField.style && inst.textField.style.fontFamily)
                        || (pixiReq.pixiObject._mb.properties && pixiReq.pixiObject._mb.properties.fontFamily)
                        || null;
                    if (ff) resolvedFontFamily = ff;
                }
            } else if (typeof window !== 'undefined' && window.moodboardHtmlTextLayer) {
                const el = window.moodboardHtmlTextLayer.idToEl.get(objectId);
                if (el && typeof window.getComputedStyle === 'function') {
                    const cs = window.getComputedStyle(el);
                    const f = parseFloat(cs.fontSize);
                    if (isFinite(f) && f > 0) effectiveFontPx = Math.round(f);
                    const lh = parseFloat(cs.lineHeight);
                    if (isFinite(lh) && lh > 0) lhInitial = Math.round(lh);
                    if (cs.fontFamily) resolvedFontFamily = cs.fontFamily;
                    if (cs.color) resolvedColor = cs.color;
                }
            }
        }
    } catch (_) {}

    // Применяем все текстовые параметры через единый applyTextStyles.
    // textarea рендерит текст прозрачным (backdrop отвечает за видимые глифы),
    // поэтому после applyTextStyles явно переопределяем color.
    applyInitialTextEditorTextareaStyles(textarea, {
        effectiveFontPx,
        baseFontSizePx: fontSize,
        fontFamily: resolvedFontFamily,
        properties,
        lineHeightPx: lhInitial,
    });
    textarea.style.color = 'transparent';

    if (backdrop) {
        applyInitialTextEditorTextareaStyles(backdrop, {
            effectiveFontPx,
            baseFontSizePx: fontSize,
            fontFamily: resolvedFontFamily,
            properties,
            lineHeightPx: lhInitial,
        });
        backdrop.style.color = resolvedColor;
    }

    // Shape: текст по центру — переопределяем textAlign после applyTextStyles
    if (isShape) {
        textarea.style.textAlign = 'center';
        textarea.placeholder = '';
        if (backdrop) backdrop.style.textAlign = 'center';
    }

    wrapper.appendChild(textarea);
    // Убрана зелёная рамка вокруг поля ввода по требованию

    // В режиме input не показываем локальные ручки

    // Не создаём локальные синие ручки: используем HtmlHandlesLayer (зелёные)

    // Убираем ручки ресайза для всех типов объектов
    // let handles = [];
    // let placeHandles = () => {};

    // if (!isNote) {
    //     // Ручки ресайза (8 штук) только для обычного текста
    //     handles = ['nw','n','ne','e','se','s','sw','w'].map(dir => {
    //         const h = document.createElement('div');
    //         h.dataset.dir = dir;
    //         Object.assign(h.style, {
    //             position: 'absolute', width: '12px', height: '12px', background: '#007ACC',
    //             border: '1px solid #fff', boxSizing: 'border-box', zIndex: 10001,
    //         });
    //         return h;
    //     });
    //
    //     placeHandles = () => {
    //         const w = wrapper.offsetWidth;
    //         const h = wrapper.offsetHeight;
    //         handles.forEach(hd => {
    //             const dir = hd.dataset.dir;
    //             // default reset
    //             hd.style.left = '0px';
    //             hd.style.top = '0px';
    //             hd.style.right = '';
    //             hd.style.bottom = '';
    //             switch (dir) {
    //                 case 'nw':
    //                     hd.style.left = `${-6}px`;
    //                     hd.style.top = `${-6}px`;
    //                     hd.style.cursor = 'nwse-resize';
    //                     break;
    //                 case 'n':
    //                     hd.style.left = `${Math.round(w / 2 - 6)}px`;
    //                     hd.style.top = `${-6}px`;
    //                     hd.style.cursor = 'n-resize';
    //                     break;
    //                 case 'ne':
    //                     hd.style.left = `${Math.max(-6, w - 6)}px`;
    //                     hd.style.top = `${-6}px`;
    //                     hd.style.cursor = 'nesw-resize';
    //                     break;
    //                 case 'e':
    //                     hd.style.left = `${Math.max(-6, w - 6)}px`;
    //                     hd.style.top = `${Math.round(h / 2 - 6)}px`;
    //                     hd.style.cursor = 'e-resize';
    //                     break;
    //                 case 'se':
    //                     hd.style.left = `${Math.max(-6, w - 6)}px`;
    //                     hd.style.top = `${Math.max(-6, h - 6)}px`;
    //                     hd.style.cursor = 'nwse-resize';
    //                     break;
    //                 case 's':
    //                     hd.style.left = `${Math.round(w / 2 - 6)}px`;
    //                     hd.style.top = `${Math.max(-6, h - 6)}px`;
    //                     hd.style.cursor = 's-resize';
    //                     break;
    //                 case 'sw':
    //                     hd.style.left = `${-6}px`;
    //                     hd.style.top = `${Math.max(-6, h - 6)}px`;
    //                     hd.style.cursor = 'nesw-resize';
    //                     break;
    //                 case 'w':
    //                     hd.style.left = `${-6}px`;
    //                     hd.style.top = `${Math.round(h / 2 - 6)}px`;
    //                     hd.style.cursor = 'w-resize';
    //                     break;
    //             }
    //         });
    //     }
    // }

    // Добавляем в DOM
    wrapper.appendChild(textarea);
    view.parentElement.appendChild(wrapper);

    // Позиция обертки по миру → экран
    const toScreen = createTextEditorToScreen(this, view);
    const screenPos = toScreen(position.x, position.y);

    // Для записок позиционируем редактор внутри записки
    let updateNoteEditor = null;
    let setNoteBanVisible = null;
    let regularEditorVisualBox = null;
    if (objectType === 'note') {
        const noteSetup = setupNoteInlineEditor(this, {
            objectId,
            position,
            initialSize,
            view,
            screenPos,
            textarea,
            wrapper,
            computeLineHeightPx: computeTextEditorLineHeightPx,
            effectiveFontPx,
            toScreen,
        });
        updateNoteEditor = noteSetup.updateNoteEditor;
        setNoteBanVisible = noteSetup.setBanVisible;
    } else if (isShape) {
        // Shape: редактор занимает весь bounds фигуры, текст вертикально центрирован
        const viewResShape = (this.app?.renderer?.resolution) ||
            (view.width && view.clientWidth ? view.width / view.clientWidth : 1);
        const worldLayerShape = this.textEditor.world || this.app?.stage;
        const sShape = worldLayerShape?.scale?.x || 1;
        const sCssShape = sShape / viewResShape;

        let shapeW = 100, shapeH = 100;
        if (initialSize) {
            shapeW = initialSize.width;
            shapeH = initialSize.height;
        } else if (objectId) {
            const sizeData = { objectId, size: null };
            this.eventBus.emit(Events.Tool.GetObjectSize, sizeData);
            if (sizeData.size) { shapeW = sizeData.size.width; shapeH = sizeData.size.height; }
        }

        const shapeCssW = Math.max(1, Math.round(shapeW * sCssShape));
        const shapeCssH = Math.max(1, Math.round(shapeH * sCssShape));
        // Центрируем каретку по вертикали: padding-top = (высота фигуры - высота одной строки) / 2
        const oneLinePx = Math.max(1, Math.round(effectiveFontPx * 1.4));
        const paddingTopShape = Math.max(0, Math.round((shapeCssH - oneLinePx) / 2));

        wrapper.style.left = `${Math.round(screenPos.x)}px`;
        wrapper.style.top = `${Math.round(screenPos.y)}px`;
        wrapper.style.width = `${shapeCssW}px`;
        wrapper.style.height = `${shapeCssH}px`;

        textarea.style.width = `${shapeCssW}px`;
        textarea.style.height = `${shapeCssH}px`;
        textarea.style.boxSizing = 'border-box';
        
        if (backdrop) {
            backdrop.style.width = `${shapeCssW}px`;
            backdrop.style.height = `${shapeCssH}px`;
            backdrop.style.boxSizing = 'border-box';
            backdrop.style.display = 'block';
            backdrop.style.paddingTop = `${paddingTopShape}px`;
            backdrop.style.paddingBottom = '0px';
        }
        
        // display:block убирает baseline-смещение inline-block textarea внутри wrapper'а
        // (wrapper наследует line-height ~24px от body, из-за чего на сильном отдалении
        // textarea съезжает вниз от фигуры на фиксированные ~11px независимо от зума).
        // padding-bottom:0 перебивает CSS .moodboard-text-input (5px), чтобы не раздувать
        // высоту поля относительно крошечной фигуры.
        textarea.style.display = 'block';
        textarea.style.paddingTop = `${paddingTopShape}px`;
        textarea.style.paddingBottom = '0px';

        this.textEditor._cssLeftPx = Math.round(screenPos.x);
        this.textEditor._cssTopPx = Math.round(screenPos.y);
    } else {
        const {
            leftPx,
            topPx,
            padTop,
            padLeft,
            lineHeightPx,
            baseLeftPx,
            baseTopPx,
            baseWidthPx,
            baseHeightPx,
        } = positionRegularTextEditor({
            create,
            objectId,
            screenPos,
            textarea,
            wrapper,
        });
        if (!create && baseWidthPx && baseHeightPx) {
            regularEditorVisualBox = {
                width: Math.max(1, Math.round(baseWidthPx)),
                height: Math.max(1, Math.round(baseHeightPx)),
            };
        }
        // Сохраняем CSS-позицию редактора для точной синхронизации при закрытии
        this.textEditor._cssLeftPx = leftPx;
        this.textEditor._cssTopPx = topPx;
        // Диагностика: логируем позицию инпута и вычисленные параметры позиционирования
        try {
            console.log('🧭 Text input', {
                input: { left: leftPx, top: topPx },
                screenPos,
                baseFromStatic: (!create && objectId) ? { left: baseLeftPx, top: baseTopPx } : null,
                padding: { top: padTop, left: padLeft },
                lineHeightPx,
                caretCenterY: create ? (topPx + padTop + (lineHeightPx / 2)) : topPx,
                create
            });
        } catch (_) {}

        // Для новых текстов: синхронизируем мировую позицию объекта с фактической позицией wrapper,
        // чтобы после закрытия редактора статичный текст встал ровно туда же без сдвига.
        // Используем ту же систему координат, что и HtmlTextLayer/HtmlHandlesLayer:
        // CSS ←→ world через toGlobal/toLocal БЕЗ умножения/деления на resolution.
        syncCreatedTextEditorWorldPosition({
            controller: this,
            create,
            objectId,
            position,
            leftPx,
            topPx,
            padTop,
        });
    }
    // Минимальные границы (зависят от текущего режима: новый объект или редактирование существующего)
    const worldLayerRef = this.textEditor.world || (this.app?.stage);
    const s = worldLayerRef?.scale?.x || 1;
    const viewRes = (this.app?.renderer?.resolution) || (view.width && view.clientWidth ? (view.width / view.clientWidth) : 1);
    // Синхронизируем стартовый размер шрифта textarea с текущим зумом (как HtmlTextLayer)
    // Используем ранее вычисленный effectiveFontPx (до вставки в DOM), если он есть в замыкании.
    // Для записки шрифт уже подобран autoSizeNote (fit-to-bounds): сброс к effectiveFontPx
    // рассинхронизировал бы textarea (по нему считается каретка) с backdrop.
    if (!isNote) {
        textarea.style.fontSize = `${effectiveFontPx}px`;
    }
    // Высоту/ширину поля при входе в редактор берём как максимум из видимого DOM-бокса
    // и размера в состоянии объекта. DOM-бокс .mb-text к этому моменту может быть схлопнут
    // до высоты контента (auto), тогда как в состоянии хранится вручную заданная высота рамки —
    // её и нужно сохранить, иначе поле ввода схлопывается до одной строки.
    const stateWpx = initialSize ? Math.max(1, (initialSize.width || 0) * s / viewRes) : 0;
    const stateHpx = initialSize ? Math.max(1, (initialSize.height || 0) * s / viewRes) : 0;
    const initialWpx = Math.max(regularEditorVisualBox?.width || 0, stateWpx) || null;
    const initialHpx = Math.max(regularEditorVisualBox?.height || 0, stateHpx) || null;

    // Определяем минимальные границы для всех типов объектов
    let minWBound = initialWpx || 120; // базово близко к призраку
    let minHBound = effectiveFontPx; // базовая высота
    // Уменьшаем визуальный нижний запас, который браузеры добавляют к textarea
    const BASELINE_FIX = TEXT_BOX_BOTTOM_PAD_PX; // px
    if (!isNote) {
        minHBound = Math.max(1, effectiveFontPx - BASELINE_FIX);
    }

    // Если создаём новый текст — длина поля ровно как placeholder
    if (create && !isNote && !isShape) {
        // +25% — запас на Caveat vs Arial: при незагруженном Caveat span рендерится в Arial,
        // а Caveat (рукописный шрифт) заметно шире для кириллицы.
        const startWidth = Math.max(1, Math.ceil(measureTextEditorPlaceholderWidth(textarea, 'Напишите что-нибудь') * 1.25));
        const startHeight = Math.max(1, lhInitial - BASELINE_FIX + 2); // +1px сверху и +1px снизу (паддинги textarea)
        textarea.style.width = `${startWidth}px`;
        textarea.style.height = `${startHeight}px`;
        wrapper.style.width = `${startWidth}px`;
        wrapper.style.height = `${startHeight}px`;
        // Зафиксируем минимальные границы, чтобы авторазмер не схлопывал пустое поле
        minWBound = startWidth;
        minHBound = startHeight;
    }

    // Для записок и фигур размеры уже установлены выше, пропускаем эту логику
    if (!isNote && !isShape && !create) {
        if (initialWpx) {
            textarea.style.width = `${initialWpx}px`;
            wrapper.style.width = `${initialWpx}px`;
        }
        if (initialHpx) {
            // Стартовую высоту ставим, чтобы не было вспышки при открытии, но minHBound НЕ
            // поднимаем до obj.height: высота поля авто-подгоняется под контент (как статический
            // .mb-text). Прежнее `minHBound = max(minHBound, initialHpx)` фиксировало рамку на
            // высоте obj.height; при завышенном obj.height поле оставалось высоким (пустой зазор
            // под текстом), особенно при зуме — baseBounds кэшировал завышенный minH и масштабировал
            // его. Обычный текст не имеет ручной высоты, поэтому фиксировать её не нужно.
            textarea.style.height = `${initialHpx}px`;
            wrapper.style.height = `${initialHpx}px`;
        }
    }
    // Автоподгон
    const syncRegularTextSizeToObject = !isNote && !isShape && objectId
        ? ({ widthPx, heightPx }) => {
            try {
                const scaleX = (worldLayerRef?.scale?.x) || 1;
                // Мировой размер resolution-независим: CSS = world × scale (как toGlobal),
                // без множителя renderer.resolution. Прежний × viewRes раздувал obj.height
                // при браузерном зуме/HiDPI (res ≠ 1), и рамка выделения во время
                // редактирования была в res раз выше текста.
                const widthWorld = Math.max(1, Math.ceil(widthPx / scaleX));
                const heightWorld = Math.max(1, Math.round(heightPx / scaleX));
                const posReq = { objectId, position: null };
                this.eventBus.emit(Events.Tool.GetObjectPosition, posReq);
                this.eventBus.emit(Events.Tool.ResizeUpdate, {
                    object: objectId,
                    size: { width: widthWorld, height: heightWorld },
                    position: posReq.position || { x: position.x, y: position.y },
                });
            } catch (_) {}
        }
        : null;

    const autoSize = createRegularTextAutoSize({
        textarea,
        wrapper,
        minWBound,
        minHBound,
        onSizeChange: syncRegularTextSizeToObject,
    });

    // Для существующего текста стартовый размер уже взят из видимого DOM-бокса:
    // пересчёт нужен только после фактического ввода, иначе рамка прыгает при входе в редактор.
    if (!isNote && !isShape && create) {
        autoSize();
    }
    // preventScroll: на планшете экранная клавиатура иначе триггерит нативный
    // scroll-into-view, который прокручивает контейнер холста — фигура и поле
    // ввода уезжают вниз от точки тапа. Позиция редактора уже привязана к
    // координатам канваса, нативная прокрутка здесь только мешает.
    textarea.focus({ preventScroll: true });
    // Записка: после фокуса повторно подгоняем блок (focus может изменить layout),
    // чтобы стартовая каретка считалась от уже подобранного размера шрифта, а не от 32px.
    if (isNote && updateNoteEditor) {
        try { updateNoteEditor(); } catch (_) {}
    }
    // Ручки скрыты в режиме input
    // Локальная CSS-настройка placeholder (меньше базового шрифта)
    const styleEl = attachTextEditorPlaceholderStyle(textarea, {
        effectiveFontPx,
        isNote,
    });
    this.textEditor = {
        active: true,
        objectId,
        textarea,
        wrapper,
        caret,
        world: this.textEditor.world,
        position,
        properties: { fontSize, highlightColor: properties.highlightColor },
        objectType,
        listType: properties.listType || 'none',
        _phStyle: styleEl,
        initialContent: content,
        isNewCreation: !!create,
    };

    // Если переходим в редактирование существующего текста по двойному клику,
    // устанавливаем каретку по координате клика между буквами
    applyTextEditorCaretFromClick({
        create,
        objectId,
        object,
        textarea,
    });

    // Если редактируем записку — скрываем PIXI-текст записки (чтобы не было дублирования)
    if (objectType === 'note' && objectId) {
        hideNotePixiText(this, objectId);
    }

    // Скрываем статичный текст во время редактирования для всех типов объектов
    hideStaticTextDuringEditing(this, objectId);
    // Ресайз мышью только для обычного текста
    // Не используем локальные ручки: ресайз обрабатывает HtmlHandlesLayer
    // Завершение
    const isNewCreation = !!create;
    const finalize = createTextEditorFinalize(this, {
        textarea,
        wrapper,
        view,
        viewRes,
        position,
        fontSize,
        objectId,
        isNewCreation,
        initialContent: content,
    });
    bindTextEditorInteractions(this, {
        textarea,
        isNewCreation,
        isNote,
        isShape,
        autoSize,
        updateNoteEditor,
        setNoteBanVisible,
        finalize,
        listType: properties.listType || 'none',
    });

    // Обычный текст: держим редактор выровненным по объекту и масштабируем шрифт при зуме/пэне.
    // Вертикальный якорь редактора унифицирован (см. positionRegularTextEditor), поэтому sync
    // безопасен и для сессии создания — без него только что созданный текст не масштабировался при зуме.
    // Записки используют собственный registerNoteEditorSync, фигуре синхронизация не нужна.
    if (!isNote && !isShape && objectId) {
        const updateRegularTextEditor = createRegularTextEditorUpdater(this, {
            objectId,
            position,
            view,
            textarea,
            wrapper,
            autoSize,
            baseFontPxAtOpen: effectiveFontPx,
            sCssAtOpen: s / viewRes,
        });
        const updateCaretAfterZoom = () => {
            updateCustomCaret(textarea, this.textEditor && this.textEditor.caret);
        };
        registerRegularTextEditorSync(this, {
            updateEditor: updateRegularTextEditor,
            updateCaret: updateCaretAfterZoom,
        });
    }
}

export function closeTextEditor(commit) {
    // Снимаем подавление ручек до вызова closeTextEditorFromState,
    // т.к. тот в конце вызывает updateGlobalTextEditorHandlesLayer() → update() → showBounds,
    // и ручки должны пересоздаться нормально.
    try {
        if (typeof window !== 'undefined' && window.moodboardHtmlHandlesLayer) {
            window.moodboardHtmlHandlesLayer._handlesSuppressed = false;
        }
    } catch (_) {}
    return closeTextEditorFromState(this, commit);
}
