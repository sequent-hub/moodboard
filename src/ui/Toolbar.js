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
            // { id: 'comments', iconName: 'comments', title: 'Комментарии', type: 'custom-comments' }, // Временно скрыто
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
        this.createFramePopup();

        // Подсветка активной кнопки на тулбаре по активному инструменту
        this.eventBus.on(Events.Tool.Activated, ({ tool }) => {
            this.setActiveToolbarButton(tool);
        });

        // Текущее состояние попапа рисования
        this.currentDrawTool = 'pencil';
    }

    createFramePopup() {
        this.framePopupEl = document.createElement('div');
        this.framePopupEl.className = 'moodboard-toolbar__popup frame-popup';
        this.framePopupEl.style.display = 'none';

        const makeBtn = (label, id, enabled, aspect, options = {}) => {
            const btn = document.createElement('button');
            btn.className = 'frame-popup__btn' + (enabled ? '' : ' is-disabled') + (options.header ? ' frame-popup__btn--header' : '');
            if (options.header) {
                // handled by CSS class
            }
            btn.dataset.id = id;
            // Внутри кнопки — превью (слева) и подпись (справа/ниже)
            const holder = document.createElement('div');
            holder.className = 'frame-popup__holder';
            let preview = document.createElement('div');
            if (options.header) {
                // Для «Произвольный» — горизонтальный пунктирный прямоугольник
                preview.className = 'frame-popup__preview frame-popup__preview--custom';
            } else {
                // Для пресетов — мини-превью с нужными пропорциями, слева от текста
                preview.className = 'frame-popup__preview';
                preview.style.aspectRatio = aspect || '1 / 1';
            }
            const caption = document.createElement('div');
            caption.textContent = label;
            caption.className = 'frame-popup__caption';
            holder.appendChild(preview);
            holder.appendChild(caption);
            btn.appendChild(holder);
            if (enabled) {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // Активируем place, устанавливаем pending для frame (А4)
                    this.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'place' });
                    this.placeSelectedButtonId = 'frame';
                    this.setActiveToolbarButton('place');
                    if (id === 'custom') {
                        // Рисовать фрейм вручную прямоугольником
                        this.eventBus.emit(Events.Place.Set, { type: 'frame-draw', properties: {} });
                    } else {
                        // Подбираем размеры по пресету и увеличиваем площадь в 2 раза (масштаб по корню из 2)
                        let width = 210, height = 297, titleText = 'A4';
                        if (id === '1x1') { width = 300; height = 300; titleText = '1:1'; }
                        else if (id === '4x3') { width = 320; height = 240; titleText = '4:3'; }
                        else if (id === '16x9') { width = 320; height = 180; titleText = '16:9'; }
                        const scale = 2; // х2 по сторонам = х4 по площади
                        width = Math.round(width * scale);
                        height = Math.round(height * scale);
                        // Устанавливаем pending для размещения фрейма указанного размера
                        this.eventBus.emit(Events.Place.Set, {
                            type: 'frame',
                            properties: {
                                width,
                                height,
                                borderColor: 0x333333,
                                fillColor: 0xFFFFFF,
                                title: titleText,
                                lockedAspect: true,
                                type: id
                            }
                        });
                    }
                    this.closeFramePopup();
                });
            }
            this.framePopupEl.appendChild(btn);
        };

        // Верхний ряд: одна кнопка «Произвольный» (включаем рисование фрейма)
        makeBtn('Произвольный', 'custom', true, 'none', { header: true });

        makeBtn('A4', 'a4', true, '210 / 297');
        makeBtn('1:1', '1x1', true, '1 / 1');
        makeBtn('4:3', '4x3', true, '4 / 3');
        makeBtn('16:9', '16x9', true, '16 / 9');

        this.container.appendChild(this.framePopupEl);
    }

    toggleFramePopup(anchorBtn) {
        if (!this.framePopupEl) return;
        const visible = this.framePopupEl.style.display !== 'none';
        if (visible) {
            this.closeFramePopup();
            return;
        }
        const buttonRect = anchorBtn.getBoundingClientRect();
        const toolbarRect = this.container.getBoundingClientRect();
        // Сначала показываем невидимо, чтобы измерить размеры
        this.framePopupEl.style.display = 'grid';
        this.framePopupEl.style.visibility = 'hidden';
        const panelW = this.framePopupEl.offsetWidth || 120;
        const panelH = this.framePopupEl.offsetHeight || 120;
        // Горизонтально: как у панели фигур — от правого края тулбара + 8px
        const targetLeft = this.element.offsetWidth + 8;
        // Вертикально: центр панели на уровне центра кнопки, с тем же лёгким смещением -4px как у фигур
        const btnCenterY = buttonRect.top + buttonRect.height / 2;
        const targetTop = Math.max(0, Math.round(btnCenterY - toolbarRect.top - panelH / 2 - 4));
        this.framePopupEl.style.left = `${Math.round(targetLeft)}px`;
        this.framePopupEl.style.top = `${targetTop}px`;
        // Делаем видимой
        this.framePopupEl.style.visibility = '';
    }

    closeFramePopup() {
        if (this.framePopupEl) this.framePopupEl.style.display = 'none';
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
                        width: 300,
                        height: 300
                    }
                });
                return;
            }

            // Фрейм: показываем всплывающую панель с пресетами
            if (toolType === 'frame') {
                this.animateButton(button);
                this.toggleFramePopup(button);
                this.closeShapesPopup();
                this.closeDrawPopup();
                this.closeEmojiPopup();
                // Активируем place и подсвечиваем кнопку Frame
                this.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'place' });
                this.placeSelectedButtonId = 'frame';
                this.setActiveToolbarButton('place');
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
            const isInsideFramePopup = this.framePopupEl && this.framePopupEl.contains(e.target);
            const isShapesButton = e.target.closest && e.target.closest('.moodboard-toolbar__button--shapes');
            const isDrawButton = e.target.closest && e.target.closest('.moodboard-toolbar__button--pencil');
            const isEmojiButton = e.target.closest && e.target.closest('.moodboard-toolbar__button--emoji');
            const isFrameButton = e.target.closest && e.target.closest('.moodboard-toolbar__button--frame');
            if (!isInsideToolbar && !isInsideShapesPopup && !isShapesButton && !isInsideDrawPopup && !isDrawButton && !isInsideEmojiPopup && !isEmojiButton && !isInsideFramePopup && !isFrameButton) {
                this.closeShapesPopup();
                this.closeDrawPopup();
                this.closeEmojiPopup();
                this.closeFramePopup();
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
            { id: 'pencil-tool', tool: 'pencil', title: 'Карандаш', svg: '<svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M14.492 3.414 8.921 8.985a4.312 4.312 0 0 0 6.105 6.09l5.564-5.562 1.414 1.414-5.664 5.664a6.002 6.002 0 0 1-2.182 1.392L3.344 21.94 2.06 20.656 6.02 9.845c.3-.82.774-1.563 1.391-2.18l.093-.092.01-.01L13.077 2l1.415 1.414ZM4.68 19.32l4.486-1.64a6.305 6.305 0 0 1-1.651-1.19 6.306 6.306 0 0 1-1.192-1.655L4.68 19.32Z" clip-rule="evenodd"/></svg>' },
            { id: 'marker-tool', tool: 'marker', title: 'Маркер', svg: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" width="20" height="20" class="c-bxOhME c-bxOhME-dvzWZT-size-medium"><path fill="currentColor" fill-rule="evenodd" d="M12.737 2.676 8.531 7.264a1 1 0 0 0 .03 1.382l7.674 7.675a1 1 0 0 0 1.442-.029l4.589-4.97 1.468 1.357-4.588 4.97a3 3 0 0 1-3.46.689l-1.917 2.303-1.454.087-.63-.593-.828 1.38L10 22v-1l-.001-.001L10 22H1v-3l.18-.573 3.452-4.93-.817-.77.045-1.496 2.621-2.184a2.999 2.999 0 0 1 .577-3.134l4.205-4.589 1.474 1.352ZM3 19.315v.684h6.434l.76-1.268-4.09-3.85L3 19.314Zm3.007-7.27 6.904 6.498 1.217-1.46-6.667-6.25-1.454 1.212Z" clip-rule="evenodd"></path></svg>' },
            { id: 'eraser-tool', tool: 'eraser', title: 'Ластик', svg: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" width="20" height="20" class="c-bxOhME c-bxOhME-dvzWZT-size-medium"><path fill="currentColor" fill-rule="evenodd" d="M12.63 3.957 4.319 12.27a3 3 0 0 0 0 4.242L7.905 20.1 8.612 20.394H21v-2h-5.6l6.629-6.63a3 3 0 0 0 0-4.242L17.858 3.42a3 3 0 0 0-4.242 0ZM5.12 14.293a1 1 0 0 0 0 1.414L8.414 19h3.172l3-3L9 10.414l-3.879 3.88Zm10.336-8.922a1 1 0 0 0-1.414 0l-3.629 3.63L16 14.585l3.63-3.629a1 1 0 0 0 0-1.414L15.457 5.37Z" clip-rule="evenodd"></path></svg>' }
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
                    { id: 'size-medium-red', title: 'Средний красный', color: '#ef4444', dot: 8, width: 4 },
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
        // Загружаем все изображения из папки src/assets/emodji (png/svg) через Vite import.meta.glob
        const modules = import.meta.glob('../assets/emodji/**/*.{png,PNG,svg,SVG}', { eager: true, as: 'url' });

        // Группируем по подпапкам внутри emodji (категории)
        const entries = Object.entries(modules).sort(([a], [b]) => a.localeCompare(b));
        const groups = new Map();
        entries.forEach(([path, url]) => {
            const marker = '/emodji/';
            const idx = path.indexOf(marker);
            let category = 'Разное';
            if (idx >= 0) {
                const after = path.slice(idx + marker.length);
                const parts = after.split('/');
                category = parts.length > 1 ? parts[0] : 'Разное';
            }
            if (!groups.has(category)) groups.set(category, []);
            groups.get(category).push({ path, url });
        });

        // Задаем желаемый порядок категорий
        const ORDER = ['Смайлики', 'Жесты', 'Женские эмоции', 'Котики', 'Разное'];
        const present = [...groups.keys()];
        const orderedFirst = ORDER.filter(name => groups.has(name));
        const theRest = present.filter(name => !ORDER.includes(name)).sort((a, b) => a.localeCompare(b));
        const orderedCategories = [...orderedFirst, ...theRest];

        // Рендерим секции по категориям в нужном порядке
        orderedCategories.forEach((cat) => {
            const section = document.createElement('div');
            section.className = 'moodboard-emoji__section';

            const title = document.createElement('div');
            title.className = 'moodboard-emoji__title';
            title.textContent = cat;
            section.appendChild(title);

            const grid = document.createElement('div');
            grid.className = 'moodboard-emoji__grid';

            groups.get(cat).forEach(({ url }) => {
                const btn = document.createElement('button');
                btn.className = 'moodboard-emoji__btn';
                btn.title = 'Добавить изображение';
                const img = document.createElement('img');
                img.className = 'moodboard-emoji__img';
                img.src = url;
                img.alt = '';
                btn.appendChild(img);

                // Перетаскивание: начинаем только если был реальный drag (движение > 4px)
                btn.addEventListener('mousedown', (e) => {
                    const startX = e.clientX;
                    const startY = e.clientY;
                    let startedDrag = false;
                    const onMove = (ev) => {
                        if (startedDrag) return;
                        const dx = Math.abs(ev.clientX - startX);
                        const dy = Math.abs(ev.clientY - startY);
                        if (dx > 4 || dy > 4) {
                            startedDrag = true;
                            btn.__dragActive = true;
                            const target = 64;
                            const targetW = target;
                            const targetH = target;
                            // Активируем инструмент размещения и включаем режим placeOnMouseUp
                            this.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'place' });
                            this.eventBus.emit(Events.Place.Set, {
                                type: 'image',
                                properties: { src: url, width: targetW, height: targetH, isEmojiIcon: true },
                                size: { width: targetW, height: targetH },
                                placeOnMouseUp: true
                            });
                            // Закрываем поповер, чтобы не мешал курсору над холстом
                            this.closeEmojiPopup();
                            cleanup();
                        }
                    };
                    const onUp = () => {
                        cleanup();
                        // Снимем флаг сразу после клика, чтобы click мог отфильтроваться
                        setTimeout(() => { btn.__dragActive = false; }, 0);
                    };
                    const cleanup = () => {
                        document.removeEventListener('mousemove', onMove);
                        document.removeEventListener('mouseup', onUp);
                    };
                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('mouseup', onUp, { once: true });
                });

                btn.addEventListener('click', () => {
                    if (btn.__dragActive) return; // не обрабатываем клик после drag
                    this.animateButton(btn);
                    const target = 64; // кратно 128 для лучшей четкости при даунскейле
                    const targetW = target;
                    const targetH = target;
                    this.eventBus.emit(Events.Place.Set, {
                        type: 'image',
                        properties: { src: url, width: targetW, height: targetH, isEmojiIcon: true },
                        size: { width: targetW, height: targetH }
                    });
                    this.closeEmojiPopup();
                });

                grid.appendChild(btn);
            });

            section.appendChild(grid);
            this.emojiPopupEl.appendChild(section);
        });
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
