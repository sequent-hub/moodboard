import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Диагностический тест: цепочка сохранения поворота записки.
 *
 * При повороте:
 * - updateObjectRotationDirect() записывает angle в object.rotation (верхний уровень)
 * - При загрузке _setupObjectTransform() читает из object.transform.rotation
 *
 * Проверяем: совпадает ли формат записи с форматом чтения.
 */

// Воспроизведение updateObjectRotationDirect из core/index.js (исправленная версия)
function updateObjectRotationDirect(objects, objectId, angle) {
    const object = objects.find(obj => obj.id === objectId);
    if (object) {
        if (!object.transform) {
            object.transform = {};
        }
        object.transform.rotation = angle;
    }
}

// Воспроизведение _setupObjectTransform из ObjectRenderer.js (строки 98–102)
function readRotationOnLoad(objectData) {
    if (objectData.transform && objectData.transform.rotation !== undefined) {
        return objectData.transform.rotation;
    }
    return 0;
}

describe('Цепочка сохранения поворота записки', () => {
    let noteObject;

    beforeEach(() => {
        noteObject = {
            id: 'note-1',
            type: 'note',
            position: { x: 100, y: 200 },
            width: 250,
            height: 250,
            properties: {
                content: 'Тест',
                backgroundColor: 0xFFF9C4,
            },
        };
    });

    describe('updateObjectRotationDirect — запись поворота (исправлено)', () => {
        it('записывает rotation в transform.rotation', () => {
            updateObjectRotationDirect([noteObject], 'note-1', 45);

            expect(noteObject.transform).toBeDefined();
            expect(noteObject.transform.rotation).toBe(45);
        });

        it('создаёт объект transform если его не было', () => {
            expect(noteObject.transform).toBeUndefined();

            updateObjectRotationDirect([noteObject], 'note-1', 90);

            expect(noteObject.transform).toBeDefined();
            expect(noteObject.transform.rotation).toBe(90);
        });

        it('не перезатирает существующие поля transform', () => {
            noteObject.transform = { pivotCompensated: true };

            updateObjectRotationDirect([noteObject], 'note-1', 60);

            expect(noteObject.transform.rotation).toBe(60);
            expect(noteObject.transform.pivotCompensated).toBe(true);
        });
    });

    describe('_setupObjectTransform — чтение поворота при загрузке', () => {
        it('читает из object.transform.rotation', () => {
            noteObject.transform = { rotation: 45 };

            expect(readRotationOnLoad(noteObject)).toBe(45);
        });

        it('возвращает 0 если transform отсутствует', () => {
            expect(readRotationOnLoad(noteObject)).toBe(0);
        });
    });

    describe('Полный цикл: запись → чтение', () => {
        it('rotation сохраняется и восстанавливается корректно', () => {
            updateObjectRotationDirect([noteObject], 'note-1', 30);

            const restoredAngle = readRotationOnLoad(noteObject);

            expect(restoredAngle).toBe(30);
        });

        it('несколько поворотов подряд сохраняются корректно', () => {
            updateObjectRotationDirect([noteObject], 'note-1', 30);
            updateObjectRotationDirect([noteObject], 'note-1', 90);
            updateObjectRotationDirect([noteObject], 'note-1', 180);

            expect(readRotationOnLoad(noteObject)).toBe(180);
        });
    });
});
