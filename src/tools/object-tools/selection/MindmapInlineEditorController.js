import * as PIXI from 'pixi.js';
import { Events } from '../../../core/events/Events.js';
import {
    createTextEditorTextarea,
    createTextEditorWrapper,
} from './TextEditorDomFactory.js';
import {
    hideGlobalTextEditorHandlesLayer,
    hideStaticTextDuringEditing,
    showStaticTextAfterEditing,
    updateGlobalTextEditorHandlesLayer,
} from './TextEditorLifecycleRegistry.js';

/**
 * Изолированный входной контроллер редактирования mindmap.
 * Не зависит от TextInlineEditorController.
 */
export function openMindmapEditor(object, create = false) {
    let objectId;
    let position;
    let properties;

    if (create) {
        const objData = object.object || object;
        objectId = objData.id || null;
        position = objData.position || null;
        properties = objData.properties || {};
    } else {
        objectId = object.id || null;
        position = object.position || null;
        properties = object.properties || {};
    }

    if (this.textEditor.active) {
        if (this.textEditor.objectType === 'file') {
            this._closeFileNameEditor(true);
        } else if (this.textEditor.objectType === 'mindmap') {
            this._closeMindmapEditor(true);
        } else {
            this._closeTextEditor(true);
        }
    }

    if (!position && objectId) {
        const posData = { objectId, position: null };
        this.eventBus.emit(Events.Tool.GetObjectPosition, posData);
        position = posData.position;
    }
    if (!position) return;

    const view = this.app?.view;
    const world = this.app?.stage?.getChildByName?.('worldLayer');
    if (!view || !world || !view.parentElement) return;

    this.eventBus.emit(Events.UI.TextEditStart, { objectId: objectId || null });
    hideGlobalTextEditorHandlesLayer();

    let objectWidth = properties.width || 220;
    let objectHeight = properties.height || 140;
    if (objectId) {
        const sizeData = { objectId, size: null };
        this.eventBus.emit(Events.Tool.GetObjectSize, sizeData);
        if (sizeData.size) {
            objectWidth = sizeData.size.width;
            objectHeight = sizeData.size.height;
        }
    }

    const wrapper = createTextEditorWrapper();
    const textarea = createTextEditorTextarea(properties.content || '');
    textarea.placeholder = 'Введите текст';
    textarea.style.fontFamily = properties.fontFamily || 'Roboto, Arial, sans-serif';
    textarea.style.textAlign = 'center';
    textarea.style.resize = 'none';
    textarea.style.overflow = 'hidden';
    textarea.style.whiteSpace = 'pre-wrap';
    textarea.style.wordBreak = 'break-word';

    const containerRect = view.parentElement.getBoundingClientRect();
    const viewRect = view.getBoundingClientRect();
    const offsetLeft = viewRect.left - containerRect.left;
    const offsetTop = viewRect.top - containerRect.top;

    const tl = world.toGlobal(new PIXI.Point(position.x, position.y));
    const br = world.toGlobal(new PIXI.Point(position.x + objectWidth, position.y + objectHeight));
    const left = offsetLeft + tl.x;
    const top = offsetTop + tl.y;
    const width = Math.max(1, br.x - tl.x);
    const height = Math.max(1, br.y - tl.y);

    const insetX = Math.max(8, Math.round(width * 0.08));
    const insetY = Math.max(6, Math.round(height * 0.12));
    wrapper.style.left = `${Math.round(left + insetX)}px`;
    wrapper.style.top = `${Math.round(top + insetY)}px`;
    wrapper.style.width = `${Math.max(1, Math.round(width - insetX * 2))}px`;
    wrapper.style.height = `${Math.max(1, Math.round(height - insetY * 2))}px`;
    wrapper.style.borderRadius = '999px';
    wrapper.style.padding = '0';

    textarea.style.width = '100%';
    textarea.style.height = '100%';
    textarea.style.minHeight = '0';

    wrapper.appendChild(textarea);
    view.parentElement.appendChild(wrapper);

    hideStaticTextDuringEditing(this, objectId);

    const initialContent = String(properties.content || '');
    let finalized = false;
    const finalize = (commit) => {
        if (finalized) return;
        finalized = true;

        textarea.removeEventListener('blur', onBlur);
        textarea.removeEventListener('keydown', onKeyDown);

        const value = textarea.value.trim();
        const commitValue = commit && value.length > 0;

        if (objectId) {
            showStaticTextAfterEditing(this, objectId);
        }

        wrapper.remove();
        this.textEditor = {
            active: false,
            objectId: null,
            textarea: null,
            wrapper: null,
            world: null,
            position: null,
            properties: null,
            objectType: 'text',
        };

        this.eventBus.emit(Events.UI.TextEditEnd, { objectId: objectId || null });
        updateGlobalTextEditorHandlesLayer();

        if (!commitValue) {
            if (create && objectId) {
                this.eventBus.emit(Events.Tool.ObjectsDelete, { objects: [objectId] });
            }
            return;
        }

        if (objectId) {
            this.eventBus.emit(Events.Object.ContentChange, {
                objectId,
                oldContent: initialContent,
                newContent: value,
            });
        } else {
            this.eventBus.emit(Events.UI.ToolbarAction, {
                type: 'mindmap',
                id: 'mindmap',
                position: { x: position.x, y: position.y },
                properties: { ...properties, content: value },
            });
        }
    };

    const onBlur = () => finalize(true);
    const onKeyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            finalize(true);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            finalize(false);
        }
    };

    textarea.addEventListener('blur', onBlur);
    textarea.addEventListener('keydown', onKeyDown);

    this.textEditor = {
        active: true,
        objectId,
        textarea,
        wrapper,
        world,
        position,
        properties: { ...properties },
        objectType: 'mindmap',
        isResizing: false,
        _finalize: finalize,
    };

    textarea.focus();
}

export function closeMindmapEditor(commit) {
    if (!this.textEditor?.active || this.textEditor.objectType !== 'mindmap') return;
    const finalize = this.textEditor._finalize;
    if (typeof finalize === 'function') {
        finalize(commit);
    }
}
