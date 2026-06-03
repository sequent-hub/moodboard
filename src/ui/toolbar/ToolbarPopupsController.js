import { Events } from '../../core/events/Events.js';
import { getInlinePngEmojiUrl } from '../../utils/inlinePngEmojis.js';

export class ToolbarPopupsController {
    constructor(toolbar) {
        this.toolbar = toolbar;
    }

    createFramePopup() {
        this.toolbar.framePopupEl = document.createElement('div');
        this.toolbar.framePopupEl.className = 'moodboard-toolbar__popup frame-popup';
        this.toolbar.framePopupEl.style.display = 'none';

        const makeBtn = (label, id, enabled, aspect, options = {}) => {
            const btn = document.createElement('button');
            btn.className = 'frame-popup__btn' + (enabled ? '' : ' is-disabled') + (options.header ? ' frame-popup__btn--header' : '');
            btn.dataset.id = id;
            const holder = document.createElement('div');
            holder.className = 'frame-popup__holder';
            let preview = document.createElement('div');
            if (options.header) {
                preview.className = 'frame-popup__preview frame-popup__preview--custom';
            } else {
                preview.className = 'frame-popup__preview';
                preview.style.aspectRatio = aspect || '1 / 1';
            }
            const caption = document.createElement('div');
            caption.textContent = label;
            caption.className = 'frame-popup__caption';
            holder.appendChild(preview);
            holder.appendChild(caption);
            btn.appendChild(holder);
            if (enabled) {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toolbar.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'place' });
                    this.toolbar.placeSelectedButtonId = 'frame';
                    this.toolbar.setActiveToolbarButton('place');
                    if (id === 'custom') {
                        this.toolbar.eventBus.emit(Events.Place.Set, { type: 'frame-draw', properties: {} });
                    } else {
                        let width = 210;
                        let height = 297;
                        let titleText = 'A4';
                        if (id === '1x1') {
                            width = 300;
                            height = 300;
                            titleText = '1:1';
                        } else if (id === '4x3') {
                            width = 320;
                            height = 240;
                            titleText = '4:3';
                        } else if (id === '16x9') {
                            width = 320;
                            height = 180;
                            titleText = '16:9';
                        }
                        const scale = 2;
                        width = Math.round(width * scale);
                        height = Math.round(height * scale);
                        this.toolbar.eventBus.emit(Events.Place.Set, {
                            type: 'frame',
                            properties: {
                                width,
                                height,
                                borderColor: 0x333333,
                                fillColor: 0xFFFFFF,
                                title: titleText,
                                lockedAspect: true,
                                type: id
                            }
                        });
                    }
                    this.closeFramePopup();
                });
            }
            this.toolbar.framePopupEl.appendChild(btn);
        };

        makeBtn('Произвольный', 'custom', true, 'none', { header: true });
        makeBtn('A4', 'a4', true, '210 / 297');
        makeBtn('1:1', '1x1', true, '1 / 1');
        makeBtn('4:3', '4x3', true, '4 / 3');
        makeBtn('16:9', '16x9', true, '16 / 9');

        this.toolbar.container.appendChild(this.toolbar.framePopupEl);
    }

    toggleFramePopup(anchorBtn) {
        if (!this.toolbar.framePopupEl) return;
        const visible = this.toolbar.framePopupEl.style.display !== 'none';
        if (visible) {
            this.closeFramePopup();
            return;
        }
        const buttonRect = anchorBtn.getBoundingClientRect();
        const toolbarRect = this.toolbar.container.getBoundingClientRect();
        this.toolbar.framePopupEl.style.display = 'grid';
        this.toolbar.framePopupEl.style.visibility = 'hidden';
        const panelH = this.toolbar.framePopupEl.offsetHeight || 120;
        const targetLeft = this.toolbar.element.offsetWidth + 8;
        const btnCenterY = buttonRect.top + buttonRect.height / 2;
        const targetTop = Math.max(0, Math.round(btnCenterY - toolbarRect.top - panelH / 2 - 4));
        this.toolbar.framePopupEl.style.left = `${Math.round(targetLeft)}px`;
        this.toolbar.framePopupEl.style.top = `${targetTop}px`;
        this.toolbar.framePopupEl.style.visibility = '';
    }

    closeFramePopup() {
        if (this.toolbar.framePopupEl) this.toolbar.framePopupEl.style.display = 'none';
    }

    createShapesPopup() {
        this.toolbar.shapesPopupEl = document.createElement('div');
        this.toolbar.shapesPopupEl.className = 'moodboard-toolbar__popup moodboard-toolbar__popup--shapes';
        this.toolbar.shapesPopupEl.style.display = 'none';

        const grid = document.createElement('div');
        grid.className = 'moodboard-shapes__grid';

        const shapes = [
            { id: 'shape', title: 'Добавить фигуру', isToolbarAction: true },
            { id: 'rounded-square', title: 'Скругленный квадрат' },
            { id: 'circle', title: 'Круг' },
            { id: 'triangle', title: 'Треугольник' },
            { id: 'diamond', title: 'Ромб' },
            { id: 'parallelogram', title: 'Параллелограмм' },
            { id: 'arrow', title: 'Стрелка' }
        ];

        shapes.forEach((s) => {
            const btn = document.createElement('button');
            btn.className = `moodboard-shapes__btn moodboard-shapes__btn--${s.id}`;
            btn.title = s.title;
            const icon = document.createElement('span');
            if (s.isToolbarAction) {
                icon.className = 'moodboard-shapes__icon shape-square';
            } else {
                icon.className = `moodboard-shapes__icon shape-${s.id}`;
                if (s.id === 'arrow') {
                    icon.innerHTML = '<svg width="18" height="12" viewBox="0 0 18 12" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="0" y="5" width="12" height="2" rx="1" fill="#94a3b8"/><path d="M12 0 L18 6 L12 12 Z" fill="#94a3b8"/></svg>';
                }
            }
            btn.appendChild(icon);
            btn.addEventListener('click', () => {
                this.toolbar.animateButton(btn);
                if (s.isToolbarAction) {
                    this.toolbar.eventBus.emit(Events.Place.Set, { type: 'shape', properties: { kind: 'square' } });
                    this.closeShapesPopup();
                    return;
                }
                const propsMap = {
                    'rounded-square': { kind: 'rounded', cornerRadius: 10 },
                    circle: { kind: 'circle' },
                    triangle: { kind: 'triangle' },
                    diamond: { kind: 'diamond' },
                    parallelogram: { kind: 'parallelogram' },
                    arrow: { kind: 'arrow' }
                };
                const props = propsMap[s.id] || { kind: 'square' };
                this.toolbar.eventBus.emit(Events.Place.Set, { type: 'shape', properties: props });
                this.closeShapesPopup();
            });
            grid.appendChild(btn);
        });

        this.toolbar.shapesPopupEl.appendChild(grid);
        this.toolbar.container.appendChild(this.toolbar.shapesPopupEl);
    }

    toggleShapesPopup(anchorButton) {
        if (!this.toolbar.shapesPopupEl) return;
        if (this.toolbar.shapesPopupEl.style.display === 'none') {
            this.openShapesPopup(anchorButton);
        } else {
            this.closeShapesPopup();
        }
    }

    openShapesPopup(anchorButton) {
        if (!this.toolbar.shapesPopupEl) return;
        const toolbarRect = this.toolbar.container.getBoundingClientRect();
        const buttonRect = anchorButton.getBoundingClientRect();
        const top = buttonRect.top - toolbarRect.top - 4;
        const left = this.toolbar.element.offsetWidth + 8;
        this.toolbar.shapesPopupEl.style.top = `${Math.round(top)}px`;
        this.toolbar.shapesPopupEl.style.left = `${Math.round(left)}px`;
        this.toolbar.shapesPopupEl.style.display = 'block';
    }

    closeShapesPopup() {
        if (this.toolbar.shapesPopupEl) {
            this.toolbar.shapesPopupEl.style.display = 'none';
        }
    }

    createDrawPopup() {
        this.toolbar.drawPopupEl = document.createElement('div');
        this.toolbar.drawPopupEl.className = 'moodboard-toolbar__popup moodboard-toolbar__popup--draw';
        this.toolbar.drawPopupEl.style.display = 'none';

        const panel = document.createElement('div');
        panel.className = 'moodboard-draw__panel';

        // ── Ряд 1: инструменты ──────────────────────────────────────────────────
        const TOOL_SVG = {
            pencil: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>',
            marker: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1 1 2.48 1.02 3.5 1.02 2.2 0 3-1.8 3-3.02 0-1.67-1.33-3.04-1.5-3.04z"/></svg>',
            eraser: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>',
            laser: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"/><path d="M12 2v3"/><path d="m4.93 4.93 2.12 2.12"/><path d="M2 12h3"/><path d="m4.93 19.07 2.12-2.12"/><path d="M12 19v3"/><path d="m19.07 19.07-2.12-2.12"/><path d="M22 12h-3"/><path d="m19.07 4.93-2.12 2.12"/></svg>'
        };

        const toolDefs = [
            { id: 'pencil-tool', tool: 'pencil', title: 'Карандаш' },
            { id: 'marker-tool', tool: 'marker', title: 'Маркер' },
            { id: 'eraser-tool', tool: 'eraser', title: 'Ластик' }
        ];

        const toolRow = document.createElement('div');
        toolRow.className = 'moodboard-draw__tool-row';
        this.toolbar.drawRow1 = toolRow;

        toolDefs.forEach((t) => {
            const btn = document.createElement('button');
            btn.className = `moodboard-draw__btn moodboard-draw__btn--${t.id}`;
            btn.title = t.title;
            const icon = document.createElement('span');
            icon.className = 'draw-icon';
            icon.innerHTML = TOOL_SVG[t.tool];
            btn.appendChild(icon);
            btn.addEventListener('click', () => {
                this.toolbar.animateButton(btn);
                toolRow.querySelectorAll('.moodboard-draw__btn--active').forEach((el) => el.classList.remove('moodboard-draw__btn--active'));
                btn.classList.add('moodboard-draw__btn--active');

                this.toolbar.currentDrawTool = t.tool;
                this.toolbar.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'draw' });
                this.toolbar.eventBus.emit(Events.Draw.BrushSet, { mode: t.tool });
                this._updateDrawPanelForTool(t.tool);
            });
            toolRow.appendChild(btn);
        });
        panel.appendChild(toolRow);

        // ── Слайдер толщины ──────────────────────────────────────────────────────
        const thicknessSection = document.createElement('div');
        thicknessSection.className = 'moodboard-draw__section moodboard-draw__section--thickness';

        const thicknessHeader = document.createElement('div');
        thicknessHeader.className = 'moodboard-draw__section-header';
        const thicknessLabel = document.createElement('span');
        thicknessLabel.textContent = 'Толщина';
        thicknessLabel.className = 'moodboard-draw__section-label';
        const thicknessValue = document.createElement('span');
        thicknessValue.textContent = '2px';
        thicknessValue.className = 'moodboard-draw__thickness-value';
        thicknessHeader.appendChild(thicknessLabel);
        thicknessHeader.appendChild(thicknessValue);

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '1';
        slider.max = '24';
        slider.value = '2';
        slider.className = 'moodboard-draw__slider';
        slider.addEventListener('input', () => {
            const w = parseInt(slider.value, 10);
            thicknessValue.textContent = `${w}px`;
            this.toolbar.eventBus.emit(Events.Draw.BrushSet, { width: w });
        });

        thicknessSection.appendChild(thicknessHeader);
        thicknessSection.appendChild(slider);
        panel.appendChild(thicknessSection);
        this.toolbar._drawThicknessSlider = slider;
        this.toolbar._drawThicknessValue = thicknessValue;

        // ── Палитра цветов ───────────────────────────────────────────────────────
        const colorSection = document.createElement('div');
        colorSection.className = 'moodboard-draw__section';

        const PALETTE = [
            '#111827', '#374151', '#9ca3af', '#d1d5db', '#ffffff',
            '#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6',
            '#fca5a5', '#fdba74', '#fde68a', '#86efac', '#93c5fd',
            '#f9a8d4', '#e9d5ff', '#c4b5fd', '#a5f3fc', '#bfdbfe'
        ];

        const colorGrid = document.createElement('div');
        colorGrid.className = 'moodboard-draw__color-grid';

        PALETTE.forEach((hex) => {
            const btn = document.createElement('button');
            btn.className = 'moodboard-draw__color-btn';
            btn.title = hex;
            btn.style.background = hex;
            if (hex === '#ffffff') btn.style.border = '1.5px solid #d1d5db';
            btn.addEventListener('click', () => {
                colorGrid.querySelectorAll('.moodboard-draw__color-btn--active').forEach((el) => el.classList.remove('moodboard-draw__color-btn--active'));
                customColorBtn.classList.remove('moodboard-draw__color-btn--active');
                btn.classList.add('moodboard-draw__color-btn--active');
                const color = parseInt(hex.replace('#', ''), 16);
                this.toolbar.eventBus.emit(Events.Draw.BrushSet, { color });
            });
            colorGrid.appendChild(btn);
        });

        // Кастомный пикер (радужный кружок)
        const customColorBtn = document.createElement('button');
        customColorBtn.className = 'moodboard-draw__color-btn moodboard-draw__color-btn--custom';
        customColorBtn.title = 'Выбрать цвет';
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = '#000000';
        colorInput.className = 'moodboard-draw__color-input';
        colorInput.addEventListener('input', () => {
            colorGrid.querySelectorAll('.moodboard-draw__color-btn--active').forEach((el) => el.classList.remove('moodboard-draw__color-btn--active'));
            customColorBtn.classList.add('moodboard-draw__color-btn--active');
            const color = parseInt(colorInput.value.replace('#', ''), 16);
            this.toolbar.eventBus.emit(Events.Draw.BrushSet, { color });
        });
        customColorBtn.appendChild(colorInput);
        customColorBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            colorInput.click();
        });
        colorGrid.appendChild(customColorBtn);

        colorSection.appendChild(colorGrid);
        panel.appendChild(colorSection);

        this.toolbar.drawPopupEl.appendChild(panel);
        this.toolbar.container.appendChild(this.toolbar.drawPopupEl);

        // Метод для скрытия/показа секций в зависимости от инструмента
        this._updateDrawPanelForTool = (tool) => {
            const showControls = tool !== 'eraser';
            thicknessSection.style.display = '';
            colorSection.style.display = showControls ? '' : 'none';
        };

        // Начальное состояние — карандаш активен
        const pencilBtn = toolRow.querySelector('.moodboard-draw__btn--pencil-tool');
        if (pencilBtn) pencilBtn.classList.add('moodboard-draw__btn--active');
        this.toolbar.currentDrawTool = 'pencil';
        this.toolbar.eventBus.emit(Events.Draw.BrushSet, { mode: 'pencil', width: 2, color: 0x111827 });
        this._updateDrawPanelForTool('pencil');
        // Выделяем первый цвет (чёрный)
        const firstColorBtn = colorGrid.querySelector('.moodboard-draw__color-btn');
        if (firstColorBtn) firstColorBtn.classList.add('moodboard-draw__color-btn--active');
    }

    toggleDrawPopup(anchorButton) {
        if (!this.toolbar.drawPopupEl) return;
        if (this.toolbar.drawPopupEl.style.display === 'none') {
            this.openDrawPopup(anchorButton);
        } else {
            this.closeDrawPopup();
        }
    }

    openDrawPopup(anchorButton) {
        if (!this.toolbar.drawPopupEl) return;
        const toolbarRect = this.toolbar.container.getBoundingClientRect();
        const buttonRect = anchorButton.getBoundingClientRect();
        const top = buttonRect.top - toolbarRect.top - 4;
        const left = this.toolbar.element.offsetWidth + 8;
        this.toolbar.drawPopupEl.style.top = `${Math.round(top)}px`;
        this.toolbar.drawPopupEl.style.left = `${Math.round(left)}px`;
        this.toolbar.drawPopupEl.style.display = 'block';
    }

    closeDrawPopup() {
        if (this.toolbar.drawPopupEl) {
            this.toolbar.drawPopupEl.style.display = 'none';
        }
    }

    createEmojiPopup() {
        this.toolbar.emojiPopupEl = document.createElement('div');
        this.toolbar.emojiPopupEl.className = 'moodboard-toolbar__popup moodboard-toolbar__popup--emoji';
        this.toolbar.emojiPopupEl.style.display = 'none';

        let groups = new Map();
        let convertedCount = 0;

        if (typeof import.meta !== 'undefined' && import.meta.glob) {
            const modules = import.meta.glob('../assets/emodji/**/*.{png,PNG,svg,SVG}', { eager: true, query: '?url', import: 'default' });
            const entries = Object.entries(modules).sort(([a], [b]) => a.localeCompare(b));
            entries.forEach(([path, url]) => {
                const marker = '/emodji/';
                const idx = path.indexOf(marker);
                let category = 'Разное';
                if (idx >= 0) {
                    const after = path.slice(idx + marker.length);
                    const parts = after.split('/');
                    category = parts.length > 1 ? parts[0] : 'Разное';
                }

                const fileName = path.split('/').pop();
                const emojiCode = fileName.split('.')[0];
                const inlineUrl = getInlinePngEmojiUrl(emojiCode);

                if (inlineUrl) {
                    if (!groups.has(category)) groups.set(category, []);
                    groups.get(category).push({
                        path: `inline:${emojiCode}`,
                        url: inlineUrl,
                        isInline: true,
                        emojiCode: emojiCode
                    });
                    convertedCount++;
                } else {
                    if (!groups.has(category)) groups.set(category, []);
                    groups.get(category).push({ path, url, isInline: false });
                    console.warn(`⚠️ Нет встроенного PNG для ${emojiCode}, используем файл`);
                }
            });
        } else {
            const fallbackGroups = this.getFallbackEmojiGroups();
            fallbackGroups.forEach((items, category) => {
                if (!groups.has(category)) groups.set(category, []);
                groups.get(category).push(...items);
                convertedCount += items.filter((item) => item.isInline).length;
            });
        }

        const ORDER = ['Смайлики', 'Жесты', 'Женские эмоции', 'Котики', 'Обезьянка', 'Разное'];
        const present = [...groups.keys()];
        const orderedFirst = ORDER.filter((name) => groups.has(name));
        const theRest = present.filter((name) => !ORDER.includes(name)).sort((a, b) => a.localeCompare(b));
        const orderedCategories = [...orderedFirst, ...theRest];

        orderedCategories.forEach((cat) => {
            const section = document.createElement('div');
            section.className = 'moodboard-emoji__section';

            const title = document.createElement('div');
            title.className = 'moodboard-emoji__title';
            title.textContent = cat;
            section.appendChild(title);

            const grid = document.createElement('div');
            grid.className = 'moodboard-emoji__grid';

            groups.get(cat).forEach(({ url, isInline, emojiCode }) => {
                const btn = document.createElement('button');
                btn.className = 'moodboard-emoji__btn';
                btn.title = isInline ? `Встроенный PNG: ${emojiCode}` : 'Добавить изображение';
                const img = document.createElement('img');
                img.className = 'moodboard-emoji__img';
                img.src = url;
                img.alt = emojiCode || '';
                btn.appendChild(img);

                btn.addEventListener('mousedown', (e) => {
                    if (btn.__clickProcessing || btn.__dragActive) return;

                    const startX = e.clientX;
                    const startY = e.clientY;
                    let startedDrag = false;

                    const onMove = (ev) => {
                        if (startedDrag) return;
                        const dx = Math.abs(ev.clientX - startX);
                        const dy = Math.abs(ev.clientY - startY);
                        if (dx > 4 || dy > 4) {
                            startedDrag = true;
                            btn.__dragActive = true;
                            btn.__clickProcessing = true;

                            const target = 64;
                            const targetW = target;
                            const targetH = target;
                            const placementSrc = this.resolveEmojiPlacementSrc(cat, emojiCode, url, isInline);
                            if (!placementSrc) {
                                console.warn('Emoji placement skipped: cannot resolve public src', { cat, emojiCode, url });
                                return;
                            }
                            this.toolbar.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'place' });
                            this.toolbar.eventBus.emit(Events.Place.Set, {
                                type: 'image',
                                properties: { src: placementSrc, width: targetW, height: targetH, isEmojiIcon: true },
                                size: { width: targetW, height: targetH },
                                placeOnMouseUp: true
                            });
                            this.closeEmojiPopup();
                            cleanup();
                        }
                    };
                    const onUp = () => {
                        cleanup();
                        setTimeout(() => {
                            btn.__dragActive = false;
                            btn.__clickProcessing = false;
                        }, 50);
                    };
                    const cleanup = () => {
                        document.removeEventListener('mousemove', onMove);
                        document.removeEventListener('mouseup', onUp);
                    };
                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('mouseup', onUp, { once: true });
                });

                btn.addEventListener('click', () => {
                    if (btn.__dragActive || btn.__clickProcessing) return;

                    btn.__clickProcessing = true;
                    setTimeout(() => {
                        btn.__clickProcessing = false;
                    }, 100);

                    this.toolbar.animateButton(btn);
                    const target = 64;
                    const targetW = target;
                    const targetH = target;
                    const placementSrc = this.resolveEmojiPlacementSrc(cat, emojiCode, url, isInline);
                    if (!placementSrc) {
                        console.warn('Emoji placement skipped: cannot resolve public src', { cat, emojiCode, url });
                        return;
                    }

                    this.toolbar.eventBus.emit(Events.Place.Set, {
                        type: 'image',
                        properties: {
                            src: placementSrc,
                            width: targetW,
                            height: targetH,
                            isEmojiIcon: true,
                            isInlinePng: isInline || false,
                            emojiCode: emojiCode || null
                        },
                        size: { width: targetW, height: targetH }
                    });
                    this.closeEmojiPopup();
                });

                grid.appendChild(btn);
            });

            section.appendChild(grid);
            this.toolbar.emojiPopupEl.appendChild(section);
        });
        this.toolbar.container.appendChild(this.toolbar.emojiPopupEl);
    }

    resolveEmojiPlacementSrc(category, emojiCode, fallbackUrl, isInline = false) {
        const basePath = this.getEmojiBasePath();
        if (emojiCode && basePath) {
            const normalizeBase = basePath.endsWith('/') ? basePath : `${basePath}/`;
            const encodedCategory = encodeURIComponent(category || 'Разное');
            const encodedEmojiCode = encodeURIComponent(emojiCode);
            const relativePath = `${encodedCategory}/${encodedEmojiCode}.png`;

            try {
                return new URL(relativePath, normalizeBase).href;
            } catch (_) {
                return `${normalizeBase}${relativePath}`;
            }
        }

        const fallback = typeof fallbackUrl === 'string' ? fallbackUrl.trim() : '';
        if (!fallback) return null;
        if (/^data:/i.test(fallback) || /^blob:/i.test(fallback)) return null;
        if (fallback.includes('/node_modules/')) return null;
        return fallback;
    }

    getFallbackEmojiGroups() {
        const groups = new Map();
        let convertedCount = 0;

        const fallbackEmojis = {
            'Смайлики': [
                '1f600', '1f601', '1f602', '1f603', '1f604', '1f605', '1f606', '1f607',
                '1f609', '1f60a', '1f60b', '1f60c', '1f60d', '1f60e', '1f60f', '1f610',
                '1f611', '1f612', '1f613', '1f614', '1f615', '1f616', '1f617', '1f618',
                '1f619', '1f61a', '1f61b', '1f61c', '1f61d', '1f61e', '1f61f', '1f620',
                '1f621', '1f622', '1f623', '1f624', '1f625', '1f626', '1f627', '1f628',
                '1f629', '1f62a', '1f62b', '1f62c', '1f62d', '1f62e', '1f62f', '1f630',
                '1f631', '1f632', '1f633', '1f635', '1f636', '1f641', '1f642', '2639', '263a'
            ],
            'Жесты': [
                '1f446', '1f447', '1f448', '1f449', '1f44a', '1f44b', '1f44c', '1f450',
                '1f4aa', '1f590', '1f596', '1f64c', '1f64f', '261d', '270a', '270b', '270c', '270d'
            ],
            'Женские эмоции': [
                '1f645', '1f646', '1f64b', '1f64d', '1f64e'
            ],
            'Котики': [
                '1f638', '1f639', '1f63a', '1f63b', '1f63c', '1f63d', '1f63e', '1f63f', '1f640'
            ],
            'Обезьянка': [
                '1f435', '1f648', '1f649', '1f64a'
            ],
            'Разное': [
                '1f440', '1f441', '1f499', '1f4a1', '1f4a3', '1f4a9', '1f4ac', '1f4af', '203c', '26d4', '2764'
            ]
        };

        Object.entries(fallbackEmojis).forEach(([category, emojis]) => {
            const emojiList = [];

            emojis.forEach((emojiCode) => {
                const inlineUrl = getInlinePngEmojiUrl(emojiCode);

                if (inlineUrl) {
                    emojiList.push({
                        path: `inline:${emojiCode}`,
                        url: inlineUrl,
                        isInline: true,
                        emojiCode: emojiCode
                    });
                    convertedCount++;
                } else {
                    const basePath = this.getEmojiBasePath();
                    emojiList.push({
                        path: `${basePath}${category}/${emojiCode}.png`,
                        url: `${basePath}${category}/${emojiCode}.png`,
                        isInline: false
                    });
                    console.warn(`⚠️ Нет встроенного PNG для ${emojiCode}, используем файл`);
                }
            });

            if (emojiList.length > 0) {
                groups.set(category, emojiList);
            }
        });

        return groups;
    }

    getEmojiBasePath() {
        const normalize = (value) => {
            if (!value || typeof value !== 'string') return null;
            const trimmed = value.trim();
            if (!trimmed) return null;
            if (trimmed.includes('/node_modules/')) return null;
            return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
        };

        const fromOptions = normalize(this.toolbar.emojiBasePath);
        if (fromOptions) {
            return fromOptions;
        }

        const fromExplicitGlobal = normalize(window.MOODBOARD_EMOJI_BASE_PATH);
        if (fromExplicitGlobal) {
            return fromExplicitGlobal;
        }

        if (window.MOODBOARD_BASE_PATH) {
            const basePath = window.MOODBOARD_BASE_PATH.endsWith('/') ? window.MOODBOARD_BASE_PATH : window.MOODBOARD_BASE_PATH + '/';
            const fromGlobalBase = normalize(`${basePath}emodji/`);
            if (fromGlobalBase) return fromGlobalBase;
        }

        return '/emodji/';
    }

    toggleEmojiPopup(anchorButton) {
        if (!this.toolbar.emojiPopupEl) return;
        if (this.toolbar.emojiPopupEl.style.display === 'none') {
            this.openEmojiPopup(anchorButton);
        } else {
            this.closeEmojiPopup();
        }
    }

    openEmojiPopup(anchorButton) {
        if (!this.toolbar.emojiPopupEl) return;
        const toolbarRect = this.toolbar.container.getBoundingClientRect();
        const buttonRect = anchorButton.getBoundingClientRect();
        const left = this.toolbar.element.offsetWidth + 8;
        this.toolbar.emojiPopupEl.style.visibility = 'hidden';
        this.toolbar.emojiPopupEl.style.display = 'block';
        const desiredTop = buttonRect.top - toolbarRect.top - 4;
        const popupHeight = this.toolbar.emojiPopupEl.offsetHeight;
        const containerHeight = this.toolbar.container.clientHeight || toolbarRect.height;
        const minTop = 8;
        const maxTop = Math.max(minTop, containerHeight - popupHeight - 8);
        const top = Math.min(Math.max(minTop, desiredTop), maxTop);
        this.toolbar.emojiPopupEl.style.top = `${Math.round(top)}px`;
        this.toolbar.emojiPopupEl.style.left = `${Math.round(left)}px`;
        this.toolbar.emojiPopupEl.style.visibility = 'visible';
    }

    closeEmojiPopup() {
        if (this.toolbar.emojiPopupEl) {
            this.toolbar.emojiPopupEl.style.display = 'none';
        }
    }
}
