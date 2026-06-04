import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { Events } from '../core/events/Events.js';
import * as PIXI from 'pixi.js';
import { renderRichText, hasMath } from '../utils/richText.js';
import { renderTextList } from './text-properties/TextListRenderer.js';

gsap.registerPlugin(CustomEase);
const TEXT_HOVER_EASE = 'hoverLiftSpring';
CustomEase.create(TEXT_HOVER_EASE, 'M0,0 C0.215,0.61 0.355,1 0.71,1.56 0.89,1.72 1,1 1,1');

const TEXT_HOVER_TY  = -2;   // screen-px вверх
const TEXT_HOVER_SC  = 1.06; // масштаб «маленький» пресет
const TEXT_HOVER_DUR = 0.22;
const TEXT_BACK_DUR  = 0.18;

const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Сильные сигналы markdown-разметки: заголовки, блоки/инлайн-код, цитаты,
// списки (маркированные и нумерованные), таблицы, ссылки, жирный/курсив.
// Намеренно консервативно, чтобы обычный однострочный текст не считался markdown.
function looksLikeMarkdown(text) {
    if (!text || typeof text !== 'string') return false;
    return (
        /^#{1,6}\s+/m.test(text) ||
        /```/.test(text) ||
        /`[^`]+`/.test(text) ||
        /^>\s+/m.test(text) ||
        /^\s*[-*+]\s+/m.test(text) ||
        /^\s*\d+\.\s+/m.test(text) ||
        /^\s*\|.*\|.*$/m.test(text) ||
        /\[[^\]]+\]\([^)]+\)/.test(text) ||
        /(\*\*|__)[^*_\s][^*_]*(\*\*|__)/.test(text)
    );
}

// Итоговое решение: явный флаг (true/false) перебивает авто-детект, иначе —
// по содержимому. Формулы KaTeX тоже включают богатый рендер: текст с одной
// формулой без markdown-разметки должен рендериться через renderRichText.
function resolveMarkdown(properties, content) {
    if (properties?.markdown === true) return true;
    if (properties?.markdown === false) return false;
    return looksLikeMarkdown(content) || hasMath(content);
}

/**
 * Возвращает коэффициент межстрочного интервала по базовому (немасштабированному) размеру шрифта.
 * Коэффициент зависит от базового размера, а не от отрисованного, — это гарантирует,
 * что соотношение line-height/font-size остаётся постоянным при любом зуме.
 * @param {number} baseFontSizePx — базовый размер шрифта без учёта зума
 * @param {object|undefined} properties
 * @returns {number} коэффициент (не пиксели)
 */
function resolveLineHeightRatio(baseFontSizePx, properties) {
    if (typeof properties?.lineHeight === 'number') {
        return properties.lineHeight;
    }
    const fs = baseFontSizePx;
    if (fs <= 12) return 1.40;
    if (fs <= 18) return 1.34;
    if (fs <= 36) return 1.26;
    if (fs <= 48) return 1.24;
    if (fs <= 72) return 1.22;
    if (fs <= 96) return 1.20;
    return 1.18;
}

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

        // hover-lift state: objectId -> { ty: 0, sc: 1 }
        this._hoverStates = new Map();
        this._hoveredTextId = null;
        this._selectedIds = new Set();
        // objectId -> { rect, onOver, onOut } — слушатели PIXI pointer на хит-rect текста
        this._pixiHoverHandlers = new Map();
        this._transformActive = false;
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
            if (objectData.type === 'text' || objectData.type === 'simple-text' || objectData.type === 'shape') {
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

        // Прятать HTML-текст во время редактирования (textarea) — общий текст
        this.eventBus.on(Events.UI.TextEditStart, ({ objectId }) => {
            const el = this.idToEl.get(objectId);
            if (el) el.style.visibility = 'hidden';
        });
        this.eventBus.on(Events.UI.TextEditEnd, ({ objectId }) => {
            const el = this.idToEl.get(objectId);
            if (el) el.style.visibility = '';
        });

        // Независимое скрытие/показ для записок
        this.eventBus.on(Events.UI.NoteEditStart, ({ objectId }) => {
            const el = this.idToEl.get(objectId);
            if (el) el.style.visibility = 'hidden';
        });
        this.eventBus.on(Events.UI.NoteEditEnd, ({ objectId }) => {
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
                const _obj = this.core?.state?.state?.objects?.find(o => o.id === objectId);
                const isMarkdown = resolveMarkdown(_obj?.properties, content);
                this._syncElementContent(el, content, isMarkdown);
                if (el.classList.contains('mb-text--md') !== isMarkdown) {
                    el.classList.toggle('mb-text--md', isMarkdown);
                    el.style.whiteSpace = isMarkdown ? 'normal' : 'pre';
                    el.style.overflowWrap = isMarkdown ? 'break-word' : '';
                    if (!isMarkdown) el.style.padding = '0';
                }
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
                    const fs = updates.fontSize;
                    const curObj = (this.core?.state?.state?.objects || []).find(o => o.id === objectId);
                    el.style.lineHeight = `${resolveLineHeightRatio(fs, curObj?.properties)}`;
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
        this._onViewportChanged = () => this.updateAll();
        this.eventBus.on(Events.Viewport.Changed, this._onViewportChanged);
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

        // Hover-lift текста управляется PIXI pointerover/pointerout прямо на хит-rect
        // текста (см. _ensurePixiHover). Events.Object.Hover для текста ненадёжен:
        // он зависит от активного инструмента и hit-test пути и не доходит стабильно.

        // Блокировка hover во время drag/resize/rotate (как в HoverLiftController)
        this._onTransformStart = () => {
            this._transformActive = true;
            if (this._hoveredTextId) {
                const id = this._hoveredTextId;
                this._hoveredTextId = null;
                this._animTextHoverOut(id);
            }
        };
        this._onTransformEnd = () => { this._transformActive = false; };
        this.eventBus.on(Events.Tool.DragStart, this._onTransformStart);
        this.eventBus.on(Events.Tool.GroupDragStart, this._onTransformStart);
        this.eventBus.on(Events.Tool.DragEnd, this._onTransformEnd);
        this.eventBus.on(Events.Tool.GroupDragEnd, this._onTransformEnd);
        this.eventBus.on(Events.Tool.ResizeStart, this._onTransformStart);
        this.eventBus.on(Events.Tool.GroupResizeStart, this._onTransformStart);
        this.eventBus.on(Events.Tool.ResizeEnd, this._onTransformEnd);
        this.eventBus.on(Events.Tool.GroupResizeEnd, this._onTransformEnd);
        this.eventBus.on(Events.Tool.RotateStart, this._onTransformStart);
        this.eventBus.on(Events.Tool.GroupRotateStart, this._onTransformStart);
        this.eventBus.on(Events.Tool.RotateEnd, this._onTransformEnd);
        this.eventBus.on(Events.Tool.GroupRotateEnd, this._onTransformEnd);

        // Отслеживаем выделение, чтобы не показывать hover у выделенных объектов
        this._onSelectionAdd = (data) => {
            const id = data?.object ?? data?.objectId ?? data?.id ?? data;
            if (id) {
                this._selectedIds.add(String(id));
                if (this._hoveredTextId === String(id)) {
                    this._hoveredTextId = null;
                    this._animTextHoverOut(String(id));
                }
            }
        };
        this._onSelectionRemove = (data) => {
            const id = data?.object ?? data?.objectId ?? data?.id ?? data;
            if (id) this._selectedIds.delete(String(id));
        };
        this._onSelectionClear = () => { this._selectedIds.clear(); };
        this.eventBus.on(Events.Tool.SelectionAdd, this._onSelectionAdd);
        this.eventBus.on(Events.Tool.SelectionRemove, this._onSelectionRemove);
        this.eventBus.on(Events.Tool.SelectionClear, this._onSelectionClear);

        // Первичная отрисовка
        this.rebuildFromState();
        this.updateAll();

        // После загрузки веб-шрифтов переизмеряем все боксы: до swap шрифта scrollHeight
        // фиксируется по fallback-метрикам, после — по реальным глифам.
        if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
            document.fonts.ready.then(() => this.updateAll()).catch(() => {});
        }

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
        // Убиваем все hover-твины и отцепляем PIXI pointer-слушатели
        for (const state of this._hoverStates.values()) gsap.killTweensOf(state);
        this._hoverStates.clear();
        for (const id of [...this._pixiHoverHandlers.keys()]) this._detachPixiHover(id);
        this._hoveredTextId = null;
        // Отписываемся от событий
        if (this.eventBus) {
            if (this._onViewportChanged) {
                this.eventBus.off(Events.Viewport.Changed, this._onViewportChanged);
                this._onViewportChanged = null;
            }
            if (this._onTransformStart) {
                this.eventBus.off(Events.Tool.DragStart, this._onTransformStart);
                this.eventBus.off(Events.Tool.GroupDragStart, this._onTransformStart);
                this.eventBus.off(Events.Tool.ResizeStart, this._onTransformStart);
                this.eventBus.off(Events.Tool.GroupResizeStart, this._onTransformStart);
                this.eventBus.off(Events.Tool.RotateStart, this._onTransformStart);
                this.eventBus.off(Events.Tool.GroupRotateStart, this._onTransformStart);
            }
            if (this._onTransformEnd) {
                this.eventBus.off(Events.Tool.DragEnd, this._onTransformEnd);
                this.eventBus.off(Events.Tool.GroupDragEnd, this._onTransformEnd);
                this.eventBus.off(Events.Tool.ResizeEnd, this._onTransformEnd);
                this.eventBus.off(Events.Tool.GroupResizeEnd, this._onTransformEnd);
                this.eventBus.off(Events.Tool.RotateEnd, this._onTransformEnd);
                this.eventBus.off(Events.Tool.GroupRotateEnd, this._onTransformEnd);
            }
            if (this._onSelectionAdd) this.eventBus.off(Events.Tool.SelectionAdd, this._onSelectionAdd);
            if (this._onSelectionRemove) this.eventBus.off(Events.Tool.SelectionRemove, this._onSelectionRemove);
            if (this._onSelectionClear) this.eventBus.off(Events.Tool.SelectionClear, this._onSelectionClear);
        }
    }

    rebuildFromState() {
        if (!this.core?.state) return;
        const objs = this.core.state.state.objects || [];
        console.log(`🔍 HtmlTextLayer: rebuildFromState, найдено объектов:`, objs.length);
        
        objs.forEach((o) => {
            if (o.type === 'text' || o.type === 'simple-text' || o.type === 'shape') {
                console.log(`🔍 HtmlTextLayer: создаю HTML-элемент для текстового объекта:`, o);
                this._ensureTextEl(o.id, o);
            }
        });
        this.updateAll();
    }

    _ensureTextEl(objectId, objectData) {
        if (!this.layer || !objectId) return;
        if (this.idToEl.has(objectId)) return;

        // Shape: flex-оверлей по центру bounds фигуры; pointer-events: none — клики проходят к PIXI
        if (objectData.type === 'shape') {
            const el = document.createElement('div');
            el.className = 'mb-text mb-shape-text';
            el.dataset.id = objectId;
            const textProps = objectData.properties?.text || {};
            const shapeFontSize = textProps.fontSize || 16;
            el.style.fontFamily = textProps.fontFamily || 'Inter, sans-serif';
            el.style.fontSize = `${shapeFontSize}px`;
            el.style.color = textProps.color || '#111111';
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.justifyContent = 'center';
            el.style.textAlign = 'center';
            el.style.overflow = 'hidden';
            el.style.pointerEvents = 'none';
            el.style.whiteSpace = 'pre-wrap';
            el.style.wordBreak = 'break-word';
            el.style.lineHeight = '1.4';
            el.dataset.baseFontSize = String(shapeFontSize);
            const content = objectData.properties?.content || '';
            el.textContent = content;
            this.layer.appendChild(el);
            this.idToEl.set(objectId, el);
            this._hoverStates.set(objectId, { ty: 0, sc: 1 });
            return;
        }
        
        console.log(`🔍 HtmlTextLayer: создаю HTML-элемент для текста ${objectId}:`, objectData);
        
        const el = document.createElement('div');
        el.className = 'mb-text';
        el.dataset.id = objectId;
        // Получаем свойства из properties объекта
        const props = objectData.properties || {};
        const fontFamily = props.fontFamily || objectData.fontFamily || 'Caveat, Arial, cursive';
        const color = objectData.color || props.color || props.textColor || '#000000';
        const backgroundColor = objectData.backgroundColor || props.backgroundColor || 'transparent';

        // Безразмерный множитель line-height: браузер сам считает интервал относительно
        // font-size, поэтому соотношение строк не зависит от зума и не страдает от округления.
        const baseFs = objectData.fontSize || props.fontSize || 32;
        const baseLineHeight = resolveLineHeightRatio(baseFs, props);

        const content = objectData.content || objectData.properties?.content || '';
        const isMarkdown = resolveMarkdown(objectData.properties, content);
        if (isMarkdown) el.classList.add('mb-text--md');
        el.style.color = color;
        el.style.fontFamily = fontFamily;
        el.style.backgroundColor = backgroundColor === 'transparent' ? '' : backgroundColor;
        el.style.lineHeight = `${baseLineHeight}`;
        el.style.whiteSpace = isMarkdown ? 'normal' : 'pre';
        el.style.overflow = 'visible';
        if (isMarkdown) el.style.overflowWrap = 'break-word';
        el.style.letterSpacing = '0px';
        el.style.fontKerning = 'normal';
        el.style.textRendering = 'optimizeLegibility';
        if (!isMarkdown) el.style.padding = '0';
        // Начертания и выравнивание из properties
        el.style.fontWeight = props.bold ? 'bold' : '';
        el.style.fontStyle = props.italic ? 'italic' : '';
        const initDec = [props.underline && 'underline', props.strikethrough && 'line-through'].filter(Boolean).join(' ');
        el.style.textDecoration = initDec || '';
        el.style.textAlign = props.textAlign || '';
        this._syncElementContent(el, content, isMarkdown);
        // Базовые размеры сохраняем в dataset
        const fs = objectData.fontSize || objectData.properties?.fontSize || 32;
        const bw = Math.max(1, objectData.width || objectData.properties?.baseW || 160);
        const bh = Math.max(1, objectData.height || objectData.properties?.baseH || 36);
        el.dataset.baseFontSize = String(fs);
        el.dataset.baseW = String(bw);
        el.dataset.baseH = String(bh);
        this.layer.appendChild(el);
        this.idToEl.set(objectId, el);
        
        // Инициализируем hover-состояние
        this._hoverStates.set(objectId, { ty: 0, sc: 1 });
        
        console.log(`🔍 HtmlTextLayer: HTML-элемент создан и добавлен в DOM:`, el);
    }

    _removeTextEl(objectId) {
        const el = this.idToEl.get(objectId);
        if (el) el.remove();
        this.idToEl.delete(objectId);
        // Убиваем возможный активный твин и чистим состояние
        const state = this._hoverStates.get(objectId);
        if (state) gsap.killTweensOf(state);
        this._hoverStates.delete(objectId);
        this._detachPixiHover(objectId);
        if (this._hoveredTextId === objectId) this._hoveredTextId = null;
    }

    updateAll() {
        if (!this.core?.pixi) return;
        for (const id of this.idToEl.keys()) this.updateOne(id);
    }

    updateOne(objectId) {
        const el = this.idToEl.get(objectId);
        if (!el || !this.core) return;

        // obj нужен раньше, чтобы охранять hover-lift и shape-специфичные пути
        const obj = (this.core.state.state.objects || []).find(o => o.id === objectId);
        if (!obj) return;

        // Hover-lift только для text/simple-text (shape использует собственный PIXI-hover)
        if (obj.type !== 'shape') {
            this._ensurePixiHover(objectId);
        }

        console.log(`🔍 HtmlTextLayer: обновляю позицию для текста ${objectId}`);

        const world = this.core.pixi.worldLayer || this.core.pixi.app.stage;
        const s = world?.scale?.x || 1;
        const tx = world?.x || 0;
        const ty = world?.y || 0;
        const res = (this.core?.pixi?.app?.renderer?.resolution) || 1;
        const x = obj.position?.x || 0;
        const y = obj.position?.y || 0;
        const w = obj.width || 0;
        const h = obj.height || 0;
        // Угол: во время поворота state ещё не обновлён, поэтому берем актуальный из PIXI
        const pixiObj = this.core?.pixi?.objects?.get ? this.core.pixi.objects.get(objectId) : null;
        const angle = (pixiObj && typeof pixiObj.rotation === 'number')
            ? (pixiObj.rotation * 180 / Math.PI)
            : (obj.rotation || obj.transform?.rotation || 0);

        // Чёткая отрисовка: меняем реальный font-size, учитывая зум и изменение размеров
        const baseFS = parseFloat(el.dataset.baseFontSize || `${obj.properties?.fontSize || obj.fontSize || 32}`) || 32;
        const baseW = parseFloat(el.dataset.baseW || '160') || 160;
        const baseH = parseFloat(el.dataset.baseH || '36') || 36;
        const scaleX = w && baseW ? (w / baseW) : 1;
        const scaleY = h && baseH ? (h / baseH) : 1;
        // Для text/note/shape не масштабируем шрифт от размера блока — только зум
        const sObj = (obj?.type === 'text' || obj?.type === 'simple-text' || obj?.type === 'note' || obj?.type === 'shape')
            ? 1
            : Math.min(scaleX, scaleY);
        const sCss = s / res;
        const fontSizePx = Math.max(1, baseFS * sObj * sCss);
        el.style.fontSize = `${fontSizePx}px`;
        // Безразмерный множитель: интервал между строками масштабируется браузером
        // пропорционально font-size, поэтому не зависит от зума и не страдает от округления.
        const newLH = `${resolveLineHeightRatio(baseFS, obj.properties)}`;
        if (el.style.lineHeight !== newLH) {
            el.style.lineHeight = newLH;
        }

        // Позиция и габариты в CSS координатах - используем тот же подход что в HtmlHandlesLayer
        const worldLayer = this.core.pixi.worldLayer || this.core.pixi.app.stage;
        const view = this.core.pixi.app.view;
        // Эти переменные нужны и для лога ниже, поэтому задаём их тут
        let logLeft = 0;
        let logTop = 0;
        let logWidth = 0;
        let logHeight = 0;

        if (worldLayer && view && view.parentElement) {
            const containerRect = view.parentElement.getBoundingClientRect();
            const viewRect = view.getBoundingClientRect();
            const offsetLeft = viewRect.left - containerRect.left;
            const offsetTop = viewRect.top - containerRect.top;
            
            // Преобразуем мировые координаты в экранные через toGlobal
            const tl = worldLayer.toGlobal(new PIXI.Point(x, y));
            const br = worldLayer.toGlobal(new PIXI.Point(x + w, y + h));

            // ВАЖНО: toGlobal() уже возвращает координаты в логических экранных пикселях
            // (как и для HtmlHandlesLayer), поэтому делить их на renderer.resolution
            // при вычислении CSS-позиции и размеров не нужно. Деление приводило к тому,
            // что при res < 1 (масштаб браузера ≠ 100%) HTML-текст уезжал относительно
            // собственных рамок и PIXI-объекта.
            const left = offsetLeft + tl.x;
            const top = offsetTop + tl.y;
            const width = Math.max(1, (br.x - tl.x));
            const height = Math.max(1, (br.y - tl.y));

            // Применяем к элементу
            el.style.left = `${left}px`;
            el.style.top = `${top}px`;
            if (w && h) {
                el.style.width = `${width}px`;
                el.style.height = `${height}px`;
            }

            // Значения для лога
            logLeft = left;
            logTop = top;
            logWidth = width;
            logHeight = height;
        } else {
            // Fallback к старому методу
            const left = (tx + s * x) / res;
            const top = (ty + s * y) / res;
            el.style.left = `${left}px`;
            el.style.top = `${top}px`;
            if (w && h) {
                const cssW = Math.max(1, (w * s) / res);
                const cssH = Math.max(1, (h * s) / res);
                el.style.width = `${cssW}px`;
                el.style.height = `${cssH}px`;
                logWidth = cssW;
                logHeight = cssH;
            }
            logLeft = left;
            logTop = top;
        }
        // Поворот вокруг центра (как у PIXI и HTML-ручек); hover-lift добавляется сверху
        const hover = this._hoverStates.get(objectId);
        const hoverTy = hover?.ty ?? 0;
        const hoverSc = hover?.sc ?? 1;
        const hoverPart = (Math.abs(hoverTy) > 0.001 || Math.abs(hoverSc - 1) > 0.001)
            ? `translate3d(0, ${hoverTy}px, 0) scale(${hoverSc})`
            : '';
        const rotatePart = angle ? `rotate(${angle}deg)` : '';
        el.style.transformOrigin = 'center center';
        el.style.transform = [hoverPart, rotatePart].filter(Boolean).join(' ');
        // Shape: обновляем шрифт/цвет из properties.text и baseFontSize, остальное — без изменений
        if (obj.type === 'shape') {
            const textProps = obj.properties?.text || {};
            const newShapeFS = textProps.fontSize || 16;
            if (el.dataset.baseFontSize !== String(newShapeFS)) {
                el.dataset.baseFontSize = String(newShapeFS);
            }
            el.style.fontFamily = textProps.fontFamily || 'Inter, sans-serif';
            el.style.color = textProps.color || '#111111';
            el.style.fontWeight = textProps.bold ? 'bold' : '';
            el.style.fontStyle = textProps.italic ? 'italic' : '';
            const shapeContent = obj.properties?.content || '';
            if (el.textContent !== shapeContent) el.textContent = shapeContent;
            return;
        }

        // Начертания и выравнивание из properties
        const props = obj.properties || {};
        el.style.fontWeight = props.bold ? 'bold' : '';
        el.style.fontStyle = props.italic ? 'italic' : '';
        const textDec = [props.underline && 'underline', props.strikethrough && 'line-through'].filter(Boolean).join(' ');
        el.style.textDecoration = textDec || '';
        el.style.textAlign = props.textAlign || '';

        // Текст: список или plain/markdown
        const content = obj.content || obj.properties?.content;
        const listType = props.listType;
        const useList = listType && listType !== 'none';
        const isMarkdown = !useList && resolveMarkdown(obj.properties, content);
        if (typeof content === 'string') {
            if (useList) {
                el.dataset.renderedContent = '';
                el.dataset.renderedMd = '';
                const listChecked = props.listChecked || [];
                const listKey = `${listType}:${content}:${JSON.stringify(listChecked)}`;
                if (el.dataset.renderedList !== listKey) {
                    const onToggle = (lineIndex) => {
                        const cur = (this.core?.state?.state?.objects || []).find(o => o.id === objectId);
                        const curChecked = cur?.properties?.listChecked || [];
                        const next = [...curChecked];
                        next[lineIndex] = !next[lineIndex];
                        this.eventBus.emit(Events.Object.StateChanged, {
                            objectId, updates: { properties: { listChecked: next } }
                        });
                    };
                    renderTextList(el, content, listType, listChecked, onToggle);
                    el.dataset.renderedList = listKey;
                }
                el.classList.remove('mb-text--md');
                el.style.whiteSpace = 'normal';
                el.style.overflowWrap = 'break-word';
                el.style.padding = '';
            } else {
                el.dataset.renderedList = '';
                const contentChanged = this._syncElementContent(el, content, isMarkdown);
                if (contentChanged) {
                    console.log(`🔍 HtmlTextLayer: содержимое обновлено в updateOne для ${objectId}:`, content);
                }
                const hasMdClass = el.classList.contains('mb-text--md');
                if (hasMdClass !== isMarkdown) {
                    el.classList.toggle('mb-text--md', isMarkdown);
                    el.style.whiteSpace = isMarkdown ? 'normal' : 'pre';
                    el.style.overflowWrap = isMarkdown ? 'break-word' : '';
                    if (!isMarkdown) el.style.padding = '0';
                }
            }
        }

        // Гарантируем, что рамка не прилипает к тексту справа: ширина блока всегда
        // не меньше реальной ширины текста + правый отступ. Слой ручек строит рамку
        // по getBoundingClientRect этого .mb-text, поэтому запас распространяется и на неё.
        // Для markdown-элементов блок не применяется: перенос слов управляется CSS,
        // и width:auto сломал бы wrapping.
        try {
            const hasContent = !!(el.textContent && el.textContent.trim());
            if (hasContent && !angle && !isMarkdown && !useList && !(props.textAlign && props.textAlign !== 'left')) {
                const rightMargin = Math.ceil(fontSizePx * 0.7) + 6;
                const prevWidth = el.style.width;
                el.style.width = 'auto';
                const contentW = Math.ceil(el.scrollWidth);
                const stateWcss = parseFloat(prevWidth) || logWidth || 0;
                const finalW = Math.max(stateWcss, contentW + rightMargin);
                el.style.width = `${finalW}px`;
                logWidth = finalW;
            }
        } catch (_) {}

        // Гарантируем, что высота соответствует контенту (особенно после смены font-size)
        try {
            el.style.height = 'auto';
            // Добавим небольшой нижний отступ для хвостов букв, чтобы не отсекались (например, у «з»)
            const hCss = Math.max(1, Math.round(el.scrollHeight + 2));
            el.style.height = `${hCss}px`;
            // Обновим высоту для лога, если её ещё не устанавливали
            if (!logHeight) {
                logHeight = hCss;
            }
        } catch (_) {}
        
        console.log(`🔍 HtmlTextLayer: позиция обновлена для ${objectId}:`, {
            left: `${logLeft}px`,
            top: `${logTop}px`,
            width: `${logWidth}px`,
            height: `${logHeight}px`,
            fontSize: `${fontSizePx}px`,
            content: content,
            visibility: el.style.visibility,
            textContent: el.textContent
        });
    }

    /** Обновляет innerHTML/textContent только при реальной смене content или флага markdown */
    _syncElementContent(el, content, isMarkdown) {
        if (typeof content !== 'string') return false;
        const mdFlag = isMarkdown ? '1' : '0';
        if (el.dataset.renderedContent === content && el.dataset.renderedMd === mdFlag) return false;
        if (isMarkdown) {
            el.innerHTML = renderRichText(content);
        } else {
            el.textContent = content;
        }
        el.dataset.renderedContent = content;
        el.dataset.renderedMd = mdFlag;
        return true;
    }

    /** Только hover-transform + поворот, без пересчёта позиции/размеров/контента */
    _applyHoverTransform(objectId) {
        const el = this.idToEl.get(objectId);
        if (!el || !this.core) return;
        const obj = (this.core.state.state.objects || []).find(o => o.id === objectId);
        if (!obj) return;
        const pixiObj = this.core?.pixi?.objects?.get ? this.core.pixi.objects.get(objectId) : null;
        const angle = (pixiObj && typeof pixiObj.rotation === 'number')
            ? (pixiObj.rotation * 180 / Math.PI)
            : (obj.rotation || obj.transform?.rotation || 0);
        const hover = this._hoverStates.get(objectId);
        const hoverTy = hover?.ty ?? 0;
        const hoverSc = hover?.sc ?? 1;
        const hoverPart = (Math.abs(hoverTy) > 0.001 || Math.abs(hoverSc - 1) > 0.001)
            ? `translate3d(0, ${hoverTy}px, 0) scale(${hoverSc})`
            : '';
        const rotatePart = angle ? `rotate(${angle}deg)` : '';
        el.style.transformOrigin = 'center center';
        el.style.transform = [hoverPart, rotatePart].filter(Boolean).join(' ');
    }

    /** Лениво вешает pointerover/pointerout на PIXI хит-rect текста */
    _ensurePixiHover(objectId) {
        if (this._pixiHoverHandlers.has(objectId)) return;
        const rect = this.core?.pixi?.objects?.get ? this.core.pixi.objects.get(objectId) : null;
        if (!rect || typeof rect.on !== 'function') return;

        const onOver = () => this._onTextPointerOver(objectId);
        const onOut = () => this._onTextPointerOut(objectId);
        rect.on('pointerover', onOver);
        rect.on('pointerout', onOut);
        this._pixiHoverHandlers.set(objectId, { rect, onOver, onOut });
    }

    _detachPixiHover(objectId) {
        const h = this._pixiHoverHandlers.get(objectId);
        if (!h) return;
        try {
            h.rect.off('pointerover', h.onOver);
            h.rect.off('pointerout', h.onOut);
        } catch (_) {}
        this._pixiHoverHandlers.delete(objectId);
    }

    _onTextPointerOver(objectId) {
        if (prefersReducedMotion) return;
        if (this._transformActive) return;
        if (this._selectedIds.has(objectId) || this._selectedIds.has(String(objectId))) return;
        if (this._hoveredTextId === objectId) return;
        this._hoveredTextId = objectId;
        this._animTextHoverIn(objectId);
    }

    _onTextPointerOut(objectId) {
        if (this._hoveredTextId === objectId) this._hoveredTextId = null;
        this._animTextHoverOut(objectId);
    }

    _animTextHoverIn(objectId) {
        if (prefersReducedMotion) return;
        const state = this._hoverStates.get(objectId);
        if (!state) return;
        gsap.killTweensOf(state);
        gsap.to(state, {
            ty: TEXT_HOVER_TY,
            sc: TEXT_HOVER_SC,
            duration: TEXT_HOVER_DUR,
            ease: TEXT_HOVER_EASE,
            onUpdate: () => this._applyHoverTransform(objectId),
            onComplete: () => this._applyHoverTransform(objectId),
        });
    }

    _animTextHoverOut(objectId) {
        if (prefersReducedMotion) return;
        const state = this._hoverStates.get(objectId);
        if (!state) return;
        gsap.killTweensOf(state);
        gsap.to(state, {
            ty: 0,
            sc: 1,
            duration: TEXT_BACK_DUR,
            ease: 'power2.out',
            onUpdate: () => this._applyHoverTransform(objectId),
            onComplete: () => this._applyHoverTransform(objectId),
        });
    }

    _autoFitTextHeight(objectId) {
        const el = this.idToEl.get(objectId);
        if (!el || !this.core) return;
        try {
            // Фигуры имеют фиксированные пользовательские bounds: текст центрируется внутри,
            // а форма (квадрат остаётся квадратом) не подгоняется под высоту текста.
            const obj = (this.core.state.state.objects || []).find(o => o.id === objectId);
            if (obj?.type === 'shape') return;
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


