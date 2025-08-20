import { BaseCommand } from './BaseCommand.js';
import { Events } from '../events/Events.js';

/**
 * Команда изменения порядка (z-order) одного объекта
 */
export class ReorderZCommand extends BaseCommand {
    constructor(core, objectId, fromIndex, toIndex) {
        super('reorder-z', 'Изменить порядок слоя объекта');
        this.core = core;
        this.objectId = objectId;
        this.fromIndex = fromIndex;
        this.toIndex = toIndex;
    }

    execute() {
        this.apply(this.fromIndex, this.toIndex);
    }

    undo() {
        this.apply(this.toIndex, this.fromIndex);
    }

    apply(from, to) {
        const arr = this.core.state.state.objects || [];
        const idx = arr.findIndex(o => o.id === this.objectId);
        if (idx === -1) return;
        const [item] = arr.splice(idx, 1);
        const insertAt = Math.max(0, Math.min(to, arr.length));
        arr.splice(insertAt, 0, item);
        // Обновляем zIndex в PIXI
        const app = this.core.pixi?.app;
        if (app) {
            app.stage.sortableChildren = true;
            (this.core.state.state.objects || []).forEach((o, i) => {
                const pixi = this.core.pixi.objects.get(o.id);
                if (pixi) pixi.zIndex = i;
            });
        }
        this.core.state.markDirty();
        this.emit(Events.Object.Reordered, { objectId: this.objectId, toIndex: to });
    }
}


