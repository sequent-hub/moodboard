import { Events } from '../core/events/Events.js';
import {
    bindTextPropertiesPanelControls,
    unbindTextPropertiesPanelControls,
} from './text-properties/TextPropertiesPanelBindings.js';
import { updateLinkButtonState } from './text-properties/TextLinkControl.js';
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
    hideHighlightDropdown,
    toggleBgColorDropdown,
    toggleColorDropdown,
    toggleHighlightDropdown,
    updateCurrentBgColorButton,
    updateCurrentColorButton,
    updateCurrentHighlightButton,
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
            zIndex: 10050,
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
        this._updateControlsFromObject();
        this._updateLockUI();
        this.reposition();
    }

    hide() {
        resetCurrentSelection(this);

        if (this.panel) {
            this.panel.style.display = 'none';
            this.panel.querySelectorAll('.tpp-more-dropdown.is-open').forEach((el) => el.classList.remove('is-open'));
            this.panel.querySelectorAll('.ipp-btn.is-active').forEach((el) => el.classList.remove('is-active'));
        }

        this._hideColorDropdown();
        this._hideHighlightDropdown();
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

    _toggleHighlightDropdown() {
        toggleHighlightDropdown(this);
    }

    _hideHighlightDropdown() {
        hideHighlightDropdown(this);
    }

    _selectHighlightColor(color) {
        this._changeHighlightColor(color);
        this._updateCurrentHighlightButton(color);
        this._hideHighlightDropdown();
    }

    _updateCurrentHighlightButton(color) {
        updateCurrentHighlightButton(this, color);
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

    _applyFormatToSelection(formatType, value) {
        const activeEditor = document.querySelector('.moodboard-text-input');
        if (!activeEditor || activeEditor.selectionStart === activeEditor.selectionEnd) {
            return false;
        }

        const start = activeEditor.selectionStart;
        const end = activeEditor.selectionEnd;
        const text = activeEditor.value;
        const selected = text.substring(start, end);
        const before = text.substring(0, start);
        const after = text.substring(end);
        
        let newSelected = selected;
        
        const toggleWrap = (str, prefix, suffix = prefix) => {
            if (str.startsWith(prefix) && str.endsWith(suffix)) {
                return str.substring(prefix.length, str.length - suffix.length);
            }
            return `${prefix}${str}${suffix}`;
        };
        
        switch (formatType) {
            case 'color': {
                const cleanSelected = selected.replace(/<span[^>]*>/g, '').replace(/<\/span>/g, '');
                newSelected = `<span style="color: ${value}">${cleanSelected}</span>`;
                break;
            }
            case 'bold':
                newSelected = toggleWrap(selected, '**');
                break;
            case 'italic':
                newSelected = toggleWrap(selected, '*');
                break;
            case 'underline':
                newSelected = toggleWrap(selected, '<u>', '</u>');
                break;
            case 'strikethrough':
                newSelected = toggleWrap(selected, '~~');
                break;
        }
        
        activeEditor.value = before + newSelected + after;
        
        // Restore selection
        activeEditor.selectionStart = start;
        activeEditor.selectionEnd = start + newSelected.length;
        
        // Force markdown mode so HTML/MD tags are rendered
        this.eventBus.emit(Events.Object.StateChanged, {
            objectId: this.currentId,
            updates: buildMarkdownUpdate(true),
        });
        
        // Update the object's content
        this.eventBus.emit(Events.Tool.UpdateObjectContent, {
            objectId: this.currentId,
            content: activeEditor.value
        });
        
        return true;
    }

    _changeTextColor(color) {
        if (!this.currentId) {
            return;
        }

        if (this._applyFormatToSelection('color', color)) {
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

    _changeHighlightColor(highlightColor) {
        if (!this.currentId) {
            return;
        }

        const props = getObjectProperties(this.eventBus, this.currentId);
        
        // Получаем актуальный контент (из живого редактора, если он есть)
        let contentLength = 0;
        const editor = document.querySelector('.moodboard-text-input');
        if (editor) {
            contentLength = editor.value.length;
        } else {
            contentLength = (props?.content ?? '').length;
        }

        const sel = this._savedTextSelection;
        // С выделением — диапазон выделения; без выделения — весь текст (как у ссылок),
        // box-фон всего поля не используется.
        const start = (sel && sel.end > sel.start) ? sel.start : 0;
        const end = (sel && sel.end > sel.start) ? sel.end : contentLength;

        this._addHighlight(highlightColor, start, end, this.currentId);
        this._savedTextSelection = null;
    }

    /**
     * Снимок выделения активного текстового редактора. Вызывается на mousedown по
     * UI подсветки ДО того, как фокус уйдёт из textarea (особенно перед нативным
     * color-input, который гарантированно сбрасывает выделение).
     */
    _snapshotTextSelection() {
        const editor = document.querySelector('.moodboard-text-input');
        if (editor && typeof editor.selectionStart === 'number' && typeof editor.selectionEnd === 'number') {
            this._savedTextSelection = { start: editor.selectionStart, end: editor.selectionEnd };
        } else {
            this._savedTextSelection = null;
        }
    }

    _toggleFormat(prop) {
        if (!this.currentId) {
            return;
        }

        if (this._applyFormatToSelection(prop, null)) {
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

    /**
     * Добавляет web-ссылку к диапазону текста (plain-режим).
     * При включённом MD-режиме ничего не делает (кнопка должна быть disabled).
     * @param {string} url — нормализованный URL
     * @param {number} start — индекс начала диапазона (включительно)
     * @param {number} end — индекс конца диапазона (не включительно)
     * @param {string} [objectId] — id объекта; если не задан, используется this.currentId.
     *   Нужен потому, что во время ввода URL фокус уходит в input и выделение объекта
     *   может сброситься (this.currentId → null).
     */
    _addLink(url, start, end, objectId) {
        const targetId = objectId || this.currentId;
        if (!targetId || !url) return;
        const props = getObjectProperties(this.eventBus, targetId);
        if (props?.markdown === true) return;

        const content = props?.content ?? '';
        const safeEnd = Math.min(end, content.length);
        const safeStart = Math.min(start, safeEnd);
        if (safeStart >= safeEnd) return;

        const oldLinks = Array.isArray(props?.links) ? props.links : [];
        // Удаляем ссылки, пересекающиеся с новым диапазоном
        const filtered = oldLinks.filter(l => l.end <= safeStart || l.start >= safeEnd);
        const newLinks = [...filtered, { start: safeStart, end: safeEnd, url }]
            .sort((a, b) => a.start - b.start);

        this.eventBus.emit(Events.Object.StateChanged, {
            objectId: targetId,
            updates: { properties: { links: newLinks } },
        });
        this._updateTextAppearance(targetId, { links: newLinks });
    }

    /**
     * Добавляет/убирает цветовой диапазон подсветки в properties.highlights.
     * Не вставляет теги в текст — textarea остаётся чистой.
     * @param {string} color — CSS-цвет или 'transparent' (удалить подсветку в диапазоне)
     * @param {number} start — начало диапазона (selectionStart)
     * @param {number} end — конец диапазона (selectionEnd)
     * @param {string} [objectId] — если не задан, используется this.currentId
     */
    _addHighlight(color, start, end, objectId) {
        const targetId = objectId || this.currentId;
        if (!targetId) return;
        const props = getObjectProperties(this.eventBus, targetId);

        let contentLength = 0;
        const editor = document.querySelector('.moodboard-text-input');
        if (editor) {
            contentLength = editor.value.length;
        } else {
            contentLength = (props?.content ?? '').length;
        }

        const safeEnd = Math.min(end, contentLength);
        const safeStart = Math.min(start, safeEnd);
        if (safeStart >= safeEnd) return;

        const oldHighlights = Array.isArray(props?.highlights) ? props.highlights : [];
        const filtered = oldHighlights.filter(h => h.end <= safeStart || h.start >= safeEnd);
        const newHighlights = color === 'transparent'
            ? filtered
            : [...filtered, { start: safeStart, end: safeEnd, color }]
                .sort((a, b) => a.start - b.start);

        // Если редактор открыт, синхронизируем его текущее значение в state вместе с
        // подсветкой. Иначе при коммите UpdateContentCommand._applyContent вычисляет
        // _adjustHighlights(oldText = stale initialContent, newText = editor.value) и
        // сдвигает/удаляет только что добавленные диапазоны.
        const propertiesUpdate = { highlights: newHighlights };
        if (editor) {
            propertiesUpdate.content = editor.value;
        }

        this.eventBus.emit(Events.Object.StateChanged, {
            objectId: targetId,
            updates: { properties: propertiesUpdate },
        });
        this._updateTextAppearance(targetId, { highlights: newHighlights });
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
        this._updateCurrentHighlightButton(values.highlightColor);
        this._updateCurrentBgColorButton(values.backgroundColor);
        if (this.markdownToggle) {
            this.markdownToggle.checked = values.markdown;
            updateLinkButtonState(this, values.markdown);
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

    _isLocked() {
        if (!this.currentId) return false;
        const objects = this.core?.state?.getObjects ? this.core.state.getObjects() : [];
        const obj = objects.find((o) => o.id === this.currentId);
        return !!(obj?.properties?.locked);
    }

    _toggleLocked() {
        if (!this.currentId) return;
        const newLocked = !this._isLocked();
        this.eventBus.emit(Events.Object.StateChanged, {
            objectId: this.currentId,
            updates: { properties: { locked: newLocked } },
        });
        this._updateLockUI();
        this.reposition();
    }

    _updateLockUI() {
        if (!this._tppBtnLock) return;
        const locked = this._isLocked();

        this._tppBtnLock.innerHTML = locked ? this._tppLockIcon : this._tppUnlockIcon;
        this._tppBtnLock.title = locked ? 'Разблокировать' : 'Заблокировать';

        if (Array.isArray(this._lockableEls)) {
            this._lockableEls.forEach((el) => {
                if (el) el.style.display = locked ? 'none' : '';
            });
        }

        if (this._moreLockLabel) {
            this._moreLockLabel.textContent = locked ? 'Разблокировать' : 'Заблокировать';
        }

        if (this.panel) {
            this.panel.classList.toggle('is-locked', locked);
        }
    }

    _duplicateText() {
        if (!this.currentId) return;

        const posData = { objectId: this.currentId, position: null };
        const sizeData = { objectId: this.currentId, size: null };
        this.eventBus.emit(Events.Tool.GetObjectPosition, posData);
        this.eventBus.emit(Events.Tool.GetObjectSize, sizeData);

        if (!posData.position || !sizeData.size) return;

        let w = sizeData.size.width;
        if (typeof w !== 'number' || isNaN(w)) {
            const pixiObj = this.core?.pixi?.objects?.get(this.currentId);
            w = pixiObj ? pixiObj.width : 160;
        }

        const originalId = this.currentId;
        const newPos = {
            x: posData.position.x + (w || 160) + 14,
            y: posData.position.y,
        };

        const onReady = (data) => {
            if (!data || data.originalId !== originalId) return;
            this.eventBus.off(Events.Tool.DuplicateReady, onReady);
            this._selectObject(data.newId);
        };
        this.eventBus.on(Events.Tool.DuplicateReady, onReady);

        this.eventBus.emit(Events.Tool.DuplicateRequest, { originalId, position: newPos });
    }

    _selectObject(objectId) {
        if (!objectId) return;
        const selectTool = this.core?.selectTool;
        if (!selectTool || typeof selectTool.setSelection !== 'function') return;
        selectTool.setSelection([objectId]);
        if (typeof selectTool.updateResizeHandles === 'function') {
            selectTool.updateResizeHandles();
        }
    }
}
