// Создайте файл tests/core/rendering/PixiRenderer.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Мокаем весь модуль pixi.js inline
vi.mock('pixi.js', () => ({
    Application: vi.fn().mockImplementation(() => ({
        stage: {
            removeChildren: vi.fn(),
            addChild: vi.fn(),
            removeChild: vi.fn()
        },
        view: document.createElement('canvas'),
        renderer: {
            width: 800,
            height: 600,
            backgroundColor: 0x000000,
            antialias: true,
            resize: vi.fn()
        },
        destroy: vi.fn()
    }))
}));

// Импортируем ПОСЛЕ мока
import { PixiRenderer } from '../../../src/core/rendering/PixiRenderer.js';

describe('PixiRenderer', () => {
    let renderer;
    let mockContainer;
    let mockOptions;
    let mockPixiApp;
    let MockPixiApplication;

    beforeEach(async () => {
        // Сбрасываем моки
        vi.clearAllMocks();

        // Получаем мок из замоканного модуля
        const pixiModule = await import('pixi.js');
        MockPixiApplication = pixiModule.Application;
        mockPixiApp = MockPixiApplication();

        // Создаем мок контейнера
        mockContainer = {
            appendChild: vi.fn()
        };

        // Создаем мок опции
        mockOptions = {
            width: 800,
            height: 600,
            backgroundColor: 0x000000
        };

        // Создаем экземпляр рендерера
        renderer = new PixiRenderer(mockContainer, mockOptions);
    });

    describe('Инициализация', () => {
        describe('Конструктор', () => {
            it('должен корректно инициализировать рендерер', () => {
                expect(renderer.container).toBe(mockContainer);
                expect(renderer.options).toBe(mockOptions);
                expect(renderer.app).toBeNull();
            });

            it('должен сохранить переданные опции', () => {
                const customOptions = {
                    width: 1920,
                    height: 1080,
                    backgroundColor: 0xFFFFFF
                };

                const customRenderer = new PixiRenderer(mockContainer, customOptions);
                expect(customRenderer.options).toBe(customOptions);
            });
        });

        describe('init()', () => {
            it('должен создать PIXI приложение с правильными параметрами', async () => {
                await renderer.init();

                expect(MockPixiApplication).toHaveBeenCalledWith({
                    width: 800,
                    height: 600,
                    backgroundColor: 0x000000,
                    antialias: true
                });
            });

            it('должен добавить canvas в контейнер', async () => {
                await renderer.init();

                expect(mockContainer.appendChild).toHaveBeenCalledWith(renderer.app.view);
            });

            it('должен установить app после инициализации', async () => {
                expect(renderer.app).toBeNull();

                await renderer.init();

                expect(renderer.app).toBeTruthy();
                expect(renderer.app).toHaveProperty('stage');
                expect(renderer.app).toHaveProperty('view');
                expect(renderer.app).toHaveProperty('renderer');
            });

            it('должен вернуть Promise', async () => {
                const initPromise = renderer.init();
                expect(initPromise).toBeInstanceOf(Promise);

                await initPromise;
            });
        });

        describe('isInitialized()', () => {
            it('должен возвращать false до инициализации', () => {
                expect(renderer.isInitialized()).toBe(false);
            });

            it('должен возвращать true после инициализации', async () => {
                await renderer.init();
                expect(renderer.isInitialized()).toBe(true);
            });
        });

        describe('getApp()', () => {
            it('должен возвращать null до инициализации', () => {
                expect(renderer.getApp()).toBeNull();
            });

            it('должен возвращать PIXI приложение после инициализации', async () => {
                await renderer.init();
                expect(renderer.getApp()).toBeTruthy();
                expect(renderer.getApp()).toHaveProperty('stage');
            });
        });

        describe('getStage()', () => {
            it('должен возвращать null до инициализации', () => {
                expect(renderer.getStage()).toBeNull();
            });

            it('должен возвращать главную сцену после инициализации', async () => {
                await renderer.init();
                expect(renderer.getStage()).toBeTruthy();
                expect(renderer.getStage()).toHaveProperty('removeChildren');
            });
        });

        describe('getView()', () => {
            it('должен возвращать null до инициализации', () => {
                expect(renderer.getView()).toBeNull();
            });

            it('должен возвращать canvas элемент после инициализации', async () => {
                await renderer.init();
                expect(renderer.getView()).toBeTruthy();
                expect(renderer.getView().tagName).toBe('CANVAS');
            });
        });
    });

    describe('Управление размером', () => {
        beforeEach(async () => {
            await renderer.init();
        });

        describe('resize()', () => {
            it('должен изменить размер приложения', () => {
                renderer.resize(1920, 1080);
                expect(renderer.app.renderer.resize).toHaveBeenCalledWith(1920, 1080);
            });

            it('должен корректно обрабатывать нулевые размеры', () => {
                renderer.resize(0, 0);
                expect(renderer.app.renderer.resize).toHaveBeenCalledWith(0, 0);
            });

            it('должен корректно обрабатывать дробные размеры', () => {
                renderer.resize(800.5, 600.7);
                expect(renderer.app.renderer.resize).toHaveBeenCalledWith(800.5, 600.7);
            });
        });

        describe('getSize()', () => {
            it('должен возвращать текущий размер приложения', () => {
                const size = renderer.getSize();
                expect(size).toEqual({ width: 800, height: 600 });
            });

            it('должен возвращать нулевой размер до инициализации', () => {
                const uninitializedRenderer = new PixiRenderer(mockContainer, mockOptions);
                const size = uninitializedRenderer.getSize();
                expect(size).toEqual({ width: 0, height: 0 });
            });
        });
    });

    describe('Настройки рендерера', () => {
        beforeEach(async () => {
            await renderer.init();
        });

        describe('setBackgroundColor()', () => {
            it('должен установить цвет фона', () => {
                renderer.setBackgroundColor(0xFFFFFF);
                expect(renderer.app.renderer.backgroundColor).toBe(0xFFFFFF);
            });

            it('должен корректно обрабатывать нулевой цвет', () => {
                renderer.setBackgroundColor(0x000000);
                expect(renderer.app.renderer.backgroundColor).toBe(0x000000);
            });

            it('должен корректно обрабатывать различные цвета', () => {
                renderer.setBackgroundColor(0xFF0000);
                expect(renderer.app.renderer.backgroundColor).toBe(0xFF0000);

                renderer.setBackgroundColor(0x00FF00);
                expect(renderer.app.renderer.backgroundColor).toBe(0x00FF00);

                renderer.setBackgroundColor(0x0000FF);
                expect(renderer.app.renderer.backgroundColor).toBe(0x0000FF);
            });
        });

        describe('getBackgroundColor()', () => {
            it('должен возвращать текущий цвет фона', () => {
                renderer.app.renderer.backgroundColor = 0x123456;
                expect(renderer.getBackgroundColor()).toBe(0x123456);
            });

            it('должен возвращать черный цвет по умолчанию до инициализации', () => {
                const uninitializedRenderer = new PixiRenderer(mockContainer, mockOptions);
                expect(uninitializedRenderer.getBackgroundColor()).toBe(0x000000);
            });
        });

        describe('setAntialias()', () => {
            it('должен включить сглаживание', () => {
                renderer.setAntialias(true);
                expect(renderer.app.renderer.antialias).toBe(true);
            });

            it('должен выключить сглаживание', () => {
                renderer.setAntialias(false);
                expect(renderer.app.renderer.antialias).toBe(false);
            });

            it('должен корректно переключать состояние', () => {
                renderer.setAntialias(true);
                expect(renderer.app.renderer.antialias).toBe(true);

                renderer.setAntialias(false);
                expect(renderer.app.renderer.antialias).toBe(false);

                renderer.setAntialias(true);
                expect(renderer.app.renderer.antialias).toBe(true);
            });
        });

        describe('getAntialias()', () => {
            it('должен возвращать текущее состояние сглаживания', () => {
                renderer.app.renderer.antialias = true;
                expect(renderer.getAntialias()).toBe(true);

                renderer.app.renderer.antialias = false;
                expect(renderer.getAntialias()).toBe(false);
            });

            it('должен возвращать false по умолчанию до инициализации', () => {
                const uninitializedRenderer = new PixiRenderer(mockContainer, mockOptions);
                expect(uninitializedRenderer.getAntialias()).toBe(false);
            });
        });
    });

    describe('Управление сценой', () => {
        beforeEach(async () => {
            await renderer.init();
        });

        describe('clearStage()', () => {
            it('должен очистить главную сцену', () => {
                renderer.clearStage();
                expect(renderer.app.stage.removeChildren).toHaveBeenCalled();
            });

            it('должен корректно обрабатывать вызов до инициализации', () => {
                const uninitializedRenderer = new PixiRenderer(mockContainer, mockOptions);
                expect(() => uninitializedRenderer.clearStage()).not.toThrow();
            });
        });
    });

    describe('Уничтожение', () => {
        beforeEach(async () => {
            await renderer.init();
        });

        describe('destroy()', () => {
            it('должен уничтожить PIXI приложение', () => {
                // Сохраняем ссылку на приложение перед уничтожением
                const app = renderer.app;
                renderer.destroy();
                expect(app.destroy).toHaveBeenCalledWith(true);
            });

            it('должен обнулить ссылку на приложение', () => {
                expect(renderer.app).toBeTruthy();

                renderer.destroy();
                expect(renderer.app).toBeNull();
            });

            it('должен корректно обрабатывать повторный вызов', () => {
                renderer.destroy();
                expect(() => renderer.destroy()).not.toThrow();
            });

            it('должен корректно обрабатывать вызов до инициализации', () => {
                const uninitializedRenderer = new PixiRenderer(mockContainer, mockOptions);
                expect(() => uninitializedRenderer.destroy()).not.toThrow();
            });
        });
    });

    describe('Обработка ошибок инициализации', () => {
        it('должен корректно обрабатывать ошибки в PIXI.Application', async () => {
            MockPixiApplication.mockImplementationOnce(() => {
                throw new Error('PIXI Application creation failed');
            });

            await expect(renderer.init()).rejects.toThrow('PIXI Application creation failed');
            expect(renderer.app).toBeNull();
        });

        it('должен корректно обрабатывать ошибки appendChild', async () => {
            mockContainer.appendChild.mockImplementationOnce(() => {
                throw new Error('DOM manipulation failed');
            });

            await expect(renderer.init()).rejects.toThrow('DOM manipulation failed');
            expect(renderer.app).toBeTruthy(); // PIXI приложение создано, но не добавлено в DOM
        });
    });

    describe('Повторная инициализация', () => {
        it('должен пересоздать приложение при повторном вызове init()', async () => {
            await renderer.init();
            const firstApp = renderer.app;

            // Сбрасываем мок
            vi.clearAllMocks();

            await renderer.init();
            const secondApp = renderer.app;

            expect(firstApp).not.toBe(secondApp);
            expect(MockPixiApplication).toHaveBeenCalledTimes(1);
        });
    });

    describe('Граничные случаи', () => {
        it('должен корректно работать с пустыми опциями', () => {
            const emptyOptions = {};
            const rendererWithEmptyOptions = new PixiRenderer(mockContainer, emptyOptions);

            expect(rendererWithEmptyOptions.options).toEqual(emptyOptions);
        });

        it('должен корректно работать с null контейнером', () => {
            const rendererWithNullContainer = new PixiRenderer(null, mockOptions);
            expect(rendererWithNullContainer.container).toBeNull();
        });

        it('должен корректно обрабатывать вызовы методов с неинициализированным приложением', () => {
            expect(() => renderer.resize(100, 100)).not.toThrow();
            expect(() => renderer.setBackgroundColor(0xFFFFFF)).not.toThrow();
            expect(() => renderer.setAntialias(true)).not.toThrow();
            expect(() => renderer.clearStage()).not.toThrow();
        });
    });
});