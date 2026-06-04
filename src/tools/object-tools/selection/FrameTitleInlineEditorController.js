import * as PIXI from 'pixi.js';
import { Events } from '../../../core/events/Events.js';
import {
    createFrameTitleEditorWrapper,
    createFrameTitleEditorInput,
} from './InlineEditorDomFactory.js';
import { toScreenWithContainerOffset } from './InlineEditorPositioningService.js';

export function openFrameTitleEditor(object, _create = false) {
    let objectId, properties;

    const objData = object.object || object;
    objectId = objData.id || object.id || null;
    properties = objData.properties || object.properties || {};

    const currentTitle = properties.title || 'Фрейм';

    if (this.textEditor.active) {
        if (this.textEditor.objectType === 'frame') {
            this._closeFrameTitleEditor(true);
        } else if (this.textEditor.objectType === 'file') {
            this._closeFileNameEditor(true);
        } else {
            this._closeTextEditor(true);
        }
    }

    if (!objectId) return;

    const pixiReq = { objectId, pixiObject: null };
    this.eventBus.emit(Events.Tool.GetObjectPixi, pixiReq);

    let frameInstance = null;
    if (pixiReq.pixiObject && pixiReq.pixiObject._mb && pixiReq.pixiObject._mb.instance) {
        frameInstance = pixiReq.pixiObject._mb.instance;
    }

    if (!frameInstance || typeof frameInstance.hideTitle !== 'function') return;

    frameInstance.hideTitle();

    const view = this.app?.view || document.querySelector('canvas');
    if (!view || !view.parentElement) {
        frameInstance.showTitle();
        return;
    }

    const titleLayer = frameInstance.titleLayer;
    const screenPos = titleLayer
        ? toScreenWithContainerOffset(titleLayer, view, 0, 0)
        : { x: 0, y: 0 };

    // Ширина редактора = ширина titleBg в экранных пикселях (с учётом зум-компенсации)
    let inputWidth = 150;
    if (titleLayer && frameInstance.titleBg) {
        const bgRight = toScreenWithContainerOffset(titleLayer, view, frameInstance.titleBg.width || 150, 0);
        inputWidth = Math.max(100, Math.round(bgRight.x - screenPos.x));
    }

    const wrapper = createFrameTitleEditorWrapper();
    const input = createFrameTitleEditorInput(currentTitle);
    wrapper.style.width = `${inputWidth}px`;

    wrapper.appendChild(input);
    view.parentElement.appendChild(wrapper);

    wrapper.style.left = `${Math.round(screenPos.x)}px`;
    wrapper.style.top = `${Math.round(screenPos.y)}px`;

    this.textEditor = {
        active: true,
        objectId,
        textarea: input,
        wrapper,
        position: null,
        properties,
        objectType: 'frame',
        isResizing: false,
        closing: false,
        _frameInstance: frameInstance,
    };

    input.focus();
    input.select();

    const finalize = (commit) => this._closeFrameTitleEditor(commit);

    input.addEventListener('blur', () => finalize(true));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            finalize(true);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            finalize(false);
        }
    });
}

export function closeFrameTitleEditor(commit) {
    if (!this.textEditor || !this.textEditor.textarea || this.textEditor.closing) return;

    this.textEditor.closing = true;

    const input = this.textEditor.textarea;
    const value = input.value.trim();
    const commitValue = commit && value.length > 0;
    const objectId = this.textEditor.objectId;
    const oldTitle = (this.textEditor.properties?.title) || 'Фрейм';
    const frameInstance = this.textEditor._frameInstance;

    if (this.textEditor.wrapper && this.textEditor.wrapper.parentNode) {
        this.textEditor.wrapper.remove();
    }

    if (frameInstance && typeof frameInstance.showTitle === 'function') {
        frameInstance.showTitle();
    }

    if (commitValue && objectId && value !== oldTitle) {
        this.eventBus.emit(Events.Object.StateChanged, {
            objectId,
            updates: { properties: { title: value } },
        });
    }

    this.textEditor = {
        active: false,
        objectId: null,
        textarea: null,
        wrapper: null,
        world: null,
        position: null,
        properties: null,
        objectType: 'text',
        isResizing: false,
        closing: false,
    };
}
