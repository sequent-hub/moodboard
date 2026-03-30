import { BaseCommand } from './BaseCommand.js';
import { Events } from '../events/Events.js';

/**
 * Команда поворота группы объектов одной операцией (для Undo/Redo)
 */
export class GroupRotateCommand extends BaseCommand {
    /**
     * @param {CoreMoodBoard} core
     * @param {Array<{id:string, fromAngle:number, toAngle:number, fromPos:{x:number,y:number}, toPos:{x:number,y:number}}>} changes
     */
    constructor(core, changes) {
        super('group-rotate', 'Повернуть группу объектов');
        this.core = core;
        this.changes = changes || [];
    }

    execute() {
        for (const c of this.changes) {
            if (this.core.pixi?.updateObjectRotation) {
                this.core.pixi.updateObjectRotation(c.id, c.toAngle);
            }
            this.core.updateObjectRotationDirect(c.id, c.toAngle);
            this.core.updateObjectPositionDirect(c.id, c.toPos);
            this.emit(Events.Object.TransformUpdated, { objectId: c.id, type: 'rotation', angle: c.toAngle });
            this.emit(Events.Object.TransformUpdated, { objectId: c.id, type: 'position', position: c.toPos });
        }
    }

    undo() {
        // Локальный undo отключен: история состояния загружается с сервера по версиям.
    }

    getDescription() {
        return `Повернуть группу (${this.changes.length})`;
    }
}


