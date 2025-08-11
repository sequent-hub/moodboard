/**
 * Менеджер автоматического сохранения данных
 */
export class SaveManager {
    constructor(eventBus, options = {}) {
        this.eventBus = eventBus;
        this.options = {
            // Фиксированные настройки автосохранения (не настраиваются клиентом)
            autoSave: true,
            saveDelay: 1500, // Оптимальная задержка 1.5 секунды
            maxRetries: 3,
            retryDelay: 1000,
            periodicSaveInterval: 30000, // Периодическое сохранение каждые 30 сек
            
            // Настраиваемые эндпоинты (берем из options)
            saveEndpoint: options.saveEndpoint || '/api/moodboard/save',
            loadEndpoint: options.loadEndpoint || '/api/moodboard/load'
        };
        
        this.saveTimer = null;
        this.isRequestInProgress = false;
        this.retryCount = 0;
        this.lastSavedData = null;
        this.hasUnsavedChanges = false;
        
        // Состояния сохранения
        this.saveStatus = 'idle'; // idle, saving, saved, error
        
        this.setupEventListeners();
    }
    
    /**
     * Настройка обработчиков событий
     */
    setupEventListeners() {
        if (!this.options.autoSave) return;
        
        // Отслеживаем изменения в данных
        this.eventBus.on('board:data-changed', (data) => {
            this.scheduleAutoSave(data);
        });
        
        // Отслеживаем создание объектов
        this.eventBus.on('object:created', () => {
            this.markAsChanged();
        });
        
        // Отслеживаем изменения объектов
        this.eventBus.on('object:updated', (data) => {
            console.log('🔄 Объект обновлен:', data.objectId, 'новая позиция:', data.position);
            this.markAsChanged();
        });
        
        // Отслеживаем удаление объектов
        this.eventBus.on('object:deleted', () => {
            this.markAsChanged();
        });
        
        // Отслеживаем перемещения объектов
        this.eventBus.on('tool:drag:end', () => {
            this.markAsChanged();
        });
        
        // Сохранение при закрытии страницы
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges) {
                this.saveImmediately();
                // Предупреждаем о несохраненных изменениях
                e.preventDefault();
                e.returnValue = 'У вас есть несохраненные изменения. Вы уверены, что хотите покинуть страницу?';
                return e.returnValue;
            }
        });
        
        // Периодическое автосохранение
        if (this.options.autoSave) {
            setInterval(() => {
                if (this.hasUnsavedChanges && !this.isRequestInProgress) {
                    this.saveImmediately();
                }
            }, this.options.periodicSaveInterval);
        }
    }
    
    /**
     * Отметить данные как измененные
     */
    markAsChanged() {
        this.hasUnsavedChanges = true;
        this.scheduleAutoSave();
    }
    
    /**
     * Запланировать автоматическое сохранение с задержкой
     */
    scheduleAutoSave(data = null) {
        if (!this.options.autoSave) return;
        
        // Отменяем предыдущий таймер
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
        }
        
        // Устанавливаем новый таймер
        this.saveTimer = setTimeout(() => {
            this.saveImmediately(data);
        }, this.options.saveDelay);
        
        // Обновляем статус
        this.updateSaveStatus('pending');
    }
    
    /**
     * Немедленное сохранение
     */
    async saveImmediately(data = null) {
        if (this.isRequestInProgress) return;
        
        try {
            // Получаем данные для сохранения
            const saveData = data || await this.getBoardData();
            
            // Проверяем, изменились ли данные с последнего сохранения
            if (this.lastSavedData && JSON.stringify(saveData) === JSON.stringify(this.lastSavedData)) {
                return; // Данные не изменились
            }
            
            this.isRequestInProgress = true;
            this.updateSaveStatus('saving');
            
            // Отправляем данные на сервер
            const response = await this.sendSaveRequest(saveData);
            
            if (response.success) {
                this.lastSavedData = JSON.parse(JSON.stringify(saveData));
                this.hasUnsavedChanges = false;
                this.retryCount = 0;
                this.updateSaveStatus('saved');
                
                // Эмитируем событие успешного сохранения
                this.eventBus.emit('save:success', {
                    data: saveData,
                    timestamp: new Date().toISOString()
                });
            } else {
                throw new Error(response.message || 'Ошибка сохранения');
            }
            
        } catch (error) {
            console.error('Ошибка автосохранения:', error);
            this.handleSaveError(error, data);
        } finally {
            this.isRequestInProgress = false;
        }
    }
    
    /**
     * Получение данных доски для сохранения
     */
    async getBoardData() {
        return new Promise((resolve) => {
            const requestData = { data: null };
            this.eventBus.emit('save:get-board-data', requestData);
            resolve(requestData.data);
        });
    }
    
    /**
     * Отправка запроса на сохранение
     */
    async sendSaveRequest(data) {
        // Получаем CSRF токен
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        
        if (!csrfToken) {
            throw new Error('CSRF токен не найден. Добавьте <meta name="csrf-token" content="{{ csrf_token() }}"> в HTML.');
        }

        const requestBody = {
            boardId: data.id || 'default',
            boardData: data
        };

        console.log('🚀 Отправка данных на сервер:', {
            endpoint: this.options.saveEndpoint,
            boardId: requestBody.boardId,
            dataSize: JSON.stringify(requestBody).length,
            objectsCount: requestBody.boardData?.objects?.length || 0
        });

        const response = await fetch(this.options.saveEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-CSRF-TOKEN': csrfToken,
                'X-Requested-With': 'XMLHttpRequest'
            },
            credentials: 'same-origin', // Важно для работы с куки Laravel
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            
            try {
                const errorData = await response.json();
                if (errorData.message) {
                    errorMessage = errorData.message;
                }
                if (errorData.errors) {
                    // Laravel validation errors
                    const validationErrors = Object.values(errorData.errors).flat();
                    errorMessage += '. ' + validationErrors.join(', ');
                }
            } catch (parseError) {
                // Если не удалось распарсить JSON ошибки, используем стандартное сообщение
                console.warn('Не удалось распарсить ошибку сервера:', parseError);
            }
            
            throw new Error(errorMessage);
        }
        
        return await response.json();
    }
    
    /**
     * Обработка ошибок сохранения
     */
    async handleSaveError(error, data) {
        this.retryCount++;
        this.updateSaveStatus('error', error.message);
        
        // Эмитируем событие ошибки
        this.eventBus.emit('save:error', {
            error: error.message,
            retryCount: this.retryCount,
            maxRetries: this.options.maxRetries
        });
        
        // Повторная попытка сохранения
        if (this.retryCount < this.options.maxRetries) {
            console.log(`Повторная попытка сохранения через ${this.options.retryDelay}мс (попытка ${this.retryCount + 1}/${this.options.maxRetries})`);
            
            setTimeout(() => {
                this.saveImmediately(data);
            }, this.options.retryDelay * this.retryCount); // Увеличиваем задержку с каждой попыткой
        }
    }
    
    /**
     * Загрузка данных с сервера
     */
    async loadBoardData(boardId) {
        try {
            const response = await fetch(`${this.options.loadEndpoint}/${boardId}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                this.lastSavedData = result.data;
                this.hasUnsavedChanges = false;
                
                // Эмитируем событие загрузки
                this.eventBus.emit('save:loaded', {
                    data: result.data,
                    timestamp: new Date().toISOString()
                });
                
                return result.data;
            } else {
                throw new Error(result.message || 'Ошибка загрузки');
            }
            
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
            this.eventBus.emit('save:load-error', { error: error.message });
            throw error;
        }
    }
    
    /**
     * Обновление статуса сохранения
     */
    updateSaveStatus(status, message = '') {
        this.saveStatus = status;
        
        // Эмитируем событие изменения статуса
        this.eventBus.emit('save:status-changed', {
            status,
            message,
            hasUnsavedChanges: this.hasUnsavedChanges,
            timestamp: new Date().toISOString()
        });
    }
    
    /**
     * Принудительное сохранение (вызывается пользователем)
     */
    async forceSave() {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
        
        await this.saveImmediately();
    }
    
    /**
     * Включение/выключение автосохранения
     */
    setAutoSave(enabled) {
        this.options.autoSave = enabled;
        
        if (!enabled && this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
    }
    
    /**
     * Получение текущего статуса
     */
    getStatus() {
        return {
            saveStatus: this.saveStatus,
            hasUnsavedChanges: this.hasUnsavedChanges,
            isRequestInProgress: this.isRequestInProgress,
            retryCount: this.retryCount,
            autoSaveEnabled: this.options.autoSave
        };
    }
    
    /**
     * Очистка ресурсов
     */
    destroy() {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
        }
        
        // Финальное сохранение перед уничтожением
        if (this.hasUnsavedChanges && this.options.autoSave) {
            this.saveImmediately();
        }
        
        // Удаляем обработчики событий
        this.eventBus.off('board:data-changed');
        this.eventBus.off('object:created');
        this.eventBus.off('object:updated');
        this.eventBus.off('object:deleted');
        this.eventBus.off('tool:drag:end');
    }
}
