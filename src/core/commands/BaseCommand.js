/**
 * Базовый класс для всех команд в системе Undo/Redo
 * Реализует паттерн Command
 */
export class BaseCommand {
    constructor(type, description = '') {
        this.type = type;
        this.description = description;
        this.timestamp = Date.now();
        this.id = `cmd_${this.timestamp}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Выполнить команду
     * Должен быть переопределен в наследниках
     */
    execute() {
        throw new Error('execute() method must be implemented in subclass');
    }

    /**
     * Отменить команду
     * Должен быть переопределен в наследниках
     */
    undo() {
        throw new Error('undo() method must be implemented in subclass');
    }

    /**
     * Можно ли объединить с другой командой (для группировки мелких изменений)
     */
    canMergeWith(otherCommand) {
        return false;
    }

    /**
     * Объединить с другой командой
     */
    mergeWith(otherCommand) {
        throw new Error('mergeWith() method must be implemented when canMergeWith returns true');
    }

    /**
     * Получить описание команды для отладки
     */
    toString() {
        return `${this.type}: ${this.description} (${new Date(this.timestamp).toLocaleTimeString()})`;
    }
}
