import * as PIXI from 'pixi.js';
import { GridFactory } from '../grid/GridFactory.js';

/**
 * Объект доски - представляет саму доску как объект с настройками
 */
export class BoardObject {
    constructor(boardData = {}) {
        this.id = boardData.id || 'board_' + Date.now();
        this.type = 'board';
        
        // Основные свойства доски
        this.name = boardData.name || 'Untitled Board';
        this.description = boardData.description || '';
        this.author = boardData.author || '';
        this.created = boardData.created || new Date().toISOString();
        this.modified = new Date().toISOString();
        
        // Размеры и viewport
        this.width = boardData.width || 1920;
        this.height = boardData.height || 1080;
        this.viewport = {
            x: 0,
            y: 0,
            zoom: 1,
            ...boardData.viewport
        };
        
        // Настройки внешнего вида
        this.background = {
            type: 'color', // 'color' | 'gradient' | 'image'
            color: 0xF5F5F5,
            gradient: null,
            image: null,
            ...boardData.background
        };
        
        // Настройки сетки
        this.gridConfig = {
            type: 'line',
            enabled: false,
            size: 20,
            color: 0xE0E0E0,
            opacity: 0.5,
            ...boardData.grid
        };
        
        // Создаем объект сетки
        this.grid = GridFactory.createGrid(this.gridConfig.type, {
            ...this.gridConfig,
            width: this.width,
            height: this.height
        });
        
        // Настройки направляющих
        this.guides = {
            enabled: false,
            color: 0x007bff,
            opacity: 0.8,
            lines: [], // массив линий направляющих
            ...boardData.guides
        };
        
        // PIXI объекты для отображения
        this.container = new PIXI.Container();
        this.backgroundSprite = null;
        this.guidesGraphics = null;
        
        this.createVisuals();
    }
    
    /**
     * Создает визуальные элементы доски
     */
    createVisuals() {
        this.createBackground();
        this.updateGrid();
        this.createGuides();
    }
    
    /**
     * Создает фон доски
     */
    createBackground() {
        // Удаляем старый фон
        if (this.backgroundSprite) {
            this.container.removeChild(this.backgroundSprite);
        }
        
        const graphics = new PIXI.Graphics();
        
        switch (this.background.type) {
            case 'color':
                graphics.beginFill(this.background.color);
                graphics.drawRect(0, 0, this.width, this.height);
                graphics.endFill();
                break;
                
            case 'gradient':
                // TODO: Реализовать градиентный фон
                graphics.beginFill(this.background.color);
                graphics.drawRect(0, 0, this.width, this.height);
                graphics.endFill();
                break;
                
            case 'image':
                // TODO: Реализовать фоновое изображение
                graphics.beginFill(this.background.color);
                graphics.drawRect(0, 0, this.width, this.height);
                graphics.endFill();
                break;
        }
        
        this.backgroundSprite = graphics;
        this.container.addChildAt(this.backgroundSprite, 0);
    }
    
    /**
     * Обновляет сетку
     */
    updateGrid() {
        // Удаляем старую сетку из контейнера
        if (this.grid && this.container.children.includes(this.grid.getPixiObject())) {
            this.container.removeChild(this.grid.getPixiObject());
        }
        
        // Обновляем сетку
        this.grid.resize(this.width, this.height);
        this.grid.updateVisual();
        
        // Добавляем сетку в контейнер (после фона, но перед направляющими)
        if (this.grid.enabled) {
            const backgroundIndex = this.backgroundSprite ? 1 : 0;
            this.container.addChildAt(this.grid.getPixiObject(), backgroundIndex);
        }
    }
    
    /**
     * Создает направляющие
     */
    createGuides() {
        if (this.guidesGraphics) {
            this.container.removeChild(this.guidesGraphics);
        }
        
        if (!this.guides.enabled || !this.guides.lines.length) return;
        
        const graphics = new PIXI.Graphics();
        graphics.lineStyle(2, this.guides.color, this.guides.opacity);
        
        this.guides.lines.forEach(line => {
            if (line.type === 'vertical') {
                graphics.moveTo(line.position, 0);
                graphics.lineTo(line.position, this.height);
            } else if (line.type === 'horizontal') {
                graphics.moveTo(0, line.position);
                graphics.lineTo(this.width, line.position);
            }
        });
        
        this.guidesGraphics = graphics;
        this.container.addChild(this.guidesGraphics);
    }
    
    /**
     * Обновляет фон доски
     */
    setBackground(backgroundConfig) {
        this.background = { ...this.background, ...backgroundConfig };
        this.createBackground();
        this.markModified();
    }
    
    /**
     * Включает/выключает сетку
     */
    toggleGrid(enabled = !this.grid.enabled) {
        this.grid.setEnabled(enabled);
        this.gridConfig.enabled = enabled;
        this.updateGrid();
        this.markModified();
    }
    
    /**
     * Настраивает сетку
     */
    setGridSettings(gridConfig) {
        this.gridConfig = { ...this.gridConfig, ...gridConfig };
        
        // Если изменился тип сетки, создаем новую
        if (gridConfig.type && gridConfig.type !== this.grid.type) {
            this.grid.destroy();
            this.grid = GridFactory.createGrid(gridConfig.type, {
                ...this.gridConfig,
                width: this.width,
                height: this.height
            });
        } else {
            // Обновляем настройки существующей сетки
            Object.keys(gridConfig).forEach(key => {
                if (key !== 'type' && typeof this.grid[`set${key.charAt(0).toUpperCase() + key.slice(1)}`] === 'function') {
                    this.grid[`set${key.charAt(0).toUpperCase() + key.slice(1)}`](gridConfig[key]);
                }
            });
        }
        
        this.updateGrid();
        this.markModified();
    }
    
    /**
     * Изменяет тип сетки
     */
    setGridType(type) {
        this.setGridSettings({ type });
    }
    
    /**
     * Устанавливает пресет сетки
     */
    setGridPreset(presetName) {
        const newGrid = GridFactory.createPreset(presetName);
        this.grid.destroy();
        this.grid = newGrid;
        this.gridConfig = newGrid.serialize();
        this.grid.resize(this.width, this.height);
        this.updateGrid();
        this.markModified();
    }
    
    /**
     * Привязывает точку к сетке
     */
    snapToGrid(x, y) {
        return this.grid.snapToGrid(x, y);
    }
    
    /**
     * Добавляет направляющую
     */
    addGuide(type, position) {
        this.guides.lines.push({ type, position });
        this.createGuides();
        this.markModified();
    }
    
    /**
     * Удаляет направляющую
     */
    removeGuide(index) {
        this.guides.lines.splice(index, 1);
        this.createGuides();
        this.markModified();
    }
    
    /**
     * Устанавливает viewport (позиция и зум)
     */
    setViewport(x, y, zoom) {
        this.viewport = { x, y, zoom };
        this.markModified();
    }
    
    /**
     * Изменяет размеры доски
     */
    resize(width, height) {
        this.width = width;
        this.height = height;
        this.grid.resize(width, height);
        this.createVisuals();
        this.markModified();
    }
    
    /**
     * Помечает доску как измененную
     */
    markModified() {
        this.modified = new Date().toISOString();
    }
    
    /**
     * Возвращает PIXI контейнер
     */
    getPixiObject() {
        return this.container;
    }
    
    /**
     * Сериализует данные доски
     */
    serialize() {
        return {
            id: this.id,
            type: this.type,
            name: this.name,
            description: this.description,
            author: this.author,
            created: this.created,
            modified: this.modified,
            width: this.width,
            height: this.height,
            viewport: { ...this.viewport },
            background: { ...this.background },
            grid: this.grid.serialize(),
            guides: {
                enabled: this.guides.enabled,
                color: this.guides.color,
                opacity: this.guides.opacity,
                lines: [...this.guides.lines]
            }
        };
    }
    
    /**
     * Создает BoardObject из сериализованных данных
     */
    static fromData(data) {
        return new BoardObject(data);
    }
    
    /**
     * Очищает ресурсы
     */
    destroy() {
        if (this.grid) {
            this.grid.destroy();
        }
        this.container.destroy({ children: true });
    }
}
