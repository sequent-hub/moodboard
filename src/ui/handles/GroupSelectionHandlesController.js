export class GroupSelectionHandlesController {
    constructor(host) {
        this.host = host;
    }

    renderForSelection(ids) {
        const worldBounds = this.host.positioningService.getGroupSelectionWorldBounds(ids);
        if (!worldBounds) {
            this.host.hide();
            return;
        }
        this.host._showBounds(worldBounds, '__group__');
    }
}
