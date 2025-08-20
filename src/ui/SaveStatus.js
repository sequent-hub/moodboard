/**
 * Компонент индикатора статуса сохранения
 */
import { Events } from '../core/events/Events.js';

export class SaveStatus {
    constructor(container, eventBus, options = {}) {
        this.container = container;
        this.eventBus = eventBus;
        this.options = {
            // Фиксированные настройки UI (оптимальные для пользователя)
            showTimestamp: true,
            autoHide: true,
            hideDelay: 3000,
            position: 'bottom-left',
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
            'absolute'
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
            <div class="save-textline">
                <span class="save-text">Готов к работе</span>
                ${this.options.showTimestamp ? '<span class="save-time"></span>' : ''}
            </div>
        `;
    }
    
    /**
     * Настройка обработчиков событий
     */
    setupEventListeners() {
        // Статус сохранения
        this.eventBus.on(Events.Save.StatusChanged, (data) => {
            this.updateStatus(data);
        });
        
        // Успешное сохранение
        this.eventBus.on(Events.Save.Success, (data) => {
            this.showSuccess(data);
        });
        
        // Ошибка сохранения
        this.eventBus.on(Events.Save.Error, (data) => {
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
        
        switch (data.status) {
            case 'pending':
                this.applyStyle('pending');
                textEl.textContent = 'Изменения...';
                break;
                
            case 'saving':
                this.applyStyle('saving');
                textEl.textContent = 'Сохранение...';
                break;
                
            case 'saved':
                this.applyStyle('saved');
                textEl.textContent = 'Сохранено';
                this.scheduleAutoHide();
                break;
                
            case 'error':
                this.applyStyle('error');
                textEl.textContent = data.message || 'Ошибка сохранения';
                this.scheduleAutoHide(6000); // Ошибки показываем дольше
                break;
                
            default:
                this.applyStyle('idle');
                textEl.textContent = 'Готов к работе';
        }
        
        // Обновляем время
        if (timeEl && this.options.showTimestamp) {
            const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            timeEl.textContent = time;
        }
    }
    
    /**
     * Применение стилей для статуса
     */
    applyStyle(status) {
        // Плоский стиль без цветной подложки
        this.element.className = 'moodboard-save-status absolute';
        this.element.style.background = 'transparent';
        this.element.style.border = 'none';
        this.element.style.boxShadow = 'none';
        this.element.style.padding = '0';
        this.element.style.transform = 'none';
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
        
        this.eventBus.off(Events.Save.StatusChanged);
        this.eventBus.off(Events.Save.Success);
        this.eventBus.off(Events.Save.Error);
        
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}
