import * as PIXI from 'pixi.js';

/**
 * HandlesSync — отвечает за синхронизацию ResizeHandles и групповой рамки с текущим выделением
 * Используется SelectTool, но не знает деталей SelectTool кроме предоставленного API
 */
export class HandlesSync {
    constructor({ app, resizeHandles, selection, emit }) {
        this.app = app;
        this.resizeHandles = resizeHandles;
        this.selection = selection; // SelectionModel
        this.emit = emit; // функция для EventBus.emit
        this.groupBoundsGraphics = null;
        this.groupId = '__group__';
    }

    update() {
        if (!this.resizeHandles) return;
        const count = this.selection.size();
        if (count === 0) {
            this.resizeHandles.hideHandles();
            this._removeGroupGraphics();
            return;
        }
        if (count === 1) {
            this._removeGroupGraphics();
            const objectId = this.selection.toArray()[0];
            const req = { objectId, pixiObject: null };
            this.emit('get:object:pixi', req);
            if (req.pixiObject) this.resizeHandles.showHandles(req.pixiObject, objectId);
            return;
        }
        // Группа: считаем границы и показываем ручки на невидимом прямоугольнике
        const gb = this._computeGroupBounds();
        if (!gb || gb.width <= 0 || gb.height <= 0) {
            this.resizeHandles.hideHandles();
            return;
        }
        this._ensureGroupGraphics(gb);
        this.resizeHandles.showHandles(this.groupBoundsGraphics, this.groupId);
        this._drawGroupOutline(gb);
    }

    _computeGroupBounds() {
        const req = { objects: [] };
        this.emit('get:all:objects', req);
        const pixiMap = new Map(req.objects.map(o => [o.id, o.pixi]));
        const b = this.selection.computeBounds((id) => pixiMap.get(id));
        return b;
    }

    _ensureGroupGraphics(bounds) {
        if (!this.app || !this.app.stage) return;
        if (!this.groupBoundsGraphics) {
            this.groupBoundsGraphics = new PIXI.Graphics();
            this.groupBoundsGraphics.name = 'group-bounds';
            this.groupBoundsGraphics.zIndex = 1400;
            this.app.stage.addChild(this.groupBoundsGraphics);
            this.app.stage.sortableChildren = true;
        }
        this._updateGroupGraphics(bounds);
    }

    _updateGroupGraphics(bounds) {
        if (!this.groupBoundsGraphics) return;
        this.groupBoundsGraphics.clear();
        this.groupBoundsGraphics.beginFill(0x000000, 0.001);
        this.groupBoundsGraphics.drawRect(0, 0, Math.max(1, bounds.width), Math.max(1, bounds.height));
        this.groupBoundsGraphics.endFill();
        this.groupBoundsGraphics.position.set(bounds.x, bounds.y);
        if (this.resizeHandles) this.resizeHandles.updateHandles();
    }

    _drawGroupOutline(bounds) {
        // Визуальная рамка (опционально) — можно реализовать тут, сейчас делегируем через update() SelectTool
        // Оставлено как задел
    }

    _removeGroupGraphics() {
        if (this.groupBoundsGraphics) {
            this.groupBoundsGraphics.clear();
            this.groupBoundsGraphics.rotation = 0;
        }
    }
}


