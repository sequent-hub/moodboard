import { Events } from '../core/events/Events.js';
import {
    bindTextPropertiesPanelControls,
    unbindTextPropertiesPanelControls,
} from './text-properties/TextPropertiesPanelBindings.js';
import {
    attachTextPropertiesPanelEventBridge,
    detachTextPropertiesPanelEventBridge,
} from './text-properties/TextPropertiesPanelEventBridge.js';
import {
    applyTextAppearanceToDom,
    buildBackgroundColorUpdate,
    buildFontFamilyUpdate,
    buildFontSizeUpdate,
    buildTextColorUpdate,
    getControlValuesFromProperties,
    getFallbackControlValues,
    getObjectGeometry,
    getObjectProperties,
    getSelectedTextObjectId,
    syncPixiTextProperties,
} from './text-properties/TextPropertiesPanelMapper.js';
import {
    createTextPropertiesPanelRenderer,
    hideBgColorDropdown,
    hideColorDropdown,
    toggleBgColorDropdown,
    toggleColorDropdown,
    updateCurrentBgColorButton,
    updateCurrentColorButton,
} from './text-properties/TextPropertiesPanelRenderer.js';
import {
    clearTextPropertiesPanelState,
    createTextPropertiesPanelState,
    resetCurrentSelection,
} from './text-properties/TextPropertiesPanelState.js';

/**
 * TextPropertiesPanel — всплывающая панель свойств для текстовых объектов
 */
export class TextPropertiesPanel {
    constructor(container, eventBus, core) {
        this.container = container;
        this.eventBus = eventBus;
        this.core = core;
        Object.assign(this, createTextPropertiesPanelState());

        this._onDocMouseDown = this._onDocMouseDown.bind(this);
    }

    attach() {
        this.layer = document.createElement('div');
        this.layer.className = 'text-properties-layer';
        Object.assign(this.layer.style, {
            position: 'absolute',
            inset: '0',
            pointerEvents: 'none',
            zIndex: 20,
        });
        this.container.appendChild(this.layer);

        attachTextPropertiesPanelEventBridge(this);
    }

    destroy() {
        this.hide();
        unbindTextPropertiesPanelControls(this);
        detachTextPropertiesPanelEventBridge(this);

        if (this.layer) {
            this.layer.remove();
        }

        clearTextPropertiesPanelState(this);
    }

    updateFromSelection() {
        if (this.isTextEditing) {
            this.hide();
            return;
        }

        const id = getSelectedTextObjectId(this.core);
        if (!id) {
            this.hide();
            return;
        }

        this.currentId = id;
        this.showFor(id);
    }

    showFor(id) {
        if (!this.layer) {
            return;
        }

        if (!this.panel) {
            this.panel = createTextPropertiesPanelRenderer(this);
            this.layer.appendChild(this.panel);
            bindTextPropertiesPanelControls(this);
            document.addEventListener('mousedown', this._onDocMouseDown, true);
        }

        this.panel.style.display = 'flex';
        this.reposition();
        this._updateControlsFromObject();
    }

    hide() {
        resetCurrentSelection(this);

        if (this.panel) {
            this.panel.style.display = 'none';
        }

        this._hideColorDropdown();
        this._hideBgColorDropdown();
        document.removeEventListener('mousedown', this._onDocMouseDown, true);
    }

    _toggleColorDropdown() {
        toggleColorDropdown(this);
    }

    _hideColorDropdown() {
        hideColorDropdown(this);
    }

    _selectColor(color) {
        this._changeTextColor(color);
        this._updateCurrentColorButton(color);
        this._hideColorDropdown();
    }

    _updateCurrentColorButton(color) {
        updateCurrentColorButton(this, color);
    }

    _toggleBgColorDropdown() {
        toggleBgColorDropdown(this);
    }

    _hideBgColorDropdown() {
        hideBgColorDropdown(this);
    }

    _selectBgColor(color) {
        this._changeBackgroundColor(color);
        this._updateCurrentBgColorButton(color);
        this._hideBgColorDropdown();
    }

    _updateCurrentBgColorButton(color) {
        updateCurrentBgColorButton(this, color);
    }

    _changeFontFamily(fontFamily) {
        if (!this.currentId) {
            return;
        }

        this.eventBus.emit(Events.Object.StateChanged, {
            objectId: this.currentId,
            updates: buildFontFamilyUpdate(fontFamily),
        });

        this._updateTextAppearance(this.currentId, { fontFamily });
    }

    _changeFontSize(fontSize) {
        if (!this.currentId) {
            return;
        }

        this.eventBus.emit(Events.Object.StateChanged, {
            objectId: this.currentId,
            updates: buildFontSizeUpdate(fontSize),
        });

        this._updateTextAppearance(this.currentId, { fontSize });
    }

    _changeTextColor(color) {
        if (!this.currentId) {
            return;
        }

        this.eventBus.emit(Events.Object.StateChanged, {
            objectId: this.currentId,
            updates: buildTextColorUpdate(color),
        });

        this._updateTextAppearance(this.currentId, { color });
    }

    _changeBackgroundColor(backgroundColor) {
        if (!this.currentId) {
            return;
        }

        this.eventBus.emit(Events.Object.StateChanged, {
            objectId: this.currentId,
            updates: buildBackgroundColorUpdate(backgroundColor),
        });

        this._updateTextAppearance(this.currentId, { backgroundColor });
    }

    _updateTextAppearance(objectId, properties) {
        applyTextAppearanceToDom(objectId, properties);
        syncPixiTextProperties(this.eventBus, objectId, properties);

        if (this.core && this.core.state) {
            this.core.state.markDirty();
        }
    }

    _updateControlsFromObject() {
        if (!this.currentId || !this.fontSelect || !this.fontSizeSelect) {
            return;
        }

        const properties = getObjectProperties(this.eventBus, this.currentId);
        const values = properties
            ? getControlValuesFromProperties(properties)
            : getFallbackControlValues();

        this.fontSelect.value = values.fontFamily;
        this.fontSizeSelect.value = values.fontSize;
        this._updateCurrentColorButton(values.color);
        this._updateCurrentBgColorButton(values.backgroundColor);
    }

    reposition() {
        if (!this.panel || !this.currentId || this.panel.style.display === 'none') {
            return;
        }

        const geometry = getObjectGeometry(this.eventBus, this.currentId);
        if (!geometry.position || !geometry.size) {
            return;
        }

        const worldLayer = this.core?.pixi?.worldLayer;
        const scale = worldLayer?.scale?.x || 1;
        const worldX = worldLayer?.x || 0;
        const worldY = worldLayer?.y || 0;

        const screenX = geometry.position.x * scale + worldX;
        const screenY = geometry.position.y * scale + worldY;
        const objectWidth = geometry.size.width * scale;

        const panelX = screenX + (objectWidth / 2) - (this.panel.offsetWidth / 2);
        const panelY = screenY - this.panel.offsetHeight - 20;

        const containerRect = this.container.getBoundingClientRect();
        const finalX = Math.max(10, Math.min(panelX, containerRect.width - this.panel.offsetWidth - 10));
        const finalY = Math.max(10, panelY);

        this.panel.style.left = `${finalX}px`;
        this.panel.style.top = `${finalY}px`;
    }

    _onDocMouseDown(event) {
        if (!this.panel || !event.target) {
            return;
        }

        if (this.panel.contains(event.target)) {
            return;
        }

        this.container.getBoundingClientRect();
        this.hide();
    }
}
