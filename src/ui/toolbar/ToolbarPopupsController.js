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
                    icon.innerHTML = '<svg width="18" height="12" viewBox="0 0 18 12" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="0" y="5" width="12" height="2" rx="1" fill="#1d4ed8"/><path d="M12 0 L18 6 L12 12 Z" fill="#1d4ed8"/></svg>';
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
        this.toolbar.shapesPopupEl.style.top = `${top}px`;
        this.toolbar.shapesPopupEl.style.left = `${left}px`;
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

        const grid = document.createElement('div');
        grid.className = 'moodboard-draw__grid';

        const tools = [
            { id: 'pencil-tool', tool: 'pencil', title: 'Карандаш', svg: '<svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M14.492 3.414 8.921 8.985a4.312 4.312 0 0 0 6.105 6.09l5.564-5.562 1.414 1.414-5.664 5.664a6.002 6.002 0 0 1-2.182 1.392L3.344 21.94 2.06 20.656 6.02 9.845c.3-.82.774-1.563 1.391-2.18l.093-.092.01-.01L13.077 2l1.415 1.414ZM4.68 19.32l4.486-1.64a6.305 6.305 0 0 1-1.651-1.19 6.306 6.306 0 0 1-1.192-1.655L4.68 19.32Z" clip-rule="evenodd"/></svg>' },
            { id: 'marker-tool', tool: 'marker', title: 'Маркер', svg: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" width="20" height="20" class="c-bxOhME c-bxOhME-dvzWZT-size-medium"><path fill="currentColor" fill-rule="evenodd" d="M12.737 2.676 8.531 7.264a1 1 0 0 0 .03 1.382l7.674 7.675a1 1 0 0 0 1.442-.029l4.589-4.97 1.468 1.357-4.588 4.97a3 3 0 0 1-3.46.689l-1.917 2.303-1.454.087-.63-.593-.828 1.38L10 22v-1l-.001-.001L10 22H1v-3l.18-.573 3.452-4.93-.817-.77.045-1.496 2.621-2.184a2.999 2.999 0 0 1 .577-3.134l4.205-4.589 1.474 1.352ZM3 19.315v.684h6.434l.76-1.268-4.09-3.85L3 19.314Zm3.007-7.27 6.904 6.498 1.217-1.46-6.667-6.25-1.454 1.212Z" clip-rule="evenodd"></path></svg>' },
            { id: 'eraser-tool', tool: 'eraser', title: 'Ластик', svg: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" width="20" height="20" class="c-bxOhME c-bxOhME-dvzWZT-size-medium"><path fill="currentColor" fill-rule="evenodd" d="M12.63 3.957 4.319 12.27a3 3 0 0 0 0 4.242L7.905 20.1 8.612 20.394H21v-2h-5.6l6.629-6.63a3 3 0 0 0 0-4.242L17.858 3.42a3 3 0 0 0-4.242 0ZM5.12 14.293a1 1 0 0 0 0 1.414L8.414 19h3.172l3-3L9 10.414l-3.879 3.88Zm10.336-8.922a1 1 0 0 0-1.414 0l-3.629 3.63L16 14.585l3.63-3.629a1 1 0 0 0 0-1.414L15.457 5.37Z" clip-rule="evenodd"></path></svg>' }
        ];
        const row1 = document.createElement('div');
        row1.className = 'moodboard-draw__row';
        this.toolbar.drawRow1 = row1;
        tools.forEach((t) => {
            const btn = document.createElement('button');
            btn.className = `moodboard-draw__btn moodboard-draw__btn--${t.id}`;
            btn.title = t.title;
            const icon = document.createElement('span');
            icon.className = 'draw-icon';
            icon.innerHTML = t.svg;
            btn.appendChild(icon);
            btn.addEventListener('click', () => {
                this.toolbar.animateButton(btn);
                row1.querySelectorAll('.moodboard-draw__btn--active').forEach((el) => el.classList.remove('moodboard-draw__btn--active'));
                btn.classList.add('moodboard-draw__btn--active');
                this.toolbar.currentDrawTool = t.tool;
                this.toolbar.eventBus.emit(Events.Draw.BrushSet, { mode: t.tool });
                this.toolbar.buildDrawPresets(row2);
            });
            row1.appendChild(btn);
        });

        const row2 = document.createElement('div');
        row2.className = 'moodboard-draw__row';
        this.toolbar.drawRow2 = row2;
        const clearActivePresetButtons = () => {
            row2.querySelectorAll('.moodboard-draw__btn--active').forEach((el) => el.classList.remove('moodboard-draw__btn--active'));
        };

        const pencilPresetEl = document.createElement('div');
        pencilPresetEl.className = 'moodboard-draw__row';
        const markerPresetEl = document.createElement('div');
        markerPresetEl.className = 'moodboard-draw__row';
        const eraserPresetEl = document.createElement('div');
        eraserPresetEl.className = 'moodboard-draw__row';
        for (let i = 0; i < 3; i++) {
            const ph = document.createElement('div');
            ph.className = 'moodboard-draw__placeholder';
            eraserPresetEl.appendChild(ph);
        }

        const sizes = [
            { id: 'size-thin-black', title: 'Тонкий черный', color: '#111827', dot: 4, width: 2 },
            { id: 'size-medium-red', title: 'Средний красный', color: '#ef4444', dot: 8, width: 4 },
            { id: 'size-thick-green', title: 'Толстый зеленый', color: '#16a34a', dot: 10, width: 6 }
        ];
        sizes.forEach((s) => {
            const btn = document.createElement('button');
            btn.className = `moodboard-draw__btn moodboard-draw__btn--${s.id}`;
            btn.title = s.title;
            btn.dataset.brushWidth = String(s.width);
            btn.dataset.brushColor = s.color;
            const holder = document.createElement('span');
            holder.className = 'draw-size';
            const dot = document.createElement('span');
            dot.className = 'draw-dot';
            dot.style.background = s.color;
            dot.style.width = `${s.dot}px`;
            dot.style.height = `${s.dot}px`;
            holder.appendChild(dot);
            btn.appendChild(holder);
            btn.addEventListener('click', () => {
                this.toolbar.animateButton(btn);
                clearActivePresetButtons();
                btn.classList.add('moodboard-draw__btn--active');
                const width = s.width;
                const color = parseInt(s.color.replace('#', ''), 16);
                this.toolbar.eventBus.emit(Events.Draw.BrushSet, { mode: 'pencil', width, color });
            });
            pencilPresetEl.appendChild(btn);
        });

        const swatches = [
            { id: 'marker-yellow', title: 'Жёлтый', color: '#facc15' },
            { id: 'marker-green', title: 'Светло-зелёный', color: '#22c55e' },
            { id: 'marker-pink', title: 'Розовый', color: '#ec4899' }
        ];
        swatches.forEach((s) => {
            const btn = document.createElement('button');
            btn.className = `moodboard-draw__btn moodboard-draw__btn--${s.id}`;
            btn.title = s.title;
            const sw = document.createElement('span');
            sw.className = 'draw-swatch';
            sw.style.background = s.color;
            btn.appendChild(sw);
            btn.addEventListener('click', () => {
                this.toolbar.animateButton(btn);
                clearActivePresetButtons();
                btn.classList.add('moodboard-draw__btn--active');
                const color = parseInt(s.color.replace('#', ''), 16);
                this.toolbar.eventBus.emit(Events.Draw.BrushSet, { mode: 'marker', color, width: 8 });
            });
            markerPresetEl.appendChild(btn);
        });

        const movePresetToRow = (fromEl, toRow) => {
            while (fromEl.firstChild) toRow.appendChild(fromEl.firstChild);
        };
        const getPresetElForContents = (container) => {
            if (container.querySelector('.moodboard-draw__btn--size-thin-black')) return pencilPresetEl;
            if (container.querySelector('.moodboard-draw__btn--marker-yellow')) return markerPresetEl;
            return eraserPresetEl;
        };
        this.toolbar.buildDrawPresets = (container) => {
            movePresetToRow(container, getPresetElForContents(container));
            if (this.toolbar.currentDrawTool === 'pencil') {
                movePresetToRow(pencilPresetEl, container);
                const first = container.querySelector('.moodboard-draw__btn');
                if (first) {
                    container.querySelectorAll('.moodboard-draw__btn--active').forEach((el) => el.classList.remove('moodboard-draw__btn--active'));
                    first.classList.add('moodboard-draw__btn--active');
                    const width = parseInt(first.dataset.brushWidth, 10) || 2;
                    const color = parseInt((first.dataset.brushColor || '#111827').replace('#', ''), 16);
                    this.toolbar.eventBus.emit(Events.Draw.BrushSet, { mode: 'pencil', width, color });
                }
            } else if (this.toolbar.currentDrawTool === 'marker') {
                movePresetToRow(markerPresetEl, container);
                const first = container.querySelector('.moodboard-draw__btn');
                if (first) {
                    container.querySelectorAll('.moodboard-draw__btn--active').forEach((el) => el.classList.remove('moodboard-draw__btn--active'));
                    first.classList.add('moodboard-draw__btn--active');
                    const color = parseInt(swatches[0].color.replace('#', ''), 16);
                    this.toolbar.eventBus.emit(Events.Draw.BrushSet, { mode: 'marker', color, width: 8 });
                }
            } else if (this.toolbar.currentDrawTool === 'eraser') {
                movePresetToRow(eraserPresetEl, container);
                this.toolbar.eventBus.emit(Events.Draw.BrushSet, { mode: 'eraser' });
            }
        };

        grid.appendChild(row1);
        grid.appendChild(row2);
        this.toolbar.drawPopupEl.appendChild(grid);
        this.toolbar.container.appendChild(this.toolbar.drawPopupEl);
        const pencilBtn = row1.querySelector('.moodboard-draw__btn--pencil-tool');
        if (pencilBtn) pencilBtn.classList.add('moodboard-draw__btn--active');
        this.toolbar.currentDrawTool = 'pencil';
        this.toolbar.eventBus.emit(Events.Draw.BrushSet, { mode: 'pencil' });
        this.toolbar.buildDrawPresets(row2);
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
        this.toolbar.drawPopupEl.style.top = `${top}px`;
        this.toolbar.drawPopupEl.style.left = `${left}px`;
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
                            this.toolbar.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'place' });
                            this.toolbar.eventBus.emit(Events.Place.Set, {
                                type: 'image',
                                properties: { src: url, width: targetW, height: targetH, isEmojiIcon: true },
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

                    this.toolbar.eventBus.emit(Events.Place.Set, {
                        type: 'image',
                        properties: {
                            src: url,
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
        if (this.toolbar.emojiBasePath) {
            return this.toolbar.emojiBasePath.endsWith('/') ? this.toolbar.emojiBasePath : this.toolbar.emojiBasePath + '/';
        }

        if (window.MOODBOARD_BASE_PATH) {
            const basePath = window.MOODBOARD_BASE_PATH.endsWith('/') ? window.MOODBOARD_BASE_PATH : window.MOODBOARD_BASE_PATH + '/';
            return `${basePath}src/assets/emodji/`;
        }

        try {
            const currentModuleUrl = import.meta.url;
            const emojiUrl = new URL('../assets/emodji/', currentModuleUrl).href;
            return emojiUrl;
        } catch (error) {
            console.warn('⚠️ Не удалось определить путь через import.meta.url:', error);
        }

        try {
            const currentScript = document.currentScript;
            if (currentScript && currentScript.src) {
                const scriptUrl = new URL(currentScript.src);
                const baseUrl = new URL('../assets/emodji/', scriptUrl).href;
                return baseUrl;
            }
        } catch (error) {
            console.warn('⚠️ Не удалось определить путь через currentScript:', error);
        }

        return '/src/assets/emodji/';
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
        this.toolbar.emojiPopupEl.style.top = `${top}px`;
        this.toolbar.emojiPopupEl.style.left = `${left}px`;
        this.toolbar.emojiPopupEl.style.visibility = 'visible';
    }

    closeEmojiPopup() {
        if (this.toolbar.emojiPopupEl) {
            this.toolbar.emojiPopupEl.style.display = 'none';
        }
    }
}
