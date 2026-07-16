import { FONT_OPTIONS, FONT_SIZE_OPTIONS } from '../text-properties/TextPropertiesPanelMapper.js';
import { SHAPE_ICONS, ALIGN_ICONS } from './ShapePropertiesPanelDom.js';

/**
 * Синхронизирует все контролы панели с текущим состоянием объекта.
 * Читает данные через core.getObjectData(id).
 */
export function updateControlsFromObject(inst) {
    if (!inst.currentId) return;
    const data = inst.core?.getObjectData?.(inst.currentId);
    if (!data) return;

    const props = data.properties || {};

    _syncKind(inst, props.kind || 'square');
    _syncRadius(inst, props.cornerRadius ?? 0);
    _syncFillColor(inst, data.color ?? 0xFFFFFF, props.fillOpacity ?? 1);
    _syncBorder(inst, props);
    _syncText(inst, props.text || {});
}

export function updateBorderStyleBtns(inst, active) {
    if (!inst._borderStyleBtns) return;
    Object.entries(inst._borderStyleBtns).forEach(([val, btn]) => {
        btn.classList.toggle('spp-btn--active', val === active);
    });
}

export function setAlign(inst, value) {
    if (inst._alignTrigger && ALIGN_ICONS[value]) {
        inst._alignTrigger.innerHTML = ALIGN_ICONS[value];
    }
    if (!inst._alignBtns) return;
    Object.entries(inst._alignBtns).forEach(([val, btn]) => {
        btn.classList.toggle('spp-btn--active', val === value);
    });
}

export function syncSwatches(swatches, hexUpper) {
    if (!swatches) return;
    swatches.forEach(s => {
        const match = (s.dataset.colorHex || '').toUpperCase() === hexUpper.toUpperCase();
        s.classList.toggle('spp-color-swatch--active', match);
    });
}

export function pixiToHex(pixi) {
    return `#${(pixi >>> 0).toString(16).padStart(6, '0').toUpperCase()}`;
}

// ── Приватные хелперы ─────────────────────────────────────────────────────────

function _syncKind(inst, kind) {
    if (inst._kindButtons) {
        Object.values(inst._kindButtons).forEach(b =>
            b.classList.toggle('spp-kind-btn--active', b.dataset.kind === kind));
    }
    if (inst._kindTrigger && SHAPE_ICONS[kind]) {
        inst._kindTrigger.innerHTML = SHAPE_ICONS[kind];
    }
    if (inst._radiusGroup) {
        const supportsRadius = kind === 'square' || kind === 'rounded';
        inst._radiusGroup.classList.toggle('spp-radius-group--hidden', !supportsRadius);
    }
}

function _syncRadius(inst, cr) {
    if (inst._radiusSlider) {
        inst._radiusSlider.value = String(cr);
        if (inst._radiusVal) inst._radiusVal.textContent = String(cr);
    }
}

function _syncFillColor(inst, fillPixi, fillOpacity) {
    const isTransparent = fillOpacity === 0;

    if (inst._fillColorBtn) {
        inst._fillColorBtn.style.backgroundColor = isTransparent ? '' : pixiToHex(fillPixi);
        inst._fillColorBtn.classList.toggle('spp-color-btn--transparent', isTransparent);
    }

    if (isTransparent) {
        inst._fillSwatches?.forEach(s =>
            s.classList.toggle('spp-color-swatch--active', s === inst._fillTransparentBtn));
    } else {
        syncSwatches(inst._fillSwatches, pixiToHex(fillPixi));
        inst._fillTransparentBtn?.classList.remove('spp-color-swatch--active');
    }
}

function _syncBorder(inst, props) {
    const bw = props.borderWidth ?? 1;
    if (inst._borderWidthSlider) {
        inst._borderWidthSlider.value = String(bw);
        if (inst._borderWidthVal) inst._borderWidthVal.textContent = String(bw);
    }

    const bop = typeof props.borderOpacity === 'number' ? props.borderOpacity : 1;
    if (inst._borderOpacitySlider) {
        inst._borderOpacitySlider.value = String(Math.round(bop * 100));
        if (inst._borderOpacityVal) inst._borderOpacityVal.textContent = `${Math.round(bop * 100)}%`;
    }

    updateBorderStyleBtns(inst, props.borderStyle || 'solid');

    const bcPixi = props.borderColor ?? 0xD4D4D4;
    if (inst._borderColorBtn) {
        inst._borderColorBtn.style.backgroundColor = pixiToHex(bcPixi);
    }
    syncSwatches(inst._borderSwatches, pixiToHex(bcPixi));
}

function _syncText(inst, text) {
    if (inst._fontSelect) {
        const family = text.fontFamily || FONT_OPTIONS[0].value;
        if ([...inst._fontSelect.options].some(o => o.value === family)) {
            inst._fontSelect.value = family;
        }
    }

    if (inst._sizeSelect) {
        const fsStr = String(text.fontSize || 16);
        if ([...inst._sizeSelect.options].some(o => o.value === fsStr)) {
            inst._sizeSelect.value = fsStr;
        }
    }

    if (inst._textColorBtn) {
        inst._textColorBtn.style.backgroundColor = text.color || '#111111';
    }

    if (inst._boldBtn) {
        inst._boldBtn.classList.toggle('spp-btn--active', !!text.bold);
    }

    setAlign(inst, text.textAlign || 'left');

    if (inst._listBtn) {
        inst._listBtn.classList.toggle('spp-btn--active', text.list === 'bullet');
    }

    if (inst._lhSelect) {
        const lhStr = String(text.lineHeight || 1.4);
        const found = [...inst._lhSelect.options].find(o => o.value === lhStr);
        if (found) inst._lhSelect.value = lhStr;
    }
}
