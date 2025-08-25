/**
 * Сервис для загрузки и управления изображениями на сервере
 */
export class ImageUploadService {
    constructor(apiClient) {
        this.apiClient = apiClient;
        this.uploadEndpoint = '/api/images/upload';
        this.deleteEndpoint = '/api/images';
    }

    /**
     * Загружает изображение на сервер
     * @param {File|Blob} file - файл изображения
     * @param {string} name - имя файла
     * @returns {Promise<{id: string, url: string, width: number, height: number}>}
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
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
            
            if (!csrfToken) {
                throw new Error('CSRF токен не найден');
            }

            const response = await fetch(this.uploadEndpoint, {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest'
                },
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

            return {
                id: result.data.id,
                url: result.data.url,
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

    /**
     * Загружает изображение из base64 DataURL
     * @param {string} dataUrl - base64 DataURL
     * @param {string} name - имя файла
     * @returns {Promise<{id: string, url: string, width: number, height: number}>}
     */
    async uploadFromDataUrl(dataUrl, name = 'clipboard-image.png') {
        const blob = await this._dataUrlToBlob(dataUrl);
        return this.uploadImage(blob, name);
    }

    /**
     * Удаляет изображение с сервера
     * @param {string} imageId - ID изображения
     */
    async deleteImage(imageId) {
        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
            
            const response = await fetch(`${this.deleteEndpoint}/${imageId}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRF-TOKEN': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json'
                },
                credentials: 'same-origin'
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(errorData?.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            return result.success;

        } catch (error) {
            console.error('Ошибка удаления изображения:', error);
            throw error;
        }
    }

    /**
     * Очищает неиспользуемые изображения с сервера
     * @returns {Promise<{deletedCount: number, errors: Array}>}
     */
    async cleanupUnusedImages() {
        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
            
            const response = await fetch(`${this.deleteEndpoint}/cleanup`, {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json'
                },
                credentials: 'same-origin'
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(errorData?.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            
            if (result.success) {
                // Защитная проверка на существование result.data
                const data = result.data || {};
                return {
                    deletedCount: data.deleted_count || 0,
                    errors: data.errors || []
                };
            } else {
                throw new Error(result.message || 'Ошибка очистки изображений');
            }

        } catch (error) {
            console.error('Ошибка очистки неиспользуемых изображений:', error);
            throw error;
        }
    }

    /**
     * Получает информацию об изображении
     * @param {string} imageId - ID изображения  
     */
    async getImageInfo(imageId) {
        try {
            const response = await fetch(`${this.deleteEndpoint}/${imageId}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'same-origin'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            return result.data;

        } catch (error) {
            console.error('Ошибка получения информации об изображении:', error);
            throw error;
        }
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
