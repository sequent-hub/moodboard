/**
 * ColorPickerPopover — собственная HSV-палитра выбора цвета для панели свойств.
 * Возвращает DOM-элемент палитры и метод setHex для внешней синхронизации.
 *
 * onCommit(hex) вызывается при завершении выбора (отпускание указателя в SV-поле,
 * изменение hue-слайдера, ввод корректного HEX) — один вызов = одно применение.
 */

function hexToRgb(hex) {
    const m = String(hex).replace('#', '').trim();
    const n = m.length === 3 ? m.split('').map(c => c + c).join('') : m;
    const int = parseInt(n, 16);
    if (Number.isNaN(int) || n.length !== 6) return null;
    return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function rgbToHex(r, g, b) {
    const h = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
        if (h < 0) h += 360;
    }
    const s = max === 0 ? 0 : d / max;
    return { h, s, v: max };
}

function hsvToRgb(h, s, v) {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

const clamp01 = (n) => Math.max(0, Math.min(1, n));

export function createColorPicker(initialHex = '#FFFFFF', onCommit) {
    const startRgb = hexToRgb(initialHex) || { r: 255, g: 255, b: 255 };
    let { h, s, v } = rgbToHsv(startRgb.r, startRgb.g, startRgb.b);

    const el = document.createElement('div');
    el.className = 'spp-cp';

    const sv = document.createElement('div');
    sv.className = 'spp-cp-sv';
    const svPointer = document.createElement('div');
    svPointer.className = 'spp-cp-sv-pointer';
    sv.appendChild(svPointer);
    el.appendChild(sv);

    const hue = document.createElement('input');
    hue.type = 'range';
    hue.min = '0';
    hue.max = '360';
    hue.step = '1';
    hue.className = 'spp-cp-hue';
    el.appendChild(hue);

    const hexRow = document.createElement('div');
    hexRow.className = 'spp-cp-hex-row';
    const hexHash = document.createElement('span');
    hexHash.className = 'spp-cp-hex-hash';
    hexHash.textContent = '#';
    const hexInput = document.createElement('input');
    hexInput.type = 'text';
    hexInput.className = 'spp-cp-hex';
    hexInput.spellcheck = false;
    hexInput.maxLength = 6;
    hexRow.appendChild(hexHash);
    hexRow.appendChild(hexInput);
    el.appendChild(hexRow);

    function currentHex() {
        const { r, g, b } = hsvToRgb(h, s, v);
        return rgbToHex(r, g, b);
    }

    function renderUI() {
        const baseHue = hsvToRgb(h, 1, 1);
        sv.style.backgroundColor = rgbToHex(baseHue.r, baseHue.g, baseHue.b);
        svPointer.style.left = `${s * 100}%`;
        svPointer.style.top = `${(1 - v) * 100}%`;
        const hex = currentHex();
        svPointer.style.backgroundColor = hex;
        hue.value = String(Math.round(h));
        if (document.activeElement !== hexInput) {
            hexInput.value = hex.replace('#', '');
        }
    }

    function commit() {
        if (typeof onCommit === 'function') onCommit(currentHex());
    }

    let dragging = false;
    function applyFromEvent(e) {
        const rect = sv.getBoundingClientRect();
        const px = clamp01((e.clientX - rect.left) / rect.width);
        const py = clamp01((e.clientY - rect.top) / rect.height);
        s = px;
        v = 1 - py;
        renderUI();
    }

    const onMove = (e) => {
        if (!dragging) return;
        e.preventDefault();
        applyFromEvent(e);
    };
    const onUp = () => {
        if (!dragging) return;
        dragging = false;
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        commit();
    };

    sv.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragging = true;
        applyFromEvent(e);
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
    });

    hue.addEventListener('input', () => {
        h = parseInt(hue.value, 10) || 0;
        renderUI();
    });
    hue.addEventListener('change', () => {
        h = parseInt(hue.value, 10) || 0;
        renderUI();
        commit();
    });

    hexInput.addEventListener('input', () => {
        const rgb = hexToRgb(hexInput.value);
        if (!rgb) return;
        const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
        h = hsv.h; s = hsv.s; v = hsv.v;
        const baseHue = hsvToRgb(h, 1, 1);
        sv.style.backgroundColor = rgbToHex(baseHue.r, baseHue.g, baseHue.b);
        svPointer.style.left = `${s * 100}%`;
        svPointer.style.top = `${(1 - v) * 100}%`;
        svPointer.style.backgroundColor = currentHex();
        hue.value = String(Math.round(h));
    });
    hexInput.addEventListener('change', () => {
        const rgb = hexToRgb(hexInput.value);
        if (!rgb) { renderUI(); return; }
        renderUI();
        commit();
    });

    function setHex(hex) {
        const rgb = hexToRgb(hex);
        if (!rgb) return;
        const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
        h = hsv.h; s = hsv.s; v = hsv.v;
        renderUI();
    }

    function getHex() {
        return currentHex();
    }

    renderUI();

    return { el, setHex, getHex };
}
