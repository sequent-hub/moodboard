import { GridFactory } from '../grid/GridFactory.js';
import { Events } from '../core/events/Events.js';
import {
	incrementGridDiagnosticCounter,
	logGridDiagnostic,
} from '../grid/GridDiagnostics.js';

export class BoardService {
	constructor(eventBus, pixi) {
		this.eventBus = eventBus;
		this.pixi = pixi;
		this.grid = null;
		this._getCanvasSize = null;
		this._eventsAttached = false;
		this._handlers = null;
		this._destroyed = false;
	}

	async init(getCanvasSize) {
		if (this._destroyed) {
			this._destroyed = false;
		}
		this._getCanvasSize = getCanvasSize;
		// Не создаём сетку по умолчанию, чтобы избежать визуального переключения.
		// Сетка будет установлена из сохранённых настроек через Events.UI.GridChange.
		this.grid = null;

		this._attachEvents();
	}

	_buildHandlers() {
		const onGridChange = ({ type, options: overrideOptions }) => {
			incrementGridDiagnosticCounter('boardService.gridChange.calls');
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
				logGridDiagnostic('BoardService', 'grid switched off', { hasGrid: !!this.grid });
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
				logGridDiagnostic('BoardService', 'grid switched on', {
					type,
					options: gridOptions,
				});
			} catch (e) {
				console.warn('Unknown grid type:', type);
			}
		};

		const onMinimapGetData = (req) => {
			const world = this.pixi.worldLayer || this.pixi.app.stage;
			const viewEl = this.pixi.app.view;
			req.world = { x: world.x, y: world.y, scale: world.scale?.x || 1 };
			req.view = { width: viewEl.clientWidth, height: viewEl.clientHeight };
			// Прокидываем только метаданные объектов через ядро (сам список формирует Core)
		};

		const onViewportChanged = () => this.refreshGridViewport();
		const onMinimapCenterOn = ({ worldX, worldY }) => {
			const world = this.pixi.worldLayer || this.pixi.app.stage;
			const viewW = this.pixi.app.view.clientWidth;
			const viewH = this.pixi.app.view.clientHeight;
			const s = world.scale?.x || 1;
			world.x = Math.round(viewW / 2 - worldX * s);
			world.y = Math.round(viewH / 2 - worldY * s);
			this.refreshGridViewport();
		};

		return {
			onGridChange,
			onMinimapGetData,
			onViewportChanged,
			onMinimapCenterOn,
		};
	}

	_attachEvents() {
		if (this._eventsAttached) return;
		this._handlers = this._handlers || this._buildHandlers();

		// Смена вида сетки из UI
		this.eventBus.on(Events.UI.GridChange, this._handlers.onGridChange);

		// Миникарта: данные и управление
		this.eventBus.on(Events.UI.MinimapGetData, this._handlers.onMinimapGetData);
		this.eventBus.on(Events.Viewport.Changed, this._handlers.onViewportChanged);
		this.eventBus.on(Events.UI.MinimapCenterOn, this._handlers.onMinimapCenterOn);
		this._eventsAttached = true;
		incrementGridDiagnosticCounter('boardService.lifecycle.attach');
		logGridDiagnostic('BoardService', 'events attached');
	}

	_detachEvents() {
		if (!this._eventsAttached || !this._handlers) return;
		this.eventBus.off(Events.UI.GridChange, this._handlers.onGridChange);
		this.eventBus.off(Events.UI.MinimapGetData, this._handlers.onMinimapGetData);
		this.eventBus.off(Events.Viewport.Changed, this._handlers.onViewportChanged);
		this.eventBus.off(Events.UI.MinimapCenterOn, this._handlers.onMinimapCenterOn);
		this._eventsAttached = false;
		incrementGridDiagnosticCounter('boardService.lifecycle.detach');
		logGridDiagnostic('BoardService', 'events detached');
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
		incrementGridDiagnosticCounter('boardService.refreshGridViewport.calls');
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
		if ((gl.x || 0) !== 0 || (gl.y || 0) !== 0 || (gl.scale?.x || 1) !== 1 || (gl.scale?.y || 1) !== 1) {
			logGridDiagnostic('BoardService', 'gridLayer normalization mismatch', {
				x: gl.x || 0,
				y: gl.y || 0,
				scaleX: gl.scale?.x || 1,
				scaleY: gl.scale?.y || 1,
			});
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
		logGridDiagnostic('BoardService', 'viewport refreshed', {
			gridType: this.grid?.type || 'unknown',
			scale,
			worldX: world.x || 0,
			worldY: world.y || 0,
			bounds: { left, top, right, bottom },
		});
	}

	destroy() {
		if (this._destroyed) return;
		this._destroyed = true;
		this._detachEvents();
		this.grid?.destroy?.();
		this.grid = null;
		if (this.pixi?.setGrid) {
			this.pixi.setGrid(null);
		}
		incrementGridDiagnosticCounter('boardService.lifecycle.destroy');
		logGridDiagnostic('BoardService', 'destroy');
	}
}


