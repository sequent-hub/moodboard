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
            // Пересчитываем диапазоны ссылок при изменении контента
            if (Array.isArray(object.properties.links) && object.properties.links.length > 0) {
                object.properties.links = _adjustLinks(
                    object.properties.links,
                    object.properties.content ?? '',
                    content
                );
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

/**
 * Пересчитывает диапазоны ссылок после изменения контента.
 * Алгоритм: находим наибольший общий префикс и суффикс, определяем
 * изменённый диапазон; ссылки внутри него удаляем, за ним — сдвигаем.
 * @param {Array<{start:number,end:number,url:string}>} links
 * @param {string} oldText
 * @param {string} newText
 * @returns {Array<{start:number,end:number,url:string}>}
 */
function _adjustLinks(links, oldText, newText) {
    if (!links || links.length === 0) return links;

    let prefixLen = 0;
    const minLen = Math.min(oldText.length, newText.length);
    while (prefixLen < minLen && oldText[prefixLen] === newText[prefixLen]) prefixLen++;

    let oldSuffix = 0;
    while (
        oldSuffix < oldText.length - prefixLen &&
        oldSuffix < newText.length - prefixLen &&
        oldText[oldText.length - 1 - oldSuffix] === newText[newText.length - 1 - oldSuffix]
    ) oldSuffix++;

    const oldChangeEnd = oldText.length - oldSuffix; // конец изменённого диапазона в старом тексте
    const newChangeEnd = newText.length - oldSuffix;  // конец изменённого диапазона в новом тексте
    const delta = newChangeEnd - oldChangeEnd;         // сдвиг для символов после изменения

    return links.reduce((acc, link) => {
        const { start, end, url } = link;
        if (end <= prefixLen) {
            // Ссылка полностью в неизменённом префиксе — оставляем
            acc.push({ start, end, url });
        } else if (start >= oldChangeEnd) {
            // Ссылка полностью после изменения — сдвигаем
            acc.push({ start: start + delta, end: end + delta, url });
        }
        // Ссылка перекрывает изменённый диапазон — удаляем (стала некорректной)
        return acc;
    }, []);
}
