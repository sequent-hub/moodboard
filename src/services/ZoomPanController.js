import { Events } from '../core/events/Events.js';
import {
	MIRO_ZOOM_DOWN_FROM_100,
	MIRO_ZOOM_DOWN_FROM_400,
	MIRO_ZOOM_UP_FROM_100,
	MIRO_ZOOM_UP_TO_100,
} from './MiroZoomLevels.js';

/**
 * Направленные zoom-последовательности, выровненные под наблюдения Miro.
 */
const ZOOM_UP_TO_100 = MIRO_ZOOM_UP_TO_100;
const ZOOM_UP_FROM_100 = MIRO_ZOOM_UP_FROM_100;
const ZOOM_DOWN_FROM_100 = MIRO_ZOOM_DOWN_FROM_100;
const ZOOM_DOWN_FROM_400 = MIRO_ZOOM_DOWN_FROM_400;
const EPSILON = 1e-6;

export class ZoomPanController {
	constructor(eventBus, pixi) {
		this.eventBus = eventBus;
		this.pixi = pixi;
	}

	_nextAscendingLevel(percent, levels) {
		for (let i = 0; i < levels.length; i += 1) {
			if (levels[i] > percent + EPSILON) return levels[i];
		}
		return levels[levels.length - 1];
	}

	_nextDescendingLevel(percent, levels) {
		for (let i = 0; i < levels.length; i += 1) {
			if (levels[i] < percent - EPSILON) return levels[i];
		}
		return levels[levels.length - 1];
	}

	_pickTargetPercent(oldPercent, delta) {
		if (delta < 0) {
			if (oldPercent >= 100) {
				return this._nextAscendingLevel(oldPercent, ZOOM_UP_FROM_100);
			}
			return this._nextAscendingLevel(oldPercent, ZOOM_UP_TO_100);
		}
		if (delta > 0) {
			if (oldPercent > 100) {
				return this._nextDescendingLevel(oldPercent, ZOOM_DOWN_FROM_400);
			}
			return this._nextDescendingLevel(oldPercent, ZOOM_DOWN_FROM_100);
		}
		return oldPercent;
	}

	attach() {
		// Масштабирование колесом — глобально отрабатываем Ctrl+Wheel
		this.eventBus.on(Events.Tool.WheelZoom, ({ x, y, delta }) => {
			const world = this.pixi.worldLayer || this.pixi.app.stage;
			const oldScale = world.scale.x || 1;
			const oldPercent = oldScale * 100;
			if (!(delta < 0 || delta > 0)) return;

			const targetPercent = this._pickTargetPercent(oldPercent, delta);
			const newScale = Math.max(0.01, Math.min(5, targetPercent / 100));
			if (Math.abs(newScale - oldScale) < 0.0001) return;

			// Вычисляем мировые координаты точки под курсором до изменения скейла
			const worldX = (x - world.x) / oldScale;
			const worldY = (y - world.y) / oldScale;
			// Применяем новый скейл и пересчитываем позицию, чтобы точка под курсором осталась на месте
			world.scale.set(newScale);
			world.x = Math.round(x - worldX * newScale);
			world.y = Math.round(y - worldY * newScale);
			this.eventBus.emit(Events.UI.ZoomPercent, { percentage: Math.round(newScale * 100) });
			this.eventBus.emit(Events.Viewport.Changed);
		});

		// Кнопки зума из UI
		this.eventBus.on(Events.UI.ZoomIn, () => {
			const view = this.pixi?.app?.view;
			if (!view) return;
			const center = { x: view.clientWidth / 2, y: view.clientHeight / 2 };
			this.eventBus.emit(Events.Tool.WheelZoom, { x: center.x, y: center.y, delta: -120 });
		});
		this.eventBus.on(Events.UI.ZoomOut, () => {
			const view = this.pixi?.app?.view;
			if (!view) return;
			const center = { x: view.clientWidth / 2, y: view.clientHeight / 2 };
			this.eventBus.emit(Events.Tool.WheelZoom, { x: center.x, y: center.y, delta: 120 });
		});
		this.eventBus.on(Events.UI.ZoomReset, () => {
			const world = this.pixi.worldLayer || this.pixi.app.stage;
			const centerX = this.pixi.app.view.clientWidth / 2;
			const centerY = this.pixi.app.view.clientHeight / 2;
			const oldScale = world.scale.x || 1;
			const worldX = (centerX - world.x) / oldScale;
			const worldY = (centerY - world.y) / oldScale;
			world.scale.set(1);
			world.x = Math.round(centerX - worldX);
			world.y = Math.round(centerY - worldY);
			this.eventBus.emit(Events.UI.ZoomPercent, { percentage: 100 });
			this.eventBus.emit(Events.Viewport.Changed);
		});
		this.eventBus.on(Events.UI.ZoomFit, () => {
			const objs = (this.pixi?.objects ? Array.from(this.pixi.objects.values()) : []);
			if (objs.length === 0) return;
			let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
			for (const p of objs) {
				const b = p.getBounds();
				minX = Math.min(minX, b.x);
				minY = Math.min(minY, b.y);
				maxX = Math.max(maxX, b.x + b.width);
				maxY = Math.max(maxY, b.y + b.height);
			}
			const bboxW = Math.max(1, maxX - minX);
			const bboxH = Math.max(1, maxY - minY);
			const viewW = this.pixi.app.view.clientWidth;
			const viewH = this.pixi.app.view.clientHeight;
			const padding = 40;
			const scaleX = (viewW - padding) / bboxW;
			const scaleY = (viewH - padding) / bboxH;
			const newScale = Math.max(0.01, Math.min(5, Math.min(scaleX, scaleY)));
			const world = this.pixi.worldLayer || this.pixi.app.stage;
			const worldCenterX = minX + bboxW / 2;
			const worldCenterY = minY + bboxH / 2;
			world.scale.set(newScale);
			world.x = Math.round(viewW / 2 - worldCenterX * newScale);
			world.y = Math.round(viewH / 2 - worldCenterY * newScale);
			this.eventBus.emit(Events.UI.ZoomPercent, { percentage: Math.round(newScale * 100) });
			this.eventBus.emit(Events.Viewport.Changed);
		});
	}
}


