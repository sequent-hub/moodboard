import { BaseCommand } from './BaseCommand.js';

/**
 * Команда создания коннектора.
 * execute() добавляет connector-объект через ядро (аналог создания других объектов).
 */
export class CreateConnectorCommand extends BaseCommand {
    /**
     * @param {Object} core  Экземпляр CoreMoodBoard
     * @param {Object} connectorData  Полные данные объекта типа 'connector' (включая id)
     */
    constructor(core, connectorData) {
        super('create_connector', 'Создать коннектор');
        this.core = core;
        this.connectorData = connectorData;
    }

    execute() {
        this.core.createObjectFromData(this.connectorData);
    }

    undo() {
        // Локальный undo отключен: история состояния загружается с сервера по версиям.
    }
}
