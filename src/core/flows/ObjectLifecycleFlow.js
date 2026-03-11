import { Events } from '../events/Events.js';
import {
    EditFileNameCommand,
    GroupDeleteCommand,
    UpdateContentCommand,
    UpdateTextStyleCommand,
    UpdateNoteStyleCommand,
    UpdateFramePropertiesCommand,
} from '../commands/index.js';

const TEXT_STYLE_PROPS = ['fontFamily', 'fontSize', 'color', 'backgroundColor'];
const TEXT_STYLE_DEFAULTS = {
    fontFamily: 'Roboto, Arial, sans-serif',
    fontSize: 18,
    color: '#000000',
    backgroundColor: 'transparent',
};

const NOTE_STYLE_PROPS = ['fontFamily', 'fontSize', 'textColor', 'backgroundColor'];
const NOTE_STYLE_DEFAULTS = {
    fontFamily: 'Caveat, Arial, cursive',
    fontSize: 32,
    textColor: 0x1a1a1a,
    backgroundColor: 0xfff9c4,
};

/**
 * Если updates.properties содержит ровно одно свойство стиля записки — создаёт UpdateNoteStyleCommand.
 * @returns {boolean} true, если команда создана и применена
 */
function tryCreateNoteStyleCommand(core, object, objectId, updates) {
    if (object.type !== 'note') return false;
    if (!updates.properties || Object.keys(updates).length !== 1) return false;

    const propKeys = Object.keys(updates.properties);
    if (propKeys.length !== 1 || !NOTE_STYLE_PROPS.includes(propKeys[0])) return false;

    const property = propKeys[0];
    const newValue = updates.properties[property];

    const oldValue = object.properties?.[property] ?? NOTE_STYLE_DEFAULTS[property];
    if (oldValue === newValue) return false;

    const command = new UpdateNoteStyleCommand(core, objectId, property, oldValue, newValue);
    core.history.executeCommand(command);
    return true;
}

/**
 * Если updates содержит ровно одно свойство стиля текста — создаёт UpdateTextStyleCommand и выполняет её.
 * @returns {boolean} true, если команда создана и применена (дальнейшая обработка не нужна)
 */
function tryCreateTextStyleCommand(core, object, objectId, updates) {
    if (object.type !== 'text' && object.type !== 'simple-text') return false;

    let property = null;
    let newValue = null;

    if (updates.properties?.fontFamily !== undefined && Object.keys(updates).length === 1) {
        property = 'fontFamily';
        newValue = updates.properties.fontFamily;
    } else if (updates.fontSize !== undefined && !updates.properties && Object.keys(updates).length === 1) {
        property = 'fontSize';
        newValue = typeof updates.fontSize === 'string' ? parseInt(updates.fontSize, 10) : updates.fontSize;
    } else if (updates.color !== undefined && !updates.properties && Object.keys(updates).length === 1) {
        property = 'color';
        newValue = updates.color;
    } else if (updates.backgroundColor !== undefined && !updates.properties && Object.keys(updates).length === 1) {
        property = 'backgroundColor';
        newValue = updates.backgroundColor;
    }

    if (!property || !TEXT_STYLE_PROPS.includes(property)) return false;

    const oldValue = property === 'fontFamily'
        ? (object.properties?.fontFamily ?? TEXT_STYLE_DEFAULTS.fontFamily)
        : (object[property] ?? object.properties?.[property] ?? TEXT_STYLE_DEFAULTS[property]);

    if (oldValue === newValue) return false;

    const command = new UpdateTextStyleCommand(core, objectId, property, oldValue, newValue);
    core.history.executeCommand(command);
    return true;
}

const FRAME_PROP_KEYS = ['title'];

/**
 * Если updates содержит одно свойство фрейма — создаёт UpdateFramePropertiesCommand.
 * Поддерживает: title, backgroundColor, type, lockedAspect.
 * @returns {boolean} true, если команда создана и применена
 */
function tryCreateFramePropertiesCommand(core, object, objectId, updates) {
    if (object.type !== 'frame') return false;

    let property = null;
    let oldValue = null;
    let newValue = null;

    if (updates.backgroundColor !== undefined && !updates.properties) {
        property = 'backgroundColor';
        newValue = updates.backgroundColor;
        oldValue = object.backgroundColor ?? 0xFFFFFF;
    } else if (updates.properties) {
        const propKeys = Object.keys(updates.properties);
        if (propKeys.length === 1 && propKeys[0] === 'title') {
            property = 'title';
            newValue = updates.properties.title;
            oldValue = object.properties?.title ?? '';
        }
        // type и lockedAspect — только через UpdateFrameTypeCommand в панели (один шаг в истории)
    }

    if (!property) return false;
    const supported = [...FRAME_PROP_KEYS, 'backgroundColor'];
    if (!supported.includes(property)) return false;
    if (oldValue === newValue) return false;

    const command = new UpdateFramePropertiesCommand(core, objectId, property, oldValue, newValue);
    core.history.executeCommand(command);
    return true;
}

export function setupObjectLifecycleFlow(core) {
    core.eventBus.on(Events.Tool.ObjectsDelete, ({ objects }) => {
        const ids = Array.isArray(objects) ? objects : [];
        if (ids.length === 0) return;
        const command = new GroupDeleteCommand(core, ids);
        core.history.executeCommand(command);
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

    core.eventBus.on(Events.Tool.SelectionAll, () => {
        if (core.toolManager?.getActiveTool()?.name !== 'select') return;
        const req = { objects: [] };
        core.eventBus.emit(Events.Tool.GetAllObjects, req);
        const ids = (req.objects || []).map((o) => o.id);
        if (ids.length > 0 && core.selectTool) {
            core.selectTool.setSelection(ids);
            core.selectTool.updateResizeHandles();
        }
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
        if (!objectId || !updates || !core.state) return;

        const objects = core.state.getObjects();
        const object = objects.find(obj => obj.id === objectId);
        if (!object) return;

        const noteStyleChange = tryCreateNoteStyleCommand(core, object, objectId, updates);
        if (noteStyleChange) return;

        const textStyleChange = tryCreateTextStyleCommand(core, object, objectId, updates);
        if (textStyleChange) return;

        const framePropsChange = tryCreateFramePropertiesCommand(core, object, objectId, updates);
        if (framePropsChange) return;

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
    });

    core.eventBus.on(Events.Object.FileNameChange, (data) => {
        const { objectId, oldName, newName } = data;
        if (objectId && oldName !== undefined && newName !== undefined) {
            const command = new EditFileNameCommand(core, objectId, oldName, newName);
            core.history.executeCommand(command);
        }
    });

    core.eventBus.on(Events.Object.ContentChange, (data) => {
        const { objectId, oldContent, newContent } = data;
        if (objectId && oldContent !== undefined && newContent !== undefined && oldContent !== newContent) {
            const command = new UpdateContentCommand(core, objectId, oldContent, newContent);
            command.setEventBus(core.eventBus);
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
