import * as PIXI from 'pixi.js';

/**
 * FileObject — объект файла, отображает иконку с названием и расширением
 * Свойства (properties):
 * - fileName: string — имя файла с расширением
 * - fileSize: number — размер файла в байтах (опционально)
 * - mimeType: string — MIME тип файла (опционально)
 * - content: ArrayBuffer | Blob — содержимое файла (опционально)
 */
export class FileObject {
    constructor(objectData = {}) {
        this.objectData = objectData;
        
        // Размеры объекта файла
        this.width = objectData.width || objectData.properties?.width || 120;
        this.height = objectData.height || objectData.properties?.height || 140;
        
        // Свойства файла
        const props = objectData.properties || {};
        this.fileName = props.fileName || 'Untitled';
        this.fileSize = props.fileSize || 0;
        this.mimeType = props.mimeType || 'application/octet-stream';
        this.content = props.content || null;
        
        // Создаем контейнер для файла
        this.container = new PIXI.Container();
        
        // Включаем интерактивность для контейнера
        this.container.eventMode = 'static';
        this.container.interactiveChildren = true;
        
        // Графика фона и иконки
        this.graphics = new PIXI.Graphics();
        this.container.addChild(this.graphics);
        
        // Текст имени файла
        this.fileNameText = new PIXI.Text(this.fileName, {
            fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
            fontSize: 12,
            fill: 0x333333,
            align: 'center',
            wordWrap: true,
            wordWrapWidth: this.width - 8,
            lineHeight: 14,
            resolution: (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1
        });
        
        // Текст размера файла (если есть)
        this.fileSizeText = null;
        if (this.fileSize > 0) {
            this.fileSizeText = new PIXI.Text(this._formatFileSize(this.fileSize), {
                fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
                fontSize: 10,
                fill: 0x666666,
                align: 'center',
                resolution: (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1
            });
        }
        
        this._redraw();
        this.container.addChild(this.fileNameText);
        if (this.fileSizeText) {
            this.container.addChild(this.fileSizeText);
        }
        this._updateTextPosition();
        
        // Метаданные
        this.container._mb = {
            ...(this.container._mb || {}),
            type: 'file',
            instance: this,
            properties: { 
                fileName: this.fileName,
                fileSize: this.fileSize,
                mimeType: this.mimeType,
                content: this.content,
                ...objectData.properties 
            }
        };
    }

    getPixi() {
        return this.container;
    }

    updateSize(size) {
        if (!size) return;
        this.width = Math.max(80, size.width || this.width);
        this.height = Math.max(100, size.height || this.height);
        
        this._redraw();
        this._updateTextPosition();
        
        // Обновляем hit area
        this.container.hitArea = new PIXI.Rectangle(0, 0, this.width, this.height);
        this.container.containsPoint = (point) => {
            const bounds = this.container.getBounds();
            return point.x >= bounds.x && 
                   point.x <= bounds.x + bounds.width &&
                   point.y >= bounds.y && 
                   point.y <= bounds.y + bounds.height;
        };
    }

    setFileName(fileName) {
        this.fileName = fileName || 'Untitled';
        this.fileNameText.text = this.fileName;
        this._updateTextPosition();
        if (this.container && this.container._mb) {
            this.container._mb.properties = {
                ...(this.container._mb.properties || {}),
                fileName: this.fileName
            };
        }
        this._redraw();
    }

    _redraw() {
        const g = this.graphics;
        const w = this.width;
        const h = this.height;
        
        g.clear();
        
        // Тень
        g.beginFill(0x000000, 0.1);
        g.drawRoundedRect(2, 2, w, h, 8);
        g.endFill();
        
        // Основной фон
        g.beginFill(0xF8F9FA, 1);
        g.lineStyle(2, 0xDEE2E6, 1);
        g.drawRoundedRect(0, 0, w, h, 8);
        g.endFill();
        
        // Иконка файла в верхней части
        const iconSize = Math.min(48, w * 0.4);
        const iconX = (w - iconSize) / 2;
        const iconY = 16;
        
        // Определяем цвет иконки по расширению файла
        const extension = this._getFileExtension();
        const iconColor = this._getIconColor(extension);
        
        // Рисуем иконку файла
        this._drawFileIcon(g, iconX, iconY, iconSize, iconColor, extension);
        
        // Устанавливаем hit area
        this.container.hitArea = new PIXI.Rectangle(0, 0, w, h);
        
        this.container.containsPoint = (point) => {
            const bounds = this.container.getBounds();
            return point.x >= bounds.x && 
                   point.x <= bounds.x + bounds.width &&
                   point.y >= bounds.y && 
                   point.y <= bounds.y + bounds.height;
        };
    }

    _drawFileIcon(graphics, x, y, size, color, extension) {
        const g = graphics;
        
        // Основная часть файла
        g.beginFill(color, 1);
        g.lineStyle(1, color, 1);
        g.drawRoundedRect(x, y, size * 0.8, size, 4);
        g.endFill();
        
        // Загнутый уголок
        const cornerSize = size * 0.25;
        g.beginFill(0xFFFFFF, 0.8);
        g.moveTo(x + size * 0.8 - cornerSize, y);
        g.lineTo(x + size * 0.8, y);
        g.lineTo(x + size * 0.8, y + cornerSize);
        g.lineTo(x + size * 0.8 - cornerSize, y);
        g.endFill();
        
        // Текст расширения на иконке
        if (extension && extension.length <= 4) {
            const extensionText = new PIXI.Text(extension.toUpperCase(), {
                fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
                fontSize: Math.max(8, size * 0.2),
                fill: 0xFFFFFF,
                align: 'center',
                fontWeight: 'bold'
            });
            extensionText.anchor.set(0.5, 0.5);
            extensionText.x = x + size * 0.4;
            extensionText.y = y + size * 0.7;
            this.container.addChild(extensionText);
        }
    }

    _updateTextPosition() {
        if (!this.fileNameText) return;
        
        // Обновляем стиль текста
        this.fileNameText.style.wordWrapWidth = this.width - 8;
        this.fileNameText.updateText();
        
        // Позиционируем название файла
        this.fileNameText.anchor.set(0.5, 0);
        this.fileNameText.x = this.width / 2;
        this.fileNameText.y = this.height - 40;
        
        // Позиционируем размер файла
        if (this.fileSizeText) {
            this.fileSizeText.anchor.set(0.5, 0);
            this.fileSizeText.x = this.width / 2;
            this.fileSizeText.y = this.height - 20;
        }
    }

    _getFileExtension() {
        const parts = this.fileName.split('.');
        return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
    }

    _getIconColor(extension) {
        const colorMap = {
            // Документы
            'pdf': 0xDC2626,
            'doc': 0x2563EB,
            'docx': 0x2563EB,
            'txt': 0x6B7280,
            'rtf': 0x6B7280,
            
            // Изображения
            'jpg': 0x10B981,
            'jpeg': 0x10B981,
            'png': 0x10B981,
            'gif': 0x10B981,
            'svg': 0x8B5CF6,
            'bmp': 0x10B981,
            'webp': 0x10B981,
            
            // Архивы
            'zip': 0xF59E0B,
            'rar': 0xF59E0B,
            '7z': 0xF59E0B,
            'tar': 0xF59E0B,
            'gz': 0xF59E0B,
            
            // Видео
            'mp4': 0xEF4444,
            'avi': 0xEF4444,
            'mov': 0xEF4444,
            'wmv': 0xEF4444,
            'flv': 0xEF4444,
            
            // Аудио
            'mp3': 0x8B5CF6,
            'wav': 0x8B5CF6,
            'flac': 0x8B5CF6,
            'aac': 0x8B5CF6,
            
            // Код
            'js': 0xF7DF1E,
            'html': 0xE34F26,
            'css': 0x1572B6,
            'json': 0x000000,
            'xml': 0xFF6600,
            'php': 0x777BB4,
            'py': 0x3776AB,
            'java': 0xED8B00,
            'cpp': 0x00599C,
            'c': 0x00599C,
            
            // Таблицы
            'xls': 0x217346,
            'xlsx': 0x217346,
            'csv': 0x217346,
            
            // Презентации
            'ppt': 0xD24726,
            'pptx': 0xD24726
        };
        
        return colorMap[extension] || 0x6B7280; // Серый по умолчанию
    }

    _formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
}
