import { Events } from '../events/Events.js';
import { EditFileNameCommand } from '../commands/index.js';

export function setupObjectLifecycleFlow(core) {
    core.eventBus.on(Events.Tool.ObjectsDelete, ({ objects }) => {
        const ids = Array.isArray(objects) ? objects : [];
        ids.forEach((id) => core.deleteObject(id));
    });

    core.eventBus.on(Events.Tool.HitTest, (data) => {
        const result = core.pixi.hitTest(data.x, data.y);
        data.result = result;
    });

    core.eventBus.on(Events.Tool.GetObjectPosition, (data) => {
        const pixiObject = core.pixi.objects.get(data.objectId);
        if (!pixiObject) return;
        const halfW = (pixiObject.width || 0) / 2;
        const halfH = (pixiObject.height || 0) / 2;
        data.position = { x: pixiObject.x - halfW, y: pixiObject.y - halfH };
    });

    core.eventBus.on(Events.Tool.GetObjectPixi, (data) => {
        const pixiObject = core.pixi.objects.get(data.objectId);
        data.pixiObject = pixiObject || null;
    });

    core.eventBus.on(Events.Tool.GetAllObjects, (data) => {
        const result = [];
        for (const [objectId, pixiObject] of core.pixi.objects.entries()) {
            const bounds = pixiObject.getBounds();
            result.push({
                id: objectId,
                pixi: pixiObject,
                bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
            });
        }
        data.objects = result;
    });

    core.eventBus.on(Events.Tool.GetObjectSize, (data) => {
        const objects = core.state.getObjects();
        const object = objects.find(obj => obj.id === data.objectId);
        if (object) {
            data.size = { width: object.width, height: object.height };
        }
    });

    core.eventBus.on(Events.Tool.GetObjectRotation, (data) => {
        const pixiObject = core.pixi.objects.get(data.objectId);
        if (pixiObject) {
            data.rotation = pixiObject.rotation * 180 / Math.PI;
        } else {
            data.rotation = 0;
        }
    });

    core.eventBus.on(Events.Tool.UpdateObjectContent, (data) => {
        const { objectId, content } = data;
        if (objectId && content !== undefined) {
            core.pixi.updateObjectContent(objectId, content);
        }
    });

    core.eventBus.on(Events.Tool.HideObjectText, (data) => {
        const { objectId } = data;
        if (objectId) {
            core.pixi.hideObjectText(objectId);
        }
    });

    core.eventBus.on(Events.Tool.ShowObjectText, (data) => {
        const { objectId } = data;
        if (objectId) {
            core.pixi.showObjectText(objectId);
        }
    });

    core.eventBus.on(Events.Tool.FindObjectByPosition, (data) => {
        const { position, type } = data;
        if (position && type) {
            const foundObject = core.pixi.findObjectByPosition(position, type);
            data.foundObject = foundObject;
        }
    });

    core.eventBus.on(Events.Object.StateChanged, (data) => {
        const { objectId, updates } = data;
        if (objectId && updates && core.state) {
            const objects = core.state.getObjects();
            const object = objects.find(obj => obj.id === objectId);
            if (object) {
                if (updates.properties && object.properties) {
                    Object.assign(object.properties, updates.properties);
                }

                const topLevelUpdates = { ...updates };
                delete topLevelUpdates.properties;
                Object.assign(object, topLevelUpdates);

                const pixiObject = core.pixi.objects.get(objectId);
                if (pixiObject && pixiObject._mb && pixiObject._mb.instance) {
                    const instance = pixiObject._mb.instance;

                    if (object.type === 'frame' && updates.properties && updates.properties.title !== undefined) {
                        if (instance.setTitle) {
                            instance.setTitle(updates.properties.title);
                        }
                    }

                    if (object.type === 'frame' && updates.backgroundColor !== undefined) {
                        if (instance.setBackgroundColor) {
                            instance.setBackgroundColor(updates.backgroundColor);
                        }
                    }

                    if (object.type === 'note' && updates.properties) {
                        if (instance.setStyle) {
                            const styleUpdates = {};
                            if (updates.properties.backgroundColor !== undefined) {
                                styleUpdates.backgroundColor = updates.properties.backgroundColor;
                            }
                            if (updates.properties.borderColor !== undefined) {
                                styleUpdates.borderColor = updates.properties.borderColor;
                            }
                            if (updates.properties.textColor !== undefined) {
                                styleUpdates.textColor = updates.properties.textColor;
                            }
                            if (updates.properties.fontSize !== undefined) {
                                styleUpdates.fontSize = updates.properties.fontSize;
                            }
                            if (updates.properties.fontFamily !== undefined) {
                                styleUpdates.fontFamily = updates.properties.fontFamily;
                            }

                            if (Object.keys(styleUpdates).length > 0) {
                                instance.setStyle(styleUpdates);
                            }
                        }
                    }
                }

                core.state.markDirty();
            }
        }
    });

    core.eventBus.on(Events.Object.FileNameChange, (data) => {
        const { objectId, oldName, newName } = data;
        if (objectId && oldName !== undefined && newName !== undefined) {
            const command = new EditFileNameCommand(core, objectId, oldName, newName);
            core.history.executeCommand(command);
        }
    });

    core.eventBus.on('file:metadata:updated', (data) => {
        const { objectId, metadata } = data;
        if (objectId && metadata) {
            const objects = core.state.getObjects();
            const objectData = objects.find(obj => obj.id === objectId);

            if (objectData && objectData.type === 'file') {
                if (!objectData.properties) {
                    objectData.properties = {};
                }

                if (metadata.name && metadata.name !== objectData.properties.fileName) {
                    objectData.properties.fileName = metadata.name;

                    const pixiReq = { objectId, pixiObject: null };
                    core.eventBus.emit(Events.Tool.GetObjectPixi, pixiReq);

                    if (pixiReq.pixiObject && pixiReq.pixiObject._mb && pixiReq.pixiObject._mb.instance) {
                        const fileInstance = pixiReq.pixiObject._mb.instance;
                        if (typeof fileInstance.setFileName === 'function') {
                            fileInstance.setFileName(metadata.name);
                        }
                    }

                    core.state.markDirty();
                }
            }
        }
    });
}
