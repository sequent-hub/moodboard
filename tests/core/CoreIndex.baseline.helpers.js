import { vi } from 'vitest';

// Глубокое копирование нужно, чтобы baseline-тесты не зависели
// от мутаций между кейсами и всегда стартовали из чистого снимка данных.
function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

export function createTestEventBus() {
    // Локальная реализация EventBus для тестов:
    // 1) сохраняем совместимый контракт on/off/emit;
    // 2) оставляем прозрачную трассировку через vi.fn;
    // 3) не используем реальную инфраструктуру приложения.
    const handlers = new Map();
    const on = vi.fn((event, handler) => {
        if (!handlers.has(event)) handlers.set(event, new Set());
        handlers.get(event).add(handler);
    });
    const off = vi.fn((event, handler) => {
        const set = handlers.get(event);
        if (!set) return;
        set.delete(handler);
        if (set.size === 0) handlers.delete(event);
    });
    const emit = vi.fn((event, payload) => {
        const set = handlers.get(event);
        if (!set) return;
        for (const handler of set) {
            handler(payload);
        }
    });

    return { on, off, emit };
}

export function createCoreBaselineContext({ objects = [] } = {}) {
    // Этот helper создает "core-подобный" контекст для вызова методов
    // CoreMoodBoard.prototype без конструктора и внешних сервисов.
    // Цель: фиксировать поведение index.js в изоляции от DOM/PIXI/API.
    const eventBus = createTestEventBus();
    const stateObjects = objects.map((obj) => clone(obj));

    // Минимальный StateManager-контракт, который ожидают команды и обработчики.
    // Нам важны только публичные эффекты (добавление/удаление/грязное состояние),
    // а не внутренние детали реализации реального StateManager.
    const state = {
        state: { objects: stateObjects, board: {}, selectedObjects: [], isDirty: false },
        getObjects: vi.fn(() => state.state.objects),
        addObject: vi.fn((objectData) => {
            state.state.objects.push(objectData);
            state.markDirty();
        }),
        removeObject: vi.fn((objectId) => {
            state.state.objects = state.state.objects.filter((obj) => obj.id !== objectId);
            state.markDirty();
        }),
        markDirty: vi.fn(() => {
            state.state.isDirty = true;
        }),
    };

    const pixiObjects = new Map();
    for (const obj of stateObjects) {
        const width = obj.width || 100;
        const height = obj.height || 100;
        pixiObjects.set(obj.id, {
            id: obj.id,
            width,
            height,
            x: (obj.position?.x || 0) + width / 2,
            y: (obj.position?.y || 0) + height / 2,
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

    // Минимальный PixiEngine-контракт.
    // Координаты в map храним в center-системе, как это делает PIXI,
    // чтобы проверки top-left <-> center были реалистичными для baseline.
    const pixi = {
        objects: pixiObjects,
        createObject: vi.fn((objectData) => {
            const width = objectData.width || 100;
            const height = objectData.height || 100;
            pixi.objects.set(objectData.id, {
                id: objectData.id,
                width,
                height,
                x: (objectData.position?.x || 0) + width / 2,
                y: (objectData.position?.y || 0) + height / 2,
                rotation: (objectData.transform?.rotation || 0) * Math.PI / 180,
                getBounds() {
                    return {
                        x: this.x - this.width / 2,
                        y: this.y - this.height / 2,
                        width: this.width,
                        height: this.height,
                    };
                },
            });
        }),
        removeObject: vi.fn((objectId) => {
            pixi.objects.delete(objectId);
        }),
        updateObjectSize: vi.fn((objectId, size) => {
            const obj = pixi.objects.get(objectId);
            if (!obj) return;
            obj.width = size.width;
            obj.height = size.height;
        }),
        updateObjectRotation: vi.fn((objectId, angleDeg) => {
            const obj = pixi.objects.get(objectId);
            if (!obj) return;
            obj.rotation = angleDeg * Math.PI / 180;
        }),
        findObjectByPosition: vi.fn(() => null),
        hitTest: vi.fn(() => null),
        updateObjectContent: vi.fn(),
        hideObjectText: vi.fn(),
        showObjectText: vi.fn(),
    };

    // История команд в baseline-тестах выполняет две роли:
    // 1) подтверждает факт создания команды;
    // 2) исполняет команду сразу, чтобы проверить конечный observable-эффект.
    const history = {
        executeCommand: vi.fn((command) => {
            if (typeof command?.setEventBus === 'function') {
                command.setEventBus(eventBus);
            }
            return command?.execute?.();
        }),
    };

    // SelectTool здесь используется только для проверки контрактов batch-вставки:
    // что выборка обновляется после вставки группы.
    const selectTool = {
        selectedObjects: new Set(),
        selection: new Set(),
        setSelection: vi.fn(),
        updateResizeHandles: vi.fn(),
    };

    return {
        eventBus,
        state,
        pixi,
        history,
        selectTool,
        toolManager: null,
        clipboard: null,
        resizeStartSize: null,
        dragStartPosition: null,
        _activeResize: null,
        _groupResizeSnapshot: null,
        _groupResizeStart: null,
        _groupRotateStart: null,
        _groupRotateCenter: null,
    };
}
