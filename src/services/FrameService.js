import { Events } from '../core/events/Events.js';

export class FrameService {
	constructor(eventBus, pixi, state) {
		this.eventBus = eventBus;
		this.pixi = pixi;
		this.state = state;
	}

	_forceFramesBelow() {
		const world = this.pixi?.worldLayer || this.pixi?.app?.stage;
		if (world) world.sortableChildren = true;
		let z = 0;
		for (const o of this.state.state.objects || []) {
			const pix = this.pixi.objects.get(o.id);
			if (!pix) continue;
			if (o.type === 'frame') {
				pix.zIndex = -100000;
			} else {
				pix.zIndex = z++;
			}
		}
	}

	_attachIntersectingObjectsToFrame(frameId) {
		const framePixi = this.pixi.objects.get(frameId);
		if (!framePixi || !framePixi.getBounds) return false;
		const fb = framePixi.getBounds();
		const frameRect = { x: fb.x, y: fb.y, w: fb.width, h: fb.height };
		let changed = false;
		for (const obj of this.state.state.objects || []) {
			if (!obj || obj.id === frameId) continue;
			if (obj.type === 'frame') continue;
			const pix = this.pixi.objects.get(obj.id);
			if (!pix || !pix.getBounds) continue;
			const ob = pix.getBounds();
			const objRect = { x: ob.x, y: ob.y, w: ob.width, h: ob.height };
			// Пересечение прямоугольников (экраные координаты PIXI)
			const intersects = !(objRect.x > frameRect.x + frameRect.w ||
				(objRect.x + objRect.w) < frameRect.x ||
				objRect.y > frameRect.y + frameRect.h ||
				(objRect.y + objRect.h) < frameRect.y);
			if (intersects) {
				obj.properties = obj.properties || {};
				obj.properties.frameId = frameId;
				changed = true;
			}
		}
		return changed;
	}

	attach() {
		if (this._attached) return;
		this._attached = true;

		this._onObjectCreated = ({ objectId, objectData }) => {
			try {
				if (!objectData || objectData.type !== 'frame') return;
				const isArbitrary = (objectData.properties && objectData.properties.lockedAspect === false)
					|| (objectData.properties && objectData.properties.title === 'Произвольный')
					|| (objectData.properties && objectData.properties.isArbitrary === true);
				if (!isArbitrary) return;
				// Используем фактические bounds PIXI для надёжной проверки попадания
				const changed = this._attachIntersectingObjectsToFrame(objectId);
				if (changed) this.state.markDirty();
				// Принудительно держим фреймы под объектами
				this._forceFramesBelow();
				// И оповестим общий менеджер на всякий случай
				this.eventBus.emit(Events.Object.Reordered, { reason: 'attach_arbitrary_frame_children' });
			} catch (_) { /* no-op */ }
		};
		this.eventBus.on(Events.Object.Created, this._onObjectCreated);

		this._onDragStart = (data) => {
			const moved = this.state.state.objects.find(o => o.id === data.object);
			if (moved && moved.type === 'frame') {
				// Серый фон
				this.pixi.setFrameFill(moved.id, moved.width, moved.height, 0xEEEEEE);
				// Cнимок стартовых позиций по центру PIXI
				const fp = this.pixi.objects.get(moved.id);
				this._frameDragFrameStart = { x: fp?.x || 0, y: fp?.y || 0 };
				const attachments = this._getFrameChildren(moved.id);
				this._frameDragChildStart = new Map();
				for (const childId of attachments) {
					const childPixi = this.pixi.objects.get(childId);
					if (childPixi) this._frameDragChildStart.set(childId, { x: childPixi.x, y: childPixi.y });
				}
			}
		};
		this.eventBus.on(Events.Tool.DragStart, this._onDragStart);

		this._onDragUpdate = (data) => {
			const moved = this.state.state.objects.find(o => o.id === data.object);
			if (!moved) return;
			if (moved.type === 'frame') {
				const attachments = this._getFrameChildren(moved.id);
				// ВАЖНО: считаем сдвиг по центру PIXI, чтобы не смешивать центр и левый-верх
				const p = this.pixi.objects.get(moved.id);
				const start = this._frameDragFrameStart || { x: p?.x || 0, y: p?.y || 0 };
				const dx = (p?.x || 0) - start.x;
				const dy = (p?.y || 0) - start.y;
				for (const childId of attachments) {
					let startPos = this._frameDragChildStart?.get(childId);
					const childPixi = this.pixi.objects.get(childId);
					if (!startPos) {
						// Ребёнок мог появиться после начала drag
						if (childPixi) {
							startPos = { x: childPixi.x - dx, y: childPixi.y - dy };
							this._frameDragChildStart = this._frameDragChildStart || new Map();
							this._frameDragChildStart.set(childId, startPos);
						} else {
							continue;
						}
					}
					const newCenterX = startPos.x + dx;
					const newCenterY = startPos.y + dy;
					if (childPixi) { childPixi.x = newCenterX; childPixi.y = newCenterY; }
					const stObj = this.state.state.objects.find(o => o.id === childId);
					if (stObj) {
						const halfW = childPixi ? (childPixi.width || 0) / 2 : 0;
						const halfH = childPixi ? (childPixi.height || 0) / 2 : 0;
						stObj.position.x = newCenterX - halfW;
						stObj.position.y = newCenterY - halfH;
						this.eventBus.emit(Events.Object.TransformUpdated, {
							objectId: childId,
							type: 'position',
							position: { x: stObj.position.x, y: stObj.position.y }
						});
					}
				}
			} else {
				// Hover-эффект: throttle, чтобы не вызывать setFrameFill на каждый кадр
				this._applyHoverThrottled(data.object);
			}
		};
		this.eventBus.on(Events.Tool.DragUpdate, this._onDragUpdate);

		this._onDragEnd = (data) => {
			const movedObj = this.state.state.objects.find(o => o.id === data.object);
			if (!movedObj) return;
			if (movedObj.type === 'frame') {
				this.pixi.setFrameFill(movedObj.id, movedObj.width, movedObj.height, 0xFFFFFF);
			}
			this._recomputeFrameAttachment(movedObj.id);
			this._forceFramesBelow();
			this._frameDragFrameStart = null;
			this._frameDragChildStart = null;
			if (this._frameHoverId) {
				const frames = (this.state.state.objects || []).filter(o => o.type === 'frame');
				const prev = frames.find(fr => fr.id === this._frameHoverId);
				if (prev) this.pixi.setFrameFill(prev.id, prev.width, prev.height, 0xFFFFFF);
			this._frameHoverId = null;
		}
		};
		this.eventBus.on(Events.Tool.DragEnd, this._onDragEnd);
	}

	detach() {
		if (!this._attached) return;
		this._attached = false;
		if (this._hoverRafId != null) {
			cancelAnimationFrame(this._hoverRafId);
			this._hoverRafId = null;
		}
		this._hoverRafScheduled = false;
		this._hoverPendingObjectId = null;
		if (this._onObjectCreated) this.eventBus.off(Events.Object.Created, this._onObjectCreated);
		if (this._onDragStart) this.eventBus.off(Events.Tool.DragStart, this._onDragStart);
		if (this._onDragUpdate) this.eventBus.off(Events.Tool.DragUpdate, this._onDragUpdate);
		if (this._onDragEnd) this.eventBus.off(Events.Tool.DragEnd, this._onDragEnd);
		this._onObjectCreated = null;
		this._onDragStart = null;
		this._onDragUpdate = null;
		this._onDragEnd = null;
		this._frameDragFrameStart = null;
		this._frameDragChildStart = null;
		this._frameHoverId = null;
	}

	_getFrameChildren(frameId) {
		const res = [];
		for (const o of this.state.state.objects || []) {
			if (o.id === frameId) continue;
			if (o.properties && o.properties.frameId === frameId) res.push(o.id);
		}
		return res;
	}

	_applyHoverThrottled(movedObjectId) {
		if (this._hoverRafScheduled) return;
		this._hoverRafScheduled = true;
		this._hoverPendingObjectId = movedObjectId;
		this._hoverRafId = requestAnimationFrame(() => {
			this._hoverRafScheduled = false;
			this._hoverRafId = null;
			const oid = this._hoverPendingObjectId;
			this._hoverPendingObjectId = null;
			if (!oid) return;
			const moved = this.state.state.objects.find(o => o.id === oid);
			if (!moved || moved.type === 'frame') return;
			const centerX = moved.position.x + (moved.width || 0) / 2;
			const centerY = moved.position.y + (moved.height || 0) / 2;
			const frames = (this.state.state.objects || []).filter(o => o.type === 'frame');
			const ordered = frames.slice().sort((a, b) => {
				const pa = this.pixi.objects.get(a.id);
				const pb = this.pixi.objects.get(b.id);
				return (pb?.zIndex || 0) - (pa?.zIndex || 0);
			});
			let hoverId = null;
			for (const f of ordered) {
				const rect = { x: f.position.x, y: f.position.y, w: f.width || 0, h: f.height || 0 };
				if (centerX >= rect.x && centerX <= rect.x + rect.w && centerY >= rect.y && centerY <= rect.y + rect.h) {
					hoverId = f.id; break;
				}
			}
			if (hoverId !== this._frameHoverId) {
				if (this._frameHoverId) {
					const prev = frames.find(fr => fr.id === this._frameHoverId);
					if (prev) this.pixi.setFrameFill(prev.id, prev.width, prev.height, 0xFFFFFF);
				}
				if (hoverId) {
					const cur = frames.find(fr => fr.id === hoverId);
					if (cur) this.pixi.setFrameFill(cur.id, cur.width, cur.height, 0xEEEEEE);
				}
				this._frameHoverId = hoverId || null;
			}
		});
	}

	_recomputeFrameAttachment(objectId) {
		const obj = (this.state.state.objects || []).find(o => o.id === objectId);
		if (!obj) return;
		if (obj.type === 'frame') return;
		const center = {
			x: obj.position.x + (obj.width || 0) / 2,
			y: obj.position.y + (obj.height || 0) / 2
		};
		const frames = (this.state.state.objects || []).filter(o => o.type === 'frame');
		const ordered = frames.slice().sort((a, b) => {
			const pa = this.pixi.objects.get(a.id);
			const pb = this.pixi.objects.get(b.id);
			return (pb?.zIndex || 0) - (pa?.zIndex || 0);
		});
		let newFrameId = null;
		for (const f of ordered) {
			const rect = { x: f.position.x, y: f.position.y, w: f.width || 0, h: f.height || 0 };
			if (center.x >= rect.x && center.x <= rect.x + rect.w && center.y >= rect.y && center.y <= rect.y + rect.h) {
				newFrameId = f.id; break;
			}
		}
		const prevFrameId = obj.properties?.frameId || null;
		if (newFrameId !== prevFrameId) {
			obj.properties = obj.properties || {};
			obj.properties.frameId = newFrameId || undefined;
			this.state.markDirty();
			this._forceFramesBelow();
			this.eventBus.emit(Events.Object.Reordered, { reason: 'recompute_frame_attachment' });
		}
	}
}


