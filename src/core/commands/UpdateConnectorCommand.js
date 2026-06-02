import { BaseCommand } from './BaseCommand.js';

/**
 * Команда обновления терминалов и/или стиля коннектора.
 * execute() применяет изменения к существующему connector-объекту в state.
 */
export class UpdateConnectorCommand extends BaseCommand {
    /**
     * @param {Object} core         Экземпляр CoreMoodBoard
     * @param {string} connectorId  id коннектора в state.objects
     * @param {Object} updates      { start?, end?, style? }
     */
    constructor(core, connectorId, updates) {
        super('update_connector', 'Обновить коннектор');
        this.core        = core;
        this.connectorId = connectorId;
        this.updates     = updates;
    }

    execute() {
        const objects = this.core?.state?.state?.objects;
        if (!Array.isArray(objects)) return;

        const obj = objects.find(o => o.id === this.connectorId);
        if (!obj) return;

        if (!obj.properties) obj.properties = {};
        if (this.updates.start !== undefined) obj.properties.start = this.updates.start;
        if (this.updates.end   !== undefined) obj.properties.end   = this.updates.end;
        if (this.updates.style !== undefined) {
            obj.properties.style = { ...(obj.properties.style || {}), ...this.updates.style };
        }
    }

    undo() {
        // Локальный undo отключен: история состояния загружается с сервера по версиям.
    }
}
