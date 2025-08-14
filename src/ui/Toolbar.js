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
            { id: 'frame-tool', icon: '🖼️', title: 'Фрейм', type: 'custom-frame' },
            { id: 'comments', icon: '💬', title: 'Комментарии', type: 'custom-comments' },
            { id: 'attachments', icon: '📎', title: 'Файлы', type: 'custom-attachments' },
            { id: 'emoji', icon: '🙂', title: 'Эмоджи', type: 'custom-emoji' }
        ];

        // Существующие элементы ниже новых
        const existingTools = [
            { id: 'frame', icon: '🖼️', title: 'Добавить рамку', type: 'frame' },
            { id: 'text', icon: '📝', title: 'Добавить текст', type: 'simple-text' },
            { id: 'shape', icon: '🔶', title: 'Добавить фигуру', type: 'shape' },
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

        // Создаем всплывающие панели (фигуры и рисование)
        this.createShapesPopup();
        this.createDrawPopup();
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

            // Заглушки для новых кнопок — пока без действий (только анимация)
            if (toolType === 'custom-t' || toolType === 'custom-frame' || toolType === 'custom-comments' || toolType === 'custom-attachments' || toolType === 'custom-emoji' || toolType === 'activate-select' || toolType === 'activate-pan') {
                this.animateButton(button);
                // Закрываем панель фигур, если клик не по ней
                this.closeShapesPopup();
                this.closeDrawPopup();
                return;
            }

            // Тоггл всплывающей панели фигур
            if (toolType === 'custom-shapes') {
                this.animateButton(button);
                this.toggleShapesPopup(button);
                this.closeDrawPopup();
                return;
            }

            // Тоггл всплывающей панели рисования
            if (toolType === 'custom-draw') {
                this.animateButton(button);
                this.toggleDrawPopup(button);
                this.closeShapesPopup();
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
            const isShapesButton = e.target.closest && e.target.closest('.moodboard-toolbar__button--shapes');
            const isDrawButton = e.target.closest && e.target.closest('.moodboard-toolbar__button--pencil');
            if (!isInsideToolbar && !isInsideShapesPopup && !isShapesButton && !isInsideDrawPopup && !isDrawButton) {
                this.closeShapesPopup();
                this.closeDrawPopup();
            }
        });
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
            { id: 'square', title: 'Квадрат' },
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
            icon.className = `moodboard-shapes__icon shape-${s.id}`;
                if (s.id === 'arrow') {
                    // Залитая стрелка в стиле U+21E8 (прямоугольник + треугольник)
                    icon.innerHTML = '<svg width="18" height="12" viewBox="0 0 18 12" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="0" y="5" width="12" height="2" rx="1" fill="#1d4ed8"/><path d="M12 0 L18 6 L12 12 Z" fill="#1d4ed8"/></svg>';
                }
            btn.appendChild(icon);
            btn.addEventListener('click', () => {
                // Пока без функционала — просто визуальная обратная связь
                this.animateButton(btn);
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
            { id: 'pencil-tool', title: 'Карандаш', svg: '<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M2 14 L14 2 L18 6 L6 18 L2 18 Z" fill="#1f2937"/><path d="M12 4 L16 8" stroke="#e5e7eb" stroke-width="2"/></svg>' },
            { id: 'marker-tool', title: 'Маркер', svg: '<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="3" y="3" width="10" height="6" rx="2" fill="#1f2937"/><path d="M13 4 L17 8 L12 13 L8 9 Z" fill="#374151"/></svg>' },
            { id: 'eraser-tool', title: 'Ластик', svg: '<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="4" y="10" width="10" height="6" rx="2" transform="rotate(-45 4 10)" fill="#9ca3af"/><rect x="9" y="5" width="6" height="4" rx="1" transform="rotate(-45 9 5)" fill="#d1d5db"/></svg>' }
        ];
        const row1 = document.createElement('div');
        row1.className = 'moodboard-draw__row';
        tools.forEach(t => {
            const btn = document.createElement('button');
            btn.className = `moodboard-draw__btn moodboard-draw__btn--${t.id}`;
            btn.title = t.title;
            const icon = document.createElement('span');
            icon.className = 'draw-icon';
            icon.innerHTML = t.svg;
            btn.appendChild(icon);
            btn.addEventListener('click', () => this.animateButton(btn));
            row1.appendChild(btn);
        });

        // Второй ряд: толщина/цвет — круг + центральная точка
        const sizes = [
            { id: 'size-thin-black', title: 'Тонкий черный', color: '#111827', dot: 4 },
            { id: 'size-medium-red', title: 'Средний красный', color: '#ef4444', dot: 7 },
            { id: 'size-thick-green', title: 'Толстый зеленый', color: '#16a34a', dot: 10 }
        ];
        const row2 = document.createElement('div');
        row2.className = 'moodboard-draw__row';
        sizes.forEach(s => {
            const btn = document.createElement('button');
            btn.className = `moodboard-draw__btn moodboard-draw__btn--${s.id}`;
            btn.title = s.title;
            const holder = document.createElement('span');
            holder.className = 'draw-size';
            const dot = document.createElement('span');
            dot.className = 'draw-dot';
            dot.style.background = s.color;
            dot.style.width = `${s.dot}px`;
            dot.style.height = `${s.dot}px`;
            holder.appendChild(dot);
            btn.appendChild(holder);
            btn.addEventListener('click', () => this.animateButton(btn));
            row2.appendChild(btn);
        });

        grid.appendChild(row1);
        grid.appendChild(row2);
        this.drawPopupEl.appendChild(grid);
        this.container.appendChild(this.drawPopupEl);
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
