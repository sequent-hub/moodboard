/**
 * Менеджер автоматического сохранения данных
 */
import { Events } from './events/Events.js';
export class SaveManager {
    constructor(eventBus, options = {}) {
        this.eventBus = eventBus;
        this.apiClient = null; // Будет установлен позже через setApiClient
        this.options = {
            // Фиксированные настройки автосохранения данных
            autoSave: true,
            // Уменьшенная задержка, чтобы изменения чаще успевали сохраняться
            // (раньше было 1500 мс)
            saveDelay: 400,
            maxRetries: 3,
            retryDelay: 1000,
            periodicSaveInterval: 30000, // Периодическое сохранение каждые 30 сек

            // Фоновая отправка при закрытии вкладки/перезагрузке страницы
            // (используется navigator.sendBeacon при поддержке браузером)
            useBeaconOnUnload: true,

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
     * Устанавливает ApiClient для использования в сохранении
     */
    setApiClient(apiClient) {
        this.apiClient = apiClient;
    }
    
    /**
     * Настройка обработчиков событий
     */
    setupEventListeners() {
        if (!this.options.autoSave) return;
        
        // Отслеживаем изменения сетки: не передаём частичные данные в сохранение,
        // чтобы собрать полный snapshot через getBoardData()
        this.eventBus.on(Events.Grid.BoardDataChanged, () => {
            this.markAsChanged();
        });
        
        // Отслеживаем создание объектов
        this.eventBus.on(Events.Object.Created, () => {
            this.markAsChanged();
        });
        
        // Отслеживаем изменения объектов
        this.eventBus.on(Events.Object.Updated, (data) => {

            this.markAsChanged();
        });
        
        // Отслеживаем удаление объектов
        this.eventBus.on(Events.Object.Deleted, () => {
            this.markAsChanged();
        });
        
        // Отслеживаем прямые изменения состояния (для Undo/Redo)
        this.eventBus.on(Events.Object.StateChanged, (data) => {

            this.markAsChanged();
        });
        
        // Отслеживание перемещений теперь происходит через команды и state:changed
        
        // Сохранение при закрытии страницы (в том числе при резком закрытии окна)
        window.addEventListener('beforeunload', (e) => {
            if (!this.hasUnsavedChanges) return;
            try {
                if (this.options.useBeaconOnUnload) {
                    this._flushOnUnload();
                } else {
                    this._flushSyncFallback();
                }
            } catch (_) { /* игнорируем, чтобы не блокировать закрытие */ }

            // Сообщаем браузеру, что есть незафиксированные изменения
            // (текст может быть проигнорирован, но событие задержит закрытие на доли секунды)
            e.preventDefault();
            e.returnedValue = '';
            e.returnValue = '';
            return '';
        }, { capture: true });
        
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

            // Защита: если данные не получены (например, при уничтожении/отписке обработчиков) — выходим без ошибки
            if (!saveData || typeof saveData !== 'object') {
                console.warn('SaveManager: нет данных для сохранения (saveData is null) — пропускаем сохранение');
                this.updateSaveStatus('idle');
                return;
            }
            
            // Проверяем, изменились ли данные с последнего сохранения
            if (this.lastSavedData && JSON.stringify(saveData) === JSON.stringify(this.lastSavedData)) {
                return; // Данные не изменились
            }
            
            this.isRequestInProgress = true;
            this.updateSaveStatus('saving');
            
            // Отправляем данные на сервер
            const response = await this.sendSaveRequest(saveData);
            
            // Проверяем успешность сохранения (разные форматы от ApiClient и прямого запроса)
            const isSuccess = response.success === true || (response.data !== undefined);
            
            if (isSuccess) {
                this.lastSavedData = JSON.parse(JSON.stringify(saveData));
                this.hasUnsavedChanges = false;
                this.retryCount = 0;
                this.updateSaveStatus('saved');
                
                // Эмитируем событие успешного сохранения
                this.eventBus.emit(Events.Save.Success, {
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
            this.eventBus.emit(Events.Save.GetBoardData, requestData);
            resolve(requestData.data);
        });
    }
    
    /**
     * Отправка запроса на сохранение
     */
    async sendSaveRequest(data) {
        const boardId = data.id || 'default';
        
        // Если есть ApiClient, используем его (он автоматически очистит данные изображений)
        if (this.apiClient) {
            return await this.apiClient.saveBoard(boardId, data);
        }
        
        // Fallback к прямому запросу (без очистки изображений)
        
        // Получаем CSRF токен
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        
        if (!csrfToken) {
            throw new Error('CSRF токен не найден. Добавьте <meta name="csrf-token" content="{{ csrf_token() }}"> в HTML.');
        }

        const requestBody = {
            boardId: boardId,
            boardData: data
        };

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
        this.eventBus.emit(Events.Save.Error, {
            error: error.message,
            retryCount: this.retryCount,
            maxRetries: this.options.maxRetries
        });
        
        // Повторная попытка сохранения
        if (this.retryCount < this.options.maxRetries) {

            
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
                this.eventBus.emit(Events.Save.Loaded, {
                    data: result.data,
                    timestamp: new Date().toISOString()
                });
                
                return result.data;
            } else {
                throw new Error(result.message || 'Ошибка загрузки');
            }
            
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
            this.eventBus.emit(Events.Save.LoadError, { error: error.message });
            throw error;
        }
    }
    
    /**
     * Обновление статуса сохранения
     */
    updateSaveStatus(status, message = '') {
        this.saveStatus = status;
        
        // Эмитируем событие изменения статуса
        this.eventBus.emit(Events.Save.StatusChanged, {
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
     * Синхронно собирает текущие данные для сохранения через EventBus.
     * Используется в обработчиках закрытия вкладки, где нет времени на ожидание async.
     */
    _collectCurrentDataSync() {
        try {
            const requestData = { data: null };
            this.eventBus && this.eventBus.emit(Events.Save.GetBoardData, requestData);
            return requestData.data || null;
        } catch (_) {
            return null;
        }
    }

    /**
     * Отправляет данные в фоне при закрытии вкладки (navigator.sendBeacon),
     * а при отсутствии поддержки — выполняет синхронный XHR как запасной вариант.
     */
    _flushOnUnload() {
        const data = this._collectCurrentDataSync();
        if (!data) return;

        const boardId = data.id || 'default';
        const payload = {
            boardId,
            // отправляем «сырой» снимок; на серверной стороне допускается приём JSON
            boardData: data,
            settings: data.settings || undefined,
            // CSRF токен добавим в тело (для серверов, которые принимают _token из JSON)
            _token: (typeof document !== 'undefined') ? (document.querySelector('meta[name="csrf-token"]')?.value || document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')) : undefined
        };

        const body = JSON.stringify(payload);

        let sent = false;
        try {
            if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
                const blob = new Blob([body], { type: 'application/json' });
                sent = navigator.sendBeacon(this.options.saveEndpoint, blob);
            }
        } catch (_) { /* игнорируем */ }

        if (!sent) {
            // Фолбэк: синхронный XHR (доступен в beforeunload, но может быть заблокирован политиками браузера)
            this._flushSyncFallback(data);
        }

        // Считаем, что попытались сохранить; снимаем флаг, чтобы не спамить повторно
        this.hasUnsavedChanges = false;
    }

    /**
     * Синхронная отправка запроса на сохранение (fallback для устаревших браузеров).
     */
    _flushSyncFallback(existingData) {
        try {
            const data = existingData || this._collectCurrentDataSync();
            if (!data) return;

            const boardId = data.id || 'default';
            const csrfToken = (typeof document !== 'undefined') ? (document.querySelector('meta[name="csrf-token"]').getAttribute('content')) : null;

            const xhr = new XMLHttpRequest();
            xhr.open('POST', this.options.saveEndpoint, false); // синхронно
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.setRequestHeader('Accept', 'application/json');
            if (csrfToken) xhr.setRequestHeader('X-CSRF-TOKEN', csrfToken);

            const payload = {
                b: boardId,
                boardData: data,
                settings: data.settings || undefined,
                _token: csrfToken || undefined
            };
            try { xhr.send(JSON.stringify(payload)); } catch (_) { /* игнорируем */ }
        } catch (_) { /* игнорируем */ }
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
        
        // Удаляем обработчики событий (константы)
        this.eventBus.off(Events.Grid.BoardDataChanged);
        this.eventBus.off(Events.Object.Created);
        this.eventBus.off(Events.Object.Updated);
        this.eventBus.off(Events.Object.Deleted);
        this.eventBus.off(Events.Tool.DragEnd);
    }
}
