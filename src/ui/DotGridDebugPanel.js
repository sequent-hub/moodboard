import { getDotCheckpointForZoom, updateDotCheckpoint } from '../grid/DotGridZoomPhases.js';

function intToHex(color) {
    const n = Math.max(0, Math.min(0xFFFFFF, Math.round(Number(color) || 0)));
    return `#${n.toString(16).padStart(6, '0')}`;
}

function hexToInt(hex) {
    const h = String(hex || '').trim().replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    return Number.parseInt(h, 16);
}

export class DotGridDebugPanel {
    constructor(container, coreMoodboard) {
        this.container = container;
        this.core = coreMoodboard;
        this.element = null;
        this._pollTimer = null;
        this._activeCheckpoint = null;
        this._isApplying = false;
        this._init();
    }

    _init() {
        this._create();
        this._attach();
        this._startPolling();
    }

    _create() {
        const panel = document.createElement('div');
        panel.style.position = 'absolute';
        panel.style.right = '16px';
        panel.style.top = '16px';
        panel.style.zIndex = '9999';
        panel.style.width = '260px';
        panel.style.padding = '10px';
        panel.style.border = '1px solid #d9dee8';
        panel.style.borderRadius = '10px';
        panel.style.background = 'rgba(255,255,255,0.97)';
        panel.style.boxShadow = '0 6px 20px rgba(0,0,0,0.12)';
        panel.style.fontFamily = 'Segoe UI, Arial, sans-serif';
        panel.style.fontSize = '12px';
        panel.style.color = '#1f2937';

        const title = document.createElement('div');
        title.textContent = 'Dot Grid Debug';
        title.style.fontWeight = '700';
        title.style.marginBottom = '8px';
        panel.appendChild(title);

        this.infoEl = document.createElement('div');
        this.infoEl.style.marginBottom = '8px';
        this.infoEl.style.color = '#475569';
        this.infoEl.textContent = 'zoom: -, checkpoint: -';
        panel.appendChild(this.infoEl);

        const makeRow = (labelText, inputEl) => {
            const row = document.createElement('div');
            row.style.marginBottom = '8px';
            const label = document.createElement('label');
            label.textContent = labelText;
            label.style.display = 'block';
            label.style.marginBottom = '4px';
            row.appendChild(label);
            row.appendChild(inputEl);
            panel.appendChild(row);
        };

        this.radiusRange = document.createElement('input');
        this.radiusRange.type = 'range';
        this.radiusRange.min = '0';
        this.radiusRange.max = '6';
        this.radiusRange.step = '0.1';
        this.radiusRange.style.width = '100%';
        makeRow('dot radius', this.radiusRange);

        this.radiusValue = document.createElement('div');
        this.radiusValue.style.marginTop = '-6px';
        this.radiusValue.style.marginBottom = '8px';
        this.radiusValue.style.color = '#64748b';
        panel.appendChild(this.radiusValue);

        this.spacingRange = document.createElement('input');
        this.spacingRange.type = 'range';
        this.spacingRange.min = '8';
        this.spacingRange.max = '120';
        this.spacingRange.step = '1';
        this.spacingRange.style.width = '100%';
        makeRow('spacing', this.spacingRange);

        this.spacingValue = document.createElement('div');
        this.spacingValue.style.marginTop = '-6px';
        this.spacingValue.style.marginBottom = '8px';
        this.spacingValue.style.color = '#64748b';
        panel.appendChild(this.spacingValue);

        this.colorInput = document.createElement('input');
        this.colorInput.type = 'color';
        this.colorInput.style.width = '100%';
        this.colorInput.style.height = '30px';
        this.colorInput.style.border = '1px solid #d1d5db';
        this.colorInput.style.borderRadius = '6px';
        makeRow('color', this.colorInput);

        const controls = document.createElement('div');
        controls.style.display = 'flex';
        controls.style.gap = '6px';
        controls.style.marginTop = '6px';

        this.copyBtn = document.createElement('button');
        this.copyBtn.textContent = 'Copy checkpoint';
        this.copyBtn.style.flex = '1';
        this.copyBtn.style.padding = '6px 8px';
        this.copyBtn.style.border = '1px solid #cbd5e1';
        this.copyBtn.style.borderRadius = '6px';
        this.copyBtn.style.cursor = 'pointer';
        this.copyBtn.style.background = '#f8fafc';
        controls.appendChild(this.copyBtn);

        this.floatRadiusToggle = document.createElement('button');
        this.floatRadiusToggle.textContent = 'Float ON';
        this.floatRadiusToggle.style.flex = '0 0 72px';
        this.floatRadiusToggle.style.padding = '6px 8px';
        this.floatRadiusToggle.style.border = '1px solid #93c5fd';
        this.floatRadiusToggle.style.borderRadius = '6px';
        this.floatRadiusToggle.style.cursor = 'pointer';
        this.floatRadiusToggle.style.background = '#dbeafe';
        controls.appendChild(this.floatRadiusToggle);

        panel.appendChild(controls);
        this.element = panel;
        this.container.appendChild(panel);
    }

    _attach() {
        this._onRadiusInput = () => this._applyPatch({ dotRadius: Number(this.radiusRange.value) });
        this._onSpacingInput = () => this._applyPatch({ spacing: Number(this.spacingRange.value) });
        this._onColorInput = () => {
            const color = hexToInt(this.colorInput.value);
            if (color != null) this._applyPatch({ color });
        };
        this._onCopyClick = async () => {
            if (!this._activeCheckpoint) return;
            const worldScale = this._getWorldScale();
            const payload = {
                zoomPercent: this._activeCheckpoint.zoomPercent,
                zoomLabel: `${Math.round((worldScale || 1) * 100)}%`,
                spacing: this._activeCheckpoint.spacing,
                dotRadius: this._activeCheckpoint.dotRadius,
                color: `0x${this._activeCheckpoint.color.toString(16).padStart(6, '0').toUpperCase()}`,
            };
            const text = JSON.stringify(payload);
            try {
                await navigator.clipboard.writeText(text);
                this.copyBtn.textContent = 'Copied';
                setTimeout(() => { this.copyBtn.textContent = 'Copy checkpoint'; }, 1000);
            } catch (_) {
                this.copyBtn.textContent = 'Copy failed';
                setTimeout(() => { this.copyBtn.textContent = 'Copy checkpoint'; }, 1000);
            }
        };
        this._onFloatToggle = () => {
            this._floatEnabled = !this._floatEnabled;
            this.floatRadiusToggle.textContent = this._floatEnabled ? 'Float ON' : 'Float OFF';
            this.floatRadiusToggle.style.background = this._floatEnabled ? '#dbeafe' : '#f8fafc';
            this.floatRadiusToggle.style.borderColor = this._floatEnabled ? '#93c5fd' : '#cbd5e1';
            const grid = this._getGrid();
            if (grid && typeof grid.setAllowFloatDotRadius === 'function') {
                grid.setAllowFloatDotRadius(this._floatEnabled);
            }
        };

        this._floatEnabled = true;
        this.radiusRange.addEventListener('input', this._onRadiusInput);
        this.spacingRange.addEventListener('input', this._onSpacingInput);
        this.colorInput.addEventListener('input', this._onColorInput);
        this.copyBtn.addEventListener('click', this._onCopyClick);
        this.floatRadiusToggle.addEventListener('click', this._onFloatToggle);
    }

    _startPolling() {
        this._pollTimer = setInterval(() => {
            const scale = this._getWorldScale();
            if (!Number.isFinite(scale)) return;
            const checkpoint = getDotCheckpointForZoom(scale);
            if (!checkpoint) return;
            this.infoEl.textContent = `zoom: ${Math.round(scale * 100)}%, checkpoint: ${checkpoint.zoomPercent}%`;

            const changed = !this._activeCheckpoint || this._activeCheckpoint.zoomPercent !== checkpoint.zoomPercent;
            this._activeCheckpoint = checkpoint;
            if (changed && !this._isApplying) {
                this.radiusRange.value = String(checkpoint.dotRadius);
                this.spacingRange.value = String(checkpoint.spacing);
                this.colorInput.value = intToHex(checkpoint.color);
            }
            this.radiusValue.textContent = `radius: ${Number(this.radiusRange.value).toFixed(1)}`;
            this.spacingValue.textContent = `spacing: ${this.spacingRange.value}px`;

            const grid = this._getGrid();
            if (grid && typeof grid.setAllowFloatDotRadius === 'function') {
                grid.setAllowFloatDotRadius(this._floatEnabled);
            }
        }, 150);
    }

    _getWorldScale() {
        const world = this.core?.pixi?.worldLayer || this.core?.pixi?.app?.stage;
        return world?.scale?.x ?? null;
    }

    _getGrid() {
        return this.core?.boardService?.grid || null;
    }

    _refreshGridVisual() {
        const boardService = this.core?.boardService;
        if (boardService && typeof boardService.refreshGridViewport === 'function') {
            boardService.refreshGridViewport();
            return;
        }
        const grid = this._getGrid();
        if (grid && typeof grid.updateVisual === 'function') {
            grid.updateVisual();
        }
    }

    _applyPatch(patch) {
        if (!this._activeCheckpoint) return;
        this._isApplying = true;
        const updated = updateDotCheckpoint(this._activeCheckpoint.zoomPercent, patch);
        if (updated) {
            this._activeCheckpoint = updated;
            this.radiusRange.value = String(updated.dotRadius);
            this.spacingRange.value = String(updated.spacing);
            this.colorInput.value = intToHex(updated.color);
            this.radiusValue.textContent = `radius: ${Number(this.radiusRange.value).toFixed(1)}`;
            this.spacingValue.textContent = `spacing: ${this.spacingRange.value}px`;
            this._refreshGridVisual();
        }
        this._isApplying = false;
    }

    destroy() {
        if (this._pollTimer) {
            clearInterval(this._pollTimer);
            this._pollTimer = null;
        }
        this.radiusRange?.removeEventListener('input', this._onRadiusInput);
        this.spacingRange?.removeEventListener('input', this._onSpacingInput);
        this.colorInput?.removeEventListener('input', this._onColorInput);
        this.copyBtn?.removeEventListener('click', this._onCopyClick);
        this.floatRadiusToggle?.removeEventListener('click', this._onFloatToggle);
        const grid = this._getGrid();
        if (grid && typeof grid.setAllowFloatDotRadius === 'function') {
            grid.setAllowFloatDotRadius(false);
        }
        if (this.element) this.element.remove();
        this.element = null;
    }
}

