import * as PIXI from 'pixi.js';

/**
 * BoxSelectController — управление рамкой выделения и выбором по пересечению
 */
export class BoxSelectController {
    constructor({ app, selection, emit, setSelection, clearSelection, rectIntersectsRect }) {
        this.app = app;
        this.selection = selection; // SelectionModel
        this.emit = emit;
        this.setSelection = setSelection;
        this.clearSelection = clearSelection;
        this.rectIntersectsRect = rectIntersectsRect;

        this.isActive = false;
        this.selectionBox = null;
        this.selectionGraphics = null;
        this.initialSelectionBeforeBox = null;
        this.isMultiSelect = false;
    }

    start(mouse, isMultiSelect) {
        this.isActive = true;
        this.isMultiSelect = !!isMultiSelect;
        this.selectionBox = { startX: mouse.x, startY: mouse.y, endX: mouse.x, endY: mouse.y };
        this.initialSelectionBeforeBox = this.selection.toArray();
        if (!this.isMultiSelect) this.clearSelection();
        if (this.app && this.app.stage) {
            this.app.stage.sortableChildren = true;
            this.selectionGraphics = new PIXI.Graphics();
            this.selectionGraphics.zIndex = 2000;
            this.selectionGraphics.name = 'selection-box';
            this.app.stage.addChild(this.selectionGraphics);
        }
    }

    update(mouse) {
        if (!this.selectionBox) return;
        this.selectionBox.endX = mouse.x;
        this.selectionBox.endY = mouse.y;
        const x = Math.min(this.selectionBox.startX, this.selectionBox.endX);
        const y = Math.min(this.selectionBox.startY, this.selectionBox.endY);
        const w = Math.abs(this.selectionBox.endX - this.selectionBox.startX);
        const h = Math.abs(this.selectionBox.endY - this.selectionBox.startY);
        if (this.selectionGraphics) {
            this.selectionGraphics.clear();
            this.selectionGraphics.lineStyle(1, 0x3B82F6, 1);
            this.selectionGraphics.beginFill(0x3B82F6, 0.08);
            this.selectionGraphics.drawRect(x, y, w, h);
            this.selectionGraphics.endFill();
        }
        if (w >= 2 && h >= 2) {
            const box = { x, y, width: w, height: h };
            const request = { objects: [] };
            this.emit('get:all:objects', request);
            const matched = [];
            for (const item of request.objects) {
                if (this.rectIntersectsRect(box, item.bounds)) matched.push(item.id);
            }
            let newSelection;
            if (this.isMultiSelect && this.initialSelectionBeforeBox) {
                const base = new Set(this.initialSelectionBeforeBox);
                for (const id of matched) base.add(id);
                newSelection = Array.from(base);
            } else {
                newSelection = matched;
            }
            this.setSelection(newSelection);
        }
    }

    end() {
        if (!this.selectionBox) {
            this.isActive = false;
            return;
        }
        const x = Math.min(this.selectionBox.startX, this.selectionBox.endX);
        const y = Math.min(this.selectionBox.startY, this.selectionBox.endY);
        const w = Math.abs(this.selectionBox.endX - this.selectionBox.startX);
        const h = Math.abs(this.selectionBox.endY - this.selectionBox.startY);
        if (w >= 2 && h >= 2) {
            const box = { x, y, width: w, height: h };
            const request = { objects: [] };
            this.emit('get:all:objects', request);
            const matched = [];
            for (const item of request.objects) {
                if (this.rectIntersectsRect(box, item.bounds)) matched.push(item.id);
            }
            if (matched.length > 0) {
                if (this.isMultiSelect) {
                    for (const id of matched) if (!this.selection.has(id)) this.setSelection([...this.selection.toArray(), id]);
                } else {
                    this.setSelection(matched);
                }
            }
        }
        this.isActive = false;
        this.selectionBox = null;
        if (this.selectionGraphics && this.selectionGraphics.parent) this.selectionGraphics.parent.removeChild(this.selectionGraphics);
        this.selectionGraphics?.destroy();
        this.selectionGraphics = null;
    }
}


