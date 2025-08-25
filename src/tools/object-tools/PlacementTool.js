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

        if (this.eventBus) {
            this.eventBus.on(Events.Place.Set, (cfg) => {
                this.pending = cfg ? { ...cfg } : null;
            });
            // Сброс pending при явном выборе select-инструмента
            this.eventBus.on(Events.Tool.Activated, ({ tool }) => {
                if (tool === 'select') {
                    this.pending = null;
                }
            });
        }
    }

    activate(app) {
        super.activate();
        this.app = app;
        this.world = this._getWorldLayer();
        // Курсор указывает на размещение (прицел)
        if (this.app && this.app.view) this.app.view.style.cursor = 'crosshair';
    }

    deactivate() {
        super.deactivate();
        if (this.app && this.app.view) this.app.view.style.cursor = '';
        this.app = null;
        this.world = null;
    }

    onMouseDown(event) {
        super.onMouseDown(event);
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
                            imageId: uploadResult.id // Сохраняем ID изображения
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
                    
                    // Получаем информацию о файле
                    const fileName = file.name;
                    const fileSize = file.size;
                    const mimeType = file.type;
                    
                    // Создаем объект файла
                    this.eventBus.emit(Events.UI.ToolbarAction, {
                        type: 'file',
                        id: 'file',
                        position,
                        properties: { 
                            fileName: fileName,
                            fileSize: fileSize,
                            mimeType: mimeType,
                            content: file, // Сохраняем файл для возможного использования
                            width: props.width || 120,
                            height: props.height || 140
                        }
                    });
                    
                    // Возвращаемся к инструменту выделения после создания файла
                    this.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'select' });
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
}


