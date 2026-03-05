import * as PIXI from 'pixi.js';

export class PlacementCoordinateResolver {
    constructor(host) {
        this.host = host;
    }

    toWorld(x, y) {
        if (!this.host.world) return { x, y };
        const global = new PIXI.Point(x, y);
        const local = this.host.world.toLocal(global);
        return { x: local.x, y: local.y };
    }

    getWorldLayer() {
        if (!this.host.app || !this.host.app.stage) return null;
        const world = this.host.app.stage.getChildByName && this.host.app.stage.getChildByName('worldLayer');
        return world || this.host.app.stage;
    }
}
