import { BaseCommand } from './BaseCommand.js';
import { Events } from '../events/Events.js';

/**
 * Команда изменения размера группы объектов одной операцией (Undo/Redo)
 */
export class GroupResizeCommand extends BaseCommand {
    /**
     * @param {CoreMoodBoard} core
     * @param {Array<{id:string, fromSize:{width:number,height:number}, toSize:{width:number,height:number}, fromPos:{x:number,y:number}, toPos:{x:number,y:number}, type?:string}>} changes
     */
    constructor(core, changes) {
        super('group-resize', 'Изменить размер группы объектов');
        this.core = core;
        this.changes = changes || [];
    }

    execute() {
        for (const c of this.changes) {
            this.core.updateObjectSizeAndPositionDirect(c.id, c.toSize, c.toPos, c.type || null);
            this.emit(Events.Object.TransformUpdated, { objectId: c.id, type: 'resize', size: c.toSize, position: c.toPos });
        }
    }

    undo() {
        for (const c of this.changes) {
            this.core.updateObjectSizeAndPositionDirect(c.id, c.fromSize, c.fromPos, c.type || null);
            this.emit(Events.Object.TransformUpdated, { objectId: c.id, type: 'resize', size: c.fromSize, position: c.fromPos });
        }
    }

    getDescription() {
        return `Изменить размер группы (${this.changes.length})`;
    }
}


