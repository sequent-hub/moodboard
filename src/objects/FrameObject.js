import * as PIXI from 'pixi.js';
import { Events } from '../core/events/Events.js';

/**
 * Класс объекта «Фрейм» (контейнерная прямоугольная область)
 * Отвечает за создание PIXI-графики, изменение размеров и изменение заливки.
 */
export class FrameObject {
    /**
     * @param {Object} objectData Полные данные объекта из состояния
     * @param {Object} eventBus EventBus для подписки на события зума
     */
    constructor(objectData, eventBus = null) {
        this.objectData = objectData || {};
        this.eventBus = eventBus;
        this.width = this.objectData.width || 100;
        this.height = this.objectData.height || 100;
        // Берем стили рамки из CSS-переменных, с дефолтом
        const rootStyles = (typeof window !== 'undefined') ? getComputedStyle(document.documentElement) : null;
        const cssBorderWidth = rootStyles ? parseFloat(rootStyles.getPropertyValue('--frame-border-width') || '4') : 4;
        const cssCornerRadius = rootStyles ? parseFloat(rootStyles.getPropertyValue('--frame-corner-radius') || '6') : 6;
        const cssBorderColor = rootStyles ? rootStyles.getPropertyValue('--frame-border-color').trim() : '';
        this.borderWidth = Number.isFinite(cssBorderWidth) ? cssBorderWidth : 4;
        // Используем backgroundColor из данных объекта, если есть, иначе белый
        this.fillColor = this.objectData.backgroundColor || this.objectData.properties?.backgroundColor || 0xFFFFFF;
        // Парсим цвет из CSS переменной, если задан
        if (cssBorderColor && cssBorderColor.startsWith('#')) {
            this.strokeColor = parseInt(cssBorderColor.slice(1), 16);
        } else {
            this.strokeColor = (typeof this.objectData.borderColor === 'number') ? this.objectData.borderColor : 0xE0E0E0;
        }
        this.cornerRadius = Number.isFinite(cssCornerRadius) ? cssCornerRadius : 6;
        this.title = this.objectData.title || this.objectData.properties?.title || 'Новый';

        // Создаем контейнер для фрейма и заголовка
        this.container = new PIXI.Container();
        
        // Графика для прямоугольника фрейма
        this.graphics = new PIXI.Graphics();
        this.container.addChild(this.graphics);
        
        // Текст заголовка
        this.baseFontSize = 14; // Сохраняем оригинальный размер шрифта
        this.currentWorldScale = 1.0; // Текущий масштаб мира
        this.originalTitle = this.title; // Сохраняем оригинальный заголовок
        this.titleText = new PIXI.Text(this.title, {
            fontFamily: 'Arial, sans-serif',
            fontSize: this.baseFontSize,
            fill: 0x333333,
            fontWeight: 'bold'
        });
        // Размещаем заголовок внутри верхней части фрейма, чтобы не влиять на внешние границы
        this.titleText.anchor.set(0, 0);
        this.titleText.x = 8;
        this.titleText.y = 4;
        this.container.addChild(this.titleText);
        
        // Подписываемся на события зума для компенсации масштабирования заголовка
        if (this.eventBus) {
            this.eventBus.on(Events.UI.ZoomPercent, this._onZoomChange.bind(this));
        }
        
        this._draw(this.width, this.height, this.fillColor);
        // Первичная обрезка заголовка
        this._updateTitleText();
        // Центрируем pivot контейнера, чтобы совпадали рамка и ручки
        // pivot по центру, чтобы позиция (x,y) контейнера соответствовала центру видимой области фрейма
        this.container.pivot.set(this.width / 2, this.height / 2);
    }

    /**
     * Возвращает PIXI-объект
     */
    getPixi() {
        return this.container;
    }

    /**
     * Установить цвет заливки фрейма (без изменения размеров)
     * @param {number} color Цвет заливки (hex)
     */
    setFill(color) {
        if (typeof color === 'number') {
            this.fillColor = color;
        }
        this._redrawPreserveTransform(this.width, this.height, this.fillColor);
    }

    /**
     * Установить заголовок фрейма
     * @param {string} title Новый заголовок
     */
    setTitle(title) {
        this.title = title || 'Новый';
        this.originalTitle = this.title;
        this._updateTitleText();
    }

    /**
     * Установить цвет фона фрейма
     * @param {number} backgroundColor Цвет фона (hex)
     */
    setBackgroundColor(backgroundColor) {
        if (typeof backgroundColor === 'number') {
            this.fillColor = backgroundColor;
            this._redrawPreserveTransform(this.width, this.height, this.fillColor);
        }
    }

    /**
     * Обновить размер фрейма
     * @param {{width:number,height:number}} size
     */
    updateSize(size) {
        if (!size) return;
        const w = Math.max(0, size.width || 0);
        const h = Math.max(0, size.height || 0);
        this.width = w;
        this.height = h;
        this._redrawPreserveTransform(w, h, this.fillColor);
    }

    /**
     * Перерисовать с сохранением трансформаций (позиция, pivot, rotation)
     */
    _redrawPreserveTransform(width, height, color) {
        const container = this.container;
        const x = container.x;
        const y = container.y;
        const rot = container.rotation || 0;
        const pivotX = width / 2;
        const pivotY = height / 2;

        this._draw(width, height, color);

        container.pivot.set(pivotX, pivotY);
        container.x = x;
        container.y = y;
        container.rotation = rot;
        
        // Обновляем заголовок после перерисовки
        this._updateTitleText();
    }

    /**
     * Базовая отрисовка
     */
    _draw(width, height, color) {
        const g = this.graphics;
        g.clear();
        // Рисуем с выравниванием обводки внутрь, чтобы внешний контур был ровно width x height
        try {
            g.lineStyle({ width: this.borderWidth, color: this.strokeColor, alpha: 1, alignment: 1 });
        } catch (e) {
            g.lineStyle(this.borderWidth, this.strokeColor, 1);
        }
        g.beginFill(typeof color === 'number' ? color : 0xFFFFFF, 1);
        g.drawRoundedRect(0, 0, Math.max(0, width), Math.max(0, height), this.cornerRadius);
        g.endFill();
        // Обновляем hitArea и корректный hit testing
        this.container.hitArea = new PIXI.Rectangle(0, 0, width, height);
        this.container.containsPoint = (point) => {
            const bounds = this.container.getBounds();
            return point.x >= bounds.x && 
                   point.x <= bounds.x + bounds.width &&
                   point.y >= bounds.y && 
                   point.y <= bounds.y + bounds.height;
        };
    }

    /**
     * Обработчик изменения зума
     * @param {Object} data Данные события с процентом зума
     */
    _onZoomChange(data) {
        if (!data || typeof data.percentage !== 'number') return;
        
        const worldScale = data.percentage / 100;
        this.currentWorldScale = worldScale;
        this._updateTitleScale();
    }

    /**
     * Обновить масштаб заголовка для компенсации зума
     */
    _updateTitleScale() {
        if (!this.titleText) return;
        
        // Компенсируем зум мира обратным масштабированием заголовка
        const compensationScale = 1 / this.currentWorldScale;
        
        // Обновляем размер шрифта
        const newFontSize = this.baseFontSize * compensationScale;
        this.titleText.style.fontSize = newFontSize;
        
        // Корректируем позицию заголовка с учетом изменения размера
        this.titleText.x = 8 * compensationScale;
        this.titleText.y = 4 * compensationScale;
        
        // Обновляем текст с учетом нового размера
        this._updateTitleText();
    }

    /**
     * Обновить текст заголовка с учетом доступной ширины
     */
    _updateTitleText() {
        if (!this.titleText) return;

        const truncatedText = this._truncateTextToFit(this.originalTitle);
        this.titleText.text = truncatedText;
    }

    /**
     * Обрезать текст до доступной ширины с добавлением многоточия
     * @param {string} text Исходный текст
     * @returns {string} Обрезанный текст с многоточием или оригинальный текст
     */
    _truncateTextToFit(text) {
        if (!text || !this.titleText) return text;

        // Компенсация масштаба для правильного расчета размеров
        const compensationScale = 1 / this.currentWorldScale;
        
        // Доступная ширина = ширина фрейма - отступы слева и справа (с учетом масштаба)
        const leftPadding = 8 * compensationScale;
        const rightPadding = 8 * compensationScale;
        const availableWidth = this.width - leftPadding - rightPadding;

        // Создаем временный стиль для измерения текста
        const style = new PIXI.TextStyle({
            fontFamily: this.titleText.style.fontFamily,
            fontSize: this.titleText.style.fontSize,
            fontWeight: this.titleText.style.fontWeight
        });

        // Измеряем ширину оригинального текста
        const textMetrics = PIXI.TextMetrics.measureText(text, style);
        
        // Если текст помещается, возвращаем его как есть
        if (textMetrics.width <= availableWidth) {
            return text;
        }

        // Измеряем ширину многоточия
        const ellipsisMetrics = PIXI.TextMetrics.measureText('...', style);
        const ellipsisWidth = ellipsisMetrics.width;
        
        // Доступная ширина для текста без многоточия
        const textAvailableWidth = availableWidth - ellipsisWidth;
        
        if (textAvailableWidth <= 0) {
            return '...';
        }

        // Бинарный поиск оптимальной длины текста
        let left = 0;
        let right = text.length;
        let result = '';

        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            const subText = text.substring(0, mid);
            const subTextMetrics = PIXI.TextMetrics.measureText(subText, style);

            if (subTextMetrics.width <= textAvailableWidth) {
                result = subText;
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }

        return result + '...';
    }

    /**
     * Метод для отписки от событий при уничтожении объекта
     */
    destroy() {
        if (this.eventBus) {
            this.eventBus.off(Events.UI.ZoomPercent, this._onZoomChange.bind(this));
        }
        if (this.container) {
            this.container.destroy({ children: true });
        }
    }
}

