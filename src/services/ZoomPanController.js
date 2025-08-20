import { Events } from '../core/events/Events.js';

export class ZoomPanController {
	constructor(eventBus, pixi) {
		this.eventBus = eventBus;
		this.pixi = pixi;
	}

	attach() {
		// Масштабирование колесом — глобально отрабатываем Ctrl+Wheel
		this.eventBus.on(Events.Tool.WheelZoom, ({ x, y, delta }) => {
			const factor = 1 + (-delta) * 0.0015;
			const world = this.pixi.worldLayer || this.pixi.app.stage;
			const oldScale = world.scale.x || 1;
			const newScale = Math.max(0.1, Math.min(5, oldScale * factor));
			if (newScale === oldScale) return;
			// Вычисляем мировые координаты точки под курсором до изменения скейла
			const worldX = (x - world.x) / oldScale;
			const worldY = (y - world.y) / oldScale;
			// Применяем новый скейл и пересчитываем позицию, чтобы точка под курсором осталась на месте
			world.scale.set(newScale);
			world.x = x - worldX * newScale;
			world.y = y - worldY * newScale;
			this.eventBus.emit(Events.UI.ZoomPercent, { percentage: Math.round(newScale * 100) });
		});

		// Кнопки зума из UI
		this.eventBus.on(Events.UI.ZoomIn, () => {
			const center = { x: this.pixi.app.view.clientWidth / 2, y: this.pixi.app.view.clientHeight / 2 };
			this.eventBus.emit(Events.Tool.WheelZoom, { x: center.x, y: center.y, delta: -120 });
		});
		this.eventBus.on(Events.UI.ZoomOut, () => {
			const center = { x: this.pixi.app.view.clientWidth / 2, y: this.pixi.app.view.clientHeight / 2 };
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
			world.x = centerX - worldX * 1;
			world.y = centerY - worldY * 1;
			this.eventBus.emit(Events.UI.ZoomPercent, { percentage: 100 });
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
			const newScale = Math.max(0.1, Math.min(5, Math.min(scaleX, scaleY)));
			const world = this.pixi.worldLayer || this.pixi.app.stage;
			const worldCenterX = minX + bboxW / 2;
			const worldCenterY = minY + bboxH / 2;
			world.scale.set(newScale);
			world.x = viewW / 2 - worldCenterX * newScale;
			world.y = viewH / 2 - worldCenterY * newScale;
			this.eventBus.emit(Events.UI.ZoomPercent, { percentage: Math.round(newScale * 100) });
		});
	}
}


