/**
 * GroupResizeController — изменение размера группы объектов
 */
export class GroupResizeController {
    constructor({ emit, selection, getGroupBounds, ensureGroupGraphics, updateGroupGraphics }) {
        this.emit = emit;
        this.selection = selection;
        this.getGroupBounds = getGroupBounds;
        this.ensureGroupGraphics = ensureGroupGraphics;
        this.updateGroupGraphics = updateGroupGraphics;

        this.isActive = false;
        this.handle = null;
        this.groupStartBounds = null;
        this.groupStartMouse = null;
    }

    start(handle, currentMouse) {
        this.isActive = true;
        this.handle = handle;
        this.groupStartBounds = this.getGroupBounds();
        this.groupStartMouse = { x: currentMouse.x, y: currentMouse.y };
        const ids = this.selection.toArray();
        this.emit('group:resize:start', { objects: ids, startBounds: this.groupStartBounds, handle });
        this.ensureGroupGraphics(this.groupStartBounds);
    }

    update(event) {
        if (!this.isActive || !this.groupStartBounds || !this.groupStartMouse) return;
        const start = this.groupStartBounds;
        const deltaX = event.x - this.groupStartMouse.x;
        const deltaY = event.y - this.groupStartMouse.y;
        const minW = 20, minH = 20;
        let x = start.x, y = start.y, w = start.width, h = start.height;

        const maintainAspectRatio = !!(event.originalEvent && event.originalEvent.shiftKey);
        switch (this.handle) {
            case 'e': w = start.width + deltaX; break;
            case 'w': w = start.width - deltaX; x = start.x + deltaX; break;
            case 's': h = start.height + deltaY; break;
            case 'n': h = start.height - deltaY; y = start.y + deltaY; break;
            case 'se': w = start.width + deltaX; h = start.height + deltaY; break;
            case 'ne': w = start.width + deltaX; h = start.height - deltaY; y = start.y + deltaY; break;
            case 'sw': w = start.width - deltaX; x = start.x + deltaX; h = start.height + deltaY; break;
            case 'nw': w = start.width - deltaX; x = start.x + deltaX; h = start.height - deltaY; y = start.y + deltaY; break;
        }

        if (maintainAspectRatio && start.height !== 0) {
            const ar = start.width / start.height;
            if (['nw','ne','sw','se'].includes(this.handle)) {
                const widthChange = Math.abs(w - start.width);
                const heightChange = Math.abs(h - start.height);
                if (widthChange > heightChange) {
                    h = w / ar;
                    if (['n','ne','nw'].includes(this.handle)) y = start.y + (start.height - h); else y = start.y;
                } else {
                    w = h * ar;
                    if (['w','sw','nw'].includes(this.handle)) x = start.x + (start.width - w); else x = start.x;
                }
            } else if (['e','w'].includes(this.handle)) {
                h = w / ar;
                if (this.handle === 'w') x = start.x + (start.width - w);
            } else if (['n','s'].includes(this.handle)) {
                w = h * ar;
                if (this.handle === 'n') y = start.y + (start.height - h);
            }
        }

        if (w < minW) { if (['w','sw','nw'].includes(this.handle)) x += (w - minW); w = minW; }
        if (h < minH) { if (['n','ne','nw'].includes(this.handle)) y += (h - minH); h = minH; }

        const scale = { x: w / start.width, y: h / start.height };
        const ids = this.selection.toArray();
        const newBounds = { x, y, width: w, height: h };
        this.emit('group:resize:update', { objects: ids, startBounds: start, newBounds, scale });
        this.updateGroupGraphics(newBounds);
    }

    end() {
        if (!this.isActive) return;
        const ids = this.selection.toArray();
        this.emit('group:resize:end', { objects: ids });
        this.isActive = false;
        this.handle = null;
        this.groupStartBounds = null;
        this.groupStartMouse = null;
    }
}


