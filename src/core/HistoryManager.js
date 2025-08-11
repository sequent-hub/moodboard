/**
 * Управляет историей команд для функции Undo/Redo
 */
export class HistoryManager {
    constructor(eventBus, options = {}) {
        this.eventBus = eventBus;
        this.options = {
            maxHistorySize: 50, // Максимальное количество команд в истории
            mergeTimeout: 1000, // Время в мс для объединения похожих команд
            ...options
        };

        // История выполненных команд
        this.history = [];
        // Текущая позиция в истории
        this.currentIndex = -1;
        // Флаг для предотвращения зацикливания при undo/redo
        this.isExecutingCommand = false;

        this.initEventListeners();
    }

    initEventListeners() {
        // Слушаем события клавиатуры
        this.eventBus.on('keyboard:undo', () => {
            this.undo();
        });

        this.eventBus.on('keyboard:redo', () => {
            this.redo();
        });

        // Для отладки
        this.eventBus.on('history:debug', () => {
            this.debugHistory();
        });
    }

    /**
     * Выполнить команду и добавить в историю
     */
    executeCommand(command) {
        if (this.isExecutingCommand) {
            // Если мы в процессе undo/redo, не добавляем в историю
            command.execute();
            return;
        }

        console.log('📝 Выполняем команду:', command.toString());

        // Проверяем, можно ли объединить с последней командой
        const lastCommand = this.getLastCommand();
        if (lastCommand && 
            lastCommand.canMergeWith(command) && 
            (command.timestamp - lastCommand.timestamp) < this.options.mergeTimeout) {
            
            console.log('🔗 Объединяем команды:', lastCommand.type, '+', command.type);
            lastCommand.mergeWith(command);
            this.eventBus.emit('history:changed', {
                canUndo: this.canUndo(),
                canRedo: this.canRedo(),
                historySize: this.history.length
            });
            return;
        }

        // Выполняем команду
        command.execute();

        // Удаляем все команды после текущей позиции (если есть)
        if (this.currentIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.currentIndex + 1);
        }

        // Добавляем новую команду
        this.history.push(command);
        this.currentIndex++;

        // Ограничиваем размер истории
        if (this.history.length > this.options.maxHistorySize) {
            this.history.shift();
            this.currentIndex--;
        }

        // Уведомляем об изменении истории
        this.eventBus.emit('history:changed', {
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            historySize: this.history.length,
            currentCommand: command.toString()
        });

        console.log(`📚 История: ${this.currentIndex + 1}/${this.history.length} команд`);
    }

    /**
     * Отменить последнюю команду
     */
    undo() {
        if (!this.canUndo()) {
            console.log('❌ Нечего отменять');
            return false;
        }

        const command = this.history[this.currentIndex];
        console.log('↶ Отменяем команду:', command.toString());

        this.isExecutingCommand = true;
        try {
            command.undo();
            this.currentIndex--;
            
            this.eventBus.emit('history:changed', {
                canUndo: this.canUndo(),
                canRedo: this.canRedo(),
                historySize: this.history.length,
                lastUndone: command.toString()
            });

            console.log(`📚 История после undo: ${this.currentIndex + 1}/${this.history.length} команд`);
            return true;
        } catch (error) {
            console.error('❌ Ошибка при отмене команды:', error);
            return false;
        } finally {
            this.isExecutingCommand = false;
        }
    }

    /**
     * Повторить отмененную команду
     */
    redo() {
        if (!this.canRedo()) {
            console.log('❌ Нечего повторять');
            return false;
        }

        this.currentIndex++;
        const command = this.history[this.currentIndex];
        console.log('↷ Повторяем команду:', command.toString());

        this.isExecutingCommand = true;
        try {
            command.execute();
            
            this.eventBus.emit('history:changed', {
                canUndo: this.canUndo(),
                canRedo: this.canRedo(),
                historySize: this.history.length,
                lastRedone: command.toString()
            });

            console.log(`📚 История после redo: ${this.currentIndex + 1}/${this.history.length} команд`);
            return true;
        } catch (error) {
            console.error('❌ Ошибка при повторе команды:', error);
            this.currentIndex--; // Откатываем индекс при ошибке
            return false;
        } finally {
            this.isExecutingCommand = false;
        }
    }

    /**
     * Можно ли отменить команду
     */
    canUndo() {
        return this.currentIndex >= 0;
    }

    /**
     * Можно ли повторить команду
     */
    canRedo() {
        return this.currentIndex < this.history.length - 1;
    }

    /**
     * Получить последнюю команду
     */
    getLastCommand() {
        if (this.history.length === 0) return null;
        return this.history[this.history.length - 1];
    }

    /**
     * Очистить историю
     */
    clear() {
        this.history = [];
        this.currentIndex = -1;
        
        this.eventBus.emit('history:changed', {
            canUndo: false,
            canRedo: false,
            historySize: 0
        });

        console.log('🗑️ История команд очищена');
    }

    /**
     * Получить информацию об истории (для отладки)
     */
    getHistoryInfo() {
        return {
            totalCommands: this.history.length,
            currentIndex: this.currentIndex,
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            commands: this.history.map((cmd, index) => ({
                index,
                isCurrent: index === this.currentIndex,
                command: cmd.toString()
            }))
        };
    }

    /**
     * Вывести историю в консоль (для отладки)
     */
    debugHistory() {
        console.log('📚 История команд:');
        console.table(this.getHistoryInfo().commands);
        console.log(`Текущая позиция: ${this.currentIndex + 1}/${this.history.length}`);
        console.log(`Можно отменить: ${this.canUndo()}, Можно повторить: ${this.canRedo()}`);
    }

    /**
     * Уничтожить менеджер истории
     */
    destroy() {
        this.clear();
        this.eventBus.removeAllListeners('keyboard:undo');
        this.eventBus.removeAllListeners('keyboard:redo');
        this.eventBus.removeAllListeners('history:debug');
    }
}
