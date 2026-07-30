/**
 * Управляет HTML структурой рабочего пространства MoodBoard
 */
export class WorkspaceManager {
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;
        this.workspaceElement = null;
        this.toolbarContainer = null;
        this.canvasContainer = null;
        this.topbarContainer = null;
        this._resetCanvasScroll = (event) => {
            const el = event?.currentTarget;
            if (!el) return;
            if (el.scrollLeft !== 0) el.scrollLeft = 0;
            if (el.scrollTop !== 0) el.scrollTop = 0;
        };
    }
    
    /**
     * Создает HTML структуру рабочего пространства
     */
    createWorkspaceStructure() {
        // Очищаем контейнер
        this.container.innerHTML = '';
        
        // Создаем основной элемент workspace
        this.workspaceElement = document.createElement('div');
        this.workspaceElement.className = `moodboard-workspace moodboard-workspace--${this.options.theme}`;
        
        // Создаем контейнер для тулбара
        this.toolbarContainer = document.createElement('div');
        this.toolbarContainer.className = 'moodboard-workspace__toolbar';
        
        // Создаем контейнер для canvas
        this.canvasContainer = document.createElement('div');
        this.canvasContainer.className = 'moodboard-workspace__canvas';
        this.canvasContainer.id = 'moodboard-canvas-' + Date.now();
        // Страховка для браузеров без overflow: clip (Safari < 16): там контейнер остаётся
        // прокручиваемым, и прокрутка к каретке редактора сдвигает canvas относительно
        // HTML-оверлеев.
        this.canvasContainer.addEventListener('scroll', this._resetCanvasScroll, { passive: true });

        // Создаем контейнер для верхней панели
        this.topbarContainer = document.createElement('div');
        this.topbarContainer.className = 'moodboard-workspace__topbar';
        
        // Собираем структуру (toolbar поверх canvas)
        this.workspaceElement.appendChild(this.canvasContainer);
        this.workspaceElement.appendChild(this.toolbarContainer);
        this.workspaceElement.appendChild(this.topbarContainer);
        this.container.appendChild(this.workspaceElement);
        
        return {
            workspace: this.workspaceElement,
            toolbar: this.toolbarContainer,
            canvas: this.canvasContainer,
            topbar: this.topbarContainer
        };
    }
    
    /**
     * Обновляет тему рабочего пространства
     */
    updateTheme(theme) {
        if (this.workspaceElement) {
            this.workspaceElement.className = `moodboard-workspace moodboard-workspace--${theme}`;
        }
    }
    
    /**
     * Показывает уведомление
     */
    showNotification(message) {
        if (!this.workspaceElement) return;
        
        const notification = document.createElement('div');
        notification.className = 'moodboard-notification';
        notification.textContent = message;
        
        this.workspaceElement.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
    
    /**
     * Получение размеров canvas контейнера
     */
    getCanvasSize() {
        if (!this.canvasContainer) {
            return { width: 800, height: 600 };
        }
        
        return {
            width: this.canvasContainer.clientWidth,
            height: this.canvasContainer.clientHeight
        };
    }
    
    /**
     * Очистка ресурсов
     */
    destroy() {
        if (this.canvasContainer) {
            this.canvasContainer.removeEventListener('scroll', this._resetCanvasScroll);
        }
        if (this.workspaceElement) {
            this.workspaceElement.remove();
            this.workspaceElement = null;
        }
        this.toolbarContainer = null;
        this.canvasContainer = null;
    }
}
