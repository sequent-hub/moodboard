import { AiClient } from '../../services/ai/AiClient.js';
import { ChatHistoryStore } from '../../services/ai/ChatHistoryStore.js';
import { ChatSessionController } from '../../services/ai/ChatSessionController.js';

import { buildChatDom } from './ChatWindowRenderer.js';
import { ChatMessageList } from './ChatMessageList.js';
import { ChatComposer } from './ChatComposer.js';
import { ChatPillMenu } from './ChatPillMenu.js';
import { ChatExtendedPromptModal } from './ChatExtendedPromptModal.js';
import { ICONS, RATIO_ICONS, COUNT_ICONS } from './icons.js';

const CONTENT_TYPE_OPTIONS = [
    {
        id: 'image',
        label: 'Изображение',
        icon: ICONS.image,
        description: 'Создать по тексту или приложите ссылку'
    },
    {
        id: 'video',
        label: 'Видео',
        icon: ICONS.video,
        description: 'Создать по тексту или руководствуясь первым и последним кадром'
    }
];

/** Порядок: портрет (строка 1), авто + альбом (строка 2) — соответствует грид-меню */
const FORMAT_OPTIONS = [
    { id: '1:1',   label: '1:1',   icon: RATIO_ICONS['1:1']   },
    { id: '4:5',   label: '4:5',   icon: RATIO_ICONS['4:5']   },
    { id: '3:4',   label: '3:4',   icon: RATIO_ICONS['3:4']   },
    { id: '10:14', label: '10:14', icon: RATIO_ICONS['10:14'] },
    { id: '2:3',   label: '2:3',   icon: RATIO_ICONS['2:3']   },
    { id: '9:16',  label: '9:16',  icon: RATIO_ICONS['9:16']  },
    { id: '1:2',   label: '1:2',   icon: RATIO_ICONS['1:2']   },
    { id: 'auto',  label: 'Auto',  icon: RATIO_ICONS['auto']  },
    { id: '5:4',   label: '5:4',   icon: RATIO_ICONS['5:4']   },
    { id: '4:3',   label: '4:3',   icon: RATIO_ICONS['4:3']   },
    { id: '14:10', label: '14:10', icon: RATIO_ICONS['14:10'] },
    { id: '3:2',   label: '3:2',   icon: RATIO_ICONS['3:2']   },
    { id: '16:9',  label: '16:9',  icon: RATIO_ICONS['16:9']  },
    { id: '2:1',   label: '2:1',   icon: RATIO_ICONS['2:1']   },
];

const COUNT_OPTIONS = [
    { id: 'auto', label: 'Авто',          icon: COUNT_ICONS.auto },
    { id: '1',    label: '1 Изображение', icon: COUNT_ICONS[1]   },
    { id: '2',    label: '2 Изображения', icon: COUNT_ICONS[2]   },
    { id: '3',    label: '3 Изображения', icon: COUNT_ICONS[3]   },
    { id: '4',    label: '4 Изображения', icon: COUNT_ICONS[4]   },
];

const MODEL_OPTIONS = [
    {
        id: 'auto',
        label: 'Автоматический режим',
        icon: ICONS.sparkles,
        description: 'Мы подберем модель для ваших задач.'
    },
    {
        id: 'yandex',
        label: 'Алиса',
        icon: '<img src="/icons/alice.png" width="36" height="36" alt="Алиса" style="object-fit: contain;" />',
        description: 'YandexGPT'
    },
    {
        id: 'gpt',
        label: 'GPT',
        icon: '<img src="/icons/gpt.svg" width="36" height="36" alt="GPT" style="object-fit: contain;" />',
        description: 'OpenAI'
    },
    {
        id: 'google',
        label: 'Google',
        icon: '<img src="/icons/google.svg" width="36" height="36" alt="Google" style="object-fit: contain;" />',
        description: 'Gemini'
    },
    {
        id: 'qwen',
        label: 'Qwen',
        icon: '<img src="/icons/qwen.svg" width="36" height="36" alt="Qwen" style="object-fit: contain;" />',
        description: 'Alibaba'
    }
];

/**
 * Корневой контейнер чата ИИ-ассистента.
 *
 * Одна ответственность: lifecycle (`attach` → `detach` → `destroy`)
 * и wiring вспомогательных модулей. Никакой DOM-разметки и бизнес-логики
 * здесь нет — они в Renderer / Controller / Composer / MessageList /
 * PillMenu / SettingsPopup.
 *
 * Эквивалент по стилю — другие UI-классы в `src/ui/` (Topbar, Toolbar и т.п.).
 */
export class ChatWindow {
    /**
     * @param {HTMLElement} container - workspace-контейнер мудборда
     * @param {object} [options]
     * @param {AiClient} [options.aiClient]
     * @param {ChatHistoryStore} [options.historyStore]
     * @param {ChatSessionController} [options.sessionController]
     */
    constructor(container, options = {}) {
        this._container = container;
        this._options = options;

        this._aiClient = options.aiClient || new AiClient();
        this._historyStore = options.historyStore || new ChatHistoryStore();
        this._session = options.sessionController || new ChatSessionController({
            aiClient: this._aiClient,
            historyStore: this._historyStore
        });

        this._refs = null;
        this._messageList = null;
        this._composer = null;
        this._extendedPromptModal = null;
        this._contentTypeId = 'image';
        this._contentTypeMenu = null;
        this._modelId = 'auto';
        this._modelMenu = null;
        this._formatId = 'auto';
        this._formatMenu = null;
        this._countId = 'auto';
        this._countMenu = null;
        this._unsubscribe = null;
        this._attached = false;
    }

    attach() {
        if (this._attached) return;
        this._refs = buildChatDom();
        this._container.appendChild(this._refs.root);

        this._messageList = new ChatMessageList(this._refs.history);

        this._composer = new ChatComposer(
            { textarea: this._refs.textarea, send: this._refs.send, enhancePrompt: this._refs.enhancePrompt },
            {
                onSubmit: (text) => this._session.send(text),
                onAbort: () => this._session.abort()
            }
        );
        this._composer.attach();

        this._extendedPromptModal = new ChatExtendedPromptModal(
            this._container,
            this._refs.textarea,
            this._refs.extendPromptField
        );
        this._extendedPromptModal.attach();

        this._contentTypeMenu = new ChatPillMenu(
            {
                trigger: this._refs.contentTypePill,
                menu: this._refs.contentTypeMenu,
                label: this._refs.contentTypeLabel,
                icon: this._refs.contentTypeIcon
            },
            {
                getOptions: () => CONTENT_TYPE_OPTIONS,
                getActiveId: () => this._contentTypeId,
                onSelect: (id) => {
                    this._contentTypeId = id;
                    this._contentTypeMenu.refresh();
                }
            }
        );
        this._contentTypeMenu.attach();

        this._modelMenu = new ChatPillMenu(
            { trigger: this._refs.modelPill, menu: this._refs.modelMenu, label: this._refs.modelLabel, icon: this._refs.modelIcon },
            {
                getOptions: () => MODEL_OPTIONS,
                getActiveId: () => this._modelId,
                onSelect: (id) => {
                    this._modelId = id;
                    this._modelMenu.refresh();
                }
            }
        );
        this._modelMenu.attach();

        this._formatMenu = new ChatPillMenu(
            { trigger: this._refs.formatPill, menu: this._refs.formatMenu, label: this._refs.formatLabel },
            {
                getOptions: () => FORMAT_OPTIONS,
                getActiveId: () => this._formatId,
                onSelect: (id) => {
                    this._formatId = id;
                    this._formatMenu.refresh();
                    this._updateFormatPillIcon();
                    this._updateFormatPillLabel();
                }
            }
        );
        this._formatMenu.attach();

        this._countMenu = new ChatPillMenu(
            { trigger: this._refs.countPill, menu: this._refs.countMenu, label: this._refs.countLabel, icon: this._refs.countIcon },
            {
                getOptions: () => COUNT_OPTIONS,
                getActiveId: () => this._countId,
                onSelect: (id) => {
                    this._countId = id;
                    this._countMenu.refresh();
                    this._updateCountPillIcon();
                }
            }
        );
        this._countMenu.attach();

        this._unsubscribe = this._session.subscribe((state) => this._render(state));
        this._render(this._session.getState());

        this._loadProviders();

        this._attached = true;
    }

    detach() {
        if (!this._attached) return;
        if (this._unsubscribe) { this._unsubscribe(); this._unsubscribe = null; }
        this._composer?.destroy();
        this._extendedPromptModal?.destroy();
        this._contentTypeMenu?.destroy();
        this._modelMenu?.destroy();
        this._formatMenu?.destroy();
        this._countMenu?.destroy();
        if (this._refs?.root && this._refs.root.parentNode === this._container) {
            this._container.removeChild(this._refs.root);
        }
        this._refs = null;
        this._messageList = null;
        this._composer = null;
        this._extendedPromptModal = null;
        this._contentTypeMenu = null;
        this._modelMenu = null;
        this._formatMenu = null;
        this._countMenu = null;
        this._attached = false;
    }

    destroy() {
        this.detach();
    }

    _updateCountPillIcon() {
        const active = COUNT_OPTIONS.find((o) => o.id === this._countId);
        if (!active) return;
        const iconWrap = this._refs?.countPill?.querySelector('.moodboard-chat__pill-icon-wrap');
        if (iconWrap) iconWrap.innerHTML = active.icon;
    }

    _updateFormatPillIcon() {
        const iconWrap = this._refs?.formatPill?.querySelector('.moodboard-chat__pill-icon-wrap');
        if (!iconWrap) return;
        iconWrap.innerHTML = RATIO_ICONS[this._formatId] ?? ICONS.ratio;
    }

    _updateFormatPillLabel() {
        const labelEl = this._refs?.formatLabel;
        if (!labelEl) return;
        labelEl.textContent = this._formatId === 'auto' ? 'Соотношение сторон' : this._formatId;
    }

    async _loadProviders() {
        try {
            const list = await this._aiClient.listProviders();
            this._session.setAvailableProviders(list);
        } catch (err) {
            console.warn('[ChatWindow] cannot load providers:', err.message);
            this._session.setAvailableProviders([]);
        }
    }

    _render(state) {
        if (!this._attached && !this._refs) return;
        this._messageList.render(state.messages);
        this._contentTypeMenu.refresh();
        this._modelMenu.refresh();
        this._formatMenu.refresh();
        this._updateFormatPillIcon();
        this._updateFormatPillLabel();
        this._countMenu.refresh();
        this._updateCountPillIcon();
        this._composer.setStreaming(state.status === 'streaming');
    }
}
