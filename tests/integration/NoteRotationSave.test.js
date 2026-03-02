import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StateManager } from '../../src/core/StateManager.js';

/**
 * Диагностический тест: полная цепочка сохранения и загрузки поворота.
 *
 * Использует РЕАЛЬНЫЙ StateManager из кодовой базы.
 */

// ─────────────────────────────────────────────
// Реальная логика из кодовой базы
// ─────────────────────────────────────────────

// updateObjectRotationDirect — точная копия из core/index.js
function updateObjectRotationDirect(stateManager, objectId, angle) {
    const objects = stateManager.getObjects();
    const object = objects.find(obj => obj.id === objectId);
    if (object) {
        if (!object.transform) {
            object.transform = {};
        }
        object.transform.rotation = angle;
        stateManager.markDirty();
    }
}

// getBoardData — из core/index.js (упрощённо)
function getBoardData(stateManager) {
    const s = stateManager.serialize();
    return {
        objects: Array.isArray(s.objects) ? s.objects : [],
        name: s.name || 'Untitled',
    };
}

// _setupObjectTransform — из ObjectRenderer.js (чтение rotation при загрузке)
function readRotationOnLoad(objectData) {
    if (objectData.transform && objectData.transform.rotation !== undefined) {
        return objectData.transform.rotation;
    }
    return 0;
}

// ─────────────────────────────────────────────
// Тесты
// ─────────────────────────────────────────────
describe('Полная цепочка сохранения/загрузки поворота', () => {
    let stateManager;

    beforeEach(() => {
        const mockEventBus = { emit: vi.fn(), on: vi.fn(), off: vi.fn() };
        stateManager = new StateManager(mockEventBus);
        stateManager.addObject({
            id: 'note-1',
            type: 'note',
            position: { x: 100, y: 200 },
            width: 250,
            height: 250,
            properties: { content: 'Тест', backgroundColor: 0xFFF9C4 },
            transform: { pivotCompensated: false },
        });
    });

    describe('StateManager.getObjects() возвращает ссылки на оригинальные объекты', () => {
        it('мутация через getObjects() изменяет оригинал в state', () => {
            const objects = stateManager.getObjects();
            const obj = objects.find(o => o.id === 'note-1');

            obj.transform.rotation = 45;

            // Проверяем что оригинал в state.objects тоже изменился
            expect(stateManager.state.objects[0].transform.rotation).toBe(45);
        });

        it('getObjects() возвращает новый массив, но те же объекты', () => {
            const a = stateManager.getObjects();
            const b = stateManager.getObjects();

            expect(a).not.toBe(b);           // разные массивы
            expect(a[0]).toBe(b[0]);          // но те же объекты
        });
    });

    describe('updateObjectRotationDirect → serialize → данные для сервера', () => {
        it('поворот на 45° попадает в serialize()', () => {
            updateObjectRotationDirect(stateManager, 'note-1', 45);

            const serialized = stateManager.serialize();
            const noteInSave = serialized.objects.find(o => o.id === 'note-1');

            expect(noteInSave.transform.rotation).toBe(45);
        });

        it('поворот попадает в getBoardData().objects', () => {
            updateObjectRotationDirect(stateManager, 'note-1', 90);

            const boardData = getBoardData(stateManager);
            const noteInSave = boardData.objects.find(o => o.id === 'note-1');

            expect(noteInSave.transform.rotation).toBe(90);
        });

        it('markDirty вызывается при повороте', () => {
            updateObjectRotationDirect(stateManager, 'note-1', 30);

            expect(stateManager.state.isDirty).toBe(true);
        });

        it('другие поля transform не затрагиваются', () => {
            updateObjectRotationDirect(stateManager, 'note-1', 60);

            const obj = stateManager.state.objects[0];
            expect(obj.transform.pivotCompensated).toBe(false);
            expect(obj.transform.rotation).toBe(60);
        });
    });

    describe('Полный цикл: rotate → save → load', () => {
        it('поворот сохраняется и восстанавливается при загрузке', () => {
            // 1. Пользователь поворачивает на 135°
            updateObjectRotationDirect(stateManager, 'note-1', 135);

            // 2. getBoardData → отправка на сервер
            const savedData = getBoardData(stateManager);

            // 3. Сервер возвращает те же данные при загрузке
            const loadedObjects = savedData.objects;
            const loadedNote = loadedObjects.find(o => o.id === 'note-1');

            // 4. _setupObjectTransform читает rotation
            const restoredAngle = readRotationOnLoad(loadedNote);

            expect(restoredAngle).toBe(135);
        });

        it('несколько поворотов — последний сохраняется', () => {
            updateObjectRotationDirect(stateManager, 'note-1', 30);
            updateObjectRotationDirect(stateManager, 'note-1', 90);
            updateObjectRotationDirect(stateManager, 'note-1', 270);

            const savedData = getBoardData(stateManager);
            const loadedNote = savedData.objects.find(o => o.id === 'note-1');

            expect(readRotationOnLoad(loadedNote)).toBe(270);
        });

        it('поворот 0° тоже сохраняется (не сбрасывается в undefined)', () => {
            updateObjectRotationDirect(stateManager, 'note-1', 45);
            updateObjectRotationDirect(stateManager, 'note-1', 0);

            const savedData = getBoardData(stateManager);
            const loadedNote = savedData.objects.find(o => o.id === 'note-1');

            expect(readRotationOnLoad(loadedNote)).toBe(0);
            expect(loadedNote.transform.rotation).toBe(0);
        });
    });

    describe('Сериализация через JSON (как при отправке на сервер)', () => {
        it('transform.rotation сохраняется через JSON.stringify → JSON.parse', () => {
            updateObjectRotationDirect(stateManager, 'note-1', 180);

            const savedData = getBoardData(stateManager);
            // Имитируем отправку на сервер и получение обратно
            const jsonString = JSON.stringify(savedData);
            const restoredData = JSON.parse(jsonString);

            const restoredNote = restoredData.objects.find(o => o.id === 'note-1');
            expect(restoredNote.transform.rotation).toBe(180);
            expect(readRotationOnLoad(restoredNote)).toBe(180);
        });

        it('properties не теряются при сериализации', () => {
            updateObjectRotationDirect(stateManager, 'note-1', 45);

            const savedData = getBoardData(stateManager);
            const json = JSON.parse(JSON.stringify(savedData));
            const note = json.objects.find(o => o.id === 'note-1');

            expect(note.properties.content).toBe('Тест');
            expect(note.properties.backgroundColor).toBe(0xFFF9C4);
            expect(note.position).toEqual({ x: 100, y: 200 });
            expect(note.transform.rotation).toBe(45);
            expect(note.transform.pivotCompensated).toBe(false);
        });
    });

    describe('Множество объектов', () => {
        beforeEach(() => {
            stateManager.addObject({
                id: 'note-2',
                type: 'note',
                position: { x: 400, y: 300 },
                width: 250,
                height: 250,
                properties: { content: 'Вторая' },
                transform: { pivotCompensated: false },
            });
            stateManager.addObject({
                id: 'text-1',
                type: 'text',
                position: { x: 600, y: 100 },
                width: 200,
                height: 50,
                properties: { content: 'Текст' },
                transform: { pivotCompensated: false },
            });
        });

        it('поворот одного объекта не влияет на другие', () => {
            updateObjectRotationDirect(stateManager, 'note-1', 45);

            const savedData = getBoardData(stateManager);
            const note1 = savedData.objects.find(o => o.id === 'note-1');
            const note2 = savedData.objects.find(o => o.id === 'note-2');
            const text1 = savedData.objects.find(o => o.id === 'text-1');

            expect(readRotationOnLoad(note1)).toBe(45);
            expect(readRotationOnLoad(note2)).toBe(0);
            expect(readRotationOnLoad(text1)).toBe(0);
        });

        it('поворот нескольких объектов сохраняется независимо', () => {
            updateObjectRotationDirect(stateManager, 'note-1', 90);
            updateObjectRotationDirect(stateManager, 'note-2', 180);
            updateObjectRotationDirect(stateManager, 'text-1', 270);

            const json = JSON.parse(JSON.stringify(getBoardData(stateManager)));
            expect(readRotationOnLoad(json.objects.find(o => o.id === 'note-1'))).toBe(90);
            expect(readRotationOnLoad(json.objects.find(o => o.id === 'note-2'))).toBe(180);
            expect(readRotationOnLoad(json.objects.find(o => o.id === 'text-1'))).toBe(270);
        });
    });

    describe('Несуществующий объект', () => {
        it('поворот несуществующего объекта не вызывает ошибку', () => {
            expect(() => {
                updateObjectRotationDirect(stateManager, 'nonexistent', 45);
            }).not.toThrow();
        });

        it('state не помечается dirty для несуществующего объекта', () => {
            stateManager.state.isDirty = false;
            updateObjectRotationDirect(stateManager, 'nonexistent', 45);
            expect(stateManager.state.isDirty).toBe(false);
        });
    });

    describe('markDirty() эмитирует state:changed для SaveManager', () => {
        it('markDirty отправляет событие state:changed', () => {
            const mockEventBus = { emit: vi.fn(), on: vi.fn(), off: vi.fn() };
            const sm = new StateManager(mockEventBus);
            sm.addObject({
                id: 'n1', type: 'note',
                position: { x: 0, y: 0 }, width: 250, height: 250,
                properties: {}, transform: {},
            });

            updateObjectRotationDirect(sm, 'n1', 45);

            // markDirty() должен эмитировать 'state:changed'
            const stateChangedCalls = mockEventBus.emit.mock.calls.filter(
                c => c[0] === 'state:changed'
            );
            expect(stateChangedCalls.length).toBeGreaterThan(0);
        });
    });
});
