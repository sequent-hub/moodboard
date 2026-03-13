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
		// Не создаём сетку по умолчанию, чтобы избежать визуального переключения.
		// Сетка будет установлена из сохранённых настроек через Events.UI.GridChange.
		this.grid = null;

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
				try {
					this.eventBus.emit(Events.Grid.BoardDataChanged, {
						grid: { type: 'off', options: this.grid?.serialize ? this.grid.serialize() : {} }
					});
				} catch (_) {}
				return;
			}
			this.grid?.destroy?.();
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
				this.pixi.setGrid(this.grid);
				this.refreshGridViewport();
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
		this.eventBus.on(Events.Viewport.Changed, () => this.refreshGridViewport());
		this.eventBus.on(Events.UI.MinimapCenterOn, ({ worldX, worldY }) => {
			const world = this.pixi.worldLayer || this.pixi.app.stage;
			const viewW = this.pixi.app.view.clientWidth;
			const viewH = this.pixi.app.view.clientHeight;
			const s = world.scale?.x || 1;
			world.x = viewW / 2 - worldX * s;
			world.y = viewH / 2 - worldY * s;
			this.refreshGridViewport();
		});
	}

	resize() {
		if (!this.grid) return;
		const size = this._getCanvasSize?.() || { width: 800, height: 600 };
		this.grid.resize(size.width, size.height);
		this.grid.viewportBounds = null;
		this.grid.updateVisual();
		this.pixi.setGrid(this.grid);
	}

	/**
	 * Обновляет screen-grid слой по viewport состоянию.
	 */
	refreshGridViewport() {
		if (!this.grid?.enabled || !this.pixi?.gridLayer) return;
		const view = this.pixi.app?.view;
		if (!view) return;
		const world = this.pixi.worldLayer || this.pixi.app.stage;
		const gl = this.pixi.gridLayer;
		const scale = world.scale?.x ?? 1;

		// Screen-grid всегда рендерится в координатах экрана.
		gl.x = 0;
		gl.y = 0;
		if (gl.scale) {
			gl.scale.set(1);
		}

		if (typeof this.grid.setZoom === 'function') {
			this.grid.setZoom(scale);
		}
		if (typeof this.grid.setViewportTransform === 'function') {
			this.grid.setViewportTransform({
				worldX: world.x || 0,
				worldY: world.y || 0,
				scale,
				viewWidth: view.clientWidth,
				viewHeight: view.clientHeight,
			});
		}

		// Видимая область в screen-координатах.
		const pad = 32;
		const left = -pad;
		const top = -pad;
		const right = view.clientWidth + pad;
		const bottom = view.clientHeight + pad;
		this.grid.setVisibleBounds(left, top, right, bottom);
	}
}


