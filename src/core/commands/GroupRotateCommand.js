import { BaseCommand } from './BaseCommand.js';

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
            this.core.updateObjectRotationDirect(c.id, c.toAngle);
            this.core.updateObjectPositionDirect(c.id, c.toPos);
            this.emit('object:transform:updated', { objectId: c.id, type: 'rotation', angle: c.toAngle });
            this.emit('object:transform:updated', { objectId: c.id, type: 'position', position: c.toPos });
        }
    }

    undo() {
        for (const c of this.changes) {
            this.core.updateObjectRotationDirect(c.id, c.fromAngle);
            this.core.updateObjectPositionDirect(c.id, c.fromPos);
            this.emit('object:transform:updated', { objectId: c.id, type: 'rotation', angle: c.fromAngle });
            this.emit('object:transform:updated', { objectId: c.id, type: 'position', position: c.fromPos });
        }
    }

    getDescription() {
        return `Повернуть группу (${this.changes.length})`;
    }
}


