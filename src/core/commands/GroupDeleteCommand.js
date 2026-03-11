import { BaseCommand } from './BaseCommand.js';
import { Events } from '../events/Events.js';

/**
 * Команда группового удаления объектов.
 * Один Undo восстанавливает всю группу.
 */
export class GroupDeleteCommand extends BaseCommand {
    constructor(coreMoodboard, objectIds) {
        super('group_delete', `Удалить группу (${objectIds.length} объектов)`);
        this.coreMoodboard = coreMoodboard;
        this.objectIds = Array.isArray(objectIds) ? [...objectIds] : [];

        const objects = this.coreMoodboard.state.getObjects();
        this.objectsData = [];
        for (const id of this.objectIds) {
            const obj = objects.find((o) => o.id === id);
            if (obj) {
                const data = JSON.parse(JSON.stringify(obj));
                if (data.type === 'image') {
                    if (data.imageId) {
                        const imageUrl = `/api/images/${data.imageId}/file`;
                        data.src = imageUrl;
                        if (!data.properties) data.properties = {};
                        data.properties.src = imageUrl;
                    }
                }
                this.objectsData.push({ id, data });
            }
        }
    }

    async execute() {
        for (const { id, data } of this.objectsData) {
            this.coreMoodboard.state.removeObject(id);
            this.coreMoodboard.pixi.removeObject(id);

            const blobSrc = data?.properties?.src || data?.src;
            if (typeof blobSrc === 'string' && blobSrc.startsWith('blob:')) {
                try {
                    URL.revokeObjectURL(blobSrc);
                } catch (_) {}
            }

            if (data.type === 'file' && data.fileId && this.coreMoodboard.fileUploadService) {
                try {
                    await this.coreMoodboard.fileUploadService.deleteFile(data.fileId);
                } catch (_) {}
            }

            this.coreMoodboard.eventBus.emit(Events.Object.Deleted, { objectId: id });
        }
    }

    undo() {
        for (const { id, data } of this.objectsData) {
            if (data.type === 'file' && data.fileId) {
                const restored = { ...data };
                if (restored.properties) {
                    restored.properties = {
                        ...restored.properties,
                        fileName: `[УДАЛЕН] ${restored.properties.fileName || 'файл'}`,
                        isDeleted: true,
                    };
                }
                this.coreMoodboard.state.addObject(restored);
                this.coreMoodboard.pixi.createObject(restored);
            } else {
                this.coreMoodboard.state.addObject(data);
                this.coreMoodboard.pixi.createObject(data);
            }
            this.coreMoodboard.eventBus.emit(Events.Object.Created, { objectId: id, objectData: data });
        }
    }
}
