/**
 * Менеджер клавиатуры для обработки горячих клавиш
 */
export class KeyboardManager {
    constructor(eventBus, targetElement = document) {
        this.eventBus = eventBus;
        this.targetElement = targetElement;
        this.shortcuts = new Map();
        this.isListening = false;
        
        // Привязываем контекст методов
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
    }
    
    /**
     * Начать прослушивание клавиатуры
     */
    startListening() {
        if (this.isListening) return;
        
        this.targetElement.addEventListener('keydown', this.handleKeyDown);
        this.targetElement.addEventListener('keyup', this.handleKeyUp);
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
        // Пропускаем события в полях ввода
        if (this.isInputElement(event.target)) {
            return;
        }
        
        const combination = this.eventToShortcut(event);
        const handlers = this.shortcuts.get(combination);
        
        if (handlers && handlers.length > 0) {
            // Выполняем все обработчики для данной комбинации
            handlers.forEach(({ handler, preventDefault, stopPropagation }) => {
                if (preventDefault) event.preventDefault();
                if (stopPropagation) event.stopPropagation();
                
                handler(event);
            });
        }
    }
    
    /**
     * Обработка отпускания клавиши
     */
    handleKeyUp(event) {
        // Можно использовать для отслеживания длительных нажатий
        const combination = this.eventToShortcut(event, 'keyup');
        
        // Эмитируем событие для инструментов
        this.eventBus.emit('keyboard:keyup', {
            key: event.key,
            code: event.code,
            combination,
            originalEvent: event
        });
    }
    
    /**
     * Нормализация комбинации клавиш
     */
    normalizeShortcut(combination) {
        return combination
            .toLowerCase()
            .split('+')
            .map(key => key.trim())
            .sort((a, b) => {
                // Сортируем модификаторы в определенном порядке
                const order = ['ctrl', 'alt', 'shift', 'meta'];
                const aIndex = order.indexOf(a);
                const bIndex = order.indexOf(b);
                
                if (aIndex !== -1 && bIndex !== -1) {
                    return aIndex - bIndex;
                }
                if (aIndex !== -1) return -1;
                if (bIndex !== -1) return 1;
                return a.localeCompare(b);
            })
            .join('+');
    }
    
    /**
     * Преобразование события клавиатуры в строку комбинации
     */
    eventToShortcut(event, eventType = 'keydown') {
        const parts = [];
        
        if (event.ctrlKey) parts.push('ctrl');
        if (event.altKey) parts.push('alt'); 
        if (event.shiftKey) parts.push('shift');
        if (event.metaKey) parts.push('meta');
        
        // Нормализуем ключ
        let key = event.key.toLowerCase();
        
        // Специальные клавиши
        const specialKeys = {
            ' ': 'space',
            'enter': 'enter',
            'escape': 'escape',
            'backspace': 'backspace',
            'delete': 'delete',
            'tab': 'tab',
            'arrowup': 'arrowup',
            'arrowdown': 'arrowdown',
            'arrowleft': 'arrowleft',
            'arrowright': 'arrowright'
        };
        
        if (specialKeys[key]) {
            key = specialKeys[key];
        }
        
        // Не добавляем модификаторы как основную клавишу
        if (!['control', 'alt', 'shift', 'meta'].includes(key)) {
            parts.push(key);
        }
        
        return parts.join('+');
    }
    
    /**
     * Проверка, является ли элемент полем ввода
     */
    isInputElement(element) {
        const inputTags = ['input', 'textarea', 'select'];
        const isInput = inputTags.includes(element.tagName.toLowerCase());
        const isContentEditable = element.contentEditable === 'true';
        
        return isInput || isContentEditable;
    }
    
    /**
     * Регистрация стандартных горячих клавиш для MoodBoard
     */
    registerDefaultShortcuts() {
        // Выделение всех объектов
        this.registerShortcut('ctrl+a', () => {
            this.eventBus.emit('keyboard:select-all');
        }, { description: 'Выделить все объекты' });
        
        // Удаление выделенных объектов
        this.registerShortcut('delete', () => {
            this.eventBus.emit('keyboard:delete');
        }, { description: 'Удалить выделенные объекты' });
        
        this.registerShortcut('backspace', () => {
            this.eventBus.emit('keyboard:delete');
        }, { description: 'Удалить выделенные объекты' });
        
        // Отмена выделения
        this.registerShortcut('escape', () => {
            this.eventBus.emit('keyboard:escape');
        }, { description: 'Отменить выделение' });
        
        // Копирование
        this.registerShortcut('ctrl+c', () => {
            this.eventBus.emit('keyboard:copy');
        }, { description: 'Копировать выделенные объекты' });
        
        // Вставка
        this.registerShortcut('ctrl+v', () => {
            this.eventBus.emit('keyboard:paste');
        }, { description: 'Вставить объекты' });
        
        // Отмена действия
        this.registerShortcut('ctrl+z', () => {
            this.eventBus.emit('keyboard:undo');
        }, { description: 'Отменить действие' });
        
        // Повтор действия
        this.registerShortcut('ctrl+y', () => {
            this.eventBus.emit('keyboard:redo');
        }, { description: 'Повторить действие' });
        
        this.registerShortcut('ctrl+shift+z', () => {
            this.eventBus.emit('keyboard:redo');
        }, { description: 'Повторить действие' });
        
        // Переключение инструментов
        this.registerShortcut('v', () => {
            this.eventBus.emit('keyboard:tool-select', { tool: 'select' });
        }, { description: 'Инструмент выделения' });
        
        this.registerShortcut('t', () => {
            this.eventBus.emit('keyboard:tool-select', { tool: 'text' });
        }, { description: 'Инструмент текста' });
        
        this.registerShortcut('r', () => {
            this.eventBus.emit('keyboard:tool-select', { tool: 'frame' });
        }, { description: 'Инструмент рамки' });
        
        // Перемещение объектов стрелками
        this.registerShortcut('arrowup', () => {
            this.eventBus.emit('keyboard:move', { direction: 'up', step: 1 });
        }, { description: 'Переместить объект вверх' });
        
        this.registerShortcut('arrowdown', () => {
            this.eventBus.emit('keyboard:move', { direction: 'down', step: 1 });
        }, { description: 'Переместить объект вниз' });
        
        this.registerShortcut('arrowleft', () => {
            this.eventBus.emit('keyboard:move', { direction: 'left', step: 1 });
        }, { description: 'Переместить объект влево' });
        
        this.registerShortcut('arrowright', () => {
            this.eventBus.emit('keyboard:move', { direction: 'right', step: 1 });
        }, { description: 'Переместить объект вправо' });
        
        // Перемещение с шагом 10px при зажатом Shift
        this.registerShortcut('shift+arrowup', () => {
            this.eventBus.emit('keyboard:move', { direction: 'up', step: 10 });
        }, { description: 'Переместить объект вверх на 10px' });
        
        this.registerShortcut('shift+arrowdown', () => {
            this.eventBus.emit('keyboard:move', { direction: 'down', step: 10 });
        }, { description: 'Переместить объект вниз на 10px' });
        
        this.registerShortcut('shift+arrowleft', () => {
            this.eventBus.emit('keyboard:move', { direction: 'left', step: 10 });
        }, { description: 'Переместить объект влево на 10px' });
        
        this.registerShortcut('shift+arrowright', () => {
            this.eventBus.emit('keyboard:move', { direction: 'right', step: 10 });
        }, { description: 'Переместить объект вправо на 10px' });
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
    
    /**
     * Регистрация стандартных горячих клавиш
     */
    registerDefaultShortcuts() {
        // Undo/Redo (латиница и кириллица)
        this.registerShortcut('ctrl+z', () => {
            this.eventBus.emit('keyboard:undo');
        }, { description: 'Отменить действие', preventDefault: true });
        
        this.registerShortcut('ctrl+я', () => { // русская 'я' на той же клавише что и 'z'
            this.eventBus.emit('keyboard:undo');
        }, { description: 'Отменить действие (рус)', preventDefault: true });
        
        this.registerShortcut('ctrl+shift+z', () => {
            this.eventBus.emit('keyboard:redo');
        }, { description: 'Повторить действие', preventDefault: true });
        
        this.registerShortcut('ctrl+shift+я', () => {
            this.eventBus.emit('keyboard:redo');
        }, { description: 'Повторить действие (рус)', preventDefault: true });
        
        this.registerShortcut('ctrl+y', () => {
            this.eventBus.emit('keyboard:redo');
        }, { description: 'Повторить действие (альтернативный)', preventDefault: true });
        
        this.registerShortcut('ctrl+н', () => { // русская 'н' на той же клавише что и 'y'
            this.eventBus.emit('keyboard:redo');
        }, { description: 'Повторить действие (рус альт)', preventDefault: true });
        
        // Выделение (латиница и кириллица)
        this.registerShortcut('ctrl+a', () => {
            this.eventBus.emit('keyboard:select-all');
        }, { description: 'Выделить все', preventDefault: true });
        
        this.registerShortcut('ctrl+ф', () => { // русская 'ф' на той же клавише что и 'a'
            this.eventBus.emit('keyboard:select-all');
        }, { description: 'Выделить все (рус)', preventDefault: true });
        
        // Копирование/Вставка (латиница и кириллица)
        this.registerShortcut('ctrl+c', () => {
            this.eventBus.emit('keyboard:copy');
        }, { description: 'Копировать', preventDefault: true });
        
        this.registerShortcut('ctrl+с', () => { // русская 'с' на той же клавише что и 'c'
            this.eventBus.emit('keyboard:copy');
        }, { description: 'Копировать (рус)', preventDefault: true });
        
        this.registerShortcut('ctrl+v', () => {
            this.eventBus.emit('keyboard:paste');
        }, { description: 'Вставить', preventDefault: true });
        
        this.registerShortcut('ctrl+м', () => { // русская 'м' на той же клавише что и 'v'
            this.eventBus.emit('keyboard:paste');
        }, { description: 'Вставить (рус)', preventDefault: true });

        // Слойность (латиница и русская раскладка)
        this.registerShortcut(']', () => {
            const data = { selection: [] };
            this.eventBus.emit('tool:get:selection', data);
            const id = data.selection?.[0];
            if (id) this.eventBus.emit('ui:layer:bring-to-front', { objectId: id });
        }, { description: 'На передний план', preventDefault: true });
        this.registerShortcut('ctrl+]', () => {
            const data = { selection: [] };
            this.eventBus.emit('tool:get:selection', data);
            const id = data.selection?.[0];
            if (id) this.eventBus.emit('ui:layer:bring-forward', { objectId: id });
        }, { description: 'Перенести вперёд', preventDefault: true });
        this.registerShortcut('[', () => {
            const data = { selection: [] };
            this.eventBus.emit('tool:get:selection', data);
            const id = data.selection?.[0];
            if (id) this.eventBus.emit('ui:layer:send-to-back', { objectId: id });
        }, { description: 'На задний план', preventDefault: true });
        this.registerShortcut('ctrl+[', () => {
            const data = { selection: [] };
            this.eventBus.emit('tool:get:selection', data);
            const id = data.selection?.[0];
            if (id) this.eventBus.emit('ui:layer:send-backward', { objectId: id });
        }, { description: 'Перенести назад', preventDefault: true });
        
        // Удаление
        this.registerShortcut('delete', () => {
            this.eventBus.emit('keyboard:delete');
        }, { description: 'Удалить объект', preventDefault: true });
        
        this.registerShortcut('backspace', () => {
            this.eventBus.emit('keyboard:delete');
        }, { description: 'Удалить объект', preventDefault: true });
        
        // Отмена выделения
        this.registerShortcut('escape', () => {
            this.eventBus.emit('keyboard:escape');
        }, { description: 'Отменить выделение', preventDefault: true });
        
        // Инструменты (латиница и кириллица)
        this.registerShortcut('v', () => {
            this.eventBus.emit('keyboard:tool-select', { tool: 'select' });
        }, { description: 'Выбрать инструмент выделения' });
        
        this.registerShortcut('м', () => { // русская 'м' на той же клавише что и 'v'
            this.eventBus.emit('keyboard:tool-select', { tool: 'select' });
        }, { description: 'Выбрать инструмент выделения (рус)' });
        
        this.registerShortcut('t', () => {
            this.eventBus.emit('keyboard:tool-select', { tool: 'text' });
        }, { description: 'Выбрать инструмент текста' });
        
        this.registerShortcut('е', () => { // русская 'е' на той же клавише что и 't'
            this.eventBus.emit('keyboard:tool-select', { tool: 'text' });
        }, { description: 'Выбрать инструмент текста (рус)' });
        
        this.registerShortcut('r', () => {
            this.eventBus.emit('keyboard:tool-select', { tool: 'frame' });
        }, { description: 'Выбрать инструмент рамки' });
        
        this.registerShortcut('к', () => { // русская 'к' на той же клавише что и 'r'
            this.eventBus.emit('keyboard:tool-select', { tool: 'frame' });
        }, { description: 'Выбрать инструмент рамки (рус)' });
        
        // Перемещение стрелками
        this.registerShortcut('arrowup', (event) => {
            this.eventBus.emit('keyboard:move', { 
                direction: 'up', 
                step: event.shiftKey ? 10 : 1 
            });
        }, { description: 'Переместить вверх', preventDefault: true });
        
        this.registerShortcut('arrowdown', (event) => {
            this.eventBus.emit('keyboard:move', { 
                direction: 'down', 
                step: event.shiftKey ? 10 : 1 
            });
        }, { description: 'Переместить вниз', preventDefault: true });
        
        this.registerShortcut('arrowleft', (event) => {
            this.eventBus.emit('keyboard:move', { 
                direction: 'left', 
                step: event.shiftKey ? 10 : 1 
            });
        }, { description: 'Переместить влево', preventDefault: true });
        
        this.registerShortcut('arrowright', (event) => {
            this.eventBus.emit('keyboard:move', { 
                direction: 'right', 
                step: event.shiftKey ? 10 : 1 
            });
        }, { description: 'Переместить вправо', preventDefault: true });


    }

    /**
     * Очистка ресурсов
     */
    destroy() {
        this.stopListening();
        this.shortcuts.clear();
    }
}
