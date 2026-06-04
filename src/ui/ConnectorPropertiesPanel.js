import { Events } from '../core/events/Events.js';
import {
    createConnectorPropertiesPanelState,
    clearConnectorPropertiesPanelState,
} from './connector-properties/ConnectorPropertiesPanelState.js';
import { createConnectorPropertiesPanelDom, updateConnectorPanelControls, updateLabelRow } from './connector-properties/ConnectorPropertiesPanelRenderer.js';
import { bindConnectorPropertiesPanelControls, unbindConnectorPropertiesPanelControls } from './connector-properties/ConnectorPropertiesPanelBindings.js';
import { attachConnectorPropertiesPanelEventBridge, detachConnectorPropertiesPanelEventBridge } from './connector-properties/ConnectorPropertiesPanelEventBridge.js';
import {
    getSelectedConnectorId,
    getConnectorData,
    getConnectorMidpointScreen,
    getConnectorStyle,
    buildStyleUpdate,
} from './connector-properties/ConnectorPropertiesPanelMapper.js';

/**
 * Панель свойств коннектора.
 * Всплывает над серединой выделенной линии.
 */
export class ConnectorPropertiesPanel {
    constructor(eventBus, container, core) {
        Object.assign(this, createConnectorPropertiesPanelState());
        this.eventBus  = eventBus;
        this.container = container;
        this.core      = core;

        createConnectorPropertiesPanelDom(this);
        container.appendChild(this.panel);

        bindConnectorPropertiesPanelControls(this);
        attachConnectorPropertiesPanelEventBridge(this);
    }

    // ── Публичное API ────────────────────────────────────────────────────────

    updateFromSelection() {
        const id = getSelectedConnectorId(this.core);
        if (!id) { this.hide(); return; }

        if (this.currentId === id && this.panel.style.display !== 'none') {
            this.reposition();
            return;
        }

        this.currentId = id;
        this.panel.style.display = 'flex';
        this._updateControlsFromObject();
        this.reposition();
    }

    hide() {
        this.currentId = null;
        this.panel.style.display = 'none';
        this._closeDropdowns();
    }

    reposition() {
        if (!this.panel || !this.currentId || this.panel.style.display === 'none') return;

        // Проверяем, что коннектор всё ещё выделен
        const stillSelected = getSelectedConnectorId(this.core) === this.currentId;
        if (!stillSelected) { this.hide(); return; }

        const mid = getConnectorMidpointScreen(this.core, this.currentId);
        if (!mid) return;

        const panelW = this.panel.offsetWidth || 480;
        const panelH = this.panel.offsetHeight || 40;
        const GAP    = 18;

        let px = mid.x - Math.round(panelW / 2);
        let py = mid.y - panelH - GAP;

        // Если уходит вверх за контейнер — переносим ниже середины
        if (py < 0) py = mid.y + GAP;

        // Clamp по ширине контейнера
        const cw = this.container.offsetWidth || window.innerWidth;
        px = Math.max(8, Math.min(px, cw - panelW - 8));
        py = Math.max(8, py);

        this.panel.style.left = `${Math.round(px)}px`;
        this.panel.style.top  = `${Math.round(py)}px`;
    }

    destroy() {
        detachConnectorPropertiesPanelEventBridge(this);
        unbindConnectorPropertiesPanelControls(this);

        if (this.panel?.parentNode) {
            this.panel.parentNode.removeChild(this.panel);
        }
        clearConnectorPropertiesPanelState(this);
        this.panel = null;
        this.eventBus = null;
        this.container = null;
        this.core = null;
    }

    // ── Внутренние методы ────────────────────────────────────────────────────

    _getConnector() {
        return getConnectorData(this.core, this.currentId);
    }

    _updateControlsFromObject() {
        if (!this.currentId) return;
        const connector = this._getConnector();
        if (!connector) return;
        const style = getConnectorStyle(connector);
        updateConnectorPanelControls(this, style);
        updateLabelRow(this, connector);

        // Синхронизируем кнопку замка
        if (this._lockBtn) {
            const locked = connector.properties?.locked ?? false;
            this._lockBtn.textContent = locked ? '🔒' : '🔓';
        }
    }

    /**
     * Эмитит StateChanged с частичным style-обновлением.
     * Вызывается из Bindings.
     */
    _emitStyle(partialStyle) {
        if (!this.currentId) return;
        this.eventBus.emit(Events.Object.StateChanged, {
            objectId: this.currentId,
            updates: buildStyleUpdate(partialStyle),
        });
    }

    /**
     * Эмитит StateChanged с полным объектом label (или null).
     * Вызывается из Bindings при изменении цвета/размера метки.
     */
    _emitLabel(label) {
        if (!this.currentId) return;
        this.eventBus.emit(Events.Object.StateChanged, {
            objectId: this.currentId,
            updates:  { properties: { style: { label } } },
        });
    }

    _closeDropdowns() {
        if (this.strokeColorDropdown) this.strokeColorDropdown.style.display = 'none';
        if (this._labelColorDropdown) this._labelColorDropdown.style.display = 'none';
    }
}
