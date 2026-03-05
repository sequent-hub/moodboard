import * as PIXI from 'pixi.js';

export function toWorld(x, y) {
    if (!this.app || !this.app.stage) return { x, y };
    const world = this.app.stage.getChildByName && this.app.stage.getChildByName('worldLayer');
    if (!world || !world.toLocal) return { x, y };
    const p = new PIXI.Point(x, y);
    const local = world.toLocal(p);
    return { x: local.x, y: local.y };
}
