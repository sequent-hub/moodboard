// tests/core/rendering/LayerManager.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Мокаем весь модуль pixi.js до импорта тестируемого кода
vi.mock('pixi.js', () => ({
    Container: vi.fn().mockImplementation(() => ({
        name: '',
        zIndex: 0,
        sortableChildren: false,
        addChild: vi.fn(),
        removeChild: vi.fn(),
        removeChildren: vi.fn(),
        children: [],
        includes: vi.fn(),
        sortChildren: vi.fn()
    }))
}));

// Импортируем после мока
import * as PIXI from 'pixi.js';
import { LayerManager } from '../../../src/core/rendering/LayerManager.js';

describe('LayerManager', () => {
    let layerManager;
    let mockPixiApp;
    let mockStage;
    let mockGridLayer;
    let mockWorldLayer;

    beforeEach(() => {
        // stage со спаем addChild
        mockStage = { addChild: vi.fn() };

        // PIXI App
        mockPixiApp = { stage: mockStage };

        // создаем менеджер (он сам создаст слои через PIXI.Container и добавит в stage)
        layerManager = new LayerManager(mockPixiApp);

        // берем реальные слои, созданные менеджером
        mockGridLayer = layerManager.layers.get('grid');
        mockWorldLayer = layerManager.layers.get('world');

        // сбрасываем счетчики перед каждым тестом (на всякий случай)
        PIXI.Container.mockClear();
        mockStage.addChild.mockClear();
        if (mockGridLayer) {
            mockGridLayer.addChild.mockClear();
            mockGridLayer.removeChild.mockClear();
            mockGridLayer.removeChildren.mockClear();
            mockGridLayer.sortChildren.mockClear();
        }
        if (mockWorldLayer) {
            mockWorldLayer.addChild.mockClear();
            mockWorldLayer.removeChild.mockClear();
            mockWorldLayer.removeChildren.mockClear();
            mockWorldLayer.sortChildren.mockClear();
        }
    });

    describe('Инициализация', () => {
        describe('Конструктор', () => {
            it('должен корректно инициализировать менеджер слоев', () => {
                expect(layerManager).toBeInstanceOf(LayerManager);
                expect(layerManager.app).toBe(mockPixiApp);
                expect(layerManager.layers).toBeInstanceOf(Map);
            });

            it('должен сохранить ссылку на PIXI приложение', () => {
                expect(layerManager.app).toBe(mockPixiApp);
            });
        });

        describe('_createLayers()', () => {
            it('должен создать слой сетки с правильными свойствами', () => {
                expect(mockGridLayer).toBeTruthy();
                expect(mockGridLayer.name).toBe('gridLayer');
                expect(mockGridLayer.zIndex).toBe(0);
                expect(mockGridLayer.sortableChildren).toBe(false);
            });

            it('должен создать слой мира с правильными свойствами', () => {
                expect(mockWorldLayer).toBeTruthy();
                expect(mockWorldLayer.name).toBe('worldLayer');
                expect(mockWorldLayer.zIndex).toBe(1);
                expect(mockWorldLayer.sortableChildren).toBe(true);
            });

            it('должен добавить слои в главную сцену', () => {
                // Конструктор уже добавил оба слоя
                expect(mockStage.addChild).toHaveBeenCalledWith(mockGridLayer);
                expect(mockStage.addChild).toHaveBeenCalledWith(mockWorldLayer);
                expect(mockStage.addChild).toHaveBeenCalledTimes(2);
            });

            it('должен сохранить ссылки на слои в Map', () => {
                expect(layerManager.layers.get('grid')).toBe(mockGridLayer);
                expect(layerManager.layers.get('world')).toBe(mockWorldLayer);
            });
        });
    });

    describe('Управление слоями', () => {
        describe('getLayer()', () => {
            it('должен возвращать слой сетки по имени', () => {
                const gridLayer = layerManager.getLayer('grid');
                expect(gridLayer).toBe(mockGridLayer);
            });

            it('должен возвращать слой мира по имени', () => {
                const worldLayer = layerManager.getLayer('world');
                expect(worldLayer).toBe(mockWorldLayer);
            });

            it('должен возвращать null для несуществующего слоя', () => {
                const nonExistentLayer = layerManager.getLayer('nonExistent');
                expect(nonExistentLayer).toBeNull();
            });

            it('должен корректно обрабатывать пустое имя слоя', () => {
                const emptyLayer = layerManager.getLayer('');
                expect(emptyLayer).toBeNull();
            });
        });

        describe('getGridLayer()', () => {
            it('должен возвращать слой сетки', () => {
                const gridLayer = layerManager.getGridLayer();
                expect(gridLayer).toBe(mockGridLayer);
            });

            it('должен возвращать слой с правильными свойствами', () => {
                const gridLayer = layerManager.getGridLayer();
                expect(gridLayer.name).toBe('gridLayer');
                expect(gridLayer.zIndex).toBe(0);
            });
        });

        describe('getWorldLayer()', () => {
            it('должен возвращать слой мира', () => {
                const worldLayer = layerManager.getWorldLayer();
                expect(worldLayer).toBe(mockWorldLayer);
            });

            it('должен возвращать слой с правильными свойствами', () => {
                const worldLayer = layerManager.getWorldLayer();
                expect(worldLayer.name).toBe('worldLayer');
                expect(worldLayer.zIndex).toBe(1);
            });
        });
    });

    describe('Работа с сеткой', () => {
        let mockGridInstance;
        let mockGridObject;

        beforeEach(() => {
            mockGridObject = { zIndex: 0, x: 0, y: 0 };
            mockGridInstance = { getPixiObject: vi.fn(() => mockGridObject) };
        });

        describe('setGrid()', () => {
            it('должен очистить слой сетки перед установкой новой сетки', () => {
                layerManager.setGrid(mockGridInstance);
                expect(mockGridLayer.removeChildren).toHaveBeenCalled();
            });

            it('должен установить сетку с правильными свойствами', () => {
                layerManager.setGrid(mockGridInstance);

                expect(mockGridInstance.getPixiObject).toHaveBeenCalled();
                expect(mockGridObject.zIndex).toBe(0);
                expect(mockGridObject.x).toBe(0);
                expect(mockGridObject.y).toBe(0);
                expect(mockGridLayer.addChild).toHaveBeenCalledWith(mockGridObject);
            });

            it('должен корректно обрабатывать сетку без метода getPixiObject', () => {
                const gridWithoutMethod = {};
                expect(() => layerManager.setGrid(gridWithoutMethod)).not.toThrow();
                expect(mockGridLayer.removeChildren).toHaveBeenCalled();
                expect(mockGridLayer.addChild).not.toHaveBeenCalled();
            });

            it('должен корректно обрабатывать null сетку', () => {
                expect(() => layerManager.setGrid(null)).not.toThrow();
                expect(mockGridLayer.removeChildren).toHaveBeenCalled();
                expect(mockGridLayer.addChild).not.toHaveBeenCalled();
            });

            it('должен корректно обрабатывать undefined сетку', () => {
                expect(() => layerManager.setGrid(undefined)).not.toThrow();
                expect(mockGridLayer.removeChildren).toHaveBeenCalled();
                expect(mockGridLayer.addChild).not.toHaveBeenCalled();
            });
        });
    });

    describe('Работа с объектами', () => {
        let mockPixiObject;

        beforeEach(() => {
            mockPixiObject = { name: 'testObject', zIndex: 0 };
        });

        describe('addToWorldLayer()', () => {
            it('должен добавить объект в слой мира', () => {
                layerManager.addToWorldLayer(mockPixiObject);
                expect(mockWorldLayer.addChild).toHaveBeenCalledWith(mockPixiObject);
            });

            it('должен корректно обрабатывать null объект', () => {
                expect(() => layerManager.addToWorldLayer(null)).not.toThrow();
                expect(mockWorldLayer.addChild).not.toHaveBeenCalled();
            });

            it('должен корректно обрабатывать undefined объект', () => {
                expect(() => layerManager.addToWorldLayer(undefined)).not.toThrow();
                expect(mockWorldLayer.addChild).not.toHaveBeenCalled();
            });
        });

        describe('removeFromWorldLayer()', () => {
            it('должен удалить объект из слоя мира', () => {
                layerManager.removeFromWorldLayer(mockPixiObject);
                expect(mockWorldLayer.removeChild).toHaveBeenCalledWith(mockPixiObject);
            });

            it('должен корректно обрабатывать объект, которого нет в слое', () => {
                expect(() => layerManager.removeFromWorldLayer(mockPixiObject)).not.toThrow();
                expect(mockWorldLayer.removeChild).toHaveBeenCalledWith(mockPixiObject);
            });

            it('должен корректно обрабатывать null объект', () => {
                expect(() => layerManager.removeFromWorldLayer(null)).not.toThrow();
                expect(mockWorldLayer.removeChild).not.toHaveBeenCalled();
            });
        });

        describe('getWorldObjects()', () => {
            it('должен возвращать массив объектов в слое мира', () => {
                const testObjects = [{ name: 'testObject', zIndex: 0 }, { name: 'object2' }];
                mockWorldLayer.children = testObjects; // вручную задаем children
                const worldObjects = layerManager.getWorldObjects();
                expect(worldObjects).toEqual(testObjects);
            });

            it('должен возвращать пустой массив для пустого слоя', () => {
                mockWorldLayer.children = [];
                const worldObjects = layerManager.getWorldObjects();
                expect(worldObjects).toEqual([]);
            });
        });

        describe('clearWorldLayer()', () => {
            it('должен очистить слой мира', () => {
                layerManager.clearWorldLayer();
                expect(mockWorldLayer.removeChildren).toHaveBeenCalled();
            });
        });
    });

    describe('Управление Z-индексами', () => {
        let mockObject;

        beforeEach(() => {
            mockObject = { zIndex: 0 };
        });

        describe('setObjectZIndex()', () => {
            it('должен установить Z-индекс для объекта', () => {
                layerManager.setObjectZIndex(mockObject, 5);
                expect(mockObject.zIndex).toBe(5);
            });

            it('должен корректно обрабатывать отрицательный Z-индекс', () => {
                layerManager.setObjectZIndex(mockObject, -5);
                expect(mockObject.zIndex).toBe(-5);
            });

            it('должен корректно обрабатывать нулевой Z-индекс', () => {
                layerManager.setObjectZIndex(mockObject, 0);
                expect(mockObject.zIndex).toBe(0);
            });

            it('должен корректно обрабатывать null объект', () => {
                expect(() => layerManager.setObjectZIndex(null, 5)).not.toThrow();
            });

            it('должен корректно обрабатывать undefined объект', () => {
                expect(() => layerManager.setObjectZIndex(undefined, 5)).not.toThrow();
            });
        });

        describe('sortWorldLayer()', () => {
            it('должен отсортировать объекты в слое мира', () => {
                layerManager.sortWorldLayer();
                expect(mockWorldLayer.sortChildren).toHaveBeenCalled();
            });
        });
    });

    describe('Граничные случаи', () => {
        it('должен корректно работать с null PIXI приложением', () => {
            expect(() => new LayerManager(null)).not.toThrow();
        });

        it('должен корректно работать с PIXI приложением без stage', () => {
            const appWithoutStage = {};
            expect(() => new LayerManager(appWithoutStage)).not.toThrow();
        });

        it('должен корректно обрабатывать вызовы методов с неинициализированными слоями', () => {
            const app = { stage: { addChild: vi.fn() } };
            const emptyLayerManager = new LayerManager(app);
            // эмулируем отсутствие слоев
            emptyLayerManager.layers = new Map();
            expect(() => emptyLayerManager.getGridLayer()).not.toThrow();
            expect(() => emptyLayerManager.getWorldLayer()).not.toThrow();
            expect(() => emptyLayerManager.setGrid(null)).not.toThrow();
            expect(() => emptyLayerManager.addToWorldLayer(null)).not.toThrow();
            expect(() => emptyLayerManager.removeFromWorldLayer(null)).not.toThrow();
            expect(() => emptyLayerManager.clearWorldLayer()).not.toThrow();
            expect(() => emptyLayerManager.sortWorldLayer()).not.toThrow();
        });
    });

    describe('Интеграция с PIXI', () => {
        it('должен корректно использовать PIXI.Container для создания слоев', () => {
            // В конструкторе были созданы два Container
            // (повторный вызов конструктора для подсчета обращений)
            const stage = { addChild: vi.fn() };
            const app = { stage };
            PIXI.Container.mockClear();
            // создаем новый менеджер
            // eslint-disable-next-line no-new
            new LayerManager(app);
            expect(PIXI.Container).toHaveBeenCalledTimes(2);
        });

        it('должен корректно добавлять слои в stage', () => {
            expect(mockStage.addChild).toHaveBeenCalledWith(mockGridLayer);
            expect(mockStage.addChild).toHaveBeenCalledWith(mockWorldLayer);
        });

        it('должен корректно устанавливать свойства слоев', () => {
            expect(mockGridLayer.name).toBe('gridLayer');
            expect(mockWorldLayer.name).toBe('worldLayer');
        });
    });
});