import { BaseTool } from '../BaseTool.js';
import { Events } from '../../core/events/Events.js';
import * as PIXI from 'pixi.js';

/**
 * Инструмент одноразового размещения объекта по клику на холст
 * Логика: выбираем инструмент/вариант на тулбаре → кликаем на холст → объект создаётся → возврат к Select
 */
export class PlacementTool extends BaseTool {
    constructor(eventBus, core = null) {
        super('place', eventBus);
        this.cursor = 'crosshair';
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
                
                // Показываем призрак для текста, записки, эмоджи, фрейма или фигур, если они активны
                if (this.pending && this.app && this.world) {
                    if (this.pending.type === 'text') {
                        this.showTextGhost();
                    } else if (this.pending.type === 'note') {
                        this.showNoteGhost();
                    } else if (this.pending.type === 'emoji') {
                        this.showEmojiGhost();
                    } else if (this.pending.type === 'frame') {
                        this.showFrameGhost();
                    } else if (this.pending.type === 'shape') {
                        this.showShapeGhost();
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
                this.showFileGhost();
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
        // Курсор указывает на размещение (прицел)
        if (this.app && this.app.view) {
            this.app.view.style.cursor = 'crosshair';
            // Добавляем обработчик движения мыши для "призрака"
            this.app.view.addEventListener('mousemove', this._onMouseMove.bind(this));
        }
        
        // Если есть выбранный файл или изображение, показываем призрак
        if (this.selectedFile) {
            this.showFileGhost();
        } else if (this.selectedImage) {
            this.showImageGhost();
        } else if (this.pending) {
            if (this.pending.type === 'text') {
                this.showTextGhost();
            } else if (this.pending.type === 'note') {
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

        const worldPoint = this._toWorld(event.x, event.y);
        const halfW = (this.pending.size?.width ?? 100) / 2;
        const halfH = (this.pending.size?.height ?? 100) / 2;
        const position = { x: Math.round(worldPoint.x - halfW), y: Math.round(worldPoint.y - halfH) };

        const props = this.pending.properties || {};
        const isTextWithEditing = this.pending.type === 'text' && props.editOnCreate;
        const isImage = this.pending.type === 'image';
        const isFile = this.pending.type === 'file';
        const presetSize = {
            width: (this.pending.size && this.pending.size.width) ? this.pending.size.width : 200,
            height: (this.pending.size && this.pending.size.height) ? this.pending.size.height : 150,
        };

        if (isTextWithEditing) {
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
        
        // Создаем визуальное представление файла (аналогично FileObject)
        const graphics = new PIXI.Graphics();
        const width = this.selectedFile.properties.width || 120;
        const height = this.selectedFile.properties.height || 140;
        
        // Фон файла
        graphics.beginFill(0xF8F9FA, 0.8);
        graphics.lineStyle(2, 0xDEE2E6, 0.8);
        graphics.drawRoundedRect(0, 0, width, height, 8);
        graphics.endFill();
        
        // Иконка файла (простой прямоугольник)
        graphics.beginFill(0x6C757D, 0.6);
        graphics.drawRoundedRect(width * 0.2, height * 0.15, width * 0.6, height * 0.3, 4);
        graphics.endFill();
        
        // Текст названия файла
        const fileName = this.selectedFile.fileName || 'File';
        const displayName = fileName.length > 15 ? fileName.substring(0, 12) + '...' : fileName;
        
        const nameText = new PIXI.Text(displayName, {
            fontFamily: 'Arial, sans-serif',
            fontSize: 12,
            fill: 0x495057,
            align: 'center',
            wordWrap: true,
            wordWrapWidth: width - 10
        });
        
        nameText.x = (width - nameText.width) / 2;
        nameText.y = height * 0.55;
        
        this.ghostContainer.addChild(graphics);
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
        
        // Размеры призрака
        const maxWidth = this.selectedImage.properties.width || 300;
        const maxHeight = this.selectedImage.properties.height || 200;
        
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
        
        // Размеры призрака записки (из настроек NoteObject)
        const width = this.pending.properties?.width || 160;
        const height = this.pending.properties?.height || 100;
        const fontSize = this.pending.properties?.fontSize || 16;
        const content = this.pending.properties?.content || 'Новая записка';
        
        // Фон записки (как в NoteObject)
        const background = new PIXI.Graphics();
        background.beginFill(0xFFF9C4, 0.8); // Светло-желтый с прозрачностью
        background.lineStyle(2, 0xF9A825, 0.8); // Золотистая граница
        background.drawRoundedRect(0, 0, width, height, 8);
        background.endFill();
        
        // Добавляем небольшую тень для реалистичности
        const shadow = new PIXI.Graphics();
        shadow.beginFill(0x000000, 0.1);
        shadow.drawRoundedRect(2, 2, width, height, 8);
        shadow.endFill();
        
        // Текст записки
        const noteText = new PIXI.Text(content, {
            fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
            fontSize: fontSize,
            fill: 0x1A1A1A, // Темный цвет как в NoteObject
            align: 'center',
            wordWrap: true,
            wordWrapWidth: width - 16, // Отступы по 8px с каждой стороны
            lineHeight: fontSize * 1.2
        });
        
        // Центрируем текст в записке
        noteText.x = (width - noteText.width) / 2;
        noteText.y = (height - noteText.height) / 2;
        
        // Добавляем элементы в правильном порядке
        this.ghostContainer.addChild(shadow);
        this.ghostContainer.addChild(background);
        this.ghostContainer.addChild(noteText);
        
        // Центрируем контейнер относительно курсора
        this.ghostContainer.pivot.x = width / 2;
        this.ghostContainer.pivot.y = height / 2;
        
        this.world.addChild(this.ghostContainer);
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
        const fillColor = this.pending.properties?.fillColor || 0xFFFFFF;
        const borderColor = this.pending.properties?.borderColor || 0x333333;
        const title = this.pending.properties?.title || 'Новый';
        
        // Создаем фон фрейма (как в FrameObject)
        const frameGraphics = new PIXI.Graphics();
        frameGraphics.beginFill(fillColor, 0.8); // Полупрозрачная заливка
        frameGraphics.lineStyle(2, borderColor, 0.8); // Граница
        frameGraphics.drawRect(0, 0, width, height);
        frameGraphics.endFill();
        
        // Создаем заголовок фрейма (как в FrameObject)
        const titleText = new PIXI.Text(title, {
            fontFamily: 'Arial, sans-serif',
            fontSize: 14,
            fill: 0x333333,
            fontWeight: 'bold'
        });
        titleText.anchor.set(0, 1); // Левый нижний угол текста
        titleText.y = -5; // Немного выше фрейма
        
        // Добавляем пунктирную рамку для лучшей видимости призрака
        const dashedBorder = new PIXI.Graphics();
        dashedBorder.lineStyle(1, 0x007BFF, 0.6);
        // Создаем пунктирную линию вручную
        for (let i = 0; i <= width; i += 10) {
            if ((i / 10) % 2 === 0) {
                dashedBorder.moveTo(i, -2);
                dashedBorder.lineTo(Math.min(i + 5, width), -2);
            }
        }
        for (let i = 0; i <= height; i += 10) {
            if ((i / 10) % 2 === 0) {
                dashedBorder.moveTo(-2, i);
                dashedBorder.lineTo(-2, Math.min(i + 5, height));
            }
        }
        for (let i = 0; i <= width; i += 10) {
            if ((i / 10) % 2 === 0) {
                dashedBorder.moveTo(i, height + 2);
                dashedBorder.lineTo(Math.min(i + 5, width), height + 2);
            }
        }
        for (let i = 0; i <= height; i += 10) {
            if ((i / 10) % 2 === 0) {
                dashedBorder.moveTo(width + 2, i);
                dashedBorder.lineTo(width + 2, Math.min(i + 5, height));
            }
        }
        
        this.ghostContainer.addChild(frameGraphics);
        this.ghostContainer.addChild(titleText);
        this.ghostContainer.addChild(dashedBorder);
        
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


