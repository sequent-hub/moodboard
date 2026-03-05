export class SingleSelectionHandlesController {
    constructor(host) {
        this.host = host;
    }

    renderForSelection(id) {
        const pixi = this.host.core.pixi.objects.get(id);
        if (!pixi) {
            this.host.hide();
            return;
        }

        const mb = pixi._mb || {};
        if (mb.type === 'comment') {
            this.host.hide();
            return;
        }

        const worldBounds = this.host.positioningService.getSingleSelectionWorldBounds(id, pixi);
        this.host._showBounds(worldBounds, id);
    }
}
