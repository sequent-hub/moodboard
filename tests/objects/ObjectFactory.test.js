import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Моки классов объектов ---
// Мокируем каждый класс-объект, чтобы изолировать тест фабрики от PIXI-зависимостей

const mockFrameInstance = { type: 'frame', container: {} };
const mockShapeInstance = { type: 'shape', container: {} };
const mockDrawingInstance = { type: 'drawing', container: {} };
const mockTextInstance = { type: 'text', container: {} };
const mockEmojiInstance = { type: 'emoji', container: {} };
const mockImageInstance = { type: 'image', container: {} };
const mockCommentInstance = { type: 'comment', container: {} };
const mockNoteInstance = { type: 'note', container: {} };
const mockFileInstance = { type: 'file', container: {} };

vi.mock('../../src/objects/FrameObject.js', () => ({
    FrameObject: vi.fn().mockImplementation(() => ({ ...mockFrameInstance })),
}));
vi.mock('../../src/objects/ShapeObject.js', () => ({
    ShapeObject: vi.fn().mockImplementation(() => ({ ...mockShapeInstance })),
}));
vi.mock('../../src/objects/DrawingObject.js', () => ({
    DrawingObject: vi.fn().mockImplementation(() => ({ ...mockDrawingInstance })),
}));
vi.mock('../../src/objects/TextObject.js', () => ({
    TextObject: vi.fn().mockImplementation(() => ({ ...mockTextInstance })),
}));
vi.mock('../../src/objects/EmojiObject.js', () => ({
    EmojiObject: vi.fn().mockImplementation(() => ({ ...mockEmojiInstance })),
}));
vi.mock('../../src/objects/ImageObject.js', () => ({
    ImageObject: vi.fn().mockImplementation(() => ({ ...mockImageInstance })),
}));
vi.mock('../../src/objects/CommentObject.js', () => ({
    CommentObject: vi.fn().mockImplementation(() => ({ ...mockCommentInstance })),
}));
vi.mock('../../src/objects/NoteObject.js', () => ({
    NoteObject: vi.fn().mockImplementation(() => ({ ...mockNoteInstance })),
}));
vi.mock('../../src/objects/FileObject.js', () => ({
    FileObject: vi.fn().mockImplementation(() => ({ ...mockFileInstance })),
}));

import { ObjectFactory } from '../../src/objects/ObjectFactory.js';
import { FrameObject } from '../../src/objects/FrameObject.js';
import { NoteObject } from '../../src/objects/NoteObject.js';
import { TextObject } from '../../src/objects/TextObject.js';
import { ShapeObject } from '../../src/objects/ShapeObject.js';

// ─────────────────────────────────────────────
// Тесты ObjectFactory
// ─────────────────────────────────────────────
describe('ObjectFactory', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ═══════════════════════════════════════════
    // Реестр типов
    // ═══════════════════════════════════════════
    describe('Реестр типов (registry)', () => {
        it('должен содержать тип "note"', () => {
            expect(ObjectFactory.has('note')).toBe(true);
        });

        it('должен содержать тип "text"', () => {
            expect(ObjectFactory.has('text')).toBe(true);
        });

        it('должен содержать тип "simple-text" (алиас для TextObject)', () => {
            expect(ObjectFactory.has('simple-text')).toBe(true);
        });

        it('должен содержать тип "frame"', () => {
            expect(ObjectFactory.has('frame')).toBe(true);
        });

        it('должен содержать тип "shape"', () => {
            expect(ObjectFactory.has('shape')).toBe(true);
        });

        it('должен содержать тип "drawing"', () => {
            expect(ObjectFactory.has('drawing')).toBe(true);
        });

        it('должен содержать тип "emoji"', () => {
            expect(ObjectFactory.has('emoji')).toBe(true);
        });

        it('должен содержать тип "image"', () => {
            expect(ObjectFactory.has('image')).toBe(true);
        });

        it('должен содержать тип "comment"', () => {
            expect(ObjectFactory.has('comment')).toBe(true);
        });

        it('должен содержать тип "file"', () => {
            expect(ObjectFactory.has('file')).toBe(true);
        });

        it('должен содержать все 10 зарегистрированных типов', () => {
            const expectedTypes = [
                'frame', 'shape', 'drawing', 'text', 'simple-text',
                'emoji', 'image', 'comment', 'note', 'file',
            ];
            for (const type of expectedTypes) {
                expect(ObjectFactory.has(type)).toBe(true);
            }
        });
    });

    // ═══════════════════════════════════════════
    // has()
    // ═══════════════════════════════════════════
    describe('has()', () => {
        it('должен вернуть false для незарегистрированного типа', () => {
            expect(ObjectFactory.has('unknown')).toBe(false);
        });

        it('должен вернуть false для пустой строки', () => {
            expect(ObjectFactory.has('')).toBe(false);
        });

        it('должен вернуть false для null', () => {
            expect(ObjectFactory.has(null)).toBe(false);
        });

        it('должен вернуть false для undefined', () => {
            expect(ObjectFactory.has(undefined)).toBe(false);
        });
    });

    // ═══════════════════════════════════════════
    // create() — создание объектов
    // ═══════════════════════════════════════════
    describe('create()', () => {
        describe('Создание записки (note)', () => {
            it('должен создать NoteObject', () => {
                const result = ObjectFactory.create('note');

                expect(result).not.toBeNull();
                expect(result.type).toBe('note');
            });

            it('должен передать objectData в конструктор NoteObject', () => {
                const objectData = {
                    properties: { content: 'Записка', fontSize: 24 },
                };

                ObjectFactory.create('note', objectData);

                expect(NoteObject).toHaveBeenCalledWith(objectData);
            });

            it('должен передать пустой объект по умолчанию', () => {
                ObjectFactory.create('note');

                expect(NoteObject).toHaveBeenCalledWith({});
            });
        });

        describe('Создание текста (text)', () => {
            it('должен создать TextObject', () => {
                const result = ObjectFactory.create('text');

                expect(result).not.toBeNull();
                expect(result.type).toBe('text');
            });

            it('должен передать objectData в конструктор TextObject', () => {
                const objectData = { properties: { content: 'Hello' } };
                ObjectFactory.create('text', objectData);

                expect(TextObject).toHaveBeenCalledWith(objectData);
            });
        });

        describe('Создание simple-text (алиас)', () => {
            it('должен создать TextObject для типа simple-text', () => {
                const result = ObjectFactory.create('simple-text');

                expect(result).not.toBeNull();
                expect(result.type).toBe('text');
                expect(TextObject).toHaveBeenCalled();
            });
        });

        describe('Создание фрейма (frame)', () => {
            it('должен создать FrameObject', () => {
                const result = ObjectFactory.create('frame');

                expect(result).not.toBeNull();
                expect(result.type).toBe('frame');
            });

            it('должен передать eventBus в конструктор FrameObject', () => {
                const objectData = { width: 500, height: 400 };
                const mockEventBus = { emit: vi.fn(), on: vi.fn() };

                ObjectFactory.create('frame', objectData, mockEventBus);

                expect(FrameObject).toHaveBeenCalledWith(objectData, mockEventBus);
            });

            it('не должен передавать eventBus если он null', () => {
                const objectData = { width: 500 };

                ObjectFactory.create('frame', objectData, null);

                expect(FrameObject).toHaveBeenCalledWith(objectData);
            });
        });

        describe('Создание фигуры (shape)', () => {
            it('должен создать ShapeObject', () => {
                const result = ObjectFactory.create('shape');

                expect(result).not.toBeNull();
                expect(result.type).toBe('shape');
                expect(ShapeObject).toHaveBeenCalled();
            });
        });

        describe('Неизвестный тип', () => {
            it('должен вернуть null для незарегистрированного типа', () => {
                const result = ObjectFactory.create('nonexistent');
                expect(result).toBeNull();
            });

            it('должен вернуть null для пустой строки', () => {
                const result = ObjectFactory.create('');
                expect(result).toBeNull();
            });

            it('должен вернуть null для null', () => {
                const result = ObjectFactory.create(null);
                expect(result).toBeNull();
            });

            it('должен вернуть null для undefined', () => {
                const result = ObjectFactory.create(undefined);
                expect(result).toBeNull();
            });
        });

        describe('Обработка ошибок конструктора', () => {
            it('должен вернуть null и не упасть при ошибке в конструкторе', () => {
                NoteObject.mockImplementationOnce(() => {
                    throw new Error('Constructor error');
                });

                const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
                const result = ObjectFactory.create('note');

                expect(result).toBeNull();
                expect(consoleSpy).toHaveBeenCalled();
                consoleSpy.mockRestore();
            });

            it('должен залогировать ошибку с указанием типа', () => {
                NoteObject.mockImplementationOnce(() => {
                    throw new Error('Boom');
                });

                const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
                ObjectFactory.create('note');

                expect(consoleSpy).toHaveBeenCalledWith(
                    expect.stringContaining('"note"'),
                    expect.any(Error)
                );
                consoleSpy.mockRestore();
            });
        });
    });

    // ═══════════════════════════════════════════
    // register() — регистрация новых типов
    // ═══════════════════════════════════════════
    describe('register()', () => {
        it('должен зарегистрировать новый тип', () => {
            class CustomObject {}
            ObjectFactory.register('custom', CustomObject);

            expect(ObjectFactory.has('custom')).toBe(true);

            // Очистка
            ObjectFactory.registry.delete('custom');
        });

        it('должен позволять создавать объекты зарегистрированного типа', () => {
            const mockInstance = { type: 'custom' };
            const CustomObject = vi.fn().mockImplementation(() => mockInstance);

            ObjectFactory.register('custom', CustomObject);
            const result = ObjectFactory.create('custom', { foo: 'bar' });

            expect(result).toBe(mockInstance);
            expect(CustomObject).toHaveBeenCalledWith({ foo: 'bar' });

            ObjectFactory.registry.delete('custom');
        });

        it('не должен регистрировать при пустом type', () => {
            const sizeBefore = ObjectFactory.registry.size;
            ObjectFactory.register('', class Dummy {});

            expect(ObjectFactory.registry.size).toBe(sizeBefore);
        });

        it('не должен регистрировать при null type', () => {
            const sizeBefore = ObjectFactory.registry.size;
            ObjectFactory.register(null, class Dummy {});

            expect(ObjectFactory.registry.size).toBe(sizeBefore);
        });

        it('не должен регистрировать при null clazz', () => {
            const sizeBefore = ObjectFactory.registry.size;
            ObjectFactory.register('test-type', null);

            expect(ObjectFactory.registry.size).toBe(sizeBefore);
        });

        it('не должен регистрировать при отсутствии обоих аргументов', () => {
            const sizeBefore = ObjectFactory.registry.size;
            ObjectFactory.register();

            expect(ObjectFactory.registry.size).toBe(sizeBefore);
        });

        it('должен перезаписать существующий тип', () => {
            const OldClass = vi.fn().mockImplementation(() => ({ v: 'old' }));
            const NewClass = vi.fn().mockImplementation(() => ({ v: 'new' }));

            ObjectFactory.register('replaceable', OldClass);
            ObjectFactory.register('replaceable', NewClass);

            const result = ObjectFactory.create('replaceable');
            expect(result.v).toBe('new');
            expect(NewClass).toHaveBeenCalled();
            expect(OldClass).not.toHaveBeenCalled();

            ObjectFactory.registry.delete('replaceable');
        });
    });

    // ═══════════════════════════════════════════
    // Интеграция: полный цикл для записки
    // ═══════════════════════════════════════════
    describe('Интеграция: цикл создания записки через фабрику', () => {
        it('фабрика должна содержать NoteObject и создавать его', () => {
            expect(ObjectFactory.has('note')).toBe(true);

            const objectData = {
                width: 300,
                height: 300,
                properties: {
                    content: 'Тестовая записка',
                    fontSize: 24,
                    backgroundColor: 0xFFF9C4,
                },
            };

            const note = ObjectFactory.create('note', objectData);

            expect(note).not.toBeNull();
            expect(NoteObject).toHaveBeenCalledWith(objectData);
        });

        it('фабрика не должна передавать eventBus для записки', () => {
            const mockEventBus = { emit: vi.fn() };

            ObjectFactory.create('note', {}, mockEventBus);

            expect(NoteObject).toHaveBeenCalledWith({});
            expect(NoteObject).toHaveBeenCalledTimes(1);
            expect(NoteObject.mock.calls[0]).toHaveLength(1);
        });
    });
});
