/**
 * Команда изменения содержимого текста/записки для системы Undo/Redo
 */
import { BaseCommand } from './BaseCommand.js';
import { Events } from '../events/Events.js';

export class UpdateContentCommand extends BaseCommand {
    constructor(coreMoodboard, objectId, oldContent, newContent) {
        super('update_content', `Изменить текст`);
        this.coreMoodboard = coreMoodboard;
        this.objectId = objectId;
        this.oldContent = oldContent;
        this.newContent = newContent;
    }

    execute() {
        this._applyContent(this.newContent);
    }

    undo() {
        this._applyContent(this.oldContent);
    }

    canMergeWith(otherCommand) {
        return otherCommand instanceof UpdateContentCommand &&
               otherCommand.objectId === this.objectId;
    }

    mergeWith(otherCommand) {
        if (!this.canMergeWith(otherCommand)) {
            throw new Error('Cannot merge commands');
        }
        this.newContent = otherCommand.newContent;
        this.timestamp = otherCommand.timestamp;
    }

    _applyContent(content) {
        const objects = this.coreMoodboard.state.getObjects();
        const object = objects.find((obj) => obj.id === this.objectId);
        if (object) {
            if (!object.properties) {
                object.properties = {};
            }
            object.properties.content = content;
            this.coreMoodboard.state.markDirty();
        }
        this.emit(Events.Tool.UpdateObjectContent, {
            objectId: this.objectId,
            content,
        });
    }
}
