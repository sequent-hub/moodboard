import {
    normalizeSingleResizeGeometry,
    resolveSingleResizeDominantAxis,
    resolveAnchoredResizePosition,
} from '../../services/ResizePolicyService.js';

export function shouldNormalizeSingleResize(objectType) {
    return objectType === 'image'
        || objectType === 'frame'
        || objectType === 'emoji';
}

export function getActiveResize(core, objectId) {
    return core._activeResize && core._activeResize.objectId === objectId
        ? core._activeResize
        : null;
}

export function normalizeResizeUpdatePayload(core, object, data) {
    const activeResize = getActiveResize(core, data.object);
    if (!data.size || !object || !shouldNormalizeSingleResize(object.type)) {
        return activeResize;
    }

    if (activeResize && !activeResize.dominantAxis) {
        const dominantAxis = resolveSingleResizeDominantAxis({
            startSize: activeResize.startSize,
            size: data.size,
            objectType: object.type,
            properties: object.properties || {},
        });
        if (dominantAxis === 'width' || dominantAxis === 'height') {
            activeResize.dominantAxis = dominantAxis;
        }
    }

    const normalized = normalizeSingleResizeGeometry({
        startSize: activeResize?.startSize || { width: object.width, height: object.height },
        startPosition: activeResize?.startPosition || object.position || null,
        handle: activeResize?.handle || '',
        size: data.size,
        position: data.position,
        objectType: object.type,
        properties: object.properties || {},
        preferredDominantAxis: activeResize?.dominantAxis || null,
    });
    data.size = normalized.size;
    data.position = normalized.position;
    return activeResize;
}

export function normalizeResizeEndPayload(core, object, data) {
    const activeResize = getActiveResize(core, data.object);
    if (!object || !shouldNormalizeSingleResize(object.type)) {
        return activeResize;
    }

    const normalized = normalizeSingleResizeGeometry({
        startSize: activeResize?.startSize || data.oldSize || { width: object.width, height: object.height },
        startPosition: activeResize?.startPosition || data.oldPosition || object.position || null,
        handle: activeResize?.handle || '',
        size: data.newSize,
        position: data.newPosition,
        objectType: object.type,
        properties: object.properties || {},
        preferredDominantAxis: activeResize?.dominantAxis || null,
    });
    data.newSize = normalized.size;
    data.newPosition = normalized.position;
    return activeResize;
}

export function resolveResizePositionFallback(core, objectId, size) {
    const activeResize = getActiveResize(core, objectId);
    if (!activeResize) return null;

    return resolveAnchoredResizePosition({
        startPosition: activeResize.startPosition,
        startSize: core.optimization?.startSize || activeResize.startSize,
        normalizedSize: size,
        handle: activeResize.handle,
    });
}
