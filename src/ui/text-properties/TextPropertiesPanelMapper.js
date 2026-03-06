import { Events } from '../../core/events/Events.js';

export const FONT_OPTIONS = [
    { value: 'Roboto, Arial, sans-serif', name: 'Roboto' },
    { value: 'Oswald, Arial, sans-serif', name: 'Oswald' },
    { value: '"Playfair Display", Georgia, serif', name: 'Playfair Display' },
    { value: '"Roboto Slab", Georgia, serif', name: 'Roboto Slab' },
    { value: '"Noto Serif", Georgia, serif', name: 'Noto Serif' },
    { value: 'Lobster, "Comic Sans MS", cursive', name: 'Lobster' },
    { value: 'Caveat, "Comic Sans MS", cursive', name: 'Caveat' },
    { value: '"Rubik Mono One", "Courier New", monospace', name: 'Rubik Mono One' },
    { value: '"Great Vibes", "Comic Sans MS", cursive', name: 'Great Vibes' },
    { value: '"Amatic SC", "Comic Sans MS", cursive', name: 'Amatic SC' },
    { value: '"Poiret One", Arial, sans-serif', name: 'Poiret One' },
    { value: 'Pacifico, "Comic Sans MS", cursive', name: 'Pacifico' },
];

export const FONT_SIZE_OPTIONS = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72];

export const TEXT_COLOR_PRESETS = [
    { color: '#000000', name: '#000000' },
    { color: '#404040', name: '#404040' },
    { color: '#999999', name: '#999999' },
    { color: '#FF2D55', name: '#FF2D55' },
    { color: '#CB30E0', name: '#CB30E0' },
    { color: '#6155F5', name: '#6155F5' },
    { color: '#00C0E8', name: '#00C0E8' },
    { color: '#34C759', name: '#34C759' },
    { color: '#FF8D28', name: '#FF8D28' },
    { color: '#FFCC00', name: '#FFCC00' },
];

export const BACKGROUND_COLOR_PRESETS = [
    { color: 'transparent', name: 'Без выделения' },
    { color: '#ffff99', name: 'Желтый' },
    { color: '#ffcc99', name: 'Оранжевый' },
    { color: '#ff9999', name: 'Розовый' },
    { color: '#ccffcc', name: 'Зеленый' },
    { color: '#99ccff', name: 'Голубой' },
    { color: '#cc99ff', name: 'Фиолетовый' },
    { color: '#f0f0f0', name: 'Светло-серый' },
    { color: '#d0d0d0', name: 'Серый' },
    { color: '#ffffff', name: 'Белый' },
    { color: '#000000', name: 'Черный' },
    { color: '#333333', name: 'Темно-серый' },
];

export function getSelectedTextObjectId(core) {
    const ids = core?.selectTool ? Array.from(core.selectTool.selectedObjects || []) : [];
    if (!ids || ids.length !== 1) {
        return null;
    }

    const id = ids[0];
    const pixi = core?.pixi?.objects?.get ? core.pixi.objects.get(id) : null;
    const mb = pixi?._mb || {};

    if (mb.type !== 'text') {
        return null;
    }

    return id;
}

export function getPixiObject(eventBus, objectId) {
    if (!objectId) {
        return null;
    }

    const pixiData = { objectId, pixiObject: null };
    eventBus.emit(Events.Tool.GetObjectPixi, pixiData);
    return pixiData.pixiObject;
}

export function getObjectProperties(eventBus, objectId) {
    const pixiObject = getPixiObject(eventBus, objectId);
    if (pixiObject && pixiObject._mb && pixiObject._mb.properties) {
        return pixiObject._mb.properties;
    }
    return null;
}

export function getControlValuesFromProperties(properties) {
    return {
        fontFamily: properties.fontFamily || 'Roboto, Arial, sans-serif',
        fontSize: String(properties.fontSize || 18),
        color: properties.color || '#000000',
        backgroundColor: properties.backgroundColor !== undefined ? properties.backgroundColor : 'transparent',
    };
}

export function getFallbackControlValues() {
    return {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18',
        color: '#000000',
        backgroundColor: 'transparent',
    };
}

export function buildFontFamilyUpdate(fontFamily) {
    return {
        properties: { fontFamily },
    };
}

export function buildFontSizeUpdate(fontSize) {
    return {
        fontSize,
    };
}

export function buildTextColorUpdate(color) {
    return {
        color,
    };
}

export function buildBackgroundColorUpdate(backgroundColor) {
    return {
        backgroundColor,
    };
}

export function applyTextAppearanceToDom(objectId, properties) {
    const htmlElement = document.querySelector(`[data-id="${objectId}"]`);
    if (!htmlElement) {
        return;
    }

    if (properties.fontFamily) {
        htmlElement.style.fontFamily = properties.fontFamily;
    }
    if (properties.fontSize) {
        htmlElement.style.fontSize = `${properties.fontSize}px`;
    }
    if (properties.color) {
        htmlElement.style.color = properties.color;
    }
    if (properties.backgroundColor !== undefined) {
        if (properties.backgroundColor === 'transparent') {
            htmlElement.style.backgroundColor = '';
        } else {
            htmlElement.style.backgroundColor = properties.backgroundColor;
        }
    }
}

export function syncPixiTextProperties(eventBus, objectId, properties) {
    const pixiObject = getPixiObject(eventBus, objectId);
    if (!pixiObject || !pixiObject._mb) {
        return;
    }

    if (!pixiObject._mb.properties) {
        pixiObject._mb.properties = {};
    }

    Object.assign(pixiObject._mb.properties, properties);
}

export function getObjectGeometry(eventBus, objectId) {
    const posData = { objectId, position: null };
    const sizeData = { objectId, size: null };

    eventBus.emit(Events.Tool.GetObjectPosition, posData);
    eventBus.emit(Events.Tool.GetObjectSize, sizeData);

    return {
        position: posData.position,
        size: sizeData.size,
    };
}
