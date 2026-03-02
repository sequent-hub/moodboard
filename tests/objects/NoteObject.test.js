import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Мок pixi.js ---
// NoteObject использует: Container, Graphics, Text, Rectangle, ObservablePoint, filters.BlurFilter
vi.mock('pixi.js', () => {
    const createGraphicsMock = () => ({
        clear: vi.fn().mockReturnThis(),
        beginFill: vi.fn().mockReturnThis(),
        endFill: vi.fn().mockReturnThis(),
        drawRoundedRect: vi.fn().mockReturnThis(),
        drawRect: vi.fn().mockReturnThis(),
        x: 0,
        y: 0,
        skew: { x: 0, y: 0 },
        rotation: 0,
        alpha: 1,
    });

    const createContainerMock = () => ({
        addChild: vi.fn(),
        removeChild: vi.fn(),
        children: [],
        eventMode: 'none',
        interactiveChildren: false,
        pivot: { set: vi.fn(), x: 0, y: 0 },
        hitArea: null,
        containsPoint: null,
        on: vi.fn(),
        _mb: null,
        filters: null,
        alpha: 1,
        getBounds: vi.fn(() => ({ x: 0, y: 0, width: 250, height: 250 })),
    });

    const createTextMock = () => ({
        text: '',
        visible: true,
        resolution: 1,
        roundPixels: false,
        height: 40,
        width: 100,
        anchor: { set: vi.fn(), x: 0, y: 0 },
        x: 0,
        y: 0,
        mask: null,
        style: {
            fontFamily: 'Caveat, Arial, cursive',
            fontSize: 32,
            fill: 0x1A1A1A,
            align: 'center',
            letterSpacing: 0,
            wordWrap: true,
            breakWords: true,
            wordWrapWidth: 218,
            lineHeight: 40,
            padding: 3,
            trim: false,
            resolution: 1,
        },
        updateText: vi.fn(),
    });

    return {
        Container: vi.fn().mockImplementation(() => createContainerMock()),
        Graphics: vi.fn().mockImplementation(() => createGraphicsMock()),
        Text: vi.fn().mockImplementation((content, style) => {
            const mock = createTextMock();
            mock.text = content || '';
            if (style) Object.assign(mock.style, style);
            return mock;
        }),
        Rectangle: vi.fn().mockImplementation((x, y, w, h) => ({ x, y, width: w, height: h })),
        ObservablePoint: vi.fn().mockImplementation((cb, scope, x, y) => ({ x: x || 0, y: y || 0 })),
        filters: {
            BlurFilter: vi.fn().mockImplementation(() => ({ blur: 12 })),
        },
    };
});

import { NoteObject } from '../../src/objects/NoteObject.js';

// ─────────────────────────────────────────────
// Тесты NoteObject
// ─────────────────────────────────────────────
describe('NoteObject', () => {
    let consoleSpy;

    beforeEach(() => {
        vi.clearAllMocks();
        consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    // ═══════════════════════════════════════════
    // Конструктор
    // ═══════════════════════════════════════════
    describe('Конструктор', () => {
        it('должен создать объект с параметрами по умолчанию', () => {
            const note = new NoteObject();

            expect(note.width).toBe(250);
            expect(note.height).toBe(250);
            expect(note.content).toBe('');
            expect(note.fontSize).toBe(32);
            expect(note.backgroundColor).toBe(0xFFF9C4);
            expect(note.borderColor).toBe(0xF9A825);
            expect(note.textColor).toBe(0x1A1A1A);
        });

        it('должен принять кастомные свойства', () => {
            const note = new NoteObject({
                width: 300,
                height: 400,
                properties: {
                    content: 'Тестовая записка',
                    fontSize: 24,
                    backgroundColor: 0xFF0000,
                    borderColor: 0x00FF00,
                    textColor: 0x0000FF,
                    fontFamily: 'Arial',
                },
            });

            expect(note.content).toBe('Тестовая записка');
            expect(note.fontSize).toBe(24);
            expect(note.backgroundColor).toBe(0xFF0000);
            expect(note.borderColor).toBe(0x00FF00);
            expect(note.textColor).toBe(0x0000FF);
        });

        it('должен использовать width/height из properties при отсутствии корневых', () => {
            const note = new NoteObject({
                properties: { width: 180, height: 180 },
            });

            expect(note.width).toBe(180);
            expect(note.height).toBe(180);
        });

        it('должен создать PIXI-контейнер и вложенные объекты', () => {
            const note = new NoteObject();

            expect(note.container).toBeDefined();
            expect(note.graphics).toBeDefined();
            expect(note.textField).toBeDefined();
            expect(note.shadowLayer).toBeDefined();
            expect(note.shadowLeft).toBeDefined();
            expect(note.shadowRight).toBeDefined();
            expect(note.textMask).toBeDefined();
        });

        it('должен включить интерактивность контейнера', () => {
            const note = new NoteObject();

            expect(note.container.eventMode).toBe('static');
            expect(note.container.interactiveChildren).toBe(true);
        });

        it('должен заполнить метаданные container._mb', () => {
            const note = new NoteObject({
                properties: { content: 'Hello', fontSize: 20 },
            });

            expect(note.container._mb).toBeDefined();
            expect(note.container._mb.type).toBe('note');
            expect(note.container._mb.instance).toBe(note);
            expect(note.container._mb.properties.content).toBe('Hello');
            expect(note.container._mb.properties.fontSize).toBe(20);
        });

        it('должен корректно обработать пустой objectData', () => {
            expect(() => new NoteObject({})).not.toThrow();
        });

        it('должен корректно обработать вызов без аргументов', () => {
            expect(() => new NoteObject()).not.toThrow();
        });

        it('должен корректно обработать backgroundColor = 0 (чёрный)', () => {
            const note = new NoteObject({
                properties: { backgroundColor: 0x000000 },
            });

            expect(note.backgroundColor).toBe(0x000000);
        });

        it('должен корректно обработать borderColor = 0 (чёрный)', () => {
            const note = new NoteObject({
                properties: { borderColor: 0x000000 },
            });

            expect(note.borderColor).toBe(0x000000);
        });

        it('должен корректно обработать textColor = 0 (чёрный)', () => {
            const note = new NoteObject({
                properties: { textColor: 0x000000 },
            });

            expect(note.textColor).toBe(0x000000);
        });
    });

    // ═══════════════════════════════════════════
    // getPixi()
    // ═══════════════════════════════════════════
    describe('getPixi()', () => {
        it('должен вернуть контейнер', () => {
            const note = new NoteObject();
            expect(note.getPixi()).toBe(note.container);
        });
    });

    // ═══════════════════════════════════════════
    // setContent()
    // ═══════════════════════════════════════════
    describe('setContent()', () => {
        it('должен обновить текстовое содержимое', () => {
            const note = new NoteObject();
            note.setContent('Новый текст');

            expect(note.content).toBe('Новый текст');
            expect(note.textField.text).toBe('Новый текст');
        });

        it('должен обновить _mb.properties.content', () => {
            const note = new NoteObject({ properties: { content: 'Старый' } });
            note.setContent('Обновлённый');

            expect(note.container._mb.properties.content).toBe('Обновлённый');
        });

        it('должен обработать пустую строку', () => {
            const note = new NoteObject({ properties: { content: 'Было' } });
            note.setContent('');

            expect(note.content).toBe('');
            expect(note.textField.text).toBe('');
        });

        it('должен обработать null/undefined как пустую строку', () => {
            const note = new NoteObject();
            note.setContent(null);
            expect(note.content).toBe('');

            note.setContent(undefined);
            expect(note.content).toBe('');
        });

        it('должен восстановить видимость textField после обновления', () => {
            const note = new NoteObject();
            note.setContent('Текст');

            expect(note.textField.visible).toBe(true);
        });
    });

    // ═══════════════════════════════════════════
    // setText() — алиас
    // ═══════════════════════════════════════════
    describe('setText()', () => {
        it('должен работать как алиас setContent', () => {
            const note = new NoteObject();
            note.setText('Через setText');

            expect(note.content).toBe('Через setText');
            expect(note.textField.text).toBe('Через setText');
        });
    });

    // ═══════════════════════════════════════════
    // hideText() / showText()
    // ═══════════════════════════════════════════
    describe('hideText() / showText()', () => {
        it('hideText() должен скрыть текстовое поле', () => {
            const note = new NoteObject();
            note.textField.visible = true;

            note.hideText();
            expect(note.textField.visible).toBe(false);
        });

        it('showText() должен показать текстовое поле', () => {
            const note = new NoteObject();
            note.textField.visible = false;

            note.showText();
            expect(note.textField.visible).toBe(true);
        });

        it('повторные вызовы hideText() не должны вызывать ошибок', () => {
            const note = new NoteObject();
            expect(() => {
                note.hideText();
                note.hideText();
                note.hideText();
            }).not.toThrow();
        });

        it('повторные вызовы showText() не должны вызывать ошибок', () => {
            const note = new NoteObject();
            expect(() => {
                note.showText();
                note.showText();
                note.showText();
            }).not.toThrow();
        });
    });

    // ═══════════════════════════════════════════
    // setStyle()
    // ═══════════════════════════════════════════
    describe('setStyle()', () => {
        it('должен изменить fontSize', () => {
            const note = new NoteObject();
            note.setStyle({ fontSize: 48 });

            expect(note.fontSize).toBe(48);
            expect(note.textField.style.fontSize).toBe(48);
        });

        it('должен изменить backgroundColor', () => {
            const note = new NoteObject();
            note.setStyle({ backgroundColor: 0xFF5722 });

            expect(note.backgroundColor).toBe(0xFF5722);
        });

        it('должен изменить borderColor', () => {
            const note = new NoteObject();
            note.setStyle({ borderColor: 0x333333 });

            expect(note.borderColor).toBe(0x333333);
        });

        it('должен изменить textColor и обновить стиль PIXI.Text', () => {
            const note = new NoteObject();
            note.setStyle({ textColor: 0xFFFFFF });

            expect(note.textColor).toBe(0xFFFFFF);
            expect(note.textField.style.fill).toBe(0xFFFFFF);
        });

        it('должен изменить fontFamily', () => {
            const note = new NoteObject();
            note.setStyle({ fontFamily: 'Roboto, sans-serif' });

            expect(note.textField.style.fontFamily).toBe('Roboto, sans-serif');
            expect(note.container._mb.properties.fontFamily).toBe('Roboto, sans-serif');
        });

        it('должен обновить только переданные параметры (частичное обновление)', () => {
            const note = new NoteObject({
                properties: {
                    fontSize: 32,
                    backgroundColor: 0xFFF9C4,
                    textColor: 0x1A1A1A,
                },
            });

            note.setStyle({ fontSize: 16 });

            expect(note.fontSize).toBe(16);
            expect(note.backgroundColor).toBe(0xFFF9C4);
            expect(note.textColor).toBe(0x1A1A1A);
        });

        it('должен обновить _mb.properties', () => {
            const note = new NoteObject();
            note.setStyle({ fontSize: 20, backgroundColor: 0xAAAAAA });

            expect(note.container._mb.properties.fontSize).toBe(20);
            expect(note.container._mb.properties.backgroundColor).toBe(0xAAAAAA);
        });

        it('должен обновить lineHeight при изменении fontSize', () => {
            const note = new NoteObject();
            note.setStyle({ fontSize: 24 });

            expect(note.textField.style.lineHeight).toBe(note._computeLineHeightPx(24));
        });

        it('не должен падать при вызове без аргументов', () => {
            const note = new NoteObject();
            expect(() => note.setStyle()).not.toThrow();
        });

        it('не должен падать при вызове с пустым объектом', () => {
            const note = new NoteObject();
            expect(() => note.setStyle({})).not.toThrow();
        });
    });

    // ═══════════════════════════════════════════
    // updateSize()
    // ═══════════════════════════════════════════
    describe('updateSize()', () => {
        it('должен обновить размеры записки', () => {
            const note = new NoteObject();
            note.updateSize({ width: 400, height: 400 });

            expect(note.width).toBe(400);
            expect(note.height).toBe(400);
        });

        it('должен поддерживать квадратную форму (берёт максимум)', () => {
            const note = new NoteObject();
            note.updateSize({ width: 300, height: 500 });

            expect(note.width).toBe(500);
            expect(note.height).toBe(500);
        });

        it('должен ограничивать минимальный размер', () => {
            const note = new NoteObject();
            note.updateSize({ width: 10, height: 10 });

            expect(note.width).toBeGreaterThanOrEqual(80);
            expect(note.height).toBeGreaterThanOrEqual(80);
        });

        it('не должен падать при null', () => {
            const note = new NoteObject();
            expect(() => note.updateSize(null)).not.toThrow();
        });

        it('не должен падать при undefined', () => {
            const note = new NoteObject();
            expect(() => note.updateSize(undefined)).not.toThrow();
        });

        it('должен обновить hitArea', () => {
            const note = new NoteObject();
            note.updateSize({ width: 350, height: 350 });

            expect(note.container.hitArea).toBeDefined();
        });
    });

    // ═══════════════════════════════════════════
    // updateCrispnessForZoom()
    // ═══════════════════════════════════════════
    describe('updateCrispnessForZoom()', () => {
        it('должен обновить resolution текста при зуме', () => {
            const note = new NoteObject();
            note.textField.resolution = 1;

            note.updateCrispnessForZoom(2, 1);

            expect(note.textField.resolution).toBe(2);
        });

        it('должен учитывать devicePixelRatio', () => {
            const note = new NoteObject();
            note.textField.resolution = 1;

            note.updateCrispnessForZoom(1, 2);

            expect(note.textField.resolution).toBe(2);
        });

        it('должен комбинировать worldScale и deviceResolution', () => {
            const note = new NoteObject();
            note.textField.resolution = 1;

            note.updateCrispnessForZoom(2, 2);

            expect(note.textField.resolution).toBe(4);
        });

        it('не должен падать при отсутствии textField', () => {
            const note = new NoteObject();
            note.textField = null;

            expect(() => note.updateCrispnessForZoom(2, 1)).not.toThrow();
        });

        it('должен корректно обработать нулевой worldScale', () => {
            const note = new NoteObject();
            expect(() => note.updateCrispnessForZoom(0, 1)).not.toThrow();
        });

        it('должен корректно обработать отрицательные значения', () => {
            const note = new NoteObject();
            expect(() => note.updateCrispnessForZoom(-1, -1)).not.toThrow();
        });

        it('не должен обновлять resolution если значение не изменилось', () => {
            const note = new NoteObject();
            note.textField.resolution = 1;
            note.textField.updateText.mockClear();

            note.updateCrispnessForZoom(1, 1);

            expect(note.textField.updateText).not.toHaveBeenCalled();
        });

        it('должен включить roundPixels при обновлении', () => {
            const note = new NoteObject();
            note.textField.resolution = 1;

            note.updateCrispnessForZoom(3, 1);

            expect(note.textField.roundPixels).toBe(true);
        });
    });

    // ═══════════════════════════════════════════
    // Внутренние методы
    // ═══════════════════════════════════════════
    describe('Внутренние методы', () => {
        describe('_getVisibleTextWidth()', () => {
            it('должен вернуть ширину с учётом горизонтального padding (16px * 2)', () => {
                const note = new NoteObject();
                const expected = Math.max(1, Math.min(360, 250 - 32));

                expect(note._getVisibleTextWidth()).toBe(expected);
            });

            it('должен вернуть не более 360', () => {
                const note = new NoteObject({ width: 1000 });
                expect(note._getVisibleTextWidth()).toBeLessThanOrEqual(360);
            });

            it('должен вернуть не менее 1', () => {
                const note = new NoteObject({ width: 10 });
                expect(note._getVisibleTextWidth()).toBeGreaterThanOrEqual(1);
            });
        });

        describe('_computeLineHeightPx()', () => {
            it('должен вернуть корректную высоту строки для fontSize <= 12', () => {
                const note = new NoteObject();
                expect(note._computeLineHeightPx(10)).toBe(Math.round(10 * 1.40));
                expect(note._computeLineHeightPx(12)).toBe(Math.round(12 * 1.40));
            });

            it('должен вернуть корректную высоту строки для fontSize 13–18', () => {
                const note = new NoteObject();
                expect(note._computeLineHeightPx(14)).toBe(Math.round(14 * 1.34));
                expect(note._computeLineHeightPx(18)).toBe(Math.round(18 * 1.34));
            });

            it('должен вернуть корректную высоту строки для fontSize 19–36', () => {
                const note = new NoteObject();
                expect(note._computeLineHeightPx(24)).toBe(Math.round(24 * 1.26));
                expect(note._computeLineHeightPx(36)).toBe(Math.round(36 * 1.26));
            });

            it('должен вернуть корректную высоту строки для fontSize 37–48', () => {
                const note = new NoteObject();
                expect(note._computeLineHeightPx(40)).toBe(Math.round(40 * 1.24));
                expect(note._computeLineHeightPx(48)).toBe(Math.round(48 * 1.24));
            });

            it('должен вернуть корректную высоту строки для fontSize 49–72', () => {
                const note = new NoteObject();
                expect(note._computeLineHeightPx(60)).toBe(Math.round(60 * 1.22));
                expect(note._computeLineHeightPx(72)).toBe(Math.round(72 * 1.22));
            });

            it('должен вернуть корректную высоту строки для fontSize 73–96', () => {
                const note = new NoteObject();
                expect(note._computeLineHeightPx(80)).toBe(Math.round(80 * 1.20));
                expect(note._computeLineHeightPx(96)).toBe(Math.round(96 * 1.20));
            });

            it('должен вернуть корректную высоту строки для fontSize > 96', () => {
                const note = new NoteObject();
                expect(note._computeLineHeightPx(120)).toBe(Math.round(120 * 1.18));
            });
        });

        describe('_fitTextToBounds()', () => {
            it('не должен падать при вызове', () => {
                const note = new NoteObject();
                expect(() => note._fitTextToBounds()).not.toThrow();
            });

            it('не должен падать при отсутствии textField', () => {
                const note = new NoteObject();
                note.textField = null;
                expect(() => note._fitTextToBounds()).not.toThrow();
            });

            it('не должен уменьшать шрифт ниже минимального размера (8px)', () => {
                const note = new NoteObject({
                    properties: { fontSize: 32 },
                });
                // Эмулируем текст, который больше контейнера
                note.textField.height = 9999;
                note._fitTextToBounds();

                expect(note.textField.style.fontSize).toBeGreaterThanOrEqual(8);
            });
        });
    });

    // ═══════════════════════════════════════════
    // Граничные случаи и устойчивость
    // ═══════════════════════════════════════════
    describe('Граничные случаи', () => {
        it('должен пережить полный цикл: создание → изменение текста → стиль → размер', () => {
            expect(() => {
                const note = new NoteObject({ properties: { content: 'Тест' } });
                note.setContent('Обновлённый текст');
                note.setStyle({ fontSize: 24, backgroundColor: 0xCCCCCC });
                note.updateSize({ width: 300, height: 300 });
                note.hideText();
                note.showText();
                note.updateCrispnessForZoom(1.5, 2);
            }).not.toThrow();
        });

        it('должен корректно работать с Unicode-контентом', () => {
            const note = new NoteObject();
            note.setContent('Привет 🌍 мир! 你好世界');

            expect(note.content).toBe('Привет 🌍 мир! 你好世界');
        });

        it('должен корректно работать с многострочным контентом', () => {
            const note = new NoteObject();
            note.setContent('Строка 1\nСтрока 2\nСтрока 3');

            expect(note.content).toBe('Строка 1\nСтрока 2\nСтрока 3');
        });

        it('должен корректно работать с очень длинным текстом', () => {
            const note = new NoteObject();
            const longText = 'А'.repeat(10000);

            expect(() => note.setContent(longText)).not.toThrow();
            expect(note.content).toBe(longText);
        });
    });
});
