import * as PIXI from 'pixi.js';
import { Events } from '../../../core/events/Events.js';
import {
    createTextEditorTextarea,
    createTextEditorWrapper,
} from './InlineEditorDomFactory.js';
import { toScreenWithContainerOffset } from './InlineEditorPositioningService.js';
import { setupNoteInlineEditor } from './NoteInlineEditorController.js';
import { unregisterEditorListeners } from './InlineEditorListenersRegistry.js';

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
    try {
        if (typeof window !== 'undefined' && window.moodboardHtmlHandlesLayer) {
            window.moodboardHtmlHandlesLayer.hide();
        }
    } catch (_) {}

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

    // Адаптивный межстрочный интервал для ввода, синхронно с HtmlTextLayer
    const computeLineHeightPx = (fs) => {
        if (fs <= 12) return Math.round(fs * 1.40);
        if (fs <= 18) return Math.round(fs * 1.34);
        if (fs <= 36) return Math.round(fs * 1.26);
        if (fs <= 48) return Math.round(fs * 1.24);
        if (fs <= 72) return Math.round(fs * 1.22);
        if (fs <= 96) return Math.round(fs * 1.20);
        return Math.round(fs * 1.18);
    };
    // Вычисляем межстрочный интервал; подгоняем к реальным значениям HTML-отображения
    let lhInitial = computeLineHeightPx(effectiveFontPx);
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
    textarea.style.fontSize = `${effectiveFontPx}px`;
    textarea.style.lineHeight = `${lhInitial}px`;
    const BASELINE_FIX_INIT = 0; // без внутренних отступов — высота = line-height
    const initialH = Math.max(1, lhInitial);
    textarea.style.minHeight = `${initialH}px`;
    textarea.style.height = `${initialH}px`;
    textarea.setAttribute('rows', '1');
    textarea.style.overflowY = 'hidden';
    textarea.style.whiteSpace = 'pre-wrap';
    textarea.style.wordBreak = 'break-word';
    textarea.style.letterSpacing = '0px';
    textarea.style.fontKerning = 'normal';

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
    const toScreen = (wx, wy) => toScreenWithContainerOffset(this.textEditor.world || (this.app?.stage), view, wx, wy);
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
            computeLineHeightPx,
            effectiveFontPx,
            toScreen,
        });
        updateNoteEditor = noteSetup.updateNoteEditor;
    } else {
        // Для обычного текста используем стандартное позиционирование
        // Динамически компенсируем внутренние отступы textarea для точного совпадения со статичным текстом
        let padTop = 0;
        let padLeft = 0;
        let lineHeightPx = 0;
        try {
            if (typeof window !== 'undefined' && window.getComputedStyle) {
                const cs = window.getComputedStyle(textarea);
                const pt = parseFloat(cs.paddingTop);
                const pl = parseFloat(cs.paddingLeft);
                const lh = parseFloat(cs.lineHeight);
                if (isFinite(pt)) padTop = pt;
                if (isFinite(pl)) padLeft = pl;
                if (isFinite(lh)) lineHeightPx = lh;
            }
        } catch (_) {}
        if (!isFinite(lineHeightPx) || lineHeightPx <= 0) {
            try {
                const r = textarea.getBoundingClientRect && textarea.getBoundingClientRect();
                if (r && isFinite(r.height)) lineHeightPx = r.height;
            } catch (_) {}
        }

        // Базовая точка позиционирования: для редактирования берём точные координаты статичного HTML-текста,
        // для создания — используем рассчитанные screenPos
        let baseLeftPx = screenPos.x;
        let baseTopPx = screenPos.y;
        try {
            if (!create && objectId && typeof window !== 'undefined' && window.moodboardHtmlTextLayer) {
                const el = window.moodboardHtmlTextLayer.idToEl.get(objectId);
                if (el) {
                    const cssLeft = parseFloat(el.style.left || 'NaN');
                    const cssTop = parseFloat(el.style.top || 'NaN');
                    if (isFinite(cssLeft)) baseLeftPx = cssLeft;
                    if (isFinite(cssTop)) baseTopPx = cssTop;
                }
            }
        } catch (_) {}

        const leftPx = Math.round(baseLeftPx - padLeft);
        const topPx = create
            ? Math.round(baseTopPx - padTop - (lineHeightPx / 2)) // по клику совмещаем центр строки с точкой клика
            : Math.round(baseTopPx - padTop); // при редактировании совмещаем верх контента
        wrapper.style.left = `${leftPx}px`;
        wrapper.style.top = `${topPx}px`;
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
        try {
            if (create && objectId) {
                const worldLayerRef = this.textEditor.world || (this.app?.stage);
                const viewEl = this.app?.view;
                if (worldLayerRef && viewEl && viewEl.parentElement) {
                    const containerRect = viewEl.parentElement.getBoundingClientRect();
                    const viewRect = viewEl.getBoundingClientRect();
                    const offsetLeft = viewRect.left - containerRect.left;
                    const offsetTop = viewRect.top - containerRect.top;

                    // Статичный HTML-текст не имеет верхнего внутреннего отступа (HtmlTextLayer ставит padding: 0),
                    // поэтому добавляем padTop к topPx при расчёте мировой позиции верхнего края текста.
                    const yCssStaticTop = Math.round(topPx + padTop);
                    // Переводим CSS-координаты wrapper в экранные координаты относительно view
                    const screenX = Math.round(leftPx - offsetLeft);
                    const screenY = Math.round(yCssStaticTop - offsetTop);
                    const globalPoint = new PIXI.Point(screenX, screenY);
                    const worldPoint = worldLayerRef.toLocal
                        ? worldLayerRef.toLocal(globalPoint)
                        : { x: position.x, y: position.y };
                    const newWorldPos = {
                        x: Math.round(worldPoint.x),
                        y: Math.round(worldPoint.y)
                    };
                    this.eventBus.emit(Events.Object.StateChanged, {
                        objectId: objectId,
                        updates: { position: newWorldPos }
                    });
                    // Диагностика
                    console.log('🧭 Text position sync', {
                        objectId,
                        newWorldPos,
                        leftPx,
                        topPx,
                        yCssStaticTop,
                        padTop,
                        offsetLeft,
                        offsetTop
                    });
                }
            }
        } catch (_) {}
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
        const measureTextWidth = () => {
            const sEl = document.createElement('span');
            sEl.style.position = 'absolute';
            sEl.style.visibility = 'hidden';
            sEl.style.whiteSpace = 'pre';
            sEl.style.fontFamily = textarea.style.fontFamily;
            sEl.style.fontSize = textarea.style.fontSize;
            sEl.textContent = 'Напишите что-нибудь';
            document.body.appendChild(sEl);
            const w = Math.ceil(sEl.getBoundingClientRect().width);
            sEl.remove();
            return w;
        };
        const startWidth = Math.max(1, measureTextWidth('Напишите что-нибудь'));
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
    const MAX_AUTO_WIDTH = 360; // Поведение как в Miro: авто-ширина до порога, далее перенос строк
    const autoSize = () => {
        if (isNote) {
            // Для заметок используем фиксированные размеры, вычисленные выше
            return;
        }
        // Сначала измеряем естественную ширину без ограничений
        textarea.style.width = 'auto';
        textarea.style.height = 'auto';

        // Желаемая ширина: не уже минимальной и не шире максимальной авто-ширины
        const naturalW = textarea.scrollWidth + 1;
        const targetW = Math.min(MAX_AUTO_WIDTH, Math.max(minWBound, naturalW));
        textarea.style.width = `${targetW}px`;
        wrapper.style.width = `${targetW}px`;

        // Высота по содержимому при установленной ширине
        textarea.style.height = 'auto';
        // Коррекция высоты: для одной строки принудительно равна line-height,
        // для нескольких строк используем scrollHeight с небольшим вычетом браузерного запаса
        const adjust = BASELINE_FIX;
        const computed = (typeof window !== 'undefined') ? window.getComputedStyle(textarea) : null;
        const lineH = (computed ? parseFloat(computed.lineHeight) : computeLineHeightPx(effectiveFontPx)) + 10; // +5px сверху и +5px снизу
        const rawH = textarea.scrollHeight;
        const lines = lineH > 0 ? Math.max(1, Math.round(rawH / lineH)) : 1;
        const targetH = lines <= 1
            ? Math.max(minHBound, Math.max(1, lineH - BASELINE_FIX))
            : Math.max(minHBound, Math.max(1, rawH - adjust));
        textarea.style.height = `${targetH}px`;
        wrapper.style.height = `${targetH}px`;
        // Ручки скрыты в режиме input
    };

    // Вызываем autoSize только для обычного текста
    if (!isNote) {
        autoSize();
    }
    textarea.focus();
    // Ручки скрыты в режиме input
    // Локальная CSS-настройка placeholder (меньше базового шрифта)
    const uid = 'mbti-' + Math.random().toString(36).slice(2);
    textarea.classList.add(uid);
    const styleEl = document.createElement('style');
    const phSize = effectiveFontPx;
    const placeholderOpacity = isNote ? '0.4' : '0.6'; // Для записок делаем placeholder менее заметным
    styleEl.textContent = `.${uid}::placeholder{font-size:${phSize}px;opacity:${placeholderOpacity};line-height:${computeLineHeightPx(phSize)}px;white-space:nowrap;}`;
    document.head.appendChild(styleEl);
    this.textEditor = { active: true, objectId, textarea, wrapper, world: this.textEditor.world, position, properties: { fontSize }, objectType, _phStyle: styleEl };

    // Если переходим в редактирование существующего текста по двойному клику,
    // устанавливаем каретку по координате клика между буквами
    try {
        const click = (object && object.caretClick) ? object.caretClick : null;
        if (!create && objectId && click && typeof window !== 'undefined') {
            setTimeout(() => {
                try {
                    const el = window.moodboardHtmlTextLayer ? window.moodboardHtmlTextLayer.idToEl.get(objectId) : null;
                    const fullText = (typeof textarea.value === 'string') ? textarea.value : '';
                    if (!el || !fullText || !el.firstChild) return;
                    const textNode = el.firstChild;
                    const len = textNode.textContent.length;
                    if (len === 0) {
                        textarea.selectionStart = textarea.selectionEnd = 0;
                        return;
                    }
                    const doc = el.ownerDocument || document;
                    let bestIdx = 0;
                    let bestDist = Infinity;
                    for (let i = 0; i <= len; i++) {
                        const range = doc.createRange();
                        range.setStart(textNode, i);
                        range.setEnd(textNode, i);
                        const rects = range.getClientRects();
                        const rect = rects && rects.length > 0 ? rects[0] : range.getBoundingClientRect();
                        if (rect && isFinite(rect.left) && isFinite(rect.top)) {
                            if (click.clientX >= rect.left && click.clientX <= rect.right &&
                                click.clientY >= rect.top && click.clientY <= rect.bottom) {
                                bestIdx = i;
                                bestDist = 0;
                                break;
                            }
                            const cx = Math.max(rect.left, Math.min(click.clientX, rect.right));
                            const cy = Math.max(rect.top, Math.min(click.clientY, rect.bottom));
                            const dx = click.clientX - cx;
                            const dy = click.clientY - cy;
                            const d2 = dx * dx + dy * dy;
                            if (d2 < bestDist) {
                                bestDist = d2;
                                bestIdx = i;
                            }
                        }
                    }
                    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
                    const caret = clamp(bestIdx, 0, fullText.length);
                    textarea.selectionStart = textarea.selectionEnd = caret;
                    if (typeof textarea.scrollTop === 'number') textarea.scrollTop = 0;
                    console.log('🧭 Text caret set', { objectId, caret, len: fullText.length });
                } catch (_) {}
            }, 0);
        }
    } catch (_) {}

    // Если редактируем записку — скрываем PIXI-текст записки (чтобы не было дублирования)
    if (objectType === 'note' && objectId) {
        try {
            const pixiReq = { objectId, pixiObject: null };
            this.eventBus.emit(Events.Tool.GetObjectPixi, pixiReq);
            const inst = pixiReq.pixiObject && pixiReq.pixiObject._mb && pixiReq.pixiObject._mb.instance;
            if (inst && typeof inst.hideText === 'function') {
                inst.hideText();
            }
        } catch (_) {}
    }

    // Скрываем статичный текст во время редактирования для всех типов объектов
    if (objectId) {
        // Проверяем, что HTML-элемент существует перед попыткой скрыть текст
        if (typeof window !== 'undefined' && window.moodboardHtmlTextLayer) {
            const el = window.moodboardHtmlTextLayer.idToEl.get(objectId);
            if (el) {
                this.eventBus.emit(Events.Tool.HideObjectText, { objectId });
            } else {
                console.warn(`❌ SelectTool: HTML-элемент для объекта ${objectId} не найден, пропускаем HideObjectText`);
            }
        } else {
            this.eventBus.emit(Events.Tool.HideObjectText, { objectId });
        }
    }
    // Ресайз мышью только для обычного текста
    // Не используем локальные ручки: ресайз обрабатывает HtmlHandlesLayer
    // Завершение
    const isNewCreation = !!create;
    const finalize = (commit) => {
        const value = textarea.value.trim();
        const commitValue = commit && value.length > 0;

        // Сохраняем objectType ДО сброса this.textEditor
        const currentObjectType = this.textEditor.objectType;

        // Показываем статичный текст только если не отменяем создание нового пустого
        if (objectId && (commitValue || !isNewCreation)) {
            // Проверяем, что HTML-элемент существует перед попыткой показать текст
            if (typeof window !== 'undefined' && window.moodboardHtmlTextLayer) {
                const el = window.moodboardHtmlTextLayer.idToEl.get(objectId);
                if (el) {
                    this.eventBus.emit(Events.Tool.ShowObjectText, { objectId });
                } else {
                    console.warn(`❌ SelectTool: HTML-элемент для объекта ${objectId} не найден, пропускаем ShowObjectText`);
                }
            } else {
                this.eventBus.emit(Events.Tool.ShowObjectText, { objectId });
            }
        }

        // Перед скрытием — если редактировался существующий текст, обновим его размер под текущий редактор
        if (objectId && (currentObjectType === 'text' || currentObjectType === 'simple-text')) {
            try {
                const worldLayerRef = this.textEditor.world || (this.app?.stage);
                const s = worldLayerRef?.scale?.x || 1;
                const viewResLocal = (this.app?.renderer?.resolution) || (view.width && view.clientWidth ? (view.width / view.clientWidth) : 1);
                const wPx = Math.max(1, wrapper.offsetWidth);
                const hPx = Math.max(1, wrapper.offsetHeight);
                const newW = Math.max(1, Math.round(wPx * viewResLocal / s));
                const newH = Math.max(1, Math.round(hPx * viewResLocal / s));
                // Получим старые размеры для команды
                const sizeReq = { objectId, size: null };
                this.eventBus.emit(Events.Tool.GetObjectSize, sizeReq);
                const oldSize = sizeReq.size || { width: newW, height: newH };
                // Позиция в state хранится как левый-верх
                const posReq = { objectId, position: null };
                this.eventBus.emit(Events.Tool.GetObjectPosition, posReq);
                const oldPos = posReq.position || { x: position.x, y: position.y };
                const newSize = { width: newW, height: newH };
                // Во время ResizeUpdate ядро обновит и PIXI, и state
                this.eventBus.emit(Events.Tool.ResizeUpdate, { object: objectId, size: newSize, position: oldPos });
                // Зафиксируем изменение одной командой
                this.eventBus.emit(Events.Tool.ResizeEnd, { object: objectId, oldSize: oldSize, newSize: newSize, oldPosition: oldPos, newPosition: oldPos });
            } catch (err) {
                console.warn('⚠️ Не удалось применить размеры после редактирования текста:', err);
            }
        }

        // Убираем редактор
        // Снимем навешанные на время редактирования слушатели
        try {
            if (this.textEditor && Array.isArray(this.textEditor._listeners)) {
                unregisterEditorListeners(this.eventBus, this.textEditor._listeners);
            }
        } catch (_) {}
        wrapper.remove();
        this.textEditor = { active: false, objectId: null, textarea: null, wrapper: null, world: null, position: null, properties: null, objectType: 'text' };
        if (currentObjectType === 'note') {
            this.eventBus.emit(Events.UI.NoteEditEnd, { objectId: objectId || null });
            // Вернём PIXI-текст записки
            try {
                const pixiReq = { objectId, pixiObject: null };
                this.eventBus.emit(Events.Tool.GetObjectPixi, pixiReq);
                const inst = pixiReq.pixiObject && pixiReq.pixiObject._mb && pixiReq.pixiObject._mb.instance;
                if (inst && typeof inst.showText === 'function') {
                    inst.showText();
                }
            } catch (_) {}
        } else {
            this.eventBus.emit(Events.UI.TextEditEnd, { objectId: objectId || null });
        }
        // Возвращаем глобальные HTML-ручки (обновляем слой)
        try {
            if (typeof window !== 'undefined' && window.moodboardHtmlHandlesLayer) {
                window.moodboardHtmlHandlesLayer.update();
            }
        } catch (_) {}
        if (!commitValue) {
            // Если это было создание нового текста и оно отменено — удаляем пустой объект
            if (isNewCreation && objectId) {
                this.eventBus.emit(Events.Tool.ObjectsDelete, { objects: [objectId] });
            }
            return;
        }
        if (objectId == null) {
            // Создаем объект с правильным типом
            const objectType = currentObjectType || 'text';
            // Конвертируем размеры редактора (px) в мировые единицы
            const worldLayerRef = this.textEditor.world || (this.app?.stage);
            const s = worldLayerRef?.scale?.x || 1;
            const wPx = Math.max(1, wrapper.offsetWidth);
            const hPx = Math.max(1, wrapper.offsetHeight);
            const wWorld = Math.max(1, Math.round(wPx * viewRes / s));
            const hWorld = Math.max(1, Math.round(hPx * viewRes / s));
            this.eventBus.emit(Events.UI.ToolbarAction, {
                type: objectType,
                id: objectType,
                position: { x: position.x, y: position.y },
                properties: { content: value, fontSize, width: wWorld, height: hWorld }
            });
        } else {
            // Обновление существующего: используем команду обновления содержимого
            if (currentObjectType === 'note') {
                // Для записок обновляем содержимое через PixiEngine
                this.eventBus.emit(Events.Tool.UpdateObjectContent, {
                    objectId: objectId,
                    content: value
                });

                // Обновляем состояние объекта в StateManager
                this.eventBus.emit(Events.Object.StateChanged, {
                    objectId: objectId,
                    updates: {
                        properties: { content: value }
                    }
                });
            } else {
                // Для обычного текста тоже используем обновление содержимого
                this.eventBus.emit(Events.Tool.UpdateObjectContent, {
                    objectId: objectId,
                    content: value
                });

                // Обновляем состояние объекта в StateManager
                this.eventBus.emit(Events.Object.StateChanged, {
                    objectId: objectId,
                    updates: {
                        properties: { content: value }
                    }
                });
            }
        }
    };
    textarea.addEventListener('blur', () => {
        const value = (textarea.value || '').trim();
        if (isNewCreation && value.length === 0) {
            // Клик вне поля при пустом значении — отменяем и удаляем созданный объект
            finalize(false);
            return;
        }
        finalize(true);
    });
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            finalize(true);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            finalize(false);
        }
    });
    // Автоподгон при вводе
    if (!isNote) {
        textarea.addEventListener('input', autoSize);
    } else {
        // Для заметок растягиваем редактор по содержимому и центрируем с учётом зума
        textarea.addEventListener('input', () => { try { if (updateNoteEditor) updateNoteEditor(); } catch (_) {} });
    }
}

export function closeTextEditor(commit) {
    const textarea = this.textEditor.textarea;
    if (!textarea) return;
    const value = textarea.value.trim();
    const commitValue = commit && value.length > 0;
    const objectType = this.textEditor.objectType || 'text';
    const objectId = this.textEditor.objectId;
    const position = this.textEditor.position;
    const properties = this.textEditor.properties;

    // Показываем статичный текст после завершения редактирования для всех типов объектов
    if (objectId) {
        // Проверяем, что HTML-элемент существует перед попыткой показать текст
        if (typeof window !== 'undefined' && window.moodboardHtmlTextLayer) {
            const el = window.moodboardHtmlTextLayer.idToEl.get(objectId);
            if (el) {
                this.eventBus.emit(Events.Tool.ShowObjectText, { objectId });
                // После отображения статичного текста — выровняем его позицию ровно под textarea
                try {
                    const view = this.app?.view;
                    const worldLayerRef = this.textEditor.world || (this.app?.stage);
                    const cssLeft = this.textEditor._cssLeftPx;
                    const cssTop = this.textEditor._cssTopPx;
                    if (view && view.parentElement && isFinite(cssLeft) && isFinite(cssTop) && worldLayerRef) {
                        // Ждем один тик, чтобы HtmlTextLayer успел обновить DOM
                        setTimeout(() => {
                            try {
                                // Инвертируем ту же трансформацию, что использует HtmlHandlesLayer/HtmlTextLayer:
                                // world → toGlobal → offset → CSS px
                                const containerRect = view.parentElement.getBoundingClientRect();
                                const viewRect = view.getBoundingClientRect();
                                const offsetLeft = viewRect.left - containerRect.left;
                                const offsetTop = viewRect.top - containerRect.top;
                                // CSS → экранные координаты внутри canvas
                                const screenX = cssLeft - offsetLeft;
                                const screenY = cssTop - offsetTop;
                                // Экранные → мировые координаты через toLocal
                                const desiredWorld = worldLayerRef.toLocal(new PIXI.Point(screenX, screenY));
                                const newPos = { x: Math.round(desiredWorld.x), y: Math.round(desiredWorld.y) };
                                this.eventBus.emit(Events.Object.StateChanged, {
                                    objectId,
                                    updates: { position: newPos }
                                });
                                console.log('🧭 Text post-show align', { objectId, cssLeft, cssTop, newPos });
                            } catch (_) {}
                        }, 0);
                    }
                } catch (_) {}
            } else {
                console.warn(`❌ SelectTool: HTML-элемент для объекта ${objectId} не найден, пропускаем ShowObjectText`);
            }
        } else {
            this.eventBus.emit(Events.Tool.ShowObjectText, { objectId });
        }
    }

    textarea.remove();
    this.textEditor = { active: false, objectId: null, textarea: null, world: null, objectType: 'text' };
    if (!commitValue) return;
    if (objectId == null) {
        // Создаём новый объект через ToolbarAction
        this.eventBus.emit(Events.UI.ToolbarAction, {
            type: objectType,
            id: objectType,
            position: { x: position.x, y: position.y },
            properties: { content: value, fontSize: properties.fontSize }
        });
    } else {
        // Обновление существующего: используем команду обновления содержимого
        if (objectType === 'note') {
            console.log('🔧 SelectTool: updating note content via UpdateObjectContent');
            // Для записок обновляем содержимое через PixiEngine
            this.eventBus.emit(Events.Tool.UpdateObjectContent, {
                objectId: objectId,
                content: value
            });

            // Обновляем состояние объекта в StateManager
            this.eventBus.emit(Events.Object.StateChanged, {
                objectId: objectId,
                updates: {
                    properties: { content: value }
                }
            });
        } else {
            // Для обычного текста тоже используем обновление содержимого
            console.log('🔧 SelectTool: updating text content via UpdateObjectContent');
            this.eventBus.emit(Events.Tool.UpdateObjectContent, {
                objectId: objectId,
                content: value
            });

            // Обновляем состояние объекта в StateManager
            this.eventBus.emit(Events.Object.StateChanged, {
                objectId: objectId,
                updates: {
                    properties: { content: value }
                }
            });
        }
    }
}
