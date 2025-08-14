export class ZoomPanController {
	constructor(eventBus, pixi) {
		this.eventBus = eventBus;
		this.pixi = pixi;
	}

	attach() {
		// Масштабирование колесом — глобально отрабатываем Ctrl+Wheel
		this.eventBus.on('tool:wheel:zoom', ({ x, y, delta }) => {
			const factor = 1 + (-delta) * 0.0015;
			const world = this.pixi.worldLayer || this.pixi.app.stage;
			const oldScale = world.scale.x || 1;
			const newScale = Math.max(0.1, Math.min(5, oldScale * factor));
			if (newScale === oldScale) return;
			const globalPoint = new this.pixi.app.renderer.plugins.interaction.cursor.global.constructor(x, y);
			const localPoint = world.toLocal({ x, y });
			world.scale.set(newScale);
			const newGlobal = world.toGlobal(localPoint);
			world.x += (x - newGlobal.x);
			world.y += (y - newGlobal.y);
			this.eventBus.emit('ui:zoom:percent', { percentage: Math.round(newScale * 100) });
		});

		// Кнопки зума из UI
		this.eventBus.on('ui:zoom:in', () => {
			const center = { x: this.pixi.app.view.clientWidth / 2, y: this.pixi.app.view.clientHeight / 2 };
			this.eventBus.emit('tool:wheel:zoom', { x: center.x, y: center.y, delta: -120 });
		});
		this.eventBus.on('ui:zoom:out', () => {
			const center = { x: this.pixi.app.view.clientWidth / 2, y: this.pixi.app.view.clientHeight / 2 };
			this.eventBus.emit('tool:wheel:zoom', { x: center.x, y: center.y, delta: 120 });
		});
		this.eventBus.on('ui:zoom:reset', () => {
			const world = this.pixi.worldLayer || this.pixi.app.stage;
			const center = { x: this.pixi.app.view.clientWidth / 2, y: this.pixi.app.view.clientHeight / 2 };
			const globalPoint = center;
			const localPoint = world.toLocal(globalPoint);
			world.scale.set(1);
			const newGlobal = world.toGlobal(localPoint);
			world.x += (globalPoint.x - newGlobal.x);
			world.y += (globalPoint.y - newGlobal.y);
			this.eventBus.emit('ui:zoom:percent', { percentage: 100 });
		});
		this.eventBus.on('ui:zoom:fit', () => {
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
			this.eventBus.emit('ui:zoom:percent', { percentage: Math.round(newScale * 100) });
		});
	}
}


