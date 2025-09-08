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
        
        // Включаем интерактивность для контейнера (PixiJS v7.2.0+)
        this.container.eventMode = 'static';
        this.container.interactiveChildren = true;
        
        // Размытая тень (отдельный слой под фоном)
        this.shadow = new PIXI.Graphics();
        // Применяем блёр к тени (мягкая тень)
        try {
            this.shadow.filters = [new PIXI.filters.BlurFilter(6)];
        } catch (e) {
            // Если фильтры недоступны, тень останется без размытия
        }
        this.container.addChild(this.shadow);

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
        
        // Прорисовка размытой тени отдельным слоем
        if (this.shadow) {
            const s = this.shadow;
            s.clear();
            s.beginFill(0x000000, 1);
            s.drawRect(0, 0, w, h);
            s.endFill();
            // Лёгкое смещение тени вниз/вправо
            s.x = 2;
            s.y = 3;
            s.alpha = 0.18; // прозрачность тени
            // Если есть фильтр Blur, он уже применён в конструкторе
        }
        
        // Основной фон записки (прямоугольный без скруглений, без рамки)
        g.beginFill(this.backgroundColor, 1);
        g.drawRect(0, 0, w, h);
        g.endFill();
        
        // Прямоугольная шапка сверху, тем же цветом что и рамка
        g.beginFill(this.borderColor, 1);
        g.drawRect(0, 0, w, 8);
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
