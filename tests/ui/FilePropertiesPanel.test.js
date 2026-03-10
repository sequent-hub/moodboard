import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Events } from '../../src/core/events/Events.js';
import { FilePropertiesPanel } from '../../src/ui/FilePropertiesPanel.js';

function createMockEventBus() {
    const handlers = {};
    return {
        on: vi.fn((event, handler) => {
            if (!handlers[event]) handlers[event] = [];
            handlers[event].push(handler);
        }),
        emit: vi.fn((event, data) => {
            if (handlers[event]) {
                handlers[event].forEach((h) => h(data));
            }
        }),
        off: vi.fn((event, handler) => {
            if (!event) return;
            if (!handlers[event]) return;
            if (handler) {
                handlers[event] = handlers[event].filter((h) => h !== handler);
            } else {
                handlers[event] = [];
            }
        }),
        _handlers: handlers,
    };
}

function createMockContainer() {
    const el = document.createElement('div');
    el.getBoundingClientRect = vi.fn(() => ({
        x: 0, y: 0, width: 1200, height: 800,
        top: 0, left: 0, right: 1200, bottom: 800,
    }));
    return el;
}

function createMockCore(selectedIds = [], fileObjectId = null, fileHasId = false) {
    const objectsMap = new Map();
    if (fileObjectId) {
        const fileObj = {
            id: fileObjectId,
            type: 'file',
            fileId: fileHasId ? 'test-file-id' : undefined,
            properties: { fileName: 'doc.pdf', fileSize: 1024 },
        };
        objectsMap.set(fileObjectId, {
            _mb: { type: 'file', instance: {}, properties: fileObj.properties },
        });
    }

    const stateObjects = fileObjectId
        ? [{ id: fileObjectId, type: 'file', fileId: fileHasId ? 'test-file-id' : undefined, properties: { fileName: 'doc.pdf' } }]
        : [];

    return {
        selectTool: {
            selectedObjects: new Set(selectedIds),
        },
        pixi: { objects: objectsMap, worldLayer: { scale: { x: 1, y: 1 }, x: 0, y: 0 } },
        state: {
            getObjects: vi.fn(() => stateObjects),
        },
        fileUploadService: { downloadFile: vi.fn(), getDownloadUrl: vi.fn() },
    };
}

describe('FilePropertiesPanel', () => {
    let eventBus;
    let container;
    let core;
    let panel;

    beforeEach(() => {
        eventBus = createMockEventBus();
        container = createMockContainer();
        core = createMockCore();
        panel = new FilePropertiesPanel(eventBus, container, core);
    });

    afterEach(() => {
        if (panel) panel.destroy();
    });

    describe('Конструктор', () => {
        it('должен сохранить ссылки на зависимости', () => {
            expect(panel.eventBus).toBe(eventBus);
            expect(panel.container).toBe(container);
            expect(panel.core).toBe(core);
        });

        it('должен создать панель скрытой по умолчанию', () => {
            expect(panel.panel).toBeDefined();
            expect(panel.panel.style.display).toBe('none');
        });

        it('должен подписаться на события EventBus', () => {
            expect(eventBus.on).toHaveBeenCalled();
            const subscribed = eventBus.on.mock.calls.map((c) => c[0]);
            expect(subscribed).toContain(Events.Tool.SelectionAdd);
            expect(subscribed).toContain(Events.Tool.SelectionClear);
            expect(subscribed).toContain(Events.Object.Deleted);
            expect(subscribed).toContain(Events.Tool.DragStart);
            expect(subscribed).toContain(Events.Tool.Activated);
        });

        it('не должен падать при core = null', () => {
            expect(() => {
                const p = new FilePropertiesPanel(eventBus, container, null);
                p.destroy();
            }).not.toThrow();
        });
    });

    describe('DOM-структура', () => {
        it('должен создать панель с классом moodboard-file-properties-panel', () => {
            expect(panel.panel.className).toBe('moodboard-file-properties-panel');
        });

        it('должен создать кнопку Скачать с классом moodboard-file-panel-download', () => {
            const btn = panel.panel.querySelector('.moodboard-file-panel-download');
            expect(btn).toBeTruthy();
        });
    });

    describe('updateFromSelection', () => {
        it('скрывает панель при пустой выборке', () => {
            core.selectTool.selectedObjects = new Set(['obj-1']);
            core.pixi.objects.set('obj-1', { _mb: { type: 'file' } });
            core.state.getObjects.mockReturnValue([{ id: 'obj-1', type: 'file' }]);
            panel.showFor('obj-1');
            expect(panel.currentId).toBe('obj-1');

            core.selectTool.selectedObjects = new Set();
            panel.updateFromSelection();
            expect(panel.currentId).toBeNull();
        });

        it('скрывает панель при множественной выборке', () => {
            core.selectTool.selectedObjects = new Set(['obj-1', 'obj-2']);
            panel.updateFromSelection();
            expect(panel.currentId).toBeNull();
        });

        it('показывает панель при одиночном выделении файла', () => {
            const fileId = 'file-1';
            core.selectTool.selectedObjects = new Set([fileId]);
            core.pixi.objects.set(fileId, { _mb: { type: 'file' } });
            core.state.getObjects.mockReturnValue([{ id: fileId, type: 'file' }]);

            panel.updateFromSelection();
            expect(panel.currentId).toBe(fileId);
            expect(panel.panel.style.display).toBe('flex');
        });

        it('скрывает панель при выделении не-файла', () => {
            core.selectTool.selectedObjects = new Set(['note-1']);
            core.pixi.objects.set('note-1', { _mb: { type: 'note' } });

            panel.updateFromSelection();
            expect(panel.currentId).toBeNull();
        });
    });

    describe('destroy', () => {
        it('удаляет панель из DOM', () => {
            expect(container.contains(panel.panel)).toBe(true);
            panel.destroy();
            expect(container.contains(panel.panel)).toBe(false);
        });

        it('обнуляет currentId и panel', () => {
            panel.showFor('file-1');
            panel.destroy();
            expect(panel.currentId).toBeNull();
            expect(panel.panel).toBeNull();
        });

        it('отписывается от EventBus (предотвращает утечку)', () => {
            panel.destroy();

            expect(eventBus.off).toHaveBeenCalled();
            const unsubscribedEvents = eventBus.off.mock.calls.map((c) => c[0]);
            expect(unsubscribedEvents).toContain(Events.Tool.SelectionAdd);
            expect(unsubscribedEvents).toContain(Events.Tool.SelectionRemove);
            expect(unsubscribedEvents).toContain(Events.Tool.SelectionClear);
            expect(unsubscribedEvents).toContain(Events.Object.Deleted);
            expect(unsubscribedEvents).toContain(Events.Tool.DragStart);
            expect(unsubscribedEvents).toContain(Events.Tool.Activated);
            expect(unsubscribedEvents).toContain(Events.Object.TransformUpdated);
        });

        it('повторный вызов destroy не падает', () => {
            expect(() => {
                panel.destroy();
                panel.destroy();
            }).not.toThrow();
        });
    });
});
