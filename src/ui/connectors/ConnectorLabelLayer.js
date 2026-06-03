import * as PIXI from 'pixi.js';
import { Events } from '../../core/events/Events.js';

function numToHex(color) {
    return '#' + (color >>> 0).toString(16).padStart(6, '0');
}

/**
 * ConnectorLabelLayer — HTML-оверлей текстовых меток над коннекторами.
 *
 * Метка позиционируется по середине пути коннектора (_lastSegments из ConnectorLayer).
 * Редактирование по двойному клику или через openEditorForConnector().
 * Сохранение через UpdateConnectorCommand (Events.Object.StateChanged → tryCreateConnectorStyleCommand).
 */
export class ConnectorLabelLayer {
    constructor(container, eventBus, core) {
        this.container  = container;
        this.eventBus   = eventBus;
        this.core       = core;
        this.layer      = null;
        /** @type {Map<string, HTMLElement>} */
        this.idToEl     = new Map();
        this._editingId = null;
        this._editEl    = null;
        this._subs      = [];
    }

    attach() {
        this.layer = document.createElement('div');
        this.layer.className = 'connector-label-layer';
        Object.assign(this.layer.style, {
            position:      'absolute',
            inset:         '0',
            overflow:      'hidden',
            pointerEvents: 'none',
            zIndex:        '11',
        });
        this.container.appendChild(this.layer);

        const redraw  = () => this._updateAll();
        const rebuild = () => this._rebuildFromState();

        const bindings = [
            [Events.Object.Created,         rebuild],
            [Events.Object.Deleted,         ({ objectId }) => this._removeLabelEl(objectId)],
            [Events.Object.StateChanged,    ({ objectId }) => { this._syncOne(objectId); this._updateOne(objectId); }],
            [Events.History.Changed,        rebuild],
            [Events.Board.Loaded,           rebuild],
            [Events.Tool.DragUpdate,        redraw],
            [Events.Tool.DragEnd,           redraw],
            [Events.Tool.ResizeUpdate,      redraw],
            [Events.Tool.ResizeEnd,         redraw],
            [Events.Tool.GroupDragUpdate,   redraw],
            [Events.Tool.GroupResizeUpdate, redraw],
            [Events.Tool.PanUpdate,         redraw],
            [Events.UI.ZoomPercent,         redraw],
        ];

        for (const [ev, fn] of bindings) {
            this.eventBus.on(ev, fn);
            this._subs.push([ev, fn]);
        }

        this._rebuildFromState();
    }

    destroy() {
        if (this._editingId) this._cleanupEditEl();
        for (const [ev, fn] of this._subs) {
            if (this.eventBus?.off) this.eventBus.off(ev, fn);
        }
        this._subs = [];
        if (this.layer) { this.layer.remove(); this.layer = null; }
        this.idToEl.clear();
        this.eventBus = null;
        this.core     = null;
    }

    /** Публичный API для T+ кнопки: открыть редактор для коннектора. */
    openEditorForConnector(connectorId) {
        this._openEditor(connectorId);
    }

    // ── State sync ────────────────────────────────────────────────────────────

    _rebuildFromState() {
        if (!this.core?.state) return;
        const objects = this.core.state.state.objects || [];
        const connectorIds = new Set(
            objects.filter(o => o.type === 'connector').map(o => o.id)
        );

        for (const [id] of this.idToEl) {
            if (!connectorIds.has(id)) this._removeLabelEl(id);
        }

        for (const obj of objects) {
            if (obj.type !== 'connector') continue;
            const label = obj.properties?.style?.label;
            if (label != null) {
                this._ensureLabelEl(obj.id, label);
                this._updateOne(obj.id);
            } else {
                this._removeLabelEl(obj.id);
            }
        }
    }

    _syncOne(connectorId) {
        if (!this.core?.state) return;
        const obj = (this.core.state.state.objects || []).find(o => o.id === connectorId);
        if (!obj || obj.type !== 'connector') { this._removeLabelEl(connectorId); return; }
        const label = obj.properties?.style?.label;
        if (label != null) {
            this._ensureLabelEl(connectorId, label);
        } else {
            this._removeLabelEl(connectorId);
        }
    }

    _ensureLabelEl(connectorId, label) {
        if (!this.layer) return;
        let el = this.idToEl.get(connectorId);
        if (!el) {
            el = document.createElement('div');
            el.className  = 'connector-label';
            el.dataset.id = connectorId;
            Object.assign(el.style, {
                position:        'absolute',
                pointerEvents:   'auto',
                cursor:          'default',
                padding:         '2px 8px',
                borderRadius:    '4px',
                backgroundColor: 'rgba(255,255,255,0.92)',
                border:          '1px solid rgba(0,0,0,0.12)',
                boxShadow:       '0 1px 3px rgba(0,0,0,0.10)',
                whiteSpace:      'nowrap',
                userSelect:      'none',
                transform:       'translate(-50%, -50%)',
                lineHeight:      '1.4',
            });
            el.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                this._openEditor(connectorId);
            });
            this.layer.appendChild(el);
            this.idToEl.set(connectorId, el);
        }
        el.textContent    = label.text ?? '';
        el.style.color    = numToHex(label.color ?? 0x212121);
        el.style.fontSize = `${label.fontSize ?? 14}px`;
        el.style.display  = label.text ? '' : 'none';
    }

    _removeLabelEl(connectorId) {
        const el = this.idToEl.get(connectorId);
        if (el) { el.remove(); this.idToEl.delete(connectorId); }
        if (this._editingId === connectorId) this._cleanupEditEl();
    }

    // ── Positioning ───────────────────────────────────────────────────────────

    _updateAll() {
        for (const id of this.idToEl.keys()) this._updateOne(id);
        if (this._editingId) this._repositionEditor(this._editingId);
    }

    _updateOne(connectorId) {
        const el = this.idToEl.get(connectorId);
        if (!el || !this.core?.pixi) return;

        const obj = (this.core?.state?.state?.objects || []).find(o => o.id === connectorId);
        const label = obj?.properties?.style?.label;
        if (!label?.text) { el.style.display = 'none'; return; }

        const mid = this._getMidpointCss(connectorId);
        if (!mid) { el.style.display = 'none'; return; }

        el.style.display  = '';
        el.style.left     = `${mid.x}px`;
        el.style.top      = `${mid.y}px`;

        // Масштабируем размер шрифта вместе с зумом
        const worldLayer = this.core.pixi.worldLayer || this.core.pixi.app?.stage;
        const zoom       = worldLayer?.scale?.x ?? 1;
        el.style.fontSize = `${Math.max(6, Math.round((label.fontSize ?? 14) * zoom))}px`;
    }

    /**
     * Возвращает CSS-координаты середины коннектора относительно container.
     * Целые пиксели (screen-space integer contract).
     */
    _getMidpointCss(connectorId) {
        const segments = this.core?.connectorLayer?._lastSegments;
        if (!segments) return null;
        const seg = segments.find(s => s.id === connectorId);
        if (!seg?.points?.length) return null;

        const pts = seg.points;
        const i1  = Math.floor((pts.length - 1) / 2);
        const i2  = Math.ceil( (pts.length - 1) / 2);
        const midWX = (pts[i1].x + pts[i2].x) / 2;
        const midWY = (pts[i1].y + pts[i2].y) / 2;

        const worldLayer = this.core.pixi.worldLayer || this.core.pixi.app?.stage;
        const view       = this.core.pixi.app?.view;

        if (worldLayer && view?.parentElement) {
            const cRect = view.parentElement.getBoundingClientRect();
            const vRect = view.getBoundingClientRect();
            const offL  = vRect.left - cRect.left;
            const offT  = vRect.top  - cRect.top;
            const pt    = worldLayer.toGlobal(new PIXI.Point(midWX, midWY));
            return { x: Math.round(offL + pt.x), y: Math.round(offT + pt.y) };
        }

        // Fallback без view
        const scale = worldLayer?.scale?.x ?? 1;
        const wx    = worldLayer?.x ?? 0;
        const wy    = worldLayer?.y ?? 0;
        return { x: Math.round(midWX * scale + wx), y: Math.round(midWY * scale + wy) };
    }

    // ── Editor ────────────────────────────────────────────────────────────────

    _openEditor(connectorId) {
        if (this._editingId) this._cleanupEditEl();
        if (!this.layer) return;

        const pos = this._getMidpointCss(connectorId) ?? { x: 0, y: 0 };
        const objects = this.core?.state?.state?.objects || [];
        const obj     = objects.find(o => o.id === connectorId);
        const label   = obj?.properties?.style?.label;

        // Скрываем статичную метку на время редактирования
        const staticEl = this.idToEl.get(connectorId);
        if (staticEl) staticEl.style.visibility = 'hidden';

        const worldLayer = this.core?.pixi?.worldLayer || this.core?.pixi?.app?.stage;
        const zoom       = worldLayer?.scale?.x ?? 1;

        const editEl = document.createElement('div');
        editEl.contentEditable = 'true';
        editEl.className = 'connector-label connector-label--editing';
        Object.assign(editEl.style, {
            position:        'absolute',
            left:            `${pos.x}px`,
            top:             `${pos.y}px`,
            transform:       'translate(-50%, -50%)',
            pointerEvents:   'auto',
            cursor:          'text',
            padding:         '2px 8px',
            borderRadius:    '4px',
            backgroundColor: 'white',
            border:          '2px solid #2563EB',
            boxShadow:       '0 2px 8px rgba(37,99,235,0.2)',
            whiteSpace:      'nowrap',
            outline:         'none',
            minWidth:        '40px',
            lineHeight:      '1.4',
            color:           numToHex(label?.color ?? 0x212121),
            fontSize:        `${Math.max(6, Math.round((label?.fontSize ?? 14) * zoom))}px`,
        });
        editEl.textContent = label?.text ?? '';
        this.layer.appendChild(editEl);

        this._editEl    = editEl;
        this._editingId = connectorId;

        requestAnimationFrame(() => {
            editEl.focus();
            const range = document.createRange();
            range.selectNodeContents(editEl);
            const sel = window.getSelection();
            if (sel) { sel.removeAllRanges(); sel.addRange(range); }
        });

        editEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._commitEdit(connectorId); }
            if (e.key === 'Escape') { e.preventDefault(); this._cancelEdit(); }
        });

        editEl.addEventListener('blur', () => {
            // Задержка: чтобы клик на кнопку панели не сразу коммитил
            setTimeout(() => {
                if (this._editingId === connectorId && this._editEl) {
                    this._commitEdit(connectorId);
                }
            }, 180);
        });
    }

    _repositionEditor(connectorId) {
        if (!this._editEl || this._editingId !== connectorId) return;
        const mid = this._getMidpointCss(connectorId);
        if (!mid) return;
        this._editEl.style.left = `${mid.x}px`;
        this._editEl.style.top  = `${mid.y}px`;
    }

    _commitEdit(connectorId) {
        if (!this._editEl) return;
        const text = this._editEl.textContent?.trim() ?? '';
        this._cleanupEditEl();

        const objects  = this.core?.state?.state?.objects || [];
        const obj      = objects.find(o => o.id === connectorId);
        const existing = obj?.properties?.style?.label;

        const newLabel = text
            ? { text, color: existing?.color ?? 0x212121, fontSize: existing?.fontSize ?? 14 }
            : null;

        this.eventBus?.emit(Events.Object.StateChanged, {
            objectId: connectorId,
            updates:  { properties: { style: { label: newLabel } } },
        });
    }

    _cancelEdit() {
        this._cleanupEditEl();
    }

    _cleanupEditEl() {
        if (this._editEl) { this._editEl.remove(); this._editEl = null; }
        const id = this._editingId;
        this._editingId = null;
        if (id) {
            const staticEl = this.idToEl.get(id);
            if (staticEl) staticEl.style.visibility = '';
        }
    }
}
