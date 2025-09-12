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
        const defaultSide = 250; // квадрат 250x250
        this.width = objectData.width || objectData.properties?.width || defaultSide;
        this.height = objectData.height || objectData.properties?.height || defaultSide;
        
        // Свойства записки
        const props = objectData.properties || {};
        this.content = props.content || '';
        this.fontSize = props.fontSize || 32;
        const fontFamily = props.fontFamily || 'Caveat, Arial, cursive';
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
        
        // Функция согласованной высоты строки (как в HtmlTextLayer)
        this._computeLineHeightPx = (fs) => {
            if (fs <= 12) return Math.round(fs * 1.40);
            if (fs <= 18) return Math.round(fs * 1.34);
            if (fs <= 36) return Math.round(fs * 1.26);
            if (fs <= 48) return Math.round(fs * 1.24);
            if (fs <= 72) return Math.round(fs * 1.22);
            if (fs <= 96) return Math.round(fs * 1.20);
            return Math.round(fs * 1.18);
        };

        // Текст записки
        this.textField = new PIXI.Text(this.content, {
            fontFamily: fontFamily,
            fontSize: this.fontSize,
            fill: this.textColor,
            align: 'center',
            letterSpacing: 0,
            wordWrap: true,
            breakWords: true,
            wordWrapWidth: Math.max(1, Math.min(360, (this.width - 32))),
            lineHeight: this._computeLineHeightPx(this.fontSize),
            padding: 3,
            trim: false,
            resolution: (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1
        });
        
        // Маска для обрезки текста по границам записки
        this.textMask = new PIXI.Graphics();
        this.container.addChild(this.textMask);
        this.textField.mask = this.textMask;

        this._redraw(); // Сначала рисуем фон
        // Прячем текст до загрузки шрифта Caveat, чтобы не показывать системный
        this.textField.visible = false;
        this.container.addChild(this.textField); // Затем добавляем текст поверх
        this._updateTextPosition();
        // Если шрифт уже загружен — показываем сразу, иначе подождём загрузки
        if (this._isFontLoaded(fontFamily, this.fontSize)) {
            this.textField.visible = true;
        } else {
            this._ensureWebFontApplied(fontFamily, this.fontSize);
            // Фолбэк на случай отсутствия Font Loading API — короткая задержка
            try {
                if (!(typeof document !== 'undefined' && document.fonts && typeof document.fonts.load === 'function')) {
                    setTimeout(() => { try { this.textField.visible = true; } catch (_) {} }, 300);
                }
            } catch (_) {}
        }

        // Гарантируем применение web-font (например, Caveat) при первом создании
        this._ensureWebFontApplied(fontFamily, this.fontSize);
        
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
                fontFamily: fontFamily,
                backgroundColor: this.backgroundColor,
                borderColor: this.borderColor,
                textColor: this.textColor,
                ...objectData.properties 
            }
        };

        this._redraw();
    }

    /**
     * Возвращает видимую ширину текстового блока, согласованную с режимом редактирования
     */
    _getVisibleTextWidth() {
        const horizontalPadding = 16;
        const contentWidth = Math.max(1, this.width - (horizontalPadding * 2));
        return Math.max(1, Math.min(360, contentWidth));
    }

    /** Проверяет, загружен ли указанный web-шрифт */
    _isFontLoaded(fontFamily, fontSizePx) {
        try {
            if (typeof document === 'undefined' || !document.fonts || typeof document.fonts.check !== 'function') return false;
            const primary = String(fontFamily || '').split(',')[0].trim().replace(/^['"]|['"]$/g, '') || 'Caveat';
            const size = Math.max(1, Number(fontSizePx) || 32);
            const spec = `normal ${size}px ${primary}`;
            return document.fonts.check(spec);
        } catch (_) {
            return false;
        }
    }

    /**
     * Подгоняет размер шрифта так, чтобы текст умещался внутри записки
     */
    _fitTextToBounds() {
        if (!this.textField) return;
        const maxWidth = this._getVisibleTextWidth();
        const verticalPadding = 16;
        const maxHeight = Math.max(1, this.height - (verticalPadding * 2));

        // Базовые установки стиля перед измерением
        this.textField.style.wordWrap = true;
        this.textField.style.breakWords = true;
        this.textField.style.wordWrapWidth = maxWidth;

        // Начинаем с желаемого размера шрифта
        let displayFontSize = Math.max(1, Number(this.fontSize) || 32);
        const minFontSize = 8;
        let safety = 0;
        const maxIterations = 64;

        while (safety < maxIterations) {
            this.textField.style.fontSize = displayFontSize;
            this.textField.style.lineHeight = this._computeLineHeightPx(displayFontSize);
            this.textField.updateText();
            const needsShrink = this.textField.height > maxHeight;
            if (!needsShrink || displayFontSize <= minFontSize) break;
            displayFontSize = Math.max(minFontSize, displayFontSize - 1);
            safety++;
        }
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
        if (this.textField) this.textField.visible = false;
        this.textField.text = this.content;
        this._updateTextPosition();
        if (this.textField) this.textField.visible = true;
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
            // Согласуем с HTML-слоем
            this.textField.style.lineHeight = this._computeLineHeightPx(fontSize);
            this.textField.style.padding = 3;
            this.textField.style.trim = false;
            this.textField.style.letterSpacing = 0;
        }
        if (typeof arguments[0]?.fontFamily === 'string') {
            const ff = arguments[0].fontFamily;
            this.textField.style.fontFamily = ff;
            if (this.container && this.container._mb) {
                this.container._mb.properties = {
                    ...(this.container._mb.properties || {}),
                    fontFamily: ff
                };
            }
            this._ensureWebFontApplied(ff, this.fontSize);
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

    /**
     * Дожидается загрузки веб-шрифта и обновляет PIXI.Text, чтобы применились корректные метрики
     */
    _ensureWebFontApplied(fontFamily, fontSizePx) {
        try {
            if (typeof document === 'undefined' || !document.fonts || !document.fonts.load) return;
            const primary = String(fontFamily || '').split(',')[0].trim().replace(/^['"]|['"]$/g, '') || 'Caveat';
            const size = Math.max(1, Number(fontSizePx) || 32);
            const spec = `normal ${size}px ${primary}`;
            document.fonts.load(spec).then(() => {
                // Обновляем текст после загрузки шрифта и сразу подгоняем без мерцания
                try {
                    if (this.textField) this.textField.visible = false;
                    this.textField.style.fontFamily = fontFamily;
                    this._updateTextPosition();
                    if (this.textField) this.textField.visible = true;
                } catch (_) {}
            }).catch(() => {});
        } catch (_) {}
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

        // Обновляем маску текста под новые размеры
        const pad = 16;
        this.textMask.clear();
        this.textMask.beginFill(0x000000, 1);
        this.textMask.drawRect(pad, pad, Math.max(1, w - pad * 2), Math.max(1, h - pad * 2));
        this.textMask.endFill();

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
        
        // Обновляем стиль текста согласно ограничениям редактора
        this.textField.style.wordWrapWidth = this._getVisibleTextWidth();
        this.textField.style.wordWrap = true;
        this.textField.style.breakWords = true;

        // Подгоняем размер шрифта под доступные границы
        this._fitTextToBounds();

        // Обновляем текст после подгонки
        this.textField.updateText();
        
        // Центрируем текст по центру заметки
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        this.textField.anchor.set(0.5, 0.5);
        this.textField.x = centerX;
        this.textField.y = centerY;
    }
}
