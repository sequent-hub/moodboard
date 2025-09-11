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
        
        console.log('📝 NotePropertiesPanel: updateFromSelection - id=', id, 'isNote=', isNote);
        
        if (isNote) {
            this.showFor(id);
        } else {
            this.hide();
        }
    }

    showFor(objectId) {
        console.log('📝 NotePropertiesPanel: Showing panel for objectId:', objectId);
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
        if (this.borderColorPalette) this.borderColorPalette.style.display = 'none';
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
            padding: '8px 12px',
            backgroundColor: 'white',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            fontSize: '12px',
            fontFamily: 'Arial, sans-serif',
            minWidth: '320px',
            height: '40px',
            zIndex: '10000'
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

        const { x, y } = posData.position;
        const { width, height } = sizeData.size;

        // Позиционируем панель над запиской, по центру
        const panelRect = this.panel.getBoundingClientRect();
        const panelW = Math.max(1, panelRect.width || 320);
        const panelH = Math.max(1, panelRect.height || 40);
        const panelX = x + (width / 2) - (panelW / 2);
        const panelY = Math.max(0, y - panelH - 40); // отступ 40px над запиской
        
        console.log('📝 NotePropertiesPanel: Positioning next to note:', { 
            noteX: x, noteY: y, noteWidth: width, noteHeight: height,
            panelX, panelY
        });

        this.panel.style.left = `${Math.round(panelX)}px`;
        this.panel.style.top = `${Math.round(panelY)}px`;
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

        // Контейнер для цвета границы
        const borderContainer = this._createColorControl(
            'Граница:',
            'borderColorButton',
            'borderColorPalette',
            [
                { name: 'Золотой', hex: '#F9A825', pixi: 0xF9A825 },
                { name: 'Розовый', hex: '#E91E63', pixi: 0xE91E63 },
                { name: 'Синий', hex: '#2196F3', pixi: 0x2196F3 },
                { name: 'Зеленый', hex: '#4CAF50', pixi: 0x4CAF50 },
                { name: 'Оранжевый', hex: '#FF9800', pixi: 0xFF9800 },
                { name: 'Фиолетовый', hex: '#9C27B0', pixi: 0x9C27B0 }
            ],
            'borderColor'
        );

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
        panel.appendChild(borderContainer);
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
            width: '32px',
            height: '20px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
            backgroundColor: colors[0].hex
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
                width: '20px',
                height: '20px',
                backgroundColor: color.hex,
                border: '1px solid #ccc',
                borderRadius: '4px',
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
        const palettes = [this.backgroundColorPalette, this.borderColorPalette, this.textColorPalette];
        const buttons = [this.backgroundColorButton, this.borderColorButton, this.textColorButton];
        
        let shouldClose = true;
        
        for (let palette of palettes) {
            if (palette && palette.contains(e.target)) {
                shouldClose = false;
                break;
            }
        }
        
        for (let button of buttons) {
            if (button && button.contains(e.target)) {
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

        console.log(`📝 NotePropertiesPanel: Selecting ${propertyName}:`, color);

        // Обновляем соответствующую кнопку
        if (propertyName === 'backgroundColor' && this.backgroundColorButton) {
            this.backgroundColorButton.style.backgroundColor = color.hex;
            this.backgroundColorButton.title = `Цвет фона: ${color.name}`;
        } else if (propertyName === 'borderColor' && this.borderColorButton) {
            this.borderColorButton.style.backgroundColor = color.hex;
            this.borderColorButton.title = `Цвет границы: ${color.name}`;
        } else if (propertyName === 'textColor' && this.textColorButton) {
            this.textColorButton.style.backgroundColor = color.hex;
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

        console.log('📝 NotePropertiesPanel: Changing font size to:', fontSize);

        // Отправляем событие изменения размера шрифта
        this.eventBus.emit(Events.Object.StateChanged, {
            objectId: this.currentId,
            updates: { properties: { fontSize: fontSize } }
        });
    }

    _changeFontFamily(fontFamily) {
        if (!this.currentId) return;

        console.log('📝 NotePropertiesPanel: Changing font family to:', fontFamily);

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
            if (this.borderColorButton && props.borderColor !== undefined) {
                this._updateColorButton(this.borderColorButton, props.borderColor);
            }
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
