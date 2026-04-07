/**
 * Сервис для загрузки и управления файлами на сервере
 */
export class FileUploadService {
    constructor(apiClient, options = {}) {
        this.apiClient = apiClient;
        this.uploadEndpoint = '/api/v2/files/upload';
        this.options = {
            csrfToken: null, // Можно передать токен напрямую
            csrfTokenSelector: 'meta[name="csrf-token"]', // Селектор для поиска токена в DOM
            requireCsrf: true, // Требовать ли CSRF токен
            ...options
        };
    }

    /**
     * Получает CSRF токен из различных источников
     * @private
     */
    _getCsrfToken() {
        // 1. Сначала проверяем токен, переданный в опциях
        if (this.options.csrfToken) {
            return this.options.csrfToken;
        }

        // 2. Ищем токен в DOM
        if (typeof document !== 'undefined') {
            const tokenElement = document.querySelector(this.options.csrfTokenSelector);
            if (tokenElement) {
                return tokenElement.getAttribute('content');
            }
        }

        // 3. Проверяем глобальную переменную (для тестирования)
        if (typeof window !== 'undefined' && window.csrfToken) {
            return window.csrfToken;
        }

        // 4. Если CSRF не требуется, возвращаем null
        if (!this.options.requireCsrf) {
            return null;
        }

        return null;
    }

    /**
     * Загружает файл на сервер
     * @param {File|Blob} file - файл для загрузки
     * @param {string} name - имя файла
     * @returns {Promise<{src: string, size: number, name: string, mimeType: string}>}
     */
    async uploadFile(file, name = null) {
        try {
            // Создаем FormData для отправки файла
            const formData = new FormData();
            formData.append('file', file);
            formData.append('name', name || file.name || 'file');

            // Получаем CSRF токен
            const csrfToken = this._getCsrfToken();
            
            if (this.options.requireCsrf && !csrfToken) {
                throw new Error('CSRF токен не найден. Добавьте <meta name="csrf-token" content="{{ csrf_token() }}"> в HTML или передайте токен в опциях.');
            }

            const headers = {
                'X-Requested-With': 'XMLHttpRequest'
            };

            // Добавляем CSRF токен только если он есть
            if (csrfToken) {
                headers['X-CSRF-TOKEN'] = csrfToken;
            }

            const response = await fetch(this.uploadEndpoint, {
                method: 'POST',
                headers,
                credentials: 'same-origin',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(errorData?.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            const status = response.status;
            
            if (!result.success) {
                throw new Error(result.message || 'Ошибка загрузки файла');
            }

            const serverUrl = typeof result.data.url === 'string' ? result.data.url.trim() : '';
            if (!serverUrl) {
                throw new Error('Сервер не вернул data.url для файла.');
            }
            console.log('File upload diagnostics:', {
                status,
                success: !!result.success,
                url: serverUrl
            });

            return {
                src: serverUrl,
                size: result.data.size,
                name: result.data.name,
                mimeType: result.data.mime_type || result.data.type || file.type || 'application/octet-stream'
            };

        } catch (error) {
            console.error('Ошибка загрузки файла:', error);
            throw error;
        }
    }

    /**
     * Проверяет, поддерживается ли тип файла для предварительного просмотра
     */
    static canPreview(mimeType) {
        const previewableTypes = [
            'image/',
            'text/',
            'application/pdf',
            'application/json'
        ];
        
        return previewableTypes.some(type => mimeType.startsWith(type));
    }

    /**
     * Получает иконку файла по MIME типу
     */
    static getFileIcon(mimeType) {
        const iconMap = {
            'application/pdf': 'pdf',
            'application/msword': 'doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'doc',
            'application/vnd.ms-excel': 'xls',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xls',
            'application/vnd.ms-powerpoint': 'ppt',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'ppt',
            'application/zip': 'archive',
            'application/x-rar-compressed': 'archive',
            'application/x-7z-compressed': 'archive',
            'text/': 'text',
            'image/': 'image',
            'video/': 'video',
            'audio/': 'audio'
        };

        for (const [type, icon] of Object.entries(iconMap)) {
            if (mimeType.startsWith(type)) {
                return icon;
            }
        }

        return 'file';
    }
}
