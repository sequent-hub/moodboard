import { Events } from '../../core/events/Events.js';

export class HandlesEventBridge {
    constructor(host) {
        this.host = host;
        this.subscriptions = [];
        this.isAttached = false;
        this._mindmapDragSnapshot = null;
    }

    attach() {
        if (this.isAttached) return;
        this.isAttached = true;

        const bindings = [
            [Events.Tool.SelectionAdd, () => this.host.update()],
            [Events.Tool.SelectionRemove, () => this.host.update()],
            [Events.Tool.SelectionClear, () => {
                this.host._endGroupRotationPreview();
                this.host.hide();
            }],
            [Events.Object.Created, () => this.host.update()],
            [Events.Tool.DragUpdate, () => this.host.update()],
            [Events.Object.Deleted, (data) => {
                const objectId = data?.objectId || data;
                console.log('🗑️ HtmlHandlesLayer: получено событие удаления:', data, 'objectId:', objectId);
                this.host.hide();
                this.host.layer.innerHTML = '';
                setTimeout(() => {
                    this.host.update();
                }, 10);
            }],
            [Events.Tool.DragStart, () => {
                this._mindmapDragSnapshot = this.host.domRenderer?.captureMindmapSnapshot?.() || null;
                this.host._handlesSuppressed = true;
                this.host._setHandlesVisibility(false);
            }],
            [Events.Tool.DragEnd, (data) => {
                this.host.domRenderer?.enforceMindmapAutoLayoutAfterDragEnd?.({
                    draggedIds: [data?.object].filter(Boolean),
                    snapshot: this._mindmapDragSnapshot,
                });
                this._mindmapDragSnapshot = null;
                this.host._handlesSuppressed = false;
                this.host._setHandlesVisibility(true);
                this.host.update();
            }],
            [Events.Tool.ResizeUpdate, (data) => {
                this.host.domRenderer?.relayoutMindmapAfterResize?.({
                    objectId: data?.object || null,
                });
                this.host.update();
            }],
            [Events.Tool.ResizeStart, () => { this.host._handlesSuppressed = true; this.host._setHandlesVisibility(false); }],
            [Events.Tool.ResizeEnd, () => { this.host._handlesSuppressed = false; this.host._setHandlesVisibility(true); }],
            [Events.Tool.RotateUpdate, () => this.host.update()],
            [Events.Tool.RotateStart, () => { this.host._handlesSuppressed = true; this.host._setHandlesVisibility(false); }],
            [Events.Tool.RotateEnd, () => { this.host._handlesSuppressed = false; this.host._setHandlesVisibility(true); }],
            [Events.Tool.GroupDragUpdate, () => {
                this.host._syncGroupRotationPreviewTranslation();
                this.host.update();
            }],
            [Events.Tool.GroupDragStart, () => {
                this._mindmapDragSnapshot = this.host.domRenderer?.captureMindmapSnapshot?.() || null;
                this.host._handlesSuppressed = true;
                this.host._setHandlesVisibility(false);
            }],
            [Events.Tool.GroupDragEnd, (data) => {
                const draggedIds = Array.isArray(data?.objects) ? data.objects : [];
                this.host.domRenderer?.enforceMindmapAutoLayoutAfterDragEnd?.({
                    draggedIds,
                    snapshot: this._mindmapDragSnapshot,
                });
                this._mindmapDragSnapshot = null;
                this.host._handlesSuppressed = false;
                this.host._setHandlesVisibility(true);
                this.host.update();
            }],
            [Events.Tool.GroupResizeUpdate, (data) => {
                const resizedIds = Array.isArray(data?.objects) ? data.objects : [];
                resizedIds.forEach((id) => {
                    this.host.domRenderer?.relayoutMindmapAfterResize?.({
                        objectId: id,
                    });
                });
                this.host._updateGroupResizePreview(data);
                this.host.update();
            }],
            [Events.Tool.GroupResizeStart, (data) => {
                this.host._startGroupResizePreview(data);
                this.host._handlesSuppressed = true;
                this.host._setHandlesVisibility(false);
            }],
            [Events.Tool.GroupResizeEnd, () => {
                this.host._finishGroupResizePreview();
                this.host._handlesSuppressed = false;
                this.host._setHandlesVisibility(true);
            }],
            [Events.Tool.GroupRotateUpdate, (data) => {
                this.host._updateGroupRotationPreview(data);
                this.host.update();
            }],
            [Events.Tool.GroupRotateStart, (data) => {
                this.host._startGroupRotationPreview(data);
                this.host._handlesSuppressed = true;
                this.host._setHandlesVisibility(false);
            }],
            [Events.Tool.GroupRotateEnd, () => {
                this.host._finishGroupRotationPreview();
                this.host._handlesSuppressed = false;
                this.host._setHandlesVisibility(true);
                this.host.update();
            }],
            [Events.UI.ZoomPercent, () => this.host.update()],
            [Events.Tool.PanUpdate, () => this.host.update()],
            [Events.History.Changed, (data) => {
                if (data?.lastUndone || data?.lastRedone) {
                    this.host._endGroupRotationPreview();
                    this.host.domRenderer?.relayoutAllMindmapCompounds?.();
                    setTimeout(() => {
                        this.host.domRenderer?.relayoutAllMindmapCompounds?.();
                    }, 0);
                    this.host.update();
                }
            }],
        ];

        bindings.forEach(([event, handler]) => {
            this.host.eventBus.on(event, handler);
            this.subscriptions.push([event, handler]);
        });
    }

    detach() {
        if (!this.isAttached) return;
        this.isAttached = false;
        if (typeof this.host.eventBus?.off !== 'function') {
            this.subscriptions = [];
            return;
        }
        this.subscriptions.forEach(([event, handler]) => {
            this.host.eventBus.off(event, handler);
        });
        this.subscriptions = [];
    }
}
