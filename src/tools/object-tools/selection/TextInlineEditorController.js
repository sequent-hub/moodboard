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
    hideGlobalTextEditorHandlesLayer,
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
import { createRegularTextAutoSize } from './TextEditorSyncService.js';

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

    // Проверяем, что position существует
    if (!position) {
        console.error('❌ SelectTool: position is undefined in _openTextEditor', { object, create });
        return;
    }

    // Закрываем предыдущий редактор, если он открыт
    if (this.textEditor.active) this._closeTextEditor(true);

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
    // Прячем глобальные HTML-ручки на время редактирования, чтобы не было второй рамки
    hideGlobalTextEditorHandlesLayer();

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
                    effectiveFontPx = Math.max(1, Math.round(baseFS * (scaleY / viewResEarly)));
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
    const wrapper = createTextEditorWrapper();

    // Базовые стили вынесены в CSS (.moodboard-text-editor)

    const textarea = createTextEditorTextarea(content || '');

    // Вычисляем межстрочный интервал; подгоняем к реальным значениям HTML-отображения
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
                }
            } else if (typeof window !== 'undefined' && window.moodboardHtmlTextLayer) {
                const el = window.moodboardHtmlTextLayer.idToEl.get(objectId);
                if (el) {
                    const cs = window.getComputedStyle(el);
                    const lh = parseFloat(cs.lineHeight);
                    if (isFinite(lh) && lh > 0) lhInitial = Math.round(lh);
                }
            }
        }
    } catch (_) {}

    // Базовые стили вынесены в CSS (.moodboard-text-input); здесь — только динамика
    // Подбираем актуальный font-family из объекта
    try {
        if (objectId) {
            if (objectType === 'note') {
                // Для записки читаем из PIXI-инстанса NoteObject
                const pixiReq = { objectId, pixiObject: null };
                this.eventBus.emit(Events.Tool.GetObjectPixi, pixiReq);
                const inst = pixiReq.pixiObject && pixiReq.pixiObject._mb && pixiReq.pixiObject._mb.instance;
                const ff = (inst && inst.textField && inst.textField.style && inst.textField.style.fontFamily)
                    || (pixiReq.pixiObject && pixiReq.pixiObject._mb && pixiReq.pixiObject._mb.properties && pixiReq.pixiObject._mb.properties.fontFamily)
                    || null;
                if (ff) textarea.style.fontFamily = ff;
            } else if (typeof window !== 'undefined' && window.moodboardHtmlTextLayer) {
                // Для обычного текста читаем из HTML-элемента
                const el = window.moodboardHtmlTextLayer.idToEl.get(objectId);
                if (el) {
                    const cs = window.getComputedStyle(el);
                    const ff = cs && cs.fontFamily ? cs.fontFamily : null;
                    if (ff) textarea.style.fontFamily = ff;
                }
            }
        }
    } catch (_) {}
    applyInitialTextEditorTextareaStyles(textarea, {
        effectiveFontPx,
        lineHeightPx: lhInitial,
    });

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
    } else {
        const {
            leftPx,
            topPx,
            padTop,
            padLeft,
            lineHeightPx,
            baseLeftPx,
            baseTopPx,
        } = positionRegularTextEditor({
            create,
            objectId,
            screenPos,
            textarea,
            wrapper,
        });
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
    // Используем ранее вычисленный effectiveFontPx (до вставки в DOM), если он есть в замыкании
    textarea.style.fontSize = `${effectiveFontPx}px`;
    const initialWpx = initialSize ? Math.max(1, (initialSize.width || 0) * s / viewRes) : null;
    const initialHpx = initialSize ? Math.max(1, (initialSize.height || 0) * s / viewRes) : null;

    // Определяем минимальные границы для всех типов объектов
    let minWBound = initialWpx || 120; // базово близко к призраку
    let minHBound = effectiveFontPx; // базовая высота
    // Уменьшаем визуальный нижний запас, который браузеры добавляют к textarea
    const BASELINE_FIX = 2; // px
    if (!isNote) {
        minHBound = Math.max(1, effectiveFontPx - BASELINE_FIX);
    }

    // Если создаём новый текст — длина поля ровно как placeholder
    if (create && !isNote) {
        const startWidth = Math.max(1, measureTextEditorPlaceholderWidth(textarea, 'Напишите что-нибудь'));
        const startHeight = Math.max(1, lhInitial - BASELINE_FIX + 10); // +5px сверху и +5px снизу
        textarea.style.width = `${startWidth}px`;
        textarea.style.height = `${startHeight}px`;
        wrapper.style.width = `${startWidth}px`;
        wrapper.style.height = `${startHeight}px`;
        // Зафиксируем минимальные границы, чтобы авторазмер не схлопывал пустое поле
        minWBound = startWidth;
        minHBound = startHeight;
    }

    // Для записок размеры уже установлены выше, пропускаем эту логику
    if (!isNote) {
        if (initialWpx) {
            textarea.style.width = `${initialWpx}px`;
            wrapper.style.width = `${initialWpx}px`;
        }
        if (initialHpx) {
            textarea.style.height = `${initialHpx}px`;
            wrapper.style.height = `${initialHpx}px`;
        }
    }
    // Автоподгон
    const autoSize = createRegularTextAutoSize({
        textarea,
        wrapper,
        minWBound,
        minHBound,
        effectiveFontPx,
        computeLineHeightPx: computeTextEditorLineHeightPx,
    });

    // Вызываем autoSize только для обычного текста
    if (!isNote) {
        autoSize();
    }
    textarea.focus();
    // Ручки скрыты в режиме input
    // Локальная CSS-настройка placeholder (меньше базового шрифта)
    const styleEl = attachTextEditorPlaceholderStyle(textarea, {
        effectiveFontPx,
        isNote,
    });
    this.textEditor = { active: true, objectId, textarea, wrapper, world: this.textEditor.world, position, properties: { fontSize }, objectType, _phStyle: styleEl };

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
    });
    bindTextEditorInteractions({
        textarea,
        isNewCreation,
        isNote,
        autoSize,
        updateNoteEditor,
        finalize,
    });
}

export function closeTextEditor(commit) {
    return closeTextEditorFromState(this, commit);
}
