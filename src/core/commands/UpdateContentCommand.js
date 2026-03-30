/**
 * Команда изменения содержимого текста/записки для системы Undo/Redo
 */
import { BaseCommand } from './BaseCommand.js';
import { Events } from '../events/Events.js';

export class UpdateContentCommand extends BaseCommand {
    constructor(coreMoodboard, objectId, oldContent, newContent, options = {}) {
        super('update_content', `Изменить текст`);
        this.coreMoodboard = coreMoodboard;
        this.objectId = objectId;
        this.oldContent = oldContent;
        this.newContent = newContent;
        this.oldSize = options?.oldSize ? { ...options.oldSize } : null;
        this.newSize = options?.newSize ? { ...options.newSize } : null;
        this.oldPosition = options?.oldPosition ? { ...options.oldPosition } : null;
        this.newPosition = options?.newPosition ? { ...options.newPosition } : null;
    }

    execute() {
        this._applyContent(this.newContent, this.newSize, this.newPosition);
    }

    undo() {
        // Локальный undo отключен: история состояния загружается с сервера по версиям.
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
        this.newSize = otherCommand.newSize ? { ...otherCommand.newSize } : this.newSize;
        this.newPosition = otherCommand.newPosition ? { ...otherCommand.newPosition } : this.newPosition;
        this.timestamp = otherCommand.timestamp;
    }

    _applyContent(content, sizeSnapshot = null, positionSnapshot = null) {
        const objects = this.coreMoodboard.state.getObjects();
        const object = objects.find((obj) => obj.id === this.objectId);
        if (object) {
            if (!object.properties) {
                object.properties = {};
            }
            object.properties.content = content;

            const isMindmap = object.type === 'mindmap';
            const hasSizeSnapshot = sizeSnapshot
                && Number.isFinite(sizeSnapshot.width)
                && Number.isFinite(sizeSnapshot.height);
            if (isMindmap && hasSizeSnapshot) {
                const nextSize = {
                    width: Math.max(1, Math.round(sizeSnapshot.width)),
                    height: Math.max(1, Math.round(sizeSnapshot.height)),
                };
                const nextPosition = (positionSnapshot
                    && Number.isFinite(positionSnapshot.x)
                    && Number.isFinite(positionSnapshot.y))
                    ? { x: Math.round(positionSnapshot.x), y: Math.round(positionSnapshot.y) }
                    : { x: Math.round(object.position?.x || 0), y: Math.round(object.position?.y || 0) };
                this.coreMoodboard.updateObjectSizeAndPositionDirect(
                    this.objectId,
                    nextSize,
                    nextPosition,
                    'mindmap',
                    { snap: false }
                );
                this.emit(Events.Tool.ResizeUpdate, {
                    object: this.objectId,
                    size: nextSize,
                    position: nextPosition,
                });
                this.emit(Events.Tool.ResizeEnd, {
                    object: this.objectId,
                    oldSize: nextSize,
                    newSize: nextSize,
                    oldPosition: nextPosition,
                    newPosition: nextPosition,
                });
                this.emit(Events.Object.TransformUpdated, { objectId: this.objectId });
                this.emit(Events.Object.Updated, { objectId: this.objectId });
            }
            this.coreMoodboard.state.markDirty();
        }
        this.emit(Events.Tool.UpdateObjectContent, {
            objectId: this.objectId,
            content,
        });
    }
}
