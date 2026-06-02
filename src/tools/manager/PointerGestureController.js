import { Events } from '../../core/events/Events.js';

const PINCH_SCALE_MIN = 0.02;
const PINCH_SCALE_MAX = 5;
const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE_THRESHOLD = 10;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_DIST = 24;

/**
 * Единый роутер ввода для мыши / пера / тача через Pointer Events API.
 * Добавляет pinch-zoom, двухпальцевый pan и long-press для тача,
 * не меняя контракты существующих тул-методов.
 */
export class PointerGestureController {
    constructor(manager) {
        this.manager = manager;
        /** @type {Map<number, {x: number, y: number}>} — активные нажатые указатели */
        this.pointers = new Map();
        /** Подавлять одиночный указатель во время мультитач-жеста */
        this.suppressSingle = false;

        this._pinchPrevDist = null;
        this._pinchPrevMid = null;

        this._longPressTimer = null;
        this._longPressDownPos = null;

        this._lastTapTime = 0;
        this._lastTapPos = null;
    }

    _dist(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    _mid(p1, p2) {
        return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    }

    _clearLongPress() {
        if (this._longPressTimer !== null) {
            clearTimeout(this._longPressTimer);
            this._longPressTimer = null;
        }
        this._longPressDownPos = null;
    }

    _screenPos(e) {
        const rect = this.manager.container.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    onPointerDown(e) {
        const manager = this.manager;
        manager._lastPointerType = e.pointerType;

        const pos = this._screenPos(e);
        this.pointers.set(e.pointerId, pos);

        if (this.pointers.size === 2) {
            this._clearLongPress();
            // Безопасно завершить одиночное взаимодействие до начала жеста
            if (manager.activeTool && typeof manager.activeTool.onMouseUp === 'function') {
                manager.activeTool.onMouseUp({ x: pos.x, y: pos.y, button: 0, originalEvent: e });
            }
            this.suppressSingle = true;
            const pts = Array.from(this.pointers.values());
            this._pinchPrevDist = this._dist(pts[0], pts[1]);
            this._pinchPrevMid = this._mid(pts[0], pts[1]);
            return;
        }

        if (this.suppressSingle) return;

        // Long-press: таймер только для тача
        if (e.pointerType === 'touch') {
            this._longPressDownPos = pos;
            this._longPressTimer = setTimeout(() => {
                this._longPressTimer = null;
                this._longPressDownPos = null;
                if (manager.activeTool && typeof manager.activeTool.onContextMenu === 'function') {
                    manager.activeTool.onContextMenu({ x: pos.x, y: pos.y, originalEvent: e });
                }
            }, LONG_PRESS_MS);
        }

        manager.handleMouseDown(e);
    }

    onPointerMove(e) {
        const manager = this.manager;
        const isTracked = this.pointers.has(e.pointerId);

        // Тач без зарегистрированного pointerdown — пропускаем
        if (e.pointerType === 'touch' && !isTracked) return;

        const pos = this._screenPos(e);
        if (isTracked) {
            this.pointers.set(e.pointerId, pos);
        }

        if (this.pointers.size >= 2) {
            if (!isTracked) return;
            const pts = Array.from(this.pointers.values());
            const curDist = this._dist(pts[0], pts[1]);
            const curMid = this._mid(pts[0], pts[1]);

            if (this._pinchPrevDist !== null) {
                const world = manager.core?.pixi?.worldLayer || manager.core?.pixi?.app?.stage;
                if (world) {
                    const oldScale = world.scale.x || 1;
                    const factor = curDist / this._pinchPrevDist;
                    const newScale = Math.max(PINCH_SCALE_MIN, Math.min(PINCH_SCALE_MAX, oldScale * factor));

                    // Мировая точка под серединой пальцев — она должна остаться на месте
                    const worldX = (curMid.x - world.x) / oldScale;
                    const worldY = (curMid.y - world.y) / oldScale;
                    // Дельта двухпальцевого pan
                    const panDx = this._pinchPrevMid ? curMid.x - this._pinchPrevMid.x : 0;
                    const panDy = this._pinchPrevMid ? curMid.y - this._pinchPrevMid.y : 0;

                    world.scale.set(newScale);
                    // integer-контракт: round screen-space координаты
                    world.x = Math.round(curMid.x - worldX * newScale + panDx);
                    world.y = Math.round(curMid.y - worldY * newScale + panDy);

                    manager.eventBus.emit(Events.UI.ZoomPercent, { percentage: Math.round(newScale * 100) });
                    manager.eventBus.emit(Events.Viewport.Changed);
                }
            }

            this._pinchPrevDist = curDist;
            this._pinchPrevMid = curMid;
            return;
        }

        if (this.suppressSingle) return;

        // Отменить long-press если палец сдвинулся более чем на порог
        if (isTracked && e.pointerType === 'touch' && this._longPressDownPos) {
            const dx = pos.x - this._longPressDownPos.x;
            const dy = pos.y - this._longPressDownPos.y;
            if (Math.sqrt(dx * dx + dy * dy) > LONG_PRESS_MOVE_THRESHOLD) {
                this._clearLongPress();
            }
        }

        manager.handleMouseMove(e);
    }

    onPointerUp(e) {
        const manager = this.manager;
        this._clearLongPress();

        const hadPointer = this.pointers.has(e.pointerId);
        this.pointers.delete(e.pointerId);

        const wasSuppressed = this.suppressSingle;
        if (this.pointers.size === 0) {
            this.suppressSingle = false;
            this._pinchPrevDist = null;
            this._pinchPrevMid = null;
        }

        if (wasSuppressed || !hadPointer) return;

        manager.handleMouseUp(e);

        // Double-tap для тача: синтетический doubleClick после обычного up
        if (e.pointerType === 'touch') {
            const pos = this._screenPos(e);
            const now = performance.now();
            const elapsed = now - this._lastTapTime;
            if (
                elapsed < DOUBLE_TAP_MS &&
                this._lastTapPos &&
                this._dist(pos, this._lastTapPos) < DOUBLE_TAP_DIST
            ) {
                if (manager.activeTool && typeof manager.activeTool.onDoubleClick === 'function') {
                    // Если вторым тапом был случайно запущен resize через PIXI hitTest — отменяем до открытия редактора
                    if (manager.activeTool.isResizing || manager.activeTool.isGroupResizing) {
                        manager.activeTool.onMouseUp({ x: pos.x, y: pos.y, button: 0, originalEvent: e });
                    }
                    manager.activeTool.onDoubleClick({ x: pos.x, y: pos.y, originalEvent: e, target: e.target });
                }
                this._lastTapTime = 0;
                this._lastTapPos = null;
                return;
            }
            this._lastTapTime = now;
            this._lastTapPos = pos;
        }
    }

    destroy() {
        this._clearLongPress();
        this.pointers.clear();
        this._pinchPrevDist = null;
        this._pinchPrevMid = null;
        this._lastTapTime = 0;
        this._lastTapPos = null;
    }
}
