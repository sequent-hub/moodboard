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
        this._borderVisible = true;

        // Создаем контейнер для фрейма и заголовка
        this.container = new PIXI.Container();
        
        // Графика для прямоугольника фрейма
        this.graphics = new PIXI.Graphics();
        this.container.addChild(this.graphics);
        
        // Заголовок фрейма — слой над верхней границей с собственной подложкой
        this.baseFontSize = 14;
        this.currentWorldScale = 1.0;
        this.originalTitle = this.title;

        // Под-контейнер: масштаб компенсирует зум, поэтому заголовок всегда одного размера на экране
        this.titleLayer = new PIXI.Container();
        this.titleLayer.eventMode = 'none'; // не перехватывать указатель

        this.titleBg = new PIXI.Graphics();
        this.titleLayer.addChild(this.titleBg);

        this.titleText = new PIXI.Text(this.title, {
            fontFamily: 'Inter, Arial, sans-serif',
            fontSize: this.baseFontSize,
            fill: 0x333333,
            fontWeight: '500'
        });
        this.titleText.anchor.set(0, 0);
        this.titleLayer.addChild(this.titleText);

        this.container.addChild(this.titleLayer);
        
        // Подписываемся на события зума для компенсации масштабирования заголовка
        if (this.eventBus) {
            this._boundOnZoomChange = this._onZoomChange.bind(this);
            this.eventBus.on(Events.UI.ZoomPercent, this._boundOnZoomChange);
            this._boundOnSelectionAdd = this._onSelectionAdd.bind(this);
            this._boundOnSelectionRemove = this._onSelectionRemove.bind(this);
            this._boundOnSelectionClear = this._onSelectionClear.bind(this);
            this.eventBus.on(Events.Tool.SelectionAdd, this._boundOnSelectionAdd);
            this.eventBus.on(Events.Tool.SelectionRemove, this._boundOnSelectionRemove);
            this.eventBus.on(Events.Tool.SelectionClear, this._boundOnSelectionClear);
        }

        // Логические габариты фрейма = только прямоугольник, без плавающего
        // заголовка над верхней границей. Заголовок — отдельный слой с
        // отрицательным y, и по умолчанию он раздул бы getLocalBounds вверх.
        // Через него width/height контейнера считает GetObjectPosition
        // (position.y = centerY - height/2) — лишняя высота сверху уводила
        // рамку выделения вверх. Переопределяем getLocalBounds, чтобы
        // width/height отражали именно прямоугольник. getBounds НЕ трогаем:
        // hover-lift DropShadowFilter берёт область из getBounds, и заголовок
        // не должен обрезаться фильтром.
        this.container.getLocalBounds = (rect) => {
            const b = rect || new PIXI.Rectangle();
            b.x = 0;
            b.y = 0;
            b.width = this.width;
            b.height = this.height;
            return b;
        };

        this._draw(this.width, this.height, this.fillColor);
        // Применяем начальный масштаб и обрезку заголовка
        this._updateTitleScale();
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

    /** Скрыть/показать серую рамку (при выделении скрываем, чтобы не накладывалась на синюю) */
    setBorderVisible(visible) {
        if (this._borderVisible === visible) return;
        this._borderVisible = visible;
        this._redrawPreserveTransform(this.width, this.height, this.fillColor);
    }

    _onSelectionAdd(data) {
        const myId = this.objectData?.id ?? this.container?._mb?.objectId;
        if (data?.object === myId) this.setBorderVisible(false);
    }

    _onSelectionRemove(data) {
        if (data?.object === (this.objectData?.id ?? this.container?._mb?.objectId)) this.setBorderVisible(true);
    }

    _onSelectionClear(data) {
        const myId = this.objectData?.id ?? this.container?._mb?.objectId;
        if (data?.objects?.includes(myId)) this.setBorderVisible(true);
    }

    /**
     * Применить текущий масштаб мира к заголовку.
     * Нужно при создании объекта: viewport-зум восстанавливается раньше,
     * чем фрейм успевает подписаться на ZoomPercent, поэтому стартовый зум
     * до него не доходит и заголовок остаётся в мировом масштабе (мелкий).
     * @param {number} worldScale Текущий масштаб мира (world.scale.x)
     */
    applyWorldScale(worldScale) {
        if (typeof worldScale !== 'number' || !(worldScale > 0)) return;
        this.currentWorldScale = worldScale;
        this._updateTitleScale();
    }

    hideTitle() {
        if (this.titleLayer) this.titleLayer.visible = false;
    }

    showTitle() {
        if (this.titleLayer) this.titleLayer.visible = true;
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

        this._draw(width, height, color, this._borderVisible);

        container.pivot.set(pivotX, pivotY);
        container.x = x;
        container.y = y;
        container.rotation = rot;
        
        // Обновляем заголовок после перерисовки
        this._updateTitleText();
    }

    /**
     * Базовая отрисовка
     * @param {boolean} showStroke — рисовать ли серую рамку (скрываем при выделении)
     */
    _draw(width, height, color, showStroke = true) {
        const g = this.graphics;
        g.clear();
        if (showStroke) {
            try {
                g.lineStyle({ width: this.borderWidth, color: this.strokeColor, alpha: 1, alignment: 1 });
            } catch (e) {
                g.lineStyle(this.borderWidth, this.strokeColor, 1);
            }
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
     * Масштаб и позиция слоя заголовка — компенсируем зум, держим постоянный экранный размер
     */
    _updateTitleScale() {
        if (!this.titleLayer) return;

        const compensationScale = 1 / this.currentWorldScale;

        // Весь слой масштабируется обратно → содержимое выглядит одинаково на любом зуме
        this.titleLayer.scale.set(compensationScale);

        // Высота подложки в базовых пикселях: baseFontSize + 4px сверху + 4px снизу
        const labelBaseH = this.baseFontSize + 8;
        const gap = 4; // зазор между нижним краем подписи и верхней границей фрейма

        // Позиционируем над фреймом (y=0 — верхний край фрейма в локальных координатах контейнера)
        this.titleLayer.x = 0;
        this.titleLayer.y = -Math.round((labelBaseH + gap) * compensationScale);

        this._updateTitleText();
    }

    /**
     * Обновить текст заголовка и перерисовать подложку
     */
    _updateTitleText() {
        if (!this.titleText) return;

        const truncatedText = this._truncateTextToFit(this.originalTitle);
        this.titleText.text = truncatedText;
        this._redrawTitleBg();
    }

    /**
     * Нарисовать скруглённую подложку под текущую ширину текста
     */
    _redrawTitleBg() {
        if (!this.titleBg || !this.titleText) return;

        const padH = 8; // горизонтальный отступ с каждой стороны
        const padV = 4; // вертикальный отступ с каждой стороны

        // Измеряем текст в базовых единицах
        const style = new PIXI.TextStyle({
            fontFamily: this.titleText.style.fontFamily,
            fontSize: this.baseFontSize,
            fontWeight: this.titleText.style.fontWeight
        });
        const metrics = PIXI.TextMetrics.measureText(this.titleText.text || '', style);

        const bgW = Math.max(1, Math.round(metrics.width + padH * 2));
        const bgH = Math.round(this.baseFontSize + padV * 2);

        const g = this.titleBg;
        g.clear();
        try {
            g.lineStyle({ width: 1, color: this.strokeColor, alpha: 1 });
        } catch (_) {
            g.lineStyle(1, this.strokeColor, 1);
        }
        g.beginFill(0xFFFFFF, 1);
        g.drawRoundedRect(0, 0, bgW, bgH, 6);
        g.endFill();

        // Текст внутри подложки
        this.titleText.x = padH;
        this.titleText.y = padV;
    }

    /**
     * Обрезать текст до ширины фрейма (потолок) с добавлением многоточия.
     * Сравниваем в базовых пикселях — слой уже компенсирует зум отдельно.
     * @param {string} text Исходный текст
     * @returns {string} Обрезанный текст или оригинал
     */
    _truncateTextToFit(text) {
        if (!text || !this.titleText) return text;

        // Подложка не должна быть шире самого фрейма (8px паддинг с каждой стороны)
        const availableWidth = Math.max(1, this.width - 16);

        const style = new PIXI.TextStyle({
            fontFamily: this.titleText.style.fontFamily,
            fontSize: this.baseFontSize,
            fontWeight: this.titleText.style.fontWeight
        });

        const textMetrics = PIXI.TextMetrics.measureText(text, style);
        if (textMetrics.width <= availableWidth) return text;

        const ellipsisMetrics = PIXI.TextMetrics.measureText('...', style);
        const textAvailableWidth = availableWidth - ellipsisMetrics.width;
        if (textAvailableWidth <= 0) return '...';

        let left = 0;
        let right = text.length;
        let result = '';
        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            const subText = text.substring(0, mid);
            const subMetrics = PIXI.TextMetrics.measureText(subText, style);
            if (subMetrics.width <= textAvailableWidth) {
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
            if (this._boundOnZoomChange) {
                this.eventBus.off(Events.UI.ZoomPercent, this._boundOnZoomChange);
                this._boundOnZoomChange = null;
            }
            if (this._boundOnSelectionAdd) {
                this.eventBus.off(Events.Tool.SelectionAdd, this._boundOnSelectionAdd);
                this.eventBus.off(Events.Tool.SelectionRemove, this._boundOnSelectionRemove);
                this.eventBus.off(Events.Tool.SelectionClear, this._boundOnSelectionClear);
                this._boundOnSelectionAdd = this._boundOnSelectionRemove = this._boundOnSelectionClear = null;
            }
        }
        if (this.container) {
            this.container.destroy({ children: true });
        }
    }
}

