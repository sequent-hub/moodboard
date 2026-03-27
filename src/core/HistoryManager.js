/**
 * Управляет историей команд для функции Undo/Redo
 */
import { Events } from './events/Events.js';
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
        this._listenersAttached = false;
        this._onDebug = () => this.debugHistory();

        this.initEventListeners();
    }

    initEventListeners() {
        if (this._listenersAttached) return;
        this._listenersAttached = true;
        // Для отладки
        this.eventBus.on(Events.History.Debug, this._onDebug);
    }

    /**
     * Выполнить команду и добавить в историю
     */
    executeCommand(command) {
        if (this.isExecutingCommand) {
            // Если мы в процессе undo/redo, не добавляем в историю
            this._executeCommandSafely(command);
            return;
        }



        // Проверяем, можно ли объединить с последней командой
        const lastCommand = this.getLastCommand();
        if (lastCommand &&
            lastCommand.canMergeWith(command) &&
            (command.timestamp - lastCommand.timestamp) < this.options.mergeTimeout) {

            lastCommand.mergeWith(command);
            this._executeCommandSafely(lastCommand);
            this.eventBus.emit('history:changed', {
                canUndo: this.canUndo(),
                canRedo: this.canRedo(),
                historySize: this.history.length
            });
            return;
        }

        // Выполняем команду
        this._executeCommandSafely(command);

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
        this.eventBus.emit(Events.History.Changed, {
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            historySize: this.history.length,
            currentCommand: command.toString()
        });


    }

    /**
     * Безопасно выполняет команду (поддерживает синхронные и асинхронные команды)
     * @private
     */
    _executeCommandSafely(command) {
        try {
            const result = command.execute();
            // Если команда возвращает Promise, обрабатываем асинхронно
            if (result && typeof result.then === 'function') {
                result.catch(error => {
                    console.error('Ошибка выполнения асинхронной команды:', error);
                });
            }
        } catch (error) {
            console.error('Ошибка выполнения команды:', error);
        }
    }

    /**
     * Отменить последнюю команду
     */
    undo() {
        if (!this.canUndo()) {

            return false;
        }

        const command = this.history[this.currentIndex];


        this.isExecutingCommand = true;
        try {
            command.undo();
            this.currentIndex--;
            
            this.eventBus.emit(Events.History.Changed, {
                canUndo: this.canUndo(),
                canRedo: this.canRedo(),
                historySize: this.history.length,
                lastUndone: command.toString()
            });


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

            return false;
        }

        this.currentIndex++;
        const command = this.history[this.currentIndex];


        this.isExecutingCommand = true;
        try {
            this._executeCommandSafely(command);
            
            this.eventBus.emit(Events.History.Changed, {
                canUndo: this.canUndo(),
                canRedo: this.canRedo(),
                historySize: this.history.length,
                lastRedone: command.toString()
            });


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
        
        this.eventBus.emit(Events.History.Changed, {
            canUndo: false,
            canRedo: false,
            historySize: 0
        });


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
        // Отладочная информация об истории команд
        const info = this.getHistoryInfo();
        console.group('📚 История команд');
        console.table(info.commands);
        console.log(`Позиция: ${this.currentIndex + 1}/${this.history.length}`);
        console.log(`Undo: ${this.canUndo()}, Redo: ${this.canRedo()}`);
        console.groupEnd();
    }

    /**
     * Уничтожить менеджер истории
     */
    destroy() {
        this.clear();
        this.eventBus.off(Events.History.Debug, this._onDebug);
        this._listenersAttached = false;
    }
}
