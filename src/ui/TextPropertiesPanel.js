import { Events } from '../core/events/Events.js';

/**
 * TextPropertiesPanel — всплывающая панель свойств для текстовых объектов
 */
export class TextPropertiesPanel {
    constructor(container, eventBus, core) {
        this.container = container;
        this.eventBus = eventBus;
        this.core = core;
        this.layer = null;
        this.panel = null;
        this.currentId = null;
        this.isTextEditing = false; // Флаг режима редактирования текста
        
        this._onDocMouseDown = this._onDocMouseDown.bind(this);
    }

    attach() {
        this.layer = document.createElement('div');
        this.layer.className = 'text-properties-layer';
        Object.assign(this.layer.style, {
            position: 'absolute', 
            inset: '0', 
            pointerEvents: 'none', 
            zIndex: 20 // Меньше чем у комментариев, но выше основного контента
        });
        this.container.appendChild(this.layer);

        // Подписки на события
        this.eventBus.on(Events.Tool.SelectionAdd, () => this.updateFromSelection());
        this.eventBus.on(Events.Tool.SelectionRemove, () => this.updateFromSelection());
        this.eventBus.on(Events.Tool.SelectionClear, () => this.hide());
        this.eventBus.on(Events.Tool.DragUpdate, () => this.reposition());
        this.eventBus.on(Events.Tool.GroupDragUpdate, () => this.reposition());
        this.eventBus.on(Events.Tool.ResizeUpdate, () => this.reposition());
        this.eventBus.on(Events.Tool.RotateUpdate, () => this.reposition());
        this.eventBus.on(Events.UI.ZoomPercent, () => this.reposition());
        this.eventBus.on(Events.Tool.PanUpdate, () => this.reposition());
        this.eventBus.on(Events.Object.Deleted, ({ objectId }) => {
            if (this.currentId && objectId === this.currentId) this.hide();
        });
        
        // Скрываем панель во время редактирования текста
        this.eventBus.on(Events.UI.TextEditStart, () => {
            this.isTextEditing = true;
            this.hide();
        });
        this.eventBus.on(Events.UI.TextEditEnd, () => {
            this.isTextEditing = false;
            // Небольшая задержка, чтобы не появлялась сразу после завершения редактирования
            setTimeout(() => this.updateFromSelection(), 100);
        });
    }

    destroy() {
        this.hide();
        if (this.layer) this.layer.remove();
        this.layer = null;
    }

    updateFromSelection() {
        // Не показываем панель во время редактирования текста
        if (this.isTextEditing) {
            this.hide();
            return;
        }

        // Показываем только для одиночного выделения текстового объекта
        const ids = this.core?.selectTool ? Array.from(this.core.selectTool.selectedObjects || []) : [];
        if (!ids || ids.length !== 1) { 
            this.hide(); 
            return; 
        }
        
        const id = ids[0];
        const pixi = this.core?.pixi?.objects?.get ? this.core.pixi.objects.get(id) : null;
        if (!pixi) { 
            this.hide(); 
            return; 
        }
        
        const mb = pixi._mb || {};
        if (mb.type !== 'text') { 
            this.hide(); 
            return; 
        }
        
        this.currentId = id;
        this.showFor(id);
    }

    showFor(id) {
        if (!this.layer) return;
        
        if (!this.panel) {
            this.panel = this._createPanel();
            this.layer.appendChild(this.panel);
            document.addEventListener('mousedown', this._onDocMouseDown, true);
        }
        
        this.panel.style.display = 'flex';
        this.reposition();
    }

    hide() {
        this.currentId = null;
        if (this.panel) {
            this.panel.style.display = 'none';
        }
        document.removeEventListener('mousedown', this._onDocMouseDown, true);
    }

    _createPanel() {
        const panel = document.createElement('div');
        panel.className = 'text-properties-panel';
        Object.assign(panel.style, {
            position: 'absolute',
            pointerEvents: 'auto',
            display: 'flex',
            flexDirection: 'row',
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
            height: '40px'
        });

        // Заглушка для содержимого панели
        const placeholder = document.createElement('div');
        placeholder.textContent = 'Панель свойств текста';
        placeholder.style.color = '#666';
        panel.appendChild(placeholder);

        return panel;
    }

    reposition() {
        if (!this.panel || !this.currentId || this.panel.style.display === 'none') return;

        // Получаем позицию и размеры объекта
        const posData = { objectId: this.currentId, position: null };
        const sizeData = { objectId: this.currentId, size: null };
        this.eventBus.emit(Events.Tool.GetObjectPosition, posData);
        this.eventBus.emit(Events.Tool.GetObjectSize, sizeData);

        if (!posData.position || !sizeData.size) return;

        // Получаем зум и позицию мира
        const worldLayer = this.core?.pixi?.worldLayer;
        const scale = worldLayer?.scale?.x || 1;
        const worldX = worldLayer?.x || 0;
        const worldY = worldLayer?.y || 0;

        // Преобразуем координаты объекта в экранные координаты
        const screenX = posData.position.x * scale + worldX;
        const screenY = posData.position.y * scale + worldY;
        const objectWidth = sizeData.size.width * scale;

        // Позиционируем панель над объектом
        const panelX = screenX + (objectWidth / 2) - (this.panel.offsetWidth / 2);
        const panelY = screenY - this.panel.offsetHeight - 10; // 10px отступ от объекта

        // Проверяем границы контейнера
        const containerRect = this.container.getBoundingClientRect();
        const finalX = Math.max(10, Math.min(panelX, containerRect.width - this.panel.offsetWidth - 10));
        const finalY = Math.max(10, panelY);

        this.panel.style.left = `${finalX}px`;
        this.panel.style.top = `${finalY}px`;
    }

    _onDocMouseDown(e) {
        // Скрываем панель при клике вне неё и вне текстового объекта
        if (!this.panel || !e.target) return;
        
        // Если клик внутри панели - не скрываем
        if (this.panel.contains(e.target)) return;
        
        // Проверяем, не кликнули ли по текущему текстовому объекту
        const rect = this.container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Здесь можно добавить проверку попадания в текстовый объект
        // Пока просто скрываем панель
        this.hide();
    }
}
