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
        // Применяем только изменённые части, чтобы не трогать сетку при смене фона и наоборот
        this.apply(partial || {});
        // Сообщаем системе об изменении настроек для автосохранения
        try {
            this.eventBus && this.eventBus.emit(Events.Grid.BoardDataChanged, { settings: this.get() });
        } catch (_) {}
    }

    get() {
        return { ...this.settings };
    }

    apply(partial = {}) {
        // Копим полные настройки, но применяем только то, что пришло в partial
        this.settings = { ...this.settings, ...partial };
        const s = this.settings;

        // 1) Фон
        if (partial.backgroundColor && this.pixi?.app?.renderer) {
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

        // 2) Сетка — применяем только если grid пришёл в partial
        if (partial.grid && s.grid && s.grid.type) {
            try {
                const payload = { type: s.grid.type };
                // Пробрасываем только явно заданные опции, чтобы не затирать дефолты фабрики
                const overrides = {};
                if (s.grid.options && typeof s.grid.options === 'object') {
                    Object.keys(s.grid.options).forEach((k) => {
                        const v = s.grid.options[k];
                        if (v !== undefined) overrides[k] = k === 'color' ? this._maybeInt(v) : v;
                    });
                }
                if (s.grid.size !== undefined) overrides.size = s.grid.size;
                if (s.grid.color !== undefined) overrides.color = this._maybeInt(s.grid.color);
                if (s.grid.visible !== undefined) overrides.enabled = s.grid.visible !== false;
                if (Object.keys(overrides).length > 0) payload.options = overrides;
                this.eventBus.emit(Events.UI.GridChange, payload);
                if (this.ui.topbar && s.grid.type) {
                    this.ui.topbar.setActive(s.grid.type);
                }
            } catch (_) {}
        }

        // 3) Зум
        if (partial.zoom && s.zoom && (typeof s.zoom.current === 'number')) {
            const world = this.pixi?.worldLayer || this.pixi?.app?.stage;
            if (world) {
                const z = Math.max(0.1, Math.min(5, s.zoom.current));
                world.scale.set(z);
                try { this.eventBus.emit(Events.UI.ZoomPercent, { percentage: Math.round(z * 100) }); } catch (_) {}
            }
        }

        // 4) Панорамирование (позиция мира)
        if (partial.pan && s.pan && typeof s.pan.x === 'number' && typeof s.pan.y === 'number') {
            const world = this.pixi?.worldLayer || this.pixi?.app?.stage;
            if (world) {
                world.x = s.pan.x;
                world.y = s.pan.y;
                // Обновление зависимых слоёв/панелей выполняется по их событиям; здесь только применяем позицию
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


