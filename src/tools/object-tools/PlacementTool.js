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
import * as PIXI from 'pixi.js';

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
        this.pending = null; // { type, properties }
        this.core = core;
        
        // Состояние выбранного файла
        this.selectedFile = null; // { file, fileName, fileSize, mimeType, properties }
        // Состояние выбранного изображения
        this.selectedImage = null; // { file, fileName, fileSize, mimeType, properties }
        this.ghostContainer = null; // Контейнер для "призрака" файла, изображения, текста, записки, эмоджи, фрейма или фигур

        if (this.eventBus) {
            this.eventBus.on(Events.Place.Set, (cfg) => {
                this.pending = cfg ? { ...cfg } : null;
                // Обновляем курсор в зависимости от pending
                if (this.app && this.app.view) {
                    const cur = this._getPendingCursor();
                    this.app.view.style.cursor = (cur === 'default') ? '' : cur;
                }
                
                // Показываем призрак для записки, эмоджи, фрейма или фигур, если они активны
                if (this.pending && this.app && this.world) {
                    if (this.pending.type === 'note') {
                        this.showNoteGhost();
                    } else if (this.pending.type === 'emoji') {
                        this.showEmojiGhost();
                    } else if (this.pending.type === 'image') {
                        this.showImageUrlGhost();
                    } else if (this.pending.type === 'frame') {
                        this.showFrameGhost();
                    } else if (this.pending.type === 'frame-draw') {
                        this.startFrameDrawMode();
                    } else if (this.pending.type === 'shape') {
                        this.showShapeGhost();
                    }
                    // Поддержка сценария перетаскивания из панели: отпускание без предварительного mousedown на канвасе
                    if (this.pending.placeOnMouseUp && this.app && this.app.view) {
                        const onUp = (ev) => {
                            this.app.view.removeEventListener('mouseup', onUp);
                            if (!this.pending) return;
                            const worldPoint = this._toWorld(ev.x, ev.y);
                            const position = {
                                x: Math.round(worldPoint.x - (this.pending.size?.width ?? 100) / 2),
                                y: Math.round(worldPoint.y - (this.pending.size?.height ?? 100) / 2)
                            };
                            const props = { ...(this.pending.properties || {}) };
                            this.eventBus.emit(Events.UI.ToolbarAction, {
                                type: this.pending.type,
                                id: this.pending.type,
                                position,
                                properties: props
                            });
                            this.pending = null;
                            this.hideGhost();
                            this.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'select' });
                        };
                        this.app.view.addEventListener('mouseup', onUp, { once: true });
                    }
                }
            });
            
            // Сброс pending при явном выборе select-инструмента
            this.eventBus.on(Events.Tool.Activated, ({ tool }) => {
                if (tool === 'select') {
                    this.pending = null;
                    this.selectedFile = null;
                    this.selectedImage = null;
                    this.hideGhost();
                }
            });

            // Обработка выбора файла
            this.eventBus.on(Events.Place.FileSelected, (fileData) => {
                this.selectedFile = fileData;
                this.selectedImage = null;
                
                // Если PlacementTool уже активен - показываем призрак сразу
                if (this.world) {
                    this.showFileGhost();
                }
            });

            // Обработка отмены выбора файла
            this.eventBus.on(Events.Place.FileCanceled, () => {
                this.selectedFile = null;
                this.hideGhost();
                // Возвращаемся к инструменту выделения
                this.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'select' });
            });

            // Обработка выбора изображения
            this.eventBus.on(Events.Place.ImageSelected, (imageData) => {
                this.selectedImage = imageData;
                this.selectedFile = null;
                this.showImageGhost();
            });

            // Обработка отмены выбора изображения
            this.eventBus.on(Events.Place.ImageCanceled, () => {
                this.selectedImage = null;
                this.hideGhost();
                // Возвращаемся к инструменту выделения
                this.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'select' });
            });
        }
    }

    activate(app) {
        super.activate();
        this.app = app;
        this.world = this._getWorldLayer();
        // Курсор в зависимости от типа размещаемого объекта
        if (this.app && this.app.view) {
            this.app.view.style.cursor = this._getPendingCursor();
            // Добавляем обработчик движения мыши для "призрака"
            this.app.view.addEventListener('mousemove', this._onMouseMove.bind(this));
        }
        
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
        this.hideGhost();
        this.app = null;
        this.world = null;
    }

    onMouseDown(event) {
        super.onMouseDown(event);
        
        // Если есть выбранный файл, размещаем его
        if (this.selectedFile) {
            this.placeSelectedFile(event);
            return;
        }
        
        // Если есть выбранное изображение, размещаем его
        if (this.selectedImage) {
            this.placeSelectedImage(event);
            return;
        }
        
        if (!this.pending) return;
        // Если включен режим "перетянуть и отпустить" из панели (placeOnMouseUp),
        // то размещение выполняем на mouseup, а здесь только показываем призрак и запоминаем старт
        if (this.pending.placeOnMouseUp) {
            const onUp = (ev) => {
                this.app.view.removeEventListener('mouseup', onUp);
                // Имитация обычного place по текущему положению курсора
                const worldPoint = this._toWorld(ev.x, ev.y);
                const position = {
                    x: Math.round(worldPoint.x - (this.pending.size?.width ?? 100) / 2),
                    y: Math.round(worldPoint.y - (this.pending.size?.height ?? 100) / 2)
                };
                const props = { ...(this.pending.properties || {}) };
                this.eventBus.emit(Events.UI.ToolbarAction, {
                    type: this.pending.type,
                    id: this.pending.type,
                    position,
                    properties: props
                });
                this.pending = null;
                this.hideGhost();
                this.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'select' });
            };
            this.app.view.addEventListener('mouseup', onUp, { once: true });
            return;
        }
        // Если включен режим рисования фрейма — инициируем рамку
        if (this.pending.type === 'frame-draw') {
            const start = this._toWorld(event.x, event.y);
            this._frameDrawState = { startX: start.x, startY: start.y, graphics: null };
            if (this.world) {
                const g = new PIXI.Graphics();
                g.zIndex = 3000;
                this.world.addChild(g);
                this._frameDrawState.graphics = g;
            }
            // Вешаем временные обработчики движения/отпускания
            this._onFrameDrawMoveBound = (ev) => this._onFrameDrawMove(ev);
            this._onFrameDrawUpBound = (ev) => this._onFrameDrawUp(ev);
            this.app.view.addEventListener('mousemove', this._onFrameDrawMoveBound);
            this.app.view.addEventListener('mouseup', this._onFrameDrawUpBound, { once: true });
            return;
        }

        const worldPoint = this._toWorld(event.x, event.y);
        // Базовая позиция (может быть переопределена для конкретных типов)
        let position = {
            x: Math.round(worldPoint.x - (this.pending.size?.width ?? 100) / 2),
            y: Math.round(worldPoint.y - (this.pending.size?.height ?? 100) / 2)
        };

        let props = this.pending.properties || {};
        const isTextWithEditing = this.pending.type === 'text' && props.editOnCreate;
        const isImage = this.pending.type === 'image';
        const isFile = this.pending.type === 'file';
        const presetSize = {
            width: (this.pending.size && this.pending.size.width) ? this.pending.size.width : (props.width || 200),
            height: (this.pending.size && this.pending.size.height) ? this.pending.size.height : (props.height || 150),
        };

        if (isTextWithEditing) {
            // Для текста позиция должна совпадать с точкой клика без смещений
            // Диагностика: логируем позицию курсора и мировые координаты в момент клика
            try {
                console.log('🧭 Text click', {
                    cursor: { x: event.x, y: event.y },
                    world: { x: Math.round(worldPoint.x), y: Math.round(worldPoint.y) }
                });
            } catch (_) {}
            position = {
                x: Math.round(worldPoint.x),
                y: Math.round(worldPoint.y)
            };
            // Слушаем событие создания объекта, чтобы получить его ID
            const handleObjectCreated = (objectData) => {
                if (objectData.type === 'text') {
                    // Убираем слушатель, чтобы не реагировать на другие объекты
                    this.eventBus.off('object:created', handleObjectCreated);
                    
                    // Переключаемся на select
                    this.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'select' });
                    

                    
                    // Даем небольшую задержку, чтобы HTML-элемент успел создаться
                    setTimeout(() => {
                        // Открываем редактор с правильным ID и данными объекта
                        this.eventBus.emit(Events.Tool.ObjectEdit, {
                            object: {
                                id: objectData.id,
                                type: 'text',
                                position: objectData.position,
                                properties: { fontSize: props.fontSize || 18, content: '' }
                            },
                            create: true // Это создание нового объекта с редактированием
                        });
                    }, 50); // 50ms задержка
                }
            };
            
            // Подписываемся на событие создания объекта
            this.eventBus.on('object:created', handleObjectCreated);
            
            // Создаем объект через обычный канал
            this.eventBus.emit(Events.UI.ToolbarAction, {
                type: 'text',
                id: 'text',
                position,
                properties: { 
                    fontSize: props.fontSize || 18, 
                    content: '',
                    fontFamily: 'Arial, sans-serif', // Дефолтный шрифт
                    color: '#000000', // Дефолтный цвет (черный)
                    backgroundColor: 'transparent' // Дефолтный фон (прозрачный)
                }
            });
        } else if (this.pending.type === 'frame') {
            // Для фрейма центр привязываем к курсору так же, как у призрака
            const width = props.width || presetSize.width || 200;
            const height = props.height || presetSize.height || 300;
            position = {
                x: Math.round(worldPoint.x - width / 2),
                y: Math.round(worldPoint.y - height / 2)
            };
            this.eventBus.emit(Events.UI.ToolbarAction, {
                type: 'frame',
                id: 'frame',
                position,
                properties: { ...props, width, height }
            });
        } else if (isImage && props.selectFileOnPlace) {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.style.display = 'none';
            document.body.appendChild(input);
            input.addEventListener('change', async () => {
                try {
                    const file = input.files && input.files[0];
                    if (!file) return;
                    // Читаем как DataURL, чтобы не использовать blob: URL (устраняем ERR_FILE_NOT_FOUND)
                    // Загружаем файл на сервер
                    try {
                        const uploadResult = await this.core.imageUploadService.uploadImage(file, file.name);
                        
                        // Вычисляем целевой размер
                        const natW = uploadResult.width || 1;
                        const natH = uploadResult.height || 1;
                        const targetW = 300; // дефолтная ширина
                        const targetH = Math.max(1, Math.round(natH * (targetW / natW)));
                        
                        this.eventBus.emit(Events.UI.ToolbarAction, {
                            type: 'image',
                            id: 'image',
                            position,
                            properties: { 
                                src: uploadResult.url, 
                                name: uploadResult.name, 
                                width: targetW, 
                                height: targetH 
                            },
                            imageId: uploadResult.imageId || uploadResult.id // Сохраняем ID изображения
                        });
                    } catch (error) {
                        console.error('Ошибка загрузки изображения:', error);
                        alert('Ошибка загрузки изображения: ' + error.message);
                    }
                } finally {
                    input.remove();
                }
            }, { once: true });
            input.click();
        } else if (isFile && props.selectFileOnPlace) {
            // Создаем диалог выбора файла
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '*/*'; // Принимаем любые файлы
            input.style.display = 'none';
            document.body.appendChild(input);
            input.addEventListener('change', async () => {
                try {
                    const file = input.files && input.files[0];
                    if (!file) return;
                    
                    // Загружаем файл на сервер
                    try {
                        const uploadResult = await this.core.fileUploadService.uploadFile(file, file.name);
                        
                        // Создаем объект файла с данными с сервера
                        this.eventBus.emit(Events.UI.ToolbarAction, {
                            type: 'file',
                            id: 'file',
                            position,
                            properties: { 
                                fileName: uploadResult.name,
                                fileSize: uploadResult.size,
                                mimeType: uploadResult.mimeType,
                                formattedSize: uploadResult.formattedSize,
                                url: uploadResult.url,
                                width: props.width || 120,
                                height: props.height || 140
                            },
                            fileId: uploadResult.fileId || uploadResult.id // Сохраняем ID файла
                        });
                        
                        // Возвращаемся к инструменту выделения после создания файла
                        this.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'select' });
                    } catch (uploadError) {
                        console.error('Ошибка загрузки файла на сервер:', uploadError);
                        // Fallback: создаем объект файла с локальными данными
                        const fileName = file.name;
                        const fileSize = file.size;
                        const mimeType = file.type;
                        
                        this.eventBus.emit(Events.UI.ToolbarAction, {
                            type: 'file',
                            id: 'file',
                            position,
                            properties: { 
                                fileName: fileName,
                                fileSize: fileSize,
                                mimeType: mimeType,
                                width: props.width || 120,
                                height: props.height || 140
                            }
                        });
                        
                        // Возвращаемся к инструменту выделения
                        this.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'select' });
                        
                        // Показываем предупреждение пользователю
                        alert('Ошибка загрузки файла на сервер. Файл добавлен локально.');
                    }
                } catch (error) {
                    console.error('Ошибка при выборе файла:', error);
                    alert('Ошибка при выборе файла: ' + error.message);
                } finally {
                    input.remove();
                }
            }, { once: true });
            input.click();
        } else {
            // Для записки: выставляем фактические габариты и центрируем по курсору
            if (this.pending.type === 'note') {
                const base = 250; // квадрат 250x250
                const noteW = (typeof props.width === 'number') ? props.width : base;
                const noteH = (typeof props.height === 'number') ? props.height : base;
                const side = Math.max(noteW, noteH);
                props = { ...props, width: side, height: side };
                position = {
                    x: Math.round(worldPoint.x - side / 2),
                    y: Math.round(worldPoint.y - side / 2)
                };
            }
            // Обычное размещение через общий канал
            this.eventBus.emit(Events.UI.ToolbarAction, {
                type: this.pending.type,
                id: this.pending.type,
                position,
                properties: props
            });
        }

        // Сбрасываем pending и возвращаем стандартное поведение
        this.pending = null;
        this.hideGhost(); // Скрываем призрак после размещения
        if (!isTextWithEditing && !(isFile && props.selectFileOnPlace)) {
            this.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'select' });
        }
    }

    startFrameDrawMode() {
        // Курсор при рисовании фрейма
        if (this.app && this.app.view) this.app.view.style.cursor = 'crosshair';
    }

    _onFrameDrawMove(event) {
        if (!this._frameDrawState || !this._frameDrawState.graphics) return;
        const p = this._toWorld(event.offsetX, event.offsetY);
        const x = Math.min(this._frameDrawState.startX, p.x);
        const y = Math.min(this._frameDrawState.startY, p.y);
        const w = Math.abs(p.x - this._frameDrawState.startX);
        const h = Math.abs(p.y - this._frameDrawState.startY);
        const g = this._frameDrawState.graphics;
        g.clear();
        // Снапим к полупикселю и используем внутреннее выравнивание линии для чётких 1px краёв
        const x0 = Math.floor(x) + 0.5;
        const y0 = Math.floor(y) + 0.5;
        const w0 = Math.max(1, Math.round(w));
        const h0 = Math.max(1, Math.round(h));
        g.lineStyle(1, 0x3B82F6, 1, 1 /* alignment: inner */);
        g.beginFill(0xFFFFFF, 0.6);
        g.drawRect(x0, y0, w0, h0);
        g.endFill();
    }

    _onFrameDrawUp(event) {
        const g = this._frameDrawState?.graphics;
        if (!this._frameDrawState || !g) return;
        const p = this._toWorld(event.offsetX, event.offsetY);
        const x = Math.min(this._frameDrawState.startX, p.x);
        const y = Math.min(this._frameDrawState.startY, p.y);
        const w = Math.abs(p.x - this._frameDrawState.startX);
        const h = Math.abs(p.y - this._frameDrawState.startY);
        // Удаляем временную графику
        if (g.parent) g.parent.removeChild(g);
        g.destroy();
        this._frameDrawState = null;
        // Создаем фрейм, если размер достаточный
        if (w >= 2 && h >= 2) {
            this.eventBus.emit(Events.UI.ToolbarAction, {
                type: 'frame',
                id: 'frame',
                position: { x, y },
                properties: { width: Math.round(w), height: Math.round(h), title: 'Произвольный', lockedAspect: false, isArbitrary: true }
            });
        }
        // Сбрасываем pending и выходим из режима place → select
        this.pending = null;
        this.hideGhost();
        if (this.app && this.app.view) {
            this.app.view.removeEventListener('mousemove', this._onFrameDrawMoveBound);
            this.app.view.style.cursor = '';
        }
        this.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'select' });
    }

    _toWorld(x, y) {
        if (!this.world) return { x, y };
        const global = new PIXI.Point(x, y);
        const local = this.world.toLocal(global);
        return { x: local.x, y: local.y };
    }

    _getWorldLayer() {
        if (!this.app || !this.app.stage) return null;
        const world = this.app.stage.getChildByName && this.app.stage.getChildByName('worldLayer');
        return world || this.app.stage;
    }

    /**
     * Обработчик движения мыши для обновления позиции "призрака"
     */
    _onMouseMove(event) {
        if ((this.selectedFile || this.selectedImage || this.pending) && this.ghostContainer) {
            // Сохраним последние координаты мыши (в экранных координатах) — пригодится для первичной позиции призрака
            if (this.app && this.app.view) {
                this.app.view._lastMouseX = event.x;
                this.app.view._lastMouseY = event.y;
            }
            const worldPoint = this._toWorld(event.offsetX, event.offsetY);
            this.updateGhostPosition(worldPoint.x, worldPoint.y);
        }
    }

    /**
     * Показать "призрак" файла
     */
    showFileGhost() {
        if (!this.selectedFile || !this.world) return;
        
        this.hideGhost(); // Сначала убираем старый призрак
        
        // Создаем контейнер для призрака
        this.ghostContainer = new PIXI.Container();
        this.ghostContainer.alpha = 0.6; // Полупрозрачность
        // Сразу ставим контейнер в позицию курсора, чтобы он не мигал в левом верхнем углу
        if (this.app && this.app.view) {
            const rect = this.app.view.getBoundingClientRect();
            const cursorX = (typeof this.app.view._lastMouseX === 'number') ? this.app.view._lastMouseX : (rect.left + rect.width / 2);
            const cursorY = (typeof this.app.view._lastMouseY === 'number') ? this.app.view._lastMouseY : (rect.top + rect.height / 2);
            const worldPoint = this._toWorld(cursorX, cursorY);
            this.updateGhostPosition(worldPoint.x, worldPoint.y);
        }
        // Попробуем дождаться загрузки веб-шрифта Caveat до отрисовки  
        // Для файлов используем selectedFile, а не pending
        const fileFont = (this.selectedFile.properties?.fontFamily) || 'Caveat, Arial, cursive';
        const primaryFont = String(fileFont).split(',')[0].trim().replace(/^['"]|['"]$/g, '') || 'Caveat';
        
        // Размеры
        const width = this.selectedFile.properties.width || 120;
        const height = this.selectedFile.properties.height || 140;

        // Размытая тень (как у FileObject)
        const shadow = new PIXI.Graphics();
        try {
            shadow.filters = [new PIXI.filters.BlurFilter(6)];
        } catch (e) {}
        shadow.beginFill(0x000000, 1);
        shadow.drawRect(0, 0, width, height);
        shadow.endFill();
        shadow.x = 2;
        shadow.y = 3;
        shadow.alpha = 0.18;

        // Белый прямоугольник без рамки
        const background = new PIXI.Graphics();
        background.beginFill(0xFFFFFF, 1);
        background.drawRect(0, 0, width, height);
        background.endFill();

        // Иконка-заглушка файла наверху
        const icon = new PIXI.Graphics();
        const iconSize = Math.min(48, width * 0.4);
        const iconX = (width - iconSize) / 2;
        const iconY = 16;
        icon.beginFill(0x6B7280, 1);
        icon.drawRect(iconX, iconY, iconSize * 0.8, iconSize);
        icon.endFill();

        // Текст названия файла
        const fileName = this.selectedFile.fileName || 'File';
        const displayName = fileName.length > 15 ? fileName.substring(0, 12) + '...' : fileName;
        const nameText = new PIXI.Text(displayName, {
            fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
            fontSize: 12,
            fill: 0x333333,
            align: 'center',
            wordWrap: true,
            wordWrapWidth: width - 8
        });
        nameText.x = (width - nameText.width) / 2;
        nameText.y = height - 40;

        // Добавляем в контейнер в правильном порядке
        this.ghostContainer.addChild(shadow);
        this.ghostContainer.addChild(background);
        this.ghostContainer.addChild(icon);
        this.ghostContainer.addChild(nameText);

        // Центрируем контейнер относительно курсора
        this.ghostContainer.pivot.x = width / 2;
        this.ghostContainer.pivot.y = height / 2;
        
        this.world.addChild(this.ghostContainer);
    }

    /**
     * Скрыть "призрак" файла
     */
    hideGhost() {
        if (this.ghostContainer && this.world) {
            this.world.removeChild(this.ghostContainer);
            this.ghostContainer.destroy();
            this.ghostContainer = null;
        }
    }

    /**
     * Обновить позицию "призрака" файла
     */
    updateGhostPosition(x, y) {
        if (this.ghostContainer) {
            this.ghostContainer.x = x;
            this.ghostContainer.y = y;
        }
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
            this.eventBus.emit(Events.UI.ToolbarAction, {
                type: 'file',
                id: 'file',
                position,
                properties: { 
                    fileName: uploadResult.name,
                    fileSize: uploadResult.size,
                    mimeType: uploadResult.mimeType,
                    formattedSize: uploadResult.formattedSize,
                    url: uploadResult.url,
                    width: props.width || 120,
                    height: props.height || 140
                },
                fileId: uploadResult.fileId || uploadResult.id // Сохраняем ID файла
            });
            
        } catch (uploadError) {
            console.error('Ошибка загрузки файла на сервер:', uploadError);
            // Fallback: создаем объект файла с локальными данными
            this.eventBus.emit(Events.UI.ToolbarAction, {
                type: 'file',
                id: 'file',
                position,
                properties: { 
                    fileName: this.selectedFile.fileName,
                    fileSize: this.selectedFile.fileSize,
                    mimeType: this.selectedFile.mimeType,
                    width: props.width || 120,
                    height: props.height || 140
                }
            });
            
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
        if (!this.selectedImage || !this.world) return;
        
        this.hideGhost(); // Сначала убираем старый призрак
        
        // Создаем контейнер для призрака
        this.ghostContainer = new PIXI.Container();
        this.ghostContainer.alpha = 0.6; // Полупрозрачность
        
        // Размеры призрака - используем размеры из pending/selected, если есть
        const isEmojiIcon = this.selectedImage.properties?.isEmojiIcon;
        const maxWidth = this.selectedImage.properties.width || (isEmojiIcon ? 64 : 300);
        const maxHeight = this.selectedImage.properties.height || (isEmojiIcon ? 64 : 200);
        
        try {
            // Создаем превью изображения
            const imageUrl = URL.createObjectURL(this.selectedImage.file);
            const texture = await PIXI.Texture.fromURL(imageUrl);
            
            // Вычисляем пропорциональные размеры
            const imageAspect = texture.width / texture.height;
            let width = maxWidth;
            let height = maxWidth / imageAspect;
            
            if (height > maxHeight) {
                height = maxHeight;
                width = maxHeight * imageAspect;
            }
            
            // Создаем спрайт изображения
            const sprite = new PIXI.Sprite(texture);
            sprite.width = width;
            sprite.height = height;
            
            // Рамка вокруг изображения
            const border = new PIXI.Graphics();
            border.lineStyle(2, 0xDEE2E6, 0.8);
            border.drawRoundedRect(-2, -2, width + 4, height + 4, 4);
            
            this.ghostContainer.addChild(border);
            this.ghostContainer.addChild(sprite);
            
            // Центрируем контейнер относительно курсора
            this.ghostContainer.pivot.x = width / 2;
            this.ghostContainer.pivot.y = height / 2;
            
            // Освобождаем URL
            URL.revokeObjectURL(imageUrl);
            
        } catch (error) {
            console.warn('Не удалось загрузить превью изображения, показываем заглушку:', error);
            
            // Fallback: простой прямоугольник-заглушка
            const graphics = new PIXI.Graphics();
            graphics.beginFill(0xF8F9FA, 0.8);
            graphics.lineStyle(2, 0xDEE2E6, 0.8);
            graphics.drawRoundedRect(0, 0, maxWidth, maxHeight, 8);
            graphics.endFill();
            
            // Иконка изображения
            graphics.beginFill(0x6C757D, 0.6);
            graphics.drawRoundedRect(maxWidth * 0.2, maxHeight * 0.15, maxWidth * 0.6, maxHeight * 0.3, 4);
            graphics.endFill();
            
            // Текст названия файла
            const fileName = this.selectedImage.fileName || 'Image';
            const displayName = fileName.length > 20 ? fileName.substring(0, 17) + '...' : fileName;
            
            const nameText = new PIXI.Text(displayName, {
                fontFamily: 'Arial, sans-serif',
                fontSize: 12,
                fill: 0x495057,
                align: 'center',
                wordWrap: true,
                wordWrapWidth: maxWidth - 10
            });
            
            nameText.x = (maxWidth - nameText.width) / 2;
            nameText.y = maxHeight * 0.55;
            
            this.ghostContainer.addChild(graphics);
            this.ghostContainer.addChild(nameText);
            
            // Центрируем контейнер относительно курсора
            this.ghostContainer.pivot.x = maxWidth / 2;
            this.ghostContainer.pivot.y = maxHeight / 2;
        }
        
        this.world.addChild(this.ghostContainer);
    }

    /**
     * Показать "призрак" изображения по URL (для выбора из панели эмоджи)
     */
    async showImageUrlGhost() {
        if (!this.pending || this.pending.type !== 'image' || !this.world) return;
        const src = this.pending.properties?.src;
        if (!src) return;

        this.hideGhost();

        this.ghostContainer = new PIXI.Container();
        this.ghostContainer.alpha = 0.6;

        // Для эмоджи используем точные размеры из pending для согласованности
        const isEmojiIcon = this.pending.properties?.isEmojiIcon;
        const maxWidth = this.pending.size?.width || this.pending.properties?.width || (isEmojiIcon ? 64 : 56);
        const maxHeight = this.pending.size?.height || this.pending.properties?.height || (isEmojiIcon ? 64 : 56);

        try {
            const texture = await PIXI.Texture.fromURL(src);
            const imageAspect = (texture.width || 1) / (texture.height || 1);
            let width = maxWidth;
            let height = maxWidth / imageAspect;
            if (height > maxHeight) {
                height = maxHeight;
                width = maxHeight * imageAspect;
            }

            const sprite = new PIXI.Sprite(texture);
            sprite.width = Math.max(1, Math.round(width));
            sprite.height = Math.max(1, Math.round(height));

            const border = new PIXI.Graphics();
            try { border.lineStyle({ width: 2, color: 0xDEE2E6, alpha: 0.8 }); }
            catch (_) { border.lineStyle(2, 0xDEE2E6, 0.8); }
            border.drawRoundedRect(-2, -2, sprite.width + 4, sprite.height + 4, 4);

            this.ghostContainer.addChild(border);
            this.ghostContainer.addChild(sprite);
            this.ghostContainer.pivot.set(sprite.width / 2, sprite.height / 2);
        } catch (e) {
            const g = new PIXI.Graphics();
            g.beginFill(0xF0F0F0, 0.8);
            g.lineStyle(2, 0xDEE2E6, 0.8);
            g.drawRoundedRect(0, 0, maxWidth, maxHeight, 8);
            g.endFill();
            this.ghostContainer.addChild(g);
            this.ghostContainer.pivot.set(maxWidth / 2, maxHeight / 2);
        }

        this.world.addChild(this.ghostContainer);

        // Для эмоджи не используем кастомный курсор, чтобы избежать дублирования призраков
        if (!isEmojiIcon) {
            // Кастомный курсор только для обычных изображений
            try {
                if (this.app && this.app.view && src) {
                    const cursorSize = 24;
                    const url = encodeURI(src);
                    // Используем CSS cursor с изображением, если поддерживается
                    this.app.view.style.cursor = `url(${url}) ${Math.floor(cursorSize/2)} ${Math.floor(cursorSize/2)}, default`;
                }
            } catch (_) {}
        } else {
            // Для эмоджи используем стандартный курсор
            if (this.app && this.app.view) {
                this.app.view.style.cursor = 'crosshair';
            }
        }
    }

    /**
     * Показать "призрак" текста
     */
    showTextGhost() {
        if (!this.pending || this.pending.type !== 'text' || !this.world) return;
        
        this.hideGhost(); // Сначала убираем старый призрак
        
        // Создаем контейнер для призрака
        this.ghostContainer = new PIXI.Container();
        this.ghostContainer.alpha = 0.6; // Полупрозрачность
        
        // Размеры призрака текста
        const fontSize = this.pending.properties?.fontSize || 18;
        const width = 120;
        const height = fontSize + 20; // Высота зависит от размера шрифта
        
        // Фон для текста (полупрозрачный прямоугольник)
        const background = new PIXI.Graphics();
        background.beginFill(0xFFFFFF, 0.8);
        background.lineStyle(1, 0x007BFF, 0.8);
        background.drawRoundedRect(0, 0, width, height, 4);
        background.endFill();
        
        // Текст-заглушка
        const placeholderText = new PIXI.Text('Текст', {
            fontFamily: 'Arial, sans-serif',
            fontSize: fontSize,
            fill: 0x6C757D,
            align: 'left'
        });
        
        placeholderText.x = 8;
        placeholderText.y = (height - placeholderText.height) / 2;
        
        // Иконка курсора (маленькая вертикальная линия)
        const cursor = new PIXI.Graphics();
        cursor.lineStyle(2, 0x007BFF, 0.8);
        cursor.moveTo(placeholderText.x + placeholderText.width + 4, placeholderText.y);
        cursor.lineTo(placeholderText.x + placeholderText.width + 4, placeholderText.y + placeholderText.height);
        
        this.ghostContainer.addChild(background);
        this.ghostContainer.addChild(placeholderText);
        this.ghostContainer.addChild(cursor);
        
        // Центрируем контейнер относительно курсора
        this.ghostContainer.pivot.x = width / 2;
        this.ghostContainer.pivot.y = height / 2;
        
        this.world.addChild(this.ghostContainer);
    }

    /**
     * Показать "призрак" записки
     */
    showNoteGhost() {
        if (!this.pending || this.pending.type !== 'note' || !this.world) return;
        
        this.hideGhost(); // Сначала убираем старый призрак
        
        // Создаем контейнер для призрака
        this.ghostContainer = new PIXI.Container();
        this.ghostContainer.alpha = 0.6; // Полупрозрачность
        
        // Размеры и стили (без текста у призрака)
        const width = this.pending.properties?.width || 250;
        const height = this.pending.properties?.height || 250;
        const backgroundColor = (typeof this.pending.properties?.backgroundColor === 'number')
            ? this.pending.properties.backgroundColor
            : 0xFFF9C4; // желтый как у записки
        const textColor = (typeof this.pending.properties?.textColor === 'number')
            ? this.pending.properties.textColor
            : 0x1A1A1A;

        // Тени для призрака отключены по требованию (без тени)

        // Основной фон записки (желтый как у оригинала)
        const background = new PIXI.Graphics();
        background.beginFill(backgroundColor, 1);
        background.drawRoundedRect(0, 0, width, height, 2);
        background.endFill();

        // У призрака текста нет — только фон записки

        // Порядок добавления: тень → фон → шапка → текст
        // Без тени
        this.ghostContainer.addChild(background);
        
        // Центрируем контейнер относительно курсора
        this.ghostContainer.pivot.x = width / 2;
        this.ghostContainer.pivot.y = height / 2;
        
        this.world.addChild(this.ghostContainer);
        // Текст убран — дополнительная загрузка шрифтов для призрака не требуется
    }

    /**
     * Показать "призрак" эмоджи
     */
    showEmojiGhost() {
        if (!this.pending || this.pending.type !== 'emoji' || !this.world) return;
        
        this.hideGhost(); // Сначала убираем старый призрак
        
        // Создаем контейнер для призрака
        this.ghostContainer = new PIXI.Container();
        this.ghostContainer.alpha = 0.7; // Немного менее прозрачный для эмоджи
        
        // Получаем параметры эмоджи из pending
        const content = this.pending.properties?.content || '🙂';
        const fontSize = this.pending.properties?.fontSize || 48;
        const width = this.pending.properties?.width || fontSize;
        const height = this.pending.properties?.height || fontSize;
        
        // Создаем эмоджи текст (как в EmojiObject)
        const emojiText = new PIXI.Text(content, {
            fontFamily: 'Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, Arial',
            fontSize: fontSize
        });
        
        // Устанавливаем якорь в левом верхнем углу (как в EmojiObject)
        if (typeof emojiText.anchor?.set === 'function') {
            emojiText.anchor.set(0, 0);
        }
        
        // Получаем базовые размеры для масштабирования
        const bounds = emojiText.getLocalBounds();
        const baseW = Math.max(1, bounds.width || 1);
        const baseH = Math.max(1, bounds.height || 1);
        
        // Применяем равномерное масштабирование для подгонки под целевые размеры
        const scaleX = width / baseW;
        const scaleY = height / baseH;
        const scale = Math.min(scaleX, scaleY); // Равномерное масштабирование
        
        emojiText.scale.set(scale, scale);
        
        // Добавляем лёгкий фон для лучшей видимости призрака
        const background = new PIXI.Graphics();
        background.beginFill(0xFFFFFF, 0.3); // Полупрозрачный белый фон
        background.lineStyle(1, 0xDDDDDD, 0.5); // Тонкая граница
        background.drawRoundedRect(-4, -4, width + 8, height + 8, 4);
        background.endFill();
        
        this.ghostContainer.addChild(background);
        this.ghostContainer.addChild(emojiText);
        
        // Центрируем контейнер относительно курсора
        this.ghostContainer.pivot.x = width / 2;
        this.ghostContainer.pivot.y = height / 2;
        
        this.world.addChild(this.ghostContainer);
    }

    /**
     * Показать "призрак" фрейма
     */
    showFrameGhost() {
        if (!this.pending || this.pending.type !== 'frame' || !this.world) return;
        
        this.hideGhost(); // Сначала убираем старый призрак
        
        // Создаем контейнер для призрака
        this.ghostContainer = new PIXI.Container();
        this.ghostContainer.alpha = 0.6; // Полупрозрачность
        
        // Получаем параметры фрейма из pending
        const width = this.pending.properties?.width || 200;
        const height = this.pending.properties?.height || 300;
        const fillColor = (this.pending.properties?.backgroundColor ?? this.pending.properties?.fillColor) ?? 0xFFFFFF;
        const title = this.pending.properties?.title || 'Новый';

        // Читаем стили рамки как у реального фрейма (FrameObject)
        const rootStyles = (typeof window !== 'undefined') ? getComputedStyle(document.documentElement) : null;
        const cssBorderWidth = rootStyles ? parseFloat(rootStyles.getPropertyValue('--frame-border-width') || '4') : 4;
        const cssCornerRadius = rootStyles ? parseFloat(rootStyles.getPropertyValue('--frame-corner-radius') || '6') : 6;
        const cssBorderColor = rootStyles ? rootStyles.getPropertyValue('--frame-border-color').trim() : '';
        const borderWidth = Number.isFinite(cssBorderWidth) ? cssBorderWidth : 4;
        const cornerRadius = Number.isFinite(cssCornerRadius) ? cssCornerRadius : 6;
        let strokeColor;
        if (cssBorderColor && cssBorderColor.startsWith('#')) {
            strokeColor = parseInt(cssBorderColor.slice(1), 16);
        } else {
            strokeColor = (typeof this.pending.properties?.borderColor === 'number') ? this.pending.properties.borderColor : 0xE0E0E0;
        }
        
        // Создаем фон фрейма (как в FrameObject) — повторяем стили рамки
        const frameGraphics = new PIXI.Graphics();
        try {
            frameGraphics.lineStyle({ width: borderWidth, color: strokeColor, alpha: 1, alignment: 1 });
        } catch (e) {
            frameGraphics.lineStyle(borderWidth, strokeColor, 1);
        }
        // Заливка как у фрейма, прозрачность задаётся через контейнер (alpha)
        frameGraphics.beginFill(fillColor, 1);
        frameGraphics.drawRoundedRect(0, 0, width, height, cornerRadius);
        frameGraphics.endFill();
        
        // Создаем заголовок фрейма (как в FrameObject)
        const titleText = new PIXI.Text(title, {
            fontFamily: 'Arial, sans-serif',
            fontSize: 14,
            fill: 0x333333,
            fontWeight: 'bold'
        });
        // Размещаем заголовок внутри верхней части фрейма
        titleText.anchor.set(0, 0);
        titleText.x = 8;
        titleText.y = 4;
        
        this.ghostContainer.addChild(frameGraphics);
        this.ghostContainer.addChild(titleText);
        
        // Центрируем контейнер относительно курсора
        this.ghostContainer.pivot.x = width / 2;
        this.ghostContainer.pivot.y = height / 2;
        
        this.world.addChild(this.ghostContainer);
    }

    /**
     * Показать "призрак" фигуры
     */
    showShapeGhost() {
        if (!this.pending || this.pending.type !== 'shape' || !this.world) return;
        
        this.hideGhost(); // Сначала убираем старый призрак
        
        // Создаем контейнер для призрака
        this.ghostContainer = new PIXI.Container();
        this.ghostContainer.alpha = 0.6; // Полупрозрачность
        
        // Получаем параметры фигуры из pending
        const kind = this.pending.properties?.kind || 'square';
        const width = 100; // Стандартный размер по умолчанию
        const height = 100;
        const fillColor = 0x3b82f6; // Синий цвет как в ShapeObject
        const cornerRadius = this.pending.properties?.cornerRadius || 10;
        
        // Создаем графику фигуры (точно как в ShapeObject._draw)
        const shapeGraphics = new PIXI.Graphics();
        shapeGraphics.beginFill(fillColor, 0.8); // Полупрозрачная заливка
        
        switch (kind) {
            case 'circle': {
                const r = Math.min(width, height) / 2;
                shapeGraphics.drawCircle(width / 2, height / 2, r);
                break;
            }
            case 'rounded': {
                const r = cornerRadius || 10;
                shapeGraphics.drawRoundedRect(0, 0, width, height, r);
                break;
            }
            case 'triangle': {
                shapeGraphics.moveTo(width / 2, 0);
                shapeGraphics.lineTo(width, height);
                shapeGraphics.lineTo(0, height);
                shapeGraphics.lineTo(width / 2, 0);
                break;
            }
            case 'diamond': {
                shapeGraphics.moveTo(width / 2, 0);
                shapeGraphics.lineTo(width, height / 2);
                shapeGraphics.lineTo(width / 2, height);
                shapeGraphics.lineTo(0, height / 2);
                shapeGraphics.lineTo(width / 2, 0);
                break;
            }
            case 'parallelogram': {
                const skew = Math.min(width * 0.25, 20);
                shapeGraphics.moveTo(skew, 0);
                shapeGraphics.lineTo(width, 0);
                shapeGraphics.lineTo(width - skew, height);
                shapeGraphics.lineTo(0, height);
                shapeGraphics.lineTo(skew, 0);
                break;
            }
            case 'arrow': {
                const shaftH = Math.max(6, height * 0.3);
                const shaftY = (height - shaftH) / 2;
                shapeGraphics.drawRect(0, shaftY, width * 0.6, shaftH);
                shapeGraphics.moveTo(width * 0.6, 0);
                shapeGraphics.lineTo(width, height / 2);
                shapeGraphics.lineTo(width * 0.6, height);
                shapeGraphics.lineTo(width * 0.6, 0);
                break;
            }
            case 'square':
            default: {
                shapeGraphics.drawRect(0, 0, width, height);
                break;
            }
        }
        shapeGraphics.endFill();
        
        // Добавляем тонкую рамку для лучшей видимости призрака
        const border = new PIXI.Graphics();
        border.lineStyle(2, 0x007BFF, 0.6);
        border.drawRect(-2, -2, width + 4, height + 4);
        
        this.ghostContainer.addChild(border);
        this.ghostContainer.addChild(shapeGraphics);
        
        // Центрируем контейнер относительно курсора
        this.ghostContainer.pivot.x = width / 2;
        this.ghostContainer.pivot.y = height / 2;
        
        this.world.addChild(this.ghostContainer);
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
            this.eventBus.emit(Events.UI.ToolbarAction, {
                type: 'image',
                id: 'image',
                position,
                properties: { 
                    src: uploadResult.url, 
                    name: uploadResult.name, 
                    width: targetW, 
                    height: targetH 
                },
                imageId: uploadResult.imageId || uploadResult.id // Сохраняем ID изображения
            });
            
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
            
            this.eventBus.emit(Events.UI.ToolbarAction, {
                type: 'image',
                id: 'image',
                position,
                properties: { 
                    src: imageUrl,
                    name: this.selectedImage.fileName,
                    width: targetW,
                    height: targetH
                }
            });
            
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


