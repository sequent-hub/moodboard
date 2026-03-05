import { describe, it, expect } from 'vitest';
import { CoreMoodBoard } from '../../src/core/index.js';
import { Events } from '../../src/core/events/Events.js';
import { createCoreBaselineContext } from './CoreIndex.baseline.helpers.js';

/**
 * Baseline-тесты жизненного цикла объектов в Core index.
 *
 * Зачем файл нужен:
 * - зафиксировать текущий "публичный" результат create/delete/load-from-data;
 * - дать быстрый регресс-контур до/после механического выноса в flow-модули;
 * - проверять контракт поведения, а не внутреннюю структуру реализации.
 */
describe('Core index baseline: object lifecycle', () => {
    it('createObject adds object to state and PIXI', () => {
        const ctx = createCoreBaselineContext();

        // Вызываем именно публичный метод CoreMoodBoard,
        // чтобы зафиксировать фактический command-flow:
        // createObject -> CreateObjectCommand -> state/pixi + событие.
        const created = CoreMoodBoard.prototype.createObject.call(
            ctx,
            'note',
            { x: 25, y: 40 },
            { width: 120, height: 80, text: 'baseline' }
        );

        // Критичный baseline-контракт:
        // объект должен существовать одновременно в state и в pixi-слое.
        expect(created.id).toBeTruthy();
        expect(ctx.state.state.objects.some((obj) => obj.id === created.id)).toBe(true);
        expect(ctx.pixi.objects.has(created.id)).toBe(true);
        // Подтверждаем, что операция идет через историю команд, а не "мимо" нее.
        expect(ctx.history.executeCommand).toHaveBeenCalledTimes(1);

        const createdEvent = ctx.eventBus.emit.mock.calls.find(
            ([eventName]) => eventName === Events.Object.Created
        );
        // Фиксируем минимальный payload-контракт события создания:
        // эти поля часто используются внешними подписчиками.
        expect(createdEvent).toBeTruthy();
        expect(createdEvent[1]).toEqual(
            expect.objectContaining({
                objectId: created.id,
                objectData: expect.objectContaining({ id: created.id, type: 'note' }),
            })
        );
    });

    it('deleteObject removes object from state and PIXI', async () => {
        const seed = {
            id: 'obj-delete-me',
            type: 'note',
            position: { x: 10, y: 20 },
            width: 100,
            height: 60,
            properties: {},
        };
        const ctx = createCoreBaselineContext({ objects: [seed] });

        // deleteObject использует DeleteObjectCommand (асинхронный execute),
        // поэтому ожидаем завершения через await.
        await CoreMoodBoard.prototype.deleteObject.call(ctx, seed.id);

        // Контракт удаления:
        // объект должен исчезнуть из обеих моделей (state и pixi).
        expect(ctx.state.state.objects.some((obj) => obj.id === seed.id)).toBe(false);
        expect(ctx.pixi.objects.has(seed.id)).toBe(false);
        expect(ctx.history.executeCommand).toHaveBeenCalledTimes(1);

        const deletedEvent = ctx.eventBus.emit.mock.calls.find(
            ([eventName]) => eventName === Events.Object.Deleted
        );
        // Сохраняем минимальный формат delete-события для интеграций UI/панелей.
        expect(deletedEvent).toBeTruthy();
        expect(deletedEvent[1]).toEqual(expect.objectContaining({ objectId: seed.id }));
    });

    it('createObjectFromData does not duplicate object on repeated call with same id', () => {
        const ctx = createCoreBaselineContext();
        const objectData = {
            id: 'obj-server-1',
            type: 'note',
            position: { x: 100, y: 150 },
            width: 180,
            height: 90,
            properties: { text: 'loaded' },
        };

        // Имитация повторной загрузки одного и того же объекта (частый регресс-случай).
        CoreMoodBoard.prototype.createObjectFromData.call(ctx, objectData);
        CoreMoodBoard.prototype.createObjectFromData.call(ctx, objectData);

        // Baseline-ожидание:
        // при одинаковом id объект добавляется только один раз.
        expect(ctx.state.addObject).toHaveBeenCalledTimes(1);
        expect(ctx.pixi.createObject).toHaveBeenCalledTimes(1);
        expect(ctx.state.state.objects.filter((obj) => obj.id === objectData.id)).toHaveLength(1);
    });
});
