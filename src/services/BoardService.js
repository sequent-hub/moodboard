import { GridFactory } from '../grid/GridFactory.js';
import { Events } from '../core/events/Events.js';

export class BoardService {
	constructor(eventBus, pixi) {
		this.eventBus = eventBus;
		this.pixi = pixi;
		this.grid = null;
		this._getCanvasSize = null;
	}

	async init(getCanvasSize) {
		this._getCanvasSize = getCanvasSize;
		// Инициализируем сетку (по умолчанию линейная)
		const canvasSize = (this._getCanvasSize?.() || {});
		this.grid = GridFactory.createGrid('line', {
			enabled: true,
			size: 32,
			width: canvasSize.width || 800,
			height: canvasSize.height || 600,
			color: 0x6a6aff,
			opacity: 0.4
		});
		this.grid.updateVisual();
		this.pixi.setGrid(this.grid);
		this.eventBus.emit(Events.UI.GridCurrent, { type: 'line' });

		this._attachEvents();
	}

	_attachEvents() {
		// Смена вида сетки из UI
		this.eventBus.on(Events.UI.GridChange, ({ type }) => {
			const size = this._getCanvasSize?.() || { width: 800, height: 600 };
			if (type === 'off') {
				this.grid?.setEnabled(false);
				this.grid?.updateVisual();
				this.pixi.setGrid(this.grid);
				return;
			}
			const options = {
				...GridFactory.getDefaultOptions(type),
				enabled: true,
				width: size.width,
				height: size.height
			};
			try {
				this.grid = GridFactory.createGrid(type, options);
				this.grid.updateVisual();
				this.pixi.setGrid(this.grid);
				this.eventBus.emit(Events.UI.GridCurrent, { type });
			} catch (e) {
				console.warn('Unknown grid type:', type);
			}
		});

		// Миникарта: данные и управление
		this.eventBus.on(Events.UI.MinimapGetData, (req) => {
			const world = this.pixi.worldLayer || this.pixi.app.stage;
			const viewEl = this.pixi.app.view;
			const objects = (this.pixi?.objects ? Array.from(this.pixi.objects.keys()) : []).map((id) => id);
			req.world = { x: world.x, y: world.y, scale: world.scale?.x || 1 };
			req.view = { width: viewEl.clientWidth, height: viewEl.clientHeight };
			// Прокидываем только метаданные объектов через ядро (сам список формирует Core)
		});
		this.eventBus.on(Events.UI.MinimapCenterOn, ({ worldX, worldY }) => {
			const world = this.pixi.worldLayer || this.pixi.app.stage;
			const viewW = this.pixi.app.view.clientWidth;
			const viewH = this.pixi.app.view.clientHeight;
			const s = world.scale?.x || 1;
			world.x = viewW / 2 - worldX * s;
			world.y = viewH / 2 - worldY * s;
		});
	}

	resize() {
		if (!this.grid) return;
		const size = this._getCanvasSize?.() || { width: 800, height: 600 };
		this.grid.resize(size.width, size.height);
		this.grid.updateVisual();
		this.pixi.setGrid(this.grid);
	}
}


