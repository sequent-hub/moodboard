import * as PIXI from 'pixi.js';
import { Events } from '../core/events/Events.js';
import { EditFileNameCommand } from '../core/commands/EditFileNameCommand.js';
import { applyRoundedMask } from '../utils/applyRoundedMask.js';

const ICONS = {
    download: `<svg width="24" height="24" fill="none" viewBox="0 0 24 24" type="download"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4.75 14.75V16.25C4.75 17.9069 6.09315 19.25 7.75 19.25H16.25C17.9069 19.25 19.25 17.9069 19.25 16.25V14.75"></path><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 14.25L12 4.75"></path><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8.75 10.75L12 14.25L15.25 10.75"></path></svg>`,
    replace: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" type="replace" size="20"><path d="M1.94444 8.38889C1.94444 8.38889 2.04217 7.70478 4.87347 4.87348C7.70478 2.04217 12.2952 2.04217 15.1265 4.87348C16.1297 5.87661 16.7774 7.10058 17.0697 8.38889M1.94444 8.38889V3.55556M1.94444 8.38889H6.77778M18.0556 11.6111C18.0556 11.6111 17.9578 12.2952 15.1265 15.1265C12.2952 17.9578 7.70478 17.9578 4.87347 15.1265C3.87034 14.1234 3.22261 12.8994 2.9303 11.6111M18.0556 11.6111V16.4444M18.0556 11.6111H13.2222"></path></svg>`,
    frame: `<span class="ipp-icon-frame-wrap"><span class="ipp-icon-frame"></span></span>`,
    roundCorners: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" type="border-radius" size="24"><path d="M19 4.99414H12.7059C10.6622 4.99414 8.70215 5.80601 7.25701 7.25115C5.81187 8.69629 5 10.6563 5 12.7001V19"></path></svg>`,
    crop: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" type="crop" size="20"><path d="M8.33317 4.99984H12.3332C13.2666 4.99984 13.7333 4.99984 14.0898 5.18149C14.4034 5.34128 14.6584 5.59625 14.8182 5.90985C14.9998 6.26637 14.9998 6.73308 14.9998 7.6665V11.6665M1.6665 4.99984H4.99984M14.9998 14.9998V18.3332M18.3332 14.9998L7.6665 14.9998C6.73308 14.9998 6.26637 14.9998 5.90985 14.8182C5.59625 14.6584 5.34128 14.4034 5.18149 14.0898C4.99984 13.7333 4.99984 13.2666 4.99984 12.3332V1.6665"></path></svg>`,
    expand: `<svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke-width="1.2" type="chevron-down" size="24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M15.25 10.75L12 14.25L8.75 10.75"></path></svg>`,
    lock: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" type="lock-2" size="24"><path d="M5.75 11.75C5.75 11.1977 6.19772 10.75 6.75 10.75H17.25C17.8023 10.75 18.25 11.1977 18.25 11.75V17.25C18.25 18.3546 17.3546 19.25 16.25 19.25H7.75C6.64543 19.25 5.75 18.3546 5.75 17.25V11.75Z"></path><path d="M7.75008 10.5V10.3427C7.75008 8.78147 7.65615 7.04125 8.74654 5.9239C9.36837 5.2867 10.3746 4.75 12.0001 4.75C13.6256 4.75 14.6318 5.2867 15.2536 5.9239C16.344 7.04125 16.2501 8.78147 16.2501 10.3427V10.5"></path><path d="M12 14.25L12 15.75"></path></svg>`,
    unlock: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" type="lock-2-unlocked" size="24"><path d="M5.75 11.75C5.75 11.1977 6.19772 10.75 6.75 10.75H17.25C17.8023 10.75 18.25 11.1977 18.25 11.75V17.25C18.25 18.3546 17.3546 19.25 16.25 19.25H7.75C6.64543 19.25 5.75 18.3546 5.75 17.25V11.75Z"></path><path d="M7.74972 10.5V9.84343C7.74972 8.61493 7.70065 7.29883 8.42388 6.30578C8.99834 5.51699 10.0565 4.75 11.9997 4.75C13.9997 4.75 15.2497 6.25 15.2497 6.25"></path><path d="M12 14.25L12 15.75"></path></svg>`,
    more: `<svg width="24" height="24" viewBox="0 0 22 22" fill="currentColor" xmlns="http://www.w3.org/2000/svg" type="dots-horizontal" size="24"><path d="M16.2246 12.375C16.984 12.375 17.5996 11.7594 17.5996 11C17.5996 10.2406 16.984 9.625 16.2246 9.625C15.4652 9.625 14.8496 10.2406 14.8496 11C14.8496 11.7594 15.4652 12.375 16.2246 12.375Z"></path><path d="M11 12.375C11.7594 12.375 12.375 11.7594 12.375 11C12.375 10.2406 11.7594 9.625 11 9.625C10.2406 9.625 9.625 10.2406 9.625 11C9.625 11.7594 10.2406 12.375 11 12.375Z"></path><path d="M5.77539 12.375C6.53478 12.375 7.15039 11.7594 7.15039 11C7.15039 10.2406 6.53478 9.625 5.77539 9.625C5.016 9.625 4.40039 10.2406 4.40039 11C4.40039 11.7594 5.016 12.375 5.77539 12.375Z"></path></svg>`,
    ddCustom: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="4 4"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`,
    ddOriginal: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`,
    ddCircle: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>`,
    ddSquare: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="1"/></svg>`,
    ddPortrait: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="1"/></svg>`,
    ddLandscape: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="1"/></svg>`,
    ddWide: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="6" width="22" height="12" rx="1"/></svg>`,
};


/**
 * Тулбар над выделенным изображением.
 * Показывается при одиночном выделении объекта type=image.
 * Кнопки — заглушки, функционал будет добавлен отдельно.
 */
export class ImagePropertiesPanel {
    constructor(eventBus, container, core = null, currentUser = null) {
        this.eventBus = eventBus;
        this.container = container;
        this.core = core;
        this.currentUser = currentUser;
        this.panel = null;
        this.currentId = null;
        this._handlers = null;

        this._attachEvents();
        this._createPanel();
    }

    _attachEvents() {
        this._handlers = {
            onSelectionAdd: () => this.updateFromSelection(),
            onSelectionRemove: () => this.updateFromSelection(),
            onSelectionClear: () => this.hide(),
            onDeleted: (data) => {
                const objectId = data?.objectId || data;
                if (this.currentId && objectId === this.currentId) this.hide();
            },
            onDragStart: () => this.hide(),
            onDragUpdate: () => this.reposition(),
            onDragEnd: () => this.updateFromSelection(),
            onGroupDragStart: () => this.hide(),
            onGroupDragUpdate: () => this.reposition(),
            onGroupDragEnd: () => this.updateFromSelection(),
            onResizeUpdate: () => this.reposition(),
            onRotateUpdate: () => this.reposition(),
            onZoomPercent: () => { if (this.currentId) this.reposition(); },
            onPanUpdate: () => { if (this.currentId) this.reposition(); },
            onViewportChanged: () => { if (this.currentId) this.reposition(); },
            onActivated: ({ tool }) => { if (tool !== 'select') this.hide(); },
            onTransformUpdated: (data) => {
                if (this.currentId && data?.objectId === this.currentId) this.reposition();
            },
        };

        this.eventBus.on(Events.Tool.SelectionAdd, this._handlers.onSelectionAdd);
        this.eventBus.on(Events.Tool.SelectionRemove, this._handlers.onSelectionRemove);
        this.eventBus.on(Events.Tool.SelectionClear, this._handlers.onSelectionClear);
        this.eventBus.on(Events.Object.Deleted, this._handlers.onDeleted);
        this.eventBus.on(Events.Tool.DragStart, this._handlers.onDragStart);
        this.eventBus.on(Events.Tool.DragUpdate, this._handlers.onDragUpdate);
        this.eventBus.on(Events.Tool.DragEnd, this._handlers.onDragEnd);
        this.eventBus.on(Events.Tool.GroupDragStart, this._handlers.onGroupDragStart);
        this.eventBus.on(Events.Tool.GroupDragUpdate, this._handlers.onGroupDragUpdate);
        this.eventBus.on(Events.Tool.GroupDragEnd, this._handlers.onGroupDragEnd);
        this.eventBus.on(Events.Tool.ResizeUpdate, this._handlers.onResizeUpdate);
        this.eventBus.on(Events.Tool.RotateUpdate, this._handlers.onRotateUpdate);
        this.eventBus.on(Events.UI.ZoomPercent, this._handlers.onZoomPercent);
        this.eventBus.on(Events.Tool.PanUpdate, this._handlers.onPanUpdate);
        this.eventBus.on(Events.Viewport.Changed, this._handlers.onViewportChanged);
        this.eventBus.on(Events.Tool.Activated, this._handlers.onActivated);
        this.eventBus.on(Events.Object.TransformUpdated, this._handlers.onTransformUpdated);

        this._handlers.onDocumentClick = (e) => {
            if (this.panel && !this.panel.contains(e.target)) {
                const dropdowns = this.panel.querySelectorAll('.ipp-crop-dropdown.is-open, .ipp-more-dropdown.is-open, .ipp-border-radius-popover.is-open, .ipp-border-style-popover.is-open');
                const expands = this.panel.querySelectorAll('.ipp-btn-split-expand.is-expanded, .ipp-btn.is-active');
                dropdowns.forEach(d => d.classList.remove('is-open'));
                expands.forEach(el => el.classList.remove('is-expanded', 'is-active'));
                if (this._infoPopover) this._infoPopover.classList.remove('is-open');
            }
        };
        document.addEventListener('click', this._handlers.onDocumentClick);
    }

    updateFromSelection() {
        const ids = this.core?.selectTool
            ? Array.from(this.core.selectTool.selectedObjects || [])
            : [];

        if (ids.length !== 1) {
            this.hide();
            return;
        }

        const id = ids[0];

        if (this.currentId === id && this.panel && this.panel.style.display !== 'none') {
            return;
        }

        const pixi = this.core?.pixi?.objects?.get ? this.core.pixi.objects.get(id) : null;
        const isImage = !!(pixi && pixi._mb && pixi._mb.type === 'image');

        if (isImage) {
            this.showFor(id);
        } else {
            this.hide();
        }
    }

    showFor(objectId) {
        this.currentId = objectId;
        if (this.panel) {
            this.panel.style.display = 'flex';
            this._updateFileName();
            this._closeBorderRadiusPopover();
            this._updateLockUI();
            this._updateFrameIconColor();
            this.reposition();
        }
    }

    _getCurrentObject() {
        if (!this.currentId) return null;
        const objects = this.core?.state?.getObjects ? this.core.state.getObjects() : [];
        return objects.find(o => o.id === this.currentId) || null;
    }

    _isLocked() {
        const obj = this._getCurrentObject();
        return !!(obj?.properties?.locked);
    }

    _toggleLocked() {
        const obj = this._getCurrentObject();
        if (!obj) return;
        if (!obj.properties) obj.properties = {};
        obj.properties.locked = !obj.properties.locked;
        if (typeof this.core?.state?.markDirty === 'function') {
            this.core.state.markDirty();
        }
        this._updateLockUI();
        this.reposition();
    }

    _updateLockUI() {
        if (!this._btn_lock) return;
        const locked = this._isLocked();

        this._btn_lock.innerHTML = locked ? ICONS.unlock : ICONS.lock;
        this._btn_lock.title = locked ? 'Разблокировать' : 'Заблокировать';

        if (Array.isArray(this._lockableEls)) {
            this._lockableEls.forEach(el => {
                if (el) el.style.display = locked ? 'none' : '';
            });
        }

        if (this._moreLockLabel) {
            this._moreLockLabel.textContent = locked ? 'Разблокировать' : 'Заблокировать';
        }
    }

    hide() {
        this.currentId = null;
        if (this.panel) {
            this.panel.style.display = 'none';
        }
        this._closeBorderRadiusPopover();
    }

    _closeBorderRadiusPopover() {
        if (this._borderRadiusPopover) {
            this._borderRadiusPopover.classList.remove('is-open');
        }
        if (this._borderRadiusBtn) {
            this._borderRadiusBtn.classList.remove('is-active');
        }
    }

    _createPanel() {
        if (this.panel) return;

        this.panel = document.createElement('div');
        this.panel.className = 'image-properties-panel';
        this.panel.dataset.id = 'image-properties-panel';
        this.panel.style.display = 'none';

        // Имя файла
        this._fileNameEl = document.createElement('span');
        this._fileNameEl.className = 'ipp-filename';
        this._fileNameEl.dataset.id = 'ipp-filename';
        this._fileNameEl.contentEditable = 'true';
        this._fileNameEl.spellcheck = false;
        
        // Отключаем всплытие событий при вводе
        const stopPropagation = (e) => e.stopPropagation();
        this._fileNameEl.addEventListener('mousedown', stopPropagation);
        this._fileNameEl.addEventListener('touchstart', stopPropagation);
        
        this._fileNameEl.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
                e.preventDefault();
                this._fileNameEl.blur();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this._updateFileName();
                this._fileNameEl.blur();
            }
        });
        
        this._fileNameEl.addEventListener('blur', () => {
            const newName = this._fileNameEl.textContent.trim();
            if (newName && this.currentId) {
                const objects = this.core?.state?.getObjects ? this.core.state.getObjects() : [];
                const obj = objects.find(o => o.id === this.currentId);
                const oldName = obj?.properties?.name || obj?.properties?.fileName || 'image.png';
                
                if (newName !== oldName) {
                    if (this.core && this.core.history) {
                        const cmd = new EditFileNameCommand(this.core, this.currentId, oldName, newName);
                        this.core.history.execute(cmd);
                    }
                }
            } else {
                this._updateFileName();
            }
        });
        
        this.panel.appendChild(this._fileNameEl);

        const dividerLeft = this._makeDivider();
        this.panel.appendChild(dividerLeft);

        // Кнопки
        const buttons = [
            { key: 'download', icon: ICONS.download, title: 'Скачать' },
            { key: 'replace', icon: ICONS.replace, title: 'Заменить' },
        ];

        buttons.forEach(({ key, icon, title }) => {
            const btn = this._makeButton(icon, title, key);
            this[`_btn_${key}`] = btn;
            this.panel.appendChild(btn);
        });

        this._btn_borderStyle_group = this._makeBorderStyleButton();
        this.panel.appendChild(this._btn_borderStyle_group);

        this._btn_download.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this._downloadImage();
        });

        // Кнопка «Скруглить углы» с поповером
        this._btn_roundCorners_group = this._makeRoundCornersButton();
        this.panel.appendChild(this._btn_roundCorners_group);

        // Составная кнопка crop
        this._btn_crop_group = this._makeCropButton();
        this.panel.appendChild(this._btn_crop_group);

        const dividerRight = this._makeDivider();
        this.panel.appendChild(dividerRight);

        this._btn_lock = this._makeButton(ICONS.lock, 'Заблокировать', 'lock');
        this._btn_lock.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this._toggleLocked();
        });
        this.panel.appendChild(this._btn_lock);

        this._btn_more_group = this._makeMoreButton();
        this.panel.appendChild(this._btn_more_group);

        // Элементы, которые скрываются при locked. ipp-btn-lock и ipp-btn-more остаются видимыми.
        this._lockableEls = [
            this._fileNameEl,
            dividerLeft,
            this._btn_download,
            this._btn_replace,
            this._btn_borderStyle_group,
            this._btn_roundCorners_group,
            this._btn_crop_group,
            dividerRight,
        ];

        this.container.appendChild(this.panel);
    }

    _makeCropButton() {
        const wrapper = document.createElement('div');
        wrapper.className = 'ipp-btn-split-wrapper';
        wrapper.dataset.id = 'ipp-btn-crop-wrapper';

        const mainBtn = document.createElement('button');
        mainBtn.className = 'ipp-btn-split-main';
        mainBtn.title = 'Обрезать';
        mainBtn.innerHTML = ICONS.crop;
        mainBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Логика применения текущего кропа
        });

        const expandBtn = document.createElement('button');
        expandBtn.className = 'ipp-btn-split-expand';
        expandBtn.title = 'Выбрать пропорции';
        expandBtn.innerHTML = ICONS.expand;

        const dropdown = document.createElement('div');
        dropdown.className = 'ipp-crop-dropdown';

        const items = [
            { id: 'custom', label: 'Custom', icon: ICONS.ddCustom },
            { id: 'original', label: 'Original', icon: ICONS.ddOriginal },
            { divider: true },
            { id: 'circle', label: 'Circle', icon: ICONS.ddCircle },
            { id: 'square', label: 'Square', icon: ICONS.ddSquare },
            { id: 'portrait', label: 'Portrait', icon: ICONS.ddPortrait, ratio: '3:4' },
            { id: 'landscape', label: 'Landscape', icon: ICONS.ddLandscape, ratio: '4:3' },
            { id: 'wide', label: 'Wide', icon: ICONS.ddWide, ratio: '16:9' },
        ];

        items.forEach(item => {
            if (item.divider) {
                const div = document.createElement('div');
                div.className = 'ipp-dropdown-divider';
                dropdown.appendChild(div);
                return;
            }

            const btn = document.createElement('button');
            btn.className = 'ipp-dropdown-item';
            
            const iconSpan = document.createElement('span');
            iconSpan.className = 'ipp-dropdown-icon';
            iconSpan.innerHTML = item.icon;
            
            const labelSpan = document.createElement('span');
            labelSpan.textContent = item.label;

            btn.appendChild(iconSpan);
            btn.appendChild(labelSpan);

            if (item.ratio) {
                const ratioSpan = document.createElement('span');
                ratioSpan.className = 'ipp-dropdown-item-ratio';
                ratioSpan.textContent = item.ratio;
                btn.appendChild(ratioSpan);
            }

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                // Логика выбора пропорции
                dropdown.classList.remove('is-open');
                expandBtn.classList.remove('is-expanded');
            });

            dropdown.appendChild(btn);
        });

        expandBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isOpen = dropdown.classList.contains('is-open');
            
            // Закрываем все другие дропдауны, если есть (на будущее)
            document.querySelectorAll('.ipp-crop-dropdown.is-open, .ipp-more-dropdown.is-open').forEach(el => {
                el.classList.remove('is-open');
            });
            document.querySelectorAll('.ipp-btn-split-expand.is-expanded, .ipp-btn.is-active').forEach(el => {
                el.classList.remove('is-expanded', 'is-active');
            });

            if (!isOpen) {
                dropdown.classList.add('is-open');
                expandBtn.classList.add('is-expanded');
            }
        });

        wrapper.appendChild(mainBtn);
        wrapper.appendChild(expandBtn);
        wrapper.appendChild(dropdown);

        return wrapper;
    }

    _makeRoundCornersButton() {
        const wrapper = document.createElement('div');
        wrapper.className = 'ipp-btn-wrapper';
        wrapper.style.position = 'relative';
        wrapper.style.display = 'inline-flex';

        const btn = document.createElement('button');
        btn.className = 'ipp-btn';
        btn.title = 'Скруглить углы';
        btn.dataset.id = 'ipp-btn-roundCorners';
        btn.innerHTML = ICONS.roundCorners;
        this._borderRadiusBtn = btn;

        const popover = document.createElement('div');
        popover.className = 'ipp-border-radius-popover';
        this._borderRadiusPopover = popover;

        const label = document.createElement('span');
        label.className = 'ipp-border-radius-label';
        label.textContent = 'Border radius';

        const controls = document.createElement('div');
        controls.className = 'ipp-border-radius-controls';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'ipp-border-radius-slider';
        slider.min = '0';
        slider.max = '500';
        slider.value = '0';

        const numberInput = document.createElement('input');
        numberInput.type = 'number';
        numberInput.className = 'ipp-border-radius-number';
        numberInput.min = '0';
        numberInput.max = '500';
        numberInput.value = '0';

        const updateSliderFill = () => {
            const val = parseInt(slider.value, 10) || 0;
            const max = parseInt(slider.max, 10) || 1;
            const pct = Math.round((val / max) * 100);
            slider.style.background = `linear-gradient(to right, #444ce7 0%, #444ce7 ${pct}%, #E5E7EB ${pct}%, #E5E7EB 100%)`;
        };

        const stopEv = (e) => e.stopPropagation();
        [slider, numberInput].forEach(el => {
            el.addEventListener('mousedown', stopEv);
            el.addEventListener('touchstart', stopEv);
            el.addEventListener('keydown', stopEv);
        });

        slider.addEventListener('input', (e) => {
            e.stopPropagation();
            const val = parseInt(slider.value, 10) || 0;
            numberInput.value = String(val);
            updateSliderFill();
            this._applyBorderRadius(val);
        });

        numberInput.addEventListener('input', (e) => {
            e.stopPropagation();
            const max = parseInt(numberInput.max, 10) || 500;
            const val = Math.max(0, Math.min(parseInt(numberInput.value, 10) || 0, max));
            slider.value = String(val);
            updateSliderFill();
            this._applyBorderRadius(val);
        });

        controls.appendChild(slider);
        controls.appendChild(numberInput);
        popover.appendChild(label);
        popover.appendChild(controls);

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isOpen = popover.classList.contains('is-open');

            document.querySelectorAll('.ipp-crop-dropdown.is-open, .ipp-more-dropdown.is-open, .ipp-border-radius-popover.is-open').forEach(el => {
                el.classList.remove('is-open');
            });
            document.querySelectorAll('.ipp-btn-split-expand.is-expanded, .ipp-btn.is-active').forEach(el => {
                el.classList.remove('is-expanded', 'is-active');
            });

            if (!isOpen) {
                if (this.currentId) {
                    const pixiObject = this.core?.pixi?.objects?.get(this.currentId);
                    if (pixiObject) {
                        const maxR = Math.floor(Math.min(pixiObject.width || 0, pixiObject.height || 0) / 2);
                        const cap = Math.max(1, maxR);
                        slider.max = String(cap);
                        numberInput.max = String(cap);
                    }
                    const objects = this.core?.state?.getObjects ? this.core.state.getObjects() : [];
                    const obj = objects.find(o => o.id === this.currentId);
                    const current = obj?.properties?.borderRadius || 0;
                    const capped = Math.min(current, parseInt(slider.max, 10));
                    slider.value = String(capped);
                    numberInput.value = String(capped);
                    updateSliderFill();
                }
                popover.classList.add('is-open');
                btn.classList.add('is-active');
            }
        });

        wrapper.appendChild(btn);
        wrapper.appendChild(popover);
        return wrapper;
    }

    _applyBorderRadius(radius) {
        if (!this.currentId) return;

        const pixiObject = this.core?.pixi?.objects?.get(this.currentId);
        if (!pixiObject) return;

        const objects = this.core?.state?.getObjects ? this.core.state.getObjects() : [];
        const obj = objects.find(o => o.id === this.currentId);
        if (obj) {
            if (!obj.properties) obj.properties = {};
            obj.properties.borderRadius = radius;
            if (typeof this.core?.state?.markDirty === 'function') {
                this.core.state.markDirty();
            }
        }

        applyRoundedMask(pixiObject, radius);
    }

    _applyBorder() {
        if (!this.currentId) return;

        const objects = this.core?.state?.getObjects ? this.core.state.getObjects() : [];
        const obj = objects.find(o => o.id === this.currentId);
        if (obj) {
            if (!obj.properties) obj.properties = {};
            obj.properties.borderStyle = this._borderStyleData.style;
            obj.properties.borderWidth = this._borderStyleData.width;
            obj.properties.borderOpacity = this._borderStyleData.opacity;
            obj.properties.borderColor = this._borderStyleData.color;
            if (typeof this.core?.state?.markDirty === 'function') {
                this.core.state.markDirty();
            }
        }

        const pixiObject = this.core?.pixi?.objects?.get(this.currentId);
        if (!pixiObject) return;

        // Удаляем существующую рамку
        if (pixiObject._borderGraphics) {
            if (pixiObject._borderGraphics.parent) {
                pixiObject._borderGraphics.parent.removeChild(pixiObject._borderGraphics);
            }
            pixiObject._borderGraphics.destroy();
            pixiObject._borderGraphics = null;
        }

        const { style, width, opacity, color } = this._borderStyleData;
        if (!width || !color) return;

        const texW = pixiObject.texture?.width || 1;
        const texH = pixiObject.texture?.height || 1;
        const sx = Math.abs(pixiObject.scale?.x || 1);
        const sy = Math.abs(pixiObject.scale?.y || 1);
        const avgScale = (sx + sy) / 2;

        // Ширина линии в локальных (текстурных) координатах
        const localW = width / avgScale;
        const hexColor = parseInt(color.replace('#', ''), 16);
        const alpha = opacity / 100;

        const g = new PIXI.Graphics();

        if (style === 'solid') {
            g.lineStyle({ width: localW, color: hexColor, alpha, alignment: 0.5 });
            g.drawRect(-texW / 2, -texH / 2, texW, texH);
        } else {
            const dashLen = style === 'dashed' ? localW * 5 : localW * 1.5;
            const gapLen = localW * 4;

            g.lineStyle({ width: localW, color: hexColor, alpha, cap: PIXI.LINE_CAP.ROUND });

            const drawDash = (x1, y1, x2, y2) => {
                const dx = x2 - x1;
                const dy = y2 - y1;
                const len = Math.sqrt(dx * dx + dy * dy);
                if (len === 0) return;
                const nx = dx / len;
                const ny = dy / len;
                let pos = 0;
                let on = true;
                while (pos < len) {
                    const segLen = Math.min(pos + (on ? dashLen : gapLen), len);
                    if (on) {
                        g.moveTo(x1 + nx * pos, y1 + ny * pos);
                        g.lineTo(x1 + nx * segLen, y1 + ny * segLen);
                    }
                    pos = segLen;
                    on = !on;
                }
            };

            const x0 = -texW / 2;
            const y0 = -texH / 2;
            drawDash(x0, y0, x0 + texW, y0);
            drawDash(x0 + texW, y0, x0 + texW, y0 + texH);
            drawDash(x0 + texW, y0 + texH, x0, y0 + texH);
            drawDash(x0, y0 + texH, x0, y0);
        }

        pixiObject.addChild(g);
        pixiObject._borderGraphics = g;

        this._updateFrameIconColor();
    }

    _updateFrameIconColor() {
        if (!this.panel) return;
        const frameIcon = this.panel.querySelector('.ipp-icon-frame');
        if (!frameIcon) return;
        
        const obj = this._getCurrentObject();
        const borderColor = obj?.properties?.borderColor;
        frameIcon.style.backgroundColor = borderColor || '';
    }

    _makeBorderStyleButton() {
        const BORDER_PALETTE = [
            [null,      '#FFFFFF', '#F3F4F6', '#D1D5DB', '#9CA3AF', '#6B7280', '#111827'],
            ['#FEE2E2', '#FCA5A5', '#F87171', '#EF4444', '#DC2626', '#B91C1C', '#7F1D1D'],
            ['#FEF3C7', '#FDE68A', '#FCD34D', '#FBBF24', '#F59E0B', '#D97706', '#78350F'],
            ['#D1FAE5', '#6EE7B7', '#34D399', '#10B981', '#059669', '#047857', '#064E3B'],
            ['#DBEAFE', '#93C5FD', '#60A5FA', '#3B82F6', '#2563EB', '#1D4ED8', '#1E3A8A'],
            ['#EDE9FE', '#C4B5FD', '#A78BFA', '#8B5CF6', '#7C3AED', '#6D28D9', '#4C1D95'],
        ];

        const STYLE_ICONS = {
            solid: `<svg width="22" height="8" viewBox="0 0 22 8"><line x1="1" y1="4" x2="21" y2="4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
            dashed: `<svg width="22" height="8" viewBox="0 0 22 8"><line x1="1" y1="4" x2="21" y2="4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="6 4"/></svg>`,
            dotted: `<svg width="22" height="8" viewBox="0 0 22 8"><line x1="1" y1="4" x2="21" y2="4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="2 4"/></svg>`,
        };

        this._borderStyleData = { style: 'solid', width: 2, opacity: 100, color: '#000000' };
        this._customColors = [];

        const wrapper = document.createElement('div');
        wrapper.className = 'ipp-border-style-wrapper';

        const btn = document.createElement('button');
        btn.className = 'ipp-btn';
        btn.title = 'Рамка';
        btn.dataset.id = 'ipp-btn-circleCrop';
        btn.innerHTML = ICONS.frame;
        this._btn_circleCrop = btn;

        const popover = document.createElement('div');
        popover.className = 'ipp-border-style-popover';
        this._borderStylePopover = popover;

        // --- Секция: стиль линии ---
        const styleRow = document.createElement('div');
        styleRow.className = 'ipp-bs-style-row';
        this._bsStyleBtns = {};

        ['solid', 'dashed', 'dotted'].forEach(type => {
            const sb = document.createElement('button');
            sb.className = 'ipp-bs-style-btn' + (type === 'solid' ? ' is-active' : '');
            sb.dataset.bsStyle = type;
            sb.title = type === 'solid' ? 'Сплошная' : type === 'dashed' ? 'Пунктир' : 'Мелкий пунктир';
            sb.innerHTML = STYLE_ICONS[type];
            sb.addEventListener('click', (e) => {
                e.stopPropagation();
                Object.values(this._bsStyleBtns).forEach(b => b.classList.remove('is-active'));
                this._borderStyleData.style = type;
                sb.classList.add('is-active');
                this._applyBorder();
            });
            this._bsStyleBtns[type] = sb;
            styleRow.appendChild(sb);
        });

        const stopEv = (e) => e.stopPropagation();

        // --- Секция: толщина ---
        const thickSection = document.createElement('div');
        thickSection.className = 'ipp-bs-section';

        const thickHeader = document.createElement('div');
        thickHeader.className = 'ipp-bs-row-header';
        const thickLabel = document.createElement('span');
        thickLabel.className = 'ipp-bs-label';
        thickLabel.textContent = 'Thickness';
        const thickValue = document.createElement('span');
        thickValue.className = 'ipp-bs-value';
        thickValue.textContent = '2px';
        thickHeader.appendChild(thickLabel);
        thickHeader.appendChild(thickValue);

        const thickSlider = document.createElement('input');
        thickSlider.type = 'range';
        thickSlider.id = 'ipp-bs-thick-slider';
        thickSlider.className = 'ipp-bs-slider';
        thickSlider.min = '0';
        thickSlider.max = '10';
        thickSlider.value = '2';
        this._bsThickSlider = thickSlider;
        this._bsThickValue = thickValue;

        const updateThickFill = () => {
            const pct = Math.round((parseInt(thickSlider.value, 10) / 10) * 100);
            thickSlider.style.background = `linear-gradient(to right, #444ce7 0%, #444ce7 ${pct}%, #E5E7EB ${pct}%, #E5E7EB 100%)`;
        };

        [thickSlider].forEach(el => {
            el.addEventListener('mousedown', stopEv);
            el.addEventListener('touchstart', stopEv);
            el.addEventListener('keydown', stopEv);
        });
        thickSlider.addEventListener('input', (e) => {
            e.stopPropagation();
            const val = parseInt(thickSlider.value, 10) || 0;
            this._borderStyleData.width = val;
            thickValue.textContent = `${val}px`;
            updateThickFill();
            this._applyBorder();
        });

        thickSection.appendChild(thickHeader);
        thickSection.appendChild(thickSlider);

        // --- Секция: прозрачность ---
        const opacSection = document.createElement('div');
        opacSection.className = 'ipp-bs-section';

        const opacHeader = document.createElement('div');
        opacHeader.className = 'ipp-bs-row-header';
        const opacLabel = document.createElement('span');
        opacLabel.className = 'ipp-bs-label';
        opacLabel.textContent = 'Opacity';
        const opacValue = document.createElement('span');
        opacValue.className = 'ipp-bs-value';
        opacValue.textContent = '100%';
        opacHeader.appendChild(opacLabel);
        opacHeader.appendChild(opacValue);

        const opacSlider = document.createElement('input');
        opacSlider.type = 'range';
        opacSlider.id = 'ipp-bs-opac-slider';
        opacSlider.className = 'ipp-bs-slider';
        opacSlider.min = '0';
        opacSlider.max = '100';
        opacSlider.value = '100';
        this._bsOpacSlider = opacSlider;
        this._bsOpacValue = opacValue;

        const updateOpacFill = () => {
            const val = parseInt(opacSlider.value, 10) || 0;
            opacSlider.style.background = `linear-gradient(to right, #444ce7 0%, #444ce7 ${val}%, #E5E7EB ${val}%, #E5E7EB 100%)`;
        };

        [opacSlider].forEach(el => {
            el.addEventListener('mousedown', stopEv);
            el.addEventListener('touchstart', stopEv);
            el.addEventListener('keydown', stopEv);
        });
        opacSlider.addEventListener('input', (e) => {
            e.stopPropagation();
            const val = parseInt(opacSlider.value, 10) || 0;
            this._borderStyleData.opacity = val;
            opacValue.textContent = `${val}%`;
            updateOpacFill();
            this._applyBorder();
        });

        opacSection.appendChild(opacHeader);
        opacSection.appendChild(opacSlider);

        // --- Секция: палитра цветов ---
        const colorSection = document.createElement('div');
        colorSection.className = 'ipp-bs-section';
        const colorLabel = document.createElement('span');
        colorLabel.className = 'ipp-bs-label';
        colorLabel.textContent = 'Border color';
        colorSection.appendChild(colorLabel);

        const palette = document.createElement('div');
        palette.className = 'ipp-bs-palette';
        this._bsPalette = palette;

        const createSwatch = (color, container) => {
            const swatch = document.createElement('button');
            swatch.className = 'ipp-bs-swatch';
            if (color === null) {
                swatch.classList.add('ipp-bs-swatch--none');
                swatch.title = 'Без рамки';
            } else {
                swatch.style.background = color;
                swatch.title = color;
            }
            if (color === this._borderStyleData.color) {
                swatch.classList.add('is-active');
            }
            swatch.addEventListener('click', (e) => {
                e.stopPropagation();
                popover.querySelectorAll('.ipp-bs-swatch.is-active').forEach(s => s.classList.remove('is-active'));
                this._borderStyleData.color = color;
                swatch.classList.add('is-active');
                this._applyBorder();
            });
            return swatch;
        };

        BORDER_PALETTE.forEach(row => {
            const rowEl = document.createElement('div');
            rowEl.className = 'ipp-bs-palette-row';
            row.forEach(color => rowEl.appendChild(createSwatch(color)));
            palette.appendChild(rowEl);
        });

        colorSection.appendChild(palette);

        // --- Секция: кастомные цвета ---
        const customSection = document.createElement('div');
        customSection.className = 'ipp-bs-section';
        const customLabel = document.createElement('span');
        customLabel.className = 'ipp-bs-label';
        customLabel.textContent = 'Custom colors';
        customSection.appendChild(customLabel);

        const customRow = document.createElement('div');
        customRow.className = 'ipp-bs-custom-row';
        this._bsCustomRow = customRow;

        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.style.cssText = 'position:absolute;width:0;height:0;opacity:0;pointer-events:none;';
        colorInput.value = '#000000';

        const addBtn = document.createElement('button');
        addBtn.className = 'ipp-bs-add-btn';
        addBtn.title = 'Добавить цвет';
        addBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path stroke="currentColor" stroke-width="1.5" stroke-linecap="round" d="M7 2v10M2 7h10"/></svg>`;
        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            colorInput.click();
        });

        colorInput.addEventListener('change', (e) => {
            e.stopPropagation();
            const color = colorInput.value;
            if (!this._customColors.includes(color)) {
                this._customColors.push(color);
                const swatch = createSwatch(color);
                customRow.insertBefore(swatch, addBtn);
            }
            popover.querySelectorAll('.ipp-bs-swatch.is-active').forEach(s => s.classList.remove('is-active'));
            this._borderStyleData.color = color;
            customRow.querySelectorAll('.ipp-bs-swatch').forEach(s => {
                if (s.title === color) s.classList.add('is-active');
            });
            this._applyBorder();
        });

        customRow.appendChild(addBtn);
        customRow.appendChild(colorInput);
        customSection.appendChild(customRow);

        // Собираем поповер сверху вниз: стиль → толщина → прозрачность → цвет → кастомные
        popover.appendChild(styleRow);
        popover.appendChild(thickSection);
        popover.appendChild(opacSection);
        popover.appendChild(colorSection);
        popover.appendChild(customSection);

        // Клик по кнопке
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isOpen = popover.classList.contains('is-open');

            document.querySelectorAll('.ipp-crop-dropdown.is-open, .ipp-more-dropdown.is-open, .ipp-border-radius-popover.is-open, .ipp-border-style-popover.is-open').forEach(el => {
                el.classList.remove('is-open');
            });
            document.querySelectorAll('.ipp-btn-split-expand.is-expanded, .ipp-btn.is-active').forEach(el => {
                el.classList.remove('is-expanded', 'is-active');
            });

            if (!isOpen) {
                if (this.currentId) {
                    const objects = this.core?.state?.getObjects ? this.core.state.getObjects() : [];
                    const obj = objects.find(o => o.id === this.currentId);
                    if (obj?.properties) {
                        const p = obj.properties;
                        if (p.borderStyle) this._borderStyleData.style = p.borderStyle;
                        if (p.borderWidth != null) this._borderStyleData.width = p.borderWidth;
                        if (p.borderOpacity != null) this._borderStyleData.opacity = p.borderOpacity;
                        if (p.borderColor !== undefined) this._borderStyleData.color = p.borderColor;

                        thickSlider.value = String(this._borderStyleData.width);
                        thickValue.textContent = `${this._borderStyleData.width}px`;
                        opacSlider.value = String(this._borderStyleData.opacity);
                        opacValue.textContent = `${this._borderStyleData.opacity}%`;

                        Object.values(this._bsStyleBtns).forEach(b => b.classList.remove('is-active'));
                        this._bsStyleBtns[this._borderStyleData.style]?.classList.add('is-active');

                        popover.querySelectorAll('.ipp-bs-swatch.is-active').forEach(s => s.classList.remove('is-active'));
                        popover.querySelectorAll('.ipp-bs-swatch').forEach(s => {
                            const matches = this._borderStyleData.color === null
                                ? s.classList.contains('ipp-bs-swatch--none')
                                : s.title === this._borderStyleData.color;
                            if (matches) s.classList.add('is-active');
                        });
                    }
                }
                updateThickFill();
                updateOpacFill();
                popover.classList.add('is-open');
                btn.classList.add('is-active');
            }
        });

        wrapper.appendChild(btn);
        wrapper.appendChild(popover);
        return wrapper;
    }

    _makeMoreButton() {
        const wrapper = document.createElement('div');
        wrapper.className = 'ipp-btn-wrapper';
        wrapper.style.position = 'relative';
        wrapper.style.display = 'inline-flex';

        const mainBtn = document.createElement('button');
        mainBtn.className = 'ipp-btn';
        mainBtn.title = 'Ещё';
        mainBtn.dataset.id = 'ipp-btn-more';
        mainBtn.innerHTML = ICONS.more;

        const dropdown = document.createElement('div');
        dropdown.className = 'ipp-more-dropdown';

        const infoPopover = document.createElement('div');
        infoPopover.className = 'ipp-info-popover';
        dropdown.appendChild(infoPopover);
        this._infoPopover = infoPopover;

        const items = [
            { id: 'copy', label: 'Копировать', shortcut: 'Ctrl+C' },
            { id: 'copy-link', label: 'Копировать ссылку на объект' },
            { id: 'link-to', label: 'Привязать к...' },
            { divider: true },
            { id: 'bring-front', label: 'На передний план', shortcut: ']' },
            { id: 'bring-forward', label: 'Переместить вперёд', shortcut: 'Ctrl+]' },
            { id: 'send-backward', label: 'Переместить назад', shortcut: 'Ctrl+[' },
            { id: 'send-back', label: 'На задний план', shortcut: '[' },
            { divider: true },
            { id: 'info', label: 'Информация', shortcut: '>' },
            { id: 'lock', label: 'Заблокировать', shortcut: 'Ctrl+Shift+L' },
            { id: 'duplicate', label: 'Дублировать', shortcut: 'Ctrl+D' },
            { divider: true },
            { id: 'add-comment', label: 'Добавить комментарий', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>' },
            { divider: true },
            { id: 'copy-png', label: 'Копировать как PNG', shortcut: 'Ctrl+Shift+C' },
            { id: 'save-template', label: 'Сохранить как шаблон' },
            { id: 'save-selection', label: 'Сохранить выделение как...' },
            { divider: true },
            { id: 'delete', label: 'Удалить', shortcut: 'Delete' },
        ];

        items.forEach(item => {
            if (item.divider) {
                const div = document.createElement('div');
                div.className = 'ipp-dropdown-divider';
                dropdown.appendChild(div);
                return;
            }

            const btn = document.createElement('button');
            btn.className = 'ipp-dropdown-item';
            if (item.id) btn.dataset.id = `ipp-more-${item.id}`;
            
            if (item.icon) {
                const iconSpan = document.createElement('span');
                iconSpan.className = 'ipp-dropdown-icon';
                iconSpan.innerHTML = item.icon;
                btn.appendChild(iconSpan);
            }
            
            const labelSpan = document.createElement('span');
            labelSpan.textContent = item.label;
            btn.appendChild(labelSpan);

            if (item.shortcut) {
                const shortcutSpan = document.createElement('span');
                shortcutSpan.className = 'ipp-dropdown-item-shortcut';
                shortcutSpan.textContent = item.shortcut;
                btn.appendChild(shortcutSpan);
            }

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (item.id === 'copy') {
                    this.eventBus.emit(Events.Keyboard.Copy);
                } else if (item.id === 'duplicate') {
                    this._duplicateImage();
                } else if (item.id === 'lock') {
                    this._toggleLocked();
                } else if (item.id === 'add-comment') {
                    if (this.currentId) {
                        this.eventBus.emit(Events.Comment.OpenImageDraft, { objectId: this.currentId });
                    }
                } else if (item.id === 'info') {
                    this._showInfoModal();
                    return;
                } else if (item.id === 'delete') {
                    if (this.currentId) {
                        this.eventBus.emit(Events.Tool.ObjectsDelete, { objects: [this.currentId] });
                    }
                }

                dropdown.classList.remove('is-open');
                mainBtn.classList.remove('is-active');
            });

            if (item.id === 'lock') {
                this._moreLockItem = btn;
                this._moreLockLabel = labelSpan;
            }

            if (item.id === 'info') {
                this._infoBtnEl = btn;
            }

            dropdown.appendChild(btn);
        });

        mainBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isOpen = dropdown.classList.contains('is-open');
            
            // Закрываем все другие дропдауны
            document.querySelectorAll('.ipp-crop-dropdown.is-open, .ipp-more-dropdown.is-open').forEach(el => {
                el.classList.remove('is-open');
            });
            document.querySelectorAll('.ipp-btn-split-expand.is-expanded, .ipp-btn.is-active').forEach(el => {
                el.classList.remove('is-expanded', 'is-active');
            });

            if (!isOpen) {
                dropdown.classList.add('is-open');
                mainBtn.classList.add('is-active');
            } else {
                infoPopover.classList.remove('is-open');
            }
        });

        wrapper.appendChild(mainBtn);
        wrapper.appendChild(dropdown);

        return wrapper;
    }

    _showInfoModal() {
        if (!this.currentId || !this._infoPopover) return;

        if (this._infoPopover.classList.contains('is-open')) {
            this._infoPopover.classList.remove('is-open');
            return;
        }

        const objects = this.core?.state?.getObjects ? this.core.state.getObjects() : [];
        const obj = objects.find(o => o.id === this.currentId);
        if (!obj) return;

        const formatDate = (iso) => {
            if (!iso) return null;
            try {
                const d = new Date(iso);
                if (isNaN(d.getTime())) return null;
                return d.toLocaleString('ru-RU', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                });
            } catch (_) {
                return null;
            }
        };

        const userName = this.currentUser?.name || this.currentUser?.username || null;
        const createdDate = formatDate(obj.created || obj.properties?.createdAt);
        const updatedDate = formatDate(obj.updated || obj.properties?.updatedAt || obj.properties?.lastModified);

        const makeSection = (label, name, date) => {
            const section = document.createElement('div');
            section.className = 'ipp-info-section';

            const labelEl = document.createElement('div');
            labelEl.className = 'ipp-info-section__label';
            labelEl.textContent = label;

            const nameEl = document.createElement('div');
            nameEl.className = 'ipp-info-section__name';
            nameEl.textContent = name || '—';

            section.appendChild(labelEl);
            section.appendChild(nameEl);

            if (date) {
                const dateEl = document.createElement('div');
                dateEl.className = 'ipp-info-section__date';
                dateEl.textContent = date;
                section.appendChild(dateEl);
            }

            return section;
        };

        this._infoPopover.innerHTML = '';
        this._infoPopover.appendChild(makeSection('Кем создан:', userName, createdDate));
        this._infoPopover.appendChild(makeSection('Последний раз изменён:', userName, updatedDate));

        if (this._infoBtnEl) {
            this._infoPopover.style.top = `${this._infoBtnEl.offsetTop}px`;
        }

        this._infoPopover.classList.add('is-open');
    }

    _makeButton(iconHtml, title, key) {
        const btn = document.createElement('button');
        btn.className = 'ipp-btn';
        btn.title = title;
        if (key) btn.dataset.id = `ipp-btn-${key}`;
        btn.innerHTML = iconHtml;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
        return btn;
    }

    _downloadImage() {
        if (!this.currentId) return;

        const objects = this.core?.state?.getObjects ? this.core.state.getObjects() : [];
        const obj = objects.find(o => o.id === this.currentId);
        const url = obj?.src;
        if (!url || url.startsWith('blob:')) return;

        const name = this._fileNameEl?.textContent?.trim() || obj?.properties?.name || obj?.properties?.fileName || 'image.png';
        const borderRadius = obj?.properties?.borderRadius || 0;
        const pngName = name.replace(/\.[^.]+$/, '') + '.png';

        const triggerDownload = (href, filename) => {
            const a = document.createElement('a');
            a.href = href;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        };

        const fallback = () => {
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        };

        if (borderRadius <= 0) {
            fetch(url)
                .then(r => r.blob())
                .then(blob => {
                    const blobUrl = URL.createObjectURL(blob);
                    triggerDownload(blobUrl, name);
                    URL.revokeObjectURL(blobUrl);
                })
                .catch(fallback);
            return;
        }

        // Рендерим через PIXI — гарантированно то же, что видно на доске.
        // Создаём временный Sprite из той же текстуры, накладываем маску
        // по той же формуле что _applyRoundedMask, рендерим в RenderTexture.
        const pixiObject = this.core?.pixi?.objects?.get(this.currentId);
        const renderer = this.core?.pixi?.app?.renderer;

        if (pixiObject && renderer && renderer.extract) {
            try {
                const texture = pixiObject.texture;
                if (!texture || !texture.baseTexture) throw new Error('no texture');

                const tw = texture.width;
                const th = texture.height;
                const sx = Math.abs(pixiObject.scale?.x || 1);
                const sy = Math.abs(pixiObject.scale?.y || 1);

                // Радиус в пикселях текстуры — та же формула, что в _applyRoundedMask
                const localR = Math.min(
                    borderRadius / Math.min(sx || 1, sy || 1),
                    Math.floor(Math.min(tw, th) / 2)
                );

                const tempSprite = new PIXI.Sprite(texture);
                // anchor(0.5) как у исходного спрайта; позиция — центр области рендера
                tempSprite.anchor.set(0.5);
                tempSprite.position.set(tw / 2, th / 2);

                const maskG = new PIXI.Graphics();
                maskG.beginFill(0xffffff);
                maskG.drawRoundedRect(-tw / 2, -th / 2, tw, th, localR);
                maskG.endFill();
                tempSprite.addChild(maskG);
                tempSprite.mask = maskG;

                const renderTexture = PIXI.RenderTexture.create({ width: tw, height: th });
                renderer.render(tempSprite, { renderTexture });

                const canvas = renderer.extract.canvas(renderTexture);

                renderTexture.destroy(true);
                tempSprite.destroy({ children: true });

                canvas.toBlob(blob => {
                    if (!blob) { fallback(); return; }
                    const blobUrl = URL.createObjectURL(blob);
                    triggerDownload(blobUrl, pngName);
                    URL.revokeObjectURL(blobUrl);
                }, 'image/png');
                return;
            } catch (_e) {
                // CORS или другая ошибка — переходим к 2D-canvas fallback
            }
        }

        // 2D-canvas fallback: грузим оригинал и применяем ту же формулу радиуса
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const w = img.naturalWidth;
            const h = img.naturalHeight;

            const sx = Math.abs(pixiObject?.scale?.x || 1);
            const sy = Math.abs(pixiObject?.scale?.y || 1);
            const scaledRadius = borderRadius / Math.min(sx || 1, sy || 1);

            const maxR = Math.floor(Math.min(w, h) / 2);
            const r = Math.max(0, Math.min(Math.round(scaledRadius), maxR));

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');

            ctx.beginPath();
            ctx.moveTo(r, 0);
            ctx.lineTo(w - r, 0);
            ctx.quadraticCurveTo(w, 0, w, r);
            ctx.lineTo(w, h - r);
            ctx.quadraticCurveTo(w, h, w - r, h);
            ctx.lineTo(r, h);
            ctx.quadraticCurveTo(0, h, 0, h - r);
            ctx.lineTo(0, r);
            ctx.quadraticCurveTo(0, 0, r, 0);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(img, 0, 0, w, h);

            canvas.toBlob(blob => {
                if (!blob) { fallback(); return; }
                const blobUrl = URL.createObjectURL(blob);
                triggerDownload(blobUrl, pngName);
                URL.revokeObjectURL(blobUrl);
            }, 'image/png');
        };
        img.onerror = fallback;
        img.src = url;
    }

    _makeDivider() {
        const div = document.createElement('div');
        div.className = 'ipp-divider';
        return div;
    }

    _duplicateImage() {
        if (!this.currentId) return;

        const posData = { objectId: this.currentId, position: null };
        const sizeData = { objectId: this.currentId, size: null };
        this.eventBus.emit(Events.Tool.GetObjectPosition, posData);
        this.eventBus.emit(Events.Tool.GetObjectSize, sizeData);

        if (!posData.position || !sizeData.size) return;

        const originalId = this.currentId;
        const newPos = {
            x: posData.position.x + sizeData.size.width + 14,
            y: posData.position.y
        };

        const onReady = (data) => {
            if (!data || data.originalId !== originalId) return;
            this.eventBus.off(Events.Tool.DuplicateReady, onReady);
            this._selectObject(data.newId);
            this._fitDuplicateInView();
        };
        this.eventBus.on(Events.Tool.DuplicateReady, onReady);

        this.eventBus.emit(Events.Tool.DuplicateRequest, {
            originalId,
            position: newPos
        });
    }

    _selectObject(objectId) {
        if (!objectId) return;
        const selectTool = this.core?.selectTool;
        if (!selectTool || typeof selectTool.setSelection !== 'function') return;
        selectTool.setSelection([objectId]);
        if (typeof selectTool.updateResizeHandles === 'function') {
            selectTool.updateResizeHandles();
        }
    }

    _fitDuplicateInView() {
        const worldLayer = this.core?.pixi?.worldLayer;
        const view = this.core?.pixi?.app?.view;
        if (!worldLayer || !view) return;

        const objects = this.core?.state?.state?.objects || [];
        let minX = Infinity, maxX = -Infinity, minY = Infinity;
        for (const o of objects) {
            if (!o || o.type !== 'image' || !o.position) continue;
            const w = Number(o.properties?.width) || 0;
            const h = Number(o.properties?.height) || 0;
            if (w <= 0 || h <= 0) continue;
            if (o.position.x < minX) minX = o.position.x;
            if (o.position.x + w > maxX) maxX = o.position.x + w;
            if (o.position.y < minY) minY = o.position.y;
        }
        if (!Number.isFinite(minX) || !Number.isFinite(maxX)) return;

        const scale = worldLayer.scale?.x || 1;
        const viewW = view.clientWidth;
        const padding = 14;
        const blockWidthWorld = maxX - minX;

        const screenRight = maxX * scale + worldLayer.x;

        // Дубликат (правый край ряда) уже виден с зазором — ничего не делаем
        if (screenRight <= viewW - padding) return;

        const fitsByWidth = blockWidthWorld * scale <= viewW - 2 * padding;

        if (fitsByWidth) {
            // Ряд помещается по ширине — достаточно сдвинуть камеру влево (Y не трогаем)
            worldLayer.x = Math.round(worldLayer.x - (screenRight - (viewW - padding)));
            this.eventBus.emit(Events.Viewport.Changed);
            return;
        }

        // Ряд шире viewport — zoom out до вмещения по ширине, верхний край сохраняем на месте
        const newScale = Math.max(0.01, Math.min(scale, (viewW - 2 * padding) / blockWidthWorld));
        const screenTop = minY * scale + worldLayer.y;

        worldLayer.scale.set(newScale);
        worldLayer.x = Math.round(padding - minX * newScale);
        worldLayer.y = Math.round(screenTop - minY * newScale);

        this.eventBus.emit(Events.UI.ZoomPercent, { percentage: Math.round(newScale * 100) });
        this.eventBus.emit(Events.Viewport.Changed);
    }

    _updateFileName() {
        if (!this.currentId || !this._fileNameEl) return;

        const objects = this.core?.state?.getObjects ? this.core.state.getObjects() : [];
        const obj = objects.find(o => o.id === this.currentId);
        const name = obj?.properties?.name || obj?.properties?.fileName || 'image.png';
        this._fileNameEl.textContent = name;
    }

    reposition() {
        if (!this.currentId || !this.panel || this.panel.style.display === 'none') return;

        const ids = this.core?.selectTool
            ? Array.from(this.core.selectTool.selectedObjects || [])
            : [];
        if (!ids.includes(this.currentId)) {
            this.hide();
            return;
        }

        const posData = { objectId: this.currentId, position: null };
        const sizeData = { objectId: this.currentId, size: null };
        this.eventBus.emit(Events.Tool.GetObjectPosition, posData);
        this.eventBus.emit(Events.Tool.GetObjectSize, sizeData);

        if (!posData.position || !sizeData.size) return;

        const worldLayer = this.core?.pixi?.worldLayer;
        const scale = worldLayer?.scale?.x || 1;
        const worldX = worldLayer?.x || 0;
        const worldY = worldLayer?.y || 0;

        const screenX = posData.position.x * scale + worldX;
        const screenY = posData.position.y * scale + worldY;
        const objectWidth = sizeData.size.width * scale;

        const panelWidth = this.panel.offsetWidth || 300;
        const panelHeight = this.panel.offsetHeight || 36;
        const panelX = screenX + objectWidth / 2 - panelWidth / 2;
        let panelY = screenY - panelHeight - 12;

        const containerRect = this.container.getBoundingClientRect();
        const finalX = Math.max(10, Math.min(panelX, containerRect.width - panelWidth - 10));
        const finalY = Math.max(55, panelY);

        this.panel.style.left = `${Math.round(finalX)}px`;
        this.panel.style.top = `${Math.round(finalY)}px`;
    }

    destroy() {
        if (!this.eventBus || !this._handlers) return;

        this.eventBus.off(Events.Tool.SelectionAdd, this._handlers.onSelectionAdd);
        this.eventBus.off(Events.Tool.SelectionRemove, this._handlers.onSelectionRemove);
        this.eventBus.off(Events.Tool.SelectionClear, this._handlers.onSelectionClear);
        this.eventBus.off(Events.Object.Deleted, this._handlers.onDeleted);
        this.eventBus.off(Events.Tool.DragStart, this._handlers.onDragStart);
        this.eventBus.off(Events.Tool.DragUpdate, this._handlers.onDragUpdate);
        this.eventBus.off(Events.Tool.DragEnd, this._handlers.onDragEnd);
        this.eventBus.off(Events.Tool.GroupDragStart, this._handlers.onGroupDragStart);
        this.eventBus.off(Events.Tool.GroupDragUpdate, this._handlers.onGroupDragUpdate);
        this.eventBus.off(Events.Tool.GroupDragEnd, this._handlers.onGroupDragEnd);
        this.eventBus.off(Events.Tool.ResizeUpdate, this._handlers.onResizeUpdate);
        this.eventBus.off(Events.Tool.RotateUpdate, this._handlers.onRotateUpdate);
        this.eventBus.off(Events.UI.ZoomPercent, this._handlers.onZoomPercent);
        this.eventBus.off(Events.Tool.PanUpdate, this._handlers.onPanUpdate);
        this.eventBus.off(Events.Viewport.Changed, this._handlers.onViewportChanged);
        this.eventBus.off(Events.Tool.Activated, this._handlers.onActivated);
        this.eventBus.off(Events.Object.TransformUpdated, this._handlers.onTransformUpdated);
        
        if (this._handlers.onDocumentClick) {
            document.removeEventListener('click', this._handlers.onDocumentClick);
        }
        
        this._handlers = null;

        if (this.panel && this.panel.parentNode) {
            this.panel.parentNode.removeChild(this.panel);
        }
        this.panel = null;
        this.currentId = null;
    }
}
