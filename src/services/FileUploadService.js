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
     * Скачивает файл с сервера
     * @param {string} fileId - ID файла 
     * @param {string} fileName - имя файла для скачивания
     */
    async downloadFile(fileId, fileName = null) {
        try {
            const downloadUrl = this.getDownloadUrl(fileId);
            
            console.log('📥 FileUploadService: Начинаем скачивание файла:', {
                fileId,
                fileName,
                downloadUrl,
                userAgent: navigator.userAgent,
                isSecureContext: window.isSecureContext
            });
            
            // Метод 1: Попробуем через fetch + blob (более надежно для современных браузеров)
            try {
                console.log('🔄 Метод 1: Пробуем скачивание через fetch...');
                
                const response = await fetch(downloadUrl, {
                    method: 'GET',
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    credentials: 'same-origin'
                });
                
                console.log('📥 Ответ сервера:', {
                    status: response.status,
                    statusText: response.statusText,
                    contentType: response.headers.get('content-type'),
                    contentLength: response.headers.get('content-length'),
                    contentDisposition: response.headers.get('content-disposition')
                });
                
                if (!response.ok) {
                    // Пытаемся получить JSON ошибку от Laravel
                    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                    
                    try {
                        const errorData = await response.json();
                        console.error('🚨 Ошибка от сервера:', errorData);
                        
                        if (errorData.message) {
                            errorMessage = `${errorMessage} - ${errorData.message}`;
                        }
                        
                        // Показываем пользователю детальную ошибку
                        if (errorData.success === false) {
                            alert(`Ошибка сервера: ${errorData.message || 'Файл не найден'}`);
                        }
                    } catch (jsonError) {
                        console.warn('Не удалось прочитать JSON ошибку:', jsonError);
                    }
                    
                    throw new Error(errorMessage);
                }
                
                // Получаем blob файла
                const blob = await response.blob();
                console.log('📦 Получен blob:', {
                    size: blob.size,
                    type: blob.type
                });
                
                // Создаем URL для blob
                const blobUrl = window.URL.createObjectURL(blob);
                
                // Создаем ссылку для скачивания
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = fileName || `file_${fileId}`;
                
                // Добавляем в DOM, кликаем и удаляем
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                // Освобождаем память
                window.URL.revokeObjectURL(blobUrl);
                
                console.log('✅ Файл успешно скачан через fetch/blob:', fileName || fileId);
                return true;
                
            } catch (fetchError) {
                console.warn('❌ Ошибка скачивания через fetch:', fetchError);
                
                // Метод 2: Fallback - открываем в новом окне
                console.log('🔄 Метод 2: Пробуем открытие в новом окне...');
                
                try {
                    const newWindow = window.open(downloadUrl, '_blank');
                    if (newWindow) {
                        console.log('✅ Файл открыт в новом окне');
                        return true;
                    } else {
                        throw new Error('Popup заблокирован браузером');
                    }
                } catch (windowError) {
                    console.warn('❌ Ошибка открытия в новом окне:', windowError);
                    
                    // Метод 3: Последний fallback - прямая ссылка
                    console.log('🔄 Метод 3: Создаем прямую ссылку...');
                    
                    const link = document.createElement('a');
                    link.href = downloadUrl;
                    if (fileName) {
                        link.download = fileName;
                    }
                    link.target = '_blank';
                    
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    
                    console.log('✅ Создана прямая ссылка для скачивания');
                    return true;
                }
            }

        } catch (error) {
            console.error('❌ FileUploadService: Критическая ошибка скачивания файла:', error);
            
            // Показываем пользователю альтернативную ссылку
            if (confirm(`Автоматическое скачивание не удалось: ${error.message}\n\nОткрыть файл в новой вкладке?`)) {
                window.open(this.getDownloadUrl(fileId), '_blank');
            }
            
            throw error;
        }
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
