import * as PIXI from 'pixi.js';
import { Events } from '../../../core/events/Events.js';

export function hitTest(x, y) {
    // Проверяем, что инструмент не уничтожен
    if (this.destroyed) {
        return { type: 'empty' };
    }

    // Сначала проверяем ручки изменения размера (они имеют приоритет)
    if (this.resizeHandles) {
        const pixiObjectAtPoint = this.getPixiObjectAt(x, y);
        const handleInfo = this.resizeHandles.getHandleInfo(pixiObjectAtPoint);
        if (handleInfo) {
            // Определяем тип ручки
            const hitType = handleInfo.type === 'rotate' ? 'rotate-handle' : 'resize-handle';

            return {
                type: hitType,
                handle: handleInfo.type,
                object: handleInfo.targetObjectId,
                pixiObject: handleInfo.handle
            };
        }
    }

    // Получаем объекты из системы через событие
    const hitTestData = { x, y, result: null };
    this.emit(Events.Tool.HitTest, hitTestData);

    if (hitTestData.result && hitTestData.result.object) {
        return hitTestData.result;
    }

    return { type: 'empty' };
}

export function getPixiObjectAt(x, y) {
    // Проверяем, что инструмент не уничтожен
    if (this.destroyed) {
        return null;
    }

    if (!this.resizeHandles || !this.resizeHandles.app || !this.resizeHandles.container) return null;

    const point = new PIXI.Point(x, y);

    // Сначала ищем в контейнере ручек (приоритет)
    if (this.resizeHandles.container && this.resizeHandles.container.visible) {
        const container = this.resizeHandles.container;
        if (!container || !container.children) return null;

        for (let i = container.children.length - 1; i >= 0; i--) {
            const child = container.children[i];

            // Проверяем обычные объекты
            if (child && child.containsPoint && typeof child.containsPoint === 'function') {
                try {
                    if (child.containsPoint(point)) {
                        return child;
                    }
                } catch (_) {
                    // Игнорируем ошибки containsPoint
                }
            }

            // Специальная проверка для контейнеров (ручка вращения)
            if (child instanceof PIXI.Container && child.children && child.children.length > 0) {
                // Проверяем границы контейнера
                try {
                    const bounds = child.getBounds();
                    if (bounds && point.x >= bounds.x && point.x <= bounds.x + bounds.width &&
                        point.y >= bounds.y && point.y <= bounds.y + bounds.height) {
                        return child;
                    }
                } catch (_) {
                    // Игнорируем ошибки getBounds
                }
            }
        }
    }

    // Затем ищем в основной сцене
    const stage = this.resizeHandles.app.stage;
    if (!stage || !stage.children) return null;

    for (let i = stage.children.length - 1; i >= 0; i--) {
        const child = stage.children[i];
        if (this.resizeHandles.container && child && child !== this.resizeHandles.container &&
            child.containsPoint && typeof child.containsPoint === 'function') {
            try {
                if (child.containsPoint(point)) {
                    return child;
                }
            } catch (_) {
                // Игнорируем ошибки containsPoint
            }
        }
    }

    return null;
}
