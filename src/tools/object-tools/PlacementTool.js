import { BaseTool } from '../BaseTool.js';
import iCursorSvg from '../../assets/icons/i-cursor.svg?raw';

// Масштабируем I-курсор в 2 раза меньше
const _scaledICursorSvg = (() => {
    try {
        if (!/\bwidth="/i.test(iCursorSvg)) {
            return iCursorSvg.replace('<svg ', '<svg width="16px" height="32px" ');
        }
        return iCursorSvg
            .replace(/width="[^"]+"/i, 'width="16px"')
            .replace(/height="[^"]+"/i, 'height="32px"');
    } catch (_) {
        return iCursorSvg;
    }
})();

const TEXT_CURSOR = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(_scaledICursorSvg)}") 0 0, text`;
import { Events } from '../../core/events/Events.js';
import { GhostController } from './placement/GhostController.js';
import { PlacementPayloadFactory } from './placement/PlacementPayloadFactory.js';
import { PlacementInputRouter } from './placement/PlacementInputRouter.js';
import { PlacementEventsBridge } from './placement/PlacementEventsBridge.js';
import { PlacementSessionStore } from './placement/PlacementSessionStore.js';
import { PlacementCoordinateResolver } from './placement/PlacementCoordinateResolver.js';

/**
 * Инструмент одноразового размещения объекта по клику на холст
 * Логика: выбираем инструмент/вариант на тулбаре → кликаем на холст → объект создаётся → возврат к Select
 */
export class PlacementTool extends BaseTool {
    constructor(eventBus, core = null) {
        super('place', eventBus);
        this.cursor = 'default';
        this.hotkey = null;
        this.app = null;
        this.world = null;
        this.core = core;
        this.ghostController = new GhostController(this);
        this.payloadFactory = new PlacementPayloadFactory(this);
        this.inputRouter = new PlacementInputRouter(this);
        this.eventsBridge = new PlacementEventsBridge(this);
        this.sessionStore = new PlacementSessionStore(this);
        this.coordinateResolver = new PlacementCoordinateResolver(this);
        this.sessionStore.initialize();
        // Оригинальные стили курсора PIXI, чтобы можно было временно переопределить pointer/default для текстового инструмента
        this._origCursorStyles = null;

        this.eventsBridge.attach();
    }

    activate(app) {
        super.activate();
        this.app = app;
        this.world = this._getWorldLayer();
        // Курсор в зависимости от типа размещаемого объекта
        if (this.app && this.app.view) {
            this.cursor = this._getPendingCursor();
            this.app.view.style.cursor = this.cursor;
            // Добавляем обработчик движения мыши для "призрака"
            this.app.view.addEventListener('mousemove', this._onMouseMove.bind(this));
        }
        // При активации синхронизируем переопределение курсора pointer для текста
        this._updateCursorOverride();
        
        // Если есть выбранный файл или изображение, показываем призрак
        if (this.selectedFile) {
            this.showFileGhost();
        } else if (this.selectedImage) {
            this.showImageGhost();
        } else if (this.pending) {
            if (this.pending.type === 'note') {
                this.showNoteGhost();
            } else if (this.pending.type === 'emoji') {
                this.showEmojiGhost();
            } else if (this.pending.type === 'frame') {
                this.showFrameGhost();
            } else if (this.pending.type === 'shape') {
                this.showShapeGhost();
            }
        }
    }

    deactivate() {
        super.deactivate();
        if (this.app && this.app.view) {
            this.app.view.style.cursor = '';
            // Убираем обработчик движения мыши
            this.app.view.removeEventListener('mousemove', this._onMouseMove.bind(this));
        }
        // Восстанавливаем стандартные стили курсора при выходе из инструмента
        this._updateCursorOverride(true);
        this.hideGhost();
        this.app = null;
        this.world = null;
    }

    onMouseDown(event) {
        return this.inputRouter.onMouseDown(event);
    }

    __baseOnMouseDown(event) {
        super.onMouseDown(event);
    }

    startFrameDrawMode() {
        return this.inputRouter.startFrameDrawMode();
    }

    _onFrameDrawMove(event) {
        return this.inputRouter.onFrameDrawMove(event);
    }

    _onFrameDrawUp(event) {
        return this.inputRouter.onFrameDrawUp(event);
    }

    _toWorld(x, y) {
        return this.coordinateResolver.toWorld(x, y);
    }

    _getWorldLayer() {
        return this.coordinateResolver.getWorldLayer();
    }

    /**
     * Обработчик движения мыши для обновления позиции "призрака"
     */
    _onMouseMove(event) {
        return this.inputRouter.onMouseMove(event);
    }

    /**
     * Включает/выключает временное переопределение cursorStyles.pointer/default в PIXI,
     * чтобы во время работы с текстом курсор оставался системным 'text' даже при наведении на объекты.
     * @param {boolean} forceReset - если true, всегда восстанавливает оригинальные стили
     */
    _updateCursorOverride(forceReset = false) {
        try {
            const renderer = this.app && this.app.renderer;
            if (!renderer) return;
            const events = renderer.events || (renderer.plugins && renderer.plugins.interaction);
            const cursorStyles = events && events.cursorStyles;
            if (!cursorStyles) return;

            const needTextOverride = !forceReset && this.pending && this.pending.type === 'text';

            if (needTextOverride) {
                // Сохраняем оригинальные стили только один раз
                if (!this._origCursorStyles) {
                    this._origCursorStyles = {
                        pointer: cursorStyles.pointer,
                        default: cursorStyles.default
                    };
                }
                // И pointer, и default делаем системным текстовым курсором,
                // чтобы при наведении/уходе с объектов тип курсора не менялся.
                cursorStyles.pointer = 'text';
                cursorStyles.default = 'text';
            } else if (this._origCursorStyles) {
                // Восстанавливаем оригинальные значения
                if (Object.prototype.hasOwnProperty.call(this._origCursorStyles, 'pointer')) {
                    cursorStyles.pointer = this._origCursorStyles.pointer;
                }
                if (Object.prototype.hasOwnProperty.call(this._origCursorStyles, 'default')) {
                    cursorStyles.default = this._origCursorStyles.default;
                }
                this._origCursorStyles = null;
            }
        } catch (_) {
            // Если что-то пошло не так, не ломаем остальной функционал
        }
    }

    /**
     * Показать "призрак" файла
     */
    showFileGhost() {
        return this.ghostController.showFileGhost();
    }

    /**
     * Скрыть "призрак" файла
     */
    hideGhost() {
        return this.ghostController.hideGhost();
    }

    /**
     * Обновить позицию "призрака" файла
     */
    updateGhostPosition(x, y) {
        return this.ghostController.updateGhostPosition(x, y);
    }

    /**
     * Разместить выбранный файл на холсте
     */
    async placeSelectedFile(event) {
        if (!this.selectedFile) return;
        
        const worldPoint = this._toWorld(event.x, event.y);
        const props = this.selectedFile.properties;
        const halfW = (props.width || 120) / 2;
        const halfH = (props.height || 140) / 2;
        const position = { 
            x: Math.round(worldPoint.x - halfW), 
            y: Math.round(worldPoint.y - halfH) 
        };

        try {
            // Загружаем файл на сервер
            const uploadResult = await this.core.fileUploadService.uploadFile(
                this.selectedFile.file, 
                this.selectedFile.fileName
            );
            
            // Создаем объект файла с данными с сервера
            this.payloadFactory.emitFileUploaded(position, uploadResult, props.width || 120, props.height || 140);
            
        } catch (uploadError) {
            console.error('Ошибка загрузки файла на сервер:', uploadError);
            // Fallback: создаем объект файла с локальными данными
            this.payloadFactory.emitFileFallback(
                position,
                this.selectedFile.fileName,
                this.selectedFile.fileSize,
                this.selectedFile.mimeType,
                props.width || 120,
                props.height || 140
            );
            
            // Показываем предупреждение пользователю
            alert('Ошибка загрузки файла на сервер. Файл добавлен локально.');
        }

        // Убираем призрак и возвращаемся к инструменту выделения
        this.selectedFile = null;
        this.hideGhost();
        this.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'select' });
    }

    /**
     * Показать "призрак" изображения
     */
    async showImageGhost() {
        return this.ghostController.showImageGhost();
    }

    /**
     * Показать "призрак" изображения по URL (для выбора из панели эмоджи)
     */
    async showImageUrlGhost() {
        return this.ghostController.showImageUrlGhost();
    }

    /**
     * Показать "призрак" текста
     */
    showTextGhost() {
        return this.ghostController.showTextGhost();
    }

    /**
     * Показать "призрак" записки
     */
    showNoteGhost() {
        return this.ghostController.showNoteGhost();
    }

    /**
     * Показать "призрак" эмоджи
     */
    showEmojiGhost() {
        return this.ghostController.showEmojiGhost();
    }

    /**
     * Показать "призрак" фрейма
     */
    showFrameGhost() {
        return this.ghostController.showFrameGhost();
    }

    /**
     * Показать "призрак" фигуры
     */
    showShapeGhost() {
        return this.ghostController.showShapeGhost();
    }

    /**
     * Разместить выбранное изображение на холсте
     */
    async placeSelectedImage(event) {
        if (!this.selectedImage) return;
        
        const worldPoint = this._toWorld(event.x, event.y);
        
        try {
            // Загружаем изображение на сервер
            const uploadResult = await this.core.imageUploadService.uploadImage(
                this.selectedImage.file, 
                this.selectedImage.fileName
            );
            
            // Вычисляем целевой размер
            const natW = uploadResult.width || 1;
            const natH = uploadResult.height || 1;
            const targetW = 300; // дефолтная ширина
            const targetH = Math.max(1, Math.round(natH * (targetW / natW)));
            
            const halfW = targetW / 2;
            const halfH = targetH / 2;
            const position = { 
                x: Math.round(worldPoint.x - halfW), 
                y: Math.round(worldPoint.y - halfH) 
            };
            
            // Создаем объект изображения с данными с сервера
            this.payloadFactory.emitImageUploaded(position, uploadResult, targetW, targetH);
            
        } catch (uploadError) {
            console.error('Ошибка загрузки изображения на сервер:', uploadError);
            
            // Fallback: создаем объект изображения с локальными данными
            const imageUrl = URL.createObjectURL(this.selectedImage.file);
            const targetW = this.selectedImage.properties.width || 300;
            const targetH = this.selectedImage.properties.height || 200;
            
            const halfW = targetW / 2;
            const halfH = targetH / 2;
            const position = { 
                x: Math.round(worldPoint.x - halfW), 
                y: Math.round(worldPoint.y - halfH) 
            };
            
            this.payloadFactory.emitImageFallback(position, imageUrl, this.selectedImage.fileName, targetW, targetH);
            
            // Показываем предупреждение пользователю
            alert('Ошибка загрузки изображения на сервер. Изображение добавлено локально.');
        }

        // Убираем призрак и возвращаемся к инструменту выделения
        this.selectedImage = null;
        this.hideGhost();
        this.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'select' });
    }
}

// Возвращает подходящий курсор для текущего pending состояния
PlacementTool.prototype._getPendingCursor = function() {
    if (!this.pending) return 'crosshair';
    if (this.pending.type === 'text') return 'text';
    if (this.pending.type === 'frame-draw') return 'crosshair';
    return 'crosshair';
};


