const ACCENT = '#444CE7';
const DIM_COLOR = 'rgba(0,0,0,0.5)';

// Corner handles (L-bracket shape)
const CORNER_SIZE      = 12;  // px, bounding box side
const CORNER_THICKNESS = 3;   // px, line thickness

// Edge-midpoint handles (tick marks)
const TICK_LONG  = 18;  // px, along the edge
const TICK_SHORT = 4;   // px, perpendicular to the edge

const SELECTOR_HEIGHT = 32;  // px, высота Mask-селектора
const SELECTOR_GAP    = 8;   // px, отступ между селектором и верхним краем изображения

const TEMPLATE_LABELS = {
    custom:    'Произвольный',
    original:  'Оригинал',
    circle:    'Круг',
    square:    'Квадрат',
    portrait:  'Портрет',
    landscape: 'Пейзаж',
    wide:      'Широкий',
};

const TEMPLATE_ICONS = {
    custom:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="4 4"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`,
    original:  `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`,
    circle:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>`,
    square:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="1"/></svg>`,
    portrait:  `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="1"/></svg>`,
    landscape: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="1"/></svg>`,
    wide:      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="6" width="22" height="12" rx="1"/></svg>`,
};

const TEMPLATE_RATIOS = {
    portrait:  '3:4',
    landscape: '4:3',
    wide:      '16:9',
};

const CHEVRON_SVG = `<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke-width="2"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/></svg>`;

/**
 * DOM-оверлей режима кадрирования.
 *
 * Прикрепляется к container (тому же, что и ImagePropertiesPanel).
 * Покрывает весь контейнер; клик вне изображения и селектора → onCommit.
 *
 * @param {object} opts
 * @param {HTMLElement}     opts.container
 * @param {object}          opts.core
 * @param {{ x,y,w,h }}     opts.imgBounds  — world-координаты изображения
 * @param {{ x,y,w,h }}     opts.initCrop   — начальный кроп (нормализованный 0..1)
 * @param {string}          opts.template   — 'custom'|'circle'|'square'|'portrait'|'landscape'|'wide'
 * @param {number|null}     opts.aspectRatio
 * @param {function}        opts.onFormatChange(template)
 * @param {function}        opts.onCommit(cropNorm)
 * @param {function}        opts.onCancel()
 */
export class CropOverlay {
    constructor({ container, core, imgBounds, initCrop, template, aspectRatio, onFormatChange, onCommit, onCancel }) {
        this._container = container;
        this._core = core;
        this._imgBounds = { ...imgBounds };
        this._cropNorm = { ...initCrop };
        this._template = template;
        this._aspectRatio = aspectRatio;
        this._onFormatChange = onFormatChange || (() => {});
        this._onCommit = onCommit;
        this._onCancel = onCancel;

        this._el = null;
        this._imgArea = null;
        this._maskSelector = null;
        this._maskDropdown = null;
        this._maskLabel = null;
        this._dimTop = null;
        this._dimBottom = null;
        this._dimLeft = null;
        this._dimRight = null;
        this._frame = null;
        this._circleIndicator = null;
        this._handles = new Map();
        this._dragState = null;
        this._docPointerHandler = null;

        this._build();
    }

    // ─────────────────────────────────────────
    // Построение DOM
    // ─────────────────────────────────────────

    _build() {
        const el = document.createElement('div');
        el.className = 'mb-crop-overlay';
        Object.assign(el.style, {
            position:   'absolute',
            inset:      '0',
            zIndex:     '2000',
            cursor:     'default',
            userSelect: 'none',
        });
        this._el = el;

        // Область изображения — клики внутри не должны коммитить
        const imgArea = document.createElement('div');
        imgArea.className = 'mb-crop-img-area';
        Object.assign(imgArea.style, { position: 'absolute', pointerEvents: 'auto' });
        this._imgArea = imgArea;

        // Затемнение: 4 панели
        const mkDim = () => {
            const d = document.createElement('div');
            Object.assign(d.style, {
                position:      'absolute',
                background:    DIM_COLOR,
                pointerEvents: 'none',
            });
            return d;
        };
        this._dimTop    = mkDim();
        this._dimBottom = mkDim();
        this._dimLeft   = mkDim();
        this._dimRight  = mkDim();
        imgArea.appendChild(this._dimTop);
        imgArea.appendChild(this._dimBottom);
        imgArea.appendChild(this._dimLeft);
        imgArea.appendChild(this._dimRight);

        // Рамка кропа
        const frame = document.createElement('div');
        Object.assign(frame.style, {
            position:      'absolute',
            boxSizing:     'border-box',
            border:        `1px solid ${ACCENT}`,
            pointerEvents: 'none',
        });
        this._frame = frame;
        imgArea.appendChild(frame);

        // Индикатор для circle
        if (this._template === 'circle') {
            const ci = document.createElement('div');
            Object.assign(ci.style, {
                position:      'absolute',
                borderRadius:  '50%',
                border:        `1px dashed ${ACCENT}`,
                boxSizing:     'border-box',
                pointerEvents: 'none',
            });
            this._circleIndicator = ci;
            imgArea.appendChild(ci);
        }

        // 8 ручек (уголки + засечки)
        const dirs = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
        dirs.forEach(dir => {
            const h = document.createElement('div');
            Object.assign(h.style, this._handleStyle(dir));
            h.style.position = 'absolute';
            h.style.zIndex   = '1';
            h.style.cursor   = this._cursorFor(dir);
            h.style.boxSizing = 'border-box';
            h.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                this._startDrag(e, dir);
            });
            this._handles.set(dir, h);
            imgArea.appendChild(h);
        });

        el.appendChild(imgArea);

        // Mask-селектор над изображением
        this._maskSelector = this._buildMaskSelector();
        el.appendChild(this._maskSelector);

        this._container.appendChild(el);

        // Клик вне imgArea и вне maskSelector → commit.
        // Capture-фаза, чтобы сработать раньше PIXI.
        this._docPointerHandler = (e) => {
            if (!this._imgArea || !this._el) return;
            if (this._imgArea.contains(e.target)) return;
            if (this._maskSelector && this._maskSelector.contains(e.target)) return;
            // Клик в любом месте за пределами изображения и селектора → коммитим
            document.removeEventListener('pointerdown', this._docPointerHandler, { capture: true });
            this._docPointerHandler = null;
            this._onCommit({ ...this._cropNorm });
        };
        document.addEventListener('pointerdown', this._docPointerHandler, { capture: true });

        this.reposition(this._imgBounds);
    }

    _buildMaskSelector() {
        const sel = document.createElement('div');
        sel.className = 'mb-crop-mask-selector';
        Object.assign(sel.style, {
            position:        'absolute',
            display:         'inline-flex',
            alignItems:      'center',
            gap:             '4px',
            background:      '#fff',
            border:          '1px solid #E5E7EB',
            borderRadius:    '8px',
            padding:         '4px 8px 4px 10px',
            boxShadow:       '0 2px 8px rgba(0,0,0,0.12)',
            cursor:          'pointer',
            zIndex:          '2001',
            fontSize:        '12px',
            fontFamily:      'inherit',
            lineHeight:      '1',
            whiteSpace:      'nowrap',
            userSelect:      'none',
        });

        // Текущий формат
        const formatLabel = document.createElement('span');
        Object.assign(formatLabel.style, {
            color:      '#111827',
            fontWeight: '600',
        });
        formatLabel.textContent = TEMPLATE_LABELS[this._template] || this._template;
        this._maskLabel = formatLabel;

        // Стрелка
        const chevron = document.createElement('span');
        Object.assign(chevron.style, {
            color:        '#6B7280',
            display:      'flex',
            alignItems:   'center',
            marginLeft:   '2px',
            transition:   'transform 0.15s',
        });
        chevron.innerHTML = CHEVRON_SVG;
        this._maskChevron = chevron;

        sel.appendChild(formatLabel);
        sel.appendChild(chevron);

        // Дропдаун
        const dropdown = this._buildMaskDropdown();
        sel.appendChild(dropdown);
        this._maskDropdown = dropdown;

        sel.addEventListener('pointerdown', (e) => {
            e.stopPropagation(); // не даём capture-обработчику сработать
        });

        sel.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = dropdown.style.display !== 'none';
            this._closeMaskDropdown();
            if (!isOpen) {
                dropdown.style.display = 'block';
                chevron.style.transform = 'rotate(180deg)';
            }
        });

        return sel;
    }

    _buildMaskDropdown() {
        const dd = document.createElement('div');
        Object.assign(dd.style, {
            display:      'none',
            position:     'absolute',
            top:          'calc(100% + 4px)',
            left:         '0',
            background:   '#fff',
            border:       '1px solid #E5E7EB',
            borderRadius: '10px',
            boxShadow:    '0 4px 16px rgba(0,0,0,0.14)',
            padding:      '4px 0',
            minWidth:     '160px',
            zIndex:       '2002',
        });

        const items = [
            { id: 'custom',    label: 'Произвольный' },
            { id: 'original',  label: 'Оригинал' },
            { divider: true },
            { id: 'circle',    label: 'Круг' },
            { id: 'square',    label: 'Квадрат' },
            { id: 'portrait',  label: 'Портрет',  ratio: '3:4' },
            { id: 'landscape', label: 'Пейзаж', ratio: '4:3' },
            { id: 'wide',      label: 'Широкий',  ratio: '16:9' },
        ];

        items.forEach(item => {
            if (item.divider) {
                const sep = document.createElement('div');
                Object.assign(sep.style, {
                    height:     '1px',
                    background: '#F3F4F6',
                    margin:     '4px 0',
                });
                dd.appendChild(sep);
                return;
            }

            const btn = document.createElement('button');
            Object.assign(btn.style, {
                display:        'flex',
                alignItems:     'center',
                gap:            '8px',
                width:          '100%',
                padding:        '7px 12px',
                background:     item.id === this._template ? '#F5F3FF' : 'transparent',
                border:         'none',
                cursor:         'pointer',
                fontSize:       '13px',
                color:          '#111827',
                textAlign:      'left',
                fontFamily:     'inherit',
                borderRadius:   '0',
            });

            const iconSpan = document.createElement('span');
            Object.assign(iconSpan.style, { color: '#6B7280', display: 'flex', flexShrink: '0' });
            iconSpan.innerHTML = TEMPLATE_ICONS[item.id] || '';

            const labelSpan = document.createElement('span');
            labelSpan.style.flex = '1';
            labelSpan.textContent = item.label;

            btn.appendChild(iconSpan);
            btn.appendChild(labelSpan);

            if (item.ratio) {
                const ratioSpan = document.createElement('span');
                Object.assign(ratioSpan.style, { color: '#9CA3AF', fontSize: '11px', marginLeft: 'auto' });
                ratioSpan.textContent = item.ratio;
                btn.appendChild(ratioSpan);
            }

            btn.addEventListener('pointerdown', (e) => e.stopPropagation());
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._closeMaskDropdown();
                this._onFormatChange(item.id);
            });

            btn.addEventListener('mouseenter', () => {
                if (item.id !== this._template) {
                    btn.style.background = '#F9FAFB';
                }
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.background = item.id === this._template ? '#F5F3FF' : 'transparent';
            });

            dd.appendChild(btn);
        });

        return dd;
    }

    _closeMaskDropdown() {
        if (this._maskDropdown) {
            this._maskDropdown.style.display = 'none';
        }
        if (this._maskChevron) {
            this._maskChevron.style.transform = 'rotate(0deg)';
        }
    }

    // Стиль ручки в зависимости от направления
    _handleStyle(dir) {
        const borderLine = `${CORNER_THICKNESS}px solid ${ACCENT}`;
        const corners = {
            nw: { borderTop: borderLine, borderLeft:   borderLine, borderBottom: 'none', borderRight: 'none', width: `${CORNER_SIZE}px`, height: `${CORNER_SIZE}px`, background: 'transparent' },
            ne: { borderTop: borderLine, borderRight:  borderLine, borderBottom: 'none', borderLeft:  'none', width: `${CORNER_SIZE}px`, height: `${CORNER_SIZE}px`, background: 'transparent' },
            se: { borderBottom: borderLine, borderRight: borderLine, borderTop: 'none',  borderLeft:  'none', width: `${CORNER_SIZE}px`, height: `${CORNER_SIZE}px`, background: 'transparent' },
            sw: { borderBottom: borderLine, borderLeft:  borderLine, borderTop: 'none',  borderRight: 'none', width: `${CORNER_SIZE}px`, height: `${CORNER_SIZE}px`, background: 'transparent' },
        };
        if (corners[dir]) return corners[dir];

        // Засечки для середин рёбер
        const isHorizontal = dir === 'n' || dir === 's';
        return {
            width:        isHorizontal ? `${TICK_LONG}px`  : `${TICK_SHORT}px`,
            height:       isHorizontal ? `${TICK_SHORT}px` : `${TICK_LONG}px`,
            background:   ACCENT,
            border:       'none',
            borderRadius: `${TICK_SHORT / 2}px`,
        };
    }

    _cursorFor(dir) {
        const map = {
            nw: 'nw-resize', n: 'n-resize', ne: 'ne-resize',
            e:  'e-resize',  se: 'se-resize', s: 's-resize',
            sw: 'sw-resize', w: 'w-resize',
        };
        return map[dir] || 'crosshair';
    }

    // Ширина/высота хит-зоны ручки для центрирования
    _handleHalfW(dir) {
        if (['nw', 'ne', 'se', 'sw'].includes(dir)) return CORNER_SIZE / 2;
        if (dir === 'n' || dir === 's') return TICK_LONG / 2;
        return TICK_SHORT / 2;
    }
    _handleHalfH(dir) {
        if (['nw', 'ne', 'se', 'sw'].includes(dir)) return CORNER_SIZE / 2;
        if (dir === 'e' || dir === 'w') return TICK_LONG / 2;
        return TICK_SHORT / 2;
    }

    // ─────────────────────────────────────────
    // Позиционирование
    // ─────────────────────────────────────────

    reposition(imgBounds) {
        if (!this._el) return;
        if (imgBounds) this._imgBounds = { ...imgBounds };

        const worldLayer = this._core?.pixi?.worldLayer;
        if (!worldLayer) return;

        const scale = worldLayer.scale?.x || 1;
        const wx    = worldLayer.x || 0;
        const wy    = worldLayer.y || 0;

        const { x: iWx, y: iWy, w: iWw, h: iWh } = this._imgBounds;

        // Экранные координаты изображения (относительно container)
        const iL = Math.round(iWx * scale + wx);
        const iT = Math.round(iWy * scale + wy);
        const iW = Math.round(iWw * scale);
        const iH = Math.round(iWh * scale);

        // Экранные координаты кропа
        const { x: cx, y: cy, w: cw, h: ch } = this._cropNorm;
        const cL = Math.round(iL + cx * iW);
        const cT = Math.round(iT + cy * iH);
        const cW = Math.max(1, Math.round(cw * iW));
        const cH = Math.max(1, Math.round(ch * iH));

        // imgArea
        this._setRect(this._imgArea, iL, iT, iW, iH);

        // Dims (координаты относительно imgArea)
        this._setRect(this._dimTop,    0,            0,            iW,                   cT - iT);
        this._setRect(this._dimBottom, 0,            cT - iT + cH, iW,                   iH - (cT - iT + cH));
        this._setRect(this._dimLeft,   0,            cT - iT,      cL - iL,              cH);
        this._setRect(this._dimRight,  cL - iL + cW, cT - iT,      iW - (cL - iL + cW), cH);

        // Frame
        this._setRect(this._frame, cL - iL, cT - iT, cW, cH);

        // Circle indicator
        if (this._circleIndicator) {
            const r   = Math.min(cW, cH) / 2;
            const ciL = cL - iL + cW / 2 - r;
            const ciT = cT - iT + cH / 2 - r;
            this._setRect(this._circleIndicator, ciL, ciT, r * 2, r * 2);
        }

        // 8 ручек — позиции относительно imgArea
        const hx = cL - iL;
        const hy = cT - iT;
        const hPositions = {
            nw: [hx,          hy         ],
            n:  [hx + cW / 2, hy         ],
            ne: [hx + cW,     hy         ],
            e:  [hx + cW,     hy + cH / 2],
            se: [hx + cW,     hy + cH    ],
            s:  [hx + cW / 2, hy + cH    ],
            sw: [hx,          hy + cH    ],
            w:  [hx,          hy + cH / 2],
        };
        this._handles.forEach((h, dir) => {
            const [sx, sy] = hPositions[dir];
            h.style.left = `${Math.round(sx - this._handleHalfW(dir))}px`;
            h.style.top  = `${Math.round(sy - this._handleHalfH(dir))}px`;
        });

        // Mask-селектор: над изображением, по горизонтальному центру
        if (this._maskSelector) {
            const selTop = iT - SELECTOR_HEIGHT - SELECTOR_GAP;
            this._maskSelector.style.left      = `${iL + Math.round(iW / 2)}px`;
            this._maskSelector.style.transform = 'translateX(-50%)';
            this._maskSelector.style.top       = `${Math.max(0, selTop)}px`;
        }
    }

    _setRect(el, left, top, width, height) {
        el.style.left   = `${Math.round(left)}px`;
        el.style.top    = `${Math.round(top)}px`;
        el.style.width  = `${Math.max(0, Math.round(width))}px`;
        el.style.height = `${Math.max(0, Math.round(height))}px`;
    }

    // ─────────────────────────────────────────
    // Перетаскивание ручек
    // ─────────────────────────────────────────

    _startDrag(e, dir) {
        e.preventDefault();
        const worldLayer = this._core?.pixi?.worldLayer;
        this._dragState = {
            dir,
            startX:    e.clientX,
            startY:    e.clientY,
            startCrop: { ...this._cropNorm },
            scale:     worldLayer?.scale?.x || 1,
        };

        const onMove = (me) => this._onDragMove(me);
        const onUp   = () => {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            this._dragState = null;
        };
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
    }

    _onDragMove(e) {
        if (!this._dragState) return;
        const { dir, startX, startY, startCrop, scale } = this._dragState;

        // Дельта в нормализованном пространстве изображения
        const dxN = (e.clientX - startX) / scale / this._imgBounds.w;
        const dyN = (e.clientY - startY) / scale / this._imgBounds.h;

        let { x: cx, y: cy, w: cw, h: ch } = startCrop;
        const AR = this._aspectRatio;

        if (AR) {
            // ── Кроп с зафиксированным соотношением сторон ──────────────
            const imgAR  = this._imgBounds.w / this._imgBounds.h;
            const normAR = AR / imgAR;

            switch (dir) {
                case 'nw': {
                    const oldBRx = cx + cw, oldBRy = cy + ch;
                    const newW = Math.max(0.02, cw - dxN);
                    const newH = newW / normAR;
                    cw = newW; ch = newH;
                    cx = oldBRx - cw; cy = oldBRy - ch;
                    break;
                }
                case 'ne': {
                    const oldBLy = cy + ch;
                    const newW = Math.max(0.02, cw + dxN);
                    const newH = newW / normAR;
                    cw = newW; ch = newH;
                    cy = oldBLy - ch;
                    break;
                }
                case 'sw': {
                    const oldTRx = cx + cw;
                    const newW = Math.max(0.02, cw - dxN);
                    const newH = newW / normAR;
                    cw = newW; ch = newH;
                    cx = oldTRx - cw;
                    break;
                }
                case 'se': {
                    const newW = Math.max(0.02, cw + dxN);
                    cw = newW;
                    ch = newW / normAR;
                    break;
                }
                case 'e': {
                    const centerY = cy + ch / 2;
                    const newW    = Math.max(0.02, cw + dxN);
                    const newH    = newW / normAR;
                    cw = newW; ch = newH;
                    cy = centerY - ch / 2;
                    break;
                }
                case 'w': {
                    const oldRight = cx + cw;
                    const centerY  = cy + ch / 2;
                    const newW     = Math.max(0.02, cw - dxN);
                    const newH     = newW / normAR;
                    cw = newW; ch = newH;
                    cx = oldRight - cw;
                    cy = centerY - ch / 2;
                    break;
                }
                case 's': {
                    const centerX = cx + cw / 2;
                    const newH    = Math.max(0.02, ch + dyN);
                    const newW    = newH * normAR;
                    ch = newH; cw = newW;
                    cx = centerX - cw / 2;
                    break;
                }
                case 'n': {
                    const oldBottom = cy + ch;
                    const centerX   = cx + cw / 2;
                    const newH      = Math.max(0.02, ch - dyN);
                    const newW      = newH * normAR;
                    ch = newH; cw = newW;
                    cy = oldBottom - ch;
                    cx = centerX - cw / 2;
                    break;
                }
            }
        } else {
            // ── Свободный кроп (Custom) ──────────────────────────────────
            switch (dir) {
                case 'nw': cx += dxN; cy += dyN; cw -= dxN; ch -= dyN; break;
                case 'ne':            cy += dyN; cw += dxN; ch -= dyN; break;
                case 'sw': cx += dxN;            cw -= dxN; ch += dyN; break;
                case 'se':                       cw += dxN; ch += dyN; break;
                case 'n':             cy += dyN;             ch -= dyN; break;
                case 's':                                    ch += dyN; break;
                case 'w':  cx += dxN;            cw -= dxN;            break;
                case 'e':                        cw += dxN;             break;
            }
        }

        // Минимальный размер и зажим в [0..1]
        const minW = Math.max(0.01, 20 / this._imgBounds.w);
        const minH = Math.max(0.01, 20 / this._imgBounds.h);
        cw = Math.max(minW, cw);
        ch = Math.max(minH, ch);
        cx = Math.max(0, Math.min(cx, 1 - cw));
        cy = Math.max(0, Math.min(cy, 1 - ch));
        cw = Math.min(cw, 1 - cx);
        ch = Math.min(ch, 1 - cy);

        this._cropNorm = { x: cx, y: cy, w: cw, h: ch };
        this.reposition();
    }

    // ─────────────────────────────────────────
    // Уничтожение
    // ─────────────────────────────────────────

    destroy() {
        if (this._docPointerHandler) {
            document.removeEventListener('pointerdown', this._docPointerHandler, { capture: true });
            this._docPointerHandler = null;
        }
        if (this._el && this._el.parentNode) {
            this._el.parentNode.removeChild(this._el);
        }
        this._el          = null;
        this._imgArea     = null;
        this._maskSelector = null;
        this._maskDropdown = null;
        this._handles.clear();
        this._dragState = null;
    }
}
