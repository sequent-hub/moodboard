/**
 * Регрессия: при старте resize/drag/rotate hover-lift должен убивать ЛЮБОЙ
 * активный твин, а не только записи с isHovered=true.
 *
 * Баг: возвратный _onOut-твин имеет isHovered=false, но продолжает писать
 * pixiObject.y/scale каждый кадр. Если _snapBackAll пропускал такие записи,
 * твин конкурировал с resize и фрейм визуально «скакал».
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const tweenKills = [];

vi.mock('gsap', () => {
    const makeTween = () => {
        const t = { progress: () => 0.5, kill: vi.fn(() => { t._killed = true; }), _killed: false };
        tweenKills.push(t);
        return t;
    };
    const gsap = { registerPlugin: vi.fn(), to: vi.fn(() => makeTween()) };
    return { default: gsap, gsap };
});

vi.mock('gsap/CustomEase', () => ({
    CustomEase: { create: vi.fn() },
}));

vi.mock('@pixi/filter-drop-shadow', () => ({
    DropShadowFilter: class {
        constructor() { this.alpha = 0; this.distance = 0; }
        destroy() {}
    },
}));

import { HoverLiftController } from '../../src/ui/animation/HoverLiftController.js';
import { Events } from '../../src/core/events/Events.js';

function createEventBus() {
    const handlers = new Map();
    return {
        on: (e, h) => { if (!handlers.has(e)) handlers.set(e, new Set()); handlers.get(e).add(h); },
        off: (e, h) => { handlers.get(e)?.delete(h); },
        emit: (e, data) => { handlers.get(e)?.forEach(h => h(data)); },
    };
}

function createPixiObject(id, type = 'image') {
    let sx = 1, sy = 1;
    return {
        _mb: { objectId: id, type },
        x: 100,
        y: 200,
        filters: [],
        scale: { get x() { return sx; }, get y() { return sy; }, set(a, b) { sx = a; sy = b ?? a; } },
        on: vi.fn(),
        off: vi.fn(),
    };
}

describe('HoverLiftController — snapBack убивает зависший твин при resize', () => {
    let eb, hl, p;

    beforeEach(() => {
        tweenKills.length = 0;
        eb = createEventBus();
        hl = new HoverLiftController(eb, { stage: { children: [] } });
        p = createPixiObject('img-1', 'image');
        hl.attach(p, { type: 'image', width: 400, height: 240 });
    });

    afterEach(() => { hl.destroy(); });

    it('ResizeStart убивает активный возвратный твин (isHovered=false) и восстанавливает базу', () => {
        const entry = hl._entries.get(p);
        const preset = { liftPx: 4, scaleMul: 1.02 };

        hl._onOver(p, preset, entry);   // наведение: твин #1, isHovered=true
        hl._onOut(p, preset, entry);    // увод: твин #2, isHovered=false, но твин активен
        const lingering = entry.tween;
        expect(lingering).toBeTruthy();
        expect(entry.isHovered).toBe(false);

        // Симулируем смещение y во время твина (как делает gsap onUpdate)
        p.y = 188;

        eb.emit(Events.Tool.ResizeStart, { object: 'img-1', handle: 'se' });

        expect(lingering.kill).toHaveBeenCalled();
        expect(entry.tween).toBeNull();
        expect(p.y).toBe(entry.baseY);     // вернулись к покойному центру
        expect(p.scale.x).toBe(entry.baseScaleX);
    });

    it('DragStart также убивает зависший твин', () => {
        const entry = hl._entries.get(p);
        const preset = { liftPx: 4, scaleMul: 1.02 };
        hl._onOver(p, preset, entry);
        hl._onOut(p, preset, entry);
        const lingering = entry.tween;

        eb.emit(Events.Tool.DragStart, { object: 'img-1' });

        expect(lingering.kill).toHaveBeenCalled();
        expect(entry.tween).toBeNull();
    });
});

describe('HoverLiftController — фрейм без hover-«pop»', () => {
    let eb, hl;

    beforeEach(() => {
        tweenKills.length = 0;
        eb = createEventBus();
        hl = new HoverLiftController(eb, { stage: { children: [] } });
    });

    afterEach(() => { hl.destroy(); });

    it('фрейм получает hover-lift (pointerover/pointerout) и статичную тень', () => {
        const frame = createPixiObject('frame-1', 'frame');
        hl.attach(frame, { type: 'frame', width: 400, height: 240 });

        const overCalls = frame.on.mock.calls.filter(c => c[0] === 'pointerover');
        const outCalls = frame.on.mock.calls.filter(c => c[0] === 'pointerout');
        expect(overCalls.length).toBe(1);
        expect(outCalls.length).toBe(1);

        const entry = hl._entries.get(frame);
        expect(entry).toBeTruthy();
        expect(entry._onOver).toBeTypeOf('function');
        expect(entry.shadow).toBeTruthy();
    });

    it('фрейм, как и image, снапбэкает зависший твин при ResizeStart', () => {
        const frame = createPixiObject('frame-2', 'frame');
        hl.attach(frame, { type: 'frame', width: 400, height: 240 });
        const entry = hl._entries.get(frame);
        const preset = { liftPx: 4, scaleMul: 1.02 };

        hl._onOver(frame, preset, entry);
        hl._onOut(frame, preset, entry);
        const lingering = entry.tween;
        expect(lingering).toBeTruthy();

        eb.emit(Events.Tool.ResizeStart, { object: 'frame-2', handle: 'se' });

        expect(lingering.kill).toHaveBeenCalled();
        expect(entry.tween).toBeNull();
        expect(frame.y).toBe(entry.baseY);
    });

    it('обычный объект (image) hover-обработчики получает', () => {
        const img = createPixiObject('img-2', 'image');
        hl.attach(img, { type: 'image', width: 300, height: 200 });
        const overCalls = img.on.mock.calls.filter(c => c[0] === 'pointerover');
        expect(overCalls.length).toBe(1);
    });
});
