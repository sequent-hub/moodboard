/**
 * Панель инструментов для MoodBoard
 */
export class Toolbar {
    constructor(container, eventBus, theme = 'light') {
        this.container = container;
        this.eventBus = eventBus;
        this.theme = theme;
        this.element = null;
        
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
            { id: 'select', icon: '↖', title: 'Инструмент выделения (V)', type: 'activate-select' },
            { id: 'pan', icon: '✋', title: 'Панорамирование (Пробел)', type: 'activate-pan' },
            { id: 'divider', type: 'divider' },
            { id: 'big-t', icon: 'T', title: 'Текст', type: 'custom-t' },
            { id: 'shapes', icon: '🔷', title: 'Фигуры', type: 'custom-shapes' },
            { id: 'pencil', icon: '✏️', title: 'Рисование', type: 'custom-draw' },
            { id: 'frame-tool', icon: '📌', title: 'Фрейм', type: 'custom-frame' },
            { id: 'comments', icon: '💬', title: 'Комментарии', type: 'custom-comments' },
            { id: 'attachments', icon: '📎', title: 'Файлы', type: 'custom-attachments' },
            { id: 'emoji', icon: '🙂', title: 'Эмоджи', type: 'custom-emoji' }
        ];

        // Существующие элементы ниже новых
        const existingTools = [
            { id: 'frame', icon: '🖼️', title: 'Добавить рамку', type: 'frame' },
            { id: 'text', icon: '📝', title: 'Добавить текст', type: 'simple-text' },
            { id: 'divider', type: 'divider' },
            { id: 'clear', icon: '🗑️', title: 'Очистить холст', type: 'clear' },
            { id: 'export', icon: '💾', title: 'Экспорт', type: 'export' },
            { id: 'divider', type: 'divider' },
            { id: 'undo', icon: '↶', title: 'Отменить (Ctrl+Z)', type: 'undo', disabled: true },
            { id: 'redo', icon: '↷', title: 'Повторить (Ctrl+Y)', type: 'redo', disabled: true }
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
        this.eventBus.on('tool:activated', ({ tool }) => {
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
        button.textContent = tool.icon || '';
        button.dataset.tool = tool.type;
        button.dataset.toolId = tool.id;
        if (tool.title) button.title = tool.title;
        
        // Устанавливаем disabled состояние если указано
        if (tool.disabled) {
            button.disabled = true;
            button.classList.add('moodboard-toolbar__button--disabled');
        }
        
        // Специальных визуальных замен нет

        return button;
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
                this.eventBus.emit('keyboard:undo');
                this.animateButton(button);
                return;
            }
            
            if (toolType === 'redo') {
                this.eventBus.emit('keyboard:redo');
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
                this.eventBus.emit('place:set', null);
                this.eventBus.emit('keyboard:tool-select', { tool: 'select' });
                this.setActiveToolbarButton('select');
                return;
            }

            // Временная активация панорамирования с панели
            if (toolType === 'activate-pan') {
                this.animateButton(button);
                this.closeShapesPopup();
                this.closeDrawPopup();
                this.closeEmojiPopup();
                this.eventBus.emit('keyboard:tool-select', { tool: 'pan' });
                this.setActiveToolbarButton('pan');
                return;
            }

            // Заглушки для новых кнопок (кроме custom-frame) — пока без действий (только анимация)
            if (toolType === 'custom-t' || toolType === 'custom-comments' || toolType === 'custom-attachments') {
                this.animateButton(button);
                // Закрываем панель фигур, если клик не по ней
                this.closeShapesPopup();
                this.closeDrawPopup();
                this.closeEmojiPopup();
                return;
            }

            // Инструмент «Фрейм» — создаём через универсальный place-поток с размерами 200x300
            if (toolType === 'custom-frame') {
                this.animateButton(button);
                this.closeShapesPopup();
                this.closeDrawPopup();
                this.closeEmojiPopup();
                // Активируем режим размещения и устанавливаем pending
                this.eventBus.emit('keyboard:tool-select', { tool: 'place' });
                this.setActiveToolbarButton('place');
                this.eventBus.emit('place:set', {
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
                this.eventBus.emit('keyboard:tool-select', { tool: 'place' });
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
                this.eventBus.emit('keyboard:tool-select', { tool: 'draw' });
                this.setActiveToolbarButton('draw');
                return;
            }

            // Тоггл всплывающей панели эмоджи
            if (toolType === 'custom-emoji') {
                this.animateButton(button);
                this.toggleEmojiPopup(button);
                this.closeShapesPopup();
                this.closeDrawPopup();
                this.eventBus.emit('keyboard:tool-select', { tool: 'place' });
                return;
            }
            
            // Эмитим событие для других инструментов
            this.eventBus.emit('toolbar:action', {
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
        // Сбрасываем активные классы
        this.element.querySelectorAll('.moodboard-toolbar__button--active').forEach(el => el.classList.remove('moodboard-toolbar__button--active'));
        // Соответствие инструмент → кнопка
        const map = {
            select: 'select',
            pan: 'pan',
            draw: 'pencil',
            place: 'shapes'
        };
        const btnId = map[toolName];
        if (!btnId) return;
        const btn = this.element.querySelector(`.moodboard-toolbar__button--${btnId}`);
        if (btn) btn.classList.add('moodboard-toolbar__button--active');
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
                    this.eventBus.emit('place:set', { type: 'shape', properties: { kind: 'square' } });
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
                this.eventBus.emit('place:set', { type: 'shape', properties: props });
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
                this.eventBus.emit('draw:brush:set', { mode: t.tool });
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
                        this.eventBus.emit('draw:brush:set', { mode: 'pencil', width, color });
                    });
                    container.appendChild(btn);
                });
                // Выставляем дефолт
                const first = container.querySelector('.moodboard-draw__btn');
                if (first) {
                    first.classList.add('moodboard-draw__btn--active');
                    const width = parseInt(first.dataset.brushWidth, 10) || 2;
                    const color = parseInt((first.dataset.brushColor || '#111827').replace('#',''), 16);
                    this.eventBus.emit('draw:brush:set', { mode: 'pencil', width, color });
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
                        this.eventBus.emit('draw:brush:set', { mode: 'marker', color, width: 8 });
                    });
                    container.appendChild(btn);
                });
                // Дефолт — первый цвет
                const first = container.querySelector('.moodboard-draw__btn');
                if (first) {
                    first.classList.add('moodboard-draw__btn--active');
                    const color = parseInt(swatches[0].color.replace('#',''), 16);
                    this.eventBus.emit('draw:brush:set', { mode: 'marker', color, width: 8 });
                }
            } else if (this.currentDrawTool === 'eraser') {
                // Ластик — без пресетов
                this.eventBus.emit('draw:brush:set', { mode: 'eraser' });
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
        this.eventBus.emit('draw:brush:set', { mode: 'pencil' });
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
                    this.eventBus.emit('place:set', {
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
        this.eventBus.on('ui:update-history-buttons', (data) => {
            this.updateHistoryButtons(data.canUndo, data.canRedo);
        });
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
            this.element.remove();
            this.element = null;
        }
        
        // Отписываемся от событий
        this.eventBus.removeAllListeners('ui:update-history-buttons');
    }
}
