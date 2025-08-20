import { BaseCommand } from './BaseCommand.js';
import { Events } from '../events/Events.js';

/**
 * Команда перемещения группы объектов одной операцией (для Undo/Redo)
 */
export class GroupMoveCommand extends BaseCommand {
    /**
     * @param {CoreMoodBoard} core
     * @param {Array<{id:string, from:{x:number,y:number}, to:{x:number,y:number}}>} moves
     */
    constructor(core, moves) {
        super('group-move', 'Переместить группу объектов');
        this.core = core;
        this.moves = moves || [];
    }

    execute() {
        // Применяем конечные позиции ко всем объектам
        for (const item of this.moves) {
            this.core.updateObjectPositionDirect(item.id, item.to);
            this.emit(Events.Object.TransformUpdated, {
                objectId: item.id,
                type: 'position',
                position: item.to
            });
        }
    }

    undo() {
        // Возвращаем исходные позиции
        for (const item of this.moves) {
            this.core.updateObjectPositionDirect(item.id, item.from);
            this.emit(Events.Object.TransformUpdated, {
                objectId: item.id,
                type: 'position',
                position: item.from
            });
        }
    }

    getDescription() {
        return `Переместить группу (${this.moves.length})`;
    }
}


