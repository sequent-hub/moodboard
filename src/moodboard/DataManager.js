/**
 * Управляет загрузкой и сохранением данных MoodBoard
 */
export class DataManager {
    constructor(coreMoodboard) {
        this.coreMoodboard = coreMoodboard;
    }
    
    /**
     * Загружает данные в MoodBoard
     */
    loadData(data) {
        if (!data) return;
        

        
        // Очищаем доску перед загрузкой
        this.clearBoard();
        
        // Загружаем объекты
        if (data.objects && Array.isArray(data.objects)) {

            
            data.objects.forEach((objectData, index) => {
                try {
                    // Используем полные данные объекта, включая ID
                    const createdObject = this.coreMoodboard.createObjectFromData(objectData);

                } catch (error) {
                    console.error(`❌ Ошибка загрузки объекта ${index + 1}:`, error, objectData);
                }
            });
        }
        
        // Загружаем viewport
        if (data.viewport) {
            this.loadViewport(data.viewport);
        }
        
        // ИСПРАВЛЕНИЕ: Принудительно пересоздаем HTML элементы после загрузки данных
        // Это нужно потому что createObjectFromData() НЕ генерирует Events.Object.Created
        // чтобы не запускать автосохранение, но HtmlTextLayer нуждается в этих событиях
        setTimeout(() => {
            // Ищем htmlTextLayer через глобальную переменную (установленную в MoodBoard.js)
            if (window.moodboardHtmlTextLayer) {
                window.moodboardHtmlTextLayer.rebuildFromState();
                window.moodboardHtmlTextLayer.updateAll();
            }
        }, 100);

    }
    
    /**
     * Загружает настройки viewport (позиция и зум)
     */
    loadViewport(viewport) {
        // TODO: Реализовать установку viewport

        
        // Здесь будет код для установки позиции и зума canvas
        // this.coreMoodboard.setViewport(viewport.x, viewport.y, viewport.zoom);
    }
    
    /**
     * Экспортирует данные доски
     */
    exportBoardData() {
        if (!this.coreMoodboard) {
            return null;
        }
        
        const data = this.coreMoodboard.boardData;
        
        // Создаем событие для внешнего использования
        this.coreMoodboard.eventBus.emit('board:export', data);
        
        return data;
    }
    
    /**
     * Очищает все объекты на доске
     */
    clearBoard() {
        if (!this.coreMoodboard) return;
        
        // 1) Удаляем все объекты, известные состоянию
        const objects = this.coreMoodboard.objects || [];
        objects.forEach(obj => this.coreMoodboard.deleteObject(obj.id));

        // 2) Страховка: удаляем «висячие» PIXI-объекты, которые не попали в state
        try {
            const pixi = this.coreMoodboard.pixi;
            const stateIds = new Set((this.coreMoodboard.state?.state?.objects || []).map(o => o && o.id));
            if (pixi && pixi.objects && pixi.objects.size > 0) {
                for (const [objectId] of pixi.objects) {
                    if (!stateIds.has(objectId)) {
                        pixi.removeObject(objectId);
                    }
                }
            }
        } catch (_) { /* no-op */ }

        return objects.length;
    }
    
    /**
     * Создает объект на доске
     */
    createObject(type, position, properties = {}, extraData = {}) {
        if (!this.coreMoodboard) return null;
        
        return this.coreMoodboard.createObject(type, position, properties, extraData);
    }
    
    /**
     * Удаляет объект с доски
     */
    deleteObject(objectId) {
        if (!this.coreMoodboard) return;
        
        this.coreMoodboard.deleteObject(objectId);
    }
    
    /**
     * Получает все объекты доски
     */
    get objects() {
        return this.coreMoodboard ? this.coreMoodboard.objects : [];
    }
    
    /**
     * Получает данные доски
     */
    get boardData() {
        return this.coreMoodboard ? this.coreMoodboard.boardData : null;
    }
}
