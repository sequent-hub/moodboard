export class GroupSelectionHandlesController {
    constructor(host) {
        this.host = host;
    }

    renderForSelection(ids) {
        const preview = this.host._groupRotationPreview;
        if (preview && Array.isArray(preview.ids) && preview.ids.length === ids.length) {
            const hasSameSelection = ids.every((id) => preview.ids.includes(id));
            if (hasSameSelection && preview.startBounds) {
                this.host._showBounds({
                    x: preview.center.x - preview.startBounds.width / 2,
                    y: preview.center.y - preview.startBounds.height / 2,
                    width: preview.startBounds.width,
                    height: preview.startBounds.height,
                }, '__group__', {
                    rotation: preview.angle || 0,
                });
                return;
            }
        }
        const worldBounds = this.host.positioningService.getGroupSelectionWorldBounds(ids);
        if (!worldBounds) {
            this.host.hide();
            return;
        }
        this.host._showBounds(worldBounds, '__group__');
    }
}
