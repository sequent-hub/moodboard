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

        // Создаем всплывающие панели (пока только для фигур)
        this.createShapesPopup();
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
            if (toolType === 'custom-t' || toolType === 'custom-draw' || toolType === 'custom-frame' || toolType === 'custom-comments' || toolType === 'custom-attachments' || toolType === 'custom-emoji' || toolType === 'activate-select' || toolType === 'activate-pan') {
                this.animateButton(button);
                // Закрываем панель фигур, если клик не по ней
                this.closeShapesPopup();
                return;
            }

            // Тоггл всплывающей панели фигур
            if (toolType === 'custom-shapes') {
                this.animateButton(button);
                this.toggleShapesPopup(button);
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
            const isShapesButton = e.target.closest && e.target.closest('.moodboard-toolbar__button--shapes');
            if (!isInsideToolbar && !isInsideShapesPopup && !isShapesButton) {
                this.closeShapesPopup();
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
