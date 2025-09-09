import { Events } from '../core/events/Events.js';

/**
 * Панель свойств фрейма
 * Отображается над выделенным фреймом
 */
export class FramePropertiesPanel {
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

        // Обновляем позицию при любых изменениях (как в TextPropertiesPanel)
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
        // Показываем только для одиночного выделения фрейма
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
        const isFrame = !!(pixi && pixi._mb && pixi._mb.type === 'frame');
        
        console.log('🖼️ FramePropertiesPanel: updateFromSelection - id=', id, 'isFrame=', isFrame);
        
        if (isFrame) {
            this.showFor(id);
        } else {
            this.hide();
        }
    }

    showFor(objectId) {
        console.log('🖼️ FramePropertiesPanel: Showing panel for objectId:', objectId);
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
    }

    _createPanel() {
        const panel = document.createElement('div');
        panel.className = 'frame-properties-panel';
        Object.assign(panel.style, {
            position: 'absolute',
            display: 'none',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            backgroundColor: 'white',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            minWidth: '280px',
            height: '60px',
            zIndex: '10000'
        });

        // Создаем контролы для фрейма
        this._createFrameControls(panel);

        // Добавляем ID для удобной настройки через DevTools
        panel.id = 'frame-properties-panel';

        this.panel = panel;
        this.container.appendChild(panel);
    }

    _updateControlsFromObject() {
        // Пока ничего не делаем, так как панель пустая
        // Здесь будет логика синхронизации контролов с объектом
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

        // Позиционируем панель над фреймом, по центру
        const panelRect = this.panel.getBoundingClientRect();
        const panelW = Math.max(1, panelRect.width || 280);
        const panelH = Math.max(1, panelRect.height || 60);
        let panelX = x + (width / 2) - (panelW / 2);
        let panelY = y - panelH - 8; // отступ 8px над фреймом

        // Если панель уходит за верх, переносим ниже фрейма
        if (panelY < 0) {
            panelY = y + height + 8;
        }

        console.log('🖼️ FramePropertiesPanel: Positioning above frame:', {
            frameX: x, frameY: y, frameWidth: width, frameHeight: height,
            panelX, panelY
        });

        this.panel.style.left = `${Math.round(panelX)}px`;
        this.panel.style.top = `${Math.round(panelY)}px`;
        
        console.log('🖼️ FramePropertiesPanel: Panel CSS applied:', {
            left: this.panel.style.left,
            top: this.panel.style.top
        });
    }

    _createFrameControls(panel) {
        // Контейнер для названия
        const titleContainer = document.createElement('div');
        Object.assign(titleContainer.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px'
        });

        // Лейбл
        const titleLabel = document.createElement('span');
        titleLabel.textContent = 'Название:';
        titleLabel.style.fontSize = '12px';
        titleLabel.style.color = '#666';
        titleLabel.style.minWidth = '60px';

        // Поле ввода для названия
        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.placeholder = 'Название фрейма';
        Object.assign(titleInput.style, {
            flex: '1',
            padding: '4px 8px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '12px',
            outline: 'none'
        });

        // Обработчик изменения названия
        titleInput.addEventListener('input', () => {
            if (this.currentId) {
                this._changeFrameTitle(titleInput.value);
            }
        });

        // Обработчик Enter для подтверждения
        titleInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                titleInput.blur();
            }
        });

        // Сохраняем ссылку на поле ввода
        this.titleInput = titleInput;

        titleContainer.appendChild(titleLabel);
        titleContainer.appendChild(titleInput);

        // Контейнер для цвета фона
        const colorContainer = document.createElement('div');
        Object.assign(colorContainer.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px'
        });

        // Лейбл для цвета
        const colorLabel = document.createElement('span');
        colorLabel.textContent = 'Фон:';
        colorLabel.style.fontSize = '12px';
        colorLabel.style.color = '#666';
        colorLabel.style.minWidth = '60px';

        // Кнопка выбора цвета
        const colorButton = document.createElement('button');
        Object.assign(colorButton.style, {
            width: '32px',
            height: '24px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
            backgroundColor: '#ffffff',
            position: 'relative'
        });

        // Обработчик клика по кнопке цвета
        colorButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this._toggleColorPalette(colorButton);
        });

        // Сохраняем ссылки
        this.colorButton = colorButton;

        colorContainer.appendChild(colorLabel);
        colorContainer.appendChild(colorButton);

        panel.appendChild(titleContainer);
        panel.appendChild(colorContainer);

        // Создаем палитру цветов (скрытую)
        this._createColorPalette(panel);
    }

    _changeFrameTitle(newTitle) {
        if (!this.currentId) return;

        console.log('🖼️ FramePropertiesPanel: Changing frame title to:', newTitle);

        // Обновляем свойства объекта
        this.eventBus.emit(Events.Object.StateChanged, {
            objectId: this.currentId,
            updates: { properties: { title: newTitle } }
        });
    }

    _createColorPalette(panel) {
        // Палитра из 6 популярных цветов
        const colors = [
            { name: 'Белый', hex: '#FFFFFF', pixi: 0xFFFFFF },
            { name: 'Голубой', hex: '#E3F2FD', pixi: 0xE3F2FD },
            { name: 'Зеленый', hex: '#E8F5E8', pixi: 0xE8F5E8 },
            { name: 'Желтый', hex: '#FFF8E1', pixi: 0xFFF8E1 },
            { name: 'Розовый', hex: '#FCE4EC', pixi: 0xFCE4EC },
            { name: 'Серый', hex: '#F5F5F5', pixi: 0xF5F5F5 }
        ];

        const palette = document.createElement('div');
        palette.className = 'color-palette';
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
                width: '24px',
                height: '24px',
                backgroundColor: color.hex,
                border: '1px solid #ccc',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'transform 0.1s'
            });

            colorSwatch.title = color.name;

            colorSwatch.addEventListener('click', () => {
                this._selectColor(color);
                this._hideColorPalette();
            });

            colorSwatch.addEventListener('mouseenter', () => {
                colorSwatch.style.transform = 'scale(1.1)';
            });

            colorSwatch.addEventListener('mouseleave', () => {
                colorSwatch.style.transform = 'scale(1)';
            });

            palette.appendChild(colorSwatch);
        });

        this.colorPalette = palette;
        panel.appendChild(palette);
    }

    _toggleColorPalette(button) {
        if (!this.colorPalette) return;

        const isVisible = this.colorPalette.style.display !== 'none';
        
        if (isVisible) {
            this._hideColorPalette();
        } else {
            this._showColorPalette(button);
        }
    }

    _showColorPalette(button) {
        if (!this.colorPalette) return;

        // Позиционируем палитру относительно кнопки
        const buttonRect = button.getBoundingClientRect();
        const panelRect = this.panel.getBoundingClientRect();
        
        this.colorPalette.style.left = `${buttonRect.left - panelRect.left}px`;
        this.colorPalette.style.top = `${buttonRect.bottom - panelRect.top + 4}px`;
        this.colorPalette.style.display = 'flex';

        // Добавляем обработчик клика по документу для закрытия палитры
        setTimeout(() => {
            document.addEventListener('click', this._documentClickHandler.bind(this));
        }, 0);
    }

    _hideColorPalette() {
        if (this.colorPalette) {
            this.colorPalette.style.display = 'none';
        }
        document.removeEventListener('click', this._documentClickHandler.bind(this));
    }

    _documentClickHandler(e) {
        if (this.colorPalette && !this.colorPalette.contains(e.target) && 
            this.colorButton && !this.colorButton.contains(e.target)) {
            this._hideColorPalette();
        }
    }

    _selectColor(color) {
        if (!this.currentId) return;

        console.log('🖼️ FramePropertiesPanel: Selecting color:', color);

        // Обновляем визуальное отображение кнопки
        this.colorButton.style.backgroundColor = color.hex;
        this.colorButton.title = `Цвет фона: ${color.name}`;

        // Отправляем событие изменения цвета фона
        this.eventBus.emit(Events.Object.StateChanged, {
            objectId: this.currentId,
            updates: { backgroundColor: color.pixi }
        });
    }

    _updateControlsFromObject() {
        if (!this.currentId) return;

        const objectData = this.core.getObjectData(this.currentId);
        if (objectData) {
            // Обновляем поле названия
            if (this.titleInput && objectData.properties && objectData.properties.title !== undefined) {
                this.titleInput.value = objectData.properties.title || '';
            }

            // Обновляем кнопку цвета фона
            // Проверяем backgroundColor на верхнем уровне или в properties
            const backgroundColor = objectData.backgroundColor || 
                                  (objectData.properties && objectData.properties.backgroundColor) || 
                                  0xFFFFFF; // белый по умолчанию
            
            if (this.colorButton) {
                this._updateColorButton(backgroundColor);
            }
        }
    }

    _updateColorButton(pixiColor) {
        if (!this.colorButton) return;

        // Конвертируем PIXI цвет в hex строку
        const hexColor = `#${pixiColor.toString(16).padStart(6, '0').toUpperCase()}`;
        this.colorButton.style.backgroundColor = hexColor;
        this.colorButton.title = `Цвет фона: ${hexColor}`;
    }

    destroy() {
        // Удаляем обработчик клика по документу
        document.removeEventListener('click', this._documentClickHandler.bind(this));
        
        if (this.panel && this.panel.parentNode) {
            this.panel.parentNode.removeChild(this.panel);
        }
        this.panel = null;
        this.colorPalette = null;
        this.colorButton = null;
        this.titleInput = null;
        this.currentId = null;
    }
}
