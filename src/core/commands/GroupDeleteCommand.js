import { BaseCommand } from './BaseCommand.js';
import { Events } from '../events/Events.js';

/**
 * Команда группового удаления объектов.
 * Один Undo восстанавливает всю группу.
 */
export class GroupDeleteCommand extends BaseCommand {
    constructor(coreMoodboard, objectIds) {
        super('group_delete', `Удалить группу (${objectIds.length} объектов)`);
        this.coreMoodboard = coreMoodboard;
        const baseIds = new Set(Array.isArray(objectIds) ? objectIds : []);
        // Вариант B: атомарно удаляем коннекторы, привязанные к удаляемым объектам
        const allObjects = coreMoodboard.state.getObjects();
        for (const obj of allObjects) {
            if (obj.type === 'connector') {
                const start = obj.properties?.start?.boundId;
                const end = obj.properties?.end?.boundId;
                if ((start && baseIds.has(start)) || (end && baseIds.has(end))) {
                    baseIds.add(obj.id);
                }
            }
        }
        this.objectIds = [...baseIds];
    }

    async execute() {
        for (const id of this.objectIds) {
            const obj = this._getObjectById(id);
            if (!obj) continue;

            const blobSrc = obj?.properties?.src || obj?.src;
            this.coreMoodboard.state.removeObject(id);
            this.coreMoodboard.pixi.removeObject(id);

            if (typeof blobSrc === 'string' && blobSrc.startsWith('blob:')) {
                try {
                    URL.revokeObjectURL(blobSrc);
                } catch (_) {}
            }

            this.coreMoodboard.eventBus.emit(Events.Object.Deleted, { objectId: id });
        }
    }

    undo() {
        // Локальный undo-restore отключен: история состояния загружается с сервера по версиям.
    }

    _getObjectById(id) {
        const objects = this.coreMoodboard.state.getObjects();
        return objects.find((obj) => obj.id === id);
    }
}
