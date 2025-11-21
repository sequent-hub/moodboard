import { Events } from '../core/events/Events.js';

export class SettingsApplier {
    constructor(eventBus, pixi, boardService = null, uiRefs = {}) {
        this.eventBus = eventBus;
        this.pixi = pixi;
        this.boardService = boardService;
        this.ui = uiRefs || {};
        this.settings = {};
    }

    setUI(uiRefs = {}) {
        this.ui = { ...this.ui, ...uiRefs };
    }

    set(partial) {
        this.settings = { ...this.settings, ...(partial || {}) };
        this.apply(this.settings);
    }

    get() {
        return { ...this.settings };
    }

    apply(settings = {}) {
        this.settings = { ...this.settings, ...settings };
        const s = this.settings;

        // 1) Фон
        if (s.backgroundColor && this.pixi?.app?.renderer) {
            const bgInt = this._toIntColor(s.backgroundColor);
            if (bgInt != null) this.pixi.app.renderer.backgroundColor = bgInt;
            // Синхронизация UI цвета (если доступен topbar)
            if (this.ui.topbar) {
                try {
                    const boardHex = this._toHex(bgInt);
                    this.ui.topbar.setPaintButtonHex(this.ui.topbar.mapBoardToBtnHex(boardHex));
                } catch (_) {}
            }
        }

        // 2) Сетка
        if (s.grid && s.grid.type) {
            try {
                const payload = { type: s.grid.type };
                // Пробрасываем дополнительные опции, если есть
                const options = s.grid.options || {
                    size: s.grid.size,
                    color: this._maybeInt(s.grid.color),
                    enabled: s.grid.visible !== false
                };
                if (options) payload.options = options;
                this.eventBus.emit(Events.UI.GridChange, payload);
                if (this.ui.topbar && s.grid.type) {
                    this.ui.topbar.setActive(s.grid.type);
                }
            } catch (_) {}
        }

        // 3) Зум
        if (s.zoom && (typeof s.zoom.current === 'number')) {
            const world = this.pixi?.worldLayer || this.pixi?.app?.stage;
            if (world) {
                const z = Math.max(0.1, Math.min(5, s.zoom.current));
                world.scale.set(z);
                try { this.eventBus.emit(Events.UI.ZoomPercent, { percentage: Math.round(z * 100) }); } catch (_) {}
            }
        }
    }

    _toIntColor(hexOrInt) {
        if (typeof hexOrInt === 'number') return hexOrInt;
        if (typeof hexOrInt === 'string') {
            const s = hexOrInt.startsWith('#') ? hexOrInt.slice(1) : hexOrInt;
            const n = parseInt(s, 16);
            return Number.isFinite(n) ? n : null;
        }
        return null;
    }

    _maybeInt(v) {
        if (v == null) return v;
        if (typeof v === 'number') return v;
        if (typeof v === 'string') {
            const s = v.startsWith('#') ? v.slice(1) : v;
            const n = parseInt(s, 16);
            return Number.isFinite(n) ? n : v;
        }
        return v;
    }

    _toHex(intColor) {
        try { return `#${(intColor >>> 0).toString(16).padStart(6, '0')}`.toLowerCase(); } catch (_) { return '#f5f5f5'; }
    }
}


