import { BaseTool } from '../BaseTool.js';
import * as PIXI from 'pixi.js';

const LASER_COLOR = 0xff2222;
const LASER_DOT_COLOR = 0xff4444;
const TRAIL_MAX_POINTS = 200;
const FADE_STEPS = 50;
const FADE_INTERVAL_MS = 40;

/**
 * Инструмент «Лазерная указка» — оставляет эфемерный затухающий след, ничего не сохраняет.
 */
export class LaserPointerTool extends BaseTool {
    constructor(eventBus) {
        super('laser', eventBus);
        this.hotkey = null;
        this.cursor = 'crosshair';

        this.isDrawing = false;
        this.points = [];
        this.graphics = null;
        this.app = null;
        this._fadeTimer = null;
    }

    activate(app) {
        super.activate();
        this.app = app;
        if (app && app.view) app.view.style.cursor = 'crosshair';
        if (app && app.stage) {
            app.stage.sortableChildren = true;
            this.graphics = new PIXI.Graphics();
            this.graphics.zIndex = 3000;
            this.graphics.name = 'laser-trail';
            app.stage.addChild(this.graphics);
        }
    }

    deactivate() {
        this._clearFadeTimer();
        if (this.graphics) {
            this.graphics.clear();
            if (this.graphics.parent) this.graphics.parent.removeChild(this.graphics);
            this.graphics.destroy();
            this.graphics = null;
        }
        if (this.app && this.app.view) this.app.view.style.cursor = '';
        this.app = null;
        this.points = [];
        this.isDrawing = false;
        super.deactivate();
    }

    onMouseDown(event) {
        this.isDrawing = true;
        this._clearFadeTimer();
        if (this.graphics) this.graphics.alpha = 1;
        this.points = [{ x: event.x, y: event.y }];
        this._redrawTrail();
    }

    onMouseMove(event) {
        if (!this.isDrawing) return;
        this.points.push({ x: event.x, y: event.y });
        if (this.points.length > TRAIL_MAX_POINTS) this.points.shift();
        this._redrawTrail();
    }

    onMouseUp() {
        this.isDrawing = false;
        this._scheduleFade();
    }

    _redrawTrail() {
        if (!this.graphics) return;
        this.graphics.clear();
        const n = this.points.length;
        if (n < 2) return;

        for (let i = 1; i < n; i++) {
            const t = i / n;
            const width = Math.max(2, t * 3);
            this.graphics.lineStyle(width, LASER_COLOR, t * 0.85);
            this.graphics.moveTo(this.points[i - 1].x, this.points[i - 1].y);
            this.graphics.lineTo(this.points[i].x, this.points[i].y);
        }

        const last = this.points[n - 1];
        this.graphics.beginFill(LASER_DOT_COLOR, 0.95);
        this.graphics.drawCircle(last.x, last.y, 5);
        this.graphics.endFill();
    }

    _scheduleFade() {
        this._clearFadeTimer();
        let step = 0;
        this._fadeTimer = setInterval(() => {
            step++;
            if (!this.graphics) { clearInterval(this._fadeTimer); this._fadeTimer = null; return; }
            const alpha = Math.max(0, 1 - step / FADE_STEPS);
            this.graphics.alpha = alpha;
            if (step >= FADE_STEPS) {
                clearInterval(this._fadeTimer);
                this._fadeTimer = null;
                if (this.graphics) {
                    this.graphics.clear();
                    this.graphics.alpha = 1;
                }
                this.points = [];
            }
        }, FADE_INTERVAL_MS);
    }

    _clearFadeTimer() {
        if (this._fadeTimer) {
            clearInterval(this._fadeTimer);
            this._fadeTimer = null;
        }
        if (this.graphics) this.graphics.alpha = 1;
    }
}
