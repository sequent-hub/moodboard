import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { Events } from '../core/events/Events.js';
import * as PIXI from 'pixi.js';
import { renderRichText, hasMath } from '../utils/richText.js';
import { renderTextList } from './text-properties/TextListRenderer.js';
import { getShapeTextSafeArea, getShapeTextClipPath } from '../objects/shape/shapeTextArea.js';
import {
    applyTextStyles,
    resolveLineHeightRatio,
    computeTextRightPadPx,
    resolveStaticTextPadding,
    computeSingleLineCenterDelta,
    clearSingleLineCenterDeltaCache,
    TEXT_BOX_BOTTOM_PAD_PX,
} from '../services/text/TextBoxMetrics.js';

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
 * Строит безопасный HTML-фрагмент с кликабельными ссылками по массиву диапазонов.
 * Символы вне ссылок экранируются через textContent. Диапазоны не должны пересекаться.
 * @param {string} content
 * @param {Array<{start:number, end:number, url:string}>} links
 * @returns {string} готовый innerHTML
 */
function _buildHtmlWithLinks(content, links) {
    if (!links || links.length === 0) return _escapeHtml(content);

    const sorted = [...links]
        .filter(l => typeof l.start === 'number' && typeof l.end === 'number' && l.end > l.start && l.url)
        .sort((a, b) => a.start - b.start);

    let result = '';
    let pos = 0;
    for (const link of sorted) {
        const s = Math.max(0, link.start);
        const e = Math.min(content.length, link.end);
        if (s < pos) continue; // пропускаем пересечения
        if (s > pos) result += _escapeHtml(content.slice(pos, s));
        const linkText = _escapeHtml(content.slice(s, e));
        const href = _escapeAttr(link.url);
        result += `<a href="${href}" target="_blank" rel="noopener noreferrer" class="mb-text-link">${linkText}</a>`;
        pos = e;
    }
    if (pos < content.length) result += _escapeHtml(content.slice(pos));
    return result;
}

/**
 * Строит HTML-фрагмент с диапазонами подсветки и/или ссылок.
 * Пересечение highlight + link обрабатывается через набор граничных точек:
 * внутри перекрытия порядок вложения — <a><mark>текст</mark></a>.
 * @param {string} content
 * @param {Array<{start:number, end:number, url:string}>|null} links
 * @param {Array<{start:number, end:number, color:string}>|null} highlights
 * @returns {string} готовый innerHTML
 */
// Inline-начертания хранятся как диапазоны {start,end,type} в properties.formats
// (по аналогии с highlights/links) и рендерятся тегами БЕЗ вставки markdown-символов
// в текст — поэтому в редакторе и статике не видно `*`, `**`, `~~`.
const FORMAT_TAGS = {
    bold: ['<strong>', '</strong>'],
    italic: ['<em>', '</em>'],
    underline: ['<u>', '</u>'],
    strikethrough: ['<s>', '</s>'],
};
const FORMAT_TYPES = Object.keys(FORMAT_TAGS);

export function buildHtmlWithRanges(content, links, highlights, formats) {
    const validLinks = (links || [])
        .filter(l => typeof l.start === 'number' && typeof l.end === 'number' && l.end > l.start && l.url);
    const validHighlights = (highlights || [])
        .filter(h => typeof h.start === 'number' && typeof h.end === 'number' && h.end > h.start && h.color);
    const validFormats = (formats || [])
        .filter(f => typeof f.start === 'number' && typeof f.end === 'number' && f.end > f.start && FORMAT_TAGS[f.type]);

    if (validLinks.length === 0 && validHighlights.length === 0 && validFormats.length === 0) {
        return _escapeHtml(content);
    }
    if (validHighlights.length === 0 && validFormats.length === 0) {
        return _buildHtmlWithLinks(content, validLinks);
    }

    // Строим набор граничных точек всех диапазонов, делим текст на сегменты
    const boundaries = new Set([0, content.length]);
    const addBounds = (r) => {
        boundaries.add(Math.max(0, Math.min(content.length, r.start)));
        boundaries.add(Math.max(0, Math.min(content.length, r.end)));
    };
    validLinks.forEach(addBounds);
    validHighlights.forEach(addBounds);
    validFormats.forEach(addBounds);

    const points = [...boundaries].sort((a, b) => a - b);

    let result = '';
    for (let i = 0; i < points.length - 1; i++) {
        const s = points[i];
        const e = points[i + 1];
        let text = _escapeHtml(content.slice(s, e));

        // Начертания — самый внутренний слой (внутри mark/link).
        for (const type of FORMAT_TYPES) {
            if (validFormats.some(f => f.type === type && f.start <= s && f.end >= e)) {
                const [open, close] = FORMAT_TAGS[type];
                text = `${open}${text}${close}`;
            }
        }

        const hi = validHighlights.find(h => h.start <= s && h.end >= e);
        const link = validLinks.find(l => l.start <= s && l.end >= e);

        if (hi) {
            text = `<mark style="background-color: ${_escapeAttr(hi.color)}">${text}</mark>`;
        }
        if (link) {
            text = `<a href="${_escapeAttr(link.url)}" target="_blank" rel="noopener noreferrer" class="mb-text-link">${text}</a>`;
        }
        result += text;
    }

    return result;
}

function _escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function _escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
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
                // Нормализуем высоту по реальному scrollHeight .mb-text,
                // чтобы начальная рамка совпадала с той, что получается после
                // любого изменения свойства (там тоже вызывается _autoFitTextHeight).
                this._autoFitTextHeight(objectId);
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
                const _links = !isMarkdown ? (_obj?.properties?.links || null) : null;
                const _highlights = !isMarkdown ? (_obj?.properties?.highlights || null) : null;
                const _formats = !isMarkdown ? (_obj?.properties?.formats || null) : null;
                this._syncElementContent(el, content, isMarkdown, _links, _highlights, _formats);
                if (el.classList.contains('mb-text--md') !== isMarkdown) {
                    el.classList.toggle('mb-text--md', isMarkdown);
                    el.style.whiteSpace = isMarkdown ? 'normal' : 'pre';
                    el.style.overflowWrap = isMarkdown ? 'break-word' : '';
                    if (!isMarkdown) el.style.padding = '0';
                }
                // После коммита текста высота .mb-text осталась от пустого редактора (схлопнута),
                // а ResizeUpdate при завершении редактирования отрабатывает раньше синхронизации
                // контента. Без пере-подгонки DOM-бокс не оборачивает глифы, и рамка выделения,
                // строящаяся по getBoundingClientRect этого блока, оказывается выше текста.
                this._autoFitTextHeight(objectId);
                this.updateOne(objectId);
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
                if (updates.highlightColor !== undefined) {
                    if (updates.highlightColor === 'transparent') {
                        el.style.removeProperty('--highlight-color');
                        // Не сбрасываем backgroundColor, так как он может быть установлен отдельно
                    } else {
                        el.style.setProperty('--highlight-color', updates.highlightColor);
                        // Для обычного текста без Quill мы можем просто установить backgroundColor
                        // если нет выделения
                        if (!el.querySelector('span[style*="background-color"]')) {
                            el.style.backgroundColor = updates.highlightColor;
                        }
                    }
                    console.log(`🔍 HtmlTextLayer: обновлен цвет фона текста для ${objectId}:`, updates.highlightColor);
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
            if (!id) return;
            const sid = String(id);
            this._selectedIds.add(sid);
            if (this._hoveredTextId === sid) this._hoveredTextId = null;
            // Рамку выделения слой ручек строит по getBoundingClientRect .mb-text,
            // который включает CSS-transform hover-lift (translateY/scale). Если выделение
            // происходит на приподнятом hover-тексте, рамка снимается со смещённого/
            // увеличенного бокса, а после анимированного отката hover текст возвращается —
            // рамка же остаётся смещённой (её никто не пересчитывает). Поэтому сбрасываем
            // hover МГНОВЕННО (без твина) и форсируем пересчёт рамки по осевшему боксу.
            const state = this._hoverStates.get(sid);
            if (state && (Math.abs(state.ty) > 0.001 || Math.abs(state.sc - 1) > 0.001)) {
                gsap.killTweensOf(state);
                state.ty = 0;
                state.sc = 1;
                this._applyHoverTransform(sid);
                this.eventBus.emit(Events.Object.TransformUpdated, { objectId: id });
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
        // и метрики глифов фиксируются по fallback-шрифту, после — по реальным глифам.
        // Кеш вертикального центрирования сбрасываем ПЕРЕД updateAll, иначе одиночная
        // строка остаётся смещённой вниз: дельта, посчитанная на fallback-шрифте,
        // залипает (ключ кеша не зависит от состояния загрузки шрифта).
        if (typeof document !== 'undefined' && document.fonts) {
            const refitAfterFonts = () => {
                clearSingleLineCenterDeltaCache();
                this.updateAll();
            };
            if (document.fonts.ready) {
                document.fonts.ready.then(refitAfterFonts).catch(() => {});
            }
            if (typeof document.fonts.addEventListener === 'function') {
                this._onFontsLoadingDone = refitAfterFonts;
                document.fonts.addEventListener('loadingdone', this._onFontsLoadingDone);
            }
        }

        // Хелпер: при каждом обновлении ручек — обновляем HTML блок
        const world = this.core?.pixi?.worldLayer || this.core?.pixi?.app?.stage;
        if (world) {
            world.on('child:updated', () => this.updateAll()); // на случай внешних обновлений
        }
    }

    destroy() {
        if (this._onFontsLoadingDone
            && typeof document !== 'undefined'
            && document.fonts
            && typeof document.fonts.removeEventListener === 'function') {
            document.fonts.removeEventListener('loadingdone', this._onFontsLoadingDone);
            this._onFontsLoadingDone = null;
        }
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

        const baseFs = objectData.fontSize || props.fontSize || 32;

        const content = objectData.content || objectData.properties?.content || '';
        const isMarkdown = resolveMarkdown(objectData.properties, content);
        if (isMarkdown) el.classList.add('mb-text--md');
        // Единый набор текстовых параметров (шрифт, line-height, начертание, выравнивание).
        // Тот же вызов используется в редакторе — гарантирует идентичный рендер в обоих режимах.
        applyTextStyles(el, {
            fontSizePx: baseFs,
            baseFontSizePx: baseFs,
            fontFamily,
            properties: props,
        });
        el.style.color = color;
        el.style.backgroundColor = backgroundColor === 'transparent' ? '' : backgroundColor;
        el.style.whiteSpace = isMarkdown ? 'normal' : 'pre';
        el.style.overflow = 'visible';
        if (isMarkdown) el.style.overflowWrap = 'break-word';
        el.style.padding = resolveStaticTextPadding({ useList: false });
        const initLinks = !isMarkdown ? (props.links || null) : null;
        const initHighlights = !isMarkdown ? (props.highlights || null) : null;
        const initFormats = !isMarkdown ? (props.formats || null) : null;
        this._syncElementContent(el, content, isMarkdown, initLinks, initHighlights, initFormats);
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
        // Единый набор текстовых параметров через общий модуль — тот же вызов, что в редакторе.
        // Это гарантирует идентичный рендер глифов в статическом режиме и в режиме редактирования.
        if (obj.type !== 'shape') {
            const props = obj.properties || {};
            const fontFamily = props.fontFamily || obj.fontFamily || 'Caveat, Arial, cursive';
            applyTextStyles(el, {
                fontSizePx,
                baseFontSizePx: baseFS,
                fontFamily,
                properties: props,
            });
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
            // Округляем до целых px: inline-редактор позиционирует обёртку через Math.round
            // (TextEditorPositioningService), а статический слой раньше писал дробный top —
            // из-за этого глиф съезжал по вертикали на доли пикселя при выходе из редактора.
            // Целочисленный screen-space обязателен по pixel-perfect integer contract.
            const left = Math.round(offsetLeft + tl.x);
            const top = Math.round(offsetTop + tl.y);
            const width = Math.max(1, Math.round(br.x - tl.x));
            const height = Math.max(1, Math.round(br.y - tl.y));

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
            const left = Math.round((tx + s * x) / res);
            const top = Math.round((ty + s * y) / res);
            el.style.left = `${left}px`;
            el.style.top = `${top}px`;
            if (w && h) {
                const cssW = Math.max(1, Math.round((w * s) / res));
                const cssH = Math.max(1, Math.round((h * s) / res));
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
            // Реальный размер применяется здесь: при смене шрифта в панели фигуры updateOne
            // раньше обновлял только dataset, а style.fontSize оставался с момента создания.
            el.style.fontSize = `${newShapeFS}px`;
            el.style.fontFamily = textProps.fontFamily || 'Inter, sans-serif';
            el.style.color = textProps.color || '#111111';
            el.style.fontWeight = textProps.bold ? 'bold' : '';
            el.style.fontStyle = textProps.italic ? 'italic' : '';
            const shapeContent = obj.properties?.content || '';
            if (el.textContent !== shapeContent) el.textContent = shapeContent;
            // Text-safe area: оверлей занимает не весь bounds, а вписанный в контур
            // фигуры прямоугольник (overflow: hidden клипует по нему). Иначе текст
            // выходит за наклонные стороны треугольника/ромба/круга/стрелки.
            if (w > 0 && h > 0) {
                const kind = obj.properties?.kind || 'square';
                const safe = getShapeTextSafeArea(kind, w, h);
                const sx = logWidth / w;
                const sy = logHeight / h;
                const safeLeft = Math.round(logLeft + safe.left * sx);
                const safeTop = Math.round(logTop + safe.top * sy);
                const safeW = Math.max(1, Math.round(safe.width * sx));
                const safeH = Math.max(1, Math.round(safe.height * sy));
                el.style.left = `${safeLeft}px`;
                el.style.top = `${safeTop}px`;
                el.style.width = `${safeW}px`;
                el.style.height = `${safeH}px`;
                // Поворот должен идти вокруг центра фигуры, а не центра safe-area.
                const originX = (logLeft + logWidth / 2) - safeLeft;
                const originY = (logTop + logHeight / 2) - safeTop;
                el.style.transformOrigin = `${originX}px ${originY}px`;
                // Клип по контуру: текст, вышедший за наклонные стороны, прячется внутри.
                el.style.clipPath = getShapeTextClipPath(kind) || 'none';
            }
            // Вертикальное выравнивание: пока текст помещается — центр по середине
            // фигуры; при переполнении — прижимаем к низу safe-area, чтобы текст рос
            // вверх (низ зафиксирован, верхние строки уходят выше и обрезаются
            // overflow: hidden). Замер overflow делаем при flex-start — при
            // align-items:center контент вылезает вверх/вниз и scrollHeight врёт.
            el.style.alignItems = 'flex-start';
            const overflowsBox = el.scrollHeight > el.clientHeight + 1;
            el.style.alignItems = overflowsBox ? 'flex-end' : 'center';
            return;
        }

        // Текст: список или plain/markdown
        // (fontWeight/fontStyle/textDecoration/textAlign/lineHeight уже выставлены applyTextStyles выше)
        const props = obj.properties || {};
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
                el.style.padding = resolveStaticTextPadding({ useList: true });
            } else {
                el.dataset.renderedList = '';
                const plainLinks = !isMarkdown ? (props.links || null) : null;
                const plainHighlights = !isMarkdown ? (props.highlights || null) : null;
                const plainFormats = !isMarkdown ? (props.formats || null) : null;
                const contentChanged = this._syncElementContent(el, content, isMarkdown, plainLinks, plainHighlights, plainFormats);
                if (contentChanged) {
                    console.log(`🔍 HtmlTextLayer: содержимое обновлено в updateOne для ${objectId}:`, content);
                }
                const hasMdClass = el.classList.contains('mb-text--md');
                if (hasMdClass !== isMarkdown) {
                    el.classList.toggle('mb-text--md', isMarkdown);
                    el.style.whiteSpace = isMarkdown ? 'normal' : 'pre';
                    el.style.overflowWrap = isMarkdown ? 'break-word' : '';
                }
                // Паддинг задаём при каждом проходе, а не только при смене режима:
                // после режима списка inline padding сброшен на CSS 0.3em, и без
                // безусловного восстановления обычный текст сохраняет лишний отступ
                // сверху — статическая рамка уезжает выше глифов относительно поля ввода.
                el.style.padding = resolveStaticTextPadding({ useList: false });
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
                const rightMargin = computeTextRightPadPx(fontSizePx);
                const prevWidth = el.style.width;
                el.style.width = 'auto';
                const contentW = Math.ceil(el.scrollWidth);
                const stateWcss = parseFloat(prevWidth) || logWidth || 0;
                const finalW = Math.max(stateWcss, contentW + rightMargin);
                el.style.width = `${finalW}px`;
                logWidth = finalW;
            }
        } catch (_) {}

        // Высота текстового бокса всегда равна высоте контента: рамка облегает строки,
        // под текстом нет пустого зазора. Высоту объекта (logHeight = round(h*s)) здесь
        // НЕ учитываем — иначе единожды завышенный obj.height (дефолт при создании или
        // остаток от прежнего многострочного текста) залипал, и появлялся зазор после зума.
        try {
            el.style.height = 'auto';
            // Центрируем видимые буквы однострочного текста по вертикали (обычного и
            // однострочного markdown — инлайн-форматирование выделения через tpp-format-modal
            // переводит текст в markdown, но однострочный он должен центрироваться так же,
            // как plain): line-box резервирует сверху место под прописные/выносные, которого
            // строчный текст не занимает, поэтому буквы кажутся прижатыми к низу рамки.
            // computeSingleLineCenterDelta сам вернёт null для многострочного markdown и
            // окружения без layout (jsdom) → остаётся нижний отступ TEXT_BOX_BOTTOM_PAD_PX
            // под хвосты букв (например, «з», «у»). Списки не центрируем.
            const centerDelta = !useList
                ? computeSingleLineCenterDelta(el)
                : null;
            const extra = (centerDelta === null) ? TEXT_BOX_BOTTOM_PAD_PX : centerDelta;
            const hCss = Math.max(1, Math.round(el.scrollHeight + extra));
            el.style.height = `${hCss}px`;
            // Обновим высоту для лога
            logHeight = hCss;
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

    /** Обновляет innerHTML/textContent только при реальной смене content, флага markdown, ссылок или подсветки */
    _syncElementContent(el, content, isMarkdown, links, highlights, formats) {
        if (typeof content !== 'string') return false;
        const mdFlag = isMarkdown ? '1' : '0';
        const linksKey = (Array.isArray(links) && links.length > 0) ? JSON.stringify(links) : '';
        const highlightsKey = (Array.isArray(highlights) && highlights.length > 0) ? JSON.stringify(highlights) : '';
        const formatsKey = (Array.isArray(formats) && formats.length > 0) ? JSON.stringify(formats) : '';
        if (
            el.dataset.renderedContent === content &&
            el.dataset.renderedMd === mdFlag &&
            (el.dataset.renderedLinks || '') === linksKey &&
            (el.dataset.renderedHighlights || '') === highlightsKey &&
            (el.dataset.renderedFormats || '') === formatsKey
        ) return false;
        if (isMarkdown) {
            el.innerHTML = renderRichText(content);
        } else if (linksKey || highlightsKey || formatsKey) {
            el.innerHTML = buildHtmlWithRanges(content, links, highlights, formats);
        } else {
            el.textContent = content;
        }
        el.dataset.renderedContent = content;
        el.dataset.renderedMd = mdFlag;
        el.dataset.renderedLinks = linksKey;
        el.dataset.renderedHighlights = highlightsKey;
        el.dataset.renderedFormats = formatsKey;
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
            // Измеряем фактическую высоту HTML-текста ровно так же, как updateOne
            // (scrollHeight + extra): иначе _autoFitTextHeight фиксирует высоту без
            // центр-дельты, шлёт ResizeUpdate с завышенным боксом, рамка выделения
            // снимается по нему, а следующий updateOne досаживает финальную (меньшую)
            // высоту уже без обновления рамки — рамка остаётся выше текста.
            el.style.height = 'auto';
            const props = obj?.properties || {};
            const useList = !!(props.listType && props.listType !== 'none');
            const centerDelta = !useList
                ? computeSingleLineCenterDelta(el)
                : null;
            const extra = (centerDelta === null) ? TEXT_BOX_BOTTOM_PAD_PX : centerDelta;
            const measured = Math.max(1, Math.round(el.scrollHeight + extra));
            
            const world = this.core.pixi.worldLayer || this.core.pixi.app.stage;
            const s = world?.scale?.x || 1;
            // Мировой размер обязан быть resolution-независимым: позиции и ширина текста
            // конвертируются через toGlobal как CSS = world × scale, без множителя
            // renderer.resolution. Раньше высота писалась как measured × res / s, поэтому
            // при браузерном зуме/HiDPI (res ≠ 1) obj.height оказывался в res раз больше
            // ширины, и рамка выделения (строится по obj.height через toGlobal, без res)
            // получалась в res раз выше реального текста — буквы прижимались к верху рамки.
            const worldH_auto = measured / s;
            
            const currentWorldH = obj?.height || 0;
            // Высота объекта всегда подгоняется под контент (и вверх, и вниз): без сжатия
            // единожды завышенная высота залипала и давала пустой зазор под текстом.
            const finalWorldH = worldH_auto;
            const finalCssH = Math.round(finalWorldH * s);
            
            el.style.height = `${finalCssH}px`;
            
            const worldW = obj?.width || 0;
            const position = obj?.position || null;
            if (worldW > 0 && position && finalWorldH !== currentWorldH) {
                this.core.eventBus.emit(Events.Tool.ResizeUpdate, {
                    object: objectId,
                    size: { width: worldW, height: finalWorldH },
                    position
                });
            }
        } catch (_) {}
    }
}


