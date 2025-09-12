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
        
        
        if (isFrame) {
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
        this._syncTypeFromObject();
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
        let panelY = y - panelH - 40; // отступ 40px над фреймом

        // Если панель уходит за верх, переносим ниже фрейма
        if (panelY < 0) {
            panelY = y + height + 40;
        }


        this.panel.style.left = `${Math.round(panelX)}px`;
        this.panel.style.top = `${Math.round(panelY)}px`;
        
    }

    _createFrameControls(panel) {
        // Контейнер для названия
        const titleContainer = document.createElement('div');
        titleContainer.className = 'fpp-section';

        // Лейбл
        const titleLabel = document.createElement('span');
        titleLabel.textContent = 'Название:';
        titleLabel.className = 'fpp-label';

        // Поле ввода для названия
        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.placeholder = 'Название фрейма';
        titleInput.className = 'fpp-input';
        Object.assign(titleInput.style, {
            height: '22px',
            flex: '1',
            outline: 'none'
        });

        // Обработчик изменения названия
        titleInput.addEventListener('input', () => {
            if (this.currentId) {
                this._changeFrameTitle(titleInput.value);
            }
        });

        // Блокируем Delete/Backspace от всплытия, чтобы не удалялся весь фрейм при фокусе в поле
        titleInput.addEventListener('keydown', (e) => {
            const key = e.key;
            if (key === 'Backspace' || key === 'Delete') {
                e.stopPropagation();
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
        colorContainer.className = 'fpp-section';

        // Лейбл для цвета
        const colorLabel = document.createElement('span');
        colorLabel.textContent = 'Фон:';
        colorLabel.className = 'fpp-label';

        // Кнопка выбора цвета
        const colorButton = document.createElement('button');
        colorButton.className = 'fpp-color-button';

        // Обработчик клика по кнопке цвета
        colorButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this._toggleColorPalette(colorButton);
        });

        // Сохраняем ссылки
        this.colorButton = colorButton;

        colorContainer.appendChild(colorLabel);
        colorContainer.appendChild(colorButton);

        // Контейнер для типа фрейма
        const typeContainer = document.createElement('div');
        typeContainer.className = 'fpp-section';

        const typeLabel = document.createElement('span');
        typeLabel.textContent = 'Тип:';
        typeLabel.className = 'fpp-label';

        const typeSelect = document.createElement('select');
        typeSelect.className = 'fpp-select';
        Object.assign(typeSelect.style, {
            flex: '1',
            outline: 'none',
            maxWidth: '100%'
        });
        const options = [
            { value: 'custom', label: 'Произвольный' },
            { value: 'a4', label: 'A4' },
            { value: '1x1', label: '1:1' },
            { value: '4x3', label: '4:3' },
            { value: '16x9', label: '16:9' }
        ];
        options.forEach(opt => {
            const o = document.createElement('option');
            o.value = opt.value;
            o.textContent = opt.label;
            typeSelect.appendChild(o);
        });
        this.frameTypeSelect = typeSelect;

        typeSelect.addEventListener('change', () => {
            if (!this.currentId) return;
            const v = typeSelect.value;
            this._applyFrameType(v);
        });

        typeContainer.appendChild(typeLabel);
        typeContainer.appendChild(typeSelect);

        panel.appendChild(titleContainer);
        panel.appendChild(colorContainer);
        panel.appendChild(typeContainer);

        // Создаем палитру цветов (скрытую)
        this._createColorPalette(panel);
    }

    _changeFrameTitle(newTitle) {
        if (!this.currentId) return;


        // Обновляем свойства объекта
        this.eventBus.emit(Events.Object.StateChanged, {
            objectId: this.currentId,
            updates: { properties: { title: newTitle } }
        });
    }

    _createColorPalette(panel) {
        // Палитра из 6 популярных цветов (как у текстовой панели — круглые кнопки, галочка)
        this._frameColors = [
            { name: 'Белый',   hex: '#FFFFFF', pixi: 0xFFFFFF },
            { name: 'Голубой', hex: '#E3F2FD', pixi: 0xE3F2FD },
            { name: 'Зеленый', hex: '#E8F5E8', pixi: 0xE8F5E8 },
            { name: 'Желтый',  hex: '#FFF8E1', pixi: 0xFFF8E1 },
            { name: 'Розовый', hex: '#FCE4EC', pixi: 0xFCE4EC },
            { name: 'Серый',   hex: '#F5F5F5', pixi: 0xF5F5F5 }
        ];

        const palette = document.createElement('div');
        palette.className = 'color-palette';
        Object.assign(palette.style, {
            position: 'absolute',
            top: '100%',
            left: '0',
            display: 'none',
            backgroundColor: 'white',
            border: '1px solid #ddd',
            borderRadius: '6px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            padding: '8px',
            zIndex: '10001',
            minWidth: '200px'
        });

        // Сетка цветов, как в TextPropertiesPanel
        const grid = document.createElement('div');
        grid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(6, 28px);
            gap: 6px;
            margin: 0;
            align-items: center;
            justify-items: center;
        `;

        this._paletteButtons = [];

        this._frameColors.forEach(color => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.title = color.name;
            btn.dataset.colorHex = color.hex.toUpperCase();
            btn.style.cssText = `
                width: 28px;
                height: 28px;
                border: 1px solid ${color.hex.toUpperCase() === '#FFFFFF' ? '#ccc' : '#ddd'};
                border-radius: 50%;
                background-color: ${color.hex};
                cursor: pointer;
                margin: 0;
                padding: 0;
                display: block;
                box-sizing: border-box;
                position: relative;
            `;

            // Галочка как в текстовой панели
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
            btn.appendChild(tick);

            btn.addEventListener('click', () => {
                // Снимаем активность со всех
                this._paletteButtons.forEach(b => {
                    const i = b.querySelector('i');
                    if (i) i.style.display = 'none';
                });
                tick.style.display = 'block';
                this._selectColor(color);
                this._hideColorPalette();
            });

            grid.appendChild(btn);
            this._paletteButtons.push(btn);
        });

        palette.appendChild(grid);
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

        // Синхронизируем активный цвет (показываем галочку у текущего)
        this._syncPaletteSelectionFromObject();

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


        // Обновляем визуальное отображение кнопки
        this.colorButton.style.backgroundColor = color.hex;
        this.colorButton.title = `Цвет фона: ${color.name}`;

        // Отправляем событие изменения цвета фона
        this.eventBus.emit(Events.Object.StateChanged, {
            objectId: this.currentId,
            updates: { backgroundColor: color.pixi }
        });
    }

    _syncPaletteSelectionFromObject() {
        if (!this._paletteButtons || this._paletteButtons.length === 0) return;
        const objectData = this.core.getObjectData(this.currentId);
        let pixiColor = (objectData && (objectData.backgroundColor || (objectData.properties && objectData.properties.backgroundColor))) || 0xFFFFFF;
        const hex = `#${pixiColor.toString(16).padStart(6, '0').toUpperCase()}`;
        this._setActivePaletteColor(hex);
    }

    _setActivePaletteColor(hex) {
        this._paletteButtons.forEach(btn => {
            const i = btn.querySelector('i');
            if (!i) return;
            if ((btn.dataset.colorHex || '').toUpperCase() === hex.toUpperCase()) {
                i.style.display = 'block';
            } else {
                i.style.display = 'none';
            }
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

    _syncTypeFromObject() {
        if (!this.frameTypeSelect || !this.currentId) return;
        const objectData = this.core.getObjectData(this.currentId);
        const t = (objectData && objectData.properties && objectData.properties.type) || 'custom';
        this.frameTypeSelect.value = t;
    }

    _applyFrameType(typeValue) {
        if (!this.currentId) return;

        // 1) Обновляем тип и временно отключаем фиксацию пропорций на время программного ресайза
        const willLockAfter = typeValue !== 'custom';
        this.eventBus.emit(Events.Object.StateChanged, {
            objectId: this.currentId,
            updates: { properties: { type: typeValue, lockedAspect: false } }
        });

        // 2) Для пресетов меняем размеры под аспект, сохраняя центр
        if (!willLockAfter) return; // Произвольный: без изменения размеров

        // Аспект по типу
        const aspectMap = {
            'a4': 210 / 297,
            '1x1': 1,
            '4x3': 4 / 3,
            '16x9': 16 / 9
        };
        const aspect = aspectMap[typeValue] || 1;

        // Текущие позиция и размер
        const posData = { objectId: this.currentId, position: null };
        const sizeData = { objectId: this.currentId, size: null };
        this.eventBus.emit(Events.Tool.GetObjectPosition, posData);
        this.eventBus.emit(Events.Tool.GetObjectSize, sizeData);
        if (!posData.position || !sizeData.size) return;

        const oldX = posData.position.x;
        const oldY = posData.position.y;
        const oldW = Math.max(1, sizeData.size.width);
        const oldH = Math.max(1, sizeData.size.height);
        const cx = oldX + oldW / 2;
        const cy = oldY + oldH / 2;

        // Сохраняем визуальный масштаб: подбираем размеры с тем же приблизительным "площадью"
        const area = oldW * oldH;
        let newW = Math.max(1, Math.round(Math.sqrt(area * aspect)));
        let newH = Math.max(1, Math.round(newW / aspect));

        const newX = Math.round(cx - newW / 2);
        const newY = Math.round(cy - newH / 2);

        // Применяем через события resize для согласованности с историей/ядром
        this.eventBus.emit(Events.Tool.ResizeUpdate, {
            object: this.currentId,
            size: { width: newW, height: newH },
            position: { x: newX, y: newY }
        });
        this.eventBus.emit(Events.Tool.ResizeEnd, {
            object: this.currentId,
            oldSize: { width: oldW, height: oldH },
            newSize: { width: newW, height: newH },
            oldPosition: { x: oldX, y: oldY },
            newPosition: { x: newX, y: newY }
        });

        // Обновим UI сразу
        this._syncTypeFromObject();

        // 3) Включаем обратно фиксацию пропорций (для пресетов)
        this.eventBus.emit(Events.Object.StateChanged, {
            objectId: this.currentId,
            updates: { properties: { lockedAspect: true } }
        });
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
