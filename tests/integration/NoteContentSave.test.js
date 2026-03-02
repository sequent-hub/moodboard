import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Диагностический тест: цепочка сохранения текста записки.
 *
 * Воспроизводит логику обработчика Events.Object.StateChanged из core/index.js
 * и проверяет, попадает ли content в правильное место (properties.content).
 */

// Воспроизведение логики StateChanged из core/index.js (строки 1572–1587)
function applyStateChanged(objects, objectId, updates) {
    const object = objects.find(obj => obj.id === objectId);
    if (!object) return;

    if (updates.properties && object.properties) {
        Object.assign(object.properties, updates.properties);
    }

    const topLevelUpdates = { ...updates };
    delete topLevelUpdates.properties;
    Object.assign(object, topLevelUpdates);
}

describe('Цепочка сохранения текста записки', () => {
    let noteObject;

    beforeEach(() => {
        noteObject = {
            id: 'note-1',
            type: 'note',
            position: { x: 100, y: 200 },
            properties: {
                content: 'Старый текст',
                fontSize: 32,
                fontFamily: 'Caveat, Arial, cursive',
                backgroundColor: 0xFFF9C4,
                textColor: 0x1A1A1A,
            },
        };
    });

    // ═══════════════════════════════════════════
    // Регрессия: старый формат (content на верхнем уровне) терял данные
    // ═══════════════════════════════════════════
    describe('Регрессия: content на верхнем уровне updates теряет данные', () => {
        it('content на верхнем уровне НЕ обновляет properties.content', () => {
            const updates = { content: 'Новый текст' };

            applyStateChanged([noteObject], 'note-1', updates);

            expect(noteObject.content).toBe('Новый текст');
            expect(noteObject.properties.content).toBe('Старый текст');
        });
    });

    // ═══════════════════════════════════════════
    // Формат после исправления (content внутри properties)
    // ═══════════════════════════════════════════
    describe('SelectTool.finalize — исправленный формат', () => {
        it('content внутри properties корректно обновляет properties.content', () => {
            // После исправления SelectTool отправляет:
            // updates: { properties: { content: value } }
            const updates = { properties: { content: 'Новый текст' } };

            applyStateChanged([noteObject], 'note-1', updates);

            expect(noteObject.properties.content).toBe('Новый текст');
        });

        it('остальные свойства properties не теряются', () => {
            const updates = { properties: { content: 'Новый текст' } };

            applyStateChanged([noteObject], 'note-1', updates);

            expect(noteObject.properties.fontSize).toBe(32);
            expect(noteObject.properties.backgroundColor).toBe(0xFFF9C4);
            expect(noteObject.properties.fontFamily).toBe('Caveat, Arial, cursive');
        });
    });

    // ═══════════════════════════════════════════
    // Формат, используемый NotePropertiesPanel (корректный)
    // ═══════════════════════════════════════════
    describe('NotePropertiesPanel — формат updates с properties', () => {
        it('изменение цвета через properties корректно мержится', () => {
            // NotePropertiesPanel отправляет так:
            // updates: { properties: { backgroundColor: 0xFF0000 } }
            const updates = { properties: { backgroundColor: 0xFF0000 } };

            applyStateChanged([noteObject], 'note-1', updates);

            expect(noteObject.properties.backgroundColor).toBe(0xFF0000);
            expect(noteObject.properties.content).toBe('Старый текст'); // остальные свойства не потеряны
            expect(noteObject.properties.fontSize).toBe(32);
        });
    });

    // ═══════════════════════════════════════════
    // Корректный формат для content (как должно быть)
    // ═══════════════════════════════════════════
    describe('Корректный формат — content внутри properties', () => {
        it('content внутри updates.properties корректно обновляет properties.content', () => {
            // Если бы SelectTool отправлял так:
            // updates: { properties: { content: 'Новый текст' } }
            const updates = { properties: { content: 'Новый текст' } };

            applyStateChanged([noteObject], 'note-1', updates);

            expect(noteObject.properties.content).toBe('Новый текст');
        });

        it('остальные свойства properties не теряются при обновлении content', () => {
            const updates = { properties: { content: 'Новый текст' } };

            applyStateChanged([noteObject], 'note-1', updates);

            expect(noteObject.properties.content).toBe('Новый текст');
            expect(noteObject.properties.fontSize).toBe(32);
            expect(noteObject.properties.backgroundColor).toBe(0xFFF9C4);
            expect(noteObject.properties.fontFamily).toBe('Caveat, Arial, cursive');
        });
    });

    // ═══════════════════════════════════════════
    // Полный цикл: создание → редактирование → сохранение
    // ═══════════════════════════════════════════
    describe('Полный цикл', () => {
        it('после "сохранения" через текущий finalize, serialize вернёт старый content', () => {
            // 1. Записка создана с "Старый текст" в properties.content
            expect(noteObject.properties.content).toBe('Старый текст');

            // 2. Пользователь отредактировал текст, finalize отправляет
            const updates = { content: 'Пользователь написал новый текст' };
            applyStateChanged([noteObject], 'note-1', updates);

            // 3. При сериализации для сохранения используется properties.content
            const savedData = {
                id: noteObject.id,
                type: noteObject.type,
                properties: { ...noteObject.properties },
            };

            // Текст НЕ сохранился — properties.content не обновлён
            expect(savedData.properties.content).toBe('Старый текст');
        });

        it('UpdateObjectContent обновляет PIXI-отображение, но не state', () => {
            // UpdateObjectContent → ObjectRenderer.updateObjectContent → instance.setContent()
            // Это обновляет визуальное отображение, но НЕ трогает state объект
            // State обновляется только через StateChanged

            // Имитируем: PIXI обновлён, state — нет
            const pixiContent = 'Новый текст'; // через setContent
            const stateContent = noteObject.properties.content; // через StateChanged с { content: ... }

            const updates = { content: pixiContent };
            applyStateChanged([noteObject], 'note-1', updates);

            // PIXI показывает новый текст (через setContent), state хранит старый
            expect(noteObject.properties.content).toBe('Старый текст');
            // При перезагрузке state восстанавливается → старый текст
        });
    });
});
