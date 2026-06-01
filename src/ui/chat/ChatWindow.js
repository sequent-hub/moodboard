import { AiClient } from '../../services/ai/AiClient.js';
import { ChatHistoryStore } from '../../services/ai/ChatHistoryStore.js';
import { ChatSessionController } from '../../services/ai/ChatSessionController.js';
import { Events } from '../../core/events/Events.js';

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
        this._boardCore = options.boardCore || null;

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
        this._boardImageMessageIds = new Set();
        // Упорядоченный список ID объектов на доске, размещённых через AI-генерацию.
        // Используется для сдвига предыдущих изображений влево при новой генерации.
        this._boardAiImageIds = [];
        this._shiftedForPendingMessageIds = new Set();
        this._pendingShiftCount = 0;
        this._pendingOverlayEls = [];
        this._onBoardObjectCreated = (data) => {
            if (data?.objectData?.properties?.name === 'ai-generated.jpg') {
                this._boardAiImageIds.push(data.objectId);
            }
        };
    }

    attach() {
        if (this._attached) return;
        this._refs = buildChatDom();
        this._container.appendChild(this._refs.root);

        this._messageList = new ChatMessageList(this._refs.history);

        this._composer = new ChatComposer(
            {
                textarea: this._refs.textarea,
                send: this._refs.send,
                attach: this._refs.attach,
                fileInput: this._refs.fileInput,
                attachmentsPreview: this._refs.attachmentsPreview,
                enhancePrompt: this._refs.enhancePrompt,
                statusBar: this._refs.statusBar
            },
            {
                onSubmit: (text, attachments) => this._session.send(text, this._getImageRequestOptions()),
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

        this._boardCore?.eventBus?.on?.(Events.Object.Created, this._onBoardObjectCreated);

        const initialState = this._session.getState();
        this._markExistingBoardImages(initialState.messages);
        this._unsubscribe = this._session.subscribe((state) => this._render(state));
        this._render(initialState);

        this._loadProviders();

        this._attached = true;
    }

    detach() {
        if (!this._attached) return;
        this._clearPendingOverlays();
        if (this._unsubscribe) { this._unsubscribe(); this._unsubscribe = null; }
        this._boardCore?.eventBus?.off?.(Events.Object.Created, this._onBoardObjectCreated);
        this._boardAiImageIds = [];
        this._shiftedForPendingMessageIds.clear();
        this._pendingShiftCount = 0;
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
        this._syncGeneratedImagesToBoard(state.messages);
        this._messageList.render(state.messages);
        this._contentTypeMenu.refresh();
        this._modelMenu.refresh();
        this._formatMenu.refresh();
        this._updateFormatPillIcon();
        this._updateFormatPillLabel();
        this._countMenu.refresh();
        this._updateCountPillIcon();
        this._composer.setStreaming(state.status === 'streaming');
        this._updatePendingImages(state.status === 'streaming' ? state.messages : []);
    }

    _updatePendingImages(messages) {
        this._clearPendingOverlays();

        const pending = (messages || []).filter((m) => m.pending && m.kind === 'image');
        if (pending.length === 0) return;

        const world = this._boardCore?.pixi?.worldLayer || this._boardCore?.pixi?.app?.stage;
        const s = world?.scale?.x || 1;

        let newPendingCount = 0;
        for (const p of pending) {
            if (!this._shiftedForPendingMessageIds.has(p.id)) {
                this._shiftedForPendingMessageIds.add(p.id);
                newPendingCount++;
                this._pendingShiftCount++;
            }
        }

        // Сдвигаем все ранее размещённые AI-изображения влево сразу при появлении блока загрузки,
        // чтобы блок не перекрывал их. 320 - ширина блока + отступ в мировых координатах.
        if (newPendingCount > 0 && this._boardAiImageIds.length > 0) {
            const worldShift = Math.round(320 * newPendingCount);
            const objects = this._boardCore?.state?.state?.objects;
            for (const id of this._boardAiImageIds) {
                const obj = objects?.find((o) => o.id === id);
                if (obj?.position) {
                    this._boardCore.updateObjectPositionDirect?.(
                        id,
                        { x: Math.round(obj.position.x - worldShift), y: obj.position.y },
                        { snap: false }
                    );
                }
            }
        }

        const chatRect = this._refs?.root?.getBoundingClientRect?.();
        const composerRect = this._refs?.composer?.getBoundingClientRect?.();
        const cx = chatRect
            ? Math.round(chatRect.left + chatRect.width / 2)
            : 400;
        const cy = composerRect
            ? Math.round(composerRect.top - 250)
            : 200;

        const [wr, hr] = parseFormatRatio(this._formatId);
        const ratio = wr / hr;
        const wScreen = Math.round(300 * s);
        const hScreen = Math.round(wScreen / ratio);

        for (let i = 0; i < pending.length; i++) {
            // Более новые генерации появляются правее. i=0 — самая старая, должна быть левее.
            const shiftX = (pending.length - 1 - i) * Math.round(320 * s);
            const left = Math.round(cx - wScreen / 2 - shiftX);
            const top = Math.round(cy - hScreen / 2);

            const overlay = document.createElement('div');
            overlay.className = 'moodboard-chat__pending-overlay';
            overlay.style.cssText = `left:${left}px;top:${top}px;width:${wScreen}px;height:${hScreen}px`;

            const label = document.createElement('span');
            label.className = 'moodboard-chat__pending-image-label';
            label.textContent = 'В процессе';
            overlay.appendChild(label);

            document.body.appendChild(overlay);
            this._pendingOverlayEls.push(overlay);
        }
    }

    _clearPendingOverlays() {
        for (const el of this._pendingOverlayEls) {
            el.remove();
        }
        this._pendingOverlayEls = [];
    }

    _getImageRequestOptions() {
        const [widthRatio, heightRatio] = parseFormatRatio(this._formatId);
        return {
            widthRatio,
            heightRatio,
            model: this._modelId === 'yandex' ? 'yandex-art' : undefined,
            imageCount: parseImageCount(this._countId)
        };
    }

    _addImageToBoard(msg) {
        if (!this._boardCore?.eventBus) return;
        const dataUrl = `data:${msg.mimeType || 'image/jpeg'};base64,${msg.imageBase64}`;
        const view = this._boardCore.pixi?.app?.view;
        const world = this._boardCore.pixi?.worldLayer || this._boardCore.pixi?.app?.stage;
        const s = world?.scale?.x || 1;

        // Если генерация прошла без режима загрузки (например, мгновенный ответ),
        // нужно сдвинуть существующие изображения сейчас. Иначе берем сохраненный индекс сдвига.
        let myShiftIndex = 0;
        if (this._pendingShiftCount > 0) {
            this._pendingShiftCount--;
            myShiftIndex = this._pendingShiftCount;
        } else if (this._boardAiImageIds.length > 0) {
            const worldShift = 320;
            const objects = this._boardCore.state?.state?.objects;
            for (const id of this._boardAiImageIds) {
                const obj = objects?.find((o) => o.id === id);
                if (obj?.position) {
                    this._boardCore.updateObjectPositionDirect?.(
                        id,
                        { x: Math.round(obj.position.x - worldShift), y: obj.position.y },
                        { snap: false }
                    );
                }
            }
        }

        // Новое изображение центрируется по горизонтали над панелью чата.
        // Якорь по вертикали — верхний край composer (всегда виден).
        // Объект создаётся с центром в (x,y), поэтому нижний край = y + h*s/2.
        // При w=300 мировых ед. и масштабе s≈1 нижний край ≈ y+150.
        // Чтобы нижний край изображения был на 100 px выше composer: y = composerTop - 250.
        const chatRect = this._refs?.root?.getBoundingClientRect?.();
        const composerRect = this._refs?.composer?.getBoundingClientRect?.();
        const xBase = chatRect
            ? Math.round(chatRect.left + chatRect.width / 2)
            : (view ? Math.round(view.clientWidth / 2) : 400);
        
        const x = Math.round(xBase - myShiftIndex * 320 * s);
        
        const y = composerRect
            ? Math.round(composerRect.top - 250)
            : (chatRect
                ? Math.round(chatRect.top - 150)
                : (view ? Math.round(view.clientHeight * 0.3) : 200));
        
        this._boardCore.eventBus.emit(Events.UI.PasteImageAt, {
            x, y,
            src: dataUrl,
            name: 'ai-generated.jpg',
            skipUpload: true
        });
    }

    _markExistingBoardImages(messages) {
        for (const msg of messages || []) {
            if (msg?.imageBase64) {
                this._boardImageMessageIds.add(msg.id);
            }
        }
    }

    _syncGeneratedImagesToBoard(messages) {
        if (!this._boardCore?.eventBus) return;

        for (const msg of messages || []) {
            if (!msg?.imageBase64 || msg.pending || this._boardImageMessageIds.has(msg.id)) {
                continue;
            }

            this._boardImageMessageIds.add(msg.id);
            this._addImageToBoard(msg);
        }
    }
}

function parseFormatRatio(formatId) {
    if (!formatId || formatId === 'auto') {
        return [1, 1];
    }

    const [width, height] = formatId.split(':').map((part) => Number.parseInt(part, 10));
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return [1, 1];
    }

    return [width, height];
}

function parseImageCount(countId) {
    if (!countId || countId === 'auto') {
        return 1;
    }

    const count = Number.parseInt(countId, 10);
    if (!Number.isFinite(count)) {
        return 1;
    }

    return Math.min(Math.max(count, 1), 4);
}
