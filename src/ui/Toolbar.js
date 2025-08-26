/**
 * Панель инструментов для MoodBoard
 */
import { Events } from '../core/events/Events.js';
import { IconLoader } from '../utils/iconLoader.js';

export class Toolbar {
    constructor(container, eventBus, theme = 'light') {
        this.container = container;
        this.eventBus = eventBus;
        this.theme = theme;
        
        // Инициализируем IconLoader
        this.iconLoader = new IconLoader();
        
        // Кэш для SVG иконок
        this.icons = {};
        
        this.init();
    }

    /**
     * Инициализация тулбара
     */
    async init() {
        try {
            // Инициализируем IconLoader и загружаем все иконки
            await this.iconLoader.init();
            this.icons = await this.iconLoader.loadAllIcons();
        } catch (error) {
            console.error('❌ Ошибка загрузки иконок:', error);
        }
        
        this.createToolbar();
        this.attachEvents();
        this.setupHistoryEvents();
    }
    
    /**
     * Создает HTML структуру тулбара
     */
    createToolbar() {
        this.element = document.createElement('div');
        this.element.className = `moodboard-toolbar moodboard-toolbar--${this.theme}`;
        
        // Новые элементы интерфейса (без функционала)
        const newTools = [
            { id: 'select', iconName: 'select', title: 'Инструмент выделения (V)', type: 'activate-select' },
            { id: 'pan', iconName: 'pan', title: 'Панорамирование (Пробел)', type: 'activate-pan' },
            { id: 'divider', type: 'divider' },
                         { id: 'text-add', iconName: 'text-add', title: 'Добавить текст', type: 'text-add' },
            { id: 'note', iconName: 'note', title: 'Добавить записку', type: 'note-add' },
            { id: 'image', iconName: 'image', title: 'Добавить картинку', type: 'image-add' },
            { id: 'shapes', iconName: 'shapes', title: 'Фигуры', type: 'custom-shapes' },
            { id: 'pencil', iconName: 'pencil', title: 'Рисование', type: 'custom-draw' },
            { id: 'comments', iconName: 'comments', title: 'Комментарии', type: 'custom-comments' },
            { id: 'attachments', iconName: 'attachments', title: 'Файлы', type: 'custom-attachments' },
            { id: 'emoji', iconName: 'emoji', title: 'Эмоджи', type: 'custom-emoji' }
        ];

        // Существующие элементы ниже новых
        const existingTools = [
                         { id: 'frame', iconName: 'frame', title: 'Добавить фрейм', type: 'frame' },
            { id: 'divider', type: 'divider' },
            { id: 'clear', iconName: 'clear', title: 'Очистить холст', type: 'clear' },
            { id: 'divider', type: 'divider' },
            { id: 'undo', iconName: 'undo', title: 'Отменить (Ctrl+Z)', type: 'undo', disabled: true },
            { id: 'redo', iconName: 'redo', title: 'Повторить (Ctrl+Y)', type: 'redo', disabled: true }
        ];
        
        [...newTools, ...existingTools].forEach(tool => {
            if (tool.type === 'divider') {
                const divider = document.createElement('div');
                divider.className = 'moodboard-toolbar__divider';
                this.element.appendChild(divider);
            } else {
                const button = this.createButton(tool);
                this.element.appendChild(button);
            }
        });
        
        this.container.appendChild(this.element);

        // Создаем всплывающие панели (фигуры, рисование, эмоджи)
        this.createShapesPopup();
        this.createDrawPopup();
        this.createEmojiPopup();

        // Подсветка активной кнопки на тулбаре по активному инструменту
        this.eventBus.on(Events.Tool.Activated, ({ tool }) => {
            this.setActiveToolbarButton(tool);
        });

        // Текущее состояние попапа рисования
        this.currentDrawTool = 'pencil';
    }
    
    /**
     * Создает кнопку инструмента
     */
    createButton(tool) {
        const button = document.createElement('button');
        button.className = `moodboard-toolbar__button moodboard-toolbar__button--${tool.id}`;
        button.dataset.tool = tool.type;
        button.dataset.toolId = tool.id;
        
        // Устанавливаем disabled состояние если указано
        if (tool.disabled) {
            button.disabled = true;
            button.classList.add('moodboard-toolbar__button--disabled');
        }
        
        // Создаем tooltip если есть title
        if (tool.title) {
            this.createTooltip(button, tool.title);
        }
        
        // Создаем SVG иконку
        if (tool.iconName) {
            this.createSvgIcon(button, tool.iconName);
        }

        return button;
    }

    /**
     * Создает SVG иконку для кнопки
     */
    createSvgIcon(button, iconName) {
        if (this.icons[iconName]) {
            // Создаем SVG элемент из загруженного содержимого
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = this.icons[iconName];
            const svg = tempDiv.querySelector('svg');
            
            if (svg) {
                // Убираем inline размеры, чтобы CSS мог их контролировать
                svg.removeAttribute('width');
                svg.removeAttribute('height');
                svg.style.display = 'block';
                
                // Добавляем SVG в кнопку
                button.appendChild(svg);
            }
        } else {
            // Fallback: создаем простую текстовую иконку
            const fallbackIcon = document.createElement('span');
            fallbackIcon.textContent = iconName.charAt(0).toUpperCase();
            fallbackIcon.style.fontSize = '14px';
            fallbackIcon.style.fontWeight = 'bold';
            button.appendChild(fallbackIcon);
        }
    }
    
    /**
     * Создает tooltip для кнопки
     */
    createTooltip(button, text) {
        // Создаем элемент tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'moodboard-tooltip';
        tooltip.textContent = text;
        
        // Добавляем tooltip в DOM
        document.body.appendChild(tooltip);
        
        // Переменные для управления tooltip
        let showTimeout;
        let hideTimeout;
        
        // Показываем tooltip при наведении
        button.addEventListener('mouseenter', () => {
            clearTimeout(hideTimeout);
            showTimeout = setTimeout(() => {
                this.showTooltip(tooltip, button);
            }, 300); // Задержка 300ms перед показом
        });
        
        // Скрываем tooltip при уходе мыши
        button.addEventListener('mouseleave', () => {
            clearTimeout(showTimeout);
            hideTimeout = setTimeout(() => {
                this.hideTooltip(tooltip);
            }, 100); // Задержка 100ms перед скрытием
        });
        
        // Скрываем tooltip при клике
        button.addEventListener('click', () => {
            clearTimeout(showTimeout);
            this.hideTooltip(tooltip);
        });
        
        // Сохраняем ссылку на tooltip в кнопке для очистки
        button._tooltip = tooltip;
    }
    
    /**
     * Показывает tooltip
     */
    showTooltip(tooltip, button) {
        // Получаем позицию кнопки
        const buttonRect = button.getBoundingClientRect();
        const toolbarRect = this.element.getBoundingClientRect();
        
        // Позиционируем tooltip справа от кнопки
        const left = buttonRect.right + 8; // 8px отступ справа от кнопки
        const top = buttonRect.top + (buttonRect.height / 2) - (tooltip.offsetHeight / 2); // центрируем по вертикали
        
        // Проверяем, чтобы tooltip не выходил за правую границу экрана
        const maxLeft = window.innerWidth - tooltip.offsetWidth - 8;
        const adjustedLeft = Math.min(left, maxLeft);
        
        tooltip.style.left = `${adjustedLeft}px`;
        tooltip.style.top = `${top}px`;
        
        // Показываем tooltip
        tooltip.classList.add('moodboard-tooltip--show');
    }
    
    /**
     * Скрывает tooltip
     */
    hideTooltip(tooltip) {
        tooltip.classList.remove('moodboard-tooltip--show');
    }
    
    /**
     * Подключает обработчики событий
     */
    attachEvents() {
        this.element.addEventListener('click', (e) => {
            const button = e.target.closest('.moodboard-toolbar__button');
            if (!button || button.disabled) return;
            
            const toolType = button.dataset.tool;
            const toolId = button.dataset.toolId;
            
            // Обрабатываем undo/redo отдельно
            if (toolType === 'undo') {
                this.eventBus.emit(Events.Keyboard.Undo);
                this.animateButton(button);
                return;
            }
            
            if (toolType === 'redo') {
                this.eventBus.emit(Events.Keyboard.Redo);
                this.animateButton(button);
                return;
            }

            // Выбор инструмента выделения — отменяем режимы размещения и возвращаемся к select
            if (toolType === 'activate-select') {
                this.animateButton(button);
                this.closeShapesPopup();
                this.closeDrawPopup();
                this.closeEmojiPopup();
                // Сбрасываем отложенное размещение, активируем select
                this.eventBus.emit(Events.Place.Set, null);
                this.placeSelectedButtonId = null;
                this.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'select' });
                this.setActiveToolbarButton('select');
                return;
            }

            // Временная активация панорамирования с панели
            if (toolType === 'activate-pan') {
                this.animateButton(button);
                this.closeShapesPopup();
                this.closeDrawPopup();
                this.closeEmojiPopup();
                this.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'pan' });
                this.setActiveToolbarButton('pan');
                return;
            }



            // Добавление текста: включаем placement и ждём клика для выбора позиции
            if (toolType === 'text-add') {
                this.animateButton(button);
                this.closeShapesPopup();
                this.closeDrawPopup();
                this.closeEmojiPopup();
                // Переходим в универсальный placement tool и задаем pending конфигурацию
                this.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'place' });
                this.placeSelectedButtonId = 'text';
                this.setActiveToolbarButton('place');
                this.eventBus.emit(Events.Place.Set, {
                    type: 'text',
                    // Специальный флаг: не создавать сразу объект, а открыть форму ввода на холсте
                    properties: { editOnCreate: true, fontSize: 18 }
                });
                return;
            }

            // Добавление записки: включаем placement и ждём клика для выбора позиции
            if (toolType === 'note-add') {
                this.animateButton(button);
                this.closeShapesPopup();
                this.closeDrawPopup();
                this.closeEmojiPopup();
                // Активируем place, устанавливаем pending для note
                this.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'place' });
                this.placeSelectedButtonId = 'note';
                this.setActiveToolbarButton('place');
                // Устанавливаем свойства записки по умолчанию
                this.eventBus.emit(Events.Place.Set, { 
                    type: 'note', 
                    properties: { 
                        content: 'Новая записка',
                        fontSize: 16,
                        width: 160,
                        height: 100
                    }
                });
                return;
            }

            // Добавление фрейма: включаем placement и ждём клика для выбора позиции
            if (toolType === 'frame') {
                this.animateButton(button);
                this.closeShapesPopup();
                this.closeDrawPopup();
                this.closeEmojiPopup();
                // Активируем place, устанавливаем pending для frame
                this.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'place' });
                this.placeSelectedButtonId = 'frame';
                this.setActiveToolbarButton('place');
                // Устанавливаем свойства фрейма по умолчанию
                this.eventBus.emit(Events.Place.Set, { 
                    type: 'frame', 
                    properties: { 
                        width: 200,
                        height: 300,
                        borderColor: 0x333333,
                        fillColor: 0xFFFFFF,
                        title: 'Новый' // Название по умолчанию
                    }
                });
                return;
            }

            // Добавление картинки — сразу открываем диалог выбора изображения
            if (toolType === 'image-add') {
                this.animateButton(button);
                this.closeShapesPopup();
                this.closeDrawPopup();
                this.closeEmojiPopup();
                // Открываем диалог выбора изображения
                this.openImageDialog();
                return;
            }

            // Комментарии — включаем режим размещения comment
            if (toolType === 'custom-comments') {
                this.animateButton(button);
                this.closeShapesPopup();
                this.closeDrawPopup();
                this.closeEmojiPopup();
                this.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'place' });
                this.placeSelectedButtonId = 'comments';
                this.setActiveToolbarButton('place');
                // Увеличенный размер по умолчанию
                this.eventBus.emit(Events.Place.Set, { type: 'comment', properties: { width: 72, height: 72 } });
                return;
            }

            // Файлы — сразу открываем диалог выбора файла
            if (toolType === 'custom-attachments') {
                this.animateButton(button);
                this.closeShapesPopup();
                this.closeDrawPopup();
                this.closeEmojiPopup();
                // Открываем диалог выбора файла
                this.openFileDialog();
                return;
            }

            // Инструмент «Фрейм» — создаём через универсальный place-поток с размерами 200x300
            if (toolType === 'custom-frame') {
                this.animateButton(button);
                this.closeShapesPopup();
                this.closeDrawPopup();
                this.closeEmojiPopup();
                // Активируем режим размещения и устанавливаем pending
                this.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'place' });
                this.placeSelectedButtonId = 'frame-tool';
                this.setActiveToolbarButton('place');
                this.eventBus.emit(Events.Place.Set, {
                    type: 'frame',
                    properties: { width: 200, height: 300 }
                });
                return;
            }

            // Тоггл всплывающей панели фигур
            if (toolType === 'custom-shapes') {
                this.animateButton(button);
                this.toggleShapesPopup(button);
                this.closeDrawPopup();
                this.closeEmojiPopup();
                // Активируем универсальный place tool для дальнейшего размещения
                this.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'place' });
                this.placeSelectedButtonId = 'shapes';
                this.setActiveToolbarButton('place');
                return;
            }

            // Тоггл всплывающей панели рисования
            if (toolType === 'custom-draw') {
                this.animateButton(button);
                this.toggleDrawPopup(button);
                this.closeShapesPopup();
                this.closeEmojiPopup();
                // Выбираем инструмент рисования (последующее действие — на холсте)
                this.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'draw' });
                this.setActiveToolbarButton('draw');
                return;
            }

            // Тоггл всплывающей панели эмоджи
            if (toolType === 'custom-emoji') {
                this.animateButton(button);
                this.toggleEmojiPopup(button);
                this.closeShapesPopup();
                this.closeDrawPopup();
                this.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'place' });
                this.placeSelectedButtonId = 'emoji';
                this.setActiveToolbarButton('place'); // ← Исправление: подсвечиваем кнопку эмоджи
                return;
            }
            
            // Эмитим событие для других инструментов
            this.eventBus.emit(Events.UI.ToolbarAction, {
                type: toolType,
                id: toolId,
                position: this.getRandomPosition()
            });
            
            // Визуальная обратная связь
            this.animateButton(button);
        });

        // Клик вне попапов — закрыть
        document.addEventListener('click', (e) => {
            const isInsideToolbar = this.element.contains(e.target);
            const isInsideShapesPopup = this.shapesPopupEl && this.shapesPopupEl.contains(e.target);
            const isInsideDrawPopup = this.drawPopupEl && this.drawPopupEl.contains(e.target);
            const isInsideEmojiPopup = this.emojiPopupEl && this.emojiPopupEl.contains(e.target);
            const isShapesButton = e.target.closest && e.target.closest('.moodboard-toolbar__button--shapes');
            const isDrawButton = e.target.closest && e.target.closest('.moodboard-toolbar__button--pencil');
            const isEmojiButton = e.target.closest && e.target.closest('.moodboard-toolbar__button--emoji');
            if (!isInsideToolbar && !isInsideShapesPopup && !isShapesButton && !isInsideDrawPopup && !isDrawButton && !isInsideEmojiPopup && !isEmojiButton) {
                this.closeShapesPopup();
                this.closeDrawPopup();
                this.closeEmojiPopup();
            }
        });
    }

    /**
     * Подсвечивает активную кнопку на тулбаре в зависимости от активного инструмента
     */
    setActiveToolbarButton(toolName) {
        if (!this.element) return;
        
        console.log('🎯 Toolbar: Установка активной кнопки для инструмента:', toolName, 'placeSelectedButtonId:', this.placeSelectedButtonId);
        
        // Сбрасываем активные классы
        this.element.querySelectorAll('.moodboard-toolbar__button--active').forEach(el => {
            console.log('🔄 Deactivating button:', el.dataset.toolId);
            el.classList.remove('moodboard-toolbar__button--active');
        });
        
        // Соответствие инструмент → кнопка
        const map = {
            select: 'select',
            pan: 'pan',
            draw: 'pencil',
            text: 'text-add'  // Добавляем маппинг для text инструмента
        };
        
        let btnId = map[toolName];
        
        if (!btnId && toolName === 'place') {
            // Подсвечиваем тот источник place, который активен
            const placeButtonMap = {
                'text': 'text-add',
                'note': 'note',
                'frame': 'frame',
                'frame-tool': 'frame',
                'comments': 'comments',
                'attachments': 'attachments',
                'shapes': 'shapes',
                'emoji': 'emoji',
                null: 'image'  // для изображений placeSelectedButtonId = null
            };
            
            btnId = placeButtonMap[this.placeSelectedButtonId] || 'shapes';
        }
        
        if (!btnId) {
            console.warn('⚠️ Toolbar: Не найден btnId для инструмента:', toolName);
            return;
        }
        
        const btn = this.element.querySelector(`.moodboard-toolbar__button--${btnId}`);
        if (btn) {
            btn.classList.add('moodboard-toolbar__button--active');
            console.log('✅ Toolbar: Активирована кнопка:', btnId);
        } else {
            console.warn('⚠️ Toolbar: Не найдена кнопка с селектором:', `.moodboard-toolbar__button--${btnId}`);
        }
    }
    
    /**
     * Генерирует случайную позицию для нового объекта
     */
    getRandomPosition() {
        return {
            x: Math.random() * 300 + 50,
            y: Math.random() * 200 + 50
        };
    }
    
    /**
     * Анимация нажатия кнопки
     */
    animateButton(button) {
        button.style.transform = 'scale(0.95)';
        setTimeout(() => {
            button.style.transform = 'scale(1)';
        }, 100);
    }

    /**
     * Всплывающая панель с фигурами (UI)
     */
    createShapesPopup() {
        this.shapesPopupEl = document.createElement('div');
        this.shapesPopupEl.className = 'moodboard-toolbar__popup moodboard-toolbar__popup--shapes';
        this.shapesPopupEl.style.display = 'none';

        const grid = document.createElement('div');
        grid.className = 'moodboard-shapes__grid';

        const shapes = [
            // Перенесли кнопку "Добавить фигуру" сюда как первый элемент
            { id: 'shape', title: 'Добавить фигуру', isToolbarAction: true },
            { id: 'rounded-square', title: 'Скругленный квадрат' },
            { id: 'circle', title: 'Круг' },
            { id: 'triangle', title: 'Треугольник' },
            { id: 'diamond', title: 'Ромб' },
            { id: 'parallelogram', title: 'Параллелограмм' },
            { id: 'arrow', title: 'Стрелка' }
        ];

            shapes.forEach(s => {
            const btn = document.createElement('button');
            btn.className = `moodboard-shapes__btn moodboard-shapes__btn--${s.id}`;
            btn.title = s.title;
            const icon = document.createElement('span');
            if (s.isToolbarAction) {
                // Визуально как квадрат, действие — как старая кнопка "Добавить фигуру"
                icon.className = 'moodboard-shapes__icon shape-square';
            } else {
                icon.className = `moodboard-shapes__icon shape-${s.id}`;
                if (s.id === 'arrow') {
                    // Залитая стрелка в стиле U+21E8 (прямоугольник + треугольник)
                    icon.innerHTML = '<svg width="18" height="12" viewBox="0 0 18 12" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="0" y="5" width="12" height="2" rx="1" fill="#1d4ed8"/><path d="M12 0 L18 6 L12 12 Z" fill="#1d4ed8"/></svg>';
                }
            }
            btn.appendChild(icon);
            btn.addEventListener('click', () => {
                this.animateButton(btn);
                if (s.isToolbarAction) {
                    // Режим: добавить дефолтную фигуру по клику на холсте
                    this.eventBus.emit(Events.Place.Set, { type: 'shape', properties: { kind: 'square' } });
                    this.closeShapesPopup();
                    return;
                }
                // Для остальных фигур — запоминаем выбранную форму и ждём клика по холсту
                const propsMap = {
                    'rounded-square': { kind: 'rounded', cornerRadius: 10 },
                    'circle': { kind: 'circle' },
                    'triangle': { kind: 'triangle' },
                    'diamond': { kind: 'diamond' },
                    'parallelogram': { kind: 'parallelogram' },
                    'arrow': { kind: 'arrow' }
                };
                const props = propsMap[s.id] || { kind: 'square' };
                this.eventBus.emit(Events.Place.Set, { type: 'shape', properties: props });
                this.closeShapesPopup();
            });
            grid.appendChild(btn);
        });

        this.shapesPopupEl.appendChild(grid);
        // Добавляем попап внутрь контейнера тулбара
        this.container.appendChild(this.shapesPopupEl);
    }

    toggleShapesPopup(anchorButton) {
        if (!this.shapesPopupEl) return;
        if (this.shapesPopupEl.style.display === 'none') {
            this.openShapesPopup(anchorButton);
        } else {
            this.closeShapesPopup();
        }
    }

    openShapesPopup(anchorButton) {
        if (!this.shapesPopupEl) return;
        // Позиционируем справа от тулбара, по вертикали — напротив кнопки
        const toolbarRect = this.container.getBoundingClientRect();
        const buttonRect = anchorButton.getBoundingClientRect();
        const top = buttonRect.top - toolbarRect.top - 4; // легкое выравнивание
        const left = this.element.offsetWidth + 8; // отступ от тулбара
        this.shapesPopupEl.style.top = `${top}px`;
        this.shapesPopupEl.style.left = `${left}px`;
        this.shapesPopupEl.style.display = 'block';
    }

    closeShapesPopup() {
        if (this.shapesPopupEl) {
            this.shapesPopupEl.style.display = 'none';
        }
    }

    /**
     * Всплывающая панель рисования (UI)
     */
    createDrawPopup() {
        this.drawPopupEl = document.createElement('div');
        this.drawPopupEl.className = 'moodboard-toolbar__popup moodboard-toolbar__popup--draw';
        this.drawPopupEl.style.display = 'none';

        const grid = document.createElement('div');
        grid.className = 'moodboard-draw__grid';

        // Первый ряд: карандаш, маркер, ластик (иконки SVG)
        const tools = [
            { id: 'pencil-tool', tool: 'pencil', title: 'Карандаш', svg: '<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M2 14 L14 2 L18 6 L6 18 L2 18 Z" fill="#1f2937"/><path d="M12 4 L16 8" stroke="#e5e7eb" stroke-width="2"/></svg>' },
            { id: 'marker-tool', tool: 'marker', title: 'Маркер', svg: '<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="3" y="3" width="10" height="6" rx="2" fill="#1f2937"/><path d="M13 4 L17 8 L12 13 L8 9 Z" fill="#374151"/></svg>' },
            { id: 'eraser-tool', tool: 'eraser', title: 'Ластик', svg: '<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="4" y="10" width="10" height="6" rx="2" transform="rotate(-45 4 10)" fill="#9ca3af"/><rect x="9" y="5" width="6" height="4" rx="1" transform="rotate(-45 9 5)" fill="#d1d5db"/></svg>' }
        ];
        const row1 = document.createElement('div');
        row1.className = 'moodboard-draw__row';
        this.drawRow1 = row1;
        tools.forEach(t => {
            const btn = document.createElement('button');
            btn.className = `moodboard-draw__btn moodboard-draw__btn--${t.id}`;
            btn.title = t.title;
            const icon = document.createElement('span');
            icon.className = 'draw-icon';
            icon.innerHTML = t.svg;
            btn.appendChild(icon);
            btn.addEventListener('click', () => {
                this.animateButton(btn);
                // Активируем инструмент рисования
                row1.querySelectorAll('.moodboard-draw__btn--active').forEach(el => el.classList.remove('moodboard-draw__btn--active'));
                btn.classList.add('moodboard-draw__btn--active');
                this.currentDrawTool = t.tool;
                // Сообщаем текущий мод
                this.eventBus.emit(Events.Draw.BrushSet, { mode: t.tool });
                // Перестраиваем нижний ряд пресетов
                this.buildDrawPresets(row2);
            });
            row1.appendChild(btn);
        });

        // Второй ряд: толщина/цвет — круг + центральная точка
        const row2 = document.createElement('div');
        row2.className = 'moodboard-draw__row';
        this.drawRow2 = row2;
        this.buildDrawPresets = (container) => {
            container.innerHTML = '';
            if (this.currentDrawTool === 'pencil') {
                const sizes = [
                    { id: 'size-thin-black', title: 'Тонкий черный', color: '#111827', dot: 4, width: 2 },
                    { id: 'size-medium-red', title: 'Средний красный', color: '#ef4444', dot: 7, width: 4 },
                    { id: 'size-thick-green', title: 'Толстый зеленый', color: '#16a34a', dot: 10, width: 6 }
                ];
                sizes.forEach(s => {
                    const btn = document.createElement('button');
                    btn.className = `moodboard-draw__btn moodboard-draw__btn--${s.id}`;
                    btn.title = s.title;
                    btn.dataset.brushWidth = String(s.width);
                    btn.dataset.brushColor = s.color;
                    const holder = document.createElement('span');
                    holder.className = 'draw-size';
                    const dot = document.createElement('span');
                    dot.className = 'draw-dot';
                    dot.style.background = s.color;
                    dot.style.width = `${s.dot}px`;
                    dot.style.height = `${s.dot}px`;
                    holder.appendChild(dot);
                    btn.appendChild(holder);
                    btn.addEventListener('click', () => {
                        this.animateButton(btn);
                        container.querySelectorAll('.moodboard-draw__btn--active').forEach(el => el.classList.remove('moodboard-draw__btn--active'));
                        btn.classList.add('moodboard-draw__btn--active');
                        const width = s.width;
                        const color = parseInt(s.color.replace('#',''), 16);
                        this.eventBus.emit(Events.Draw.BrushSet, { mode: 'pencil', width, color });
                    });
                    container.appendChild(btn);
                });
                // Выставляем дефолт
                const first = container.querySelector('.moodboard-draw__btn');
                if (first) {
                    first.classList.add('moodboard-draw__btn--active');
                    const width = parseInt(first.dataset.brushWidth, 10) || 2;
                    const color = parseInt((first.dataset.brushColor || '#111827').replace('#',''), 16);
                    this.eventBus.emit(Events.Draw.BrushSet, { mode: 'pencil', width, color });
                }
            } else if (this.currentDrawTool === 'marker') {
                const swatches = [
                    { id: 'marker-yellow', title: 'Жёлтый', color: '#facc15' },
                    { id: 'marker-green', title: 'Светло-зелёный', color: '#22c55e' },
                    { id: 'marker-pink', title: 'Розовый', color: '#ec4899' }
                ];
                swatches.forEach(s => {
                    const btn = document.createElement('button');
                    btn.className = `moodboard-draw__btn moodboard-draw__btn--${s.id}`;
                    btn.title = s.title;
                    const sw = document.createElement('span');
                    sw.className = 'draw-swatch';
                    sw.style.background = s.color;
                    btn.appendChild(sw);
                    btn.addEventListener('click', () => {
                        this.animateButton(btn);
                        container.querySelectorAll('.moodboard-draw__btn--active').forEach(el => el.classList.remove('moodboard-draw__btn--active'));
                        btn.classList.add('moodboard-draw__btn--active');
                        const color = parseInt(s.color.replace('#',''), 16);
                        this.eventBus.emit(Events.Draw.BrushSet, { mode: 'marker', color, width: 8 });
                    });
                    container.appendChild(btn);
                });
                // Дефолт — первый цвет
                const first = container.querySelector('.moodboard-draw__btn');
                if (first) {
                    first.classList.add('moodboard-draw__btn--active');
                    const color = parseInt(swatches[0].color.replace('#',''), 16);
                    this.eventBus.emit(Events.Draw.BrushSet, { mode: 'marker', color, width: 8 });
                }
            } else if (this.currentDrawTool === 'eraser') {
                // Ластик — без пресетов
                this.eventBus.emit(Events.Draw.BrushSet, { mode: 'eraser' });
            }
        };

        grid.appendChild(row1);
        grid.appendChild(row2);
        this.drawPopupEl.appendChild(grid);
        this.container.appendChild(this.drawPopupEl);
        // Инициализируем верх/низ по умолчанию: активен карандаш и первый пресет
        const pencilBtn = row1.querySelector('.moodboard-draw__btn--pencil-tool');
        if (pencilBtn) pencilBtn.classList.add('moodboard-draw__btn--active');
        this.currentDrawTool = 'pencil';
        this.eventBus.emit(Events.Draw.BrushSet, { mode: 'pencil' });
        this.buildDrawPresets(row2);
    }

    toggleDrawPopup(anchorButton) {
        if (!this.drawPopupEl) return;
        if (this.drawPopupEl.style.display === 'none') {
            this.openDrawPopup(anchorButton);
        } else {
            this.closeDrawPopup();
        }
    }

    openDrawPopup(anchorButton) {
        if (!this.drawPopupEl) return;
        const toolbarRect = this.container.getBoundingClientRect();
        const buttonRect = anchorButton.getBoundingClientRect();
        const top = buttonRect.top - toolbarRect.top - 4;
        const left = this.element.offsetWidth + 8;
        this.drawPopupEl.style.top = `${top}px`;
        this.drawPopupEl.style.left = `${left}px`;
        this.drawPopupEl.style.display = 'block';
    }

    closeDrawPopup() {
        if (this.drawPopupEl) {
            this.drawPopupEl.style.display = 'none';
        }
    }

    /**
     * Всплывающая панель эмоджи (UI)
     */
    createEmojiPopup() {
        this.emojiPopupEl = document.createElement('div');
        this.emojiPopupEl.className = 'moodboard-toolbar__popup moodboard-toolbar__popup--emoji';
        this.emojiPopupEl.style.display = 'none';

        const categories = [
            { title: 'Смайлики', items: ['😀','😁','😂','🤣','🙂','😊','😍','😘','😎','🤔','😴','😡','😭','😇','🤩','🤨','😐','😅','😏','🤗','🤫','😤','🤯','🤪'] },
            { title: 'Жесты', items: ['👍','👎','👌','✌️','🤘','🤙','👏','🙌','🙏','💪','☝️','👋','🖐️','✋'] },
            { title: 'Предметы', items: ['💡','📌','📎','📝','🖌️','🖼️','🗂️','📁','📷','🎥','🎯','🧩','🔒','🔑'] },
            { title: 'Символы', items: ['⭐','🌟','✨','🔥','💥','⚡','❗','❓','✅','❌','💯','🔔','🌀'] },
            { title: 'Животные', items: ['🐶','🐱','🦊','🐼','🐨','🐵','🐸','🐧','🐤','🦄','🐙'] }
        ];

        categories.forEach(cat => {
            const section = document.createElement('div');
            section.className = 'moodboard-emoji__section';
            const title = document.createElement('div');
            title.className = 'moodboard-emoji__title';
            title.textContent = cat.title;
            const grid = document.createElement('div');
            grid.className = 'moodboard-emoji__grid';
            cat.items.forEach(ch => {
                const btn = document.createElement('button');
                btn.className = 'moodboard-emoji__btn';
                btn.title = ch;
                btn.textContent = ch;
                btn.addEventListener('click', () => {
                    this.animateButton(btn);
                    // Устанавливаем pending для размещения emoji кликом по холсту
                    const size = 48; // базовый размер
                    this.eventBus.emit(Events.Place.Set, {
                        type: 'emoji',
                        properties: { content: ch, fontSize: size, width: size, height: size },
                        size: { width: size, height: size },
                        // anchorCentered не используем, позиция ставится как топ-левт со смещением на половину размера
                    });
                    this.closeEmojiPopup();
                });
                grid.appendChild(btn);
            });
            section.appendChild(title);
            section.appendChild(grid);
            this.emojiPopupEl.appendChild(section);
        });

        // Разделительная линия
        const divider = document.createElement('div');
        divider.className = 'moodboard-emoji__divider';
        this.emojiPopupEl.appendChild(divider);

        // Стикеры (простые крупные эмодзи или пиктограммы)
        const stickersTitle = document.createElement('div');
        stickersTitle.className = 'moodboard-stickers__title';
        stickersTitle.textContent = 'Стикеры';
        const stickersGrid = document.createElement('div');
        stickersGrid.className = 'moodboard-stickers__grid';

        const stickers = ['📌','📎','🗂️','📁','🧩','🎯','💡','⭐','🔥','🚀','🎉','🧠'];
        stickers.forEach(s => {
            const btn = document.createElement('button');
            btn.className = 'moodboard-sticker__btn';
            btn.title = s;
            btn.textContent = s;
            btn.addEventListener('click', () => this.animateButton(btn));
            stickersGrid.appendChild(btn);
        });
        this.emojiPopupEl.appendChild(stickersTitle);
        this.emojiPopupEl.appendChild(stickersGrid);
        this.container.appendChild(this.emojiPopupEl);
    }

    toggleEmojiPopup(anchorButton) {
        if (!this.emojiPopupEl) return;
        if (this.emojiPopupEl.style.display === 'none') {
            this.openEmojiPopup(anchorButton);
        } else {
            this.closeEmojiPopup();
        }
    }

    openEmojiPopup(anchorButton) {
        if (!this.emojiPopupEl) return;
        const toolbarRect = this.container.getBoundingClientRect();
        const buttonRect = anchorButton.getBoundingClientRect();
        const left = this.element.offsetWidth + 8;
        // Показать невидимо для вычисления размеров
        this.emojiPopupEl.style.visibility = 'hidden';
        this.emojiPopupEl.style.display = 'block';
        // Рассчитать top так, чтобы попап не уходил за нижнюю границу
        const desiredTop = buttonRect.top - toolbarRect.top - 4;
        const popupHeight = this.emojiPopupEl.offsetHeight;
        const containerHeight = this.container.clientHeight || toolbarRect.height;
        const minTop = 8;
        const maxTop = Math.max(minTop, containerHeight - popupHeight - 8);
        const top = Math.min(Math.max(minTop, desiredTop), maxTop);
        this.emojiPopupEl.style.top = `${top}px`;
        this.emojiPopupEl.style.left = `${left}px`;
        this.emojiPopupEl.style.visibility = 'visible';
    }

    closeEmojiPopup() {
        if (this.emojiPopupEl) {
            this.emojiPopupEl.style.display = 'none';
        }
    }
    
    /**
     * Изменение темы
     */
    setTheme(theme) {
        this.theme = theme;
        this.element.className = `moodboard-toolbar moodboard-toolbar--${theme}`;
    }
    
    /**
     * Настройка обработчиков событий истории
     */
    setupHistoryEvents() {
        // Слушаем изменения истории для обновления кнопок undo/redo
        this.eventBus.on(Events.UI.UpdateHistoryButtons, (data) => {
            this.updateHistoryButtons(data.canUndo, data.canRedo);
        });
    }

    /**
     * Открывает диалог выбора файла и запускает режим "призрака"
     */
    async openFileDialog() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '*/*'; // Принимаем любые файлы
        input.style.display = 'none';
        document.body.appendChild(input);

        input.addEventListener('change', async () => {
            try {
                const file = input.files && input.files[0];
                if (!file) {
                    // Пользователь отменил выбор файла
                    this.eventBus.emit(Events.Place.FileCanceled);
                    return;
                }

                // Файл выбран - запускаем режим "призрака"
                this.eventBus.emit(Events.Place.FileSelected, {
                    file: file,
                    fileName: file.name,
                    fileSize: file.size,
                    mimeType: file.type,
                    properties: {
                        width: 120,
                        height: 140
                    }
                });

                // Активируем инструмент размещения
                this.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'place' });
                this.placeSelectedButtonId = 'attachments';
                this.setActiveToolbarButton('place');

            } catch (error) {
                console.error('Ошибка при выборе файла:', error);
                alert('Ошибка при выборе файла: ' + error.message);
            } finally {
                input.remove();
            }
        }, { once: true });

        // Обработка отмены диалога (клик вне диалога или ESC)
        const handleCancel = () => {
            setTimeout(() => {
                if (input.files.length === 0) {
                    this.eventBus.emit(Events.Place.FileCanceled);
                    input.remove();
                }
                window.removeEventListener('focus', handleCancel);
            }, 100);
        };
        
        window.addEventListener('focus', handleCancel, { once: true });
        input.click();
    }

    /**
     * Открывает диалог выбора изображения и запускает режим "призрака"
     */
    async openImageDialog() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*'; // Принимаем только изображения
        input.style.display = 'none';
        document.body.appendChild(input);

        input.addEventListener('change', async () => {
            try {
                const file = input.files && input.files[0];
                if (!file) {
                    // Пользователь отменил выбор изображения
                    this.eventBus.emit(Events.Place.ImageCanceled);
                    return;
                }

                // Изображение выбрано - запускаем режим "призрака"
                this.eventBus.emit(Events.Place.ImageSelected, {
                    file: file,
                    fileName: file.name,
                    fileSize: file.size,
                    mimeType: file.type,
                    properties: {
                        width: 300,  // Дефолтная ширина для изображения
                        height: 200  // Дефолтная высота для изображения (будет пересчитана по пропорциям)
                    }
                });

                // Активируем инструмент размещения
                this.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'place' });
                this.placeSelectedButtonId = 'image';
                this.setActiveToolbarButton('place');

            } catch (error) {
                console.error('Ошибка при выборе изображения:', error);
                alert('Ошибка при выборе изображения: ' + error.message);
            } finally {
                input.remove();
            }
        }, { once: true });

        // Обработка отмены диалога (клик вне диалога или ESC)
        const handleCancel = () => {
            setTimeout(() => {
                if (input.files.length === 0) {
                    this.eventBus.emit(Events.Place.ImageCanceled);
                    input.remove();
                }
                window.removeEventListener('focus', handleCancel);
            }, 100);
        };
        
        window.addEventListener('focus', handleCancel, { once: true });
        input.click();
    }
    
    /**
     * Обновление состояния кнопок undo/redo
     */
    updateHistoryButtons(canUndo, canRedo) {
        const undoButton = this.element.querySelector('[data-tool="undo"]');
        const redoButton = this.element.querySelector('[data-tool="redo"]');
        
        if (undoButton) {
            undoButton.disabled = !canUndo;
            if (canUndo) {
                undoButton.classList.remove('moodboard-toolbar__button--disabled');
                undoButton.title = 'Отменить последнее действие (Ctrl+Z)';
            } else {
                undoButton.classList.add('moodboard-toolbar__button--disabled');
                undoButton.title = 'Нет действий для отмены';
            }
        }
        
        if (redoButton) {
            redoButton.disabled = !canRedo;
            if (canRedo) {
                redoButton.classList.remove('moodboard-toolbar__button--disabled');
                redoButton.title = 'Повторить отмененное действие (Ctrl+Y)';
            } else {
                redoButton.classList.add('moodboard-toolbar__button--disabled');
                redoButton.title = 'Нет действий для повтора';
            }
        }
    }

    /**
     * Очистка ресурсов
     */
    destroy() {
        if (this.element) {
            // Очищаем все tooltips перед удалением элемента
            const buttons = this.element.querySelectorAll('.moodboard-toolbar__button');
            buttons.forEach(button => {
                if (button._tooltip) {
                    button._tooltip.remove();
                    button._tooltip = null;
                }
            });
            
            this.element.remove();
            this.element = null;
        }
        
        // Отписываемся от событий
        this.eventBus.removeAllListeners(Events.UI.UpdateHistoryButtons);
    }

    /**
     * Принудительно обновляет иконку (для отладки)
     * @param {string} iconName - имя иконки
     */
    async reloadToolbarIcon(iconName) {
        console.log(`🔄 Начинаем обновление иконки ${iconName} в тулбаре...`);
        try {
            // Перезагружаем иконку
            const newSvgContent = await this.iconLoader.reloadIcon(iconName);
            this.icons[iconName] = newSvgContent;
            
            // Находим кнопку с этой иконкой и обновляем её
            const button = this.element.querySelector(`[data-tool-id="${iconName}"]`);
            if (button) {
                // Очищаем старый SVG
                const oldSvg = button.querySelector('svg');
                if (oldSvg) {
                    oldSvg.remove();
                }
                
                // Добавляем новый SVG
                this.createSvgIcon(button, iconName);
                console.log(`✅ Иконка ${iconName} обновлена в интерфейсе!`);
            } else {
                console.warn(`⚠️ Кнопка с иконкой ${iconName} не найдена`);
            }
        } catch (error) {
            console.error(`❌ Ошибка обновления иконки ${iconName}:`, error);
        }
    }
}
