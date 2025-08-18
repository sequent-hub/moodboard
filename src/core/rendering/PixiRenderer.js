import * as PIXI from 'pixi.js';

/**
 * Основной рендерер PIXI приложения
 * Отвечает за инициализацию PIXI и базовую настройку
 */
export class PixiRenderer {
    constructor(container, options) {
        this.container = container;
        this.options = options;
        this.app = null;
    }

    /**
     * Инициализировать PIXI приложение
     * @returns {Promise<void>}
     */
    async init() {
        this.app = new PIXI.Application({
            width: this.options.width,
            height: this.options.height,
            backgroundColor: this.options.backgroundColor,
            antialias: true
        });

        this.container.appendChild(this.app.view);
    }

    /**
     * Получить PIXI приложение
     * @returns {PIXI.Application} PIXI приложение
     */
    getApp() {
        return this.app;
    }

    /**
     * Получить главную сцену
     * @returns {PIXI.Container} Главная сцена
     */
    getStage() {
        return this.app ? this.app.stage : null;
    }

    /**
     * Получить view (canvas элемент)
     * @returns {HTMLCanvasElement} Canvas элемент
     */
    getView() {
        return this.app ? this.app.view : null;
    }

    /**
     * Изменить размер приложения
     * @param {number} width - Новая ширина
     * @param {number} height - Новая высота
     */
    resize(width, height) {
        if (this.app) {
            this.app.renderer.resize(width, height);
        }
    }

    /**
     * Получить текущий размер
     * @returns {{width: number, height: number}} Размер приложения
     */
    getSize() {
        if (this.app) {
            return {
                width: this.app.renderer.width,
                height: this.app.renderer.height
            };
        }
        return { width: 0, height: 0 };
    }

    /**
     * Установить цвет фона
     * @param {number} color - Цвет фона
     */
    setBackgroundColor(color) {
        if (this.app) {
            this.app.renderer.backgroundColor = color;
        }
    }

    /**
     * Получить цвет фона
     * @returns {number} Цвет фона
     */
    getBackgroundColor() {
        return this.app ? this.app.renderer.backgroundColor : 0x000000;
    }

    /**
     * Включить/выключить сглаживание
     * @param {boolean} enabled - Включить сглаживание
     */
    setAntialias(enabled) {
        if (this.app) {
            this.app.renderer.antialias = enabled;
        }
    }

    /**
     * Получить состояние сглаживания
     * @returns {boolean} Включено ли сглаживание
     */
    getAntialias() {
        return this.app ? this.app.renderer.antialias : false;
    }

    /**
     * Очистить сцену
     */
    clearStage() {
        if (this.app && this.app.stage) {
            this.app.stage.removeChildren();
        }
    }

    /**
     * Уничтожить приложение
     */
    destroy() {
        if (this.app) {
            this.app.destroy(true);
            this.app = null;
        }
    }

    /**
     * Проверить, инициализировано ли приложение
     * @returns {boolean} true если приложение инициализировано
     */
    isInitialized() {
        return this.app !== null;
    }
}
