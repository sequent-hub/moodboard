/**
 * Компонент индикатора статуса сохранения
 */
export class SaveStatus {
    constructor(container, eventBus, options = {}) {
        this.container = container;
        this.eventBus = eventBus;
        this.options = {
            // Фиксированные настройки UI (оптимальные для пользователя)
            showTimestamp: true,
            autoHide: true,
            hideDelay: 3000,
            position: 'top-right',
            // Настраиваемые опции (только для внутреннего использования)
            ...options
        };
        
        this.element = null;
        this.hideTimer = null;
        
        this.init();
        this.setupEventListeners();
    }
    
    /**
     * Инициализация UI элемента
     */
    init() {
        this.element = document.createElement('div');
        this.element.className = this.getBaseClasses();
        this.element.innerHTML = this.getInitialContent();
        
        // Позиционирование
        this.applyPositioning();
        
        // Добавляем в контейнер
        this.container.appendChild(this.element);
    }
    
    /**
     * Получение базовых CSS классов
     */
    getBaseClasses() {
        return [
            'moodboard-save-status',
            'absolute',
            'z-10',
            'px-3',
            'py-2', 
            'rounded-lg',
            'text-sm',
            'font-medium',
            'transition-all',
            'duration-300',
            'shadow-lg',
            'backdrop-blur-sm',
            'border'
        ].join(' ');
    }
    
    /**
     * Применение позиционирования
     */
    applyPositioning() {
        const positions = {
            'top-left': { top: '12px', left: '12px' },
            'top-right': { top: '12px', right: '12px' },
            'bottom-left': { bottom: '12px', left: '12px' },
            'bottom-right': { bottom: '12px', right: '12px' }
        };
        
        const pos = positions[this.options.position] || positions['top-right'];
        
        Object.assign(this.element.style, pos);
    }
    
    /**
     * Начальный контент
     */
    getInitialContent() {
        return `
            <div class="flex items-center gap-2">
                <span class="save-icon">🔄</span>
                <span class="save-text">Готов к работе</span>
                ${this.options.showTimestamp ? '<span class="save-time text-xs opacity-70"></span>' : ''}
            </div>
        `;
    }
    
    /**
     * Настройка обработчиков событий
     */
    setupEventListeners() {
        // Статус сохранения
        this.eventBus.on('save:status-changed', (data) => {
            this.updateStatus(data);
        });
        
        // Успешное сохранение
        this.eventBus.on('save:success', (data) => {
            this.showSuccess(data);
        });
        
        // Ошибка сохранения
        this.eventBus.on('save:error', (data) => {
            this.showError(data);
        });
    }
    
    /**
     * Обновление статуса
     */
    updateStatus(data) {
        const iconEl = this.element.querySelector('.save-icon');
        const textEl = this.element.querySelector('.save-text');
        const timeEl = this.element.querySelector('.save-time');
        
        // Очищаем предыдущий таймер
        if (this.hideTimer) {
            clearTimeout(this.hideTimer);
            this.hideTimer = null;
        }
        
        // Показываем элемент
        this.element.style.opacity = '1';
        this.element.style.transform = 'translateY(0)';
        
        switch (data.status) {
            case 'pending':
                this.applyStyle('pending');
                iconEl.textContent = '⏳';
                textEl.textContent = 'Изменения...';
                break;
                
            case 'saving':
                this.applyStyle('saving');
                iconEl.textContent = '💾';
                textEl.textContent = 'Сохранение...';
                break;
                
            case 'saved':
                this.applyStyle('saved');
                iconEl.textContent = '✅';
                textEl.textContent = 'Сохранено';
                this.scheduleAutoHide();
                break;
                
            case 'error':
                this.applyStyle('error');
                iconEl.textContent = '❌';
                textEl.textContent = data.message || 'Ошибка сохранения';
                this.scheduleAutoHide(6000); // Ошибки показываем дольше
                break;
                
            default:
                this.applyStyle('idle');
                iconEl.textContent = '🔄';
                textEl.textContent = 'Готов к работе';
        }
        
        // Обновляем время
        if (timeEl && this.options.showTimestamp) {
            const time = new Date().toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit'
            });
            timeEl.textContent = time;
        }
    }
    
    /**
     * Применение стилей для статуса
     */
    applyStyle(status) {
        // Удаляем предыдущие классы статуса
        this.element.className = this.element.className.replace(/status-\w+/g, '');
        
        const styles = {
            idle: {
                className: 'status-idle bg-gray-100 text-gray-600 border-gray-200',
                bgColor: 'rgba(243, 244, 246, 0.9)'
            },
            pending: {
                className: 'status-pending bg-blue-100 text-blue-600 border-blue-200',
                bgColor: 'rgba(219, 234, 254, 0.9)'
            },
            saving: {
                className: 'status-saving bg-blue-100 text-blue-600 border-blue-200',
                bgColor: 'rgba(219, 234, 254, 0.9)'
            },
            saved: {
                className: 'status-saved bg-green-100 text-green-600 border-green-200',
                bgColor: 'rgba(220, 252, 231, 0.9)'
            },
            error: {
                className: 'status-error bg-red-100 text-red-600 border-red-200',
                bgColor: 'rgba(254, 226, 226, 0.9)'
            }
        };
        
        const style = styles[status] || styles.idle;
        
        this.element.className += ` ${style.className}`;
        this.element.style.backgroundColor = style.bgColor;
    }
    
    /**
     * Показать успешное сохранение
     */
    showSuccess(data) {
        // Дополнительные действия при успешном сохранении
        if (data.timestamp && this.options.showTimestamp) {
            console.log('Данные сохранены в:', data.timestamp);
        }
    }
    
    /**
     * Показать ошибку
     */
    showError(data) {
        // Дополнительные действия при ошибке
        console.error('Ошибка сохранения:', data.error);
        
        // Можно добавить звуковое уведомление или другие действия
    }
    
    /**
     * Запланировать автоскрытие
     */
    scheduleAutoHide(delay = null) {
        if (!this.options.autoHide) return;
        
        const hideDelay = delay || this.options.hideDelay;
        
        this.hideTimer = setTimeout(() => {
            this.element.style.opacity = '0.6';
            this.element.style.transform = 'translateY(-8px)';
        }, hideDelay);
    }
    
    /**
     * Принудительное скрытие
     */
    hide() {
        this.element.style.opacity = '0';
        this.element.style.transform = 'translateY(-20px)';
    }
    
    /**
     * Принудительное показывание
     */
    show() {
        this.element.style.opacity = '1';
        this.element.style.transform = 'translateY(0)';
    }
    
    /**
     * Обновление позиции
     */
    setPosition(position) {
        this.options.position = position;
        this.applyPositioning();
    }
    
    /**
     * Получение текущего статуса
     */
    getCurrentStatus() {
        const classList = this.element.className;
        if (classList.includes('status-saving')) return 'saving';
        if (classList.includes('status-saved')) return 'saved';
        if (classList.includes('status-error')) return 'error';
        if (classList.includes('status-pending')) return 'pending';
        return 'idle';
    }
    
    /**
     * Очистка ресурсов
     */
    destroy() {
        if (this.hideTimer) {
            clearTimeout(this.hideTimer);
        }
        
        this.eventBus.off('save:status-changed');
        this.eventBus.off('save:success');
        this.eventBus.off('save:error');
        
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}
