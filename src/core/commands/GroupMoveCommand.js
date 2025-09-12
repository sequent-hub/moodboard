import { BaseCommand } from './BaseCommand.js';
import { Events } from '../events/Events.js';

/**
 * Команда перемещения группы объектов одной операцией (для Undo/Redo)
 */
export class GroupMoveCommand extends BaseCommand {
    /**
     * @param {CoreMoodBoard} core
     * @param {Array<{id:string, from:{x:number,y:number}, to:{x:number,y:number}}>} moves
     * @param {boolean} coordinatesAreTopLeft - true если координаты уже левый-верх, false если центры PIXI
     */
    constructor(core, moves, coordinatesAreTopLeft = false) {
        super('group-move', 'Переместить группу объектов');
        this.core = core;
        this.moves = moves || [];
        this.coordinatesAreTopLeft = coordinatesAreTopLeft;
    }

    execute() {
        // Применяем конечные позиции ко всем объектам
        for (const item of this.moves) {
            if (this.coordinatesAreTopLeft) {
                // Координаты уже левый-верх (Frame перемещение)
                this.core.updateObjectPositionDirect(item.id, item.to);
                this.emit(Events.Object.TransformUpdated, {
                    objectId: item.id,
                    type: 'position',
                    position: item.to
                });
            } else {
                // Координаты - центры PIXI (обычное групповое перемещение)
                const pixiObject = this.core?.pixi?.objects?.get(item.id);
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
                }
            }
        }
    }

    undo() {
        // Возвращаем исходные позиции
        for (const item of this.moves) {
            if (this.coordinatesAreTopLeft) {
                // Координаты уже левый-верх (Frame перемещение)
                this.core.updateObjectPositionDirect(item.id, item.from);
                this.emit(Events.Object.TransformUpdated, {
                    objectId: item.id,
                    type: 'position',
                    position: item.from
                });
            } else {
                // Координаты - центры PIXI (обычное групповое перемещение)
                const pixiObject = this.core?.pixi?.objects?.get(item.id);
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
                }
            }
        }
    }

    getDescription() {
        return `Переместить группу (${this.moves.length})`;
    }
}


