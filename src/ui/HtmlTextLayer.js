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

        // Прятать HTML-текст во время редактирования (textarea)
        this.eventBus.on(Events.UI.TextEditStart, ({ objectId }) => {
            const el = this.idToEl.get(objectId);
            if (el) el.style.visibility = 'hidden';
        });
        this.eventBus.on(Events.UI.TextEditEnd, ({ objectId }) => {
            const el = this.idToEl.get(objectId);
            if (el) el.style.visibility = '';
        });

        // Обработка событий скрытия/показа текста от SelectTool
        this.eventBus.on(Events.Tool.HideObjectText, ({ objectId }) => {
            console.log(`🔍 HtmlTextLayer: скрываю текст для объекта ${objectId}`);
            const el = this.idToEl.get(objectId);
            if (el) {
                el.style.visibility = 'hidden';
                console.log(`🔍 HtmlTextLayer: текст ${objectId} скрыт (visibility: hidden)`);
            } else {
                console.warn(`❌ HtmlTextLayer: HTML-элемент для объекта ${objectId} не найден`);
            }
        });
        this.eventBus.on(Events.Tool.ShowObjectText, ({ objectId }) => {
            console.log(`🔍 HtmlTextLayer: показываю текст для объекта ${objectId}`);
            const el = this.idToEl.get(objectId);
            if (el) {
                el.style.visibility = '';
                console.log(`🔍 HtmlTextLayer: текст ${objectId} показан (visibility: visible)`);
            } else {
                console.warn(`❌ HtmlTextLayer: HTML-элемент для объекта ${objectId} не найден`);
            }
        });

        // Обработка обновления содержимого текста
        this.eventBus.on(Events.Tool.UpdateObjectContent, ({ objectId, content }) => {
            console.log(`🔍 HtmlTextLayer: обновляю содержимое для объекта ${objectId}:`, content);
            const el = this.idToEl.get(objectId);
            if (el && typeof content === 'string') {
                el.textContent = content;
                console.log(`🔍 HtmlTextLayer: содержимое обновлено для ${objectId}:`, content);
            } else {
                console.warn(`❌ HtmlTextLayer: не удалось обновить содержимое для ${objectId}:`, { el: !!el, content });
            }
        });

        // Обработка изменения состояния объекта (для fontFamily и других свойств)
        this.eventBus.on(Events.Object.StateChanged, ({ objectId, updates }) => {
            const el = this.idToEl.get(objectId);
            if (el && updates) {
                // Поддерживаем верхний уровень и updates.properties.fontFamily
                const nextFont = updates.fontFamily || (updates.properties && updates.properties.fontFamily);
                if (nextFont) {
                    el.style.fontFamily = nextFont;
                    console.log(`🔍 HtmlTextLayer: обновлен шрифт для ${objectId}:`, nextFont);
                }
                if (updates.fontSize) {
                    el.style.fontSize = `${updates.fontSize}px`;
                    // Также обновляем line-height согласно новой шкале
                    const fs = updates.fontSize;
                    const lh = (fs <= 12) ? Math.round(fs * 1.40)
                        : (fs <= 18) ? Math.round(fs * 1.34)
                        : (fs <= 36) ? Math.round(fs * 1.26)
                        : (fs <= 48) ? Math.round(fs * 1.24)
                        : (fs <= 72) ? Math.round(fs * 1.22)
                        : (fs <= 96) ? Math.round(fs * 1.20)
                        : Math.round(fs * 1.18);
                    el.style.lineHeight = `${lh}px`;
                    // Синхронизируем базовый размер шрифта для дальнейших пересчётов (zoom/resize)
                    el.dataset.baseFontSize = String(fs);
                    console.log(`🔍 HtmlTextLayer: обновлен размер шрифта для ${objectId}:`, updates.fontSize);
                }
                if (updates.color) {
                    el.style.color = updates.color;
                    console.log(`🔍 HtmlTextLayer: обновлен цвет для ${objectId}:`, updates.color);
                }
                if (updates.backgroundColor !== undefined) {
                    el.style.backgroundColor = updates.backgroundColor === 'transparent' ? '' : updates.backgroundColor;
                    console.log(`🔍 HtmlTextLayer: обновлен фон для ${objectId}:`, updates.backgroundColor);
                }
                // После изменения свойств текста — автоподгон высоты рамки под контент и принудительное обновление
                this._autoFitTextHeight(objectId);
                this.updateOne(objectId);
            }
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
        console.log(`🔍 HtmlTextLayer: rebuildFromState, найдено объектов:`, objs.length);
        
        objs.forEach((o) => {
            if (o.type === 'text' || o.type === 'simple-text') {
                console.log(`🔍 HtmlTextLayer: создаю HTML-элемент для текстового объекта:`, o);
                this._ensureTextEl(o.id, o);
            }
        });
        this.updateAll();
    }

    _ensureTextEl(objectId, objectData) {
        if (!this.layer || !objectId) return;
        if (this.idToEl.has(objectId)) return;
        
        console.log(`🔍 HtmlTextLayer: создаю HTML-элемент для текста ${objectId}:`, objectData);
        
        const el = document.createElement('div');
        el.className = 'mb-text';
        el.dataset.id = objectId;
        // Получаем свойства из properties объекта
        const fontFamily = objectData.properties?.fontFamily || objectData.fontFamily || 'Roboto, Arial, sans-serif';
        const color = objectData.color || objectData.properties?.color || '#000000';
        const backgroundColor = objectData.backgroundColor || objectData.properties?.backgroundColor || 'transparent';
        
        // Базовый line-height исходя из стартового размера шрифта
        const baseFs = objectData.fontSize || objectData.properties?.fontSize || 16;
        const baseLineHeight = (() => {
            const fs = baseFs;
            if (fs <= 12) return Math.round(fs * 1.40);
            if (fs <= 18) return Math.round(fs * 1.34);
            if (fs <= 36) return Math.round(fs * 1.26);
            if (fs <= 48) return Math.round(fs * 1.24);
            if (fs <= 72) return Math.round(fs * 1.22);
            if (fs <= 96) return Math.round(fs * 1.20);
            return Math.round(fs * 1.18);
        })();

        el.classList.add('mb-text');
        el.style.color = color;
        el.style.fontFamily = fontFamily;
        el.style.backgroundColor = backgroundColor === 'transparent' ? '' : backgroundColor;
        el.style.lineHeight = `${baseLineHeight}px`;
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
        
        console.log(`🔍 HtmlTextLayer: HTML-элемент создан и добавлен в DOM:`, el);
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
        
        console.log(`🔍 HtmlTextLayer: обновляю позицию для текста ${objectId}`);
        
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
        const baseFS = parseFloat(el.dataset.baseFontSize || `${obj.properties?.fontSize || obj.fontSize || 16}`) || 16;
        const baseW = parseFloat(el.dataset.baseW || '160') || 160;
        const baseH = parseFloat(el.dataset.baseH || '36') || 36;
        const scaleX = w && baseW ? (w / baseW) : 1;
        const scaleY = h && baseH ? (h / baseH) : 1;
        // Для текстовых объектов не масштабируем шрифт от изменения размеров блока,
        // чтобы сохранять вид как при редактировании (как в Miro)
        const sObj = (obj?.type === 'text' || obj?.type === 'simple-text')
            ? 1
            : Math.min(scaleX, scaleY);
        const sCss = s / res;
        const fontSizePx = Math.max(1, baseFS * sObj * sCss);
        el.style.fontSize = `${fontSizePx}px`;
        // Адаптивный межстрочный интервал по размеру шрифта
        const computeLineHeightPx = (fs) => {
            if (fs <= 12) return Math.round(fs * 1.40);
            if (fs <= 18) return Math.round(fs * 1.34);
            if (fs <= 36) return Math.round(fs * 1.26);
            if (fs <= 48) return Math.round(fs * 1.24);
            if (fs <= 72) return Math.round(fs * 1.22);
            if (fs <= 96) return Math.round(fs * 1.20);
            return Math.round(fs * 1.18);
        };
        // Применяем новый line-height только если он отличается от текущего, чтобы избежать конфликтов CSS
        const newLH = `${computeLineHeightPx(fontSizePx)}px`;
        if (el.style.lineHeight !== newLH) {
            el.style.lineHeight = newLH;
        }

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
        if (typeof content === 'string') {
            el.textContent = content;
            console.log(`🔍 HtmlTextLayer: содержимое обновлено в updateOne для ${objectId}:`, content);
        }

        // Гарантируем, что высота соответствует контенту (особенно после смены font-size)
        try {
            el.style.height = 'auto';
            const h = Math.max(1, Math.round(el.scrollHeight));
            el.style.height = `${h}px`;
        } catch (_) {}
        
        console.log(`🔍 HtmlTextLayer: позиция обновлена для ${objectId}:`, {
            left: `${left}px`,
            top: `${top}px`,
            width: `${Math.max(1, (w * s) / res)}px`,
            height: `${Math.max(1, (h * s) / res)}px`,
            fontSize: `${fontSizePx}px`,
            content: content,
            visibility: el.style.visibility,
            textContent: el.textContent
        });
    }

    _autoFitTextHeight(objectId) {
        const el = this.idToEl.get(objectId);
        if (!el || !this.core) return;
        try {
            // Измеряем фактическую высоту HTML-текста
            el.style.height = 'auto';
            const measured = Math.max(1, Math.round(el.scrollHeight));
            el.style.height = `${measured}px`;
            // Пересчитываем мировую высоту и отправляем обновление размера через события ResizeUpdate
            const world = this.core.pixi.worldLayer || this.core.pixi.app.stage;
            const s = world?.scale?.x || 1;
            const res = (this.core?.pixi?.app?.renderer?.resolution) || 1;
            const worldH = (measured * res) / s;
            // Узнаём текущую ширину в мире
            const obj = (this.core.state.state.objects || []).find(o => o.id === objectId);
            const worldW = obj?.width || 0;
            const position = obj?.position || null;
            if (worldW > 0 && position) {
                this.core.eventBus.emit(Events.Tool.ResizeUpdate, {
                    object: objectId,
                    size: { width: worldW, height: worldH },
                    position
                });
            }
        } catch (_) {}
    }
}


