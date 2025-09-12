import { Events } from '../core/events/Events.js';
import * as PIXI from 'pixi.js';
import rotateIconSvg from '../assets/icons/rotate-icon.svg?raw';

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
        this._handlesSuppressed = false; // скрывать ручки во время перетаскивания/трансформаций
    }

    attach() {
        this.layer = document.createElement('div');
        this.layer.className = 'moodboard-html-handles';
        this.container.appendChild(this.layer);

        // Подписки: обновлять при изменениях выбора и трансформациях
        this.eventBus.on(Events.Tool.SelectionAdd, () => this.update());
        this.eventBus.on(Events.Tool.SelectionRemove, () => this.update());
        this.eventBus.on(Events.Tool.SelectionClear, () => this.hide());
        this.eventBus.on(Events.Tool.DragUpdate, () => this.update());
        this.eventBus.on(Events.Tool.DragStart, () => { this._handlesSuppressed = true; this._setHandlesVisibility(false); });
        this.eventBus.on(Events.Tool.DragEnd, () => { this._handlesSuppressed = false; this._setHandlesVisibility(true); });
        this.eventBus.on(Events.Tool.ResizeUpdate, () => this.update());
        this.eventBus.on(Events.Tool.ResizeStart, () => { this._handlesSuppressed = true; this._setHandlesVisibility(false); });
        this.eventBus.on(Events.Tool.ResizeEnd, () => { this._handlesSuppressed = false; this._setHandlesVisibility(true); });
        this.eventBus.on(Events.Tool.RotateUpdate, () => this.update());
        this.eventBus.on(Events.Tool.RotateStart, () => { this._handlesSuppressed = true; this._setHandlesVisibility(false); });
        this.eventBus.on(Events.Tool.RotateEnd, () => { this._handlesSuppressed = false; this._setHandlesVisibility(true); });
        this.eventBus.on(Events.Tool.GroupDragUpdate, () => this.update());
        this.eventBus.on(Events.Tool.GroupDragStart, () => { this._handlesSuppressed = true; this._setHandlesVisibility(false); });
        this.eventBus.on(Events.Tool.GroupDragEnd, () => { this._handlesSuppressed = false; this._setHandlesVisibility(true); });
        this.eventBus.on(Events.Tool.GroupResizeUpdate, () => this.update());
        this.eventBus.on(Events.Tool.GroupResizeStart, () => { this._handlesSuppressed = true; this._setHandlesVisibility(false); });
        this.eventBus.on(Events.Tool.GroupResizeEnd, () => { this._handlesSuppressed = false; this._setHandlesVisibility(true); });
        this.eventBus.on(Events.Tool.GroupRotateUpdate, () => this.update());
        this.eventBus.on(Events.Tool.GroupRotateStart, () => { this._handlesSuppressed = true; this._setHandlesVisibility(false); });
        this.eventBus.on(Events.Tool.GroupRotateEnd, () => { this._handlesSuppressed = false; this._setHandlesVisibility(true); });
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
            
            // Получаем данные объекта через события (избегаем проблем с глобальными границами)
            const positionData = { objectId: id, position: null };
            const sizeData = { objectId: id, size: null };
            this.eventBus.emit(Events.Tool.GetObjectPosition, positionData);
            this.eventBus.emit(Events.Tool.GetObjectSize, sizeData);
            
            if (positionData.position && sizeData.size) {
                // Используем данные из состояния вместо getBounds() для избежания масштабирования
                this._showBounds({
                    x: positionData.position.x,
                    y: positionData.position.y,
                    width: sizeData.size.width,
                    height: sizeData.size.height
                }, id);
            } else {
                // Fallback к getBounds() если события не сработали — конвертируем в мировые координаты (без зума)
                const world = this.core.pixi.worldLayer || this.core.pixi.app.stage;
                const b = pixi.getBounds();
                const tl = world.toLocal(new PIXI.Point(b.x, b.y));
                const br = world.toLocal(new PIXI.Point(b.x + b.width, b.y + b.height));
                const wx = Math.min(tl.x, br.x);
                const wy = Math.min(tl.y, br.y);
                const ww = Math.max(1, Math.abs(br.x - tl.x));
                const wh = Math.max(1, Math.abs(br.y - tl.y));
                this._showBounds({ x: wx, y: wy, width: ww, height: wh }, id);
            }
        } else {
            // Группа: считаем bbox в МИРОВЫХ координатах (независимо от текущего зума)
            const world = this.core.pixi.worldLayer || this.core.pixi.app.stage;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            ids.forEach(id => {
                const p = this.core.pixi.objects.get(id);
                if (!p) return;
                const b = p.getBounds();
                // Конвертируем углы прямоугольника из экранных в мировые координаты
                const tl = world.toLocal(new PIXI.Point(b.x, b.y));
                const br = world.toLocal(new PIXI.Point(b.x + b.width, b.y + b.height));
                const x0 = Math.min(tl.x, br.x);
                const y0 = Math.min(tl.y, br.y);
                const x1 = Math.max(tl.x, br.x);
                const y1 = Math.max(tl.y, br.y);
                minX = Math.min(minX, x0);
                minY = Math.min(minY, y0);
                maxX = Math.max(maxX, x1);
                maxY = Math.max(maxY, y1);
            });
            if (!isFinite(minX)) { this.hide(); return; }
            this._showBounds({ x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) }, '__group__');
        }
    }

    hide() {
        if (!this.layer) return;
        this.layer.innerHTML = '';
        this.visible = false;
    }

    _setHandlesVisibility(show) {
        if (!this.layer) return;
        const box = this.layer.querySelector('.mb-handles-box');
        if (!box) return;
        // Уголки
        box.querySelectorAll('[data-dir]').forEach(el => {
            el.style.display = show ? '' : 'none';
        });
        // Рёбра
        box.querySelectorAll('[data-edge]').forEach(el => {
            el.style.display = show ? '' : 'none';
        });
        // Ручка вращения
        const rot = box.querySelector('[data-handle="rotate"]');
        if (rot) rot.style.display = show ? '' : 'none';
        // Если нужно показать, но ручек нет (мы их не создавали в suppressed-режиме) — перерисуем
        if (show && !box.querySelector('[data-dir]')) {
            this.update();
        }
    }

    _showBounds(worldBounds, id) {
        if (!this.layer) return;
        // Преобразуем world координаты в CSS-пиксели
        const res = (this.core.pixi.app.renderer?.resolution) || 1;
        const view = this.core.pixi.app.view;
        const containerRect = this.container.getBoundingClientRect();
        const viewRect = view.getBoundingClientRect();
        const offsetLeft = viewRect.left - containerRect.left;
        const offsetTop = viewRect.top - containerRect.top;
        
        // Получаем масштаб world layer для правильного преобразования
        const world = this.core.pixi.worldLayer || this.core.pixi.app.stage;
        const worldScale = world?.scale?.x || 1;
        const worldX = world?.x || 0;
        const worldY = world?.y || 0;
        
        // Узнаём тип объекта (нужно, чтобы для file/frame отключать определённые элементы)
        let isFileTarget = false;
        let isFrameTarget = false;
        if (id !== '__group__') {
            const req = { objectId: id, pixiObject: null };
            this.eventBus.emit(Events.Tool.GetObjectPixi, req);
            const mbType = req.pixiObject && req.pixiObject._mb && req.pixiObject._mb.type;
            isFileTarget = mbType === 'file';
            isFrameTarget = mbType === 'frame';
        }

        // Вычисляем позицию и размер в CSS координатах, округляем до целых px
        const cssX = offsetLeft + (worldX + worldBounds.x * worldScale) / res;
        const cssY = offsetTop + (worldY + worldBounds.y * worldScale) / res;
        const cssWidth = Math.max(1, (worldBounds.width * worldScale) / res);
        const cssHeight = Math.max(1, (worldBounds.height * worldScale) / res);

        const left = Math.round(cssX);
        const top = Math.round(cssY);
        const width = Math.round(cssWidth);
        const height = Math.round(cssHeight);

        this.layer.innerHTML = '';
        const box = document.createElement('div');
        box.className = 'mb-handles-box';

        // Получаем угол поворота объекта для поворота рамки
        let rotation = 0;
        if (id !== '__group__') {
            const rotationData = { objectId: id, rotation: 0 };
            this.eventBus.emit(Events.Tool.GetObjectRotation, rotationData);
            rotation = rotationData.rotation || 0; // В градусах
        }
        
        Object.assign(box.style, {
            position: 'absolute', left: `${left}px`, top: `${top}px`,
            width: `${width}px`, height: `${height}px`,
            border: '1px solid #1DE9B6', borderRadius: '3px', boxSizing: 'content-box', pointerEvents: 'none',
            transformOrigin: 'center center', // Поворот вокруг центра
            transform: `rotate(${rotation}deg)` // Применяем поворот
        });
        this.layer.appendChild(box);
        // Если сейчас подавление ручек активно — не создавать ручки вовсе, оставляем только рамку
        if (this._handlesSuppressed) {
            this.visible = true;
            return;
        }

        // Угловые ручки для ресайза - круглые с мятно-зелёным цветом и белой серединой
        const mkCorner = (dir, x, y, cursor) => {
            const h = document.createElement('div');
            h.dataset.dir = dir; h.dataset.id = id;
            h.className = 'mb-handle';
            h.style.pointerEvents = isFileTarget ? 'none' : 'auto';
            h.style.cursor = cursor;
            h.style.left = `${x - 6}px`;
            h.style.top = `${y - 6}px`;
            // Для файла скрываем ручки, для остальных показываем
            h.style.display = isFileTarget ? 'none' : 'block';
            
            // Создаем внутренний белый круг
            const inner = document.createElement('div');
            inner.className = 'mb-handle-inner';
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
            
            if (!isFileTarget) {
                h.addEventListener('mousedown', (e) => this._onHandleDown(e, box));
            }
            
            box.appendChild(h);
        };

        const x0 = 0, y0 = 0, x1 = width, y1 = height, cx = Math.round(width / 2), cy = Math.round(height / 2);
        mkCorner('nw', x0, y0, 'nwse-resize');
        mkCorner('ne', x1, y0, 'nesw-resize');
        mkCorner('se', x1, y1, 'nwse-resize');
        mkCorner('sw', x0, y1, 'nesw-resize');

        // Видимые ручки на серединах сторон отключены (масштабирование по рёбрам работает через невидимые зоны)

        // Кликабельные грани для ресайза (невидимые области для лучшего UX)
        // Уменьшаем их, чтобы не перекрывать угловые ручки
        const edgeSize = 10; // уменьшаем размер
        const makeEdge = (name, style, cursor) => {
            const e = document.createElement('div');
            e.dataset.edge = name; e.dataset.id = id;
            e.className = 'mb-edge';
            Object.assign(e.style, style, {
                pointerEvents: isFileTarget ? 'none' : 'auto', cursor, 
                display: isFileTarget ? 'none' : 'block'
            });
            if (!isFileTarget) {
                e.addEventListener('mousedown', (evt) => this._onEdgeResizeDown(evt));
            }
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

        // Ручка вращения: SVG-иконка, показываем для всех, кроме файла
        const rotateHandle = document.createElement('div');
        rotateHandle.dataset.handle = 'rotate'; 
        rotateHandle.dataset.id = id;
        if (isFileTarget || isFrameTarget) {
            Object.assign(rotateHandle.style, { display: 'none', pointerEvents: 'none' });
        } else {
            rotateHandle.className = 'mb-rotate-handle';
            // Фиксированная дистанция 20px по диагонали (top-right → bottom-left) от угла (0, h)
            const d = 38;
            const L = Math.max(1, Math.hypot(width, height));
            const centerX = -(width / L) * d; // влево от левого нижнего угла
            const centerY = height + (height / L) * d; // ниже нижней грани
            rotateHandle.style.left = `${Math.round(centerX - 0)}px`;
            rotateHandle.style.top = `${Math.round(centerY - 10)}px`;
            rotateHandle.innerHTML = rotateIconSvg;
            const svgEl = rotateHandle.querySelector('svg');
            if (svgEl) {
                svgEl.style.width = '100%';
                svgEl.style.height = '100%';
                svgEl.style.display = 'block';
            }
            rotateHandle.addEventListener('mousedown', (e) => this._onRotateHandleDown(e, box));
        }
        box.appendChild(rotateHandle);

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
        // Определяем тип объекта (нужно, чтобы для текста автоподгонять высоту)
        let isTextTarget = false;
        {
            const req = { objectId: id, pixiObject: null };
            this.eventBus.emit(Events.Tool.GetObjectPixi, req);
            const mbType = req.pixiObject && req.pixiObject._mb && req.pixiObject._mb.type;
            isTextTarget = (mbType === 'text' || mbType === 'simple-text');
        }

        const onMove = (ev) => {
            const dx = ev.clientX - startMouse.x;
            const dy = ev.clientY - startMouse.y;
            // Новые CSS-габариты и позиция
            let newLeft = startCSS.left;
            let newTop = startCSS.top;
            let newW = startCSS.width;
            let newH = startCSS.height;
            

            
            if (dir.includes('e')) newW = Math.max(1, startCSS.width + dx);
            if (dir.includes('s')) newH = Math.max(1, startCSS.height + dy);
            if (dir.includes('w')) { 
                newW = Math.max(1, startCSS.width - dx); 
                newLeft = startCSS.left + dx; 
            }
            if (dir.includes('n')) { 
                newH = Math.max(1, startCSS.height - dy); 
                newTop = startCSS.top + dy; 
            }

            // Минимальная ширина = ширина трёх символов текущего шрифта
            if (isTextTarget) {
                try {
                    const textLayer = (typeof window !== 'undefined') ? window.moodboardHtmlTextLayer : null;
                    const el = textLayer && textLayer.idToEl ? textLayer.idToEl.get && textLayer.idToEl.get(id) : null;
                    if (el && typeof window.getComputedStyle === 'function') {
                        const cs = window.getComputedStyle(el);
                        const meas = document.createElement('span');
                        meas.style.position = 'absolute';
                        meas.style.visibility = 'hidden';
                        meas.style.whiteSpace = 'pre';
                        meas.style.fontFamily = cs.fontFamily;
                        meas.style.fontSize = cs.fontSize;
                        meas.style.fontWeight = cs.fontWeight;
                        meas.style.fontStyle = cs.fontStyle;
                        meas.style.letterSpacing = cs.letterSpacing || 'normal';
                        meas.textContent = 'WWW';
                        document.body.appendChild(meas);
                        const minWidthPx = Math.max(1, Math.ceil(meas.getBoundingClientRect().width));
                        meas.remove();
                        if (newW < minWidthPx) {
                            if (dir.includes('w')) {
                                newLeft = startCSS.left + (startCSS.width - minWidthPx);
                            }
                            newW = minWidthPx;
                        }
                    }
                } catch (_) {}
            }

            // Для текстовых объектов подгоняем высоту под контент при изменении ширины
            if (isTextTarget) {
                try {
                    const textLayer = (typeof window !== 'undefined') ? window.moodboardHtmlTextLayer : null;
                    const el = textLayer && textLayer.idToEl ? textLayer.idToEl.get && textLayer.idToEl.get(id) : null;
                    if (el) {
                        // Минимальная ширина в 3 символа
                        let minWidthPx = 0;
                        try {
                            const cs = window.getComputedStyle(el);
                            const meas = document.createElement('span');
                            meas.style.position = 'absolute';
                            meas.style.visibility = 'hidden';
                            meas.style.whiteSpace = 'pre';
                            meas.style.fontFamily = cs.fontFamily;
                            meas.style.fontSize = cs.fontSize;
                            meas.style.fontWeight = cs.fontWeight;
                            meas.style.fontStyle = cs.fontStyle;
                            meas.style.letterSpacing = cs.letterSpacing || 'normal';
                            meas.textContent = 'WWW';
                            document.body.appendChild(meas);
                            minWidthPx = Math.max(1, Math.ceil(meas.getBoundingClientRect().width));
                            meas.remove();
                        } catch (_) {}

                        if (minWidthPx > 0 && newW < minWidthPx) {
                            if (dir.includes('w')) {
                                newLeft = startCSS.left + (startCSS.width - minWidthPx);
                            }
                            newW = minWidthPx;
                        }
                        el.style.width = `${Math.max(1, Math.round(newW))}px`;
                        el.style.height = 'auto';
                        const measured = Math.max(1, Math.round(el.scrollHeight));
                        newH = measured;
                    }
                } catch (_) {}
            }

            // Обновим визуально (округление до целых для избежания дрожания)
            box.style.left = `${Math.round(newLeft)}px`;
            box.style.top = `${Math.round(newTop)}px`;
            box.style.width = `${Math.round(newW)}px`;
            box.style.height = `${Math.round(newH)}px`;
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

            // Определяем, изменилась ли позиция (только для левых/верхних ручек)
            const positionChanged = (newLeft !== startCSS.left) || (newTop !== startCSS.top);

            if (isGroup) {
                this.eventBus.emit(Events.Tool.GroupResizeUpdate, {
                    objects,
                    startBounds: { ...startWorld },
                    newBounds: { x: worldX, y: worldY, width: worldW, height: worldH }
                });
            } else {
                // Определяем тип объекта: для фреймов (locked aspect) позволяем ядру вычислить позицию (симметрия)
                let isFrameTarget = false;
                {
                    const req = { objectId: id, pixiObject: null };
                    this.eventBus.emit(Events.Tool.GetObjectPixi, req);
                    const mbType = req.pixiObject && req.pixiObject._mb && req.pixiObject._mb.type;
                    isFrameTarget = mbType === 'frame';
                }
                // Для правой/нижней ручки — фиксируем стартовую позицию; для левой/верхней — новую (не для frame)
                const isLeftOrTop = dir.includes('w') || dir.includes('n');
                const resizeData = {
                    object: id,
                    size: { width: worldW, height: worldH },
                    position: isFrameTarget ? null : (isLeftOrTop ? { x: worldX, y: worldY } : { x: startWorld.x, y: startWorld.y })
                };

                this.eventBus.emit(Events.Tool.ResizeUpdate, resizeData);
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
                // Определяем, изменилась ли позиция
                const finalPositionChanged = (endCSS.left !== startCSS.left) || (endCSS.top !== startCSS.top);
                
                const isEdgeLeftOrTop = dir.includes('w') || dir.includes('n');
                let isFrameTarget = false;
                {
                    const req = { objectId: id, pixiObject: null };
                    this.eventBus.emit(Events.Tool.GetObjectPixi, req);
                    const mbType = req.pixiObject && req.pixiObject._mb && req.pixiObject._mb.type;
                    isFrameTarget = mbType === 'frame';
                }
                const resizeEndData = {
                    object: id,
                    oldSize: { width: startWorld.width, height: startWorld.height },
                    newSize: { width: worldW, height: worldH },
                    oldPosition: { x: startWorld.x, y: startWorld.y },
                    newPosition: isFrameTarget ? null : (isEdgeLeftOrTop ? { x: worldX, y: worldY } : { x: startWorld.x, y: startWorld.y })
                };

                this.eventBus.emit(Events.Tool.ResizeEnd, resizeEndData);
                // Для текстовых объектов также пробуем обновить размер по контенту ещё раз
                try {
                    const req2 = { objectId: id, pixiObject: null };
                    this.eventBus.emit(Events.Tool.GetObjectPixi, req2);
                    const mbType2 = req2.pixiObject && req2.pixiObject._mb && req2.pixiObject._mb.type;
                    if (mbType2 === 'text' || mbType2 === 'simple-text') {
                        const textLayer = (typeof window !== 'undefined') ? window.moodboardHtmlTextLayer : null;
                        const el = textLayer && textLayer.idToEl ? textLayer.idToEl.get && textLayer.idToEl.get(id) : null;
                        if (el) {
                            el.style.width = `${Math.max(1, Math.round(endCSS.width))}px`;
                            el.style.height = 'auto';
                            const measured = Math.max(1, Math.round(el.scrollHeight));
                            const worldH2 = (measured * res) / s;
                            const fixData = {
                                object: id,
                                size: { width: worldW, height: worldH2 },
                                position: isFrameTarget ? null : (isEdgeLeftOrTop ? { x: worldX, y: worldY } : { x: startWorld.x, y: startWorld.y })
                            };
                            this.eventBus.emit(Events.Tool.ResizeUpdate, fixData);
                        }
                    }
                } catch (_) {}
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
        // Определяем тип объекта: для текста будем автоподгонять высоту при изменении ширины
        let isTextTarget = false;
        {
            const req = { objectId: id, pixiObject: null };
            this.eventBus.emit(Events.Tool.GetObjectPixi, req);
            const mbType = req.pixiObject && req.pixiObject._mb && req.pixiObject._mb.type;
            isTextTarget = (mbType === 'text' || mbType === 'simple-text');
        }
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
            if (edge === 'left') { 
                newW = Math.max(1, startCSS.width - dxCSS); 
                newLeft = startCSS.left + dxCSS; 
            }
            if (edge === 'top') { 
                newH = Math.max(1, startCSS.height - dyCSS); 
                newTop = startCSS.top + dyCSS; 
            }

            // Минимальная ширина = ширина трёх символов текущего шрифта
            if (isTextTarget) {
                try {
                    const textLayer = (typeof window !== 'undefined') ? window.moodboardHtmlTextLayer : null;
                    const el = textLayer && textLayer.idToEl ? textLayer.idToEl.get && textLayer.idToEl.get(id) : null;
                    if (el && typeof window.getComputedStyle === 'function') {
                        const cs = window.getComputedStyle(el);
                        const meas = document.createElement('span');
                        meas.style.position = 'absolute';
                        meas.style.visibility = 'hidden';
                        meas.style.whiteSpace = 'pre';
                        meas.style.fontFamily = cs.fontFamily;
                        meas.style.fontSize = cs.fontSize;
                        meas.style.fontWeight = cs.fontWeight;
                        meas.style.fontStyle = cs.fontStyle;
                        meas.style.letterSpacing = cs.letterSpacing || 'normal';
                        meas.textContent = 'WWW';
                        document.body.appendChild(meas);
                        const minWidthPx = Math.max(1, Math.ceil(meas.getBoundingClientRect().width));
                        meas.remove();
                        if (newW < minWidthPx) {
                            if (edge === 'left') {
                                newLeft = startCSS.left + (startCSS.width - minWidthPx);
                            }
                            newW = minWidthPx;
                        }
                    }
                } catch (_) {}
            }

            // Для текстовых объектов при изменении ширины вычисляем высоту по контенту
            const widthChanged = (edge === 'left' || edge === 'right');
            if (isTextTarget && widthChanged) {
                try {
                    const textLayer = (typeof window !== 'undefined') ? window.moodboardHtmlTextLayer : null;
                    const el = textLayer && textLayer.idToEl ? textLayer.idToEl.get && textLayer.idToEl.get(id) : null;
                    if (el) {
                        el.style.width = `${Math.max(1, Math.round(newW))}px`;
                        el.style.height = 'auto';
                        const measured = Math.max(1, Math.round(el.scrollHeight));
                        newH = measured;
                    }
                } catch (_) {}
            }

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

            // Определяем, изменилась ли позиция (только для левых/верхних граней)
            const edgePositionChanged = (newLeft !== startCSS.left) || (newTop !== startCSS.top);

            if (isGroup) {
                this.eventBus.emit(Events.Tool.GroupResizeUpdate, {
                    objects,
                    startBounds: { ...startWorld },
                    newBounds: { x: worldX, y: worldY, width: worldW, height: worldH }
                });
            } else {
                const edgeResizeData = {
                    object: id,
                    size: { width: worldW, height: worldH },
                    position: edgePositionChanged ? { x: worldX, y: worldY } : { x: startWorld.x, y: startWorld.y }
                };

                this.eventBus.emit(Events.Tool.ResizeUpdate, edgeResizeData);
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
                // Определяем, изменилась ли позиция для краевого ресайза
                const edgeFinalPositionChanged = (endCSS.left !== startCSS.left) || (endCSS.top !== startCSS.top);
                
                // Финальная коррекция высоты для текстовых объектов
                let finalWorldH = worldH;
                if (isTextTarget && (edge === 'left' || edge === 'right')) {
                    try {
                        const textLayer = (typeof window !== 'undefined') ? window.moodboardHtmlTextLayer : null;
                        const el = textLayer && textLayer.idToEl ? textLayer.idToEl.get && textLayer.idToEl.get(id) : null;
                        if (el) {
                            el.style.width = `${Math.max(1, Math.round(endCSS.width))}px`;
                            el.style.height = 'auto';
                            const measured = Math.max(1, Math.round(el.scrollHeight));
                            finalWorldH = (measured * res) / s;
                        }
                    } catch (_) {}
                }

                const edgeResizeEndData = {
                    object: id,
                    oldSize: { width: startWorld.width, height: startWorld.height },
                    newSize: { width: worldW, height: finalWorldH },
                    oldPosition: { x: startWorld.x, y: startWorld.y },
                    newPosition: edgeFinalPositionChanged ? { x: worldX, y: worldY } : { x: startWorld.x, y: startWorld.y }
                };

                this.eventBus.emit(Events.Tool.ResizeEnd, edgeResizeEndData);
            }
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    _onRotateHandleDown(e, box) {
        e.preventDefault(); e.stopPropagation();
        
        const id = e.currentTarget.dataset.id;
        const isGroup = id === '__group__';
        
        // Получаем центр объекта в CSS координатах
        const boxLeft = parseFloat(box.style.left);
        const boxTop = parseFloat(box.style.top);
        const boxWidth = parseFloat(box.style.width);
        const boxHeight = parseFloat(box.style.height);
        const centerX = boxLeft + boxWidth / 2;
        const centerY = boxTop + boxHeight / 2;
        
        // Начальный угол от центра объекта до курсора
        const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
        
        // Получаем текущий поворот объекта из состояния
        let startRotation = 0;
        if (!isGroup) {
            const rotationData = { objectId: id, rotation: 0 };
            this.eventBus.emit(Events.Tool.GetObjectRotation, rotationData);
            startRotation = (rotationData.rotation || 0) * Math.PI / 180; // Преобразуем градусы в радианы
        }
        
        // Изменяем курсор на grabbing
        e.currentTarget.style.cursor = 'grabbing';
        
        // Уведомляем о начале поворота
        if (isGroup) {
            const req = { selection: [] };
            this.eventBus.emit(Events.Tool.GetSelection, req);
            const objects = req.selection || [];
            this.eventBus.emit(Events.Tool.GroupRotateStart, { objects });
        }
        
        const onRotateMove = (ev) => {
            // Вычисляем текущий угол
            const currentAngle = Math.atan2(ev.clientY - centerY, ev.clientX - centerX);
            const deltaAngle = currentAngle - startAngle;
            const newRotation = startRotation + deltaAngle;
            
            if (isGroup) {
                const req = { selection: [] };
                this.eventBus.emit(Events.Tool.GetSelection, req);
                const objects = req.selection || [];
                this.eventBus.emit(Events.Tool.GroupRotateUpdate, { 
                    objects, 
                    angle: newRotation * 180 / Math.PI // Преобразуем радианы в градусы
                });
            } else {
                this.eventBus.emit(Events.Tool.RotateUpdate, { 
                    object: id, 
                    angle: newRotation * 180 / Math.PI // Преобразуем радианы в градусы
                });
            }
        };
        
        const onRotateUp = (ev) => {
            document.removeEventListener('mousemove', onRotateMove);
            document.removeEventListener('mouseup', onRotateUp);
            
            // Возвращаем курсор
            e.currentTarget.style.cursor = 'grab';
            
            // Вычисляем финальный угол
            const finalAngle = Math.atan2(ev.clientY - centerY, ev.clientX - centerX);
            const finalDeltaAngle = finalAngle - startAngle;
            const finalRotation = startRotation + finalDeltaAngle;
            
            if (isGroup) {
                const req = { selection: [] };
                this.eventBus.emit(Events.Tool.GetSelection, req);
                const objects = req.selection || [];
                this.eventBus.emit(Events.Tool.GroupRotateEnd, { objects });
            } else {
                this.eventBus.emit(Events.Tool.RotateEnd, { 
                    object: id, 
                    oldAngle: startRotation * 180 / Math.PI, // Преобразуем радианы в градусы
                    newAngle: finalRotation * 180 / Math.PI  // Преобразуем радианы в градусы
                });
            }
        };
        
        document.addEventListener('mousemove', onRotateMove);
        document.addEventListener('mouseup', onRotateUp);
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
        
        // Позиционируем ручку вращения
        const rotateHandle = box.querySelector('[data-handle="rotate"]');
        if (rotateHandle) {
            const d = 20;
            const L = Math.max(1, Math.hypot(width, height));
            const centerX = -(width / L) * d;
            const centerY = height + (height / L) * d;
            rotateHandle.style.left = `${Math.round(centerX - 10)}px`;
            rotateHandle.style.top = `${Math.round(centerY - 10)}px`;
        }
    }
}


