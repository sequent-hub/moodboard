import { Events } from '../../core/events/Events.js';

const MINDMAP_DRAG_THRESHOLD_PX = 4;

/**
 * Изолирует mindmap-специфику HTML-слоя текста:
 * - внешний вид overlay-элемента
 * - вход в режим редактирования по клику на текст
 */
export class MindmapTextOverlayAdapter {
    supportsObject(objectData) {
        return objectData?.type === 'mindmap';
    }

    getDefaultFontFamily(objectData) {
        return objectData?.properties?.fontFamily || objectData?.fontFamily || 'Roboto, Arial, sans-serif';
    }

    applyElementStyles(el) {
        el.classList.add('mb-text--mindmap');
        el.style.pointerEvents = 'none';
        el.style.cursor = 'default';
    }

    attachEditOnClick({ el, targetEl, objectId, objectData, eventBus }) {
        const clickableEl = targetEl || el;
        let pendingPointer = null;
        let dragStarted = false;
        let suppressNextClick = false;

        const getCanvasEl = () => {
            const doc = clickableEl?.ownerDocument || document;
            return doc.querySelector('.moodboard-workspace__canvas canvas');
        };

        const dispatchMouseToCanvas = (type, sourceEvent, coords = null) => {
            const canvas = getCanvasEl();
            if (!canvas || !sourceEvent) return;
            const point = coords || { clientX: sourceEvent.clientX, clientY: sourceEvent.clientY };
            const evt = new MouseEvent(type, {
                bubbles: true,
                cancelable: true,
                clientX: point.clientX,
                clientY: point.clientY,
                button: sourceEvent.button || 0,
                buttons: sourceEvent.buttons || 0,
                ctrlKey: !!sourceEvent.ctrlKey,
                metaKey: !!sourceEvent.metaKey,
                shiftKey: !!sourceEvent.shiftKey,
                altKey: !!sourceEvent.altKey,
            });
            canvas.dispatchEvent(evt);
        };

        const onWindowMouseMove = (moveEvent) => {
            if (!pendingPointer) return;
            const dx = moveEvent.clientX - pendingPointer.clientX;
            const dy = moveEvent.clientY - pendingPointer.clientY;
            const movedEnough = Math.hypot(dx, dy) >= MINDMAP_DRAG_THRESHOLD_PX;
            if (!dragStarted && movedEnough) {
                dragStarted = true;
                suppressNextClick = true;
                dispatchMouseToCanvas('mousedown', pendingPointer, pendingPointer);
            }
            if (dragStarted) {
                dispatchMouseToCanvas('mousemove', moveEvent);
            }
        };

        const onWindowMouseUp = (upEvent) => {
            if (!pendingPointer) return;
            if (dragStarted) {
                dispatchMouseToCanvas('mouseup', upEvent);
            }
            pendingPointer = null;
            dragStarted = false;
            window.removeEventListener('mousemove', onWindowMouseMove, true);
            window.removeEventListener('mouseup', onWindowMouseUp, true);
        };

        const onTextMouseDown = (event) => {
            if (event.button !== 0) return;
            pendingPointer = {
                clientX: event.clientX,
                clientY: event.clientY,
                button: event.button,
                buttons: event.buttons || 1,
                ctrlKey: !!event.ctrlKey,
                metaKey: !!event.metaKey,
                shiftKey: !!event.shiftKey,
                altKey: !!event.altKey,
            };
            dragStarted = false;
            window.addEventListener('mousemove', onWindowMouseMove, true);
            window.addEventListener('mouseup', onWindowMouseUp, true);
        };

        const onTextClick = (event) => {
            if (suppressNextClick) {
                suppressNextClick = false;
                event.preventDefault();
                event.stopPropagation();
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            const actualContent = (typeof el?.dataset?.mbContent === 'string')
                ? el.dataset.mbContent
                : (objectData?.properties?.content || objectData?.content || '');
            const posData = { objectId, position: null };
            eventBus.emit(Events.Tool.GetObjectPosition, posData);
            const mergedProperties = {
                ...(objectData?.properties || {}),
                content: actualContent,
            };
            if (Number.isFinite(objectData?.width) && !Number.isFinite(mergedProperties.width)) {
                mergedProperties.width = objectData.width;
            }
            if (Number.isFinite(objectData?.height) && !Number.isFinite(mergedProperties.height)) {
                mergedProperties.height = objectData.height;
            }
            eventBus.emit(Events.Tool.ObjectEdit, {
                id: objectId,
                type: 'mindmap',
                position: posData.position || objectData?.position || { x: 0, y: 0 },
                properties: mergedProperties,
                caretClick: {
                    clientX: event.clientX,
                    clientY: event.clientY,
                },
                create: false,
            });
        };

        clickableEl.addEventListener('mousedown', onTextMouseDown);
        clickableEl.addEventListener('click', onTextClick);
        return () => {
            window.removeEventListener('mousemove', onWindowMouseMove, true);
            window.removeEventListener('mouseup', onWindowMouseUp, true);
            clickableEl.removeEventListener('mousedown', onTextMouseDown);
            clickableEl.removeEventListener('click', onTextClick);
        };
    }
}
