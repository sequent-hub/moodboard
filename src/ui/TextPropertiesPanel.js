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
    buildMarkdownUpdate,
    buildTextColorUpdate,
    getControlValuesFromProperties,
    getFallbackControlValues,
    getObjectGeometry,
    getObjectProperties,
    getSelectedTextObjectId,
    LINE_HEIGHT_DEFAULT,
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
        }
        if (!this._docMouseDownAttached) {
            document.addEventListener('mousedown', this._onDocMouseDown, true);
            this._docMouseDownAttached = true;
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
        if (this._docMouseDownAttached) {
            document.removeEventListener('mousedown', this._onDocMouseDown, true);
            this._docMouseDownAttached = false;
        }
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

    _toggleFormat(prop) {
        if (!this.currentId) {
            return;
        }

        const properties = getObjectProperties(this.eventBus, this.currentId);
        const newValue = !(properties ? Boolean(properties[prop]) : false);

        this.eventBus.emit(Events.Object.StateChanged, {
            objectId: this.currentId,
            updates: { properties: { [prop]: newValue } },
        });
        this._updateTextAppearance(this.currentId, { [prop]: newValue });

        const btnMap = {
            bold: this.boldBtn,
            italic: this.italicBtn,
            underline: this.underlineBtn,
            strikethrough: this.strikethroughBtn,
        };
        if (btnMap[prop]) {
            btnMap[prop].classList.toggle('is-active', newValue);
        }
    }

    _changeTextAlign(v) {
        if (!this.currentId) {
            return;
        }

        this.eventBus.emit(Events.Object.StateChanged, {
            objectId: this.currentId,
            updates: { properties: { textAlign: v } },
        });
        this._updateTextAppearance(this.currentId, { textAlign: v });
    }

    _changeListType(v) {
        if (!this.currentId) {
            return;
        }

        this.eventBus.emit(Events.Object.StateChanged, {
            objectId: this.currentId,
            updates: { properties: { listType: v } },
        });
        this._updateTextAppearance(this.currentId, { listType: v });
    }

    _changeLineHeight(n) {
        if (!this.currentId) {
            return;
        }

        this.eventBus.emit(Events.Object.StateChanged, {
            objectId: this.currentId,
            updates: { properties: { lineHeight: n } },
        });
        this._updateTextAppearance(this.currentId, { lineHeight: n });
    }

    _changeMarkdown(markdown) {
        if (!this.currentId) {
            return;
        }

        this.eventBus.emit(Events.Object.StateChanged, {
            objectId: this.currentId,
            updates: buildMarkdownUpdate(markdown),
        });

        this._updateTextAppearance(this.currentId, { markdown });
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
        if (this.markdownToggle) {
            this.markdownToggle.checked = values.markdown;
        }

        if (this.boldBtn) this.boldBtn.classList.toggle('is-active', values.bold);
        if (this.italicBtn) this.italicBtn.classList.toggle('is-active', values.italic);
        if (this.underlineBtn) this.underlineBtn.classList.toggle('is-active', values.underline);
        if (this.strikethroughBtn) this.strikethroughBtn.classList.toggle('is-active', values.strikethrough);
        if (this.alignControl) this.alignControl.value = values.textAlign;
        if (this.listControl) this.listControl.value = values.listType;
        if (this.lineHeightSlider) {
            this.lineHeightSlider.value = String(values.lineHeight !== null ? values.lineHeight : LINE_HEIGHT_DEFAULT);
        }
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
        const toolbarEl = document.querySelector('.moodboard-toolbar');
        const toolbarRight = toolbarEl
            ? toolbarEl.getBoundingClientRect().right - containerRect.left + 10
            : 10;
        const finalX = Math.max(toolbarRight, Math.min(panelX, containerRect.width - this.panel.offsetWidth - 10));
        const finalY = Math.max(10, panelY);

        this.panel.style.left = `${Math.round(finalX)}px`;
        this.panel.style.top = `${Math.round(finalY)}px`;
    }

    _onDocMouseDown(event) {
        if (!this.panel || !event.target) {
            return;
        }

        if (this.panel.contains(event.target)) {
            return;
        }

        if (typeof event.target.closest === 'function' && event.target.closest('.moodboard-text-editor')) {
            return;
        }

        // Клики внутри canvas-контейнера управляются через EventBus (SelectionClear).
        // Без этой проверки тот же mousedown, который вызвал SelectionAdd → showFor,
        // немедленно дотекает до capture-listener и закрывает только что открытую панель.
        if (this.container.contains(event.target)) {
            return;
        }

        this.container.getBoundingClientRect();
        this.hide();
    }
}
