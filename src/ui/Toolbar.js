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
    }
    
    /**
     * Создает HTML структуру тулбара
     */
    createToolbar() {
        this.element = document.createElement('div');
        this.element.className = `moodboard-toolbar moodboard-toolbar--${this.theme}`;
        
        const tools = [
            { id: 'frame', label: '🖼️ Add Frame', type: 'frame' },
            { id: 'text', label: '📝 Add Text', type: 'simple-text' },
            { id: 'shape', label: '🔶 Add Shape', type: 'shape' },
            { id: 'divider', type: 'divider' },
            { id: 'clear', label: '🗑️ Clear All', type: 'clear' },
            { id: 'export', label: '💾 Export', type: 'export' }
        ];
        
        tools.forEach(tool => {
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
    }
    
    /**
     * Создает кнопку инструмента
     */
    createButton(tool) {
        const button = document.createElement('button');
        button.className = `moodboard-toolbar__button moodboard-toolbar__button--${tool.id}`;
        button.textContent = tool.label;
        button.dataset.tool = tool.type;
        button.dataset.toolId = tool.id;
        
        return button;
    }
    
    /**
     * Подключает обработчики событий
     */
    attachEvents() {
        this.element.addEventListener('click', (e) => {
            const button = e.target.closest('.moodboard-toolbar__button');
            if (!button) return;
            
            const toolType = button.dataset.tool;
            const toolId = button.dataset.toolId;
            
            // Эмитим событие для MoodBoardWorkspace
            this.eventBus.emit('toolbar:action', {
                type: toolType,
                id: toolId,
                position: this.getRandomPosition()
            });
            
            // Визуальная обратная связь
            this.animateButton(button);
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
     * Изменение темы
     */
    setTheme(theme) {
        this.theme = theme;
        this.element.className = `moodboard-toolbar moodboard-toolbar--${theme}`;
    }
    
    /**
     * Очистка ресурсов
     */
    destroy() {
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
    }
}
