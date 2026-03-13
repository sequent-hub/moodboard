/**
 * Панель инструментов для MoodBoard
 */
import { Events } from '../core/events/Events.js';
import { IconLoader } from '../utils/iconLoader.js';
import { ToolbarDialogsController } from './toolbar/ToolbarDialogsController.js';
import { ToolbarPopupsController } from './toolbar/ToolbarPopupsController.js';
import { ToolbarActionRouter } from './toolbar/ToolbarActionRouter.js';
import { ToolbarTooltipController } from './toolbar/ToolbarTooltipController.js';
import { ToolbarStateController } from './toolbar/ToolbarStateController.js';
import { ToolbarRenderer } from './toolbar/ToolbarRenderer.js';

export class Toolbar {
    constructor(container, eventBus, theme = 'light', options = {}) {
        this.container = container;
        this.eventBus = eventBus;
        this.theme = theme;
        
        // Базовый путь для ассетов (эмоджи и другие ресурсы)
        this.emojiBasePath = options.emojiBasePath || null;
        
        // Инициализируем IconLoader
        this.iconLoader = new IconLoader();
        
        // Кэш для SVG иконок
        this.icons = {};

        this.dialogsController = new ToolbarDialogsController(this);
        this.popupsController = new ToolbarPopupsController(this);
        this.actionRouter = new ToolbarActionRouter(this);
        this.tooltipController = new ToolbarTooltipController(this);
        this.stateController = new ToolbarStateController(this);
        this.renderer = new ToolbarRenderer(this);
        
        this.init();
    }

    /**
     * Инициализация тулбара
     */
    async init() {
        try {
            await this.iconLoader.init();
            this.icons = await this.iconLoader.loadAllIcons();
        } catch (error) {
            console.error('❌ Ошибка загрузки иконок:', error);
        }

        this._toolActivatedHandler = ({ tool }) => {
            this.setActiveToolbarButton(tool);
            // Draw palette must stay open only while draw tool is active.
            if (tool !== 'draw') {
                this.closeDrawPopup();
            }
        };
        this.createToolbar();
        this.attachEvents();
        this.setupHistoryEvents();
    }
    
    /**
     * Создает HTML структуру тулбара
     */
    createToolbar() {
        return this.renderer.createToolbar();
    }

    createFramePopup() {
        return this.popupsController.createFramePopup();
    }

    toggleFramePopup(anchorBtn) {
        return this.popupsController.toggleFramePopup(anchorBtn);
    }

    closeFramePopup() {
        return this.popupsController.closeFramePopup();
    }
    
    /**
     * Создает кнопку инструмента
     */
    createButton(tool) {
        return this.renderer.createButton(tool);
    }

    /**
     * Создает SVG иконку для кнопки
     */
    createSvgIcon(button, iconName) {
        return this.renderer.createSvgIcon(button, iconName);
    }
    
    /**
     * Создает tooltip для кнопки
     */
    createTooltip(button, text) {
        return this.tooltipController.createTooltip(button, text);
    }
    
    /**
     * Показывает tooltip
     */
    showTooltip(tooltip, button) {
        return this.tooltipController.showTooltip(tooltip, button);
    }
    
    /**
     * Скрывает tooltip
     */
    hideTooltip(tooltip) {
        return this.tooltipController.hideTooltip(tooltip);
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

            this.actionRouter.routeToolbarAction(button, toolType, toolId);
        });

        // Клик вне попапов — закрыть (сохраняем handler для корректного removeEventListener)
        this._documentClickHandler = (e) => {
            if (!e.target) return;

            const isInsideToolbar = this.element && this.element.contains(e.target);
            const isInsideShapesPopup = this.shapesPopupEl && this.shapesPopupEl.contains(e.target);
            const isInsideDrawPopup = this.drawPopupEl && this.drawPopupEl.contains(e.target);
            const isInsideEmojiPopup = this.emojiPopupEl && this.emojiPopupEl.contains(e.target);
            const isInsideFramePopup = this.framePopupEl && this.framePopupEl.contains(e.target);
            const isShapesButton = e.target.closest && e.target.closest('.moodboard-toolbar__button--shapes');
            const isDrawButton = e.target.closest && e.target.closest('.moodboard-toolbar__button--pencil');
            const isEmojiButton = e.target.closest && e.target.closest('.moodboard-toolbar__button--emoji');
            const isFrameButton = e.target.closest && e.target.closest('.moodboard-toolbar__button--frame');
            const isDrawActive = !!(this.element && this.element.querySelector('.moodboard-toolbar__button--pencil.moodboard-toolbar__button--active'));

            if (!isInsideToolbar && !isInsideShapesPopup && !isShapesButton && !isInsideDrawPopup && !isDrawButton && !isInsideEmojiPopup && !isEmojiButton && !isInsideFramePopup && !isFrameButton) {
                this.closeShapesPopup();
                if (!isDrawActive) {
                    this.closeDrawPopup();
                }
                this.closeEmojiPopup();
                this.closeFramePopup();
            }
        };
        document.addEventListener('click', this._documentClickHandler);
    }

    /**
     * Подсвечивает активную кнопку на тулбаре в зависимости от активного инструмента
     */
    setActiveToolbarButton(toolName) {
        return this.stateController.setActiveToolbarButton(toolName);
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
        return this.popupsController.createShapesPopup();
    }

    toggleShapesPopup(anchorButton) {
        return this.popupsController.toggleShapesPopup(anchorButton);
    }

    openShapesPopup(anchorButton) {
        return this.popupsController.openShapesPopup(anchorButton);
    }

    closeShapesPopup() {
        return this.popupsController.closeShapesPopup();
    }

    /**
     * Всплывающая панель рисования (UI)
     */
    createDrawPopup() {
        return this.popupsController.createDrawPopup();
    }

    toggleDrawPopup(anchorButton) {
        return this.popupsController.toggleDrawPopup(anchorButton);
    }

    openDrawPopup(anchorButton) {
        return this.popupsController.openDrawPopup(anchorButton);
    }

    closeDrawPopup() {
        return this.popupsController.closeDrawPopup();
    }

    /**
     * Всплывающая панель эмоджи (UI)
     */
    createEmojiPopup() {
        return this.popupsController.createEmojiPopup();
    }

    /**
     * Возвращает fallback группы эмоджи для работы без bundler
     */
    getFallbackEmojiGroups() {
        return this.popupsController.getFallbackEmojiGroups();
    }

    /**
     * Определяет базовый путь для эмоджи в зависимости от режима
     */
    getEmojiBasePath() {
        return this.popupsController.getEmojiBasePath();
    }

    toggleEmojiPopup(anchorButton) {
        return this.popupsController.toggleEmojiPopup(anchorButton);
    }

    openEmojiPopup(anchorButton) {
        return this.popupsController.openEmojiPopup(anchorButton);
    }

    closeEmojiPopup() {
        return this.popupsController.closeEmojiPopup();
    }

    /**
     * Показывает диалог подтверждения очистки холста
     */
    showClearConfirmation() {
        // Проверяем, есть ли объекты на холсте для очистки
        let hasObjects = false;
        const checkData = { objects: [] };
        this.eventBus.emit(Events.Tool.GetAllObjects, checkData);
        hasObjects = checkData.objects && checkData.objects.length > 0;

        if (!hasObjects) {
            // Если холст уже пуст, показываем уведомление
            alert('Холст уже пуст');
            return;
        }

        // Показываем диалог подтверждения
        const confirmed = confirm(
            'Вы уверены, что хотите очистить холст?\n\n' +
            'Это действие удалит все объекты с холста и не может быть отменено.'
        );

        if (confirmed) {
            // Пользователь подтвердил - выполняем очистку
            this.eventBus.emit(Events.UI.ToolbarAction, {
                type: 'clear',
                id: 'clear'
            });
        }
        // Если не подтвердил - ничего не делаем
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
        return this.stateController.setupHistoryEvents();
    }

    /**
     * Открывает диалог выбора файла и запускает режим "призрака"
     */
    async openFileDialog() {
        return this.dialogsController.openFileDialog();
    }

    /**
     * Открывает диалог выбора изображения и запускает режим "призрака"
     */
    async openImageDialog() {
        return this.dialogsController.openImageDialog();
    }

    /**
     * Открывает диалог выбора изображения для ImageObject2 (новая изолированная цепочка)
     */
    async openImageObject2Dialog() {
        return this.dialogsController.openImageObject2Dialog();
    }
    
    /**
     * Обновление состояния кнопок undo/redo
     */
    updateHistoryButtons(canUndo, canRedo) {
        return this.stateController.updateHistoryButtons(canUndo, canRedo);
    }

    /**
     * Очистка ресурсов
     */
    destroy() {
        // Удаляем document-level listener (предотвращение утечки памяти)
        if (this._documentClickHandler) {
            document.removeEventListener('click', this._documentClickHandler);
            this._documentClickHandler = null;
        }

        // Отписываемся от Events.Tool.Activated (подписка в ToolbarRenderer)
        if (this._toolActivatedHandler) {
            this.eventBus.off(Events.Tool.Activated, this._toolActivatedHandler);
            this._toolActivatedHandler = null;
        }

        if (this.element) {
            const buttons = this.element.querySelectorAll('.moodboard-toolbar__button');
            buttons.forEach((button) => {
                if (button._tooltip) {
                    button._tooltip.remove();
                    button._tooltip = null;
                }
            });

            this.element.remove();
            this.element = null;
        }

        this.eventBus.removeAllListeners(Events.UI.UpdateHistoryButtons);
    }

    /**
     * Принудительно обновляет иконку (для отладки)
     * @param {string} iconName - имя иконки
     */
    async reloadToolbarIcon(iconName) {
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
            } else {
            }
        } catch (error) {
            console.error(`❌ Ошибка обновления иконки ${iconName}:`, error);
        }
    }
}
