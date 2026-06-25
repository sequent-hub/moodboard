import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import * as PIXI from 'pixi.js';
import { DropShadowFilter } from '@pixi/filter-drop-shadow';
import { Events } from '../../core/events/Events.js';

gsap.registerPlugin(CustomEase);

/**
 * Фирменная упругая hover-анимация для PIXI-объектов.
 * Канон: cubic-bezier(0.34, 1.56, 0.64, 1), 0.22s.
 * Пресет «Большие» (≥120×80): translateY −4px/scale 1.02.
 * Пресет «Маленькие»: translateY −2px/scale 1.06.
 * Подъём задаётся в screen-space: world-offset = px / worldScale.
 */

const EASE_ID = 'hoverLiftSpring';
CustomEase.create(EASE_ID, 'M0,0 C0.215,0.61 0.355,1 0.71,1.56 0.89,1.72 1,1 1,1');

const DURATION = 0.22;
const DURATION_BACK = 0.18;

/** Проверяем один раз при инициализации — дальше кэшируем */
const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Выбирает пресет по размеру объекта.
 * @param {number} w
 * @param {number} h
 * @returns {{ liftPx: number, scaleMul: number }}
 */
function getPreset(w, h) {
    if (w >= 120 && h >= 80) {
        return { liftPx: 4, scaleMul: 1.02 };
    }
    return { liftPx: 2, scaleMul: 1.06 };
}

/** Пиковые значения тени на hover (одинаковы для всех объектов) */
const HOVER_ALPHA = 0.28;
const HOVER_DISTANCE = 14;

/** Базовая (покойная) тень для изображений — создаёт эффект объёма */
const IMAGE_REST_ALPHA = 0.18;
const IMAGE_REST_DISTANCE = 6;

/**
 * Создаёт DropShadowFilter с начальными параметрами.
 * @param {number} restAlpha — начальная альфа (0 для обычных, >0 для изображений)
 * @param {number} restDistance
 */
function createShadowFilter(restAlpha = 0, restDistance = 8) {
    const f = new DropShadowFilter({
        alpha: restAlpha,
        blur: 6,
        distance: restDistance,
        angle: 90,
        quality: 3,
    });
    // Явно устанавливаем resolution, чтобы _updatePadding() не обращался
    // к deprecated settings.FILTER_RESOLUTION при каждом изменении distance
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    f.resolution = dpr;
    f.multisample = PIXI.MSAA_QUALITY.HIGH;
    return f;
}

export class HoverLiftController {
    /**
     * @param {import('../../core/EventBus.js').EventBus} eventBus
     * @param {import('pixi.js').Application} pixiApp  — для доступа к worldLayer.scale
     */
    constructor(eventBus, pixiApp) {
        this._eventBus = eventBus;
        this._pixiApp = pixiApp;

        /** Map<pixiObject, { baseScaleX, baseScaleY, baseY, shadow, isHovered, tween }> */
        this._entries = new Map();

        /** Флаги блокировки hover */
        this._isDragging = false;
        this._isResizing = false;
        this._isRotating = false;
        /** Set<id> — выделенные объекты (по _mb.objectId) */
        this._selectedIds = new Set();

        this._bindEvents();
    }

    // ─── Публичный API ────────────────────────────────────────────────────────

    /**
     * Подключить hover-lift к PIXI-объекту.
     * @param {import('pixi.js').DisplayObject} pixiObject
     * @param {{ width?: number, height?: number }} objectData
     */
    attach(pixiObject, objectData) {
        if (!pixiObject || this._entries.has(pixiObject)) return;

        const type = pixiObject._mb?.type || objectData?.type;
        // text/simple-text рендерятся как HTML-элементы (HtmlTextLayer).
        // Для них hover-lift управляется через MindmapHtmlTextLayer/_ensurePixiHover.
        // mindmap: PIXI-капсула получает подъём через HoverLiftController; HTML-текст
        // синхронизируется через MindmapHtmlTextLayer._ensurePixiHover (те же pointerover/out).
        if (type === 'text' || type === 'simple-text') return;
        const hasStaticShadow = type === 'image' || type === 'frame';
        const restAlpha = hasStaticShadow ? IMAGE_REST_ALPHA : 0;
        const restDistance = hasStaticShadow ? IMAGE_REST_DISTANCE : 8;
        // Hover-«pop» (scale + подъём) включён в т.ч. для фрейма. Скачок в
        // переходе hover→resize/drag снимается мгновенным snapBack по событиям
        // ResizeStart/DragStart/SelectionAdd (см. _snapBack* ниже): к моменту
        // нажатия объект уже возвращён к базе. Логические габариты фрейма для
        // resize считаются из state, а не из scaled-pixi, поэтому ресайз с
        // координатной математикой hover не пересекается.

        const shadow = createShadowFilter(restAlpha, restDistance);
        pixiObject.filters = [...(pixiObject.filters || []), shadow];

        const entry = {
            baseScaleX: pixiObject.scale?.x ?? 1,
            baseScaleY: pixiObject.scale?.y ?? 1,
            baseY: pixiObject.y,
            shadow,
            restAlpha,
            restDistance,
            isHovered: false,
            tween: null,
        };
        this._entries.set(pixiObject, entry);

        const w = objectData?.width ?? objectData?.properties?.width ?? 100;
        const h = objectData?.height ?? objectData?.properties?.height ?? 100;
        const preset = getPreset(w, h);

        const onOver = () => this._onOver(pixiObject, preset, entry);
        const onOut = () => this._onOut(pixiObject, preset, entry);

        pixiObject.on('pointerover', onOver);
        pixiObject.on('pointerout', onOut);

        entry._onOver = onOver;
        entry._onOut = onOut;
    }

    /**
     * Отключить hover-lift и убить все твины.
     * @param {import('pixi.js').DisplayObject} pixiObject
     */
    detach(pixiObject) {
        const entry = this._entries.get(pixiObject);
        if (!entry) return;

        if (entry._onOver) pixiObject.off('pointerover', entry._onOver);
        if (entry._onOut) pixiObject.off('pointerout', entry._onOut);

        if (entry.tween) entry.tween.kill();

        // Убираем наш фильтр из списка
        if (pixiObject.filters) {
            pixiObject.filters = pixiObject.filters.filter(f => f !== entry.shadow);
        }
        entry.shadow.destroy?.();

        // Сбрасываем до базовых значений
        if (pixiObject.scale) {
            pixiObject.scale.set(entry.baseScaleX, entry.baseScaleY);
        }
        pixiObject.y = entry.baseY;

        this._entries.delete(pixiObject);
    }

    /**
     * Текущая визуальная hover-трансформация объекта относительно его базы.
     * Нужна, чтобы внешние оверлеи (подсветка коннектора) совпадали с
     * масштабированным/приподнятым на hover объектом.
     * @param {import('pixi.js').DisplayObject} pixiObject
     * @returns {{ scaleMulX: number, scaleMulY: number, centerX: number, centerY: number } | null}
     */
    getVisualTransform(pixiObject) {
        const entry = this._entries.get(pixiObject);
        if (!entry) return null;
        const baseScaleX = entry.baseScaleX || 1;
        const baseScaleY = entry.baseScaleY || 1;
        return {
            scaleMulX: (pixiObject.scale?.x ?? baseScaleX) / baseScaleX,
            scaleMulY: (pixiObject.scale?.y ?? baseScaleY) / baseScaleY,
            centerX: pixiObject.x,
            centerY: pixiObject.y,
        };
    }

    /** Обновить базовые значения после внешнего resize/move */
    syncBase(pixiObject) {
        const entry = this._entries.get(pixiObject);
        if (!entry || entry.isHovered) return;
        entry.baseScaleX = pixiObject.scale?.x ?? entry.baseScaleX;
        entry.baseScaleY = pixiObject.scale?.y ?? entry.baseScaleY;
        entry.baseY = pixiObject.y;
    }

    destroy() {
        this._unbindEvents();
        for (const [pixiObject] of this._entries) {
            this.detach(pixiObject);
        }
        this._entries.clear();
    }

    // ─── Внутренние методы ────────────────────────────────────────────────────

    /** Текущий масштаб worldLayer (≈ zoom уровень) */
    _worldScale() {
        const world = this._pixiApp?.stage?.children?.find(c => c.name === 'worldLayer');
        return world?.scale?.x ?? 1;
    }

    /** Можно ли сейчас показывать hover */
    _isBlocked(pixiObject) {
        if (this._isDragging || this._isResizing || this._isRotating) return true;
        const id = pixiObject._mb?.objectId;
        if (id && this._selectedIds.has(id)) return true;
        return false;
    }

    _onOver(pixiObject, preset, entry) {
        if (prefersReducedMotion || this._isBlocked(pixiObject)) return;
        if (entry.isHovered) return;

        // Базовый scale/y фиксируем в момент наведения, пока объект в покое
        // (нет активного твина). Это снимает гонку с отложенной загрузкой
        // текстуры (ImageObject.fitToSize ставит scale уже после attach):
        // иначе baseScale остаётся 1 и спрайт «раздувается» до натурального
        // размера текстуры вместо ×1.02.
        if (!entry.tween) {
            entry.baseScaleX = pixiObject.scale?.x ?? entry.baseScaleX;
            entry.baseScaleY = pixiObject.scale?.y ?? entry.baseScaleY;
            entry.baseY = pixiObject.y;
        }

        entry.isHovered = true;
        if (entry.tween) entry.tween.kill();

        const zoom = this._worldScale();
        const worldLift = preset.liftPx / zoom;

        entry.tween = gsap.to(pixiObject, {
            duration: DURATION,
            ease: EASE_ID,
            y: entry.baseY - worldLift,
            onUpdate: () => {
                if (pixiObject.scale) {
                    const t = entry.tween?.progress() ?? 1;
                    const scaleX = entry.baseScaleX + (entry.baseScaleX * (preset.scaleMul - 1)) * t;
                    const scaleY = entry.baseScaleY + (entry.baseScaleY * (preset.scaleMul - 1)) * t;
                    pixiObject.scale.set(scaleX, scaleY);
                }
                const t = entry.tween?.progress() ?? 1;
                entry.shadow.alpha = entry.restAlpha + (HOVER_ALPHA - entry.restAlpha) * t;
                entry.shadow.distance = entry.restDistance + (HOVER_DISTANCE - entry.restDistance) * t;
            },
            onComplete: () => {
                if (pixiObject.scale) {
                    pixiObject.scale.set(
                        entry.baseScaleX * preset.scaleMul,
                        entry.baseScaleY * preset.scaleMul
                    );
                }
                entry.shadow.alpha = HOVER_ALPHA;
                entry.shadow.distance = HOVER_DISTANCE;
            },
        });
    }

    _onOut(pixiObject, preset, entry) {
        if (prefersReducedMotion) return;
        if (!entry.isHovered) return;
        entry.isHovered = false;
        if (entry.tween) entry.tween.kill();

        entry.tween = gsap.to(pixiObject, {
            duration: DURATION_BACK,
            ease: 'power2.out',
            y: entry.baseY,
            onUpdate: () => {
                if (pixiObject.scale) {
                    const p = 1 - (entry.tween?.progress() ?? 0);
                    const scaleX = entry.baseScaleX + (entry.baseScaleX * (preset.scaleMul - 1)) * p;
                    const scaleY = entry.baseScaleY + (entry.baseScaleY * (preset.scaleMul - 1)) * p;
                    pixiObject.scale.set(scaleX, scaleY);
                }
                const p = 1 - (entry.tween?.progress() ?? 0);
                entry.shadow.alpha = entry.restAlpha + (HOVER_ALPHA - entry.restAlpha) * p;
                entry.shadow.distance = entry.restDistance + (HOVER_DISTANCE - entry.restDistance) * p;
            },
            onComplete: () => {
                if (pixiObject.scale) {
                    pixiObject.scale.set(entry.baseScaleX, entry.baseScaleY);
                }
                entry.shadow.alpha = entry.restAlpha;
                entry.shadow.distance = entry.restDistance;
                pixiObject.y = entry.baseY;
                entry.tween = null;
            },
        });
    }

    /** Немедленно сбросить hover без анимации для всех объектов */
    _snapBackAll() {
        for (const [pixiObject, entry] of this._entries) {
            // Сбрасываем не только наведённые, но и объекты с ещё живым твином:
            // возвратный _onOut-твин имеет isHovered=false, но продолжает писать
            // pixiObject.y/scale каждый кадр и иначе конкурировал бы с resize/drag.
            if (!entry.isHovered && !entry.tween) continue;
            if (entry.tween) entry.tween.kill();
            entry.tween = null;
            entry.isHovered = false;
            pixiObject.y = entry.baseY;
            if (pixiObject.scale) {
                pixiObject.scale.set(entry.baseScaleX, entry.baseScaleY);
            }
            entry.shadow.alpha = entry.restAlpha;
            entry.shadow.distance = entry.restDistance;
        }
    }

    /** Немедленно сбросить hover для объекта с конкретным objectId */
    _snapBackById(objectId) {
        const id = String(objectId);
        for (const [pixiObject, entry] of this._entries) {
            if (String(pixiObject._mb?.objectId) !== id) continue;
            if (!entry.isHovered && !entry.tween) continue;
            if (entry.tween) entry.tween.kill();
            entry.tween = null;
            entry.isHovered = false;
            pixiObject.y = entry.baseY;
            if (pixiObject.scale) {
                pixiObject.scale.set(entry.baseScaleX, entry.baseScaleY);
            }
            entry.shadow.alpha = entry.restAlpha;
            entry.shadow.distance = entry.restDistance;
        }
    }

    _bindEvents() {
        const eb = this._eventBus;
        if (!eb) return;

        this._onDragStart = () => { this._isDragging = true; this._snapBackAll(); };
        this._onDragEnd = () => { this._isDragging = false; };
        this._onResizeStart = () => { this._isResizing = true; this._snapBackAll(); };
        this._onResizeEnd = () => { this._isResizing = false; };
        this._onRotateStart = () => { this._isRotating = true; this._snapBackAll(); };
        this._onRotateEnd = () => { this._isRotating = false; };

        this._onSelectionAdd = (data) => {
            const id = data?.object ?? data?.objectId ?? data?.id ?? data;
            if (id) {
                this._selectedIds.add(String(id));
                this._snapBackById(id);
            }
        };
        this._onSelectionRemove = (data) => {
            const id = data?.object ?? data?.objectId ?? data?.id ?? data;
            if (id) this._selectedIds.delete(String(id));
        };
        this._onSelectionClear = () => { this._selectedIds.clear(); };

        eb.on(Events.Tool.DragStart, this._onDragStart);
        eb.on(Events.Tool.GroupDragStart, this._onDragStart);
        eb.on(Events.Tool.DragEnd, this._onDragEnd);
        eb.on(Events.Tool.GroupDragEnd, this._onDragEnd);

        eb.on(Events.Tool.ResizeStart, this._onResizeStart);
        eb.on(Events.Tool.GroupResizeStart, this._onResizeStart);
        eb.on(Events.Tool.ResizeEnd, this._onResizeEnd);
        eb.on(Events.Tool.GroupResizeEnd, this._onResizeEnd);

        eb.on(Events.Tool.RotateStart, this._onRotateStart);
        eb.on(Events.Tool.GroupRotateStart, this._onRotateStart);
        eb.on(Events.Tool.RotateEnd, this._onRotateEnd);
        eb.on(Events.Tool.GroupRotateEnd, this._onRotateEnd);

        eb.on(Events.Tool.SelectionAdd, this._onSelectionAdd);
        eb.on(Events.Tool.SelectionRemove, this._onSelectionRemove);
        eb.on(Events.Tool.SelectionClear, this._onSelectionClear);
    }

    _unbindEvents() {
        const eb = this._eventBus;
        if (!eb) return;

        eb.off(Events.Tool.DragStart, this._onDragStart);
        eb.off(Events.Tool.GroupDragStart, this._onDragStart);
        eb.off(Events.Tool.DragEnd, this._onDragEnd);
        eb.off(Events.Tool.GroupDragEnd, this._onDragEnd);

        eb.off(Events.Tool.ResizeStart, this._onResizeStart);
        eb.off(Events.Tool.GroupResizeStart, this._onResizeStart);
        eb.off(Events.Tool.ResizeEnd, this._onResizeEnd);
        eb.off(Events.Tool.GroupResizeEnd, this._onResizeEnd);

        eb.off(Events.Tool.RotateStart, this._onRotateStart);
        eb.off(Events.Tool.GroupRotateStart, this._onRotateStart);
        eb.off(Events.Tool.RotateEnd, this._onRotateEnd);
        eb.off(Events.Tool.GroupRotateEnd, this._onRotateEnd);

        eb.off(Events.Tool.SelectionAdd, this._onSelectionAdd);
        eb.off(Events.Tool.SelectionRemove, this._onSelectionRemove);
        eb.off(Events.Tool.SelectionClear, this._onSelectionClear);
    }
}
