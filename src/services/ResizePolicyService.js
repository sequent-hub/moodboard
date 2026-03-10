const MIN_FRAME_AREA = 1800;

function getRoundedSize(width, height) {
    return {
        width: Math.max(1, Math.round(width || 1)),
        height: Math.max(1, Math.round(height || 1)),
    };
}

function isHandleEdge(handle) {
    return ['n', 's', 'e', 'w'].includes(handle);
}

export function getSingleResizePolicy({ objectType = null, properties = {} } = {}) {
    const isEmojiImage = objectType === 'image' && !!properties?.isEmojiIcon;
    const isEmoji = objectType === 'emoji' || isEmojiImage;
    const isNote = objectType === 'note';
    const lockedAspect = objectType === 'frame' && properties?.lockedAspect === true;
    const keepAspect = objectType === 'image' || lockedAspect || isEmoji || isNote;

    return {
        keepAspect,
        square: isEmoji || isNote,
        minArea: objectType === 'frame' ? MIN_FRAME_AREA : 0,
    };
}

export function resolveAnchoredResizePosition({
    startPosition,
    startSize,
    normalizedSize,
    handle,
}) {
    if (!startPosition || !startSize || !normalizedSize || !handle) return null;

    const normalizedHandle = String(handle).toLowerCase();
    const startW = Math.max(1, startSize.width || 1);
    const startH = Math.max(1, startSize.height || 1);
    const nextW = Math.max(1, normalizedSize.width || 1);
    const nextH = Math.max(1, normalizedSize.height || 1);
    let x = startPosition.x;
    let y = startPosition.y;

    if (normalizedHandle.includes('w')) x = startPosition.x + (startW - nextW);
    if (normalizedHandle.includes('n')) y = startPosition.y + (startH - nextH);

    if (isHandleEdge(normalizedHandle)) {
        if (normalizedHandle === 'n' || normalizedHandle === 's') {
            x = startPosition.x + ((startW - nextW) / 2);
        } else if (normalizedHandle === 'e' || normalizedHandle === 'w') {
            y = startPosition.y + ((startH - nextH) / 2);
        }
    }

    return {
        x: Math.round(x),
        y: Math.round(y),
    };
}

export function resolveSingleResizeDominantAxis({
    startSize,
    size,
    objectType = null,
    properties = {},
    preferredDominantAxis = null,
}) {
    if (!size) return 'none';

    const policy = getSingleResizePolicy({ objectType, properties });
    if (policy.square) return 'square';
    if (!policy.keepAspect) return 'free';
    if (preferredDominantAxis === 'width' || preferredDominantAxis === 'height') {
        return preferredDominantAxis;
    }

    const startW = Math.max(1, startSize?.width || size.width || 1);
    const startH = Math.max(1, startSize?.height || size.height || 1);
    const rawWidth = Math.max(1, size.width || 1);
    const rawHeight = Math.max(1, size.height || 1);
    const deltaWidth = Math.abs(rawWidth - startW);
    const deltaHeight = Math.abs(rawHeight - startH);
    return deltaWidth >= deltaHeight ? 'width' : 'height';
}

export function normalizeSingleResizeGeometry({
    startSize,
    startPosition,
    handle,
    size,
    position = null,
    objectType = null,
    properties = {},
    preferredDominantAxis = null,
}) {
    if (!size) {
        return { size: null, position };
    }

    const startW = Math.max(1, startSize?.width || size.width || 1);
    const startH = Math.max(1, startSize?.height || size.height || 1);
    const policy = getSingleResizePolicy({ objectType, properties });
    let width = Math.max(1, size.width || 1);
    let height = Math.max(1, size.height || 1);
    const dominantAxis = resolveSingleResizeDominantAxis({
        startSize: { width: startW, height: startH },
        size: { width, height },
        objectType,
        properties,
        preferredDominantAxis,
    });

    if (policy.square) {
        const squareSize = Math.max(width, height);
        width = squareSize;
        height = squareSize;
    } else if (policy.keepAspect) {
        const aspect = startW / startH;
        if (dominantAxis === 'width') {
            height = width / aspect;
        } else {
            width = height * aspect;
        }
    }

    if (policy.minArea > 0) {
        const area = Math.max(1, width * height);
        if (area < policy.minArea) {
            const scale = Math.sqrt(policy.minArea / area);
            width *= scale;
            height *= scale;
        }
    }

    const normalizedSize = getRoundedSize(width, height);
    const shouldResolvePosition = (policy.keepAspect || policy.square || policy.minArea > 0)
        && !!startPosition
        && !!handle;
    const resolvedPosition = shouldResolvePosition
        ? resolveAnchoredResizePosition({
            startPosition,
            startSize: { width: startW, height: startH },
            normalizedSize,
            handle,
        })
        : position;

    return {
        size: normalizedSize,
        position: resolvedPosition,
    };
}
