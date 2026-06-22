import { Events } from '../../core/events/Events.js';
import { createLinkButton } from './TextLinkControl.js';

const ICON_LOCK = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5.75 11.75C5.75 11.1977 6.19772 10.75 6.75 10.75H17.25C17.8023 10.75 18.25 11.1977 18.25 11.75V17.25C18.25 18.3546 17.3546 19.25 16.25 19.25H7.75C6.64543 19.25 5.75 18.3546 5.75 17.25V11.75Z"></path><path d="M7.75008 10.5V10.3427C7.75008 8.78147 7.65615 7.04125 8.74654 5.9239C9.36837 5.2867 10.3746 4.75 12.0001 4.75C13.6256 4.75 14.6318 5.2867 15.2536 5.9239C16.344 7.04125 16.2501 8.78147 16.2501 10.3427V10.5"></path><path d="M12 14.25L12 15.75"></path></svg>`;
const ICON_UNLOCK = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5.75 11.75C5.75 11.1977 6.19772 10.75 6.75 10.75H17.25C17.8023 10.75 18.25 11.1977 18.25 11.75V17.25C18.25 18.3546 17.3546 19.25 16.25 19.25H7.75C6.64543 19.25 5.75 18.3546 5.75 17.25V11.75Z"></path><path d="M7.74972 10.5V9.84343C7.74972 8.61493 7.70065 7.29883 8.42388 6.30578C8.99834 5.51699 10.0565 4.75 11.9997 4.75C13.9997 4.75 15.2497 6.25 15.2497 6.25"></path><path d="M12 14.25L12 15.75"></path></svg>`;
const ICON_MORE = `<svg width="24" height="24" viewBox="0 0 22 22" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M16.2246 12.375C16.984 12.375 17.5996 11.7594 17.5996 11C17.5996 10.2406 16.984 9.625 16.2246 9.625C15.4652 9.625 14.8496 10.2406 14.8496 11C14.8496 11.7594 15.4652 12.375 16.2246 12.375Z"></path><path d="M11 12.375C11.7594 12.375 12.375 11.7594 12.375 11C12.375 10.2406 11.7594 9.625 11 9.625C10.2406 9.625 9.625 10.2406 9.625 11C9.625 11.7594 10.2406 12.375 11 12.375Z"></path><path d="M5.77539 12.375C6.53478 12.375 7.15039 11.7594 7.15039 11C7.15039 10.2406 6.53478 9.625 5.77539 9.625C5.016 9.625 4.40039 10.2406 4.40039 11C4.40039 11.7594 5.016 12.375 5.77539 12.375Z"></path></svg>`;
const ICON_COMMENT = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;

/**
 * Добавляет к text-properties-panel кнопку lock + кнопку more с дропдауном.
 * Поведение идентично lock / more в ImagePropertiesPanel; идентификаторы с префиксом tpp-.
 */
export function createTextLockMoreControls(panelInstance, panel) {
    // Все уже добавленные дочерние элементы скрываются при locked
    panelInstance._lockableEls = Array.from(panel.children);
    panelInstance._tppLockIcon = ICON_LOCK;
    panelInstance._tppUnlockIcon = ICON_UNLOCK;

    const linkBtn = createLinkButton(panelInstance);
    panel.appendChild(linkBtn);

    const divider1 = document.createElement('div');
    divider1.className = 'ipp-divider';
    panel.appendChild(divider1);

    const lockBtn = document.createElement('button');
    lockBtn.className = 'ipp-btn';
    lockBtn.title = 'Заблокировать';
    lockBtn.id = 'tpp-btn-lock';
    lockBtn.dataset.id = 'tpp-btn-lock';
    lockBtn.innerHTML = ICON_LOCK;
    lockBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        panelInstance._toggleLocked();
    });
    panel.appendChild(lockBtn);
    panelInstance._tppBtnLock = lockBtn;

    const divider = document.createElement('div');
    divider.className = 'ipp-divider';
    panel.appendChild(divider);

    const moreWrapper = _makeMoreWrapper(panelInstance);
    panel.appendChild(moreWrapper);
    panelInstance._tppMoreGroup = moreWrapper;
}

function _makeMoreWrapper(panelInstance) {
    const wrapper = document.createElement('div');
    wrapper.className = 'tpp-btn-wrapper';
    wrapper.dataset.id = 'tpp-btn-wrapper';
    wrapper.style.cssText = 'position:relative;display:inline-flex;';

    const mainBtn = document.createElement('button');
    mainBtn.className = 'ipp-btn';
    mainBtn.title = 'Ещё';
    mainBtn.id = 'tpp-btn-more';
    mainBtn.dataset.id = 'tpp-btn-more';
    mainBtn.innerHTML = ICON_MORE;

    const dropdown = document.createElement('div');
    dropdown.className = 'tpp-more-dropdown';

    const items = [
        { id: 'copy', label: 'Копировать', shortcut: 'Ctrl+C' },
        { id: 'copy-link', label: 'Копировать ссылку на объект' },
        { divider: true },
        { id: 'bring-front', label: 'На передний план', shortcut: ']' },
        { id: 'bring-forward', label: 'Переместить вперёд', shortcut: 'Ctrl+]' },
        { id: 'send-backward', label: 'Переместить назад', shortcut: 'Ctrl+[' },
        { id: 'send-back', label: 'На задний план', shortcut: '[' },
        { divider: true },
        { id: 'lock', label: 'Заблокировать', shortcut: 'Ctrl+Shift+L' },
        { id: 'duplicate', label: 'Дублировать', shortcut: 'Ctrl+D' },
        { divider: true },
        { id: 'add-comment', label: 'Добавить комментарий', icon: ICON_COMMENT },
        { divider: true },
        { id: 'delete', label: 'Удалить', shortcut: 'Delete' },
    ];

    items.forEach((item) => {
        if (item.divider) {
            const div = document.createElement('div');
            div.className = 'tpp-dropdown-divider';
            dropdown.appendChild(div);
            return;
        }

        const btn = document.createElement('button');
        btn.className = 'tpp-dropdown-item';
        if (item.id) btn.dataset.id = `tpp-more-${item.id}`;

        if (item.icon) {
            const iconSpan = document.createElement('span');
            iconSpan.className = 'tpp-dropdown-icon';
            iconSpan.innerHTML = item.icon;
            btn.appendChild(iconSpan);
        }

        const labelSpan = document.createElement('span');
        labelSpan.textContent = item.label;
        btn.appendChild(labelSpan);

        if (item.shortcut) {
            const shortcutSpan = document.createElement('span');
            shortcutSpan.className = 'tpp-dropdown-item-shortcut';
            shortcutSpan.textContent = item.shortcut;
            btn.appendChild(shortcutSpan);
        }

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const { eventBus, currentId } = panelInstance;

            if (item.id === 'copy') {
                eventBus.emit(Events.Keyboard.Copy);
            } else if (item.id === 'bring-front') {
                if (currentId) eventBus.emit(Events.UI.LayerBringToFront, { objectId: currentId });
            } else if (item.id === 'bring-forward') {
                if (currentId) eventBus.emit(Events.UI.LayerBringForward, { objectId: currentId });
            } else if (item.id === 'send-backward') {
                if (currentId) eventBus.emit(Events.UI.LayerSendBackward, { objectId: currentId });
            } else if (item.id === 'send-back') {
                if (currentId) eventBus.emit(Events.UI.LayerSendToBack, { objectId: currentId });
            } else if (item.id === 'lock') {
                panelInstance._toggleLocked();
            } else if (item.id === 'duplicate') {
                panelInstance._duplicateText();
            } else if (item.id === 'add-comment') {
                if (currentId) eventBus.emit(Events.Comment.OpenImageDraft, { objectId: currentId });
            } else if (item.id === 'delete') {
                if (currentId) eventBus.emit(Events.Tool.ObjectsDelete, { objects: [currentId] });
            }

            dropdown.classList.remove('is-open');
            mainBtn.classList.remove('is-active');
        });

        if (item.id === 'lock') {
            panelInstance._moreLockLabel = labelSpan;
        }

        dropdown.appendChild(btn);
    });

    mainBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isOpen = dropdown.classList.contains('is-open');

        document.querySelectorAll('.tpp-more-dropdown.is-open').forEach((el) => el.classList.remove('is-open'));
        document.querySelectorAll('.ipp-btn.is-active').forEach((el) => el.classList.remove('is-active'));

        if (!isOpen) {
            const rect = mainBtn.getBoundingClientRect();
            dropdown.style.top = (rect.bottom + 6) + 'px';
            dropdown.style.left = (rect.right - 220) + 'px';
            dropdown.classList.add('is-open');
            requestAnimationFrame(() => {
                const left = Math.max(4, rect.right - dropdown.offsetWidth);
                dropdown.style.left = left + 'px';
            });
            mainBtn.classList.add('is-active');
        }
    });

    wrapper.appendChild(mainBtn);
    wrapper.appendChild(dropdown);
    return wrapper;
}
