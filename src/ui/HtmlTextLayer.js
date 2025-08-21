import { Events } from '../core/events/Events.js';

/**
 * HtmlTextLayer — рисует текст как HTML-элементы поверх PIXI для максимальной чёткости
 * Синхронизирует позицию/размер/масштаб с миром (worldLayer) и состоянием объектов
 */
export class HtmlTextLayer {
    constructor(container, eventBus, core) {
        this.container = container; // DOM-элемент, где находится canvas
        this.eventBus = eventBus;
        this.core = core; // CoreMoodBoard, нужен доступ к pixi/state
        this.layer = null;
        this.idToEl = new Map();
    }

    attach() {
        // Создаем слой поверх канвы
        this.layer = document.createElement('div');
        this.layer.className = 'moodboard-html-layer';
        Object.assign(this.layer.style, {
            position: 'absolute',
            inset: '0',
            overflow: 'hidden',
            pointerEvents: 'none',
            zIndex: 10, // выше canvas, ниже тулбаров
        });
        // Вставляем рядом с canvas (в том же контейнере)
        this.container.appendChild(this.layer);

        // Подписки
        this.eventBus.on(Events.Object.Created, ({ objectId, objectData }) => {
            if (!objectData) return;
            if (objectData.type === 'text' || objectData.type === 'simple-text') {
                this._ensureTextEl(objectId, objectData);
                this.updateOne(objectId);
            }
        });
        this.eventBus.on(Events.Object.Deleted, ({ objectId }) => {
            this._removeTextEl(objectId);
        });
        this.eventBus.on(Events.Object.TransformUpdated, ({ objectId }) => {
            this.updateOne(objectId);
        });

        // На все операции зума/пэна — полное обновление
        this.eventBus.on(Events.UI.ZoomPercent, () => this.updateAll());
        this.eventBus.on(Events.Tool.PanUpdate, () => this.updateAll());
        // Обновления в реальном времени при перетаскивании/ресайзе/повороте
        this.eventBus.on(Events.Tool.DragUpdate, ({ object }) => this.updateOne(object));
        this.eventBus.on(Events.Tool.ResizeUpdate, ({ object }) => this.updateOne(object));
        this.eventBus.on(Events.Tool.RotateUpdate, ({ object }) => this.updateOne(object));
        this.eventBus.on(Events.Tool.GroupDragUpdate, ({ objects }) => {
            const ids = Array.isArray(objects) ? objects : [];
            ids.forEach(id => this.updateOne(id));
        });
        this.eventBus.on(Events.Tool.GroupResizeUpdate, ({ objects }) => {
            const ids = Array.isArray(objects) ? objects : [];
            ids.forEach(id => this.updateOne(id));
        });
        this.eventBus.on(Events.Tool.GroupRotateUpdate, ({ objects }) => {
            const ids = Array.isArray(objects) ? objects : [];
            ids.forEach(id => this.updateOne(id));
        });

        // Первичная отрисовка
        this.rebuildFromState();
        this.updateAll();

        // Хелпер: при каждом обновлении ручек — обновляем HTML блок
        const world = this.core?.pixi?.worldLayer || this.core?.pixi?.app?.stage;
        if (world) {
            world.on('child:updated', () => this.updateAll()); // на случай внешних обновлений
        }
    }

    destroy() {
        if (this.layer) this.layer.remove();
        this.layer = null;
        this.idToEl.clear();
    }

    rebuildFromState() {
        if (!this.core?.state) return;
        const objs = this.core.state.state.objects || [];
        objs.forEach((o) => {
            if (o.type === 'text' || o.type === 'simple-text') {
                this._ensureTextEl(o.id, o);
            }
        });
        this.updateAll();
    }

    _ensureTextEl(objectId, objectData) {
        if (!this.layer || !objectId) return;
        if (this.idToEl.has(objectId)) return;
        const el = document.createElement('div');
        el.className = 'mb-text';
        el.dataset.id = objectId;
        Object.assign(el.style, {
            position: 'absolute',
            transformOrigin: 'top left',
            color: '#111',
            whiteSpace: 'pre-wrap',
            pointerEvents: 'none', // всё взаимодействие остаётся на PIXI
            userSelect: 'none',
        });
        const content = objectData.content || objectData.properties?.content || '';
        el.textContent = content;
        // Базовые размеры сохраняем в dataset
        const fs = objectData.fontSize || objectData.properties?.fontSize || 16;
        const bw = Math.max(1, objectData.width || objectData.properties?.baseW || 160);
        const bh = Math.max(1, objectData.height || objectData.properties?.baseH || 36);
        el.dataset.baseFontSize = String(fs);
        el.dataset.baseW = String(bw);
        el.dataset.baseH = String(bh);
        this.layer.appendChild(el);
        this.idToEl.set(objectId, el);
    }

    _removeTextEl(objectId) {
        const el = this.idToEl.get(objectId);
        if (el) el.remove();
        this.idToEl.delete(objectId);
    }

    updateAll() {
        if (!this.core?.pixi) return;
        for (const id of this.idToEl.keys()) this.updateOne(id);
    }

    updateOne(objectId) {
        const el = this.idToEl.get(objectId);
        if (!el || !this.core) return;
        const world = this.core.pixi.worldLayer || this.core.pixi.app.stage;
        const s = world?.scale?.x || 1;
        const tx = world?.x || 0;
        const ty = world?.y || 0;
        const res = (this.core?.pixi?.app?.renderer?.resolution) || 1;
        const obj = (this.core.state.state.objects || []).find(o => o.id === objectId);
        if (!obj) return;
        const x = obj.position?.x || 0;
        const y = obj.position?.y || 0;
        const w = obj.width || 0;
        const h = obj.height || 0;
        const angle = obj.rotation || obj.transform?.rotation || 0;

        // Чёткая отрисовка: меняем реальный font-size, учитывая зум и изменение размеров
        const baseFS = parseFloat(el.dataset.baseFontSize || '16') || 16;
        const baseW = parseFloat(el.dataset.baseW || '160') || 160;
        const baseH = parseFloat(el.dataset.baseH || '36') || 36;
        const scaleX = w && baseW ? (w / baseW) : 1;
        const scaleY = h && baseH ? (h / baseH) : 1;
        const sObj = Math.min(scaleX, scaleY);
        const sCss = s / res;
        const fontSizePx = Math.max(1, baseFS * sObj * sCss);
        el.style.fontSize = `${fontSizePx}px`;

        // Позиция и габариты в экранных координатах
        const left = (tx + s * x) / res;
        const top = (ty + s * y) / res;
        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
        if (w && h) {
            el.style.width = `${Math.max(1, (w * s) / res)}px`;
            el.style.height = `${Math.max(1, (h * s) / res)}px`;
        }
        // Поворот вокруг top-left
        if (angle) {
            el.style.transform = `rotate(${angle}deg)`;
        } else {
            el.style.transform = '';
        }
        // Текст
        const content = obj.content || obj.properties?.content;
        if (typeof content === 'string') el.textContent = content;
    }
}


