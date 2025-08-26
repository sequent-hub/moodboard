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
    
    // Позиция объекта в системе - это левый верхний угол
    // При ресайзе за правые/нижние ручки - левый верхний угол остается на месте (offset = 0)
    // При ресайзе за левые/верхние ручки - левый верхний угол смещается на полную величину изменения
    switch (handleType) {
        case 'nw': 
            localOffsetX = -deltaWidth; // левый край смещается влево на полную величину
            localOffsetY = -deltaHeight; // верхний край смещается вверх на полную величину
            break;
        case 'n':  
            localOffsetX = 0;            // горизонтально не смещается
            localOffsetY = -deltaHeight; // верхний край смещается вверх на полную величину
            break;
        case 'ne': 
            localOffsetX = 0;            // правый край - левый верхний угол не смещается по X
            localOffsetY = -deltaHeight; // верхний край смещается вверх на полную величину
            break;
        case 'e':  
            localOffsetX = 0;            // правый край - левый верхний угол не смещается
            localOffsetY = 0;            // вертикально не смещается
            break;
        case 'se': 
            localOffsetX = 0;            // правый край - левый верхний угол не смещается по X
            localOffsetY = 0;            // нижний край - левый верхний угол не смещается по Y
            break;
        case 's':  
            localOffsetX = 0;            // горизонтально не смещается
            localOffsetY = 0;            // нижний край - левый верхний угол не смещается по Y
            break;
        case 'sw': 
            localOffsetX = -deltaWidth;  // левый край смещается влево на полную величину
            localOffsetY = 0;            // нижний край - левый верхний угол не смещается по Y
            break;
        case 'w':  
            localOffsetX = -deltaWidth;  // левый край смещается влево на полную величину
            localOffsetY = 0;            // вертикально не смещается
            break;
    }
    const angleRad = objectRotation * Math.PI / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    const worldOffsetX = localOffsetX * cos - localOffsetY * sin;
    const worldOffsetY = localOffsetX * sin + localOffsetY * cos;
    return { x: worldOffsetX, y: worldOffsetY };
}


