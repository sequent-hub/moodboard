import { describe, it, expect } from 'vitest';
import { CoreMoodBoard } from '../../src/core/index.js';
import { Events } from '../../src/core/events/Events.js';
import { createCoreBaselineContext } from './CoreIndex.baseline.helpers.js';

// Контекст с подключенными tool-обработчиками Core index.
// Нужен для проверки event-контрактов на реальном кодовом пути
// (emit -> обработчик -> мутация request/payload), а не на заглушках.
function prepareContextWithToolEvents() {
    const ctx = createCoreBaselineContext({
        objects: [
            {
                id: 'obj-events-1',
                type: 'note',
                position: { x: 12, y: 18 },
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

describe('Core index baseline: event contracts', () => {
    it('Events.Object.Created payload keeps objectId and objectData fields', () => {
        const ctx = createCoreBaselineContext();

        // Создаем объект через публичный API, чтобы получить
        // фактический payload события object:created.
        const created = CoreMoodBoard.prototype.createObject.call(
            ctx,
            'note',
            { x: 30, y: 45 },
            { width: 120, height: 70 }
        );
        const emitted = ctx.eventBus.emit.mock.calls.find(([eventName]) => eventName === Events.Object.Created);

        // Критичные поля контракта для интеграций:
        // objectId + objectData с базовыми атрибутами объекта.
        expect(emitted).toBeTruthy();
        expect(emitted[1]).toEqual(
            expect.objectContaining({
                objectId: created.id,
                objectData: expect.objectContaining({
                    id: created.id,
                    type: 'note',
                    position: { x: 30, y: 45 },
                }),
            })
        );
    });

    it('Events.Tool.GetObjectSize/GetObjectPosition keep mutable request payload contract', () => {
        const ctx = prepareContextWithToolEvents();

        // В текущем контракте getter-события мутируют исходный request-объект.
        // Этот формат используется рядом инструментов/UI, поэтому фиксируем его явно.
        const sizeReq = { objectId: 'obj-events-1' };
        ctx.eventBus.emit(Events.Tool.GetObjectSize, sizeReq);
        expect(sizeReq).toEqual(
            expect.objectContaining({
                objectId: 'obj-events-1',
                size: expect.objectContaining({ width: 100, height: 60 }),
            })
        );

        const posReq = { objectId: 'obj-events-1' };
        ctx.eventBus.emit(Events.Tool.GetObjectPosition, posReq);
        expect(posReq).toEqual(
            expect.objectContaining({
                objectId: 'obj-events-1',
                position: expect.objectContaining({ x: 12, y: 18 }),
            })
        );
    });

    it('Events.Object.Rotate -> Events.Object.TransformUpdated keeps critical fields', () => {
        const ctx = prepareContextWithToolEvents();
        const received = [];
        ctx.eventBus.on(Events.Object.TransformUpdated, (payload) => received.push(payload));

        // Проверяем сквозной контракт: rotate-команда должна транслироваться
        // в transform:updated с полями, нужными для подписчиков UI.
        ctx.eventBus.emit(Events.Object.Rotate, { objectId: 'obj-events-1', angle: 27 });

        expect(received).toContainEqual(
            expect.objectContaining({
                objectId: 'obj-events-1',
                type: 'rotation',
                angle: 27,
            })
        );
    });

    it('ResizeEnd command keeps object/oldSize/newSize fields from tool payload', () => {
        const ctx = prepareContextWithToolEvents();

        ctx.eventBus.emit(Events.Tool.ResizeStart, {
            object: 'obj-events-1',
            handle: 'se',
        });
        ctx.history.executeCommand.mockClear();

        ctx.eventBus.emit(Events.Tool.ResizeEnd, {
            object: 'obj-events-1',
            oldSize: { width: 100, height: 60 },
            newSize: { width: 140, height: 80 },
            oldPosition: { x: 12, y: 18 },
            newPosition: { x: 20, y: 25 },
        });

        // На ResizeEnd Core создает ResizeObjectCommand.
        // Здесь фиксируем, что команда получает именно те поля payload,
        // на которые опирается undo/redo и диагностика изменений.
        const command = ctx.history.executeCommand.mock.calls[0][0];
        expect(command.objectId).toBe('obj-events-1');
        expect(command.oldSize).toEqual({ width: 100, height: 60 });
        expect(command.newSize).toEqual({ width: 140, height: 80 });
    });
});
