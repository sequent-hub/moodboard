import { Events } from '../../core/events/Events.js';
import { UpdateGeneratorStateCommand } from '../../core/commands/UpdateGeneratorStateCommand.js';

/**
 * Единственная точка записи состояния узла-генератора.
 *
 * Через историю команд, потому что автосохранение доски слушает History.Changed:
 * прямой Events.Object.StateChanged применяет патч в памяти, но доску не пишет —
 * результаты генерации терялись бы при перезагрузке страницы. Если истории нет
 * (юнит-тесты с голой шиной), падаем на прямое событие.
 *
 * @param {object|null} core ядро мудборда
 * @param {object|null} eventBus запасная шина, если ядра нет
 * @param {string} objectId
 * @param {{properties?: object, width?: number, height?: number}} updates
 */
export function commitGeneratorUpdates(core, eventBus, objectId, updates) {
    if (!objectId || !updates) return;

    const bus = core?.eventBus || eventBus || null;
    const history = core?.history;

    if (history && typeof history.executeCommand === 'function') {
        const command = new UpdateGeneratorStateCommand(core, objectId, updates);
        command.setEventBus(bus);
        history.executeCommand(command);
        return;
    }

    bus?.emit?.(Events.Object.StateChanged, { objectId, updates });
}
