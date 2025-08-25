/**
 * Сервис для загрузки и управления файлами на сервере
 */
export class FileUploadService {
    constructor(apiClient) {
        this.apiClient = apiClient;
        this.uploadEndpoint = '/api/files/upload';
        this.deleteEndpoint = '/api/files';
    }

    /**
     * Загружает файл на сервер
     * @param {File|Blob} file - файл
     * @param {string} name - имя файла
     * @returns {Promise<{id: string, url: string, size: number, mimeType: string, formattedSize: string}>}
     */
    async uploadFile(file, name = null) {
        try {
            // Создаем FormData для отправки файла
            const formData = new FormData();
            formData.append('file', file);
            formData.append('name', name || file.name || 'file');

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
                throw new Error(result.message || 'Ошибка загрузки файла');
            }

            return {
                id: result.data.id,
                url: result.data.url,
                size: result.data.size,
                mimeType: result.data.mime_type,
                formattedSize: result.data.formatted_size,
                name: result.data.name
            };

        } catch (error) {
            console.error('Ошибка загрузки файла:', error);
            throw error;
        }
    }

    /**
     * Обновляет метаданные файла на сервере
     * @param {string} fileId - ID файла
     * @param {Object} metadata - метаданные для обновления
     * @returns {Promise<Object>}
     */
    async updateFileMetadata(fileId, metadata) {
        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
            
            if (!csrfToken) {
                throw new Error('CSRF токен не найден');
            }

            const response = await fetch(`${this.deleteEndpoint}/${fileId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json'
                },
                credentials: 'same-origin',
                body: JSON.stringify(metadata)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(errorData?.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.message || 'Ошибка обновления метаданных файла');
            }

            return result.data;

        } catch (error) {
            console.error('Ошибка обновления метаданных файла:', error);
            throw error;
        }
    }

    /**
     * Удаляет файл с сервера
     * @param {string} fileId - ID файла
     */
    async deleteFile(fileId) {
        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
            
            const response = await fetch(`${this.deleteEndpoint}/${fileId}`, {
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
            console.error('Ошибка удаления файла:', error);
            throw error;
        }
    }

    /**
     * Получает информацию о файле
     * @param {string} fileId - ID файла  
     */
    async getFileInfo(fileId) {
        try {
            const response = await fetch(`${this.deleteEndpoint}/${fileId}`, {
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
            console.error('Ошибка получения информации о файле:', error);
            throw error;
        }
    }

    /**
     * Получает URL для скачивания файла
     * @param {string} fileId - ID файла
     */
    getDownloadUrl(fileId) {
        return `${this.deleteEndpoint}/${fileId}/download`;
    }

    /**
     * Очищает неиспользуемые файлы с сервера
     * @returns {Promise<{deletedCount: number, errors: Array}>}
     */
    async cleanupUnusedFiles() {
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
                const data = result.data || {};
                return {
                    deletedCount: data.deleted_count || 0,
                    errors: data.errors || []
                };
            } else {
                throw new Error(result.message || 'Ошибка очистки файлов');
            }

        } catch (error) {
            console.error('Ошибка очистки неиспользуемых файлов:', error);
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
