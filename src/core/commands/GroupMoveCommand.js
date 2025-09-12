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
            // В командах храним координаты центра (PIXI.x/y). Преобразуем в левый-верх для state.
            const pixiObject = this.core?.pixi?.objects?.get ? this.core.pixi.objects.get(item.id) : null;
            if (pixiObject) {
                const halfW = (pixiObject.width || 0) / 2;
                const halfH = (pixiObject.height || 0) / 2;
                const topLeft = { x: item.to.x - halfW, y: item.to.y - halfH };
                this.core.updateObjectPositionDirect(item.id, topLeft);
                this.emit(Events.Object.TransformUpdated, {
                    objectId: item.id,
                    type: 'position',
                    position: topLeft
                });
            } else {
                // Фолбэк: если нет PIXI объекта, считаем что уже в левом-верхнем
                this.core.updateObjectPositionDirect(item.id, item.to);
                this.emit(Events.Object.TransformUpdated, {
                    objectId: item.id,
                    type: 'position',
                    position: item.to
                });
            }
        }
    }

    undo() {
        // Возвращаем исходные позиции
        for (const item of this.moves) {
            const pixiObject = this.core?.pixi?.objects?.get ? this.core.pixi.objects.get(item.id) : null;
            if (pixiObject) {
                const halfW = (pixiObject.width || 0) / 2;
                const halfH = (pixiObject.height || 0) / 2;
                const topLeft = { x: item.from.x - halfW, y: item.from.y - halfH };
                this.core.updateObjectPositionDirect(item.id, topLeft);
                this.emit(Events.Object.TransformUpdated, {
                    objectId: item.id,
                    type: 'position',
                    position: topLeft
                });
            } else {
                this.core.updateObjectPositionDirect(item.id, item.from);
                this.emit(Events.Object.TransformUpdated, {
                    objectId: item.id,
                    type: 'position',
                    position: item.from
                });
            }
        }
    }

    getDescription() {
        return `Переместить группу (${this.moves.length})`;
    }
}


