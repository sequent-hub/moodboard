import { Events } from '../../core/events/Events.js';

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
        const contentEl = targetEl || el;
        const onTextClick = (event) => {
            event.preventDefault();
            event.stopPropagation();
            const actualContent = (typeof el?.dataset?.mbContent === 'string')
                ? el.dataset.mbContent
                : (objectData?.properties?.content || objectData?.content || '');
            const posData = { objectId, position: null };
            eventBus.emit(Events.Tool.GetObjectPosition, posData);
            eventBus.emit(Events.Tool.ObjectEdit, {
                id: objectId,
                type: 'mindmap',
                position: posData.position || objectData?.position || { x: 0, y: 0 },
                properties: { content: actualContent },
                caretClick: {
                    clientX: event.clientX,
                    clientY: event.clientY,
                },
                create: false,
            });
        };

        clickableEl.addEventListener('click', onTextClick);
        return () => {
            clickableEl.removeEventListener('click', onTextClick);
        };
    }
}
