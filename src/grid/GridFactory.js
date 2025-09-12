import { LineGrid } from './LineGrid.js';
import { DotGrid } from './DotGrid.js';
import { CrossGrid } from './CrossGrid.js';

/**
 * Фабрика для создания различных типов сеток
 */
export class GridFactory {
    /**
     * Регистрируемые типы сеток
     */
    static gridTypes = {
        'line': LineGrid,
        'dot': DotGrid,
        'cross': CrossGrid
    };
    
    /**
     * Создает сетку указанного типа
     * @param {string} type - тип сетки
     * @param {Object} options - настройки сетки
     * @returns {BaseGrid} экземпляр сетки
     */
    static createGrid(type, options = {}) {
        const GridClass = this.gridTypes[type];
        
        if (!GridClass) {
            throw new Error(`Unknown grid type: ${type}`);
        }
        
        return new GridClass(options);
    }
    
    /**
     * Создает сетку из сериализованных данных
     * @param {Object} data - сериализованные данные сетки
     * @returns {BaseGrid} экземпляр сетки
     */
    static fromData(data) {
        const { type, ...options } = data;
        return this.createGrid(type, options);
    }
    
    /**
     * Регистрирует новый тип сетки
     * @param {string} type - название типа
     * @param {Class} GridClass - класс сетки
     */
    static registerGridType(type, GridClass) {
        this.gridTypes[type] = GridClass;
    }
    
    /**
     * Получает список доступных типов сеток
     * @returns {Array<string>} массив названий типов
     */
    static getAvailableTypes() {
        return Object.keys(this.gridTypes);
    }
    
    /**
     * Получает настройки по умолчанию для типа сетки
     * @param {string} type - тип сетки
     * @returns {Object} настройки по умолчанию
     */
    static getDefaultOptions(type) {
        const defaults = {
            line: {
                enabled: true,
                size: 32,
                color: 0x6a6aff,
                opacity: 0.4,
                lineWidth: 1,
                showSubGrid: false,
                subGridDivisions: 4
            },
            dot: {
                enabled: true,
                size: 20,
                color: 0xE0E0E0,
                opacity: 0.5,
                dotSize: 2,
                dotStyle: 'circle',
                highlightIntersections: true
            },
            cross: {
                enabled: true,
                size: 40,
                color: 0xB0B0B0,
                opacity: 0.5,
                crossHalfSize: 4,
                crossLineWidth: 1
            }
        };
        
        return defaults[type] || {};
    }
    
    /**
     * Создает пресет популярных настроек сетки
     * @param {string} presetName - название пресета
     * @returns {Object} настройки сетки
     */
    static createPreset(presetName) {
        const presets = {
            // Линейные сетки
            'fine-line': {
                type: 'line',
                size: 10,
                color: 0xF0F0F0,
                opacity: 0.3,
                showSubGrid: true,
                subGridDivisions: 2
            },
            'standard-line': {
                type: 'line',
                size: 20,
                color: 0xE0E0E0,
                opacity: 0.5
            },
            'coarse-line': {
                type: 'line',
                size: 50,
                color: 0xD0D0D0,
                opacity: 0.7
            },
            
            // Точечные сетки
            'fine-dots': {
                type: 'dot',
                size: 10,
                color: 0xC0C0C0,
                opacity: 0.6,
                dotSize: 1
            },
            'standard-dots': {
                type: 'dot',
                size: 20,
                color: 0xB0B0B0,
                opacity: 0.7,
                dotSize: 2
            },
            'bold-dots': {
                type: 'dot',
                size: 30,
                color: 0xA0A0A0,
                opacity: 0.8,
                dotSize: 3,
                dotStyle: 'square'
            },
            
            // (изометрическая сетка удалена)
        };
        
        const preset = presets[presetName];
        if (!preset) {
            throw new Error(`Unknown preset: ${presetName}`);
        }
        
        return this.createGrid(preset.type, preset);
    }
    
    /**
     * Получает список доступных пресетов
     * @returns {Array<string>} названия пресетов
     */
    static getAvailablePresets() {
        return [
            'fine-line', 'standard-line', 'coarse-line',
            'fine-dots', 'standard-dots', 'bold-dots'
        ];
    }
}
