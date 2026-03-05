import { Events } from '../../../core/events/Events.js';

export function updateCursor(event, defaultCursor) {
    // Проверяем, что инструмент не уничтожен
    if (this.destroyed) {
        return;
    }

    const hitResult = this.hitTest(event.x, event.y);

    switch (hitResult.type) {
        case 'resize-handle':
            this.cursor = this.getResizeCursor(hitResult.handle);
            break;
        case 'rotate-handle':
            this.cursor = 'grab';
            break;
        case 'object':
            this.cursor = 'move';
            break;
        default:
            this.cursor = defaultCursor;
    }

    this.setCursor();
}

export function createRotatedResizeCursor(handleType, rotationDegrees) {
    // Базовые углы для каждого типа ручки (в градусах)
    const baseAngles = {
        'e': 0,     // Восток - горизонтальная стрелка →
        'se': 45,   // Юго-восток - диагональная стрелка ↘
        's': 90,    // Юг - вертикальная стрелка ↓
        'sw': 135,  // Юго-запад - диагональная стрелка ↙
        'w': 180,   // Запад - горизонтальная стрелка ←
        'nw': 225,  // Северо-запад - диагональная стрелка ↖
        'n': 270,   // Север - вертикальная стрелка ↑
        'ne': 315   // Северо-восток - диагональная стрелка ↗
    };

    // Вычисляем итоговый угол: базовый угол ручки + поворот объекта
    const totalAngle = (baseAngles[handleType] + rotationDegrees) % 360;

    // Создаем SVG курсор изменения размера, повернутый на нужный угол (белый, крупнее)
    const svg = `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><g transform="rotate(${totalAngle} 16 16)"><path d="M4 16 L9 11 L9 13 L23 13 L23 11 L28 16 L23 21 L23 19 L9 19 L9 21 Z" fill="white" stroke="black" stroke-width="1"/></g></svg>`;

    // Используем encodeURIComponent вместо btoa для безопасного кодирования
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

    // Возвращаем CSS cursor с кастомным изображением (hotspot в центре 16x16)
    return `url("${dataUrl}") 16 16, auto`;
}

export function getResizeCursor(handle, defaultCursor) {
    // Получаем ID выбранного объекта для определения его поворота
    const selectedObject = Array.from(this.selectedObjects)[0];
    if (!selectedObject) {
        return defaultCursor;
    }

    // Получаем угол поворота объекта
    const rotationData = { objectId: selectedObject, rotation: 0 };
    this.emit(Events.Tool.GetObjectRotation, rotationData);
    const objectRotation = rotationData.rotation || 0;

    // Создаем кастомный курсор, повернутый на точный угол объекта
    return this.createRotatedResizeCursor(handle, objectRotation);
}

export function setCursor() {
    if (this.resizeHandles && this.resizeHandles.app && this.resizeHandles.app.view) {
        // Устанавливаем курсор на canvas, а не на body
        this.resizeHandles.app.view.style.cursor = this.cursor;
    } else {
        // Fallback на базовую реализацию
        this.__baseSetCursor();
    }
}
