import { Events } from '../core/events/Events.js';

/**
 * HtmlHandlesLayer — HTML-ручки и рамка для выделенных объектов.
 * 
 * ✅ АКТИВНО ИСПОЛЬЗУЕТСЯ ✅
 * Это основная система ручек ресайза в приложении.
 * Показывает ручки для одного объекта или группы, синхронизирует с worldLayer.
 * Эмитит те же события, что и Pixi ResizeHandles через EventBus.
 * 
 * Альтернатива: ResizeHandles.js (PIXI-ручки, в данный момент не используются)
 */
export class HtmlHandlesLayer {
    constructor(container, eventBus, core) {
        this.container = container;
        this.eventBus = eventBus;
        this.core = core;
        this.layer = null;
        this.visible = false;
        this.target = { type: 'none', id: null, bounds: null };
        this.handles = {};
        this._drag = null;
    }

    attach() {
        this.layer = document.createElement('div');
        this.layer.className = 'moodboard-html-handles';
        Object.assign(this.layer.style, {
            position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: 12,
        });
        this.container.appendChild(this.layer);

        // Подписки: обновлять при изменениях выбора и трансформациях
        this.eventBus.on(Events.Tool.SelectionAdd, () => this.update());
        this.eventBus.on(Events.Tool.SelectionRemove, () => this.update());
        this.eventBus.on(Events.Tool.SelectionClear, () => this.hide());
        this.eventBus.on(Events.Tool.DragUpdate, () => this.update());
        this.eventBus.on(Events.Tool.ResizeUpdate, () => this.update());
        this.eventBus.on(Events.Tool.RotateUpdate, () => this.update());
        this.eventBus.on(Events.Tool.GroupDragUpdate, () => this.update());
        this.eventBus.on(Events.Tool.GroupResizeUpdate, () => this.update());
        this.eventBus.on(Events.Tool.GroupRotateUpdate, () => this.update());
        this.eventBus.on(Events.UI.ZoomPercent, () => this.update());
        this.eventBus.on(Events.Tool.PanUpdate, () => this.update());

        this.update();
    }

    destroy() {
        if (this.layer) this.layer.remove();
        this.layer = null;
    }

    update() {
        if (!this.core) return;
        const selectTool = this.core?.selectTool;
        const ids = selectTool ? Array.from(selectTool.selectedObjects || []) : [];
        if (!ids || ids.length === 0) { this.hide(); return; }
        if (ids.length === 1) {
            const id = ids[0];
            const pixi = this.core.pixi.objects.get(id);
            if (!pixi) { this.hide(); return; }
            // Не показываем рамку/ручки для комментариев
            const mb = pixi._mb || {};
            if (mb.type === 'comment') { this.hide(); return; }
            const b = pixi.getBounds();
            this._showBounds({ x: b.x, y: b.y, width: b.width, height: b.height }, id);
        } else {
            // Группа: вычислим общий bbox по PIXI
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            ids.forEach(id => {
                const p = this.core.pixi.objects.get(id);
                if (!p) return;
                const b = p.getBounds();
                minX = Math.min(minX, b.x);
                minY = Math.min(minY, b.y);
                maxX = Math.max(maxX, b.x + b.width);
                maxY = Math.max(maxY, b.y + b.height);
            });
            if (!isFinite(minX)) { this.hide(); return; }
            this._showBounds({ x: minX, y: minY, width: maxX - minX, height: maxY - minY }, '__group__');
        }
    }

    hide() {
        if (!this.layer) return;
        this.layer.innerHTML = '';
        this.visible = false;
    }

    _showBounds(worldBounds, id) {
        if (!this.layer) return;
        // getBounds() возвращает координаты в экранном (глобальном) пространстве PIXI
        // Преобразуем их в CSS-пиксели, деля на resolution
        const res = (this.core.pixi.app.renderer?.resolution) || 1;
        const view = this.core.pixi.app.view;
        const containerRect = this.container.getBoundingClientRect();
        const viewRect = view.getBoundingClientRect();
        const offsetLeft = viewRect.left - containerRect.left;
        const offsetTop = viewRect.top - containerRect.top;
        const left = offsetLeft + worldBounds.x / res;
        const top = offsetTop + worldBounds.y / res;
        const width = Math.max(1, worldBounds.width / res);
        const height = Math.max(1, worldBounds.height / res);

        this.layer.innerHTML = '';
        const box = document.createElement('div');
        box.className = 'mb-handles-box';
        Object.assign(box.style, {
            position: 'absolute', left: `${left}px`, top: `${top}px`,
            width: `${width}px`, height: `${height}px`,
            border: '1px solid #1DE9B6', boxSizing: 'border-box', pointerEvents: 'none'
        });
        this.layer.appendChild(box);

        // Угловые ручки для ресайза - круглые с мятно-зелёным цветом и белой серединой
        const mkCorner = (dir, x, y, cursor) => {
            const h = document.createElement('div');
            h.dataset.dir = dir; h.dataset.id = id;
            Object.assign(h.style, {
                position: 'absolute', width: '12px', height: '12px',
                background: '#1DE9B6', 
                border: '2px solid #1DE9B6', 
                borderRadius: '50%', // Делаем круглыми
                boxSizing: 'border-box',
                pointerEvents: 'auto', 
                zIndex: 10, // Увеличиваем z-index
                cursor: cursor
            });
            h.style.left = `${x - 6}px`;
            h.style.top = `${y - 6}px`;
            
            // Создаем внутренний белый круг
            const inner = document.createElement('div');
            Object.assign(inner.style, {
                position: 'absolute',
                top: '1px', left: '1px',
                width: '6px', height: '6px',
                background: '#fff',
                borderRadius: '50%',
                pointerEvents: 'none', // Важно: не блокируем события
                zIndex: 1
            });
            h.appendChild(inner);
            
            // Эффект при наведении
            h.addEventListener('mouseenter', () => {
                h.style.background = '#17C29A';
                h.style.borderColor = '#17C29A';
                h.style.cursor = cursor; // Принудительно устанавливаем курсор
            });
            h.addEventListener('mouseleave', () => {
                h.style.background = '#1DE9B6';
                h.style.borderColor = '#1DE9B6';
            });
            
            // Добавляем отладочную информацию
            h.addEventListener('mousedown', (e) => {
                console.log(`🖱️ Mousedown на ручке: ${dir}, cursor: ${cursor}`);
                this._onHandleDown(e, box);
            });
            
            box.appendChild(h);
        };

        const x0 = 0, y0 = 0, x1 = width, y1 = height, cx = width / 2, cy = height / 2;
        mkCorner('nw', x0, y0, 'nwse-resize');
        mkCorner('ne', x1, y0, 'nesw-resize');
        mkCorner('se', x1, y1, 'nwse-resize');
        mkCorner('sw', x0, y1, 'nesw-resize');

        // Боковые ручки (видимые круглые ручки на серединах сторон)
        mkCorner('n', cx, y0, 'ns-resize');  // верхняя
        mkCorner('e', x1, cy, 'ew-resize');  // правая
        mkCorner('s', cx, y1, 'ns-resize');  // нижняя
        mkCorner('w', x0, cy, 'ew-resize');  // левая

        // Кликабельные грани для ресайза (невидимые области для лучшего UX)
        // Уменьшаем их, чтобы не перекрывать угловые ручки
        const edgeSize = 10; // уменьшаем размер
        const makeEdge = (name, style, cursor) => {
            const e = document.createElement('div');
            e.dataset.edge = name; e.dataset.id = id;
            Object.assign(e.style, style, {
                position: 'absolute', pointerEvents: 'auto', cursor, 
                zIndex: 5, // Меньше чем у ручек (10)
                background: 'transparent' // невидимые области
            });
            e.addEventListener('mousedown', (evt) => this._onEdgeResizeDown(evt));
            box.appendChild(e);
        };
        
        // Создаем грани с отступами от углов, чтобы не мешать угловым ручкам
        const cornerGap = 20; // отступ от углов
        
        // top - с отступами от углов
        makeEdge('top', { 
            left: `${cornerGap}px`, 
            top: `-${edgeSize/2}px`, 
            width: `${Math.max(0, width - 2 * cornerGap)}px`, 
            height: `${edgeSize}px` 
        }, 'ns-resize');
        
        // bottom - с отступами от углов
        makeEdge('bottom', { 
            left: `${cornerGap}px`, 
            top: `${height - edgeSize/2}px`, 
            width: `${Math.max(0, width - 2 * cornerGap)}px`, 
            height: `${edgeSize}px` 
        }, 'ns-resize');
        
        // left - с отступами от углов
        makeEdge('left', { 
            left: `-${edgeSize/2}px`, 
            top: `${cornerGap}px`, 
            width: `${edgeSize}px`, 
            height: `${Math.max(0, height - 2 * cornerGap)}px` 
        }, 'ew-resize');
        
        // right - с отступами от углов
        makeEdge('right', { 
            left: `${width - edgeSize/2}px`, 
            top: `${cornerGap}px`, 
            width: `${edgeSize}px`, 
            height: `${Math.max(0, height - 2 * cornerGap)}px` 
        }, 'ew-resize');

        // Ручка вращения (опционально можно добавить позже)
        this.visible = true;
        this.target = { type: id === '__group__' ? 'group' : 'single', id, bounds: worldBounds };
    }

    _toWorldScreenInverse(dx, dy) {
        const world = this.core.pixi.worldLayer || this.core.pixi.app.stage;
        const s = world?.scale?.x || 1;
        const res = (this.core.pixi.app.renderer?.resolution) || 1;
        return { dxWorld: (dx * res) / s, dyWorld: (dy * res) / s };
    }

    _onHandleDown(e, box) {
        e.preventDefault(); e.stopPropagation();
        const dir = e.currentTarget.dataset.dir;
        const id = e.currentTarget.dataset.id;
        const isGroup = id === '__group__';
        const world = this.core.pixi.worldLayer || this.core.pixi.app.stage;
        const s = world?.scale?.x || 1;
        const tx = world?.x || 0;
        const ty = world?.y || 0;
        const res = (this.core.pixi.app.renderer?.resolution) || 1;
        const view = this.core.pixi.app.view;
        const containerRect = this.container.getBoundingClientRect();
        const viewRect = view.getBoundingClientRect();
        const offsetLeft = viewRect.left - containerRect.left;
        const offsetTop = viewRect.top - containerRect.top;

        const startCSS = {
            left: parseFloat(box.style.left),
            top: parseFloat(box.style.top),
            width: parseFloat(box.style.width),
            height: parseFloat(box.style.height),
        };
        const startScreen = {
            x: (startCSS.left - offsetLeft) * res,
            y: (startCSS.top - offsetTop) * res,
            w: startCSS.width * res,
            h: startCSS.height * res,
        };
        const startWorld = {
            x: (startScreen.x - tx) / s,
            y: (startScreen.y - ty) / s,
            width: startScreen.w / s,
            height: startScreen.h / s,
        };

        let objects = [id];
        if (isGroup) {
            const req = { selection: [] };
            this.eventBus.emit(Events.Tool.GetSelection, req);
            objects = req.selection || [];
            // Сообщаем ядру старт группового ресайза
            this.eventBus.emit(Events.Tool.GroupResizeStart, { objects, startBounds: { ...startWorld } });
        } else {
            // Сигнал о старте одиночного ресайза
            this.eventBus.emit(Events.Tool.ResizeStart, { object: id, handle: dir });
        }

        const startMouse = { x: e.clientX, y: e.clientY };
        const onMove = (ev) => {
            const dx = ev.clientX - startMouse.x;
            const dy = ev.clientY - startMouse.y;
            // Новые CSS-габариты и позиция
            let newLeft = startCSS.left;
            let newTop = startCSS.top;
            let newW = startCSS.width;
            let newH = startCSS.height;
            
            console.log(`🔧 Ресайз ручкой ${dir}: dx=${dx}, dy=${dy}`);
            
            if (dir.includes('e')) newW = Math.max(1, startCSS.width + dx);
            if (dir.includes('s')) newH = Math.max(1, startCSS.height + dy);
            if (dir.includes('w')) { newW = Math.max(1, startCSS.width - dx); newLeft = startCSS.left + dx; }
            if (dir.includes('n')) { newH = Math.max(1, startCSS.height - dy); newTop = startCSS.top + dy; }

            // Обновим визуально
            box.style.left = `${newLeft}px`;
            box.style.top = `${newTop}px`;
            box.style.width = `${newW}px`;
            box.style.height = `${newH}px`;
            // Переставим ручки без перестроения слоя
            this._repositionBoxChildren(box);

            // Перевод в мировые координаты
            const screenX = (newLeft - offsetLeft) * res;
            const screenY = (newTop - offsetTop) * res;
            const screenW = newW * res;
            const screenH = newH * res;
            const worldX = (screenX - tx) / s;
            const worldY = (screenY - ty) / s;
            const worldW = screenW / s;
            const worldH = screenH / s;

            if (isGroup) {
                this.eventBus.emit(Events.Tool.GroupResizeUpdate, {
                    objects,
                    startBounds: { ...startWorld },
                    newBounds: { x: worldX, y: worldY, width: worldW, height: worldH }
                });
            } else {
                this.eventBus.emit(Events.Tool.ResizeUpdate, {
                    object: id,
                    size: { width: worldW, height: worldH },
                    position: { x: worldX, y: worldY }
                });
            }
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            // Финализация
            const endCSS = {
                left: parseFloat(box.style.left),
                top: parseFloat(box.style.top),
                width: parseFloat(box.style.width),
                height: parseFloat(box.style.height),
            };
            const screenX = (endCSS.left - offsetLeft) * res;
            const screenY = (endCSS.top - offsetTop) * res;
            const screenW = endCSS.width * res;
            const screenH = endCSS.height * res;
            const worldX = (screenX - tx) / s;
            const worldY = (screenY - ty) / s;
            const worldW = screenW / s;
            const worldH = screenH / s;

            if (isGroup) {
                this.eventBus.emit(Events.Tool.GroupResizeEnd, { objects });
            } else {
                this.eventBus.emit(Events.Tool.ResizeEnd, {
                    object: id,
                    oldSize: { width: startWorld.width, height: startWorld.height },
                    newSize: { width: worldW, height: worldH },
                    oldPosition: { x: startWorld.x, y: startWorld.y },
                    newPosition: { x: worldX, y: worldY },
                });
            }
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    _onEdgeResizeDown(e) {
        e.preventDefault(); e.stopPropagation();
        const id = e.currentTarget.dataset.id;
        const isGroup = id === '__group__';
        const edge = e.currentTarget.dataset.edge;
        const world = this.core.pixi.worldLayer || this.core.pixi.app.stage;
        const s = world?.scale?.x || 1;
        const tx = world?.x || 0;
        const ty = world?.y || 0;
        const res = (this.core.pixi.app.renderer?.resolution) || 1;
        const view = this.core.pixi.app.view;
        const containerRect = this.container.getBoundingClientRect();
        const viewRect = view.getBoundingClientRect();
        const offsetLeft = viewRect.left - containerRect.left;
        const offsetTop = viewRect.top - containerRect.top;

        const box = e.currentTarget.parentElement;
        const startCSS = {
            left: parseFloat(box.style.left),
            top: parseFloat(box.style.top),
            width: parseFloat(box.style.width),
            height: parseFloat(box.style.height),
        };
        const startScreen = {
            x: (startCSS.left - offsetLeft) * res,
            y: (startCSS.top - offsetTop) * res,
            w: startCSS.width * res,
            h: startCSS.height * res,
        };
        const startWorld = {
            x: (startScreen.x - tx) / s,
            y: (startScreen.y - ty) / s,
            width: startScreen.w / s,
            height: startScreen.h / s,
        };

        let objects = [id];
        if (isGroup) {
            const req = { selection: [] };
            this.eventBus.emit(Events.Tool.GetSelection, req);
            objects = req.selection || [];
            this.eventBus.emit(Events.Tool.GroupResizeStart, { objects, startBounds: { ...startWorld } });
        } else {
            this.eventBus.emit(Events.Tool.ResizeStart, { object: id, handle: edge === 'top' ? 'n' : edge === 'bottom' ? 's' : edge === 'left' ? 'w' : 'e' });
        }

        const startMouse = { x: e.clientX, y: e.clientY };
        const onMove = (ev) => {
            const dxCSS = ev.clientX - startMouse.x;
            const dyCSS = ev.clientY - startMouse.y;
            // Новые CSS-габариты и позиция
            let newLeft = startCSS.left;
            let newTop = startCSS.top;
            let newW = startCSS.width;
            let newH = startCSS.height;
            if (edge === 'right') newW = Math.max(1, startCSS.width + dxCSS);
            if (edge === 'bottom') newH = Math.max(1, startCSS.height + dyCSS);
            if (edge === 'left') { newW = Math.max(1, startCSS.width - dxCSS); newLeft = startCSS.left + dxCSS; }
            if (edge === 'top') { newH = Math.max(1, startCSS.height - dyCSS); newTop = startCSS.top + dyCSS; }

            // Обновим визуально
            box.style.left = `${newLeft}px`;
            box.style.top = `${newTop}px`;
            box.style.width = `${newW}px`;
            box.style.height = `${newH}px`;
            // Переставим ручки/грани
            this._repositionBoxChildren(box);

            // Перевод в мировые координаты
            const screenX = (newLeft - offsetLeft) * res;
            const screenY = (newTop - offsetTop) * res;
            const screenW = newW * res;
            const screenH = newH * res;
            const worldX = (screenX - tx) / s;
            const worldY = (screenY - ty) / s;
            const worldW = screenW / s;
            const worldH = screenH / s;

            if (isGroup) {
                this.eventBus.emit(Events.Tool.GroupResizeUpdate, {
                    objects,
                    startBounds: { ...startWorld },
                    newBounds: { x: worldX, y: worldY, width: worldW, height: worldH }
                });
            } else {
                this.eventBus.emit(Events.Tool.ResizeUpdate, {
                    object: id,
                    size: { width: worldW, height: worldH },
                    position: { x: worldX, y: worldY }
                });
            }
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            const endCSS = {
                left: parseFloat(box.style.left),
                top: parseFloat(box.style.top),
                width: parseFloat(box.style.width),
                height: parseFloat(box.style.height),
            };
            const screenX = (endCSS.left - offsetLeft) * res;
            const screenY = (endCSS.top - offsetTop) * res;
            const screenW = endCSS.width * res;
            const screenH = endCSS.height * res;
            const worldX = (screenX - tx) / s;
            const worldY = (screenY - ty) / s;
            const worldW = screenW / s;
            const worldH = screenH / s;

            if (isGroup) {
                this.eventBus.emit(Events.Tool.GroupResizeEnd, { objects });
            } else {
                this.eventBus.emit(Events.Tool.ResizeEnd, {
                    object: id,
                    oldSize: { width: startWorld.width, height: startWorld.height },
                    newSize: { width: worldW, height: worldH },
                    oldPosition: { x: startWorld.x, y: startWorld.y },
                    newPosition: { x: worldX, y: worldY },
                });
            }
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    _repositionBoxChildren(box) {
        const width = parseFloat(box.style.width);
        const height = parseFloat(box.style.height);
        const cx = width / 2;
        const cy = height / 2;
        
        // Позиционируем все ручки (угловые + боковые)
        box.querySelectorAll('[data-dir]').forEach(h => {
            const dir = h.dataset.dir;
            switch (dir) {
                // Угловые ручки
                case 'nw': h.style.left = `${-6}px`; h.style.top = `${-6}px`; break;
                case 'ne': h.style.left = `${Math.max(-6, width - 6)}px`; h.style.top = `${-6}px`; break;
                case 'se': h.style.left = `${Math.max(-6, width - 6)}px`; h.style.top = `${Math.max(-6, height - 6)}px`; break;
                case 'sw': h.style.left = `${-6}px`; h.style.top = `${Math.max(-6, height - 6)}px`; break;
                // Боковые ручки
                case 'n': h.style.left = `${cx - 6}px`; h.style.top = `${-6}px`; break;
                case 'e': h.style.left = `${Math.max(-6, width - 6)}px`; h.style.top = `${cy - 6}px`; break;
                case 's': h.style.left = `${cx - 6}px`; h.style.top = `${Math.max(-6, height - 6)}px`; break;
                case 'w': h.style.left = `${-6}px`; h.style.top = `${cy - 6}px`; break;
            }
        });
        
        // Позиционируем невидимые области для захвата с отступами от углов
        const edgeSize = 10;
        const cornerGap = 20;
        const top = box.querySelector('[data-edge="top"]');
        const bottom = box.querySelector('[data-edge="bottom"]');
        const left = box.querySelector('[data-edge="left"]');
        const right = box.querySelector('[data-edge="right"]');
        
        if (top) Object.assign(top.style, { 
            left: `${cornerGap}px`, 
            top: `-${edgeSize/2}px`, 
            width: `${Math.max(0, width - 2 * cornerGap)}px`, 
            height: `${edgeSize}px` 
        });
        if (bottom) Object.assign(bottom.style, { 
            left: `${cornerGap}px`, 
            top: `${height - edgeSize/2}px`, 
            width: `${Math.max(0, width - 2 * cornerGap)}px`, 
            height: `${edgeSize}px` 
        });
        if (left) Object.assign(left.style, { 
            left: `-${edgeSize/2}px`, 
            top: `${cornerGap}px`, 
            width: `${edgeSize}px`, 
            height: `${Math.max(0, height - 2 * cornerGap)}px` 
        });
        if (right) Object.assign(right.style, { 
            left: `${width - edgeSize/2}px`, 
            top: `${cornerGap}px`, 
            width: `${edgeSize}px`, 
            height: `${Math.max(0, height - 2 * cornerGap)}px` 
        });
    }
}


