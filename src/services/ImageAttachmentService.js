import { Events } from '../core/events/Events.js';

const IMAGE_TYPES = new Set(['image', 'revit-screenshot-img', 'model3d-screenshot-img']);

function isImageType(type) { return IMAGE_TYPES.has(type); }
function isDrawingType(type) { return type === 'drawing'; }

/**
 * Проверяет, что прямоугольник inner целиком вмещается в outer.
 * Координаты — мировые (top-left + size).
 */
function isFullyContained(inner, outer) {
	return inner.x >= outer.x &&
		inner.y >= outer.y &&
		(inner.x + inner.w) <= (outer.x + outer.w) &&
		(inner.y + inner.h) <= (outer.y + outer.h);
}

function getObjRect(obj) {
	return {
		x: obj.position?.x ?? 0,
		y: obj.position?.y ?? 0,
		w: obj.width ?? 0,
		h: obj.height ?? 0,
	};
}

/**
 * Управляет привязкой drawing-объектов к изображениям.
 *
 * Правила:
 * - Привязка происходит только если drawing целиком внутри изображения.
 * - Фрейм первичен: если у drawing уже есть properties.frameId — imageId не ставим.
 * - Привязанный drawing перемещается вместе с изображением при drag.
 * - При resize изображения пересчитываем, какие drawing остаются внутри.
 */
export class ImageAttachmentService {
	constructor(eventBus, pixi, state) {
		this.eventBus = eventBus;
		this.pixi = pixi;
		this.state = state;
	}

	// ─── Вспомогательные ──────────────────────────────────────────────────────

	/**
	 * Находит id изображения, полностью вмещающего drawing.
	 * Если несколько — берём с наибольшим zIndex PIXI (верхнее).
	 * Если у drawing есть frameId — возвращает null (фрейм первичен).
	 */
	_findHostImage(drawingObj) {
		if (drawingObj.properties?.frameId) return null;

		const dr = getObjRect(drawingObj);
		const images = (this.state.state.objects || []).filter(o => isImageType(o.type));
		const candidates = images.filter(img => isFullyContained(dr, getObjRect(img)));
		if (!candidates.length) return null;

		candidates.sort((a, b) => {
			const pa = this.pixi.objects.get(a.id);
			const pb = this.pixi.objects.get(b.id);
			return (pb?.zIndex ?? 0) - (pa?.zIndex ?? 0);
		});
		return candidates[0].id;
	}

	_getImageChildren(imageId) {
		return (this.state.state.objects || [])
			.filter(o => o.properties?.imageId === imageId)
			.map(o => o.id);
	}

	// ─── Логика пересчёта ─────────────────────────────────────────────────────

	/** Пересчитывает imageId для одного drawing по текущим bounds. */
	_recomputeImageAttachment(objectId) {
		const obj = (this.state.state.objects || []).find(o => o.id === objectId);
		if (!obj || !isDrawingType(obj.type)) return;

		const newImageId = this._findHostImage(obj);
		const prevImageId = obj.properties?.imageId ?? null;
		if (newImageId === prevImageId) return;

		obj.properties = obj.properties || {};
		if (newImageId) {
			obj.properties.imageId = newImageId;
		} else {
			delete obj.properties.imageId;
		}
		this.state.markDirty();
	}

	/** При создании изображения прикрепляет все drawing, оказавшиеся внутри. */
	_attachDrawingsToNewImage(imageId) {
		const imageObj = (this.state.state.objects || []).find(o => o.id === imageId);
		if (!imageObj) return;
		const ir = getObjRect(imageObj);
		let changed = false;

		for (const obj of this.state.state.objects || []) {
			if (!isDrawingType(obj.type)) continue;
			if (obj.properties?.frameId) continue;
			if (obj.properties?.imageId) continue;
			if (isFullyContained(getObjRect(obj), ir)) {
				obj.properties = obj.properties || {};
				obj.properties.imageId = imageId;
				changed = true;
			}
		}
		if (changed) this.state.markDirty();
	}

	/**
	 * Пересчитывает все drawing относительно конкретного изображения.
	 * Вызывается после resize или drag изображения.
	 */
	_recomputeAllForImage(imageId) {
		const imageObj = (this.state.state.objects || []).find(o => o.id === imageId);
		if (!imageObj) return;
		const ir = getObjRect(imageObj);
		let changed = false;

		for (const obj of this.state.state.objects || []) {
			if (!isDrawingType(obj.type)) continue;
			if (obj.properties?.frameId) continue;

			const prevImageId = obj.properties?.imageId ?? null;
			const inside = isFullyContained(getObjRect(obj), ir);
			const attached = prevImageId === imageId;

			if (inside && !attached && !prevImageId) {
				obj.properties = obj.properties || {};
				obj.properties.imageId = imageId;
				changed = true;
			} else if (!inside && attached) {
				delete obj.properties.imageId;
				changed = true;
			}
		}
		if (changed) this.state.markDirty();
	}

	// ─── Lifecycle ────────────────────────────────────────────────────────────

	attach() {
		if (this._attached) return;
		this._attached = true;

		// Создан объект: изображение → прикрепляем вложенные drawing;
		//               drawing → проверяем попадание внутрь изображения.
		this._onObjectCreated = ({ objectId, objectData }) => {
			try {
				if (!objectData) return;
				if (isImageType(objectData.type)) {
					this._attachDrawingsToNewImage(objectId);
				} else if (isDrawingType(objectData.type)) {
					this._recomputeImageAttachment(objectId);
				}
			} catch (_) { /* no-op */ }
		};
		this.eventBus.on(Events.Object.Created, this._onObjectCreated);

		// DragStart изображения — сохраняем начальные позиции (PIXI-центры) детей.
		this._onDragStart = (data) => {
			const moved = (this.state.state.objects || []).find(o => o.id === data.object);
			if (!moved || !isImageType(moved.type)) return;

			const p = this.pixi.objects.get(moved.id);
			this._imgDragImgStart = { x: p?.x ?? 0, y: p?.y ?? 0 };
			this._imgDragChildStart = new Map();
			for (const childId of this._getImageChildren(moved.id)) {
				const cp = this.pixi.objects.get(childId);
				if (cp) this._imgDragChildStart.set(childId, { x: cp.x, y: cp.y });
			}
		};
		this.eventBus.on(Events.Tool.DragStart, this._onDragStart);

		// DragUpdate изображения — тащим привязанные drawing.
		this._onDragUpdate = (data) => {
			const moved = (this.state.state.objects || []).find(o => o.id === data.object);
			if (!moved || !isImageType(moved.type)) return;

			const p = this.pixi.objects.get(moved.id);
			const start = this._imgDragImgStart ?? { x: p?.x ?? 0, y: p?.y ?? 0 };
			const dx = (p?.x ?? 0) - start.x;
			const dy = (p?.y ?? 0) - start.y;

			for (const childId of this._getImageChildren(moved.id)) {
				let startPos = this._imgDragChildStart?.get(childId);
				const cp = this.pixi.objects.get(childId);
				if (!startPos) {
					if (cp) {
						startPos = { x: cp.x - dx, y: cp.y - dy };
						this._imgDragChildStart ??= new Map();
						this._imgDragChildStart.set(childId, startPos);
					} else {
						continue;
					}
				}
				const nx = startPos.x + dx;
				const ny = startPos.y + dy;
				if (cp) { cp.x = nx; cp.y = ny; }
				const stObj = (this.state.state.objects || []).find(o => o.id === childId);
				if (stObj) {
					const hw = cp ? (cp.width ?? 0) / 2 : 0;
					const hh = cp ? (cp.height ?? 0) / 2 : 0;
					stObj.position.x = nx - hw;
					stObj.position.y = ny - hh;
					this.eventBus.emit(Events.Object.TransformUpdated, {
						objectId: childId,
						type: 'position',
						position: { x: stObj.position.x, y: stObj.position.y },
					});
				}
			}
		};
		this.eventBus.on(Events.Tool.DragUpdate, this._onDragUpdate);

		// DragEnd: для drawing — пересчитываем imageId;
		//          для изображения — финализируем drag-state и пересчитываем вложенных.
		this._onDragEnd = (data) => {
			const movedObj = (this.state.state.objects || []).find(o => o.id === data.object);
			if (!movedObj) return;

			if (isDrawingType(movedObj.type)) {
				this._recomputeImageAttachment(movedObj.id);
			} else if (isImageType(movedObj.type)) {
				this._imgDragImgStart = null;
				this._imgDragChildStart = null;
				this._recomputeAllForImage(movedObj.id);
			}
		};
		this.eventBus.on(Events.Tool.DragEnd, this._onDragEnd);

		// ResizeEnd изображения — пересчитываем, какие drawing остаются внутри.
		this._onResizeEnd = (data) => {
			const obj = (this.state.state.objects || []).find(o => o.id === data.object);
			if (!obj || !isImageType(obj.type)) return;
			this._recomputeAllForImage(obj.id);
		};
		this.eventBus.on(Events.Tool.ResizeEnd, this._onResizeEnd);
	}

	detach() {
		if (!this._attached) return;
		this._attached = false;
		if (this._onObjectCreated) this.eventBus.off(Events.Object.Created, this._onObjectCreated);
		if (this._onDragStart) this.eventBus.off(Events.Tool.DragStart, this._onDragStart);
		if (this._onDragUpdate) this.eventBus.off(Events.Tool.DragUpdate, this._onDragUpdate);
		if (this._onDragEnd) this.eventBus.off(Events.Tool.DragEnd, this._onDragEnd);
		if (this._onResizeEnd) this.eventBus.off(Events.Tool.ResizeEnd, this._onResizeEnd);
		this._onObjectCreated = null;
		this._onDragStart = null;
		this._onDragUpdate = null;
		this._onDragEnd = null;
		this._onResizeEnd = null;
		this._imgDragImgStart = null;
		this._imgDragChildStart = null;
	}
}
