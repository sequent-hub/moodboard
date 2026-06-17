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
        const cssBorderWidth = rootStyles ? parseFloat(rootStyles.getPropertyValue('--frame-border-width') || '5') : 5;
        const cssCornerRadius = rootStyles ? parseFloat(rootStyles.getPropertyValue('--frame-corner-radius') || '6') : 6;
        const cssBorderColor = rootStyles ? rootStyles.getPropertyValue('--frame-border-color').trim() : '';
        this.borderWidth = Number.isFinite(cssBorderWidth) ? cssBorderWidth : 5;
        // Используем backgroundColor из данных объекта, если есть, иначе белый
        this.fillColor = this.objectData.backgroundColor || this.objectData.properties?.backgroundColor || 0xFFFFFF;
        // Режим заливки: solid | solid-bordered | outline
        this.bgMode = this.objectData.properties?.bgMode || this.objectData.bgMode || 'solid';
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
        const _frameObjectId = this.objectData.id || '';
        if (_frameObjectId) {
            this.titleLayer.name = `mb-frame-title-${_frameObjectId}`;
        }

        this.titleBg = new PIXI.Graphics();
        this.titleLayer.addChild(this.titleBg);

        this.titleText = new PIXI.Text(this.title, {
            fontFamily: 'Inter, Arial, sans-serif',
            fontSize: this.baseFontSize,
            fill: 0x333333,
            fontWeight: '500'
        });
        this.titleText.anchor.set(0, 0.5);
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

    /**
     * Установить скрытость фрейма
     * @param {boolean} hidden 
     */
    setHidden(hidden) {
        if (!this.objectData) this.objectData = {};
        if (!this.objectData.properties) this.objectData.properties = {};
        this.objectData.properties.hidden = hidden;
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
        if (data?.object !== myId) return;
        // В outline цветная рамка — основной визуал фрейма, не дублирует синюю рамку выделения.
        if (this.bgMode === 'outline') return;
        this.setBorderVisible(false);
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
     * Установить режим заливки фрейма
     * @param {'solid'|'solid-bordered'|'outline'} mode
     */
    setBgMode(mode) {
        this.bgMode = mode || 'solid';
        if (!this.objectData.properties) { this.objectData.properties = {}; }
        this.objectData.properties.bgMode = this.bgMode;
        this._redrawPreserveTransform(this.width, this.height, this.fillColor);
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
        const isHidden = !!(this.objectData?.properties?.hidden);

        if (isHidden) {
            // Закрашиваем фон фрейма в #f0f6fc при скрытии
            g.beginFill(0xF0F6FC, 1);
            g.drawRoundedRect(0, 0, Math.max(0, width), Math.max(0, height), this.cornerRadius);
            g.endFill();

            // Создаём иконку глаза, если её ещё нет
            if (!this.eyeSprite) {
                const eyeSvg = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#666666" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M3 3l18 18"/><path d="M10.6 10.7a2 2 0 0 0 2.7 2.8"/><path d="M9.4 5.2A9.6 9.6 0 0 1 12 5c6.5 0 10 7 10 7a13 13 0 0 1-2.2 2.9M6.2 6.2A13 13 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 3.5-.6"/></svg>`;
                const eyeTexture = PIXI.Texture.from(`data:image/svg+xml;utf8,${encodeURIComponent(eyeSvg)}`);
                this.eyeSprite = new PIXI.Sprite(eyeTexture);
                this.eyeSprite.anchor.set(0.5);
                this.container.addChild(this.eyeSprite);
            }
            this.eyeSprite.visible = true;
            this.eyeSprite.x = Math.max(0, width) / 2;
            this.eyeSprite.y = Math.max(0, height) / 2;
            
            if (this.titleLayer) this.titleLayer.visible = false;
        } else {
            if (this.eyeSprite) this.eyeSprite.visible = false;

            const bgMode = this.bgMode || 'solid';
            const fillColor = typeof color === 'number' ? color : 0xFFFFFF;

            if (bgMode === 'solid') {
                // Сплошная заливка без собственной рамки (рамка выделения — отдельно)
                g.beginFill(fillColor, 1);
                g.drawRoundedRect(0, 0, Math.max(0, width), Math.max(0, height), this.cornerRadius);
                g.endFill();
            } else if (bgMode === 'solid-bordered') {
                // Фон = выбранный цвет; рамка = S=100,V=50 от того же тона палитры
                const borderColor = this._pickBorderColor(fillColor);
                if (showStroke) {
                    try {
                        g.lineStyle({ width: this.borderWidth, color: borderColor, alpha: 1, alignment: 0 });
                    } catch (e) {
                        g.lineStyle(this.borderWidth, borderColor, 1);
                    }
                }
                g.beginFill(fillColor, 1);
                g.drawRoundedRect(0, 0, Math.max(0, width), Math.max(0, height), this.cornerRadius);
                g.endFill();
            } else {
                // outline: прозрачный фон, рамка цвета выбранного цвета (всегда видна, в т.ч. при фокусе)
                try {
                    g.lineStyle({ width: this.borderWidth, color: fillColor, alpha: 1, alignment: 1 });
                } catch (e) {
                    g.lineStyle(this.borderWidth, fillColor, 1);
                }
                g.beginFill(0x000000, 0);
                g.drawRoundedRect(0, 0, Math.max(0, width), Math.max(0, height), this.cornerRadius);
                g.endFill();
            }

            if (this.titleLayer) this.titleLayer.visible = true;
        }

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
        const gap = 5; // зазор между нижним краем подписи и верхней границей фрейма

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
     * YIQ-контраст: возвращает 0x000000 или 0xFFFFFF — читаемый цвет на заданном фоне
     * @param {number} hexInt Цвет фона (PIXI hex)
     * @returns {number}
     */
    _pickContrastColor(hexInt) {
        const r = (hexInt >> 16) & 0xFF;
        const g = (hexInt >> 8) & 0xFF;
        const b = hexInt & 0xFF;
        const yiq = (r * 299 + g * 587 + b * 114) / 1000;
        const darkness = (1 - yiq / 255) * 100;
        return darkness >= 35 ? 0xFFFFFF : 0x000000;
    }

    /**
     * Цвет рамки в режиме solid-bordered.
     * Крайне правый по горизонтали (S=100) и по середине вертикали (V=50)
     * в палитре того же тона, что и фон.
     * Белый фон: крайне левый по горизонтали (S=0), середина по вертикали (V=50) → нейтральный серый.
     * Прочие ахроматические цвета (серый, чёрный — s=0): чёрный.
     * @param {number} hexInt Цвет фона (PIXI hex)
     * @returns {number}
     */
    _pickBorderColor(hexInt) {
        const r = (hexInt >> 16) & 0xFF;
        const g = (hexInt >> 8) & 0xFF;
        const b = hexInt & 0xFF;
        if (r === 255 && g === 255 && b === 255) {
            return 0x808080;
        }
        const { h, s } = this._rgbToHsv(r, g, b);
        if (s === 0) {
            return 0x000000;
        }
        return this._hsvToHex(h, 100, 50);
    }

    /**
     * Цвет текста заголовка фрейма.
     * Для почти-белых тонированных фонов (яркость < 5 по шкале 0=белый…100=чёрный,
     * но не чистый белый) берёт тон из той же палитры с макс. насыщенностью (S=100, V=50).
     * Иначе — обычный YIQ-контраст (чёрный/белый).
     * @param {number} hexInt Цвет фона (PIXI hex)
     * @returns {number}
     */
    _pickTitleTextColor(hexInt) {
        const r = (hexInt >> 16) & 0xFF;
        const g = (hexInt >> 8) & 0xFF;
        const b = hexInt & 0xFF;

        // Чистый белый фон — исключение: чёрный текст
        if (r === 255 && g === 255 && b === 255) {
            return 0x000000;
        }

        // Яркость по шкале 0 (белый) → 100 (чёрный) через HSL-lightness
        const darkness = 100 - ((Math.max(r, g, b) + Math.min(r, g, b)) / 2 / 255) * 100;
        if (darkness >= 5) {
            return this._pickContrastColor(hexInt);
        }

        // Почти-белый тонированный фон: та же палитра, правый край по центру (S=100, V=50)
        const { h } = this._rgbToHsv(r, g, b);
        return this._hsvToHex(h, 100, 50);
    }

    /**
     * @param {number} r 0..255
     * @param {number} g 0..255
     * @param {number} b 0..255
     * @returns {{ h: number, s: number, v: number }} h 0..360, s/v 0..100
     */
    _rgbToHsv(r, g, b) {
        const rn = r / 255, gn = g / 255, bn = b / 255;
        const max = Math.max(rn, gn, bn);
        const min = Math.min(rn, gn, bn);
        const d = max - min;
        let h = 0;
        if (d !== 0) {
            if (max === rn) {
                h = ((gn - bn) / d) % 6;
            } else if (max === gn) {
                h = (bn - rn) / d + 2;
            } else {
                h = (rn - gn) / d + 4;
            }
            h *= 60;
            if (h < 0) {
                h += 360;
            }
        }
        const s = max === 0 ? 0 : (d / max) * 100;
        return { h, s, v: max * 100 };
    }

    /**
     * @param {number} h 0..360
     * @param {number} s 0..100
     * @param {number} v 0..100
     * @returns {number} PIXI hex
     */
    _hsvToHex(h, s, v) {
        const sn = s / 100, vn = v / 100;
        const c = vn * sn;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = vn - c;
        let rp = 0, gp = 0, bp = 0;
        if (h < 60) {
            rp = c; gp = x;
        } else if (h < 120) {
            rp = x; gp = c;
        } else if (h < 180) {
            gp = c; bp = x;
        } else if (h < 240) {
            gp = x; bp = c;
        } else if (h < 300) {
            rp = x; bp = c;
        } else {
            rp = c; bp = x;
        }
        const r = Math.round((rp + m) * 255);
        const g = Math.round((gp + m) * 255);
        const b = Math.round((bp + m) * 255);
        return (r << 16) | (g << 8) | b;
    }

    /**
     * Возвращает цвета плашки заголовка в формате CSS-строк для HTML-инпута
     * @returns {{ bgCss: string, textCss: string }}
     */
    getTitleColors() {
        const bg = this.fillColor;
        const text = this._pickTitleTextColor(bg);
        const toHex = (n) => '#' + n.toString(16).padStart(6, '0');
        return { bgCss: toHex(bg), textCss: toHex(text) };
    }

    /**
     * Нарисовать скруглённую подложку под текущую ширину текста
     */
    _redrawTitleBg() {
        if (!this.titleBg || !this.titleText) return;

        const padH = 8; // горизонтальный отступ с каждой стороны
        const padV = 4; // вертикальный отступ с каждой стороны

        // Фон плашки = цвет фрейма (fill или border в зависимости от bgMode — всегда this.fillColor)
        const bgColor = typeof this.fillColor === 'number' ? this.fillColor : 0xFFFFFF;
        const textColor = this._pickTitleTextColor(bgColor);

        // Обновляем цвет текста под контраст фона
        this.titleText.style.fill = textColor;

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
        g.lineStyle(0);
        g.beginFill(bgColor, 1);
        g.drawRoundedRect(0, 0, bgW, bgH, 6);
        g.endFill();

        // Текст внутри подложки — по вертикали по центру (anchor.y = 0.5)
        this.titleText.x = padH;
        this.titleText.y = Math.round(bgH / 2);
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

