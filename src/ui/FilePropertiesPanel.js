import { Events } from '../core/events/Events.js';

/**
 * Панель свойств файла
 * Отображается над выделенным файлом
 */
export class FilePropertiesPanel {
    constructor(eventBus, container, core = null) {
        this.eventBus = eventBus;
        this.container = container;
        this.core = core;
        this.panel = null;
        this.currentId = null;
        
        this._attachEvents();
        this._createPanel();
    }

    _attachEvents() {
        this._handlers = {};
        this._handlers.onSelectionAdd = () => this.updateFromSelection();
        this._handlers.onSelectionRemove = () => this.updateFromSelection();
        this._handlers.onSelectionClear = () => this.hide();
        this._handlers.onDeleted = (data) => {
            const objectId = data?.objectId || data;
            if (this.currentId && objectId === this.currentId) this.hide();
        };
        this._handlers.onDragStart = () => this.hide();
        this._handlers.onDragUpdate = () => this.reposition();
        this._handlers.onDragEnd = () => this.updateFromSelection();
        this._handlers.onGroupDragUpdate = () => this.reposition();
        this._handlers.onGroupDragStart = () => this.hide();
        this._handlers.onGroupDragEnd = () => this.updateFromSelection();
        this._handlers.onResizeUpdate = () => this.reposition();
        this._handlers.onRotateUpdate = () => this.reposition();
        this._handlers.onZoomPercent = () => {
            if (this.currentId) this.reposition();
        };
        this._handlers.onPanUpdate = () => {
            if (this.currentId) this.reposition();
        };
        this._handlers.onActivated = ({ tool }) => {
            if (tool !== 'select') this.hide();
        };
        this._handlers.onTransformUpdated = (data) => {
            if (this.currentId && data?.objectId === this.currentId) this.reposition();
        };

        this.eventBus.on(Events.Tool.SelectionAdd, this._handlers.onSelectionAdd);
        this.eventBus.on(Events.Tool.SelectionRemove, this._handlers.onSelectionRemove);
        this.eventBus.on(Events.Tool.SelectionClear, this._handlers.onSelectionClear);
        this.eventBus.on(Events.Object.Deleted, this._handlers.onDeleted);
        this.eventBus.on(Events.Tool.DragStart, this._handlers.onDragStart);
        this.eventBus.on(Events.Tool.DragUpdate, this._handlers.onDragUpdate);
        this.eventBus.on(Events.Tool.DragEnd, this._handlers.onDragEnd);
        this.eventBus.on(Events.Tool.GroupDragUpdate, this._handlers.onGroupDragUpdate);
        this.eventBus.on(Events.Tool.GroupDragStart, this._handlers.onGroupDragStart);
        this.eventBus.on(Events.Tool.GroupDragEnd, this._handlers.onGroupDragEnd);
        this.eventBus.on(Events.Tool.ResizeUpdate, this._handlers.onResizeUpdate);
        this.eventBus.on(Events.Tool.RotateUpdate, this._handlers.onRotateUpdate);
        this.eventBus.on(Events.UI.ZoomPercent, this._handlers.onZoomPercent);
        this.eventBus.on(Events.Tool.PanUpdate, this._handlers.onPanUpdate);
        this.eventBus.on(Events.Tool.Activated, this._handlers.onActivated);
        this.eventBus.on(Events.Object.TransformUpdated, this._handlers.onTransformUpdated);
    }

    updateFromSelection() {
        // Показываем только для одиночного выделения файла
        const ids = this.core?.selectTool ? Array.from(this.core.selectTool.selectedObjects || []) : [];
        
        if (!ids || ids.length !== 1) { 
            this.hide(); 
            return; 
        }
        
        const id = ids[0];
        
        // Избегаем дублирования - если уже показываем панель для этого объекта
        if (this.currentId === id && this.panel && this.panel.style.display !== 'none') {
            return;
        }
        
        const pixi = this.core?.pixi?.objects?.get ? this.core.pixi.objects.get(id) : null;
        const isFile = !!(pixi && pixi._mb && pixi._mb.type === 'file');
        
        
        if (isFile) {
            this.showFor(id);
        } else {
            this.hide();
        }
    }

    showFor(objectId) {
        this.currentId = objectId;
        if (this.panel) {
            this.panel.style.display = 'flex';
            this.reposition();
        }
        
        // Обновляем кнопки в соответствии с текущими свойствами файла
        this._updateButtonsFromObject();
    }

    hide() {
        this.currentId = null;
        if (this.panel) {
            this.panel.style.display = 'none';
        }
    }

    _createPanel() {
        if (this.panel) return;

        // Создаем основную панель
        this.panel = document.createElement('div');
        this.panel.className = 'moodboard-file-properties-panel';
        this.panel.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            background: white;
            border: 1px solid #E5E7EB;
            border-radius: 8px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            display: none;
            flex-direction: row;
            align-items: center;
            padding: 8px 12px;
            gap: 8px;
            z-index: 1000;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 14px;
            pointer-events: auto;
            user-select: none;
        `;

        // Кнопка скачивания
        this.downloadButton = document.createElement('button');
        this.downloadButton.className = 'moodboard-file-panel-download';
        this.downloadButton.style.cssText = `
            background: #3B82F6;
            color: white;
            border: none;
            border-radius: 6px;
            padding: 6px 12px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: background-color 0.2s;
        `;
        this.downloadButton.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7,10 12,15 17,10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Скачать
        `;

        // Обработчики событий
        this.downloadButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this._handleDownload();
        });

        // Hover эффекты
        this.downloadButton.addEventListener('mouseenter', () => {
            this.downloadButton.style.backgroundColor = '#2563EB';
        });
        this.downloadButton.addEventListener('mouseleave', () => {
            this.downloadButton.style.backgroundColor = '#3B82F6';
        });

        this.panel.appendChild(this.downloadButton);
        this.container.appendChild(this.panel);
    }

    async _handleDownload() {
        if (!this.currentId || !this.core?.state?.getObjects) {
            console.warn('FilePropertiesPanel: не могу скачать файл - нет currentId или state');
            return;
        }

        try {
            // Получаем данные файла
            const objects = this.core.state.getObjects();
            const fileObject = objects.find(obj => obj.id === this.currentId);
            
            console.log('📎 FilePropertiesPanel: Скачивание файла:', {
                currentId: this.currentId,
                fileObject: fileObject,
                hasFileUploadService: !!this.core?.fileUploadService
            });
            
            if (!fileObject || fileObject.type !== 'file') {
                console.warn('FilePropertiesPanel: объект не найден или не является файлом');
                return;
            }

            const fileSrc = typeof fileObject.src === 'string' ? fileObject.src.trim() : '';
            const fileName = fileObject.properties?.fileName || 'file';

            console.log('📎 FilePropertiesPanel: Данные файла для скачивания:', {
                fileSrc,
                fileName,
                hasSrc: !!fileSrc
            });

            if (!fileSrc) {
                console.warn('FilePropertiesPanel: у файла нет src');
                alert('Ошибка: у файла отсутствует src для скачивания');
                return;
            }

            // Показываем состояние загрузки
            const originalText = this.downloadButton.innerHTML;
            this.downloadButton.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M8 12l2 2 4-4"/>
                </svg>
                Скачивание...
            `;
            this.downloadButton.disabled = true;

            // Скачиваем файл напрямую по src (без id-based endpoint)
            const link = document.createElement('a');
            link.href = fileSrc;
            link.download = fileName;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Восстанавливаем кнопку
            setTimeout(() => {
                this.downloadButton.innerHTML = originalText;
                this.downloadButton.disabled = false;
            }, 1000);

        } catch (error) {
            console.error('Ошибка скачивания файла:', error);
            alert('Ошибка скачивания файла: ' + error.message);
            
            // Восстанавливаем кнопку
            this.downloadButton.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7,10 12,15 17,10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Скачать
            `;
            this.downloadButton.disabled = false;
        }
    }

    _updateButtonsFromObject() {
        if (!this.currentId) return;

        // Получаем данные файла для обновления состояния кнопок
        const objects = this.core.state.getObjects();
        const fileObject = objects.find(obj => obj.id === this.currentId);
        
        if (fileObject && fileObject.type === 'file') {
            const hasFileSrc = typeof fileObject.src === 'string' && fileObject.src.trim().length > 0;
            
            // Показываем/скрываем кнопку скачивания в зависимости от наличия src
            if (this.downloadButton) {
                // Всегда показываем кнопку, но отключаем без src
                this.downloadButton.style.display = 'flex';
                this.downloadButton.disabled = !hasFileSrc;
                this.downloadButton.title = hasFileSrc ? 'Скачать файл' : 'Файл недоступен для скачивания';
            }
        }
    }

    reposition() {
        if (!this.currentId || !this.panel || this.panel.style.display === 'none') return;

        // Проверяем, что наш объект все еще выделен
        const ids = this.core?.selectTool ? Array.from(this.core.selectTool.selectedObjects || []) : [];
        if (!ids.includes(this.currentId)) {
            this.hide();
            return;
        }

        // Получаем позицию и размеры объекта
        const posData = { objectId: this.currentId, position: null };
        const sizeData = { objectId: this.currentId, size: null };
        this.eventBus.emit(Events.Tool.GetObjectPosition, posData);
        this.eventBus.emit(Events.Tool.GetObjectSize, sizeData);

        if (!posData.position || !sizeData.size) {
            return;
        }

        // Получаем зум и позицию мира
        const worldLayer = this.core?.pixi?.worldLayer;
        const scale = worldLayer?.scale?.x || 1;
        const worldX = worldLayer?.x || 0;
        const worldY = worldLayer?.y || 0;

        // Преобразуем координаты объекта в экранные координаты
        const screenX = posData.position.x * scale + worldX;
        const screenY = posData.position.y * scale + worldY;
        const objectWidth = sizeData.size.width * scale;

        // Позиционируем панель над объектом по центру
        const panelWidth = this.panel.offsetWidth || 120;
        const panelHeight = this.panel.offsetHeight || 40;
        const panelX = screenX + (objectWidth / 2) - (panelWidth / 2);
        let panelY = screenY - panelHeight - 40; // отступ 40px над файлом

        // Если панель уходит за верх, переносим ниже объекта
        if (panelY < 0) {
            panelY = screenY + (sizeData.size.height * scale) + 40;
        }

        // Проверяем границы контейнера
        const containerRect = this.container.getBoundingClientRect();
        const finalX = Math.max(10, Math.min(panelX, containerRect.width - panelWidth - 10));
        const finalY = Math.max(10, panelY);

        this.panel.style.left = `${Math.round(finalX)}px`;
        this.panel.style.top = `${Math.round(finalY)}px`;
    }

    destroy() {
        if (!this.eventBus || !this._handlers) return;

        this.eventBus.off(Events.Tool.SelectionAdd, this._handlers.onSelectionAdd);
        this.eventBus.off(Events.Tool.SelectionRemove, this._handlers.onSelectionRemove);
        this.eventBus.off(Events.Tool.SelectionClear, this._handlers.onSelectionClear);
        this.eventBus.off(Events.Object.Deleted, this._handlers.onDeleted);
        this.eventBus.off(Events.Tool.DragStart, this._handlers.onDragStart);
        this.eventBus.off(Events.Tool.DragUpdate, this._handlers.onDragUpdate);
        this.eventBus.off(Events.Tool.DragEnd, this._handlers.onDragEnd);
        this.eventBus.off(Events.Tool.GroupDragUpdate, this._handlers.onGroupDragUpdate);
        this.eventBus.off(Events.Tool.GroupDragStart, this._handlers.onGroupDragStart);
        this.eventBus.off(Events.Tool.GroupDragEnd, this._handlers.onGroupDragEnd);
        this.eventBus.off(Events.Tool.ResizeUpdate, this._handlers.onResizeUpdate);
        this.eventBus.off(Events.Tool.RotateUpdate, this._handlers.onRotateUpdate);
        this.eventBus.off(Events.UI.ZoomPercent, this._handlers.onZoomPercent);
        this.eventBus.off(Events.Tool.PanUpdate, this._handlers.onPanUpdate);
        this.eventBus.off(Events.Tool.Activated, this._handlers.onActivated);
        this.eventBus.off(Events.Object.TransformUpdated, this._handlers.onTransformUpdated);
        this._handlers = null;

        if (this.panel && this.panel.parentNode) {
            this.panel.parentNode.removeChild(this.panel);
        }
        this.panel = null;
        this.currentId = null;
    }
}
