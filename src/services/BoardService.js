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
		// Сообщаем о текущих данных сетки для сохранения в boardData
		try {
			this.eventBus.emit(Events.Grid.BoardDataChanged, {
				grid: { type: 'line', options: this.grid.serialize ? this.grid.serialize() : {} }
			});
		} catch (_) {}

		this._attachEvents();
	}

	_attachEvents() {
		// Смена вида сетки из UI
		this.eventBus.on(Events.UI.GridChange, ({ type, options: overrideOptions }) => {
			const size = this._getCanvasSize?.() || { width: 800, height: 600 };
			if (type === 'off') {
				this.grid?.setEnabled(false);
				this.grid?.updateVisual();
				this.pixi.setGrid(this.grid);
				// Обновляем сохранённые данные
				try {
					this.eventBus.emit(Events.Grid.BoardDataChanged, {
						grid: { type: 'off', options: this.grid?.serialize ? this.grid.serialize() : {} }
					});
				} catch (_) {}
				return;
			}
			const gridOptions = {
				...GridFactory.getDefaultOptions(type),
				enabled: true,
				width: size.width,
				height: size.height,
				// Перекрываем входящими опциями (если пришли из сохранения)
				...(overrideOptions || {})
			};
			try {
				this.grid = GridFactory.createGrid(type, gridOptions);
				this.grid.updateVisual();
				this.pixi.setGrid(this.grid);
				this.eventBus.emit(Events.UI.GridCurrent, { type });
				// Сообщаем об обновлении данных сетки для сохранения в boardData
				try {
					this.eventBus.emit(Events.Grid.BoardDataChanged, {
						grid: { type, options: this.grid.serialize ? this.grid.serialize() : gridOptions }
					});
				} catch (_) {}
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


