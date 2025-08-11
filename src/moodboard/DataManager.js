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
        
        console.log('📥 DataManager загружает данные:', {
            objects: data.objects?.length || 0,
            viewport: !!data.viewport
        });
        
        // Очищаем доску перед загрузкой
        this.clearBoard();
        
        // Загружаем объекты
        if (data.objects && Array.isArray(data.objects)) {
            console.log('📦 Загружаем объекты:', data.objects.length);
            
            data.objects.forEach((objectData, index) => {
                try {
                    // Используем полные данные объекта, включая ID
                    const createdObject = this.coreMoodboard.createObjectFromData(objectData);
                    console.log(`✅ Объект ${index + 1}/${data.objects.length} загружен:`, objectData.type, objectData.id);
                } catch (error) {
                    console.error(`❌ Ошибка загрузки объекта ${index + 1}:`, error, objectData);
                }
            });
        }
        
        // Загружаем viewport
        if (data.viewport) {
            this.loadViewport(data.viewport);
        }
        
        console.log('✅ DataManager завершил загрузку данных');
    }
    
    /**
     * Загружает настройки viewport (позиция и зум)
     */
    loadViewport(viewport) {
        // TODO: Реализовать установку viewport
        console.log('Loading viewport:', viewport);
        
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
        
        const objects = this.coreMoodboard.objects || [];
        objects.forEach(obj => this.coreMoodboard.deleteObject(obj.id));
        
        console.log('Board cleared');
        return objects.length;
    }
    
    /**
     * Создает объект на доске
     */
    createObject(type, position, properties = {}) {
        if (!this.coreMoodboard) return null;
        
        return this.coreMoodboard.createObject(type, position, properties);
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
