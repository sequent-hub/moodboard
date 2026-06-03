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

const BOARD_IMAGE_WIDTH = 300;
const BOARD_IMAGE_STEP = 320;
const BOARD_IMAGE_GAP = BOARD_IMAGE_STEP - BOARD_IMAGE_WIDTH;
// Скорость перестановки AI-изображений на доске и въезда заглушек регулируется здесь.
const BOARD_IMAGE_REARRANGE_MS = 520;
// На сколько колонок «справа» появляется блок-заглушка перед въездом в финальную позицию.
const BOARD_IMAGE_PENDING_ENTER_FACTOR = 1.6;
// Каскад между блоками одного батча (мс): пользователь видит, что они приезжают друг за другом.
const BOARD_IMAGE_PENDING_STAGGER_MS = 90;
const REFERENCE_DRAG_PREVIEW_SIZE = 96;

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
        icon: ICONS.modelAlice,
        description: 'YandexGPT'
    },
    {
        id: 'gpt',
        label: 'GPT',
        icon: ICONS.modelGpt,
        description: 'OpenAI'
    },
    {
        id: 'google',
        label: 'Google',
        icon: ICONS.modelGoogle,
        description: 'Gemini'
    },
    {
        id: 'qwen',
        label: 'Qwen',
        icon: ICONS.modelQwen,
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
        this._shiftedForImageBatchKeys = new Set();
        this._boardImageShiftHistory = new Map();
        this._pendingOverlays = new Map();
        this._pendingOverlayTimers = new Map();
        this._boardImageShiftAnimations = new Map();
        this._boardCursor = null;
        this._draggedReferenceObject = null;
        this._draggedReferenceStartPosition = null;
        this._referenceDragPreview = null;
        this._referenceDragHandlers = null;
        this._clearSelectionOnSendClick = null;
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
                onSubmit: (text, attachments) => {
                    this._clearBoardSelection();
                    return this._session.send(text, { ...this._getImageRequestOptions(), referenceImages: attachments });
                },
                onAbort: () => this._session.abort()
            }
        );
        this._clearSelectionOnSendClick = () => this._clearBoardSelection();
        this._refs.send.addEventListener('click', this._clearSelectionOnSendClick);
        this._composer.attach();
        this._attachReferenceDragEvents();

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
        this._cancelBoardImageShiftAnimations();
        this._clearReferenceDragState();
        if (this._unsubscribe) { this._unsubscribe(); this._unsubscribe = null; }
        if (this._clearSelectionOnSendClick && this._refs?.send) {
            this._refs.send.removeEventListener('click', this._clearSelectionOnSendClick);
            this._clearSelectionOnSendClick = null;
        }
        this._detachReferenceDragEvents();
        this._shiftedForImageBatchKeys.clear();
        this._boardImageShiftHistory.clear();
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

    _clearBoardSelection() {
        if (typeof this._boardCore?.selectTool?.clearSelection === 'function') {
            this._boardCore.selectTool.clearSelection();
            return;
        }

        this._boardCore?.eventBus?.emit(Events.Tool.SelectionClear);
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
        if (state.status !== 'streaming') {
            this._revertFailedBatchShifts(state.messages);
        }
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
        const pending = (messages || []).filter((m) => m.pending && m.kind === 'image');
        const activeIds = new Set(pending.map((m) => m.id));

        for (const [id, record] of this._pendingOverlays) {
            if (!activeIds.has(id)) {
                record.el.remove();
                this._pendingOverlays.delete(id);
                this._cancelPendingOverlayTimer(id);
            }
        }

        if (pending.length === 0) return;

        const world = this._boardCore?.pixi?.worldLayer || this._boardCore?.pixi?.app?.stage;
        const s = world?.scale?.x || 1;

        this._shiftExistingImagesForBatch(messages, pending[0].id, s);

        const [wr, hr] = parseFormatRatio(this._formatId);
        const ratio = wr / hr;
        const wScreen = Math.round(BOARD_IMAGE_WIDTH * s);
        const hScreen = Math.round(wScreen / ratio);
        const enterDistance = Math.round(BOARD_IMAGE_STEP * s * BOARD_IMAGE_PENDING_ENTER_FACTOR);

        let newIndex = 0;
        pending.forEach((message) => {
            const slot = this._getImageBatchSlot(messages, message.id, s);
            const left = Math.round(slot.x - wScreen / 2);
            const top = Math.round(slot.y - hScreen / 2);

            const existing = this._pendingOverlays.get(message.id);
            if (existing) {
                const el = existing.el;
                el.style.left = `${left}px`;
                el.style.top = `${top}px`;
                el.style.width = `${wScreen}px`;
                el.style.height = `${hScreen}px`;
                el.style.setProperty('--moodboard-chat-board-animation-ms', `${BOARD_IMAGE_REARRANGE_MS}ms`);
                el.style.setProperty('--moodboard-chat-pending-enter-x', `${enterDistance}px`);
                return;
            }

            const overlay = document.createElement('div');
            overlay.className = 'moodboard-chat__pending-overlay moodboard-chat__pending-overlay--enter';
            overlay.style.cssText = `left:${left}px;top:${top}px;width:${wScreen}px;height:${hScreen}px`;
            overlay.style.setProperty('--moodboard-chat-board-animation-ms', `${BOARD_IMAGE_REARRANGE_MS}ms`);
            overlay.style.setProperty('--moodboard-chat-pending-enter-x', `${enterDistance}px`);

            const label = document.createElement('span');
            label.className = 'moodboard-chat__pending-image-label';
            label.textContent = 'В процессе...';
            overlay.appendChild(label);

            document.body.appendChild(overlay);

            // Принудительный reflow: фиксируем стартовое состояние (translateX справа + opacity 0)
            // в layout до переключения класса. Без этого браузер может смерджить два состояния
            // в один кадр и transition не запустится — заглушка появится мгновенно.
            void overlay.offsetWidth;

            this._pendingOverlays.set(message.id, { el: overlay });

            const stagger = newIndex * BOARD_IMAGE_PENDING_STAGGER_MS;
            newIndex += 1;

            const trigger = () => {
                if (!overlay.isConnected) return;
                overlay.classList.remove('moodboard-chat__pending-overlay--enter');
                overlay.classList.add('moodboard-chat__pending-overlay--entered');
            };

            if (stagger > 0) {
                const timer = setTimeout(() => {
                    this._pendingOverlayTimers.delete(message.id);
                    this._scheduleAnimationFrame(trigger);
                }, stagger);
                this._pendingOverlayTimers.set(message.id, timer);
            } else {
                this._scheduleAnimationFrame(trigger);
            }
        });
    }

    _cancelPendingOverlayTimer(id) {
        const timer = this._pendingOverlayTimers.get(id);
        if (timer !== undefined) {
            clearTimeout(timer);
            this._pendingOverlayTimers.delete(id);
        }
    }

    _clearPendingOverlays() {
        for (const record of this._pendingOverlays.values()) {
            record.el.remove();
        }
        this._pendingOverlays.clear();
        for (const timer of this._pendingOverlayTimers.values()) {
            clearTimeout(timer);
        }
        this._pendingOverlayTimers.clear();
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

    _attachReferenceDragEvents() {
        const eventBus = this._boardCore?.eventBus;
        if (!eventBus || typeof eventBus.on !== 'function' || this._referenceDragHandlers) return;

        const onCursorMove = ({ x, y } = {}) => {
            if (Number.isFinite(x) && Number.isFinite(y)) {
                this._boardCursor = { x, y };
                this._updateReferenceDragPreview();
            }
        };
        const onDragStart = (data) => {
            this._handleReferenceDragStart(data);
        };
        const onDragEnd = (data) => {
            void this._handleReferenceDragEnd(data);
        };
        const onSelectionAdd = (data) => {
            void this._handleSelectionAdd(data);
        };

        this._referenceDragHandlers = { onCursorMove, onDragStart, onDragEnd, onSelectionAdd };
        eventBus.on(Events.UI.CursorMove, onCursorMove);
        eventBus.on(Events.Tool.DragStart, onDragStart);
        eventBus.on(Events.Tool.DragEnd, onDragEnd);
        eventBus.on(Events.Tool.SelectionAdd, onSelectionAdd);
    }

    _detachReferenceDragEvents() {
        const eventBus = this._boardCore?.eventBus;
        const handlers = this._referenceDragHandlers;
        if (!eventBus || typeof eventBus.off !== 'function' || !handlers) return;

        eventBus.off(Events.UI.CursorMove, handlers.onCursorMove);
        eventBus.off(Events.Tool.DragStart, handlers.onDragStart);
        eventBus.off(Events.Tool.DragEnd, handlers.onDragEnd);
        eventBus.off(Events.Tool.SelectionAdd, handlers.onSelectionAdd);
        this._referenceDragHandlers = null;
    }

    async _handleSelectionAdd(data = {}) {
        const objectId = data?.object;
        const object = this._boardCore?.state?.state?.objects?.find((item) => item?.id === objectId);
        
        if (!isReferenceImageObject(object)) return;

        await this._addImageObjectAsReference(object);
    }

    _handleReferenceDragStart(data = {}) {
        const objectId = data?.object;
        const object = this._boardCore?.state?.state?.objects?.find((item) => item?.id === objectId);
        this._draggedReferenceObject = isReferenceImageObject(object) ? object : null;
        this._draggedReferenceStartPosition = this._draggedReferenceObject?.position
            ? { ...this._draggedReferenceObject.position }
            : null;
        this._updateReferenceDragPreview();
    }

    async _handleReferenceDragEnd(data = {}) {
        const isDropTarget = this._isBoardCursorOverInput();
        const objectId = data?.object;
        const object = this._boardCore?.state?.state?.objects?.find((item) => item?.id === objectId);
        const startPosition = this._draggedReferenceStartPosition;
        this._clearReferenceDragState();
        if (!isDropTarget || !isReferenceImageObject(object)) return null;

        this._restoreReferenceObjectPosition(objectId, startPosition);
        await this._addImageObjectAsReference(object);
    }

    _restoreReferenceObjectPosition(objectId, position) {
        if (!objectId || !position) return;

        const updatePosition = this._boardCore?.updateObjectPositionDirect;
        if (typeof updatePosition === 'function') {
            updatePosition.call(this._boardCore, objectId, position, { snap: false });
            return;
        }

        const object = this._boardCore?.state?.state?.objects?.find((item) => item?.id === objectId);
        if (object?.position) {
            object.position = { ...position };
        }
    }

    _updateReferenceDragPreview() {
        const object = this._draggedReferenceObject;
        if (!object || !this._isBoardCursorOverInput()) {
            this._hideReferenceDragPreview();
            return;
        }

        const src = getImageObjectSource(object);
        if (!src) {
            this._hideReferenceDragPreview();
            return;
        }

        const preview = this._ensureReferenceDragPreview(object, src);
        const { clientX, clientY } = this._getBoardCursorClientPosition();
        preview.style.left = `${Math.round(clientX)}px`;
        preview.style.top = `${Math.round(clientY)}px`;
        this._refs?.textarea?.closest?.('.moodboard-chat__input-row')?.classList.add('is-reference-drop-target');
    }

    _ensureReferenceDragPreview(object, src) {
        if (!this._referenceDragPreview) {
            const preview = document.createElement('img');
            preview.className = 'moodboard-chat__reference-drag-preview';
            preview.alt = getImageObjectFileName(object, src);
            preview.width = REFERENCE_DRAG_PREVIEW_SIZE;
            preview.height = REFERENCE_DRAG_PREVIEW_SIZE;
            document.body.appendChild(preview);
            this._referenceDragPreview = preview;
        }

        if (this._referenceDragPreview.src !== src) {
            this._referenceDragPreview.src = src;
        }
        this._referenceDragPreview.alt = getImageObjectFileName(object, src);

        return this._referenceDragPreview;
    }

    _hideReferenceDragPreview() {
        this._referenceDragPreview?.remove();
        this._referenceDragPreview = null;
        this._refs?.textarea?.closest?.('.moodboard-chat__input-row')?.classList.remove('is-reference-drop-target');
    }

    _clearReferenceDragState() {
        this._draggedReferenceObject = null;
        this._draggedReferenceStartPosition = null;
        this._boardCursor = null;
        this._hideReferenceDragPreview();
    }

    _isBoardCursorOverInput() {
        const cursor = this._boardCursor;
        const inputRow = this._refs?.textarea?.closest?.('.moodboard-chat__input-row');
        if (!cursor || !inputRow) return false;

        const containerRect = this._container.getBoundingClientRect?.();
        const rect = inputRow.getBoundingClientRect();
        const { clientX, clientY } = this._getBoardCursorClientPosition(containerRect);

        return clientX >= rect.left
            && clientX <= rect.right
            && clientY >= rect.top
            && clientY <= rect.bottom;
    }

    _getBoardCursorClientPosition(containerRect = null) {
        const rect = containerRect || this._container.getBoundingClientRect?.();
        const cursor = this._boardCursor || { x: 0, y: 0 };

        return {
            clientX: (rect?.left || 0) + cursor.x,
            clientY: (rect?.top || 0) + cursor.y
        };
    }

    async _addImageObjectAsReference(object) {
        if (!object || !this._composer) return;

        try {
            const file = await createFileFromImageObject(object);
            if (!file) return;
            this._composer.addAttachment(file);
            this._composer.focus();
        } catch (err) {
            console.warn('[ChatWindow] cannot add selected image reference:', err);
        }
    }

    _getImageBatchSlot(messages, messageId, scale = 1) {
        const batch = findImageGenerationBatch(messages, messageId);
        const anchor = this._getImageGroupAnchor();
        const step = Math.round(BOARD_IMAGE_STEP * scale);
        const count = Math.max(batch.count, 1);
        const index = Math.min(Math.max(batch.index, 0), count - 1);
        const leftmostCenter = anchor.x - ((count - 1) * step) / 2;

        return {
            x: Math.round(leftmostCenter + index * step),
            y: anchor.y
        };
    }

    _getImageGroupAnchor() {
        const composerRect = this._refs?.composer?.getBoundingClientRect?.();
        if (composerRect) {
            return {
                x: Math.round(composerRect.left + composerRect.width / 2),
                y: Math.round(composerRect.top - 250)
            };
        }

        const chatRect = this._refs?.root?.getBoundingClientRect?.();
        if (chatRect) {
            return {
                x: Math.round(chatRect.left + chatRect.width / 2),
                y: Math.round(chatRect.top - 150)
            };
        }

        return { x: 400, y: 200 };
    }

    _shiftExistingImagesForBatch(messages, messageId, scale = 1) {
        const batch = findImageGenerationBatch(messages, messageId);
        const batchKey = getImageGenerationBatchKey(batch);
        if (this._shiftedForImageBatchKeys.has(batchKey)) return;

        this._shiftedForImageBatchKeys.add(batchKey);
        this._shiftBoardAiImagesLeft(this._getImageBatchWorldBounds(messages, messageId, scale), batchKey);
    }

    _getImageBatchWorldBounds(messages, messageId, scale = 1) {
        const batch = findImageGenerationBatch(messages, messageId);
        const anchor = this._getImageGroupAnchor();
        const world = this._boardCore?.pixi?.worldLayer || this._boardCore?.pixi?.app?.stage;
        const s = scale || 1;
        const step = Math.round(BOARD_IMAGE_STEP * s);
        const width = Math.round(BOARD_IMAGE_WIDTH * s);
        const count = Math.max(batch.count, 1);
        const leftScreen = anchor.x - ((count - 1) * step) / 2 - width / 2;
        const rightScreen = anchor.x + ((count - 1) * step) / 2 + width / 2;

        return {
            left: Math.round((leftScreen - (world?.x || 0)) / s),
            right: Math.round((rightScreen - (world?.x || 0)) / s)
        };
    }

    _shiftBoardAiImagesLeft(nextBatchBounds, batchKey) {
        const aiObjects = this._getBoardAiImageObjects();
        if (aiObjects.length === 0 || !nextBatchBounds) return;

        const existingRight = Math.max(...aiObjects.map((object) => object.position.x + getBoardObjectWidth(object)));
        const shift = Math.ceil(existingRight + BOARD_IMAGE_GAP - nextBatchBounds.left);
        if (shift <= 0) return;

        const ids = new Set(aiObjects.map((object) => object.id));
        const objects = this._boardCore?.state?.state?.objects;
        const shiftRecord = [];
        for (const id of ids) {
            const obj = objects?.find((item) => item.id === id);
            if (obj?.position) {
                const from = { x: obj.position.x, y: obj.position.y };
                const to = { x: Math.round(obj.position.x - shift), y: obj.position.y };
                shiftRecord.push({ id, from });
                this._animateBoardImageToPosition(id, from, to);
            }
        }

        if (batchKey && shiftRecord.length > 0) {
            this._boardImageShiftHistory.set(batchKey, shiftRecord);
        }
    }

    _revertBoardImageShiftForBatch(batchKey) {
        const record = this._boardImageShiftHistory.get(batchKey);
        if (!record) return;

        const objects = this._boardCore?.state?.state?.objects;
        for (const { id, from } of record) {
            const obj = objects?.find((item) => item.id === id);
            if (obj?.position) {
                this._animateBoardImageToPosition(id, obj.position, from);
            }
        }

        this._boardImageShiftHistory.delete(batchKey);
        this._shiftedForImageBatchKeys.delete(batchKey);
    }

    _revertFailedBatchShifts(messages) {
        if (this._boardImageShiftHistory.size === 0) return;

        for (const batchKey of [...this._boardImageShiftHistory.keys()]) {
            if (batchKey === 'unknown') continue;

            const messageIds = batchKey.split('|');
            const batchMessages = messageIds
                .map((id) => messages?.find((m) => m.id === id))
                .filter(Boolean);

            if (batchMessages.length === 0) continue;

            const allResolved = batchMessages.every((m) => !m.pending);
            const anyImage = batchMessages.some((m) => Boolean(m.imageBase64));

            if (allResolved && !anyImage) {
                this._revertBoardImageShiftForBatch(batchKey);
            }
        }
    }

    _animateBoardImageToPosition(id, fromPosition, toPosition) {
        const updatePosition = this._boardCore?.updateObjectPositionDirect;
        if (!id || typeof updatePosition !== 'function' || !fromPosition || !toPosition) return;

        this._cancelBoardImageShiftAnimation(id);

        if (BOARD_IMAGE_REARRANGE_MS <= 0 || prefersReducedMotion()) {
            updatePosition.call(this._boardCore, id, toPosition, { snap: false });
            return;
        }

        const from = {
            x: Number(fromPosition.x) || 0,
            y: Number(fromPosition.y) || 0
        };
        const to = {
            x: Math.round(Number(toPosition.x) || 0),
            y: Math.round(Number(toPosition.y) || 0)
        };
        const startAt = getAnimationTime();
        const record = { frame: null };

        const step = (now) => {
            const progress = Math.min(Math.max((now - startAt) / BOARD_IMAGE_REARRANGE_MS, 0), 1);
            const eased = easeOutCubic(progress);
            const next = {
                x: Math.round(from.x + (to.x - from.x) * eased),
                y: Math.round(from.y + (to.y - from.y) * eased)
            };

            updatePosition.call(this._boardCore, id, next, { snap: false });

            if (progress < 1) {
                record.frame = this._scheduleAnimationFrame(step);
                return;
            }

            updatePosition.call(this._boardCore, id, to, { snap: false });
            this._boardImageShiftAnimations.delete(id);
        };

        record.frame = this._scheduleAnimationFrame(step);
        this._boardImageShiftAnimations.set(id, record);
    }

    _cancelBoardImageShiftAnimation(id) {
        const record = this._boardImageShiftAnimations.get(id);
        if (!record) return;

        cancelAnimationFrameSafe(record.frame);
        this._boardImageShiftAnimations.delete(id);
    }

    _cancelBoardImageShiftAnimations() {
        for (const id of this._boardImageShiftAnimations.keys()) {
            this._cancelBoardImageShiftAnimation(id);
        }
    }

    _scheduleAnimationFrame(callback) {
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
            return window.requestAnimationFrame(callback);
        }

        return setTimeout(() => callback(getAnimationTime()), 16);
    }

    _getBoardAiImageObjects() {
        const objects = this._boardCore?.state?.state?.objects;
        if (!Array.isArray(objects)) return [];

        return objects.filter((object) => isBoardAiImageObject(object));
    }

    _addImageToBoard(msg) {
        if (!this._boardCore?.eventBus) return;
        const dataUrl = `data:${msg.mimeType || 'image/jpeg'};base64,${msg.imageBase64}`;
        const world = this._boardCore.pixi?.worldLayer || this._boardCore.pixi?.app?.stage;
        const s = world?.scale?.x || 1;
        const messages = this._session.getState().messages;
        this._shiftExistingImagesForBatch(messages, msg.id, s);
        const slot = this._getImageBatchSlot(messages, msg.id, s);
        
        this._boardCore.eventBus.emit(Events.UI.PasteImageAt, {
            x: slot.x,
            y: slot.y,
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

function findImageGenerationBatch(messages, messageId) {
    const list = Array.isArray(messages) ? messages : [];
    const targetIndex = list.findIndex((message) => message?.id === messageId);
    if (targetIndex === -1) {
        return { index: 0, count: 1 };
    }

    let start = targetIndex;
    while (start > 0 && isImageGenerationMessage(list[start - 1])) {
        start--;
    }

    let end = targetIndex;
    while (end + 1 < list.length && isImageGenerationMessage(list[end + 1])) {
        end++;
    }

    return {
        index: targetIndex - start,
        count: end - start + 1,
        ids: list.slice(start, end + 1).map((message) => message.id)
    };
}

function getImageGenerationBatchKey(batch) {
    return batch.ids?.join('|') || 'unknown';
}

function isImageGenerationMessage(message) {
    return message?.role === 'assistant'
        && (message.kind === 'image' || message.pending || Boolean(message.imageBase64));
}

function isBoardAiImageObject(object) {
    return Boolean(object?.id)
        && object.type === 'image'
        && object.properties?.name === 'ai-generated.jpg'
        && object.position
        && Number.isFinite(object.position.x);
}

function isReferenceImageObject(object) {
    return Boolean(object?.id)
        && (object.type === 'image' || object.type === 'revit-screenshot-img')
        && typeof getImageObjectSource(object) === 'string';
}

async function createFileFromImageObject(object) {
    const src = getImageObjectSource(object);
    if (!src) return null;

    const name = getImageObjectFileName(object, src);
    const blob = src.startsWith('data:')
        ? dataUrlToBlob(src)
        : await fetchImageBlob(src);

    return createNamedBlob(blob, name);
}

function getImageObjectSource(object) {
    const src = object?.src || object?.properties?.src || object?.properties?.url || object?.url;
    return typeof src === 'string' && src.trim() ? src.trim() : null;
}

function getImageObjectFileName(object, src) {
    const explicitName = object?.properties?.name || object?.name;
    if (typeof explicitName === 'string' && explicitName.trim()) {
        return explicitName.trim();
    }

    if (!src.startsWith('data:')) {
        const lastPathPart = src.split(/[?#]/)[0].split('/').pop();
        if (lastPathPart) return lastPathPart;
    }

    return 'board-reference.png';
}

function dataUrlToBlob(dataUrl) {
    const [meta = '', data = ''] = dataUrl.split(',');
    const mimeMatch = meta.match(/^data:([^;]+)/);
    const mimeType = mimeMatch?.[1] || 'image/png';
    const isBase64 = /;base64/i.test(meta);
    const binary = isBase64 ? atob(data) : decodeURIComponent(data);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return new Blob([bytes], { type: mimeType });
}

async function fetchImageBlob(src) {
    const response = await fetch(src);
    if (!response.ok) {
        throw new Error(`Cannot load image reference (${response.status})`);
    }

    return response.blob();
}

function createNamedBlob(blob, name) {
    if (typeof File === 'function') {
        return new File([blob], name, { type: blob.type || 'image/png' });
    }

    blob.name = name;
    return blob;
}

function getBoardObjectWidth(object) {
    const width = object?.width ?? object?.properties?.width ?? BOARD_IMAGE_WIDTH;
    return Number.isFinite(width) ? Math.max(1, Math.round(width)) : BOARD_IMAGE_WIDTH;
}

function easeOutCubic(progress) {
    return 1 - Math.pow(1 - progress, 3);
}

function getAnimationTime() {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        return performance.now();
    }

    return Date.now();
}

function cancelAnimationFrameSafe(frame) {
    if (!frame) return;

    if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(frame);
        return;
    }

    clearTimeout(frame);
}

function prefersReducedMotion() {
    return typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
