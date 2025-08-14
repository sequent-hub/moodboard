import { Events } from '../core/events/Events.js';

export class ZOrderManager {
	constructor(eventBus, pixi, state) {
		this.eventBus = eventBus;
		this.pixi = pixi;
		this.state = state;
	}

	attach() {
		const ensureFramesBottom = () => {
			const arr = this.state.state.objects || [];
			if (arr.length === 0) return;
			const frames = [];
			const others = [];
			for (const o of arr) {
				if (o?.type === 'frame') frames.push(o); else others.push(o);
			}
			const newOrder = [...frames, ...others];
			let changed = false;
			if (newOrder.length === arr.length) {
				for (let i = 0; i < arr.length; i++) {
					if (arr[i] !== newOrder[i]) { changed = true; break; }
				}
			}
			if (!changed) return;
			this.state.state.objects = newOrder;
			const world = this.pixi?.worldLayer || this.pixi?.app?.stage;
			if (world) world.sortableChildren = true;
			let z = 0;
			for (const o of this.state.state.objects || []) {
				const pixi = this.pixi.objects.get(o.id);
				if (!pixi) continue;
				if (o.type === 'frame') {
					pixi.zIndex = -100000;
				} else {
					pixi.zIndex = z++;
				}
			}
			this.state.markDirty();
		};

		this.eventBus.on(Events.Object.Created, () => ensureFramesBottom());
		this.eventBus.on(Events.Object.Deleted, () => ensureFramesBottom());
		this.eventBus.on(Events.Object.Reordered, () => ensureFramesBottom());
		this.eventBus.on(Events.UI.LayerGroupSendToBack, () => ensureFramesBottom());
	}
}


