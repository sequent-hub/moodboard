import * as PIXI from 'pixi.js';

/**
 * NoteObject — объект записки, стилизованный как стикер
 * Свойства (properties):
 * - content: string — содержимое записки
 * - fontSize: number — размер шрифта (по умолчанию 14)
 * - backgroundColor: number — цвет фона записки (по умолчанию желтоватый)
 * - borderColor: number — цвет границы (по умолчанию темнее фона)
 * - textColor: number — цвет текста (по умолчанию темный)
 */
export class NoteObject {
    constructor(objectData = {}) {
        this.objectData = objectData;
        
        // Размеры записки
        const defaultSide = 300; // квадрат 300x300
        this.width = objectData.width || objectData.properties?.width || defaultSide;
        this.height = objectData.height || objectData.properties?.height || defaultSide;
        
        // Свойства записки
        const props = objectData.properties || {};
        this.content = props.content || '';
        this.fontSize = props.fontSize || 16;
        this.backgroundColor = (typeof props.backgroundColor === 'number') ? props.backgroundColor : 0xFFF9C4; // Светло-желтый
        this.borderColor = (typeof props.borderColor === 'number') ? props.borderColor : 0xF9A825; // Золотистый
        this.textColor = (typeof props.textColor === 'number') ? props.textColor : 0x1A1A1A; // Почти черный для лучшей контрастности

        // Создаем контейнер для записки
        this.container = new PIXI.Container();
        
        // Включаем интерактивность для контейнера (PixiJS v7.2.0+)
        this.container.eventMode = 'static';
        this.container.interactiveChildren = true;
        
        // Тени по бокам (как у .box::before / .box::after)
        this.shadowLayer = new PIXI.Container();
        this.shadowLeft = new PIXI.Graphics();
        this.shadowRight = new PIXI.Graphics();
        this.shadowLayer.addChild(this.shadowLeft);
        this.shadowLayer.addChild(this.shadowRight);
        try {
            // Мягкая тень (чуть сильнее)
            this.shadowLayer.filters = [new PIXI.filters.BlurFilter(12)];
        } catch (_) {}
        this.container.addChild(this.shadowLayer);

        // Графика фона
        this.graphics = new PIXI.Graphics();
        this.container.addChild(this.graphics);
        
        // Текст записки
        this.textField = new PIXI.Text(this.content, {
            fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
            fontSize: this.fontSize,
            fill: this.textColor,
            align: 'center',
            wordWrap: true,
            wordWrapWidth: this.width - 16, // Отступы по 8px с каждой стороны
            lineHeight: this.fontSize * 1.2,
            resolution: (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1
        });
        
        this._redraw(); // Сначала рисуем фон
        this.container.addChild(this.textField); // Затем добавляем текст поверх
        this._updateTextPosition();
        
        // Отладочная информация
        console.log('NoteObject created with content:', this.content);

        // Метаданные
        this.container._mb = {
            ...(this.container._mb || {}),
            type: 'note',
            instance: this, // Ссылка на сам объект для вызова методов
            properties: { 
                content: this.content,
                fontSize: this.fontSize,
                backgroundColor: this.backgroundColor,
                borderColor: this.borderColor,
                textColor: this.textColor,
                ...objectData.properties 
            }
        };

        this._redraw();
    }

    getPixi() {
        return this.container;
    }

    updateSize(size) {
        if (!size) return;
        let w = Math.max(80, size.width || this.width);
        let h = Math.max(60, size.height || this.height);
        // Держим квадрат
        const side = Math.max(w, h);
        this.width = side;
        this.height = side;
        
        this._redraw();
        this._updateTextPosition();
        
        // Обновляем hit area и containsPoint
        this.container.hitArea = new PIXI.Rectangle(0, 0, this.width, this.height);
        this.container.containsPoint = (point) => {
            const bounds = this.container.getBounds();
            return point.x >= bounds.x && 
                   point.x <= bounds.x + bounds.width &&
                   point.y >= bounds.y && 
                   point.y <= bounds.y + bounds.height;
        };
    }

    setContent(content) {
        this.content = content || '';
        this.textField.text = this.content;
        this._updateTextPosition();
        if (this.container && this.container._mb) {
            this.container._mb.properties = {
                ...(this.container._mb.properties || {}),
                content: this.content
            };
        }
        console.log('NoteObject setContent called:', this.content);
        // Перерисовываем фон после обновления содержимого
        console.log('NoteObject: calling _redraw() to restore background');
        this._redraw();
    }

    // Alias для совместимости с TextObject
    setText(content) {
        this.setContent(content);
    }

    /**
     * Скрывает текст записки (используется во время редактирования)
     */
    hideText() {
        if (this.textField) {
            this.textField.visible = false;
        }
    }

    /**
     * Показывает текст записки (используется после завершения редактирования)
     */
    showText() {
        if (this.textField) {
            this.textField.visible = true;
        }
    }

    setStyle({ fontSize, backgroundColor, borderColor, textColor } = {}) {
        if (typeof fontSize === 'number') {
            this.fontSize = fontSize;
            this.textField.style.fontSize = fontSize;
            this.textField.style.lineHeight = fontSize * 1.2;
        }
        if (typeof backgroundColor === 'number') this.backgroundColor = backgroundColor;
        if (typeof borderColor === 'number') this.borderColor = borderColor;
        if (typeof textColor === 'number') {
            this.textColor = textColor;
            this.textField.style.fill = textColor;
        }
        
        if (this.container && this.container._mb) {
            this.container._mb.properties = {
                ...(this.container._mb.properties || {}),
                fontSize: this.fontSize,
                backgroundColor: this.backgroundColor,
                borderColor: this.borderColor,
                textColor: this.textColor
            };
        }
        
        this._redraw();
        this._updateTextPosition();
    }

    _redraw() {
        const g = this.graphics;
        const w = this.width;
        const h = this.height;
        
        g.clear();
        
        // Левая и правая тень (узкие полосы снизу)
        const shH = Math.max(8, Math.round(h * 0.05)); // толще тень (~5% высоты)
        const shW = Math.max(24, Math.round(w * 0.45)); // шире тень (~45% ширины)
        const bottom = Math.max(8, Math.round(h * 0.03)) + 10; // отступ снизу ~10

        const drawShadow = (g) => {
            g.clear();
            g.beginFill(0x000000, 1);
            g.drawRoundedRect(0, 0, shW, shH, shH / 2);
            g.endFill();
        };
        drawShadow(this.shadowLeft);
        drawShadow(this.shadowRight);

        // Базовые позиции как в CSS: left:15px и right:15px; bottom:10px
        this.shadowLeft.x = 15;
        this.shadowLeft.y = h - shH - 10;
        this.shadowLeft.skew = new PIXI.ObservablePoint(() => {}, null, -5 * Math.PI / 180, 0);
        this.shadowLeft.rotation = -5 * Math.PI / 180;

        this.shadowRight.x = w - shW - 15;
        this.shadowRight.y = h - shH - 10;
        this.shadowRight.skew = new PIXI.ObservablePoint(() => {}, null, 5 * Math.PI / 180, 0);
        this.shadowRight.rotation = 5 * Math.PI / 180;

        this.shadowLayer.alpha = 0.7; // темнее
        
        // Основной фон записки — как .box: белый с небольшим радиусом
        const boxBg = (typeof this.backgroundColor === 'number') ? this.backgroundColor : 0xFFFFFF;
        g.beginFill(boxBg, 1);
        g.drawRoundedRect(0, 0, w, h, 2);
        g.endFill();
        
        // Линии внутри записки убраны по требованию дизайна

        // pivot контейнера строго по центру, чтобы ядро корректно вычисляло левый-верх
        this.container.pivot.set(w / 2, h / 2);
        
        // Устанавливаем hit area для контейнера
        this.container.hitArea = new PIXI.Rectangle(0, 0, w, h);
        
        // Переопределяем containsPoint для правильного hit testing
        this.container.containsPoint = (point) => {
            const bounds = this.container.getBounds();
            return point.x >= bounds.x && 
                   point.x <= bounds.x + bounds.width &&
                   point.y >= bounds.y && 
                   point.y <= bounds.y + bounds.height;
        };

        // Hover-эффект: ослабляем короб тени и сдвигаем ближе к центру (как в CSS)
        this.container.eventMode = 'static';
        this.container.on('pointerover', () => {
            this.shadowLayer.alpha = 0.55;
            this.shadowLeft.x = 5;
            this.shadowRight.x = w - shW - 5;
            this.shadowLeft.rotation = 0;
            this.shadowRight.rotation = 0;
        });
        this.container.on('pointerout', () => {
            this.shadowLayer.alpha = 0.7;
            this.shadowLeft.x = 15;
            this.shadowRight.x = w - shW - 15;
            this.shadowLeft.rotation = -5 * Math.PI / 180;
            this.shadowRight.rotation = 5 * Math.PI / 180;
        });
    }

    _updateTextPosition() {
        if (!this.textField) return;
        
        // Обновляем стиль текста
        this.textField.style.wordWrapWidth = this.width - 16;
        
        // Ждем, пока PIXI пересчитает размеры текста
        this.textField.updateText();
        
        // Центрируем текст по горизонтали
        const centerX = this.width / 2;
        const topMargin = 20; // Отступ от верха (ниже полоски)
        
        // Используем anchor для центрирования
        this.textField.anchor.set(0.5, 0);
        this.textField.x = centerX;
        this.textField.y = topMargin;
    }
}
