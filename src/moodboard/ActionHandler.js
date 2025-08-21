/**
 * Обрабатывает действия пользователя в MoodBoard
 */
export class ActionHandler {
    constructor(dataManager, workspaceManager) {
        this.dataManager = dataManager;
        this.workspaceManager = workspaceManager;
    }
    
    /**
     * Обрабатывает действия тулбара
     */
    handleToolbarAction(action) {
        switch (action.type) {
            case 'frame':
            case 'simple-text':
            case 'text':
            case 'note':
            case 'shape':
            case 'drawing':
            case 'emoji':
            case 'image':
            case 'comment':
                return this.handleCreateObject(action.type, action.position, action.properties || {});

            case 'delete-object':
                if (action.id) {
                    this.dataManager.deleteObject(action.id);
                }
                return null;
                
            case 'clear':
                return this.handleClearBoard();
                
            case 'export':
                return this.handleExportBoard();
                
            default:
                console.warn('Unknown toolbar action:', action.type);
                return null;
        }
    }
    
    /**
     * Обрабатывает создание объекта
     */
    handleCreateObject(type, position, properties = {}) {
        console.log(`🔧 ActionHandler: handleCreateObject called with type: ${type}, position:`, position, 'properties:', properties);
        const objectData = this.dataManager.createObject(type, position, properties);
        
        if (objectData) {
            console.log(`Created ${type} object:`, objectData);
        }
        
        return objectData;
    }
    
    /**
     * Обрабатывает очистку доски
     */
    handleClearBoard() {
        const clearedCount = this.dataManager.clearBoard();
        
        if (clearedCount > 0) {
            this.workspaceManager.showNotification(`Cleared ${clearedCount} objects`);
        } else {
            this.workspaceManager.showNotification('Board is already empty');
        }
        
        return clearedCount;
    }
    
    /**
     * Обрабатывает экспорт доски
     */
    handleExportBoard() {
        const data = this.dataManager.exportBoardData();
        
        if (data) {
            console.log('Board data:', data);
            this.workspaceManager.showNotification('Board data exported to console');
        } else {
            this.workspaceManager.showNotification('Failed to export board data');
        }
        
        return data;
    }
    
    /**
     * Обрабатывает программное создание объекта
     */
    createObject(type, position, properties = {}) {
        return this.dataManager.createObject(type, position, properties);
    }
    
    /**
     * Обрабатывает программное удаление объекта
     */
    deleteObject(objectId) {
        return this.dataManager.deleteObject(objectId);
    }
    
    /**
     * Обрабатывает программную очистку доски
     */
    clearBoard() {
        return this.handleClearBoard();
    }
    
    /**
     * Обрабатывает программный экспорт
     */
    exportBoard() {
        return this.handleExportBoard();
    }
}
