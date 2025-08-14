/**
 * Набор чистых функций геометрии для SelectTool и контроллеров
 */
export function transformHandleType(handleType, rotationDegrees) {
    let angle = rotationDegrees % 360;
    if (angle < 0) angle += 360;
    const rotations = Math.round(angle / 90) % 4;
    if (rotations === 0) return handleType;
    const transformMap = {
        'nw': ['ne', 'se', 'sw', 'nw'],
        'n':  ['e',  's',  'w',  'n'],
        'ne': ['se', 'sw', 'nw', 'ne'],
        'e':  ['s',  'w',  'n',  'e'],
        'se': ['sw', 'nw', 'ne', 'se'],
        's':  ['w',  'n',  'e',  's'],
        'sw': ['nw', 'ne', 'se', 'sw'],
        'w':  ['n',  'e',  's',  'w']
    };
    return transformMap[handleType] ? transformMap[handleType][rotations - 1] : handleType;
}

export function calculateNewSize(handleType, startBounds, deltaX, deltaY, maintainAspectRatio, rotationDegrees = 0) {
    let newWidth = startBounds.width;
    let newHeight = startBounds.height;
    const transformed = transformHandleType(handleType, rotationDegrees);
    switch (transformed) {
        case 'nw': newWidth = startBounds.width - deltaX; newHeight = startBounds.height - deltaY; break;
        case 'n':  newHeight = startBounds.height - deltaY; break;
        case 'ne': newWidth = startBounds.width + deltaX; newHeight = startBounds.height - deltaY; break;
        case 'e':  newWidth = startBounds.width + deltaX; break;
        case 'se': newWidth = startBounds.width + deltaX; newHeight = startBounds.height + deltaY; break;
        case 's':  newHeight = startBounds.height + deltaY; break;
        case 'sw': newWidth = startBounds.width - deltaX; newHeight = startBounds.height + deltaY; break;
        case 'w':  newWidth = startBounds.width - deltaX; break;
    }
    if (maintainAspectRatio) {
        const ar = startBounds.width / startBounds.height;
        if (['nw', 'ne', 'sw', 'se'].includes(handleType)) {
            const dw = Math.abs(newWidth - startBounds.width);
            const dh = Math.abs(newHeight - startBounds.height);
            if (dw > dh) newHeight = newWidth / ar; else newWidth = newHeight * ar;
        } else if (['e', 'w'].includes(handleType)) {
            newHeight = newWidth / ar;
        } else if (['n', 's'].includes(handleType)) {
            newWidth = newHeight * ar;
        }
    }
    return { width: Math.round(newWidth), height: Math.round(newHeight) };
}

export function calculatePositionOffset(handleType, startBounds, newSize, objectRotation = 0) {
    const deltaWidth = newSize.width - startBounds.width;
    const deltaHeight = newSize.height - startBounds.height;
    let localOffsetX = 0, localOffsetY = 0;
    switch (handleType) {
        case 'nw': localOffsetX = -deltaWidth / 2; localOffsetY = -deltaHeight / 2; break;
        case 'n':  localOffsetX = 0;              localOffsetY = -deltaHeight / 2; break;
        case 'ne': localOffsetX =  deltaWidth / 2; localOffsetY = -deltaHeight / 2; break;
        case 'e':  localOffsetX =  deltaWidth / 2; localOffsetY = 0; break;
        case 'se': localOffsetX =  deltaWidth / 2; localOffsetY =  deltaHeight / 2; break;
        case 's':  localOffsetX = 0;              localOffsetY =  deltaHeight / 2; break;
        case 'sw': localOffsetX = -deltaWidth / 2; localOffsetY =  deltaHeight / 2; break;
        case 'w':  localOffsetX = -deltaWidth / 2; localOffsetY = 0; break;
    }
    const angleRad = objectRotation * Math.PI / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    const worldOffsetX = localOffsetX * cos - localOffsetY * sin;
    const worldOffsetY = localOffsetX * sin + localOffsetY * cos;
    return { x: worldOffsetX, y: worldOffsetY };
}


