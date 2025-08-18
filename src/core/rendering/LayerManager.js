import * as PIXI from 'pixi.js';

/**
 * Менеджер слоев PIXI приложения
 * Управляет созданием и организацией слоев
 */
export class LayerManager {
    constructor(pixiApp) {
        this.app = pixiApp;
        this.layers = new Map();
        this._createLayers();
    }

    /**
     * Создает основные слои приложения
     * @private
     */
    _createLayers() {
        // Слой сетки (не двигается)
        this.gridLayer = new PIXI.Container();
        this.gridLayer.name = 'gridLayer';
        this.gridLayer.zIndex = 0;
        this.app.stage.addChild(this.gridLayer);

        // Слой мира с объектами (двигается)
        this.worldLayer = new PIXI.Container();
        this.worldLayer.name = 'worldLayer';
        this.worldLayer.zIndex = 1;
        this.worldLayer.sortableChildren = true;
        this.app.stage.addChild(this.worldLayer);

        // Сохраняем ссылки на слои
        this.layers.set('grid', this.gridLayer);
        this.layers.set('world', this.worldLayer);
    }

    /**
     * Получить слой по имени
     * @param {string} layerName - Имя слоя
     * @returns {PIXI.Container|null} Слой или null если не найден
     */
    getLayer(layerName) {
        return this.layers.get(layerName) || null;
    }

    /**
     * Получить слой сетки
     * @returns {PIXI.Container} Слой сетки
     */
    getGridLayer() {
        return this.gridLayer;
    }

    /**
     * Получить слой мира
     * @returns {PIXI.Container} Слой мира
     */
    getWorldLayer() {
        return this.worldLayer;
    }

    /**
     * Установить сетку в слой сетки
     * @param {Object} gridInstance - Экземпляр сетки
     */
    setGrid(gridInstance) {
        if (!this.gridLayer) return;
        
        // Очищаем слой сетки
        this.gridLayer.removeChildren();
        
        if (gridInstance && gridInstance.getPixiObject) {
            const gridObject = gridInstance.getPixiObject();
            gridObject.zIndex = 0;
            gridObject.x = 0;
            gridObject.y = 0;
            this.gridLayer.addChild(gridObject);
        }
    }

    /**
     * Добавить объект в слой мира
     * @param {PIXI.DisplayObject} pixiObject - PIXI объект
     */
    addToWorldLayer(pixiObject) {
        if (this.worldLayer) {
            this.worldLayer.addChild(pixiObject);
        }
    }

    /**
     * Удалить объект из слоя мира
     * @param {PIXI.DisplayObject} pixiObject - PIXI объект
     */
    removeFromWorldLayer(pixiObject) {
        if (this.worldLayer && this.worldLayer.children.includes(pixiObject)) {
            this.worldLayer.removeChild(pixiObject);
        }
    }

    /**
     * Получить все объекты в слое мира
     * @returns {PIXI.DisplayObject[]} Массив объектов
     */
    getWorldObjects() {
        return this.worldLayer ? this.worldLayer.children : [];
    }

    /**
     * Очистить слой мира
     */
    clearWorldLayer() {
        if (this.worldLayer) {
            this.worldLayer.removeChildren();
        }
    }

    /**
     * Установить Z-индекс для объекта
     * @param {PIXI.DisplayObject} pixiObject - PIXI объект
     * @param {number} zIndex - Z-индекс
     */
    setObjectZIndex(pixiObject, zIndex) {
        if (pixiObject) {
            pixiObject.zIndex = zIndex;
        }
    }

    /**
     * Сортировать объекты в слое мира по Z-индексу
     */
    sortWorldLayer() {
        if (this.worldLayer) {
            this.worldLayer.sortChildren();
        }
    }
}
