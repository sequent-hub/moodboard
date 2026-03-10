import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoreMoodBoard } from '../../src/core/index.js';
import { setupTransformFlow } from '../../src/core/flows/TransformFlow.js';
import { Events } from '../../src/core/events/Events.js';
import { HtmlHandlesLayer } from '../../src/ui/HtmlHandlesLayer.js';

// Тестовая геометрия ручек повторяет пользовательское взаимодействие:
// реальная точка захвата находится на уже повернутой рамке, а не в осевых координатах.
function rotatePoint(point, center, angleDeg) {
    const angleRad = angleDeg * Math.PI / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    return {
        x: center.x + dx * cos - dy * sin,
        y: center.y + dx * sin + dy * cos,
    };
}

// Возвращаем экранную координату угла рамки с учетом ее текущего CSS-rotation.
// Это позволяет моделировать drag так, как его делает пользователь мышью.
function getBoxCornerPoint(box, handleType) {
    const left = parseFloat(box.style.left);
    const top = parseFloat(box.style.top);
    const width = parseFloat(box.style.width);
    const height = parseFloat(box.style.height);
    const transform = box.style.transform || '';
    const match = transform.match(/rotate\(([-0-9.]+)deg\)/);
    const rotation = match ? Number.parseFloat(match[1]) || 0 : 0;
    const center = { x: left + width / 2, y: top + height / 2 };
    const localPoint = {
        x: handleType.includes('w') ? left : handleType.includes('e') ? left + width : left + width / 2,
        y: handleType.includes('n') ? top : handleType.includes('s') ? top + height : top + height / 2,
    };
    return rotatePoint(localPoint, center, rotation);
}

// Снимок текущей геометрии объектов нужен, чтобы проверять не только рамку,
// но и отсутствие скачка у самих объектов внутри группы.
function snapshotObjects(core) {
    return core.state.state.objects.map((object) => ({
        id: object.id,
        position: { ...object.position },
        width: object.width,
        height: object.height,
    }));
}

// Быстрый helper для приведения двух объектов к одному и тому же
// исходному сценарию "группа уже повернута". Это уменьшает шум в кейсах
// и делает смысл каждого теста проще для чтения.
function resetToRotatedGroup(ctx) {
    ctx.core.state.state.objects[0].position = { x: 10, y: 20 };
    ctx.core.state.state.objects[0].width = 100;
    ctx.core.state.state.objects[0].height = 60;
    ctx.core.state.state.objects[0].transform.rotation = 0;
    ctx.core.state.state.objects[1].position = { x: 160, y: 40 };
    ctx.core.state.state.objects[1].width = 80;
    ctx.core.state.state.objects[1].height = 50;
    ctx.core.state.state.objects[1].transform.rotation = 0;
    ctx.core.pixi.objects.get('obj-a').x = 60;
    ctx.core.pixi.objects.get('obj-a').y = 50;
    ctx.core.pixi.objects.get('obj-a').width = 100;
    ctx.core.pixi.objects.get('obj-a').height = 60;
    ctx.core.pixi.objects.get('obj-a').rotation = 0;
    ctx.core.pixi.objects.get('obj-b').x = 200;
    ctx.core.pixi.objects.get('obj-b').y = 65;
    ctx.core.pixi.objects.get('obj-b').width = 80;
    ctx.core.pixi.objects.get('obj-b').height = 50;
    ctx.core.pixi.objects.get('obj-b').rotation = 0;

    ctx.core.eventBus.emit(Events.Tool.SelectionAdd, { tool: 'select', object: 'obj-a' });
    ctx.core.eventBus.emit(Events.Tool.GroupRotateStart, {
        objects: ['obj-a', 'obj-b'],
        center: { x: 125, y: 55 },
    });
    ctx.core.eventBus.emit(Events.Tool.GroupRotateUpdate, {
        objects: ['obj-a', 'obj-b'],
        angle: 20,
    });
    ctx.core.eventBus.emit(Events.Tool.GroupRotateEnd, {
        objects: ['obj-a', 'obj-b'],
    });
}

// Изолированный EventBus для UI-level жестов resize/rotate.
function createEventBus() {
    const handlers = new Map();
    return {
        on: vi.fn((event, handler) => {
            if (!handlers.has(event)) handlers.set(event, new Set());
            handlers.get(event).add(handler);
        }),
        off: vi.fn((event, handler) => {
            const set = handlers.get(event);
            if (!set) return;
            set.delete(handler);
            if (set.size === 0) handlers.delete(event);
        }),
        emit: vi.fn((event, payload) => {
            const set = handlers.get(event);
            if (!set) return;
            for (const handler of set) handler(payload);
        }),
    };
}

// Контекст для тестов повторного группового resize.
// Здесь нам важно не полное приложение, а воспроизводимая связка:
// HTML-рамка -> eventBus -> TransformFlow -> state/pixi.
function createResizePipelineContext() {
    const eventBus = createEventBus();
    const container = document.createElement('div');
    document.body.appendChild(container);
    container.getBoundingClientRect = () => ({
        left: 0, top: 0, width: 1200, height: 800, right: 1200, bottom: 800,
    });

    const view = document.createElement('canvas');
    view.getBoundingClientRect = () => ({
        left: 0, top: 0, width: 1200, height: 800, right: 1200, bottom: 800,
    });

    const world = {
        x: 0,
        y: 0,
        scale: { x: 1, y: 1 },
        toGlobal(point) {
            return {
                x: (point.x * this.scale.x) + this.x,
                y: (point.y * this.scale.y) + this.y,
            };
        },
        toLocal(point) {
            return {
                x: (point.x - this.x) / this.scale.x,
                y: (point.y - this.y) / this.scale.y,
            };
        },
    };

    const objects = [
        {
            id: 'obj-a',
            type: 'note',
            position: { x: 10, y: 20 },
            width: 100,
            height: 60,
            properties: {},
            transform: { rotation: 0 },
        },
        {
            id: 'obj-b',
            type: 'note',
            position: { x: 160, y: 40 },
            width: 80,
            height: 50,
            properties: {},
            transform: { rotation: 0 },
        },
    ];

    const state = {
        state: { objects, board: {}, selectedObjects: [], isDirty: false },
        getObjects: vi.fn(() => state.state.objects),
        markDirty: vi.fn(() => {
            state.state.isDirty = true;
        }),
    };

    const pixiObjects = new Map();
    for (const obj of objects) {
        pixiObjects.set(obj.id, {
            id: obj.id,
            _mb: { type: obj.type },
            width: obj.width,
            height: obj.height,
            x: obj.position.x + obj.width / 2,
            y: obj.position.y + obj.height / 2,
            rotation: 0,
            getBounds() {
                return {
                    x: this.x - this.width / 2,
                    y: this.y - this.height / 2,
                    width: this.width,
                    height: this.height,
                };
            },
        });
    }

    const core = {
        eventBus,
        state,
        history: { executeCommand: vi.fn() },
        pixi: {
            app: {
                view,
                stage: world,
                renderer: { resolution: 1 },
            },
            worldLayer: world,
            objects: pixiObjects,
            updateObjectRotation: vi.fn(),
            updateObjectSize: vi.fn((objectId, size) => {
                const pixiObject = pixiObjects.get(objectId);
                if (!pixiObject) return;
                pixiObject.width = size.width;
                pixiObject.height = size.height;
            }),
        },
        selectTool: {
            selectedObjects: new Set(),
            selection: new Set(),
            updateResizeHandles: vi.fn(),
        },
        resizeStartSize: null,
        dragStartPosition: null,
        _activeResize: null,
        _groupResizeSnapshot: null,
        _groupResizeStart: null,
        _groupRotateStart: null,
        _groupRotateCenter: null,
    };

    core.updateObjectPositionDirect = CoreMoodBoard.prototype.updateObjectPositionDirect.bind(core);
    core.updateObjectRotationDirect = CoreMoodBoard.prototype.updateObjectRotationDirect.bind(core);
    core.updateObjectSizeAndPositionDirect = CoreMoodBoard.prototype.updateObjectSizeAndPositionDirect.bind(core);

    eventBus.on(Events.Tool.GetSelection, (payload) => {
        payload.selection = Array.from(core.selectTool.selectedObjects);
    });
    eventBus.on(Events.Tool.GetObjectRotation, (payload) => {
        const object = state.state.objects.find((item) => item.id === payload.objectId);
        payload.rotation = object?.transform?.rotation || 0;
    });
    eventBus.on(Events.Tool.GetObjectPixi, (payload) => {
        payload.pixiObject = core.pixi.objects.get(payload.objectId) || null;
    });
    eventBus.on(Events.Tool.GetObjectPosition, (payload) => {
        const object = state.state.objects.find((item) => item.id === payload.objectId);
        payload.position = object ? { ...object.position } : null;
    });
    eventBus.on(Events.Tool.GetObjectSize, (payload) => {
        const object = state.state.objects.find((item) => item.id === payload.objectId);
        payload.size = object ? { width: object.width, height: object.height } : null;
    });

    return {
        container,
        core,
        cleanup() {
            container.remove();
        },
    };
}

describe('HtmlHandlesLayer group resize repeat gesture', () => {
    let ctx;
    let layer;
    let listeners;
    let addSpy;
    let removeSpy;

    beforeEach(() => {
        listeners = {};
        addSpy = vi.spyOn(document, 'addEventListener').mockImplementation((name, handler) => {
            listeners[name] = handler;
        });
        removeSpy = vi.spyOn(document, 'removeEventListener').mockImplementation(() => {});

        ctx = createResizePipelineContext();
        setupTransformFlow(ctx.core);
        layer = new HtmlHandlesLayer(ctx.container, ctx.core.eventBus, ctx.core);
        layer.attach();

        ctx.core.selectTool.selectedObjects.add('obj-a');
        ctx.core.selectTool.selectedObjects.add('obj-b');
        ctx.core.selectTool.selection.add('obj-a');
        ctx.core.selectTool.selection.add('obj-b');
        ctx.core.eventBus.emit(Events.Tool.SelectionAdd, { tool: 'select', object: 'obj-a' });
    });

    afterEach(() => {
        addSpy.mockRestore();
        removeSpy.mockRestore();
        layer?.destroy();
        ctx?.cleanup();
        vi.restoreAllMocks();
    });

    it('continues group resize smoothly on repeated handle grabs', () => {
        // Базовый regression: второй жест resize должен стартовать
        // от уже обновленной рамки, а не прыгать к старой геометрии группы.
        const startEvents = [];
        const originalEmit = ctx.core.eventBus.emit;
        ctx.core.eventBus.emit = vi.fn((event, payload) => {
            if (event === Events.Tool.GroupResizeStart) {
                startEvents.push(structuredClone(payload));
            }
            return originalEmit(event, payload);
        });

        let box = ctx.container.querySelector('.mb-handles-box');
        let handle = box.querySelector('[data-dir="se"]');
        layer._onHandleDown({
            currentTarget: handle,
            clientX: 240,
            clientY: 90,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        }, box);

        listeners.mousemove({ clientX: 290, clientY: 110 });
        listeners.mouseup();

        box = ctx.container.querySelector('.mb-handles-box');
        const firstWidth = parseFloat(box.style.width);
        const firstHeight = parseFloat(box.style.height);
        expect(firstWidth).toBeCloseTo(280, 0);
        expect(firstHeight).toBeCloseTo(90, 0);

        handle = box.querySelector('[data-dir="se"]');
        layer._onHandleDown({
            currentTarget: handle,
            clientX: 290,
            clientY: 110,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        }, box);

        listeners.mousemove({ clientX: 310, clientY: 120 });

        const secondBox = ctx.container.querySelector('.mb-handles-box');
        const secondWidth = parseFloat(secondBox.style.width);
        const secondHeight = parseFloat(secondBox.style.height);

        expect(startEvents).toHaveLength(2);
        expect(startEvents[0].startBounds).toEqual(expect.objectContaining({
            x: 10,
            y: 20,
            width: 230,
            height: 70,
        }));
        expect(startEvents[1].startBounds.x).toBeCloseTo(10, 5);
        expect(startEvents[1].startBounds.y).toBeCloseTo(20, 5);
        expect(startEvents[1].startBounds.width).toBeCloseTo(firstWidth, 5);
        expect(startEvents[1].startBounds.height).toBeCloseTo(firstHeight, 5);

        expect(secondWidth).toBeCloseTo(firstWidth + 20, 0);
        expect(secondHeight).toBeCloseTo(firstHeight + 10, 0);
    });

    it('keeps aspect ratio for an unrotated group when shift is held on a corner handle', () => {
        const box = ctx.container.querySelector('.mb-handles-box');
        const startRatio = parseFloat(box.style.width) / parseFloat(box.style.height);
        const handle = box.querySelector('[data-dir="se"]');

        layer._onHandleDown({
            currentTarget: handle,
            clientX: 240,
            clientY: 90,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        }, box);

        listeners.mousemove({
            clientX: 300,
            clientY: 100,
            shiftKey: true,
        });

        const resizedBox = ctx.container.querySelector('.mb-handles-box');
        const ratioAfter = parseFloat(resizedBox.style.width) / parseFloat(resizedBox.style.height);
        expect(ratioAfter).toBeCloseTo(startRatio, 2);
    });

    it('keeps aspect ratio for an unrotated group when shift is held on an edge handle', () => {
        const box = ctx.container.querySelector('.mb-handles-box');
        const startRatio = parseFloat(box.style.width) / parseFloat(box.style.height);
        const handle = box.querySelector('[data-edge="right"]');

        layer._onEdgeResizeDown({
            currentTarget: handle,
            clientX: 240,
            clientY: 55,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        });

        listeners.mousemove({
            clientX: 300,
            clientY: 55,
            shiftKey: true,
        });

        const resizedBox = ctx.container.querySelector('.mb-handles-box');
        const ratioAfter = parseFloat(resizedBox.style.width) / parseFloat(resizedBox.style.height);
        expect(ratioAfter).toBeCloseTo(startRatio, 2);
    });

    it('keeps rotated group frame angle during resize after rotation', () => {
        // Страхуем переход rotate -> resize:
        // рамка не должна выпрямляться в момент, когда пользователь
        // начинает тянуть угловую ручку уже повернутой группы.
        ctx.core.eventBus.emit(Events.Tool.GroupRotateStart, {
            objects: ['obj-a', 'obj-b'],
            center: { x: 125, y: 55 },
        });
        ctx.core.eventBus.emit(Events.Tool.GroupRotateUpdate, {
            objects: ['obj-a', 'obj-b'],
            angle: 20,
        });
        ctx.core.eventBus.emit(Events.Tool.GroupRotateEnd, {
            objects: ['obj-a', 'obj-b'],
        });

        let box = ctx.container.querySelector('.mb-handles-box');
        expect(box.style.transform).toBe('rotate(20deg)');

        const handle = box.querySelector('[data-dir="se"]');
        layer._onHandleDown({
            currentTarget: handle,
            clientX: 240,
            clientY: 90,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        }, box);

        listeners.mousemove({ clientX: 255, clientY: 100 });

        box = ctx.container.querySelector('.mb-handles-box');
        expect(box.style.transform).toBe('rotate(20deg)');
    });

    it('keeps group resize proportional while shift is pressed after rotation', () => {
        // Пропорции должны фиксироваться и у повернутой группы,
        // а не только у обычного осевого прямоугольника.
        ctx.core.eventBus.emit(Events.Tool.GroupRotateStart, {
            objects: ['obj-a', 'obj-b'],
            center: { x: 125, y: 55 },
        });
        ctx.core.eventBus.emit(Events.Tool.GroupRotateUpdate, {
            objects: ['obj-a', 'obj-b'],
            angle: 20,
        });
        ctx.core.eventBus.emit(Events.Tool.GroupRotateEnd, {
            objects: ['obj-a', 'obj-b'],
        });

        let box = ctx.container.querySelector('.mb-handles-box');
        const startRatio = parseFloat(box.style.width) / parseFloat(box.style.height);
        const handle = box.querySelector('[data-dir="se"]');
        layer._onHandleDown({
            currentTarget: handle,
            clientX: 240,
            clientY: 90,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        }, box);

        listeners.mousemove({
            clientX: 300,
            clientY: 95,
            shiftKey: true,
        });

        box = ctx.container.querySelector('.mb-handles-box');
        const ratioAfter = parseFloat(box.style.width) / parseFloat(box.style.height);
        expect(ratioAfter).toBeCloseTo(startRatio, 2);
        expect(box.style.transform).toBe('rotate(20deg)');
    });

    it('continues proportional group resize smoothly on repeated handle grabs with shift', () => {
        // Повторный жест с уже включенным Shift не должен сбрасывать
        // ни базу пропорций, ни текущий угол рамки.
        ctx.core.eventBus.emit(Events.Tool.GroupRotateStart, {
            objects: ['obj-a', 'obj-b'],
            center: { x: 125, y: 55 },
        });
        ctx.core.eventBus.emit(Events.Tool.GroupRotateUpdate, {
            objects: ['obj-a', 'obj-b'],
            angle: 20,
        });
        ctx.core.eventBus.emit(Events.Tool.GroupRotateEnd, {
            objects: ['obj-a', 'obj-b'],
        });

        let box = ctx.container.querySelector('.mb-handles-box');
        const startRatio = parseFloat(box.style.width) / parseFloat(box.style.height);
        let handle = box.querySelector('[data-dir="se"]');
        layer._onHandleDown({
            currentTarget: handle,
            clientX: 240,
            clientY: 90,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        }, box);

        listeners.mousemove({
            clientX: 300,
            clientY: 95,
            shiftKey: true,
        });
        listeners.mouseup();

        box = ctx.container.querySelector('.mb-handles-box');
        const firstWidth = parseFloat(box.style.width);
        const firstHeight = parseFloat(box.style.height);
        expect(firstWidth / firstHeight).toBeCloseTo(startRatio, 2);

        handle = box.querySelector('[data-dir="se"]');
        const startPoint = getBoxCornerPoint(box, 'se');
        layer._onHandleDown({
            currentTarget: handle,
            clientX: startPoint.x,
            clientY: startPoint.y,
            shiftKey: true,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        }, box);

        const endPoint = getBoxCornerPoint(box, 'se');
        listeners.mousemove({
            clientX: endPoint.x + 20,
            clientY: endPoint.y + 10,
            shiftKey: true,
        });

        box = ctx.container.querySelector('.mb-handles-box');
        const secondWidth = parseFloat(box.style.width);
        const secondHeight = parseFloat(box.style.height);
        expect(secondWidth).toBeGreaterThan(firstWidth);
        expect(secondHeight).toBeGreaterThan(firstHeight);
        expect(secondWidth).toBeLessThan(firstWidth + 80);
        expect(secondHeight).toBeLessThan(firstHeight + 30);
        expect(secondWidth / secondHeight).toBeCloseTo(startRatio, 2);
        expect(box.style.transform).toBe('rotate(20deg)');
    });

    it('does not jump when shift proportional resize starts from inside a rotated corner handle', () => {
        // Пользователь почти никогда не попадает мышью в "идеальную"
        // математическую вершину угла. Этот тест страхует реальный UX:
        // захват внутри самой ручки не должен порождать скачок.
        resetToRotatedGroup(ctx);

        let box = ctx.container.querySelector('.mb-handles-box');
        const beforeBox = {
            left: parseFloat(box.style.left),
            top: parseFloat(box.style.top),
            width: parseFloat(box.style.width),
            height: parseFloat(box.style.height),
        };
        const startRatio = beforeBox.width / beforeBox.height;
        const handle = box.querySelector('[data-dir="se"]');
        const cornerPoint = getBoxCornerPoint(box, 'se');
        const grabPoint = {
            x: cornerPoint.x - 5,
            y: cornerPoint.y - 4,
        };

        layer._onHandleDown({
            currentTarget: handle,
            clientX: grabPoint.x,
            clientY: grabPoint.y,
            shiftKey: true,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        }, box);

        listeners.mousemove({
            clientX: grabPoint.x + 6,
            clientY: grabPoint.y + 4,
            shiftKey: true,
        });

        box = ctx.container.querySelector('.mb-handles-box');
        const afterBox = {
            left: parseFloat(box.style.left),
            top: parseFloat(box.style.top),
            width: parseFloat(box.style.width),
            height: parseFloat(box.style.height),
        };

        expect(Math.abs(afterBox.left - beforeBox.left)).toBeLessThan(20);
        expect(Math.abs(afterBox.top - beforeBox.top)).toBeLessThan(20);
        expect(Math.abs(afterBox.width - beforeBox.width)).toBeLessThan(20);
        expect(Math.abs(afterBox.height - beforeBox.height)).toBeLessThan(20);
        expect(afterBox.width / afterBox.height).toBeCloseTo(startRatio, 1);
        expect(box.style.transform).toBe('rotate(20deg)');
    });

    it('enables proportional resize smoothly when shift is pressed during an active rotated group resize', () => {
        // Включение Shift посреди активного drag - отдельный режимный переход.
        // В этот момент нельзя допускать скачка: сначала происходит rebase,
        // а уже следующее движение должно продолжить resize плавно.
        ctx.core.eventBus.emit(Events.Tool.GroupRotateStart, {
            objects: ['obj-a', 'obj-b'],
            center: { x: 125, y: 55 },
        });
        ctx.core.eventBus.emit(Events.Tool.GroupRotateUpdate, {
            objects: ['obj-a', 'obj-b'],
            angle: 20,
        });
        ctx.core.eventBus.emit(Events.Tool.GroupRotateEnd, {
            objects: ['obj-a', 'obj-b'],
        });

        let box = ctx.container.querySelector('.mb-handles-box');
        const startRatio = parseFloat(box.style.width) / parseFloat(box.style.height);
        const handle = box.querySelector('[data-dir="se"]');
        const startPoint = getBoxCornerPoint(box, 'se');
        layer._onHandleDown({
            currentTarget: handle,
            clientX: startPoint.x,
            clientY: startPoint.y,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        }, box);

        listeners.mousemove({
            clientX: startPoint.x + 12,
            clientY: startPoint.y + 4,
            shiftKey: false,
        });

        box = ctx.container.querySelector('.mb-handles-box');
        const beforeShiftWidth = parseFloat(box.style.width);
        const beforeShiftHeight = parseFloat(box.style.height);
        const ratioWhenShiftEnabled = beforeShiftWidth / beforeShiftHeight;

        listeners.mousemove({
            clientX: startPoint.x + 24,
            clientY: startPoint.y + 8,
            shiftKey: true,
        });

        box = ctx.container.querySelector('.mb-handles-box');
        const boxAfterShiftToggle = {
            width: parseFloat(box.style.width),
            height: parseFloat(box.style.height),
        };
        expect(Math.abs(boxAfterShiftToggle.width - beforeShiftWidth)).toBeLessThan(5);
        expect(Math.abs(boxAfterShiftToggle.height - beforeShiftHeight)).toBeLessThan(5);

        listeners.mousemove({
            clientX: startPoint.x + 36,
            clientY: startPoint.y + 12,
            shiftKey: true,
        });

        box = ctx.container.querySelector('.mb-handles-box');
        const afterShiftWidth = parseFloat(box.style.width);
        const afterShiftHeight = parseFloat(box.style.height);
        expect(afterShiftWidth).toBeGreaterThan(beforeShiftWidth);
        expect(afterShiftHeight).toBeGreaterThan(beforeShiftHeight);
        expect(afterShiftWidth).toBeLessThan(beforeShiftWidth + 80);
        expect(afterShiftHeight).toBeLessThan(beforeShiftHeight + 40);
        expect(afterShiftWidth / afterShiftHeight).toBeCloseTo(ratioWhenShiftEnabled, 1);
    });

    it('keeps shift-resize continuous for all rotated corner handles', () => {
        // Один и тот же дефект легко починить только для `se`,
        // но забыть про остальные углы. Поэтому проверяем все 4 ручки
        // маленькими движениями и контролируем непрерывность для рамки и объектов.
        const handles = ['nw', 'ne', 'se', 'sw'];

        for (const handleType of handles) {
            ctx.core.state.state.objects[0].position = { x: 10, y: 20 };
            ctx.core.state.state.objects[0].width = 100;
            ctx.core.state.state.objects[0].height = 60;
            ctx.core.state.state.objects[0].transform.rotation = 0;
            ctx.core.state.state.objects[1].position = { x: 160, y: 40 };
            ctx.core.state.state.objects[1].width = 80;
            ctx.core.state.state.objects[1].height = 50;
            ctx.core.state.state.objects[1].transform.rotation = 0;
            ctx.core.pixi.objects.get('obj-a').x = 60;
            ctx.core.pixi.objects.get('obj-a').y = 50;
            ctx.core.pixi.objects.get('obj-a').width = 100;
            ctx.core.pixi.objects.get('obj-a').height = 60;
            ctx.core.pixi.objects.get('obj-b').x = 200;
            ctx.core.pixi.objects.get('obj-b').y = 65;
            ctx.core.pixi.objects.get('obj-b').width = 80;
            ctx.core.pixi.objects.get('obj-b').height = 50;
            ctx.core.eventBus.emit(Events.Tool.SelectionAdd, { tool: 'select', object: 'obj-a' });
            ctx.core.eventBus.emit(Events.Tool.GroupRotateStart, {
                objects: ['obj-a', 'obj-b'],
                center: { x: 125, y: 55 },
            });
            ctx.core.eventBus.emit(Events.Tool.GroupRotateUpdate, {
                objects: ['obj-a', 'obj-b'],
                angle: 20,
            });
            ctx.core.eventBus.emit(Events.Tool.GroupRotateEnd, {
                objects: ['obj-a', 'obj-b'],
            });

            let box = ctx.container.querySelector('.mb-handles-box');
            const beforeBox = {
                left: parseFloat(box.style.left),
                top: parseFloat(box.style.top),
                width: parseFloat(box.style.width),
                height: parseFloat(box.style.height),
            };
            const beforeObjects = snapshotObjects(ctx.core);
            const handle = box.querySelector(`[data-dir="${handleType}"]`);
            const startPoint = getBoxCornerPoint(box, handleType);
            layer._onHandleDown({
                currentTarget: handle,
                clientX: startPoint.x,
                clientY: startPoint.y,
                preventDefault: vi.fn(),
                stopPropagation: vi.fn(),
            }, box);

            listeners.mousemove({
                clientX: startPoint.x + 2,
                clientY: startPoint.y + 2,
                shiftKey: true,
            });

            box = ctx.container.querySelector('.mb-handles-box');
            const afterBox = {
                left: parseFloat(box.style.left),
                top: parseFloat(box.style.top),
                width: parseFloat(box.style.width),
                height: parseFloat(box.style.height),
            };
            const afterObjects = snapshotObjects(ctx.core);

            expect(Math.abs(afterBox.width - beforeBox.width)).toBeLessThan(20);
            expect(Math.abs(afterBox.height - beforeBox.height)).toBeLessThan(20);
            expect(Math.abs(afterBox.left - beforeBox.left)).toBeLessThan(20);
            expect(Math.abs(afterBox.top - beforeBox.top)).toBeLessThan(20);

            for (const beforeObject of beforeObjects) {
                const afterObject = afterObjects.find((object) => object.id === beforeObject.id);
                expect(Math.abs(afterObject.position.x - beforeObject.position.x)).toBeLessThan(20);
                expect(Math.abs(afterObject.position.y - beforeObject.position.y)).toBeLessThan(20);
                expect(Math.abs(afterObject.width - beforeObject.width)).toBeLessThan(20);
                expect(Math.abs(afterObject.height - beforeObject.height)).toBeLessThan(20);
            }

            listeners.mouseup();
        }
    });

    it('does not produce a large proportional jump across tiny pointer moves at steep rotation', () => {
        // Это regression на реальный баг из чата:
        // при крутом угле поворота и Shift ветка aspect-lock могла
        // резко перескочить на другую "ведущую ось" от микросдвига мыши.
        // Здесь фиксируем, что соседние mousemove меняют размеры постепенно.
        ctx.core.eventBus.emit(Events.Tool.GroupRotateStart, {
            objects: ['obj-a', 'obj-b'],
            center: { x: 125, y: 55 },
        });
        ctx.core.eventBus.emit(Events.Tool.GroupRotateUpdate, {
            objects: ['obj-a', 'obj-b'],
            angle: -60,
        });
        ctx.core.eventBus.emit(Events.Tool.GroupRotateEnd, {
            objects: ['obj-a', 'obj-b'],
        });

        let box = ctx.container.querySelector('.mb-handles-box');
        const handle = box.querySelector('[data-dir="se"]');
        const startPoint = getBoxCornerPoint(box, 'se');
        layer._onHandleDown({
            currentTarget: handle,
            clientX: startPoint.x,
            clientY: startPoint.y,
            shiftKey: true,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        }, box);

        const widths = [];
        const heights = [];
        for (let step = 1; step <= 8; step++) {
            listeners.mousemove({
                clientX: startPoint.x + step * 2,
                clientY: startPoint.y - step,
                shiftKey: true,
            });
            box = ctx.container.querySelector('.mb-handles-box');
            widths.push(parseFloat(box.style.width));
            heights.push(parseFloat(box.style.height));
        }

        for (let i = 1; i < widths.length; i++) {
            expect(Math.abs(widths[i] - widths[i - 1])).toBeLessThan(30);
            expect(Math.abs(heights[i] - heights[i - 1])).toBeLessThan(20);
        }
    });
});
