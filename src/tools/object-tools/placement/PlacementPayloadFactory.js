import { Events } from '../../../core/events/Events.js';

export class PlacementPayloadFactory {
    constructor(host) {
        this.host = host;
    }

    emitGenericPlacement(type, position, properties) {
        this.host.eventBus.emit(Events.UI.ToolbarAction, {
            type,
            id: type,
            position,
            properties
        });
    }

    emitFramePlacement(position, properties, width, height) {
        this.host.eventBus.emit(Events.UI.ToolbarAction, {
            type: 'frame',
            id: 'frame',
            position,
            properties: { ...properties, width, height }
        });
    }

    emitTextPlacement(position, properties) {
        this.host.eventBus.emit(Events.UI.ToolbarAction, {
            type: 'text',
            id: 'text',
            position,
            properties: {
                fontSize: properties.fontSize || 18,
                content: '',
                fontFamily: 'Arial, sans-serif',
                color: '#000000',
                backgroundColor: 'transparent'
            }
        });
    }

    emitFrameDrawPlacement(x, y, w, h) {
        this.host.eventBus.emit(Events.UI.ToolbarAction, {
            type: 'frame',
            id: 'frame',
            position: { x, y },
            properties: { width: Math.round(w), height: Math.round(h), title: 'Произвольный', lockedAspect: false, isArbitrary: true }
        });
    }

    emitImageUploaded(position, uploadResult, width, height, objectType = 'image', extraProperties = {}) {
        this.host.eventBus.emit(Events.UI.ToolbarAction, {
            type: objectType,
            id: objectType,
            position,
            properties: {
                src: uploadResult.url,
                name: uploadResult.name,
                width,
                height,
                ...extraProperties
            }
        });
    }

    emitFileUploaded(position, uploadResult, width, height) {
        this.host.eventBus.emit(Events.UI.ToolbarAction, {
            type: 'file',
            id: 'file',
            position,
            properties: {
                fileName: uploadResult.name,
                fileSize: uploadResult.size,
                mimeType: uploadResult.mimeType,
                formattedSize: uploadResult.formattedSize,
                url: uploadResult.url,
                width,
                height
            },
            fileId: uploadResult.fileId || uploadResult.id
        });
    }

}
