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
        // Показываем панель при изменении выделения
        this.eventBus.on(Events.Tool.SelectionAdd, () => this.updateFromSelection());
        this.eventBus.on(Events.Tool.SelectionRemove, () => this.updateFromSelection());
        this.eventBus.on(Events.Tool.SelectionClear, () => this.hide());

        // Скрываем панель при удалении объекта
        this.eventBus.on(Events.Object.Deleted, (data) => {
            const objectId = data?.objectId || data;
            if (this.currentId && objectId === this.currentId) this.hide();
        });

        // Обновляем позицию / скрываем во время перетаскивания
        this.eventBus.on(Events.Tool.DragStart, () => this.hide());
        this.eventBus.on(Events.Tool.DragUpdate, () => this.reposition());
        this.eventBus.on(Events.Tool.DragEnd, () => this.updateFromSelection());
        this.eventBus.on(Events.Tool.GroupDragUpdate, () => this.reposition());
        this.eventBus.on(Events.Tool.GroupDragStart, () => this.hide());
        this.eventBus.on(Events.Tool.GroupDragEnd, () => this.updateFromSelection());
        this.eventBus.on(Events.Tool.ResizeUpdate, () => this.reposition());
        this.eventBus.on(Events.Tool.RotateUpdate, () => this.reposition());

        // Обновляем позицию при зуме/пане
        this.eventBus.on(Events.UI.ZoomPercent, () => {
            if (this.currentId) this.reposition();
        });

        this.eventBus.on(Events.Tool.PanUpdate, () => {
            if (this.currentId) this.reposition();
        });

        // Скрываем панель при активации других инструментов
        this.eventBus.on(Events.Tool.Activated, ({ tool }) => {
            if (tool !== 'select') {
                this.hide();
            }
        });
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
        
        console.log('📎 FilePropertiesPanel: updateFromSelection - id=', id, 'isFile=', isFile);
        
        if (isFile) {
            this.showFor(id);
        } else {
            this.hide();
        }
    }

    showFor(objectId) {
        console.log('📎 FilePropertiesPanel: Showing panel for objectId:', objectId);
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
        if (!this.currentId || !this.core?.fileUploadService) {
            console.warn('FilePropertiesPanel: не могу скачать файл - нет currentId или fileUploadService');
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

            const fileId = fileObject.fileId;
            const fileName = fileObject.properties?.fileName || 'file';

            console.log('📎 FilePropertiesPanel: Данные файла для скачивания:', {
                fileId,
                fileName,
                downloadUrl: this.core.fileUploadService.getDownloadUrl(fileId)
            });

            if (!fileId) {
                console.warn('FilePropertiesPanel: у файла нет fileId');
                alert('Ошибка: файл не имеет ID для скачивания');
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

            // Скачиваем файл
            await this.core.fileUploadService.downloadFile(fileId, fileName);
            console.log('✅ Файл скачан:', fileName);

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
            const hasFileId = !!(fileObject.fileId);
            
            // Показываем/скрываем кнопку скачивания в зависимости от наличия fileId
            if (this.downloadButton) {
                // Всегда показываем кнопку, даже без fileId
                this.downloadButton.style.display = 'flex';
                this.downloadButton.disabled = !hasFileId;
                this.downloadButton.title = hasFileId ? 'Скачать файл' : 'Файл недоступен для скачивания';
            }
        }
    }

    reposition() {
        if (!this.currentId || !this.panel || this.panel.style.display === 'none') return;

        const pixiObject = this.core?.pixi?.objects?.get(this.currentId);
        if (!pixiObject) return;

        try {
            // Получаем границы объекта в world координатах
            const bounds = pixiObject.getBounds();
            
            // Преобразуем в screen координаты
            const worldToScreen = this.core.pixi.app.stage.worldTransform;
            const screenX = bounds.x * worldToScreen.a + worldToScreen.tx;
            const screenY = bounds.y * worldToScreen.d + worldToScreen.ty;
            
            // Позиционируем панель сверху по центру объекта
            const panelWidth = this.panel.offsetWidth || 120;
            const centerX = screenX + (bounds.width * worldToScreen.a) / 2;
            
            this.panel.style.left = `${centerX - panelWidth / 2}px`;
            this.panel.style.top = `${screenY - 65}px`; // 65px выше объекта (было 45px)
            
        } catch (error) {
            console.warn('FilePropertiesPanel: ошибка позиционирования:', error);
        }
    }

    destroy() {
        if (this.panel && this.panel.parentNode) {
            this.panel.parentNode.removeChild(this.panel);
        }
        this.panel = null;
        this.currentId = null;
    }
}
