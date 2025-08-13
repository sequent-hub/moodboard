export class MapPanel {
    constructor(container, eventBus) {
        this.container = container;
        this.eventBus = eventBus;
        this.element = null;
        this.popupEl = null;
        this.create();
        this.attach();
    }

    create() {
        this.element = document.createElement('div');
        this.element.className = 'moodboard-mapbar';

        const btn = document.createElement('button');
        btn.className = 'moodboard-mapbar__button';
        btn.title = 'Карта';
        btn.textContent = '🗺️';
        btn.dataset.action = 'toggle-map';

        this.element.appendChild(btn);
        this.container.appendChild(this.element);
    }

    attach() {
        // Клик по кнопке — открыть/закрыть всплывающую панель
        this.element.addEventListener('click', (e) => {
            const btn = e.target.closest('.moodboard-mapbar__button');
            if (!btn) return;
            e.stopPropagation();
            if (this.popupEl) this.hidePopup();
            else this.showPopup();
            this.eventBus.emit('ui:map:toggle');
        });

        // Закрытие по клику вне панели
        document.addEventListener('mousedown', (e) => {
            if (!this.popupEl) return;
            if (this.element.contains(e.target)) return;
            this.hidePopup();
        });

        // Колесо для зума внутри миникарты
        this.element.addEventListener('wheel', (e) => {
            if (!this.popupEl) return;
            if (!this.popupEl.contains(e.target)) return;
            e.preventDefault();
            // Масштабируем вокруг точки под курсором в миникарте
            const rect = this.canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            // Переводим в мировые координаты
            const { worldX, worldY } = this.miniToWorld(mx, my);
            // Переводим мировые координаты в экранные, чтобы использовать существующий зум ядра
            const req = {};
            this.eventBus.emit('ui:minimap:get-data', req);
            const { world } = req;
            const screenX = worldX * (world.scale || 1) + world.x;
            const screenY = worldY * (world.scale || 1) + world.y;
            const delta = e.deltaY;
            this.eventBus.emit('tool:wheel:zoom', { x: screenX, y: screenY, delta });
        }, { passive: false });
    }

    destroy() {
        if (this.element) this.element.remove();
        this.element = null;
    }

    // Показ всплывающей панели (20% ширины/высоты экрана, над кнопкой)
    showPopup() {
        if (this.popupEl) return;
        const popup = document.createElement('div');
        popup.className = 'moodboard-mapbar__popup';

        // Canvas миникарты
        const canvas = document.createElement('canvas');
        canvas.className = 'moodboard-minimap-canvas';
        popup.appendChild(canvas);

        this.element.appendChild(popup);
        this.popupEl = popup;
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        this.layoutCanvas();
        this.renderMinimap();

        // Перерисовка при ресайзе окна
        this._onResize = () => {
            this.layoutCanvas();
            this.renderMinimap();
        };
        window.addEventListener('resize', this._onResize);

        // Интеракция: клик/перетаскивание
        this._dragging = false;
        this.canvas.addEventListener('mousedown', (e) => {
            this._dragging = true;
            this.handlePointer(e);
        });
        document.addEventListener('mousemove', this._onMove = (e) => {
            if (!this._dragging) return;
            this.handlePointer(e);
        });
        document.addEventListener('mouseup', this._onUp = () => {
            this._dragging = false;
        });

        // Регулярно обновлять представление (можно оптимизировать на событиях)
        this._raf = () => {
            if (!this.popupEl) return;
            this.renderMinimap();
            this._rafId = requestAnimationFrame(this._raf);
        };
        this._rafId = requestAnimationFrame(this._raf);
    }

    // Скрыть всплывающую панель
    hidePopup() {
        if (!this.popupEl) return;
        this.popupEl.remove();
        this.popupEl = null;
        this.canvas = null;
        this.ctx = null;
        window.removeEventListener('resize', this._onResize);
        document.removeEventListener('mousemove', this._onMove);
        document.removeEventListener('mouseup', this._onUp);
        if (this._rafId) cancelAnimationFrame(this._rafId);
    }

    layoutCanvas() {
        if (!this.popupEl || !this.canvas) return;
        const rect = this.popupEl.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = Math.max(10, Math.floor(rect.width * dpr));
        this.canvas.height = Math.max(10, Math.floor(rect.height * dpr));
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // Обратное преобразование: миникарта -> мир (используем bbox объектов)
    miniToWorld(miniX, miniY) {
        const req = {};
        this.eventBus.emit('ui:minimap:get-data', req);
        const { view, objects } = req;
        // Рассчитываем bbox по объектам
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        if (objects && objects.length > 0) {
            for (const o of objects) {
                minX = Math.min(minX, o.x);
                minY = Math.min(minY, o.y);
                maxX = Math.max(maxX, o.x + (o.width || 0));
                maxY = Math.max(maxY, o.y + (o.height || 0));
            }
        } else {
            minX = 0; minY = 0; maxX = view.width; maxY = view.height;
        }
        const bboxW = Math.max(1, maxX - minX);
        const bboxH = Math.max(1, maxY - minY);
        const scale = Math.min(this.canvas.clientWidth / bboxW, this.canvas.clientHeight / bboxH);
        const offsetX = (this.canvas.clientWidth - bboxW * scale) / 2;
        const offsetY = (this.canvas.clientHeight - bboxH * scale) / 2;
        const worldX = minX + (miniX - offsetX) / scale;
        const worldY = minY + (miniY - offsetY) / scale;
        return { worldX, worldY };
    }

    handlePointer(e) {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        // Центрируем основной вид на точке
        const { worldX, worldY } = this.miniToWorld(x, y);
        this.eventBus.emit('ui:minimap:center-on', { worldX, worldY });
        this.renderMinimap();
    }

    renderMinimap() {
        if (!this.canvas || !this.ctx) return;
        const ctx = this.ctx;
        const { width, height } = this.canvas;
        ctx.save();
        // canvas.width/height в CSS-пикселях уже учтены через setTransform
        ctx.clearRect(0, 0, width, height);

        // Получаем данные
        const req = {};
        this.eventBus.emit('ui:minimap:get-data', req);
        const { world, view, objects } = req;
        if (!view || !world) return;
        // Вычисляем bbox объектов
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        if (objects && objects.length > 0) {
            for (const o of objects) {
                minX = Math.min(minX, o.x);
                minY = Math.min(minY, o.y);
                maxX = Math.max(maxX, o.x + (o.width || 0));
                maxY = Math.max(maxY, o.y + (o.height || 0));
            }
        } else {
            minX = 0; minY = 0; maxX = view.width; maxY = view.height;
        }
        const bboxW = Math.max(1, maxX - minX);
        const bboxH = Math.max(1, maxY - minY);
        const scale = Math.min(this.canvas.clientWidth / bboxW, this.canvas.clientHeight / bboxH);
        const offsetX = (this.canvas.clientWidth - bboxW * scale) / 2;
        const offsetY = (this.canvas.clientHeight - bboxH * scale) / 2;

        // Фон
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);

        // Объекты в мировых координатах, приведенные по bbox
        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(scale, scale);
        ctx.strokeStyle = '#7b8794';
        ctx.lineWidth = Math.max(0.5, 1 / (world.scale || 1));
        for (const o of objects) {
            const x = o.x - minX;
            const y = o.y - minY;
            const w = Math.max(2, o.width);
            const h = Math.max(2, o.height);
            if (o.rotation) {
                ctx.save();
                const cx = x + w / 2;
                const cy = y + h / 2;
                ctx.translate(cx, cy);
                ctx.rotate((o.rotation * Math.PI) / 180);
                ctx.strokeRect(-w / 2, -h / 2, w, h);
                ctx.restore();
            } else {
                ctx.strokeRect(x, y, w, h);
            }
        }
        ctx.restore();

        // Рамка видимой области: конвертируем текущий экран в мировые координаты и затем в миникарту
        const s = world.scale || 1;
        const worldLeft = -world.x / s;
        const worldTop = -world.y / s;
        const worldRight = (view.width - world.x) / s;
        const worldBottom = (view.height - world.y) / s;
        const rx = offsetX + (worldLeft - minX) * scale;
        const ry = offsetY + (worldTop - minY) * scale;
        const rw = (worldRight - worldLeft) * scale;
        const rh = (worldBottom - worldTop) * scale;
        ctx.strokeStyle = '#1e90ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(rx, ry, rw, rh);
        ctx.restore();
    }
}


