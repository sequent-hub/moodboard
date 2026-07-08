import { Events } from '../../../core/events/Events.js';
import { alignStaticTextToEditorCssPosition } from './TextEditorPositioningService.js';
import { updateCustomCaret } from './TextEditorCaretService.js';
import { buildHtmlWithRanges } from '../../../ui/HtmlTextLayer.js';
import {
    cleanupActiveTextEditor,
    showNotePixiText,
    showStaticTextAfterEditing,
    updateGlobalTextEditorHandlesLayer,
} from './TextEditorLifecycleRegistry.js';
import { unregisterEditorListeners } from './InlineEditorListenersRegistry.js';

export function applyTextEditorCaretFromClick({ create, objectId, object, textarea }) {
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
}

export function createTextEditorFinalize(controller, {
    textarea,
    wrapper,
    view,
    viewRes,
    position,
    fontSize,
    objectId,
    isNewCreation,
    initialContent = '',
}) {
    return (commit) => {
        if (controller.textEditor?._removeDomListeners) {
            controller.textEditor._removeDomListeners();
            controller.textEditor._removeDomListeners = null;
        }

        const value = textarea.value.trim();
        const commitValue = commit && value.length > 0;

        const currentObjectType = controller.textEditor.objectType;

        if (objectId && (commitValue || !isNewCreation)) {
            showStaticTextAfterEditing(controller, objectId);
        }

        if (objectId && (currentObjectType === 'text' || currentObjectType === 'simple-text')) {
            try {
                const worldLayerRef = controller.textEditor.world || (controller.app?.stage);
                const scaleX = worldLayerRef?.scale?.x || 1;
                const viewResLocal = (controller.app?.renderer?.resolution) || (view.width && view.clientWidth ? (view.width / view.clientWidth) : 1);
                const wPx = Math.max(1, wrapper.offsetWidth);
                const _taStyle = typeof window !== 'undefined' ? window.getComputedStyle(textarea) : null;
                const _taPaddingV = _taStyle ? (parseFloat(_taStyle.paddingTop) || 0) + (parseFloat(_taStyle.paddingBottom) || 0) : 0;
                const hPx = Math.max(1, wrapper.offsetHeight - _taPaddingV);
                const newW = Math.max(1, Math.round(wPx * viewResLocal / scaleX));
                const newH = Math.max(1, Math.round(hPx * viewResLocal / scaleX));
                const sizeReq = { objectId, size: null };
                controller.eventBus.emit(Events.Tool.GetObjectSize, sizeReq);
                const oldSize = sizeReq.size || { width: newW, height: newH };
                const posReq = { objectId, position: null };
                controller.eventBus.emit(Events.Tool.GetObjectPosition, posReq);
                const oldPos = posReq.position || { x: position.x, y: position.y };
                const newSize = { width: newW, height: newH };
                controller.eventBus.emit(Events.Tool.ResizeUpdate, { object: objectId, size: newSize, position: oldPos });
                controller.eventBus.emit(Events.Tool.ResizeEnd, { object: objectId, oldSize, newSize, oldPosition: oldPos, newPosition: oldPos });
            } catch (err) {
                console.warn('⚠️ Не удалось применить размеры после редактирования текста:', err);
            }
        }

        cleanupActiveTextEditor(controller, wrapper);
        if (currentObjectType === 'note') {
            controller.eventBus.emit(Events.UI.NoteEditEnd, { objectId: objectId || null });
            showNotePixiText(controller, objectId);
        } else {
            controller.eventBus.emit(Events.UI.TextEditEnd, { objectId: objectId || null });
        }

        updateGlobalTextEditorHandlesLayer();

        if (!commitValue) {
            // Safety against race conditions: when a newly-created editor is blurred by
            // tool-switch/outside click, do not auto-delete the object. Explicit cancel
            // (Esc -> commit === false) still removes empty creation.
            const shouldDeleteEmptyNewCreation = isNewCreation && objectId && commit === false;
            if (shouldDeleteEmptyNewCreation) {
                controller.eventBus.emit(Events.Tool.ObjectsDelete, { objects: [objectId] });
            }
            return;
        }

        if (objectId == null) {
            const objectType = currentObjectType || 'text';
            const worldLayerRef = controller.textEditor.world || (controller.app?.stage);
            const scaleX = worldLayerRef?.scale?.x || 1;
            const wPx = Math.max(1, wrapper.offsetWidth);
            const _taStyle2 = typeof window !== 'undefined' ? window.getComputedStyle(textarea) : null;
            const _taPaddingV2 = _taStyle2 ? (parseFloat(_taStyle2.paddingTop) || 0) + (parseFloat(_taStyle2.paddingBottom) || 0) : 0;
            const hPx = Math.max(1, wrapper.offsetHeight - _taPaddingV2);
            const wWorld = Math.max(1, Math.round(wPx * viewRes / scaleX));
            const hWorld = Math.max(1, Math.round(hPx * viewRes / scaleX));
            controller.eventBus.emit(Events.UI.ToolbarAction, {
                type: objectType,
                id: objectType,
                position: { x: position.x, y: position.y },
                properties: { 
                    content: value, 
                    fontSize, 
                    width: wWorld, 
                    height: hWorld,
                    highlightColor: properties.highlightColor
                },
            });
        } else {
            if (isNewCreation) {
                const oldContent = typeof initialContent === 'string' ? initialContent : '';
                controller.eventBus.emit(Events.Object.ContentChange, {
                    objectId,
                    oldContent,
                    newContent: value,
                });
            } else {
                const oldContent = typeof initialContent === 'string' ? initialContent : '';
                controller.eventBus.emit(Events.Object.ContentChange, {
                    objectId,
                    oldContent,
                    newContent: value,
                });
            }
        }
    };
}

// Классы DOM-элементов, клики по которым не должны закрывать пустой текстовый редактор.
const UI_BLOCK_SELECTOR = [
    '.moodboard-toolbar',
    '.text-properties-layer',
    '.moodboard-topbar',
    '.moodboard-zoom-panel',
    '.moodboard-ui-layer',
].join(', ');

/**
 * Возвращает true, если элемент находится внутри UI-панелей (тулбар, панель свойств текста и т.п.).
 */
function _isInsideToolbarUI(target) {
    return !!(target && typeof target.closest === 'function' && target.closest(UI_BLOCK_SELECTOR));
}

/**
 * Возвращает true, если элемент находится внутри панели свойств текста (форматирование).
 */
function _isInsideTextPropertiesPanel(target) {
    return !!(target && typeof target.closest === 'function' && target.closest('.text-properties-layer'));
}

/**
 * Нативный color-input открывает системную палитру по mousedown; preventDefault его ломает.
 */
function _isNativeColorInput(target) {
    return !!(target && target.tagName === 'INPUT' && target.type === 'color');
}

export function bindTextEditorInteractions(controller, {
    textarea,
    isNewCreation,
    isNote,
    isShape,
    autoSize,
    updateNoteEditor,
    setNoteBanVisible,
    finalize,
    listType,
}) {
    const editorCreatedAt = Date.now();
    const blurHandler = () => {
        const editorObjectId = controller?.textEditor?.objectId || null;
        setTimeout(() => {
            // Если редактор уже закрыт/переключен другим обработчиком (outside click),
            // blur не должен дублировать finalize.
            if (!controller?.textEditor?.active) return;
            if ((controller?.textEditor?.objectId || null) !== editorObjectId) return;
            if (controller?.textEditor?._closingByOutside) return;

            // На touch создающий тап порождает синтетический mousedown по холсту,
            // который тут же снимает фокус с только что созданного пустого поля.
            // В течение короткого окна после создания не финализируем, а возвращаем фокус.
            if (isNewCreation && (Date.now() - editorCreatedAt) < 400) {
                try { textarea.focus({ preventScroll: true }); } catch (_) {}
                return;
            }

            const value = (textarea.value || '').trim();
            if (isNewCreation && value.length === 0) {
                // Записка и фигура остаются на доске пустыми: finalize(true) при пустом
                // значении не коммитит контент, но и не запускает удаление нового объекта
                // (см. shouldDeleteEmptyNewCreation). Для текста — прежнее удаление.
                finalize(isNote || isShape);
                return;
            }
            finalize(true);
        }, 0);
    };

    // Перехватываем mousedown на тулбаре/панелях в capture-фазе, чтобы:
    // 1. Предотвратить потерю фокуса textarea (e.preventDefault()).
    // 2. Заблокировать последующий click до ToolbarActionRouter (одноразовый capture-обработчик).
    // Работает только пока поле ввода пусто и объект только что создан — если текст уже есть,
    // клик по другому инструменту отрабатывает штатно (commit + переключение).
    let _pendingClickBlocker = null;
    const mousedownCaptureHandler = (e) => {
        if (!controller?.textEditor?.active) return;
        if (e.target === textarea) return;
        if (!_isInsideToolbarUI(e.target)) return;

        // Клик по панели свойств текста (например, выбор цвета подсветки выделенного
        // фрагмента): сохраняем фокус и выделение в textarea, но НЕ глушим сам click —
        // он должен дойти до кнопки/дропдауна. Иначе blur закроет редактор, и выделение
        // пропадёт ещё до выбора цвета.
        if (_isInsideTextPropertiesPanel(e.target) && !_isNativeColorInput(e.target)) {
            e.preventDefault();
            return;
        }

        const value = (textarea.value || '').trim();
        if (!isNewCreation || value.length > 0) return;

        // Пустое новое поле + клик по UI: не даём сместить фокус с textarea.
        e.preventDefault();

        // Блокируем следующий click-события, чтобы ToolbarActionRouter не переключил инструмент.
        if (_pendingClickBlocker) {
            document.removeEventListener('click', _pendingClickBlocker, true);
        }
        _pendingClickBlocker = (ce) => {
            if (_isInsideToolbarUI(ce.target)) {
                ce.stopPropagation();
                ce.preventDefault();
            }
            document.removeEventListener('click', _pendingClickBlocker, true);
            _pendingClickBlocker = null;
        };
        document.addEventListener('click', _pendingClickBlocker, true);

        // Страховочный возврат фокуса на случай, если браузер всё-таки убрал фокус.
        setTimeout(() => {
            if (controller?.textEditor?.active && textarea) {
                try { textarea.focus({ preventScroll: true }); } catch (_) {}
            }
        }, 0);
    };
    document.addEventListener('mousedown', mousedownCaptureHandler, true);

    const keydownHandler = (e) => {
        const isList = listType && listType !== 'none';
        if (e.key === 'Enter') {
            // В записке Enter переносит каретку на новую строку (нативное поведение
            // textarea), а не завершает ввод. Завершение — по клику вне записки (blur)
            // или по Escape. Высота поля пересчитывается через 'input' → updateNoteEditor.
            if (isNote) {
                return;
            }
            if (isList && !e.shiftKey) {
                e.preventDefault();
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const value = textarea.value;
                const lineStart = value.lastIndexOf('\n', start - 1) + 1;
                const lineEnd = value.indexOf('\n', start);
                const curLineEnd = lineEnd === -1 ? value.length : lineEnd;
                const currentLine = value.slice(lineStart, curLineEnd);
                if (currentLine.trim() === '' && start === end) {
                    finalize(true);
                } else {
                    textarea.setRangeText('\n', start, end, 'end');
                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                }
            } else if (isList && e.shiftKey) {
                e.preventDefault();
                finalize(true);
            } else if (!e.shiftKey) {
                e.preventDefault();
                finalize(true);
            }
            // Shift+Enter в режиме без списка: нативный перевод строки
        } else if (e.key === 'Escape') {
            e.preventDefault();
            finalize(false);
        }
    };

    // Записка и фигура имеют фиксированные границы — autoSize по вводу им не нужен.
    // Для фигуры autoSize раздувал поле до minWBound (120px) и при textAlign:center
    // уносил текст вправо от фигуры. Поэтому ввод в фигуре границы не меняет.
    let inputHandler;
    if (isNote) {
        // Лимит строк записки: если очередной ввод превышает вместимость (>25 строк или
        // не влезает по высоте при минимальном шрифте), откатываем значение и показываем
        // иконку запрета. Иначе пересчитываем подгонку и держим иконку, пока записка полна.
        let lastGoodValue = textarea.value;
        let lastGoodSel = textarea.selectionStart || 0;
        inputHandler = () => {
            try {
                const res = updateNoteEditor ? updateNoteEditor() : null;
                // Откатываем только рост текста, превысивший вместимость. Удаление/замену
                // на более короткое значение всегда принимаем, иначе из переполненного
                // состояния нельзя выйти.
                const growing = textarea.value.length > lastGoodValue.length;
                if (res && res.fits === false && growing) {
                    const restorePos = Math.min(lastGoodSel, lastGoodValue.length);
                    textarea.value = lastGoodValue;
                    textarea.selectionStart = textarea.selectionEnd = restorePos;
                    if (updateNoteEditor) updateNoteEditor();
                    if (setNoteBanVisible) setNoteBanVisible(true);
                } else {
                    lastGoodValue = textarea.value;
                    lastGoodSel = textarea.selectionStart || 0;
                    if (setNoteBanVisible) setNoteBanVisible(!!(res && res.full));
                }
            } catch (_) {}
        };
    } else if (isShape) {
        inputHandler = () => {};
    } else {
        inputHandler = autoSize;
    }

    const syncBackdrop = () => {
        if (!controller.textEditor) return;
        const wrapper = controller.textEditor.wrapper;
        const objectId = controller.textEditor.objectId;
        const editorProps = controller.textEditor.properties || {};
        
        const backdrop = wrapper ? wrapper.querySelector('.moodboard-text-backdrop') : null;
        if (!backdrop) return;
        
        // Актуальные highlights/links берём из _mb.properties объекта (обновляются
        // через Events.Object.StateChanged), с fallback на свойства редактора.
        let currentHighlights = editorProps.highlights || null;
        let currentLinks = editorProps.links || null;
        if (objectId) {
            try {
                const pixiReq = { objectId, pixiObject: null };
                controller.eventBus.emit(Events.Tool.GetObjectPixi, pixiReq);
                const props = pixiReq.pixiObject && pixiReq.pixiObject._mb
                    ? pixiReq.pixiObject._mb.properties
                    : null;
                if (props) {
                    if (Array.isArray(props.highlights)) currentHighlights = props.highlights;
                    if (Array.isArray(props.links)) currentLinks = props.links;
                }
            } catch (_) {}
        }
        
        const content = textarea.value;
        backdrop.innerHTML = buildHtmlWithRanges(content, currentLinks, currentHighlights);
    };

    const caretUpdateHandler = () => {
        // _caretSuppressed выставляется registerRegularTextEditorSync на время зума:
        // не перерисовываем каретку, пока она должна быть скрыта (избегаем мигания
        // каретки старого размера в промежуточных кадрах при Ctrl±).
        if (controller.textEditor && controller.textEditor._caretSuppressed) return;
        if (controller.textEditor && controller.textEditor.caret) {
            updateCustomCaret(textarea, controller.textEditor.caret);
        }
    };

    textarea.addEventListener('blur', blurHandler);
    textarea.addEventListener('keydown', keydownHandler);
    textarea.addEventListener('input', (e) => {
        inputHandler(e);
        syncBackdrop();
    });
    
    textarea.addEventListener('input', caretUpdateHandler);
    textarea.addEventListener('keydown', () => setTimeout(caretUpdateHandler, 0));
    textarea.addEventListener('keyup', caretUpdateHandler);
    textarea.addEventListener('click', caretUpdateHandler);
    textarea.addEventListener('focus', caretUpdateHandler);
    document.addEventListener('selectionchange', caretUpdateHandler);

    // Initial caret and backdrop update
    setTimeout(() => {
        caretUpdateHandler();
        syncBackdrop();
    }, 0);

    const removeDomListeners = () => {
        textarea.removeEventListener('blur', blurHandler);
        textarea.removeEventListener('keydown', keydownHandler);
        textarea.removeEventListener('input', inputHandler);
        
        textarea.removeEventListener('input', caretUpdateHandler);
        textarea.removeEventListener('keyup', caretUpdateHandler);
        textarea.removeEventListener('click', caretUpdateHandler);
        textarea.removeEventListener('focus', caretUpdateHandler);
        document.removeEventListener('selectionchange', caretUpdateHandler);
        
        document.removeEventListener('mousedown', mousedownCaptureHandler, true);
        if (_pendingClickBlocker) {
            document.removeEventListener('click', _pendingClickBlocker, true);
            _pendingClickBlocker = null;
        }
    };

    if (controller.textEditor) {
        controller.textEditor._removeDomListeners = removeDomListeners;
    }
}

export function closeTextEditorFromState(controller, commit) {
    const textarea = controller.textEditor.textarea;
    if (!textarea) return;
    const wrapper = controller.textEditor.wrapper || null;
    const removeDomListeners = controller.textEditor._removeDomListeners || null;
    const placeholderStyleEl = controller.textEditor._phStyle || null;
    const value = textarea.value.trim();
    const commitValue = commit && value.length > 0;
    const objectType = controller.textEditor.objectType || 'text';
    const objectId = controller.textEditor.objectId;
    const position = controller.textEditor.position;
    const properties = controller.textEditor.properties;
    const isNewCreation = controller.textEditor.isNewCreation;
    const initialContent = controller.textEditor.initialContent ?? '';
    // Записку и фигуру не удаляем при закрытии редактора пустыми (клик вне объекта):
    // элемент должен оставаться на доске даже без текста. Текст — прежнее поведение.
    const shouldDeleteEmptyNewCreation = !commitValue && !!isNewCreation && !!objectId
        && objectType !== 'note' && objectType !== 'shape';

    if (objectId) {
        if (typeof window !== 'undefined' && window.moodboardHtmlTextLayer) {
            const el = window.moodboardHtmlTextLayer.idToEl.get(objectId);
            if (el) {
                controller.eventBus.emit(Events.Tool.ShowObjectText, { objectId });
                alignStaticTextToEditorCssPosition({
                    controller,
                    objectId,
                    worldLayerRef: controller.textEditor.world || (controller.app?.stage),
                    view: controller.app?.view,
                    cssLeft: controller.textEditor._cssLeftPx,
                    cssTop: controller.textEditor._cssTopPx,
                });
            } else {
                console.warn(`❌ SelectTool: HTML-элемент для объекта ${objectId} не найден, пропускаем ShowObjectText`);
            }
        } else {
            controller.eventBus.emit(Events.Tool.ShowObjectText, { objectId });
        }
    }

    if (Array.isArray(controller.textEditor._listeners)) {
        try { unregisterEditorListeners(controller.eventBus, controller.textEditor._listeners); } catch (_) {}
    }
    if (typeof removeDomListeners === 'function') {
        try { removeDomListeners(); } catch (_) {}
    }
    if (placeholderStyleEl && typeof placeholderStyleEl.remove === 'function') {
        try { placeholderStyleEl.remove(); } catch (_) {}
    }
    if (wrapper && typeof wrapper.remove === 'function') {
        wrapper.remove();
    } else {
        textarea.remove();
    }
    controller.textEditor = { active: false, objectId: null, textarea: null, world: null, objectType: 'text' };

    // Синхронно с createTextEditorFinalize: UI (в т.ч. панель свойств текста) ждёт окончание редактирования.
    if (objectType === 'note') {
        controller.eventBus.emit(Events.UI.NoteEditEnd, { objectId: objectId || null });
        showNotePixiText(controller, objectId);
    } else {
        controller.eventBus.emit(Events.UI.TextEditEnd, { objectId: objectId || null });
    }
    updateGlobalTextEditorHandlesLayer();

    if (!commitValue) {
        if (shouldDeleteEmptyNewCreation) {
            controller.eventBus.emit(Events.Tool.ObjectsDelete, { objects: [objectId] });
        }
        return;
    }
        if (objectId == null) {
            controller.eventBus.emit(Events.UI.ToolbarAction, {
                type: objectType,
                id: objectType,
                position: { x: position.x, y: position.y },
                properties: { 
                    content: value, 
                    fontSize: properties.fontSize,
                    highlightColor: properties.highlightColor
                },
            });
        } else {
        if (isNewCreation) {
            const oldContent = typeof initialContent === 'string' ? initialContent : '';
            controller.eventBus.emit(Events.Object.ContentChange, {
                objectId,
                oldContent,
                newContent: value,
            });
        } else {
            controller.eventBus.emit(Events.Object.ContentChange, {
                objectId,
                oldContent: initialContent,
                newContent: value,
            });
        }
    }
}
