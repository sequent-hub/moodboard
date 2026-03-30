import { describe, it, expect, vi } from 'vitest';
import { bindToolbarEvents, bindSaveCallbacks } from '../../src/moodboard/integration/MoodBoardEventBindings.js';
import { Events } from '../../src/core/events/Events.js';

function createEventBus() {
    const handlers = new Map();
    return {
        on: vi.fn((event, handler) => {
            if (!handlers.has(event)) handlers.set(event, []);
            handlers.get(event).push(handler);
        }),
        emit: vi.fn((event, payload) => {
            const list = handlers.get(event) || [];
            for (const handler of list) handler(payload);
        }),
    };
}

describe('History navigation (images, append-only)', () => {
    it('из старой версии создается новый head, старые версии с картинками остаются доступными', async () => {
        const eventBus = createEventBus();
        const snapshotsByVersion = new Map([
            [2, { objects: [{ id: 'img-a', type: 'image', imageId: 'img-a-id' }] }],
            [3, {
                objects: [
                    { id: 'img-a', type: 'image', imageId: 'img-a-id' },
                    { id: 'img-b', type: 'image', imageId: 'img-b-id' },
                ]
            }],
            [4, {
                objects: [
                    { id: 'img-a', type: 'image', imageId: 'img-a-id' },
                    { id: 'img-b', type: 'image', imageId: 'img-b-id' },
                    { id: 'img-c', type: 'image', imageId: 'img-c-id' },
                ]
            }],
        ]);
        const loadCalls = [];

        const board = {
            options: { boardId: 'mb-1', onSave: vi.fn() },
            data: { objects: [] },
            historyHeadVersion: 4,
            historyCursorVersion: 4,
            currentLoadedVersion: 4,
            loadFromApi: vi.fn(async (_boardId, version, options = {}) => {
                loadCalls.push({ version, options });
                const snapshot = snapshotsByVersion.get(version);
                if (!snapshot) throw new Error(`No snapshot for version ${version}`);
                board.data = JSON.parse(JSON.stringify(snapshot));
                board.currentLoadedVersion = version;
                board.historyCursorVersion = version;
                if (!options.historyNavigation) {
                    board.historyHeadVersion = version;
                }
            }),
            actionHandler: { handleToolbarAction: vi.fn() },
            coreMoodboard: { eventBus, pixi: null },
        };

        bindToolbarEvents(board);
        bindSaveCallbacks(board);

        // Шаг 1: откат к v3 только загрузкой, без создания новой версии.
        eventBus.emit(Events.UI.LoadPrevVersion);
        await Promise.resolve();
        expect(board.historyCursorVersion).toBe(3);
        expect(board.historyHeadVersion).toBe(4);
        expect(board.data.objects.map((o) => o.imageId)).toEqual(['img-a-id', 'img-b-id']);

        // Шаг 2: пользователь изменил контент на базе v3, backend сохранил новую версию v5.
        snapshotsByVersion.set(5, {
            objects: [
                { id: 'img-a', type: 'image', imageId: 'img-a-id' },
                { id: 'img-b', type: 'image', imageId: 'img-b-id' },
                { id: 'img-d', type: 'image', imageId: 'img-d-id' },
            ]
        });
        eventBus.emit(Events.Save.Success, {
            response: { historyVersion: 5 },
        });
        await board.loadFromApi('mb-1', 5, { historyNavigation: false });

        expect(board.historyHeadVersion).toBe(5);
        expect(board.historyCursorVersion).toBe(5);
        expect(board.data.objects.map((o) => o.imageId)).toEqual(['img-a-id', 'img-b-id', 'img-d-id']);

        // Шаг 3: старые версии (включая v4) по-прежнему доступны и неизменны.
        await board.loadFromApi('mb-1', 4, { historyNavigation: true });
        expect(board.historyHeadVersion).toBe(5);
        expect(board.historyCursorVersion).toBe(4);
        expect(board.data.objects.map((o) => o.imageId)).toEqual(['img-a-id', 'img-b-id', 'img-c-id']);

        await board.loadFromApi('mb-1', 3, { historyNavigation: true });
        expect(board.data.objects.map((o) => o.imageId)).toEqual(['img-a-id', 'img-b-id']);

        expect(loadCalls.map((call) => call.version)).toContain(3);
    });
});
