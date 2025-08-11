import { BaseTool } from '../BaseTool.js';

/**
 * Инструмент для создания и редактирования текстовых объектов
 */
export class TextTool extends BaseTool {
    constructor(eventBus) {
        super('text', eventBus);
        this.cursor = 'text';
        this.hotkey = 't';
        
        // Состояние редактирования
        this.isEditing = false;
        this.editingObject = null;
        this.textInput = null;
        
        // Настройки текста по умолчанию
        this.defaultTextSettings = {
            fontSize: 16,
            fontFamily: 'Arial, sans-serif',
            color: '#000000',
            textAlign: 'left',
            fontWeight: 'normal',
            fontStyle: 'normal'
        };
    }
    
    /**
     * Клик для создания нового текста или редактирования существующего
     */
    onMouseDown(event) {
        super.onMouseDown(event);
        
        // Проверяем, кликнули ли на существующий текстовый объект
        const hitObject = this.getTextObjectAt(event.x, event.y);
        
        if (hitObject) {
            this.startEditing(hitObject, event);
        } else {
            this.createNewText(event.x, event.y);
        }
    }
    
    /**
     * Двойной клик для быстрого входа в режим редактирования
     */
    onDoubleClick(event) {
        const hitObject = this.getTextObjectAt(event.x, event.y);
        
        if (hitObject) {
            this.startEditing(hitObject, event);
        }
    }
    
    /**
     * Обработка клавиш во время редактирования
     */
    onKeyDown(event) {
        if (this.isEditing) {
            this.handleEditingKeys(event);
        }
    }
    
    /**
     * Создание нового текстового объекта
     */
    createNewText(x, y) {
        const textData = {
            type: 'text',
            position: { x, y },
            content: '',
            settings: { ...this.defaultTextSettings }
        };
        
        // Создаем объект через событие
        this.emit('object:create', textData);
        
        // Сразу переходим в режим редактирования
        this.startEditingNew(textData, x, y);
    }
    
    /**
     * Начало редактирования нового текста
     */
    startEditingNew(textData, x, y) {
        this.isEditing = true;
        this.editingObject = textData;
        
        this.createTextInput(x, y, '');
        this.emit('text:edit:start', { object: textData });
    }
    
    /**
     * Начало редактирования существующего текста
     */
    startEditing(textObject, event) {
        if (this.isEditing) {
            this.finishEditing();
        }
        
        this.isEditing = true;
        this.editingObject = textObject;
        
        // Создаем input с текущим содержимым
        this.createTextInput(
            textObject.position.x, 
            textObject.position.y, 
            textObject.content || ''
        );
        
        this.emit('text:edit:start', { object: textObject });
    }
    
    /**
     * Создание HTML input для редактирования текста
     */
    createTextInput(x, y, initialText) {
        // Удаляем предыдущий input если есть
        this.removeTextInput();
        
        // Создаем новый input
        this.textInput = document.createElement('textarea');
        this.textInput.value = initialText;
        this.textInput.className = 'moodboard-text-input';
        
        // Стили input
        Object.assign(this.textInput.style, {
            position: 'absolute',
            left: `${x}px`,
            top: `${y}px`,
            border: '2px solid #007bff',
            borderRadius: '4px',
            padding: '4px 8px',
            fontSize: `${this.defaultTextSettings.fontSize}px`,
            fontFamily: this.defaultTextSettings.fontFamily,
            color: this.defaultTextSettings.color,
            background: 'white',
            outline: 'none',
            resize: 'none',
            minWidth: '100px',
            minHeight: '24px',
            zIndex: '1000'
        });
        
        // Обработчики событий input
        this.textInput.addEventListener('blur', () => this.finishEditing());
        this.textInput.addEventListener('keydown', (e) => this.handleInputKeys(e));
        this.textInput.addEventListener('input', (e) => this.handleTextChange(e));
        
        // Добавляем в контейнер
        this.getContainer().appendChild(this.textInput);
        
        // Фокусируемся и выделяем весь текст
        this.textInput.focus();
        if (initialText) {
            this.textInput.select();
        }
        
        // Автоматически подгоняем размер
        this.adjustInputSize();
    }
    
    /**
     * Обработка клавиш в input
     */
    handleInputKeys(event) {
        switch (event.key) {
            case 'Enter':
                if (!event.shiftKey) {
                    // Enter без Shift - завершаем редактирование
                    this.finishEditing();
                    event.preventDefault();
                } else {
                    // Shift+Enter - новая строка
                    setTimeout(() => this.adjustInputSize(), 0);
                }
                break;
                
            case 'Escape':
                this.cancelEditing();
                event.preventDefault();
                break;
                
            case 'Tab':
                this.finishEditing();
                event.preventDefault();
                break;
        }
    }
    
    /**
     * Обработка изменения текста
     */
    handleTextChange(event) {
        this.adjustInputSize();
        
        // Обновляем объект в реальном времени
        if (this.editingObject) {
            this.editingObject.content = this.textInput.value;
            this.emit('text:content:change', {
                object: this.editingObject,
                content: this.textInput.value
            });
        }
    }
    
    /**
     * Автоматическая подгонка размера input
     */
    adjustInputSize() {
        if (!this.textInput) return;
        
        // Временно делаем input очень маленьким
        this.textInput.style.width = '1px';
        this.textInput.style.height = '1px';
        
        // Получаем реальные размеры контента
        const scrollWidth = Math.max(this.textInput.scrollWidth, 100);
        const scrollHeight = Math.max(this.textInput.scrollHeight, 24);
        
        // Устанавливаем новые размеры
        this.textInput.style.width = `${scrollWidth + 10}px`;
        this.textInput.style.height = `${scrollHeight}px`;
    }
    
    /**
     * Завершение редактирования (сохранение)
     */
    finishEditing() {
        if (!this.isEditing || !this.textInput) return;
        
        const finalText = this.textInput.value.trim();
        
        if (finalText) {
            // Сохраняем текст
            if (this.editingObject) {
                this.editingObject.content = finalText;
                this.emit('text:edit:finish', {
                    object: this.editingObject,
                    content: finalText
                });
            }
        } else {
            // Пустой текст - удаляем объект
            if (this.editingObject) {
                this.emit('object:delete', { object: this.editingObject });
            }
        }
        
        this.cleanupEditing();
    }
    
    /**
     * Отмена редактирования
     */
    cancelEditing() {
        if (!this.isEditing) return;
        
        // Если это был новый объект с пустым текстом, удаляем его
        if (this.editingObject && !this.editingObject.content) {
            this.emit('object:delete', { object: this.editingObject });
        }
        
        this.emit('text:edit:cancel', { object: this.editingObject });
        this.cleanupEditing();
    }
    
    /**
     * Очистка после редактирования
     */
    cleanupEditing() {
        this.removeTextInput();
        this.isEditing = false;
        this.editingObject = null;
    }
    
    /**
     * Удаление HTML input
     */
    removeTextInput() {
        if (this.textInput) {
            this.textInput.remove();
            this.textInput = null;
        }
    }
    
    /**
     * Получение контейнера для размещения input
     */
    getContainer() {
        // TODO: Получить контейнер MoodBoard
        return document.body; // Временная заглушка
    }
    
    /**
     * Поиск текстового объекта в указанной позиции
     */
    getTextObjectAt(x, y) {
        // TODO: Реализовать поиск текстового объекта по координатам
        return null; // Временная заглушка
    }
    
    /**
     * Обработка клавиш во время редактирования (глобальные)
     */
    handleEditingKeys(event) {
        // Форматирование текста горячими клавишами
        if (event.ctrlKey || event.metaKey) {
            switch (event.key) {
                case 'b':
                    this.toggleBold();
                    event.originalEvent.preventDefault();
                    break;
                case 'i':
                    this.toggleItalic();
                    event.originalEvent.preventDefault();
                    break;
            }
        }
    }
    
    /**
     * Переключение жирного шрифта
     */
    toggleBold() {
        if (this.editingObject) {
            const currentWeight = this.editingObject.settings.fontWeight;
            this.editingObject.settings.fontWeight = 
                currentWeight === 'bold' ? 'normal' : 'bold';
            
            this.updateInputStyle();
            this.emit('text:format:change', { 
                object: this.editingObject,
                property: 'fontWeight',
                value: this.editingObject.settings.fontWeight
            });
        }
    }
    
    /**
     * Переключение курсива
     */
    toggleItalic() {
        if (this.editingObject) {
            const currentStyle = this.editingObject.settings.fontStyle;
            this.editingObject.settings.fontStyle = 
                currentStyle === 'italic' ? 'normal' : 'italic';
            
            this.updateInputStyle();
            this.emit('text:format:change', { 
                object: this.editingObject,
                property: 'fontStyle',
                value: this.editingObject.settings.fontStyle
            });
        }
    }
    
    /**
     * Обновление стилей input в соответствии с настройками объекта
     */
    updateInputStyle() {
        if (!this.textInput || !this.editingObject) return;
        
        const settings = this.editingObject.settings;
        Object.assign(this.textInput.style, {
            fontSize: `${settings.fontSize}px`,
            fontFamily: settings.fontFamily,
            fontWeight: settings.fontWeight,
            fontStyle: settings.fontStyle,
            color: settings.color,
            textAlign: settings.textAlign
        });
    }
    
    /**
     * Деактивация инструмента
     */
    onDeactivate() {
        if (this.isEditing) {
            this.finishEditing();
        }
    }
    
    /**
     * Установка настроек текста по умолчанию
     */
    setDefaultTextSettings(settings) {
        this.defaultTextSettings = { ...this.defaultTextSettings, ...settings };
    }
    
    /**
     * Получение настроек текста по умолчанию
     */
    getDefaultTextSettings() {
        return { ...this.defaultTextSettings };
    }
}
