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
        this.width = objectData.width || objectData.properties?.width || 160;
        this.height = objectData.height || objectData.properties?.height || 100;
        
        // Свойства записки
        const props = objectData.properties || {};
        this.content = props.content || '';
        this.fontSize = props.fontSize || 16;
        this.backgroundColor = (typeof props.backgroundColor === 'number') ? props.backgroundColor : 0xFFF9C4; // Светло-желтый
        this.borderColor = (typeof props.borderColor === 'number') ? props.borderColor : 0xF9A825; // Золотистый
        this.textColor = (typeof props.textColor === 'number') ? props.textColor : 0x1A1A1A; // Почти черный для лучшей контрастности

        // Создаем контейнер для записки
        this.container = new PIXI.Container();
        
        // Включаем интерактивность для контейнера
        this.container.interactive = true;
        this.container.interactiveChildren = true;
        
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
        this.width = Math.max(80, size.width || this.width);
        this.height = Math.max(60, size.height || this.height);
        
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
        
        // Тень записки (эффект приподнятости)
        g.beginFill(0x000000, 0.1);
        g.drawRoundedRect(2, 2, w, h, 4);
        g.endFill();
        
        // Основной фон записки
        g.beginFill(this.backgroundColor, 1);
        g.lineStyle(1, this.borderColor, 1);
        g.drawRoundedRect(0, 0, w, h, 4);
        g.endFill();
        
        // Небольшая полоска сверху для эффекта стикера
        g.beginFill(this.borderColor, 0.3);
        g.drawRoundedRect(0, 0, w, 8, 4);
        g.endFill();
        
        // Линии на записке (эффект бумаги)
        g.lineStyle(0.5, this.borderColor, 0.2);
        const lineSpacing = Math.max(16, this.fontSize + 4);
        for (let y = 24; y < h - 8; y += lineSpacing) {
            g.moveTo(8, y);
            g.lineTo(w - 8, y);
        }
        
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
