import { Events } from '../../core/events/Events.js';

export class ReactionsPopupController {
    constructor(toolbar) {
        this.toolbar = toolbar;
    }

    createReactionsPopup() {
        this.toolbar.reactionsPopupEl = document.createElement('div');
        this.toolbar.reactionsPopupEl.className = 'moodboard-toolbar__popup moodboard-toolbar__popup--reactions';
        this.toolbar.reactionsPopupEl.style.display = 'none';

        const grid = document.createElement('div');
        grid.className = 'moodboard-reactions__grid';

        const stickerUrls = import.meta.glob('../../assets/reactions/*.svg', { eager: true, query: '?url', import: 'default' });

        const entries = Object.entries(stickerUrls).sort(([a], [b]) => a.localeCompare(b));

        if (entries.length === 0) {
            const msg = document.createElement('div');
            msg.className = 'moodboard-reactions__empty';
            msg.textContent = 'Стикеры не найдены';
            grid.appendChild(msg);
        } else {
            entries.forEach(([path, src]) => {
                const btn = document.createElement('button');
                btn.className = 'moodboard-reactions__btn';
                const fileName = path.split('/').pop().replace(/\.[^.]+$/, '');
                btn.title = fileName;

                const img = document.createElement('img');
                img.className = 'moodboard-reactions__img';
                img.src = src;
                img.alt = fileName;
                btn.appendChild(img);

                btn.addEventListener('click', () => {
                    this.toolbar.animateButton(btn);
                    this.toolbar.eventBus.emit(Events.Place.Set, {
                        type: 'image',
                        properties: { src, width: 64, height: 64, isEmojiIcon: true, isReaction: true },
                        size: { width: 64, height: 64 }
                    });
                    this.closeReactionsPopup();
                });

                grid.appendChild(btn);
            });
        }

        this.toolbar.reactionsPopupEl.appendChild(grid);
        this.toolbar.container.appendChild(this.toolbar.reactionsPopupEl);
    }

    toggleReactionsPopup(anchorButton) {
        if (!this.toolbar.reactionsPopupEl) return;
        if (this.toolbar.reactionsPopupEl.style.display === 'none') {
            this.openReactionsPopup(anchorButton);
        } else {
            this.closeReactionsPopup();
        }
    }

    openReactionsPopup(anchorButton) {
        if (!this.toolbar.reactionsPopupEl) return;
        const toolbarRect = this.toolbar.container.getBoundingClientRect();
        const buttonRect = anchorButton.getBoundingClientRect();
        const left = this.toolbar.element.offsetWidth + 8;
        this.toolbar.reactionsPopupEl.style.visibility = 'hidden';
        this.toolbar.reactionsPopupEl.style.display = 'block';
        const desiredTop = buttonRect.top - toolbarRect.top - 4;
        const popupHeight = this.toolbar.reactionsPopupEl.offsetHeight;
        const containerHeight = this.toolbar.container.clientHeight || toolbarRect.height;
        const minTop = 8;
        const maxTop = Math.max(minTop, containerHeight - popupHeight - 8);
        const top = Math.min(Math.max(minTop, desiredTop), maxTop);
        this.toolbar.reactionsPopupEl.style.top = `${Math.round(top)}px`;
        this.toolbar.reactionsPopupEl.style.left = `${Math.round(left)}px`;
        this.toolbar.reactionsPopupEl.style.visibility = 'visible';
    }

    closeReactionsPopup() {
        if (this.toolbar.reactionsPopupEl) {
            this.toolbar.reactionsPopupEl.style.display = 'none';
        }
    }
}
