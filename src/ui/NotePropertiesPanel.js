import { Events } from '../core/events/Events.js';

/**
 * Панель свойств записки
 * Отображается над выделенной запиской
 */
export class NotePropertiesPanel {
    constructor(eventBus, container, core = null) {
        this.eventBus = eventBus;
        this.container = container;
        this.core = core;
        this.panel = null;
        this.currentId = null;
        
        this._attachEvents();
        this._createPanel();
    }

    _attachEvents() {
        // Показываем панель при изменении выделения
        this.eventBus.on(Events.Tool.SelectionAdd, () => this.updateFromSelection());
        this.eventBus.on(Events.Tool.SelectionRemove, () => this.updateFromSelection());
        this.eventBus.on(Events.Tool.SelectionClear, () => this.hide());

        // Скрываем панель при удалении объекта
        this.eventBus.on(Events.Object.Deleted, (objectId) => {
            if (this.currentId && objectId === this.currentId) this.hide();
        });

        // Обновляем позицию / скрываем во время перетаскивания
        this.eventBus.on(Events.Tool.DragStart, () => this.hide());
        this.eventBus.on(Events.Tool.DragUpdate, () => this.reposition());
        this.eventBus.on(Events.Tool.DragEnd, () => this.updateFromSelection());
        this.eventBus.on(Events.Tool.GroupDragUpdate, () => this.reposition());
        this.eventBus.on(Events.Tool.GroupDragStart, () => this.hide());
        this.eventBus.on(Events.Tool.GroupDragEnd, () => this.updateFromSelection());
        this.eventBus.on(Events.Tool.ResizeUpdate, () => this.reposition());
        this.eventBus.on(Events.Tool.RotateUpdate, () => this.reposition());

        // Обновляем позицию при зуме/пане
        this.eventBus.on(Events.UI.ZoomPercent, () => {
            if (this.currentId) this.reposition();
        });

        this.eventBus.on(Events.Tool.PanUpdate, () => {
            if (this.currentId) this.reposition();
        });

        // Скрываем панель при активации других инструментов
        this.eventBus.on(Events.Tool.Activated, ({ tool }) => {
            if (tool !== 'select') {
                this.hide();
            }
        });
    }

    updateFromSelection() {
        // Показываем только для одиночного выделения записки
        const ids = this.core?.selectTool ? Array.from(this.core.selectTool.selectedObjects || []) : [];
        
        if (!ids || ids.length !== 1) { 
            this.hide(); 
            return; 
        }
        
        const id = ids[0];
        
        // Избегаем дублирования - если уже показываем панель для этого объекта
        if (this.currentId === id && this.panel && this.panel.style.display !== 'none') {
            return;
        }
        
        const pixi = this.core?.pixi?.objects?.get ? this.core.pixi.objects.get(id) : null;
        const isNote = !!(pixi && pixi._mb && pixi._mb.type === 'note');
        
        
        if (isNote) {
            this.showFor(id);
        } else {
            this.hide();
        }
    }

    showFor(objectId) {
        this.currentId = objectId;
        if (this.panel) {
            this.panel.style.display = 'flex';
            this.reposition();
        }
        
        // Обновляем контролы в соответствии с текущими свойствами объекта
        this._updateControlsFromObject();
    }

    hide() {
        this.currentId = null;
        if (this.panel) {
            this.panel.style.display = 'none';
        }
        // Скрываем все палитры цветов
        if (this.backgroundColorPalette) this.backgroundColorPalette.style.display = 'none';
        if (this.textColorPalette) this.textColorPalette.style.display = 'none';
    }

    _createPanel() {
        const panel = document.createElement('div');
        panel.className = 'note-properties-panel';
        Object.assign(panel.style, {
            position: 'absolute',
            display: 'none',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 40px',
            backgroundColor: 'white',
            border: '1px solid #e0e0e0',
            borderRadius: '9999px',
            boxShadow: '0 6px 24px rgba(0, 0, 0, 0.16)',
            fontSize: '12px',
            fontFamily: 'Arial, sans-serif',
            minWidth: '320px',
            height: '40px',
            zIndex: '10000',
            backdropFilter: 'blur(4px)'
        });

        // Создаем контролы для записки
        this._createNoteControls(panel);

        // Добавляем ID для удобной настройки через DevTools
        panel.id = 'note-properties-panel';

        this.panel = panel;
        this.container.appendChild(panel);
    }

    reposition() {
        if (!this.panel || !this.currentId || this.panel.style.display === 'none') {
            return;
        }

        // Проверяем, что наш объект все еще выделен
        const ids = this.core?.selectTool ? Array.from(this.core.selectTool.selectedObjects || []) : [];
        if (!ids.includes(this.currentId)) {
            this.hide();
            return;
        }

        // Получаем позицию и размеры объекта
        const posData = { objectId: this.currentId, position: null };
        this.eventBus.emit(Events.Tool.GetObjectPosition, posData);
        
        const sizeData = { objectId: this.currentId, size: null };
        this.eventBus.emit(Events.Tool.GetObjectSize, sizeData);

        if (!posData.position || !sizeData.size) {
            return;
        }

        // Получаем зум и позицию мира
        const worldLayer = this.core?.pixi?.worldLayer;
        const scale = worldLayer?.scale?.x || 1;
        const worldX = worldLayer?.x || 0;
        const worldY = worldLayer?.y || 0;

        // Преобразуем координаты объекта в экранные координаты
        const screenX = posData.position.x * scale + worldX;
        const screenY = posData.position.y * scale + worldY;
        const objectWidth = sizeData.size.width * scale;
        const objectHeight = sizeData.size.height * scale;

        // Позиционируем панель над запиской, по центру
        const panelW = this.panel.offsetWidth || 320;
        const panelH = this.panel.offsetHeight || 40;
        let panelX = screenX + (objectWidth / 2) - (panelW / 2);
        let panelY = screenY - panelH - 40; // отступ 40px над запиской

        // Если панель уходит за верх, переносим ниже записки
        if (panelY < 0) {
            panelY = screenY + objectHeight + 40;
        }

        // Проверяем границы контейнера
        const containerRect = this.container.getBoundingClientRect();
        const finalX = Math.max(10, Math.min(panelX, containerRect.width - panelW - 10));
        const finalY = Math.max(10, panelY);

        this.panel.style.left = `${Math.round(finalX)}px`;
        this.panel.style.top = `${Math.round(finalY)}px`;
    }

    _createNoteControls(panel) {
        // Контейнер для выбора шрифта (как в панели текста)
        const fontContainer = document.createElement('div');
        Object.assign(fontContainer.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
        });

        const fontLabel = document.createElement('span');
        fontLabel.textContent = 'Шрифт:';
        Object.assign(fontLabel.style, {
            fontSize: '11px',
            color: '#666',
            minWidth: '40px'
        });

        const fontSelect = document.createElement('select');
        Object.assign(fontSelect.style, {
            border: '1px solid #ddd',
            borderRadius: '4px',
            padding: '3px 8px',
            fontSize: '12px',
            backgroundColor: '#fff',
            cursor: 'pointer',
            minWidth: '140px',
        });
        this.fontSelect = fontSelect;

        const fonts = [
            { value: 'Caveat, Arial, cursive', name: 'Caveat' },
            { value: 'Roboto, Arial, sans-serif', name: 'Roboto' },
            { value: 'Oswald, Arial, sans-serif', name: 'Oswald' },
            { value: 'Playfair Display, Georgia, serif', name: 'Playfair Display' },
            { value: 'Roboto Slab, Georgia, serif', name: 'Roboto Slab' },
            { value: 'Noto Serif, Georgia, serif', name: 'Noto Serif' },
            { value: 'Lobster, Arial, cursive', name: 'Lobster' },
            { value: 'Rubik Mono One, Arial, sans-serif', name: 'Rubik Mono One' },
            { value: 'Great Vibes, Arial, cursive', name: 'Great Vibes' },
            { value: 'Amatic SC, Arial, cursive', name: 'Amatic SC' },
            { value: 'Poiret One, Arial, cursive', name: 'Poiret One' },
            { value: 'Pacifico, Arial, cursive', name: 'Pacifico' },
        ];
        fonts.forEach((font) => {
            const option = document.createElement('option');
            option.value = font.value;
            option.textContent = font.name;
            option.style.fontFamily = font.value;
            fontSelect.appendChild(option);
        });

        fontSelect.addEventListener('change', (e) => {
            this._changeFontFamily(e.target.value);
        });

        fontContainer.appendChild(fontLabel);
        fontContainer.appendChild(fontSelect);

        // Контейнер для цвета фона
        const backgroundContainer = this._createColorControl(
            'Фон:',
            'backgroundColorButton',
            'backgroundColorPalette',
            [
                { name: 'Желтый', hex: '#FFF9C4', pixi: 0xFFF9C4 },
                { name: 'Розовый', hex: '#FCE4EC', pixi: 0xFCE4EC },
                { name: 'Голубой', hex: '#E3F2FD', pixi: 0xE3F2FD },
                { name: 'Зеленый', hex: '#E8F5E8', pixi: 0xE8F5E8 },
                { name: 'Оранжевый', hex: '#FFF3E0', pixi: 0xFFF3E0 },
                { name: 'Сиреневый', hex: '#F3E5F5', pixi: 0xF3E5F5 }
            ],
            'backgroundColor'
        );

        // Раздел "Граница" удалён по требованиям дизайна

        // Контейнер для цвета текста
        const textContainer = this._createColorControl(
            'Текст:',
            'textColorButton',
            'textColorPalette',
            [
                { name: 'Черный', hex: '#1A1A1A', pixi: 0x1A1A1A },
                { name: 'Серый', hex: '#666666', pixi: 0x666666 },
                { name: 'Синий', hex: '#1976D2', pixi: 0x1976D2 },
                { name: 'Зеленый', hex: '#388E3C', pixi: 0x388E3C },
                { name: 'Красный', hex: '#D32F2F', pixi: 0xD32F2F },
                { name: 'Фиолетовый', hex: '#7B1FA2', pixi: 0x7B1FA2 }
            ],
            'textColor'
        );

        // Контейнер для размера шрифта
        const fontSizeContainer = document.createElement('div');
        Object.assign(fontSizeContainer.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
        });

        const fontSizeLabel = document.createElement('span');
        fontSizeLabel.textContent = 'Размер:';
        Object.assign(fontSizeLabel.style, {
            fontSize: '11px',
            color: '#666',
            minWidth: '32px'
        });

        const fontSizeInput = document.createElement('input');
        fontSizeInput.type = 'number';
        fontSizeInput.min = '8';
        fontSizeInput.max = '32';
        fontSizeInput.value = '16';
        Object.assign(fontSizeInput.style, {
            width: '40px',
            height: '20px',
            padding: '1px 4px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '11px',
            textAlign: 'center'
        });

        fontSizeInput.addEventListener('change', () => {
            const fontSize = parseInt(fontSizeInput.value);
            if (fontSize >= 8 && fontSize <= 32) {
                this._changeFontSize(fontSize);
            }
        });

        this.fontSizeInput = fontSizeInput;

        fontSizeContainer.appendChild(fontSizeLabel);
        fontSizeContainer.appendChild(fontSizeInput);

        panel.appendChild(fontContainer);
        panel.appendChild(backgroundContainer);
        panel.appendChild(textContainer);
        panel.appendChild(fontSizeContainer);
    }

    _createColorControl(labelText, buttonProperty, paletteProperty, colors, propertyName) {
        const container = document.createElement('div');
        Object.assign(container.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            position: 'relative'
        });

        const label = document.createElement('span');
        label.textContent = labelText;
        Object.assign(label.style, {
            fontSize: '11px',
            color: '#666',
            minWidth: '32px'
        });

        const button = document.createElement('button');
        Object.assign(button.style, {
            width: '24px',
            height: '24px',
            border: `1px solid ${this._darkenHex(colors[0].hex, 0.28)}`,
            borderRadius: '50%',
            cursor: 'pointer',
            backgroundColor: colors[0].hex,
            padding: '0'
        });

        button.addEventListener('click', (e) => {
            e.stopPropagation();
            this._toggleColorPalette(button, paletteProperty);
        });

        this[buttonProperty] = button;

        // Создаем палитру
        const palette = this._createColorPalette(colors, propertyName);
        this[paletteProperty] = palette;

        container.appendChild(label);
        container.appendChild(button);
        container.appendChild(palette);

        return container;
    }

    _createColorPalette(colors, propertyName) {
        const palette = document.createElement('div');
        Object.assign(palette.style, {
            position: 'absolute',
            top: '100%',
            left: '0',
            display: 'none',
            flexWrap: 'wrap',
            gap: '4px',
            padding: '8px',
            backgroundColor: 'white',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            zIndex: '10001',
            width: '120px'
        });

        colors.forEach(color => {
            const colorSwatch = document.createElement('div');
            Object.assign(colorSwatch.style, {
                width: '22px',
                height: '22px',
                backgroundColor: color.hex,
                border: `1px solid ${this._darkenHex(color.hex, 0.28)}`,
                borderRadius: '50%',
                cursor: 'pointer',
                transition: 'transform 0.1s'
            });

            colorSwatch.title = color.name;

            colorSwatch.addEventListener('click', () => {
                this._selectColor(color, propertyName);
                this._hideAllColorPalettes();
            });

            colorSwatch.addEventListener('mouseenter', () => {
                colorSwatch.style.transform = 'scale(1.1)';
            });

            colorSwatch.addEventListener('mouseleave', () => {
                colorSwatch.style.transform = 'scale(1)';
            });

            palette.appendChild(colorSwatch);
        });

        return palette;
    }

    _toggleColorPalette(button, paletteProperty) {
        // Скрываем все другие палитры
        this._hideAllColorPalettes();
        
        const palette = this[paletteProperty];
        if (!palette) return;

        const isVisible = palette.style.display !== 'none';
        
        if (isVisible) {
            palette.style.display = 'none';
        } else {
            palette.style.display = 'flex';
            // Добавляем обработчик клика по документу для закрытия палитры
            setTimeout(() => {
                document.addEventListener('click', this._documentClickHandler.bind(this));
            }, 0);
        }
    }

    _hideAllColorPalettes() {
        if (this.backgroundColorPalette) this.backgroundColorPalette.style.display = 'none';
        if (this.borderColorPalette) this.borderColorPalette.style.display = 'none';
        if (this.textColorPalette) this.textColorPalette.style.display = 'none';
        document.removeEventListener('click', this._documentClickHandler.bind(this));
    }

    _documentClickHandler(e) {
        const palettes = [this.backgroundColorPalette, this.textColorPalette];
        const buttons = [this.backgroundColorButton, this.textColorButton];
        
        let shouldClose = true;
        
        for (let palette of palettes) {
            // ИСПРАВЛЕНИЕ: Защита от null элементов
            if (palette && e.target && palette.contains(e.target)) {
                shouldClose = false;
                break;
            }
        }
        
        for (let button of buttons) {
            // ИСПРАВЛЕНИЕ: Защита от null элементов
            if (button && e.target && button.contains(e.target)) {
                shouldClose = false;
                break;
            }
        }
        
        if (shouldClose) {
            this._hideAllColorPalettes();
        }
    }

    _selectColor(color, propertyName) {
        if (!this.currentId) return;


        // Обновляем соответствующую кнопку
        if (propertyName === 'backgroundColor' && this.backgroundColorButton) {
            this.backgroundColorButton.style.backgroundColor = color.hex;
            this.backgroundColorButton.style.borderColor = this._darkenHex(color.hex, 0.28);
            this.backgroundColorButton.title = `Цвет фона: ${color.name}`;
        } else if (propertyName === 'textColor' && this.textColorButton) {
            this.textColorButton.style.backgroundColor = color.hex;
            this.textColorButton.style.borderColor = this._darkenHex(color.hex, 0.28);
            this.textColorButton.title = `Цвет текста: ${color.name}`;
        }

        // Отправляем событие изменения свойства
        const updates = { properties: {} };
        updates.properties[propertyName] = color.pixi;

        this.eventBus.emit(Events.Object.StateChanged, {
            objectId: this.currentId,
            updates: updates
        });
    }

    _changeFontSize(fontSize) {
        if (!this.currentId) return;


        // Отправляем событие изменения размера шрифта
        this.eventBus.emit(Events.Object.StateChanged, {
            objectId: this.currentId,
            updates: { properties: { fontSize: fontSize } }
        });
    }

    _changeFontFamily(fontFamily) {
        if (!this.currentId) return;


        this.eventBus.emit(Events.Object.StateChanged, {
            objectId: this.currentId,
            updates: { properties: { fontFamily: fontFamily } }
        });
    }

    _updateControlsFromObject() {
        if (!this.currentId) return;

        const objectData = this.core.getObjectData(this.currentId);
        if (objectData && objectData.properties) {
            const props = objectData.properties;

            // Обновляем кнопки цветов
            if (this.backgroundColorButton && props.backgroundColor !== undefined) {
                this._updateColorButton(this.backgroundColorButton, props.backgroundColor);
            }
            // Раздел "Граница" удалён — пропускаем обновление кнопки границы
            if (this.textColorButton && props.textColor !== undefined) {
                this._updateColorButton(this.textColorButton, props.textColor);
            }

            // Обновляем размер шрифта
            if (this.fontSizeInput && props.fontSize !== undefined) {
                this.fontSizeInput.value = props.fontSize.toString();
            }

            // Обновляем выбранный шрифт
            if (this.fontSelect) {
                this.fontSelect.value = props.fontFamily || 'Pacifico, Arial, sans-serif';
            }
        }
    }

    _updateColorButton(button, pixiColor) {
        if (!button) return;

        // Конвертируем PIXI цвет в hex строку
        const hexColor = `#${pixiColor.toString(16).padStart(6, '0').toUpperCase()}`;
        button.style.backgroundColor = hexColor;
        button.style.borderColor = this._darkenHex(hexColor, 0.28);
    }

    /**
     * Затемняет hex-цвет на заданную долю (0..1)
     */
    _darkenHex(hex, amount = 0.2) {
        try {
            const norm = (hex || '').trim();
            const m = /^#?([a-fA-F0-9]{6})$/.exec(norm.startsWith('#') ? norm : `#${norm}`);
            if (!m) return '#777777';
            const num = parseInt(m[1], 16);
            const r = Math.max(0, Math.min(255, Math.floor(((num >> 16) & 0xFF) * (1 - amount))));
            const g = Math.max(0, Math.min(255, Math.floor(((num >> 8) & 0xFF) * (1 - amount))));
            const b = Math.max(0, Math.min(255, Math.floor((num & 0xFF) * (1 - amount))));
            const toHex = (v) => v.toString(16).padStart(2, '0').toUpperCase();
            return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
        } catch (_) {
            return '#777777';
        }
    }

    destroy() {
        // Удаляем обработчик клика по документу
        document.removeEventListener('click', this._documentClickHandler.bind(this));
        
        if (this.panel && this.panel.parentNode) {
            this.panel.parentNode.removeChild(this.panel);
        }
        this.panel = null;
        this.currentId = null;
    }
}
