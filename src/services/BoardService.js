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
			if (this.pixi.gridLayer) {
				this.pixi.gridLayer.x = world.x;
				this.pixi.gridLayer.y = world.y;
			}
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
	 * Синхронизирует gridLayer с world (позиция + масштаб) и перерисовывает сетку.
	 */
	refreshGridViewport() {
		if (!this.grid?.enabled || !this.pixi?.gridLayer) return;
		const view = this.pixi.app?.view;
		if (!view) return;
		const world = this.pixi.worldLayer || this.pixi.app.stage;
		const gl = this.pixi.gridLayer;
		const scale = world.scale?.x ?? 1;

		// Синхронизация gridLayer с world — сетка зуммируется вместе с доской
		gl.x = world.x;
		gl.y = world.y;
		if (gl.scale) {
			gl.scale.set(scale);
		}

		// DotGrid: передаём zoom до setVisibleBounds (чтобы createVisual видел актуальный zoom)
		if (this.grid.type === 'dot' && typeof this.grid.setZoom === 'function') {
			this.grid.setZoom(scale);
		}

		// Видимая область в мировых координатах (с учётом scale)
		const gridSize = this.grid._getEffectiveSize?.() ?? this.grid.size;
		const pad = Math.max(100, (gridSize || 20) * 4);
		const left = (-gl.x - pad) / scale;
		const top = (-gl.y - pad) / scale;
		const right = (view.clientWidth - gl.x + pad) / scale;
		const bottom = (view.clientHeight - gl.y + pad) / scale;
		this.grid.setVisibleBounds(left, top, right, bottom);
	}
}


