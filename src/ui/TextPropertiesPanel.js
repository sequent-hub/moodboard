import { Events } from '../core/events/Events.js';

/**
 * TextPropertiesPanel — всплывающая панель свойств для текстовых объектов
 */
export class TextPropertiesPanel {
    constructor(container, eventBus, core) {
        this.container = container;
        this.eventBus = eventBus;
        this.core = core;
        this.layer = null;
        this.panel = null;
        this.currentId = null;
        this.isTextEditing = false; // Флаг режима редактирования текста
        
        this._onDocMouseDown = this._onDocMouseDown.bind(this);
    }

    attach() {
        this.layer = document.createElement('div');
        this.layer.className = 'text-properties-layer';
        Object.assign(this.layer.style, {
            position: 'absolute', 
            inset: '0', 
            pointerEvents: 'none', 
            zIndex: 20 // Меньше чем у комментариев, но выше основного контента
        });
        this.container.appendChild(this.layer);

        // Подписки на события
        this.eventBus.on(Events.Tool.SelectionAdd, () => this.updateFromSelection());
        this.eventBus.on(Events.Tool.SelectionRemove, () => this.updateFromSelection());
        this.eventBus.on(Events.Tool.SelectionClear, () => this.hide());
        this.eventBus.on(Events.Tool.DragUpdate, () => this.reposition());
        this.eventBus.on(Events.Tool.GroupDragUpdate, () => this.reposition());
        this.eventBus.on(Events.Tool.ResizeUpdate, () => this.reposition());
        this.eventBus.on(Events.Tool.RotateUpdate, () => this.reposition());
        this.eventBus.on(Events.UI.ZoomPercent, () => this.reposition());
        this.eventBus.on(Events.Tool.PanUpdate, () => this.reposition());
        this.eventBus.on(Events.Object.Deleted, ({ objectId }) => {
            if (this.currentId && objectId === this.currentId) this.hide();
        });
        
        // Во время редактирования текста скрываем панель
        this.eventBus.on(Events.UI.TextEditStart, () => {
            this.isTextEditing = true;
            this.hide();
        });
        this.eventBus.on(Events.UI.TextEditEnd, () => {
            this.isTextEditing = false;
            // Небольшая задержка, чтобы не появлялась сразу после завершения редактирования
            setTimeout(() => this.updateFromSelection(), 100);
        });
    }

    destroy() {
        this.hide();
        if (this.layer) this.layer.remove();
        this.layer = null;
    }

    updateFromSelection() {
        // Не показываем панель во время редактирования текста
        if (this.isTextEditing) {
            this.hide();
            return;
        }

        // Показываем только для одиночного выделения текстового объекта
        const ids = this.core?.selectTool ? Array.from(this.core.selectTool.selectedObjects || []) : [];
        if (!ids || ids.length !== 1) { 
            this.hide(); 
            return; 
        }
        
        const id = ids[0];
        const pixi = this.core?.pixi?.objects?.get ? this.core.pixi.objects.get(id) : null;
        if (!pixi) { 
            this.hide(); 
            return; 
        }
        
        const mb = pixi._mb || {};
        if (mb.type !== 'text') { 
            this.hide(); 
            return; 
        }
        
        this.currentId = id;
        this.showFor(id);
    }

    showFor(id) {
        if (!this.layer) return;
        
        if (!this.panel) {
            this.panel = this._createPanel();
            this.layer.appendChild(this.panel);
            document.addEventListener('mousedown', this._onDocMouseDown, true);
        }
        
        this.panel.style.display = 'flex';
        this.reposition();
        
        // Обновляем контролы в соответствии с текущими свойствами объекта
        this._updateControlsFromObject();
    }

    hide() {
        this.currentId = null;
        if (this.panel) {
            this.panel.style.display = 'none';
        }
        this._hideColorDropdown(); // Закрываем выпадающую панель цветов
        this._hideBgColorDropdown(); // Закрываем выпадающую панель фона
        document.removeEventListener('mousedown', this._onDocMouseDown, true);
    }

    _createPanel() {
        const panel = document.createElement('div');
        panel.className = 'text-properties-panel';
        // Основные стили панели вынесены в CSS (.text-properties-panel)

        // Создаем контролы
        this._createFontControls(panel);

        return panel;
    }

    _createFontControls(panel) {
        // Лейбл для шрифта
        const fontLabel = document.createElement('span');
        fontLabel.textContent = 'Шрифт:';
        fontLabel.className = 'tpp-label';
        panel.appendChild(fontLabel);

        // Выпадающий список шрифтов
        this.fontSelect = document.createElement('select');
        this.fontSelect.className = 'font-select';
        this.fontSelect.className = 'font-select';

        // Список популярных шрифтов
        const fonts = [
            { value: 'Roboto, Arial, sans-serif', name: 'Roboto' },
            { value: 'Oswald, Arial, sans-serif', name: 'Oswald' },
            { value: '"Playfair Display", Georgia, serif', name: 'Playfair Display' },
            { value: '"Roboto Slab", Georgia, serif', name: 'Roboto Slab' },
            { value: '"Noto Serif", Georgia, serif', name: 'Noto Serif' },
            { value: 'Lobster, "Comic Sans MS", cursive', name: 'Lobster' },
            { value: 'Caveat, "Comic Sans MS", cursive', name: 'Caveat' },
            { value: '"Rubik Mono One", "Courier New", monospace', name: 'Rubik Mono One' },
            { value: '"Great Vibes", "Comic Sans MS", cursive', name: 'Great Vibes' },
            { value: '"Amatic SC", "Comic Sans MS", cursive', name: 'Amatic SC' },
            { value: '"Poiret One", Arial, sans-serif', name: 'Poiret One' },
            { value: 'Pacifico, "Comic Sans MS", cursive', name: 'Pacifico' }
        ];

        fonts.forEach(font => {
            const option = document.createElement('option');
            option.value = font.value;
            option.textContent = font.name;
            option.style.fontFamily = font.value;
            this.fontSelect.appendChild(option);
        });

        // Обработчик изменения шрифта
        this.fontSelect.addEventListener('change', (e) => {
            this._changeFontFamily(e.target.value);
        });

        panel.appendChild(this.fontSelect);

        // Лейбл для размера
        const sizeLabel = document.createElement('span');
        sizeLabel.textContent = 'Размер:';
        sizeLabel.className = 'tpp-label tpp-label--spaced';
        panel.appendChild(sizeLabel);

        // Выпадающий список размеров шрифта
        this.fontSizeSelect = document.createElement('select');
        this.fontSizeSelect.className = 'font-size-select';
        this.fontSizeSelect.className = 'font-size-select';

        // Популярные размеры шрифта
        const fontSizes = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72];

        fontSizes.forEach(size => {
            const option = document.createElement('option');
            option.value = size;
            option.textContent = `${size}px`;
            this.fontSizeSelect.appendChild(option);
        });

        // Обработчик изменения размера шрифта
        this.fontSizeSelect.addEventListener('change', (e) => {
            this._changeFontSize(parseInt(e.target.value));
        });

        panel.appendChild(this.fontSizeSelect);

        // Лейбл для цвета
        const colorLabel = document.createElement('span');
        colorLabel.textContent = 'Цвет:';
        colorLabel.className = 'tpp-label tpp-label--spaced';
        panel.appendChild(colorLabel);

        // Создаем компактный селектор цвета текста
        this._createCompactColorSelector(panel);

        // Лейбл для фона
        const bgColorLabel = document.createElement('span');
        bgColorLabel.textContent = 'Фон:';
        bgColorLabel.className = 'tpp-label tpp-label--spaced';
        panel.appendChild(bgColorLabel);

        // Создаем компактный селектор цвета фона
        this._createCompactBackgroundSelector(panel);
    }

    _createCompactColorSelector(panel) {
        // Контейнер для селектора цвета
        const colorSelectorContainer = document.createElement('div');
        colorSelectorContainer.style.cssText = `
            position: relative;
            display: inline-block;
            margin-left: 4px;
        `;

        // Кнопка показывающая текущий цвет
        this.currentColorButton = document.createElement('button');
        this.currentColorButton.type = 'button';
        this.currentColorButton.title = 'Выбрать цвет';
        this.currentColorButton.className = 'current-color-button';

        // Создаем выпадающую панель с цветами
        this.colorDropdown = document.createElement('div');
        this.colorDropdown.style.cssText = `
            position: absolute;
            top: 100%;
            left: 0;
            background: white;
            border: 1px solid #ddd;
            border-radius: 6px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            padding: 8px;
            display: none;
            z-index: 10000;
            min-width: 200px;
        `;

        // Создаем сетку цветов
        this._createColorGrid(this.colorDropdown);

        // Обработчик клика по кнопке
        this.currentColorButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this._toggleColorDropdown();
        });

        // Закрываем панель при клике вне её
        document.addEventListener('click', (e) => {
            if (!colorSelectorContainer.contains(e.target)) {
                this._hideColorDropdown();
            }
        });

        colorSelectorContainer.appendChild(this.currentColorButton);
        colorSelectorContainer.appendChild(this.colorDropdown);
        panel.appendChild(colorSelectorContainer);
    }

    _createColorGrid(container) {
        // Популярные цвета для текста
        const presetColors = [
            { color: '#000000', name: '#000000' },
            { color: '#404040', name: '#404040' },
            { color: '#999999', name: '#999999' },
            { color: '#FF2D55', name: '#FF2D55' },
            { color: '#CB30E0', name: '#CB30E0' },
            { color: '#6155F5', name: '#6155F5' },
            { color: '#00C0E8', name: '#00C0E8' },
            { color: '#34C759', name: '#34C759' },
            { color: '#FF8D28', name: '#FF8D28' },
            { color: '#FFCC00', name: '#FFCC00' }
        ];

        // Сетка заготовленных цветов
        const presetsGrid = document.createElement('div');
        presetsGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(6, 28px);
            gap: 6px;
            margin-bottom: 8px;
            align-items: center;
            justify-items: center;
        `;

        presetColors.forEach(preset => {
            const colorButton = document.createElement('button');
            colorButton.type = 'button';
            colorButton.title = preset.name;
            colorButton.style.cssText = `
                width: 28px;
                height: 28px;
                border: 1px solid #ddd;
                border-radius: 50%;
                background-color: ${preset.color};
                cursor: pointer;
                margin: 0;
                padding: 0;
                display: block;
                box-sizing: border-box;
                ${preset.color === '#ffffff' ? 'border-color: #ccc;' : ''}
                position: relative;
            `;
            // Галочка по центру активного пресета
            const tick = document.createElement('i');
            tick.style.cssText = `
                position: absolute;
                left: 50%;
                top: 50%;
                width: 8px;
                height: 5px;
                transform: translate(-50%, -50%) rotate(315deg) scaleX(-1);
                border-right: 2px solid #111;
                border-bottom: 2px solid #111;
                display: none;
                pointer-events: none;
            `;
            colorButton.appendChild(tick);

            colorButton.addEventListener('click', () => {
                // Снимаем активность с других и ставим на текущий
                Array.from(presetsGrid.children).forEach((el) => {
                    const i = el.querySelector('i');
                    if (i) i.style.display = 'none';
                });
                tick.style.display = 'block';
                this._selectColor(preset.color);
            });

            presetsGrid.appendChild(colorButton);
        });

        container.appendChild(presetsGrid);

        // Разделитель
        const separator = document.createElement('div');
        separator.style.cssText = `
            height: 1px;
            background: #eee;
            margin: 8px 0;
        `;
        container.appendChild(separator);

        // Кастомный color picker
        const customContainer = document.createElement('div');
        customContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
        `;

        const customLabel = document.createElement('span');
        customLabel.textContent = 'Свой цвет:';
        customLabel.style.cssText = `
            font-size: 12px;
            color: #666;
        `;

        this.colorInput = document.createElement('input');
        this.colorInput.type = 'color';
        this.colorInput.style.cssText = `
            width: 32px;
            height: 24px;
            border: 1px solid #ddd;
            border-radius: 3px;
            cursor: pointer;
            padding: 0;
        `;

        this.colorInput.addEventListener('change', (e) => {
            this._selectColor(e.target.value);
        });

        customContainer.appendChild(customLabel);
        customContainer.appendChild(this.colorInput);
        container.appendChild(customContainer);
    }

    _toggleColorDropdown() {
        if (this.colorDropdown.style.display === 'none') {
            this.colorDropdown.style.display = 'block';
        } else {
            this.colorDropdown.style.display = 'none';
        }
    }

    _hideColorDropdown() {
        if (this.colorDropdown) {
            this.colorDropdown.style.display = 'none';
        }
    }

    _selectColor(color) {
        this._changeTextColor(color);
        this._updateCurrentColorButton(color);
        this._hideColorDropdown();
    }

    _updateCurrentColorButton(color) {
        if (this.currentColorButton) {
            this.currentColorButton.style.backgroundColor = color;
            this.currentColorButton.title = `Текущий цвет: ${color}`;
        }
        if (this.colorInput) {
            this.colorInput.value = color;
        }
    }

    _createCompactBackgroundSelector(panel) {
        // Контейнер для селектора фона
        const bgSelectorContainer = document.createElement('div');
        bgSelectorContainer.style.cssText = `
            position: relative;
            display: inline-block;
            margin-left: 4px;
        `;

        // Кнопка показывающая текущий цвет фона
        this.currentBgColorButton = document.createElement('button');
        this.currentBgColorButton.type = 'button';
        this.currentBgColorButton.title = 'Выбрать цвет выделения';
        this.currentBgColorButton.className = 'current-bgcolor-button';

        // Создаем выпадающую панель с цветами фона
        this.bgColorDropdown = document.createElement('div');
        this.bgColorDropdown.style.cssText = `
            position: absolute;
            top: 100%;
            left: 0;
            background: white;
            border: 1px solid #ddd;
            border-radius: 6px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            padding: 8px;
            display: none;
            z-index: 10000;
            min-width: 200px;
        `;

        // Создаем сетку цветов фона
        this._createBackgroundColorGrid(this.bgColorDropdown);

        // Обработчик клика по кнопке
        this.currentBgColorButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this._toggleBgColorDropdown();
        });

        // Закрываем панель при клике вне её
        document.addEventListener('click', (e) => {
            if (!bgSelectorContainer.contains(e.target)) {
                this._hideBgColorDropdown();
            }
        });

        bgSelectorContainer.appendChild(this.currentBgColorButton);
        bgSelectorContainer.appendChild(this.bgColorDropdown);
        panel.appendChild(bgSelectorContainer);
    }

    _createBackgroundColorGrid(container) {
        // Цвета для выделения текста (включая прозрачный)
        const bgColors = [
            { color: 'transparent', name: 'Без выделения' },
            { color: '#ffff99', name: 'Желтый' },
            { color: '#ffcc99', name: 'Оранжевый' },
            { color: '#ff9999', name: 'Розовый' },
            { color: '#ccffcc', name: 'Зеленый' },
            { color: '#99ccff', name: 'Голубой' },
            { color: '#cc99ff', name: 'Фиолетовый' },
            { color: '#f0f0f0', name: 'Светло-серый' },
            { color: '#d0d0d0', name: 'Серый' },
            { color: '#ffffff', name: 'Белый' },
            { color: '#000000', name: 'Черный' },
            { color: '#333333', name: 'Темно-серый' }
        ];

        // Сетка заготовленных цветов фона
        const presetsGrid = document.createElement('div');
        presetsGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(6, 28px);
            gap: 6px;
            margin-bottom: 8px;
            align-items: center;
            justify-items: center;
        `;

        bgColors.forEach(preset => {
            const colorButton = document.createElement('button');
            colorButton.type = 'button';
            colorButton.title = preset.name;
            
            if (preset.color === 'transparent') {
                // Специальная кнопка для "без выделения"
                colorButton.style.cssText = `
                    width: 28px;
                    height: 28px;
                    border: 1px solid #ddd;
                    border-radius: 50%;
                    background: white;
                    cursor: pointer;
                    margin: 0;
                    padding: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-sizing: border-box;
                    position: relative;
                `;
                
                // Добавляем диагональную линию для обозначения "нет"
                const line = document.createElement('div');
                line.style.cssText = `
                    width: 20px;
                    height: 1px;
                    background: #ff0000;
                    transform: rotate(45deg);
                `;
                colorButton.appendChild(line);
            } else {
                colorButton.style.cssText = `
                    width: 28px;
                    height: 28px;
                    border: 1px solid #ddd;
                    border-radius: 50%;
                    background-color: ${preset.color};
                    cursor: pointer;
                    margin: 0;
                    padding: 0;
                    display: block;
                    box-sizing: border-box;
                    ${preset.color === '#ffffff' ? 'border-color: #ccc;' : ''}
                    position: relative;
                `;
                // Галочка по центру активного пресета
                const tick = document.createElement('i');
                tick.style.cssText = `
                    position: absolute;
                    left: 50%;
                    top: 50%;
                    width: 8px;
                    height: 5px;
                    transform: translate(-50%, -50%) rotate(315deg) scaleX(-1);
                    border-right: 2px solid #111;
                    border-bottom: 2px solid #111;
                    display: none;
                    pointer-events: none;
                `;
                colorButton.appendChild(tick);
            }

            colorButton.addEventListener('click', () => {
                // Снимаем активность с других и ставим на текущий
                Array.from(presetsGrid.children).forEach((el) => {
                    const i = el.querySelector('i');
                    if (i) i.style.display = 'none';
                });
                const selfTick = colorButton.querySelector('i');
                if (selfTick) selfTick.style.display = 'block';
                this._selectBgColor(preset.color);
            });

            presetsGrid.appendChild(colorButton);
        });

        container.appendChild(presetsGrid);

        // Разделитель
        const separator = document.createElement('div');
        separator.style.cssText = `
            height: 1px;
            background: #eee;
            margin: 8px 0;
        `;
        container.appendChild(separator);

        // Кастомный color picker для фона
        const customContainer = document.createElement('div');
        customContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
        `;

        const customLabel = document.createElement('span');
        customLabel.textContent = 'Свой цвет:';
        customLabel.style.cssText = `
            font-size: 12px;
            color: #666;
        `;

        this.bgColorInput = document.createElement('input');
        this.bgColorInput.type = 'color';
        this.bgColorInput.style.cssText = `
            width: 32px;
            height: 24px;
            border: 1px solid #ddd;
            border-radius: 3px;
            cursor: pointer;
            padding: 0;
        `;

        this.bgColorInput.addEventListener('change', (e) => {
            this._selectBgColor(e.target.value);
        });

        customContainer.appendChild(customLabel);
        customContainer.appendChild(this.bgColorInput);
        container.appendChild(customContainer);
    }

    _toggleBgColorDropdown() {
        if (this.bgColorDropdown.style.display === 'none') {
            this.bgColorDropdown.style.display = 'block';
        } else {
            this.bgColorDropdown.style.display = 'none';
        }
    }

    _hideBgColorDropdown() {
        if (this.bgColorDropdown) {
            this.bgColorDropdown.style.display = 'none';
        }
    }

    _selectBgColor(color) {
        this._changeBackgroundColor(color);
        this._updateCurrentBgColorButton(color);
        this._hideBgColorDropdown();
    }

    _updateCurrentBgColorButton(color) {
        if (this.currentBgColorButton) {
            if (color === 'transparent') {
                this.currentBgColorButton.style.backgroundColor = 'white';
                this.currentBgColorButton.title = 'Без выделения';
                // Добавляем диагональную линию если её нет
                if (!this.currentBgColorButton.querySelector('div')) {
                    const line = document.createElement('div');
                    line.style.cssText = `
                        width: 20px;
                        height: 1px;
                        background: #ff0000;
                        transform: rotate(45deg);
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform-origin: center;
                        transform: translate(-50%, -50%) rotate(45deg);
                    `;
                    this.currentBgColorButton.appendChild(line);
                }
            } else {
                this.currentBgColorButton.style.backgroundColor = color;
                this.currentBgColorButton.title = `Цвет выделения: ${color}`;
                // Убираем диагональную линию если есть
                const line = this.currentBgColorButton.querySelector('div');
                if (line) {
                    line.remove();
                }
            }
        }
        if (this.bgColorInput) {
            this.bgColorInput.value = color === 'transparent' ? '#ffff99' : color;
        }
    }

    _changeFontFamily(fontFamily) {
        if (!this.currentId) return;


        // Обновляем свойства объекта через StateManager (в properties)
        this.eventBus.emit(Events.Object.StateChanged, {
            objectId: this.currentId,
            updates: {
                properties: { fontFamily }
            }
        });

        // Также обновляем визуальное отображение
        this._updateTextAppearance(this.currentId, { fontFamily });
    }

    _changeFontSize(fontSize) {
        if (!this.currentId) return;


        // Обновляем свойства объекта через StateManager
        this.eventBus.emit(Events.Object.StateChanged, {
            objectId: this.currentId,
            updates: {
                fontSize: fontSize
            }
        });

        // Также обновляем визуальное отображение
        this._updateTextAppearance(this.currentId, { fontSize });
    }

    _changeTextColor(color) {
        if (!this.currentId) return;


        // Обновляем свойства объекта через StateManager
        this.eventBus.emit(Events.Object.StateChanged, {
            objectId: this.currentId,
            updates: {
                color: color
            }
        });

        // Также обновляем визуальное отображение
        this._updateTextAppearance(this.currentId, { color });
    }

    _changeBackgroundColor(backgroundColor) {
        if (!this.currentId) return;


        // Обновляем свойства объекта через StateManager
        this.eventBus.emit(Events.Object.StateChanged, {
            objectId: this.currentId,
            updates: {
                backgroundColor: backgroundColor
            }
        });

        // Также обновляем визуальное отображение
        this._updateTextAppearance(this.currentId, { backgroundColor });
    }

    _updateTextAppearance(objectId, properties) {
        // Обновляем HTML текст через HtmlTextLayer
        const htmlElement = document.querySelector(`[data-id="${objectId}"]`);
        if (htmlElement) {
            if (properties.fontFamily) {
                htmlElement.style.fontFamily = properties.fontFamily;
            }
            if (properties.fontSize) {
                htmlElement.style.fontSize = `${properties.fontSize}px`;
            }
            if (properties.color) {
                htmlElement.style.color = properties.color;
            }
            if (properties.backgroundColor !== undefined) {
                if (properties.backgroundColor === 'transparent') {
                    htmlElement.style.backgroundColor = '';
                } else {
                    htmlElement.style.backgroundColor = properties.backgroundColor;
                }
            }
        }

        // Обновляем PIXI объект и его метаданные
        const pixiData = { objectId, pixiObject: null };
        this.eventBus.emit(Events.Tool.GetObjectPixi, pixiData);
        const pixiObject = pixiData.pixiObject;
        
        if (pixiObject && pixiObject._mb) {
            if (!pixiObject._mb.properties) {
                pixiObject._mb.properties = {};
            }
            
            // Обновляем свойства в метаданных объекта
            Object.assign(pixiObject._mb.properties, properties);
        }

        // Помечаем изменения для автосохранения
        if (this.core && this.core.state) {
            this.core.state.markDirty();
        }
    }

    _updateControlsFromObject() {
        if (!this.currentId || !this.fontSelect || !this.fontSizeSelect) return;

        // Получаем текущие свойства объекта
        const pixiData = { objectId: this.currentId, pixiObject: null };
        this.eventBus.emit(Events.Tool.GetObjectPixi, pixiData);
        const pixiObject = pixiData.pixiObject;

        if (pixiObject && pixiObject._mb && pixiObject._mb.properties) {
            const properties = pixiObject._mb.properties;
            
            // Устанавливаем выбранный шрифт в селекте
            if (properties.fontFamily) {
                this.fontSelect.value = properties.fontFamily;
            } else {
                // Устанавливаем дефолтный шрифт
                this.fontSelect.value = 'Roboto, Arial, sans-serif';
            }

            // Устанавливаем размер шрифта в селекте
            if (properties.fontSize) {
                this.fontSizeSelect.value = properties.fontSize;
            } else {
                // Устанавливаем дефолтный размер
                this.fontSizeSelect.value = '18';
            }

            // Устанавливаем цвет текста
            if (properties.color) {
                this._updateCurrentColorButton(properties.color);
            } else {
                // Устанавливаем дефолтный цвет (черный)
                this._updateCurrentColorButton('#000000');
            }

            // Устанавливаем цвет фона
            if (properties.backgroundColor !== undefined) {
                this._updateCurrentBgColorButton(properties.backgroundColor);
            } else {
                // Устанавливаем дефолтный фон (прозрачный)
                this._updateCurrentBgColorButton('transparent');
            }
        } else {
            // Дефолтные значения
            this.fontSelect.value = 'Arial, sans-serif';
            this.fontSizeSelect.value = '18';
            this._updateCurrentColorButton('#000000');
            this._updateCurrentBgColorButton('transparent');
        }
    }

    reposition() {
        if (!this.panel || !this.currentId || this.panel.style.display === 'none') return;

        // Получаем позицию и размеры объекта
        const posData = { objectId: this.currentId, position: null };
        const sizeData = { objectId: this.currentId, size: null };
        this.eventBus.emit(Events.Tool.GetObjectPosition, posData);
        this.eventBus.emit(Events.Tool.GetObjectSize, sizeData);

        if (!posData.position || !sizeData.size) return;

        // Получаем зум и позицию мира
        const worldLayer = this.core?.pixi?.worldLayer;
        const scale = worldLayer?.scale?.x || 1;
        const worldX = worldLayer?.x || 0;
        const worldY = worldLayer?.y || 0;

        // Преобразуем координаты объекта в экранные координаты
        const screenX = posData.position.x * scale + worldX;
        const screenY = posData.position.y * scale + worldY;
        const objectWidth = sizeData.size.width * scale;

        // Позиционируем панель над объектом
        const panelX = screenX + (objectWidth / 2) - (this.panel.offsetWidth / 2);
        const panelY = screenY - this.panel.offsetHeight - 20; // поднимем выше ещё

        // Проверяем границы контейнера
        const containerRect = this.container.getBoundingClientRect();
        const finalX = Math.max(10, Math.min(panelX, containerRect.width - this.panel.offsetWidth - 10));
        const finalY = Math.max(10, panelY);

        this.panel.style.left = `${finalX}px`;
        this.panel.style.top = `${finalY}px`;
    }

    _onDocMouseDown(e) {
        // Скрываем панель при клике вне неё и вне текстового объекта
        if (!this.panel || !e.target) return;
        
        // Если клик внутри панели - не скрываем
        if (this.panel.contains(e.target)) return;
        
        // Проверяем, не кликнули ли по текущему текстовому объекту
        const rect = this.container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Здесь можно добавить проверку попадания в текстовый объект
        // Пока просто скрываем панель
        this.hide();
    }
}
