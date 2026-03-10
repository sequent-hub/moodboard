import { describe, it, expect, vi } from 'vitest';
import { CoreMoodBoard } from '../../src/core/index.js';
import { Events } from '../../src/core/events/Events.js';
import { createCoreBaselineContext } from './CoreIndex.baseline.helpers.js';

// Подготовка контекста для transform-flow:
// подключаем реальные обработчики setupToolEvents и "direct"-методы,
// чтобы тесты проверяли не отдельные команды в вакууме, а реальный поток
// Resize/Rotate, которым пользуется приложение.
function prepareTransformContext(objects = null) {
    const ctx = createCoreBaselineContext({
        objects: objects || [
            {
                id: 'obj-transform-1',
                type: 'note',
                position: { x: 10, y: 20 },
                width: 100,
                height: 60,
                properties: {},
                transform: { rotation: 0 },
            },
        ],
    });

    ctx.updateObjectPositionDirect = CoreMoodBoard.prototype.updateObjectPositionDirect.bind(ctx);
    ctx.updateObjectRotationDirect = CoreMoodBoard.prototype.updateObjectRotationDirect.bind(ctx);
    ctx.updateObjectSizeAndPositionDirect = CoreMoodBoard.prototype.updateObjectSizeAndPositionDirect.bind(ctx);
    CoreMoodBoard.prototype.setupToolEvents.call(ctx);

    return ctx;
}

describe('Core index baseline: transform contracts', () => {
    it('ResizeStart -> ResizeUpdate updates size in state and PIXI, ResizeEnd creates history command on real change', () => {
        const ctx = prepareTransformContext();

        // Старт resize фиксирует начальные значения (контекст ручки/размера),
        // которые потом используются в ResizeEnd для построения команды.
        ctx.eventBus.emit(Events.Tool.ResizeStart, {
            object: 'obj-transform-1',
            handle: 'se',
        });
        // Update обязан сразу отражаться визуально и в состоянии:
        // это важно для интерактивности и корректного последующего commit в history.
        ctx.eventBus.emit(Events.Tool.ResizeUpdate, {
            object: 'obj-transform-1',
            size: { width: 160, height: 90 },
            position: { x: 40, y: 50 },
        });

        const stateObj = ctx.state.state.objects.find((obj) => obj.id === 'obj-transform-1');
        const pixiObj = ctx.pixi.objects.get('obj-transform-1');

        // Проверяем двойной контракт координат:
        // state хранит top-left, PIXI хранит center.
        expect(stateObj.width).toBe(160);
        expect(stateObj.height).toBe(90);
        expect(stateObj.position).toEqual({ x: 40, y: 50 });
        expect(pixiObj.width).toBe(160);
        expect(pixiObj.height).toBe(90);
        expect(pixiObj.x).toBe(40 + 160 / 2);
        expect(pixiObj.y).toBe(50 + 90 / 2);

        // На end ожидаем создание команды в истории только как итог resize-жеста.
        ctx.history.executeCommand.mockClear();
        ctx.eventBus.emit(Events.Tool.ResizeEnd, {
            object: 'obj-transform-1',
            oldSize: { width: 100, height: 60 },
            newSize: { width: 160, height: 90 },
            oldPosition: { x: 10, y: 20 },
            newPosition: { x: 40, y: 50 },
        });

        expect(ctx.history.executeCommand).toHaveBeenCalledTimes(1);
    });

    it('ResizeEnd does not create command when size did not change', () => {
        const ctx = prepareTransformContext();

        // Даже если жест завершился, без фактического изменения размера
        // history не должна засоряться "пустыми" командами.
        ctx.eventBus.emit(Events.Tool.ResizeStart, {
            object: 'obj-transform-1',
            handle: 'se',
        });
        ctx.history.executeCommand.mockClear();

        ctx.eventBus.emit(Events.Tool.ResizeEnd, {
            object: 'obj-transform-1',
            oldSize: { width: 100, height: 60 },
            newSize: { width: 100, height: 60 },
            oldPosition: { x: 10, y: 20 },
            newPosition: { x: 10, y: 20 },
        });

        expect(ctx.history.executeCommand).toHaveBeenCalledTimes(0);
    });

    it('ResizeUpdate normalizes image geometry with locked aspect and keeps left edge anchor', () => {
        const ctx = prepareTransformContext([
            {
                id: 'img-1',
                type: 'image',
                position: { x: 10, y: 20 },
                width: 200,
                height: 100,
                properties: {},
                transform: { rotation: 0 },
            },
        ]);

        ctx.eventBus.emit(Events.Tool.ResizeStart, {
            object: 'img-1',
            handle: 'e',
        });

        ctx.eventBus.emit(Events.Tool.ResizeUpdate, {
            object: 'img-1',
            size: { width: 260, height: 100 },
            position: { x: 10, y: 20 },
        });

        const stateObj = ctx.state.state.objects.find((obj) => obj.id === 'img-1');
        const pixiObj = ctx.pixi.objects.get('img-1');

        expect(stateObj.width).toBe(260);
        expect(stateObj.height).toBe(130);
        expect(stateObj.position).toEqual({ x: 10, y: 5 });
        expect(pixiObj.x).toBe(140);
        expect(pixiObj.y).toBe(70);
    });

    it('ResizeUpdate normalizes locked frame geometry with handle anchor before applying state', () => {
        const ctx = prepareTransformContext([
            {
                id: 'frame-1',
                type: 'frame',
                position: { x: 10, y: 20 },
                width: 200,
                height: 100,
                properties: { lockedAspect: true },
                transform: { rotation: 0 },
            },
        ]);

        ctx.eventBus.emit(Events.Tool.ResizeStart, {
            object: 'frame-1',
            handle: 'w',
        });

        ctx.eventBus.emit(Events.Tool.ResizeUpdate, {
            object: 'frame-1',
            size: { width: 140, height: 100 },
            position: { x: 70, y: 20 },
        });

        const stateObj = ctx.state.state.objects.find((obj) => obj.id === 'frame-1');
        const pixiObj = ctx.pixi.objects.get('frame-1');

        expect(stateObj.width).toBe(140);
        expect(stateObj.height).toBe(70);
        expect(stateObj.position).toEqual({ x: 70, y: 35 });
        expect(pixiObj.x).toBe(140);
        expect(pixiObj.y).toBe(70);
    });

    it('ResizeEnd commits normalized geometry instead of raw image payload', () => {
        const ctx = prepareTransformContext([
            {
                id: 'img-1',
                type: 'image',
                position: { x: 10, y: 20 },
                width: 200,
                height: 100,
                properties: {},
                transform: { rotation: 0 },
            },
        ]);

        ctx.eventBus.emit(Events.Tool.ResizeStart, {
            object: 'img-1',
            handle: 'w',
        });

        ctx.history.executeCommand.mockClear();
        ctx.eventBus.emit(Events.Tool.ResizeEnd, {
            object: 'img-1',
            oldSize: { width: 200, height: 100 },
            newSize: { width: 140, height: 100 },
            oldPosition: { x: 10, y: 20 },
            newPosition: { x: 70, y: 20 },
        });

        expect(ctx.history.executeCommand).toHaveBeenCalledTimes(1);
        const command = ctx.history.executeCommand.mock.calls[0][0];
        expect(command.newSize).toEqual({ width: 140, height: 70 });
        expect(command.newPosition).toEqual({ x: 70, y: 35 });
    });

    it('ResizeUpdate keeps image dominant axis stable during one gesture', () => {
        const ctx = prepareTransformContext([
            {
                id: 'img-gesture-1',
                type: 'image',
                position: { x: 10, y: 20 },
                width: 500,
                height: 300,
                properties: {},
                transform: { rotation: 0 },
            },
        ]);

        ctx.eventBus.emit(Events.Tool.ResizeStart, {
            object: 'img-gesture-1',
            handle: 'se',
        });

        ctx.eventBus.emit(Events.Tool.ResizeUpdate, {
            object: 'img-gesture-1',
            size: { width: 560, height: 340 },
            position: { x: 10, y: 20 },
        });

        ctx.eventBus.emit(Events.Tool.ResizeUpdate, {
            object: 'img-gesture-1',
            size: { width: 559, height: 361 },
            position: { x: 10, y: 20 },
        });

        const stateObj = ctx.state.state.objects.find((obj) => obj.id === 'img-gesture-1');
        expect(ctx._activeResize.dominantAxis).toBe('width');
        expect(stateObj.width).toBe(559);
        expect(stateObj.height).toBe(335);
        expect(stateObj.position).toEqual({ x: 10, y: 20 });
    });

    it('RotateUpdate updates PIXI angle, RotateEnd creates command only on angle change', async () => {
        const ctx = prepareTransformContext();

        // Во время rotate:update важен немедленный визуальный эффект в PIXI.
        ctx.eventBus.emit(Events.Tool.RotateUpdate, {
            object: 'obj-transform-1',
            angle: 32,
        });
        expect(ctx.pixi.updateObjectRotation).toHaveBeenCalledWith('obj-transform-1', 32);

        // На rotate:end команда должна появиться только при ощутимом отличии угла.
        ctx.history.executeCommand.mockClear();
        ctx.eventBus.emit(Events.Tool.RotateEnd, {
            object: 'obj-transform-1',
            oldAngle: 0,
            newAngle: 32,
        });
        await vi.dynamicImportSettled();

        expect(ctx.history.executeCommand).toHaveBeenCalledTimes(1);
        const stateObj = ctx.state.state.objects.find((obj) => obj.id === 'obj-transform-1');
        expect(stateObj.transform.rotation).toBe(32);

        // Фиксируем пороговое поведение (в текущем коде сравнение через > 0.1):
        // микросдвиг не должен создавать новую команду.
        ctx.history.executeCommand.mockClear();
        ctx.eventBus.emit(Events.Tool.RotateEnd, {
            object: 'obj-transform-1',
            oldAngle: 32,
            newAngle: 32.05,
        });
        await vi.dynamicImportSettled();
        expect(ctx.history.executeCommand).toHaveBeenCalledTimes(0);
    });
});
