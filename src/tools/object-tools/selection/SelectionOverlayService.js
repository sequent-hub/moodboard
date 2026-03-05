import * as PIXI from 'pixi.js';
import { Events } from '../../../core/events/Events.js';

export function drawGroupSelectionGraphics() {
    if (!this.app || !this.app.stage) return;
    const selectedIds = this.selection.toArray();
    if (selectedIds.length <= 1) {
        this.removeGroupSelectionGraphics();
        return;
    }
    // Получаем bounds всех объектов и отрисовываем контур на groupBoundsGraphics (одна рамка с ручками)
    const request = { objects: [] };
    this.emit(Events.Tool.GetAllObjects, request);
    const idToBounds = new Map(request.objects.map(o => [o.id, o.bounds]));
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const id of selectedIds) {
        const b = idToBounds.get(id);
        if (!b) continue;
        minX = Math.min(minX, b.x);
        minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.width);
        maxY = Math.max(maxY, b.y + b.height);
    }
    if (isFinite(minX) && isFinite(minY) && isFinite(maxX) && isFinite(maxY)) {
        const gb = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
        this.ensureGroupBoundsGraphics(gb);
        this.updateGroupBoundsGraphics(gb);
    }
}

export function removeGroupSelectionGraphics() {
    if (this.groupBoundsGraphics) {
        this.groupBoundsGraphics.clear();
        this.groupBoundsGraphics.rotation = 0;
    }
}

export function computeGroupBounds() {
    const request = { objects: [] };
    this.emit(Events.Tool.GetAllObjects, request);
    const pixiMap = new Map(request.objects.map(o => [o.id, o.pixi]));
    const b = this.selection.computeBounds((id) => pixiMap.get(id));
    if (!b) return { x: 0, y: 0, width: 0, height: 0 };
    return b;
}

export function ensureGroupBoundsGraphics(bounds) {
    if (!this.app || !this.app.stage) return;
    if (!this.groupBoundsGraphics) {
        this.groupBoundsGraphics = new PIXI.Graphics();
        this.groupBoundsGraphics.name = 'group-bounds';
        this.groupBoundsGraphics.zIndex = 1400;
        this.app.stage.addChild(this.groupBoundsGraphics);
        this.app.stage.sortableChildren = true;
    }
    this.updateGroupBoundsGraphics(bounds);
}

export function updateGroupBoundsGraphics(bounds) {
    if (!this.groupBoundsGraphics) return;
    this.groupBoundsGraphics.clear();
    // Прозрачная заливка (alpha ~0), чтобы getBounds() давал корректные размеры и не было артефактов
    this.groupBoundsGraphics.beginFill(0x000000, 0.001);
    this.groupBoundsGraphics.drawRect(0, 0, Math.max(1, bounds.width), Math.max(1, bounds.height));
    this.groupBoundsGraphics.endFill();
    // Размещаем графику в левом-верхнем углу группы
    this.groupBoundsGraphics.position.set(bounds.x, bounds.y);
    // Обновляем ручки, если показаны
    // HTML-ручки обновляются слоем HtmlHandlesLayer
}

export function updateGroupBoundsGraphicsByTopLeft(topLeft) {
    if (!this.groupBoundsGraphics || !this.groupStartBounds) return;
    this.updateGroupBoundsGraphics({ x: topLeft.x, y: topLeft.y, width: this.groupStartBounds.width, height: this.groupStartBounds.height });
    // Рисуем визуальную общую рамку одновременно
    if (this.groupSelectionGraphics) {
        this.groupSelectionGraphics.clear();
        this.groupSelectionGraphics.lineStyle(1, 0x3B82F6, 0.9);
        this.groupSelectionGraphics.drawRect(topLeft.x, topLeft.y, this.groupStartBounds.width, this.groupStartBounds.height);
    }
}
