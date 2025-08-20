import { BaseCommand } from './BaseCommand.js';
import { Events } from '../events/Events.js';

/**
 * Команда изменения порядка (z-order) группы объектов как единого блока
 * Сохраняет внутренний порядок группы
 */
export class GroupReorderZCommand extends BaseCommand {
    constructor(core, objectIds, mode) {
        super('group-reorder-z', 'Изменить порядок слоя группы');
        this.core = core;
        this.objectIds = Array.from(objectIds || []);
        this.mode = mode; // 'front' | 'back' | 'forward' | 'backward'
        this.beforeOrder = null; // снимок порядка ids массива state
        this.afterOrder = null;
    }

    execute() {
        this.beforeOrder = (this.core.state.state.objects || []).map(o => o.id);
        this.reorder(this.mode);
        this.afterOrder = (this.core.state.state.objects || []).map(o => o.id);
    }

    undo() {
        if (!this.beforeOrder) return;
        this.applyOrder(this.beforeOrder);
    }

    applyOrder(idOrder) {
        const map = new Map((this.core.state.state.objects || []).map(o => [o.id, o]));
        this.core.state.state.objects = idOrder.map(id => map.get(id)).filter(Boolean);
        // Пересчет zIndex
        const app = this.core.pixi?.app;
        if (app) {
            app.stage.sortableChildren = true;
            (this.core.state.state.objects || []).forEach((o, i) => {
                const pixi = this.core.pixi.objects.get(o.id);
                if (pixi) pixi.zIndex = i;
            });
        }
        this.core.state.markDirty();
        this.emit(Events.Object.Reordered, { ids: this.objectIds });
    }

    reorder(mode) {
        const arr = this.core.state.state.objects || [];
        const ids = new Set(this.objectIds);
        const selectedItems = arr.filter(o => ids.has(o.id));
        const others = arr.filter(o => !ids.has(o.id));
        const indices = arr.map((o, i) => ({ id: o.id, i })).filter(p => ids.has(p.id)).map(p => p.i).sort((a,b)=>a-b);
        const minIdx = indices[0] ?? 0;
        const othersBefore = arr.slice(0, minIdx).filter(o => !ids.has(o.id)).length;
        let insertPos = othersBefore;
        switch (mode) {
            case 'front': insertPos = others.length; break;
            case 'back': insertPos = 0; break;
            case 'forward': insertPos = Math.min(othersBefore + 1, others.length); break;
            case 'backward': insertPos = Math.max(othersBefore - 1, 0); break;
        }
        this.core.state.state.objects = [...others.slice(0, insertPos), ...selectedItems, ...others.slice(insertPos)];
        // Пересчет zIndex
        const app = this.core.pixi?.app;
        if (app) {
            app.stage.sortableChildren = true;
            (this.core.state.state.objects || []).forEach((o, i) => {
                const pixi = this.core.pixi.objects.get(o.id);
                if (pixi) pixi.zIndex = i;
            });
        }
        this.core.state.markDirty();
    }
}


