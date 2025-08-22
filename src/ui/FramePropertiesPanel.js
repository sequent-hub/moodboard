import { Events } from '../core/events/Events.js';

/**
 * Панель свойств фрейма
 * Отображается над выделенным фреймом
 */
export class FramePropertiesPanel {
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
        this.eventBus.on(Events.Object.Deleted, (objectId) => {
            if (this.currentId && objectId === this.currentId) this.hide();
        });

        // Обновляем позицию при любых изменениях (как в TextPropertiesPanel)
        this.eventBus.on(Events.Tool.DragUpdate, () => this.reposition());
        this.eventBus.on(Events.Tool.GroupDragUpdate, () => this.reposition());
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
        // Показываем только для одиночного выделения фрейма
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
        const isFrame = !!(pixi && pixi._mb && pixi._mb.type === 'frame');
        
        console.log('🖼️ FramePropertiesPanel: updateFromSelection - id=', id, 'isFrame=', isFrame);
        
        if (isFrame) {
            this.showFor(id);
        } else {
            this.hide();
        }
    }

    showFor(objectId) {
        console.log('🖼️ FramePropertiesPanel: Showing panel for objectId:', objectId);
        this.currentId = objectId;
        if (this.panel) {
            this.panel.style.display = 'flex';
            this.reposition();
        }
        
        // Обновляем контролы в соответствии с текущими свойствами объекта
        this._updateControlsFromObject();
    }

    hide() {
        this.currentId = null;
        if (this.panel) {
            this.panel.style.display = 'none';
        }
    }

    _createPanel() {
        const panel = document.createElement('div');
        panel.className = 'frame-properties-panel';
        Object.assign(panel.style, {
            position: 'absolute',
            display: 'none',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            backgroundColor: 'white',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            minWidth: '200px',
            height: '44px',
            zIndex: '10000'
        });

        // Пока панель пустая, добавим только заглушку
        const placeholder = document.createElement('span');
        placeholder.textContent = 'Свойства фрейма';
        placeholder.style.color = '#666';
        placeholder.style.fontSize = '12px';
        panel.appendChild(placeholder);

        // Добавляем ID для удобной настройки через DevTools
        panel.id = 'frame-properties-panel';

        this.panel = panel;
        this.container.appendChild(panel);
    }

    _updateControlsFromObject() {
        // Пока ничего не делаем, так как панель пустая
        // Здесь будет логика синхронизации контролов с объектом
    }

    reposition() {
        if (!this.panel || !this.currentId || this.panel.style.display === 'none') {
            return;
        }

        // Проверяем, что наш объект все еще выделен
        const ids = this.core?.selectTool ? Array.from(this.core.selectTool.selectedObjects || []) : [];
        if (!ids.includes(this.currentId)) {
            this.hide();
            return;
        }

        // Получаем позицию и размеры объекта
        const posData = { objectId: this.currentId, position: null };
        this.eventBus.emit(Events.Tool.GetObjectPosition, posData);
        
        const sizeData = { objectId: this.currentId, size: null };
        this.eventBus.emit(Events.Tool.GetObjectSize, sizeData);

        if (!posData.position || !sizeData.size) {
            return;
        }

        const { x, y } = posData.position;
        const { width, height } = sizeData.size;

        // Позиционируем панель НАД фреймом, но ниже ручек ресайза
        const panelWidth = this.panel.offsetWidth || 200;
        const panelHeight = this.panel.offsetHeight || 44;
        
        const panelX = x + panelWidth/2.5; // по центру фрейма
        
        // Пытаемся разместить панель над фреймом
        let  panelY = y ;
        
        // Если панель уходит за верхнюю границу экрана, размещаем её ниже фрейма
        // 10px ниже фрейма

        console.log('🖼️ FramePropertiesPanel: Positioning above frame:', { 
            frameX: x, frameY: y, frameWidth: width, frameHeight: height,
            panelX, panelY
        });

        this.panel.style.left = `${panelX}px`;
        this.panel.style.top = `${panelY}px`;
        
        console.log('🖼️ FramePropertiesPanel: Panel CSS applied:', {
            left: this.panel.style.left,
            top: this.panel.style.top
        });
    }

    destroy() {
        if (this.panel && this.panel.parentNode) {
            this.panel.parentNode.removeChild(this.panel);
        }
        this.panel = null;
        this.currentId = null;
    }
}
