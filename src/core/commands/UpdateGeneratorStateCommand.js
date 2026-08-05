import { BaseCommand } from './BaseCommand.js';
import { Events } from '../events/Events.js';

/**
 * Изменение состояния узла-генератора изображений.
 *
 * Нужна только ради автосохранения: SaveManager пишет доску по History.Changed,
 * а прямой Events.Object.StateChanged лишь применяет патч в памяти. Локальный
 * undo отключён, как и в других командах пакета: результаты генерации — не
 * пользовательский ввод, откатывать их пошагово нечего.
 */
export class UpdateGeneratorStateCommand extends BaseCommand {
    /**
     * @param {object} core ядро мудборда
     * @param {string} objectId
     * @param {{properties?: object, width?: number, height?: number}} updates
     */
    constructor(core, objectId, updates = {}) {
        super('update_generator_state', 'Состояние генератора изображений');
        this.core = core;
        this.objectId = objectId;
        this.updates = updates;
    }

    execute() {
        const { width, height } = this.updates;

        this.emit(Events.Object.StateChanged, {
            objectId: this.objectId,
            updates: this.updates,
        });

        if (Number.isFinite(width) || Number.isFinite(height)) {
            const object = this.core?.state?.getObjects?.().find((obj) => obj?.id === this.objectId);
            try {
                this.core?.pixi?.updateObjectSize?.(this.objectId, {
                    width: Number.isFinite(width) ? width : object?.width,
                    height: Number.isFinite(height) ? height : object?.height,
                });
            } catch (_) {}
            this.emit(Events.Tool.ResizeEnd, { objectId: this.objectId });
        }

        this.core?.state?.markDirty?.();
    }

    undo() {
        // Локальный undo отключен: история состояния загружается с сервера по версиям.
    }

    canMergeWith(otherCommand) {
        return otherCommand instanceof UpdateGeneratorStateCommand
            && otherCommand.objectId === this.objectId;
    }

    mergeWith(otherCommand) {
        if (!this.canMergeWith(otherCommand)) {
            throw new Error('Cannot merge commands');
        }

        this.updates = {
            ...this.updates,
            ...otherCommand.updates,
            properties: {
                ...(this.updates.properties || {}),
                ...(otherCommand.updates.properties || {}),
            },
        };
        this.timestamp = otherCommand.timestamp;
    }
}
