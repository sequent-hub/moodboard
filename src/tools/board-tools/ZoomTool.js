import { BaseTool } from '../BaseTool.js';

/**
 * Инструмент масштабирования доски
 */
export class ZoomTool extends BaseTool {
    constructor(eventBus) {
        super('zoom', eventBus);
        this.cursor = 'zoom-in';
        this.hotkey = 'z';
        
        // Настройки масштабирования
        this.minZoom = 0.1;
        this.maxZoom = 10.0;
        this.currentZoom = 1.0;
        this.zoomStep = 0.1;
        this.wheelZoomSpeed = 0.1;
        
        // Режимы зума
        this.zoomMode = 'in'; // 'in' | 'out' | 'fit'
        
        // Состояние drag-to-zoom
        this.isDragZooming = false;
        this.zoomRect = null;
    }
    
    /**
     * Клик для зума в точку
     */
    onMouseDown(event) {
        super.onMouseDown(event);
        
        if (event.button === 0) { // Левая кнопка
            if (event.originalEvent.shiftKey) {
                // Shift + клик = zoom out
                this.zoomOut(event.x, event.y);
            } else if (event.originalEvent.altKey) {
                // Alt + drag = zoom to rectangle
                this.startDragZoom(event);
            } else {
                // Обычный клик = zoom in
                this.zoomIn(event.x, event.y);
            }
        }
    }
    
    /**
     * Обновление drag-to-zoom
     */
    onMouseMove(event) {
        super.onMouseMove(event);
        
        if (this.isDragZooming) {
            this.updateDragZoom(event);
        } else {
            // Обновляем курсор в зависимости от модификаторов
            this.updateCursor(event);
        }
    }
    
    /**
     * Завершение drag-to-zoom
     */
    onMouseUp(event) {
        if (this.isDragZooming) {
            this.endDragZoom(event);
        }
        
        super.onMouseUp(event);
    }
    
    /**
     * Масштабирование колесиком мыши
     */
    onMouseWheel(event) {
        if (event.ctrlKey || event.metaKey) {
            // Ctrl/Cmd + колесико = зум
            const zoomDelta = -event.delta * this.wheelZoomSpeed;
            this.zoomByDelta(zoomDelta, event.x, event.y);
            event.originalEvent.preventDefault();
        }
    }
    
    /**
     * Горячие клавиши для зума
     */
    onKeyDown(event) {
        switch (event.key) {
            case '=':
            case '+':
                this.zoomIn();
                event.originalEvent.preventDefault();
                break;
                
            case '-':
            case '_':
                this.zoomOut();
                event.originalEvent.preventDefault();
                break;
                
            case '0':
                this.resetZoom();
                event.originalEvent.preventDefault();
                break;
                
            case '1':
                this.zoomToFit();
                event.originalEvent.preventDefault();
                break;
                
            case '2':
                this.zoomToSelection();
                event.originalEvent.preventDefault();
                break;
        }
    }
    
    /**
     * Увеличение масштаба
     */
    zoomIn(centerX = null, centerY = null) {
        const newZoom = Math.min(this.maxZoom, this.currentZoom + this.zoomStep);
        this.setZoom(newZoom, centerX, centerY);
    }
    
    /**
     * Уменьшение масштаба
     */
    zoomOut(centerX = null, centerY = null) {
        const newZoom = Math.max(this.minZoom, this.currentZoom - this.zoomStep);
        this.setZoom(newZoom, centerX, centerY);
    }
    
    /**
     * Масштабирование на указанную дельту
     */
    zoomByDelta(delta, centerX = null, centerY = null) {
        const newZoom = Math.max(this.minZoom, 
            Math.min(this.maxZoom, this.currentZoom + delta));
        this.setZoom(newZoom, centerX, centerY);
    }
    
    /**
     * Установка конкретного масштаба
     */
    setZoom(zoom, centerX = null, centerY = null, animated = false) {
        const clampedZoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
        
        if (clampedZoom === this.currentZoom) return;
        
        const oldZoom = this.currentZoom;
        this.currentZoom = clampedZoom;
        
        this.emit('zoom:change', {
            zoom: this.currentZoom,
            oldZoom,
            centerX,
            centerY,
            animated
        });
        
        this.updateZoomPercentage();
    }
    
    /**
     * Сброс масштаба к 100%
     */
    resetZoom(animated = true) {
        this.setZoom(1.0, null, null, animated);
    }
    
    /**
     * Подгонка под размер экрана
     */
    zoomToFit(animated = true) {
        this.emit('zoom:fit', { animated });
    }
    
    /**
     * Масштабирование к выделенным объектам
     */
    zoomToSelection(animated = true) {
        this.emit('zoom:selection', { animated });
    }
    
    /**
     * Масштабирование к области
     */
    zoomToRect(x, y, width, height, animated = true) {
        this.emit('zoom:rect', {
            bounds: { x, y, width, height },
            animated
        });
    }
    
    /**
     * Начало drag-to-zoom
     */
    startDragZoom(event) {
        this.isDragZooming = true;
        this.zoomRect = {
            startX: event.x,
            startY: event.y,
            endX: event.x,
            endY: event.y
        };
        
        this.cursor = 'crosshair';
        this.setCursor();
        
        this.emit('zoom:drag:start', {
            startPoint: { x: event.x, y: event.y }
        });
    }
    
    /**
     * Обновление drag-to-zoom
     */
    updateDragZoom(event) {
        if (!this.zoomRect) return;
        
        this.zoomRect.endX = event.x;
        this.zoomRect.endY = event.y;
        
        // Вычисляем размеры прямоугольника
        const rect = this.normalizeRect(this.zoomRect);
        
        this.emit('zoom:drag:update', {
            rect: { ...rect }
        });
    }
    
    /**
     * Завершение drag-to-zoom
     */
    endDragZoom(event) {
        if (!this.zoomRect) return;
        
        const rect = this.normalizeRect(this.zoomRect);
        
        // Зумим только если прямоугольник достаточно большой
        const minSize = 20;
        if (rect.width > minSize && rect.height > minSize) {
            this.zoomToRect(rect.x, rect.y, rect.width, rect.height);
        }
        
        this.emit('zoom:drag:end', {
            rect: { ...rect }
        });
        
        this.isDragZooming = false;
        this.zoomRect = null;
        this.updateCursor();
    }
    
    /**
     * Нормализация прямоугольника (чтобы width и height были положительными)
     */
    normalizeRect(rect) {
        const x = Math.min(rect.startX, rect.endX);
        const y = Math.min(rect.startY, rect.endY);
        const width = Math.abs(rect.endX - rect.startX);
        const height = Math.abs(rect.endY - rect.startY);
        
        return { x, y, width, height };
    }
    
    /**
     * Обновление курсора в зависимости от модификаторов
     */
    updateCursor(event = null) {
        if (this.isDragZooming) {
            this.cursor = 'crosshair';
        } else if (event && event.originalEvent) {
            if (event.originalEvent.shiftKey) {
                this.cursor = 'zoom-out';
            } else if (event.originalEvent.altKey) {
                this.cursor = 'crosshair';
            } else {
                this.cursor = 'zoom-in';
            }
        } else {
            this.cursor = this.zoomMode === 'out' ? 'zoom-out' : 'zoom-in';
        }
        
        this.setCursor();
    }
    
    /**
     * Переключение режима зума
     */
    setZoomMode(mode) {
        this.zoomMode = mode;
        this.updateCursor();
    }
    
    /**
     * Обновление отображения процента зума
     */
    updateZoomPercentage() {
        const percentage = Math.round(this.currentZoom * 100);
        
        this.emit('zoom:percentage', {
            zoom: this.currentZoom,
            percentage
        });
    }
    
    /**
     * Получение текущего масштаба
     */
    getCurrentZoom() {
        return this.currentZoom;
    }
    
    /**
     * Получение процента масштаба
     */
    getZoomPercentage() {
        return Math.round(this.currentZoom * 100);
    }
    
    /**
     * Проверка возможности увеличения
     */
    canZoomIn() {
        return this.currentZoom < this.maxZoom;
    }
    
    /**
     * Проверка возможности уменьшения
     */
    canZoomOut() {
        return this.currentZoom > this.minZoom;
    }
    
    /**
     * Установка ограничений масштаба
     */
    setZoomLimits(minZoom, maxZoom) {
        this.minZoom = Math.max(0.01, minZoom);
        this.maxZoom = Math.min(100, maxZoom);
        
        // Ограничиваем текущий зум новыми пределами
        if (this.currentZoom < this.minZoom || this.currentZoom > this.maxZoom) {
            this.setZoom(Math.max(this.minZoom, Math.min(this.maxZoom, this.currentZoom)));
        }
    }
    
    /**
     * Установка шага зума
     */
    setZoomStep(step) {
        this.zoomStep = Math.max(0.01, Math.min(1.0, step));
    }
    
    /**
     * Получение настроек инструмента
     */
    getSettings() {
        return {
            ...super.getSettings(),
            currentZoom: this.currentZoom,
            minZoom: this.minZoom,
            maxZoom: this.maxZoom,
            zoomStep: this.zoomStep,
            zoomMode: this.zoomMode
        };
    }
    
    /**
     * Активация инструмента
     */
    onActivate() {
        super.onActivate();
        
        this.emit('tool:hint', {
            message: 'Click to zoom in • Shift+Click to zoom out • Alt+Drag to zoom to area • Ctrl+Wheel to zoom'
        });
    }
    
    /**
     * Деактивация инструмента
     */
    onDeactivate() {
        if (this.isDragZooming) {
            this.isDragZooming = false;
            this.zoomRect = null;
        }
        
        super.onDeactivate();
    }
}
