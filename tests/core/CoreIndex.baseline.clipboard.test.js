import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CoreMoodBoard } from '../../src/core/index.js';
import { Events } from '../../src/core/events/Events.js';
import { createCoreBaselineContext } from './CoreIndex.baseline.helpers.js';

/**
 * Baseline по clipboard-flow в Core index.
 *
 * Для чего нужен:
 * - зафиксировать наблюдаемое поведение copy/paste через EventBus;
 * - проверять "контрактные" эффекты (события, количество команд, новые id),
 *   а не внутренние переменные реализации.
 */
describe('Core index baseline: clipboard contracts', () => {
    beforeEach(() => {
        // requestAnimationFrame стабируем синхронно,
        // чтобы тесты не зависели от таймингов UI/браузера.
        vi.stubGlobal('requestAnimationFrame', (cb) => {
            cb(0);
            return 1;
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('single object copy/paste emits expected pasted payload and executes paste command', async () => {
        const ctx = createCoreBaselineContext({
            objects: [
                {
                    id: 'obj-copy-1',
                    type: 'note',
                    position: { x: 20, y: 30 },
                    width: 110,
                    height: 70,
                    properties: { text: 'copy me' },
                    transform: {},
                },
            ],
        });

        ctx.copyObject = CoreMoodBoard.prototype.copyObject.bind(ctx);
        ctx.pasteObject = CoreMoodBoard.prototype.pasteObject.bind(ctx);
        CoreMoodBoard.prototype.setupToolEvents.call(ctx);

        // Снимаем фактические payload вставки, которые летят во внешние подписчики.
        const pastedPayloads = [];
        ctx.eventBus.on(Events.Object.Pasted, (payload) => pastedPayloads.push(payload));

        // Запускаем путь через UI-событие, а не прямой вызов команды:
        // это лучше фиксирует реальный контракт интеграции.
        ctx.eventBus.emit(Events.UI.CopyObject, { objectId: 'obj-copy-1' });
        await vi.dynamicImportSettled();
        expect(ctx.clipboard).toEqual(
            expect.objectContaining({
                type: 'object',
                data: expect.objectContaining({ id: 'obj-copy-1' }),
            })
        );

        ctx.history.executeCommand.mockClear();
        ctx.eventBus.emit(Events.UI.PasteAt, { x: 300, y: 320 });

        // Ключевая проверка: один paste-жест -> одна команда.
        expect(ctx.history.executeCommand).toHaveBeenCalledTimes(1);
        // И один object:pasted для одиночной вставки.
        expect(pastedPayloads).toHaveLength(1);
        expect(pastedPayloads[0]).toEqual(
            expect.objectContaining({
                originalId: 'obj-copy-1',
                newId: expect.any(String),
                objectData: expect.objectContaining({
                    position: { x: 300, y: 320 },
                }),
            })
        );
        expect(pastedPayloads[0].newId).not.toBe('obj-copy-1');
    });

    it('group paste keeps batch behavior: emits pasted per object and creates same amount of new ids', () => {
        const ctx = createCoreBaselineContext();
        ctx.copyObject = CoreMoodBoard.prototype.copyObject.bind(ctx);
        ctx.pasteObject = CoreMoodBoard.prototype.pasteObject.bind(ctx);
        CoreMoodBoard.prototype.setupToolEvents.call(ctx);

        // Берем frameBundle-вариант группы:
        // это валидный batch-flow с несколькими вставками в рамках одного действия.
        ctx.clipboard = {
            type: 'group',
            data: [
                {
                    id: 'frame-a',
                    type: 'frame',
                    position: { x: 10, y: 20 },
                    width: 240,
                    height: 180,
                    properties: { title: 'Frame 1' },
                },
                {
                    id: 'child-a',
                    type: 'note',
                    position: { x: 70, y: 90 },
                    width: 80,
                    height: 50,
                    properties: { frameId: 'frame-a' },
                },
            ],
            meta: { pasteCount: 0, frameBundle: true },
        };

        const pastedPayloads = [];
        ctx.eventBus.on(Events.Object.Pasted, (payload) => pastedPayloads.push(payload));

        ctx.eventBus.emit(Events.UI.PasteAt, { x: 500, y: 400 });

        // Batch-контракт: столько команд и pasted-событий, сколько объектов в группе.
        expect(ctx.history.executeCommand).toHaveBeenCalledTimes(2);
        expect(pastedPayloads).toHaveLength(2);

        // Дополнительный smoke-контракт:
        // каждый вставленный объект должен получить новый уникальный id.
        const newIds = pastedPayloads.map((p) => p.newId);
        expect(new Set(newIds).size).toBe(2);
        expect(newIds).not.toContain('frame-a');
        expect(newIds).not.toContain('child-a');
        // После батча selection должна указывать на вставленные элементы,
        // чтобы последующие действия пользователя работали предсказуемо.
        expect(ctx.selectTool.setSelection.mock.calls.length).toBeGreaterThanOrEqual(1);
        const lastSelection = ctx.selectTool.setSelection.mock.calls.at(-1)[0];
        expect(lastSelection).toHaveLength(2);
    });
});
