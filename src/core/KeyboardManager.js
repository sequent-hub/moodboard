/**
 * Менеджер клавиатуры для обработки горячих клавиш
 */
import { KeyboardClipboardImagePaste } from './keyboard/KeyboardClipboardImagePaste.js';
import { KeyboardEventRouter } from './keyboard/KeyboardEventRouter.js';
import { isInputElement, isTextEditorActive } from './keyboard/KeyboardContextGuards.js';
import { KeyboardSelectionActions } from './keyboard/KeyboardSelectionActions.js';
import { DEFAULT_KEYBOARD_SHORTCUTS } from './keyboard/KeyboardShortcutMap.js';
import { KeyboardToolSwitching } from './keyboard/KeyboardToolSwitching.js';
export class KeyboardManager {
    constructor(eventBus, targetElement = document, core = null) {
        this.eventBus = eventBus;
        this.targetElement = targetElement;
        this.core = core;
        this.shortcuts = new Map();
        this.isListening = false;
        this.handlePaste = null;
        this.selectionActions = new KeyboardSelectionActions(
            this.eventBus,
            () => this._isTextEditorActive()
        );
        this.toolSwitching = new KeyboardToolSwitching(this.eventBus);
        this.clipboardImagePaste = new KeyboardClipboardImagePaste(this.eventBus, this.core);
        this.eventRouter = new KeyboardEventRouter(
            this.eventBus,
            this.shortcuts,
            (element) => this.isInputElement(element)
        );
        
        // Привязываем контекст методов
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
    }

    /**
     * Обрабатывает загрузку изображения на сервер
     * @private
     */
    async _handleImageUpload(dataUrl, fileName) {
        return this.clipboardImagePaste.handleImageUpload(dataUrl, fileName);
    }

    /**
     * Обработка загрузки файла изображения (более эффективно чем DataURL)
     * @param {File} file - файл изображения 
     * @param {string} fileName - имя файла
     * @private
     */
    async _handleImageFileUpload(file, fileName) {
        return this.clipboardImagePaste.handleImageFileUpload(file, fileName);
    }
    
    /**
     * Начать прослушивание клавиатуры
     */
    startListening() {
        if (this.isListening) return;

        if (!this.handlePaste) {
            this.handlePaste = this.clipboardImagePaste.createPasteHandler();
        }
        
        this.targetElement.addEventListener('keydown', this.handleKeyDown);
        this.targetElement.addEventListener('keyup', this.handleKeyUp);
        this.targetElement.addEventListener('paste', this.handlePaste, { capture: true });
        this.isListening = true;
        
        // Регистрируем стандартные горячие клавиши
        this.registerDefaultShortcuts();
    }
    
    /**
     * Остановить прослушивание клавиатуры
     */
    stopListening() {
        if (!this.isListening) return;
        
        this.targetElement.removeEventListener('keydown', this.handleKeyDown);
        this.targetElement.removeEventListener('keyup', this.handleKeyUp);
        if (this.handlePaste) {
            this.targetElement.removeEventListener('paste', this.handlePaste, { capture: true });
            this.handlePaste = null;
        }
        this.isListening = false;
    }
    
    /**
     * Регистрация горячей клавиши
     * @param {string} combination - Комбинация клавиш (например: 'ctrl+a', 'delete', 'escape')
     * @param {Function} handler - Обработчик события
     * @param {Object} options - Дополнительные опции
     */
    registerShortcut(combination, handler, options = {}) {
        const normalizedCombo = this.normalizeShortcut(combination);
        
        if (!this.shortcuts.has(normalizedCombo)) {
            this.shortcuts.set(normalizedCombo, []);
        }
        
        this.shortcuts.get(normalizedCombo).push({
            handler,
            preventDefault: options.preventDefault !== false, // По умолчанию true
            stopPropagation: options.stopPropagation !== false, // По умолчанию true
            description: options.description || ''
        });
    }
    
    /**
     * Удаление горячей клавиши
     */
    unregisterShortcut(combination, handler = null) {
        const normalizedCombo = this.normalizeShortcut(combination);
        
        if (!this.shortcuts.has(normalizedCombo)) return;
        
        if (handler) {
            // Удаляем конкретный обработчик
            const handlers = this.shortcuts.get(normalizedCombo);
            const filtered = handlers.filter(item => item.handler !== handler);
            
            if (filtered.length === 0) {
                this.shortcuts.delete(normalizedCombo);
            } else {
                this.shortcuts.set(normalizedCombo, filtered);
            }
        } else {
            // Удаляем все обработчики для комбинации
            this.shortcuts.delete(normalizedCombo);
        }
    }
    
    /**
     * Обработка нажатия клавиши
     */
    handleKeyDown(event) {
        this.eventRouter.handleKeyDown(event);
    }
    
    /**
     * Обработка отпускания клавиши
     */
    handleKeyUp(event) {
        this.eventRouter.handleKeyUp(event);
    }
    
    /**
     * Нормализация комбинации клавиш
     */
    normalizeShortcut(combination) {
        return this.eventRouter.normalizeShortcut(combination);
    }
    
    /**
     * Преобразование события клавиатуры в строку комбинации
     */
    eventToShortcut(event, eventType = 'keydown') {
        return this.eventRouter.eventToShortcut(event, eventType);
    }
    
    /**
     * Проверка, является ли элемент полем ввода
     */
    isInputElement(element) {
        return isInputElement(element);
    }
    
    /**
     * Получить список всех зарегистрированных горячих клавиш
     */
    getShortcuts() {
        const result = [];
        
        for (const [combination, handlers] of this.shortcuts.entries()) {
            handlers.forEach(({ description }) => {
                result.push({
                    combination,
                    description
                });
            });
        }
        
        return result.sort((a, b) => a.combination.localeCompare(b.combination));
    }

    _createDefaultShortcutHandler(actionId) {
        return this.toolSwitching.createHandler(actionId)
            || this.selectionActions.createHandler(actionId)
            || (() => {});
    }
    
    /**
     * Регистрация стандартных горячих клавиш
     */
    registerDefaultShortcuts() {
        DEFAULT_KEYBOARD_SHORTCUTS.forEach(({ combination, actionId, description, preventDefault }) => {
            this.registerShortcut(
                combination,
                this._createDefaultShortcutHandler(actionId),
                { description, preventDefault }
            );
        });
    }

    /**
     * Проверяет, активен ли какой-либо текстовый редактор
     * @private
     */
    _isTextEditorActive() {
        return isTextEditorActive(document);
    }

    /**
     * Очистка ресурсов
     */
    destroy() {
        this.stopListening();
        this.shortcuts.clear();
    }
}
