/**
 * Сервис для загрузки и управления изображениями на сервере
 */
export class ImageUploadService {
    constructor(apiClient, options = {}) {
        this.apiClient = apiClient;
        this.uploadEndpoint = '/api/v2/images/upload';
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
     * Загружает изображение на сервер
     * @param {File|Blob} file - файл изображения
     * @param {string} name - имя файла
     * @returns {Promise<{url: string, width: number, height: number}>}
     */
    async uploadImage(file, name = null) {
        try {
            // Получаем размеры изображения перед загрузкой
            const dimensions = await this._getImageDimensions(file);
            
            // Создаем FormData для отправки файла
            const formData = new FormData();
            formData.append('image', file);
            formData.append('name', name || file.name || 'image.png');
            formData.append('width', dimensions.width.toString());
            formData.append('height', dimensions.height.toString());

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
            
            if (!result.success) {
                throw new Error(result.message || 'Ошибка загрузки изображения');
            }

            const serverUrl = typeof result.data.url === 'string' ? result.data.url.trim() : '';
            if (!this._isPersistedImageSrc(serverUrl)) {
                throw new Error('Некорректный URL изображения от сервера. Ожидается непустой src без data:/blob:.');
            }
            console.log('Image upload response data.url:', serverUrl);

            return {
                url: serverUrl,
                width: result.data.width,
                height: result.data.height,
                name: result.data.name,
                size: result.data.size
            };

        } catch (error) {
            console.error('Ошибка загрузки изображения:', error);
            throw error;
        }
    }

    _isPersistedImageSrc(url) {
        if (typeof url !== 'string') return false;
        const raw = url.trim();
        if (!raw) return false;
        if (/^data:/i.test(raw) || /^blob:/i.test(raw)) return false;
        if (/^\/api\/images\//i.test(raw)) return false;
        return true;
    }

    /**
     * Загружает изображение из base64 DataURL
     * @param {string} dataUrl - base64 DataURL
     * @param {string} name - имя файла
     * @returns {Promise<{url: string, width: number, height: number}>}
     */
    async uploadFromDataUrl(dataUrl, name = 'clipboard-image.png') {
        const blob = await this._dataUrlToBlob(dataUrl);
        return this.uploadImage(blob, name);
    }

    /**
     * Получает размеры изображения из файла или blob
     * @private
     */
    _getImageDimensions(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            
            img.onload = () => {
                resolve({
                    width: img.naturalWidth || img.width,
                    height: img.naturalHeight || img.height
                });
                URL.revokeObjectURL(url);
            };
            
            img.onerror = () => {
                reject(new Error('Не удалось загрузить изображение для определения размеров'));
                URL.revokeObjectURL(url);
            };
            
            img.src = url;
        });
    }

    /**
     * Конвертирует DataURL в Blob
     * @private
     */
    _dataUrlToBlob(dataUrl) {
        return new Promise((resolve) => {
            const arr = dataUrl.split(',');
            const mime = arr[0].match(/:(.*?);/)[1];
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            
            resolve(new Blob([u8arr], { type: mime }));
        });
    }

    /**
     * Проверяет, является ли URL внешней ссылкой на изображение
     */
    static isExternalImageUrl(url) {
        if (!url || typeof url !== 'string') return false;
        return /^https?:\/\/.+\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(url);
    }

    /**
     * Проверяет, является ли строка base64 DataURL
     */
    static isDataUrl(str) {
        if (!str || typeof str !== 'string') return false;
        return /^data:image\/.+;base64,/.test(str);
    }
}
