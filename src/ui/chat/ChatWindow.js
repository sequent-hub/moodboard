import { AiClient } from '../../services/ai/AiClient.js';
import { ChatHistoryStore } from '../../services/ai/ChatHistoryStore.js';
import { ChatSessionController } from '../../services/ai/ChatSessionController.js';
import { Events } from '../../core/events/Events.js';

import { buildChatDom } from './ChatWindowRenderer.js';
import { formatChatErrorForDisplay } from './formatChatError.js';
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

const MODEL_OPTIONS = [
    {
        id: 'auto',
        label: 'Автоматический режим',
        icon: ICONS.modelBot,
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
        icon: '<img src="/icons/qwen.svg" alt="" aria-hidden="true">',
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
        this._pendingBatchOffsets = new Map();
        this._aiImageLaneSlots = new Map();
        this._draggingAiImageIds = new Set();
        this._aiImageLaneHandlers = null;
        this._selectionHandlers = null;
        this._viewportHandlers = null;
        // Окно от BoxSelectStart до BoxSelectCommit: в это время SelectionAdd
        // приходит на каждый mousemove и не должен пушить превью в чат —
        // финальный набор картинок мы получим из BoxSelectCommit по strict-contains.
        this._boxSelectActive = false;
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
        this._composer.attach();
        this._attachSelectionEvents();
        this._attachViewportSync();
        this._attachAiImageLaneEvents();

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
        this._reserveCurrentAiImageLaneSlots();
        this._unsubscribe = this._session.subscribe((state) => this._render(state));
        this._render(initialState);

        this._loadProviders();

        this._attached = true;
    }

    detach() {
        if (!this._attached) return;
        this._clearPendingOverlays();
        this._cancelBoardImageShiftAnimations();
        if (this._unsubscribe) { this._unsubscribe(); this._unsubscribe = null; }
        this._detachSelectionEvents();
        this._detachViewportSync();
        this._detachAiImageLaneEvents();
        this._shiftedForImageBatchKeys.clear();
        this._boardImageShiftHistory.clear();
        this._pendingBatchOffsets.clear();
        this._aiImageLaneSlots.clear();
        this._draggingAiImageIds.clear();
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
        this._cleanupPlacedBatchOffsets(state.messages);
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

        const errorBlock = this._refs.errorBlock;
        const wasVisible = errorBlock.classList.contains('is-visible');
        const isError = state.error && state.error !== 'Отменено';

        if (isError) {
            errorBlock.textContent = formatChatErrorForDisplay(state.error);
            errorBlock.classList.add('is-visible');
        } else {
            errorBlock.classList.remove('is-visible');
        }

        const isVisible = errorBlock.classList.contains('is-visible');
        if (!wasVisible && isVisible) {
            requestAnimationFrame(() => {
                this._pushBoardImagesUpIfNeeded();
            });
        } else if (wasVisible && !isVisible) {
            this._pullBoardImagesDownIfNeeded();
        }
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

        // Смещаем уже размещённые board-объекты для каждого батча (дедупликация внутри метода)
        const shiftedBids = new Set();
        for (const m of pending) {
            const bid = m.batchId || m.id;
            if (!shiftedBids.has(bid)) {
                shiftedBids.add(bid);
                this._shiftExistingImagesForBatch(messages, m.id, s);
            }
        }

        // Смещаем pending-оверлеи для новых батчей (от старших к новейшему)
        const pendingBatchMeta = [];
        const seenBids = new Set();
        for (const m of pending) {
            if (m.batchId && !seenBids.has(m.batchId)) {
                seenBids.add(m.batchId);
                pendingBatchMeta.push({
                    batchId: m.batchId,
                    count: pending.filter((pm) => pm.batchId === m.batchId).length
                });
            }
        }
        for (const { batchId, count } of pendingBatchMeta) {
            this._shiftPendingOverlaysForNewBatch(batchId, count, s);
        }

        const enterDistance = this._computeEnterDistance(messages, pending, s, Math.round(BOARD_IMAGE_WIDTH * s));

        let newIndex = 0;
        pending.forEach((message) => {
            const existing = this._pendingOverlays.get(message.id);
            if (existing) {
                // Мировые координаты оверлея зафиксированы в момент создания батча.
                // Пересчитываем только экранную позицию из сохранённых world-координат,
                // чтобы пан холста между рендерами не сдвигал worldX/worldY —
                // иначе размещение реального изображения попадёт в неправильную точку.
                const [wr2, hr2] = parseFormatRatio(this._formatId);
                const wScreen2 = Math.round(BOARD_IMAGE_WIDTH * s);
                const hScreen2 = Math.round(wScreen2 / (wr2 / hr2));
                const screenLayout = {
                    left: Math.round(existing.worldX * s + (world?.x || 0) - wScreen2 / 2),
                    top: Math.round(existing.worldY * s + (world?.y || 0) - hScreen2 / 2),
                    width: wScreen2,
                    height: hScreen2,
                    worldX: existing.worldX,
                    worldY: existing.worldY
                };
                this._reserveAiImageLaneSlotForMessage(message.id, existing.worldX, existing.worldY);
                this._applyPendingOverlayScreenLayout(existing.el, screenLayout, { animate: true, enterDistance });
                return;
            }

            const layout = this._computePendingOverlayScreenLayout(messages, message.id, s);
            this._reserveAiImageLaneSlotForMessage(message.id, layout.worldX, layout.worldY);

            const overlay = document.createElement('div');
            overlay.className = 'moodboard-chat__pending-overlay moodboard-chat__pending-overlay--enter';
            overlay.style.cssText = `left:${layout.left}px;top:${layout.top}px;width:${layout.width}px;height:${layout.height}px`;
            overlay.style.setProperty('--moodboard-chat-board-animation-ms', `${BOARD_IMAGE_REARRANGE_MS}ms`);
            overlay.style.setProperty('--moodboard-chat-pending-enter-x', `${enterDistance}px`);

            const label = document.createElement('span');
            label.className = 'moodboard-chat__pending-image-label';
            label.textContent = 'В процессе...';
            overlay.appendChild(label);

            (this._container ?? document.body).appendChild(overlay);

            // Принудительный reflow: фиксируем стартовое состояние (translateX справа + opacity 0)
            // в layout до переключения класса. Без этого браузер может смерджить два состояния
            // в один кадр и transition не запустится — заглушка появится мгновенно.
            void overlay.offsetWidth;

            this._pendingOverlays.set(message.id, {
                el: overlay,
                batchId: message.batchId,
                worldX: layout.worldX,
                worldY: layout.worldY
            });

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

    /**
     * Вычисляет расстояние входа заглушки так, чтобы новая заглушка въезжала справа
     * от уже размещённых AI-изображений на доске, а не накрывала их во время анимации
     * сдвига. Без этого при N>1 изображений в батче enter-расстояние фиксированное
     * (512px) не покрывало ширину существующего ряда (940px для трёх изображений),
     * и заглушка пересекалась с ещё не ушедшими влево картинками.
     */
    _computeEnterDistance(messages, pending, scale, wScreen) {
        const baseEnter = Math.round(BOARD_IMAGE_STEP * scale * BOARD_IMAGE_PENDING_ENTER_FACTOR);

        const aiObjects = this._getBoardAiImageObjects();
        if (aiObjects.length === 0) return baseEnter;

        const firstNewPending = pending.find((m) => !this._pendingOverlays.has(m.id));
        if (!firstNewPending) return baseEnter;

        const world = this._boardCore?.pixi?.worldLayer || this._boardCore?.pixi?.app?.stage;
        const worldX = world?.x || 0;
        const existingRight_world = this._getAiImageLaneRightBoundary(aiObjects);
        if (!Number.isFinite(existingRight_world)) return baseEnter;
        const existingRight_screen = Math.round(existingRight_world * scale + worldX);

        const step = Math.round(BOARD_IMAGE_STEP * scale);
        const gap = Math.round(BOARD_IMAGE_GAP * scale);

        const slot = this._getImageBatchSlot(messages, firstNewPending.id, scale);
        const batch = findImageGenerationBatch(messages, firstNewPending.id);
        const leftmostSlotX = Math.round(slot.x - batch.index * step);
        const leftmostFinalLeft = leftmostSlotX - Math.round(wScreen / 2);

        const neededEnter = existingRight_screen - leftmostFinalLeft + gap;
        return Math.max(baseEnter, Math.ceil(neededEnter));
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
        this._pendingBatchOffsets.clear();
    }

    _shiftPendingOverlaysForNewBatch(batchId, count, scale) {
        if (!batchId || this._pendingBatchOffsets.has(batchId)) return;

        const step = Math.round(BOARD_IMAGE_STEP * scale);
        const shiftAmount = count * step;

        for (const [existingId, offset] of this._pendingBatchOffsets) {
            this._pendingBatchOffsets.set(existingId, offset - shiftAmount);
        }
        this._pendingBatchOffsets.set(batchId, 0);

        let existingOverlaysShifted = false;
        const messages = this._session?.getState?.()?.messages || [];
        for (const [messageId, record] of this._pendingOverlays) {
            if (record.batchId === batchId) continue;
            const layout = this._computePendingOverlayScreenLayout(messages, messageId, scale);
            record.worldX = layout.worldX;
            record.worldY = layout.worldY;
            this._reserveAiImageLaneSlotForMessage(messageId, layout.worldX, layout.worldY);
            this._applyPendingOverlayScreenLayout(record.el, layout, { animate: true });
            existingOverlaysShifted = true;
        }

        // Когда существующие заглушки сдвигаются влево, уже размещённые AI-изображения
        // на доске должны сдвинуться на то же расстояние — иначе они окажутся
        // правее заглушек и перекроются ими.
        if (!existingOverlaysShifted) return;

        const worldShift = shiftAmount / scale;
        for (const obj of this._getBoardAiImageObjects()) {
            if (obj?.position) {
                const key = getAiImageLaneKeyForObject(obj);
                const currentSlot = this._getAiImageLaneSlotForObject(obj);
                const from = { x: obj.position.x, y: obj.position.y };
                if (this._draggingAiImageIds.has(obj.id)) {
                    this._reserveAiImageLaneSlotForObject(obj);
                    continue;
                }
                const to = {
                    x: Math.round((currentSlot?.x ?? obj.position.x) - worldShift),
                    y: currentSlot?.y ?? obj.position.y
                };
                if (key) {
                    this._aiImageLaneSlots.set(key, {
                        x: to.x,
                        y: to.y,
                        width: currentSlot?.width ?? getBoardObjectWidth(obj),
                        height: currentSlot?.height ?? getBoardObjectHeight(obj)
                    });
                }
                this._animateBoardImageToPosition(obj.id, from, to);
            }
        }
    }

    _cleanupPlacedBatchOffsets(messages) {
        if (this._pendingBatchOffsets.size === 0) return;
        for (const batchId of [...this._pendingBatchOffsets.keys()]) {
            const batchMessages = (messages || []).filter((m) => m.batchId === batchId);
            if (batchMessages.length === 0 || batchMessages.every((m) => !m.pending)) {
                this._pendingBatchOffsets.delete(batchId);
            }
        }
    }

    _getImageRequestOptions() {
        const [widthRatio, heightRatio] = parseFormatRatio(this._formatId);
        const provider = this._modelId === 'gpt' ? 'openai-image' : 'yandex-art';
        return {
            provider,
            widthRatio,
            heightRatio,
            model: this._modelId === 'yandex' ? 'yandex-art' : undefined,
            imageCount: parseImageCount(this._countId)
        };
    }

    _computePendingOverlayScreenLayout(messages, messageId, scale = 1) {
        const world = this._boardCore?.pixi?.worldLayer || this._boardCore?.pixi?.app?.stage;
        const s = scale || world?.scale?.x || 1;
        const [wr, hr] = parseFormatRatio(this._formatId);
        const ratio = wr / hr;
        const wScreen = Math.round(BOARD_IMAGE_WIDTH * s);
        const hScreen = Math.round(wScreen / ratio);
        const slot = this._getImageBatchSlot(messages, messageId, s);
        const worldX = (slot.x - (world?.x || 0)) / s;
        const worldY = (slot.y - (world?.y || 0)) / s;
        const screenX = Math.round(worldX * s + (world?.x || 0));
        const screenY = Math.round(worldY * s + (world?.y || 0));

        return {
            left: Math.round(screenX - wScreen / 2),
            top: Math.round(screenY - hScreen / 2),
            width: wScreen,
            height: hScreen,
            worldX,
            worldY
        };
    }

    _applyPendingOverlayScreenLayout(el, layout, { animate = false, enterDistance } = {}) {
        el.style.left = `${layout.left}px`;
        el.style.top = `${layout.top}px`;
        el.style.width = `${layout.width}px`;
        el.style.height = `${layout.height}px`;
        if (!animate) return;

        el.style.setProperty('--moodboard-chat-board-animation-ms', `${BOARD_IMAGE_REARRANGE_MS}ms`);
        if (enterDistance != null) {
            el.style.setProperty('--moodboard-chat-pending-enter-x', `${enterDistance}px`);
        }
    }

    /**
     * Пересчитывает screen-позиции заглушек из world-координат — вместе с AI-изображениями на доске при pan/zoom.
     */
    _syncPendingOverlaysToViewport({ disableTransition = false, recomputeWorld = false } = {}) {
        if (this._pendingOverlays.size === 0) return;

        const messages = this._session?.getState?.()?.messages;
        const world = this._boardCore?.pixi?.worldLayer || this._boardCore?.pixi?.app?.stage;
        const s = world?.scale?.x || 1;
        const [wr, hr] = parseFormatRatio(this._formatId);
        const wScreen = Math.round(BOARD_IMAGE_WIDTH * s);
        const hScreen = Math.round(wScreen / (wr / hr));

        for (const [messageId, record] of this._pendingOverlays) {
            if (recomputeWorld || typeof record.worldX !== 'number' || typeof record.worldY !== 'number') {
                const layout = this._computePendingOverlayScreenLayout(messages, messageId, s);
                record.worldX = layout.worldX;
                record.worldY = layout.worldY;
            }

            const screenX = Math.round(record.worldX * s + (world?.x || 0));
            const screenY = Math.round(record.worldY * s + (world?.y || 0));
            const el = record.el;
            this._reserveAiImageLaneSlotForMessage(messageId, record.worldX, record.worldY);
            if (disableTransition) {
                el.style.transition = 'none';
            }
            el.style.left = `${Math.round(screenX - wScreen / 2)}px`;
            el.style.top = `${Math.round(screenY - hScreen / 2)}px`;
            el.style.width = `${wScreen}px`;
            el.style.height = `${hScreen}px`;
            if (disableTransition) {
                void el.offsetWidth;
                el.style.removeProperty('transition');
            }
        }
    }

    _attachViewportSync() {
        const eventBus = this._boardCore?.eventBus;
        if (!eventBus || typeof eventBus.on !== 'function' || this._viewportHandlers) return;

        const onPanUpdate = () => {
            this._syncPendingOverlaysToViewport({ disableTransition: true });
        };
        const onViewportChange = () => {
            this._syncPendingOverlaysToViewport({ disableTransition: true, recomputeWorld: false });
        };

        this._viewportHandlers = { onPanUpdate, onViewportChange };
        eventBus.on(Events.Tool.PanUpdate, onPanUpdate);
        eventBus.on(Events.UI.ZoomPercent, onViewportChange);
        eventBus.on(Events.Viewport.Changed, onViewportChange);
    }

    _detachViewportSync() {
        const eventBus = this._boardCore?.eventBus;
        const handlers = this._viewportHandlers;
        if (!eventBus || typeof eventBus.off !== 'function' || !handlers) return;

        eventBus.off(Events.Tool.PanUpdate, handlers.onPanUpdate);
        eventBus.off(Events.UI.ZoomPercent, handlers.onViewportChange);
        eventBus.off(Events.Viewport.Changed, handlers.onViewportChange);
        this._viewportHandlers = null;
    }

    _attachAiImageLaneEvents() {
        const eventBus = this._boardCore?.eventBus;
        if (!eventBus || typeof eventBus.on !== 'function' || this._aiImageLaneHandlers) return;

        const onDragStart = (data) => {
            this._startAiImageLaneDrag([data?.object]);
        };
        const onDragUpdate = (data) => {
            this._updateAiImageLaneDrag([data?.object]);
        };
        const onDragEnd = (data) => {
            this._updateAiImageLaneDrag([data?.object]);
            this._endAiImageLaneDrag([data?.object]);
        };
        const onGroupDragStart = (data) => {
            this._startAiImageLaneDrag(data?.objects);
        };
        const onGroupDragUpdate = (data) => {
            this._updateAiImageLaneDrag(data?.objects);
        };
        const onGroupDragEnd = (data) => {
            this._updateAiImageLaneDrag(data?.objects);
            this._endAiImageLaneDrag(data?.objects);
        };

        this._aiImageLaneHandlers = {
            onDragStart,
            onDragUpdate,
            onDragEnd,
            onGroupDragStart,
            onGroupDragUpdate,
            onGroupDragEnd
        };

        eventBus.on(Events.Tool.DragStart, onDragStart);
        eventBus.on(Events.Tool.DragUpdate, onDragUpdate);
        eventBus.on(Events.Tool.DragEnd, onDragEnd);
        eventBus.on(Events.Tool.GroupDragStart, onGroupDragStart);
        eventBus.on(Events.Tool.GroupDragUpdate, onGroupDragUpdate);
        eventBus.on(Events.Tool.GroupDragEnd, onGroupDragEnd);
    }

    _detachAiImageLaneEvents() {
        const eventBus = this._boardCore?.eventBus;
        const handlers = this._aiImageLaneHandlers;
        if (!eventBus || typeof eventBus.off !== 'function' || !handlers) return;

        eventBus.off(Events.Tool.DragStart, handlers.onDragStart);
        eventBus.off(Events.Tool.DragUpdate, handlers.onDragUpdate);
        eventBus.off(Events.Tool.DragEnd, handlers.onDragEnd);
        eventBus.off(Events.Tool.GroupDragStart, handlers.onGroupDragStart);
        eventBus.off(Events.Tool.GroupDragUpdate, handlers.onGroupDragUpdate);
        eventBus.off(Events.Tool.GroupDragEnd, handlers.onGroupDragEnd);
        this._aiImageLaneHandlers = null;
    }

    _attachSelectionEvents() {
        const eventBus = this._boardCore?.eventBus;
        if (!eventBus || typeof eventBus.on !== 'function' || this._selectionHandlers) return;

        const onSelectionAdd = (data) => {
            void this._handleSelectionAdd(data);
        };
        const onSelectionRemove = (data) => {
            const objectId = data?.object;
            if (objectId) this._composer?.removeAttachmentForObject?.(objectId);
        };
        const onSelectionClear = () => {
            this._composer?.removeAllBoardAttachments?.();
        };
        const onBoxSelectStart = () => {
            this._boxSelectActive = true;
        };
        const onBoxSelectCommit = (data) => {
            void this._handleBoxSelectCommit(data);
        };

        this._selectionHandlers = {
            onSelectionAdd,
            onSelectionRemove,
            onSelectionClear,
            onBoxSelectStart,
            onBoxSelectCommit
        };
        eventBus.on(Events.Tool.SelectionAdd, onSelectionAdd);
        eventBus.on(Events.Tool.SelectionRemove, onSelectionRemove);
        eventBus.on(Events.Tool.SelectionClear, onSelectionClear);
        eventBus.on(Events.Tool.BoxSelectStart, onBoxSelectStart);
        eventBus.on(Events.Tool.BoxSelectCommit, onBoxSelectCommit);
    }

    _detachSelectionEvents() {
        const eventBus = this._boardCore?.eventBus;
        const handlers = this._selectionHandlers;
        if (!eventBus || typeof eventBus.off !== 'function' || !handlers) return;

        eventBus.off(Events.Tool.SelectionAdd, handlers.onSelectionAdd);
        eventBus.off(Events.Tool.SelectionRemove, handlers.onSelectionRemove);
        eventBus.off(Events.Tool.SelectionClear, handlers.onSelectionClear);
        eventBus.off(Events.Tool.BoxSelectStart, handlers.onBoxSelectStart);
        eventBus.off(Events.Tool.BoxSelectCommit, handlers.onBoxSelectCommit);
        this._selectionHandlers = null;
        this._boxSelectActive = false;
    }

    async _handleSelectionAdd(data = {}) {
        // Во время box-select каждый mousemove перевыставляет selection и снова
        // эмитит SelectionAdd для тех же id. Финальный набор reference-картинок
        // мы получим из BoxSelectCommit по strict-contains, поэтому здесь молчим.
        if (this._boxSelectActive) return;

        const objectId = data?.object;
        const object = this._boardCore?.state?.state?.objects?.find((item) => item?.id === objectId);

        if (!isReferenceImageObject(object)) return;

        await this._addImageObjectAsReference(object);
    }

    async _handleBoxSelectCommit(data = {}) {
        this._boxSelectActive = false;
        const ids = Array.isArray(data?.selected) ? data.selected : (Array.isArray(data?.objects) ? data.objects : []);
        if (!ids.length || !this._composer) return;

        const all = this._boardCore?.state?.state?.objects ?? [];
        const byId = new Map(all.map((item) => [item?.id, item]));
        const seen = new Set();
        for (const id of ids) {
            if (!id || seen.has(id)) continue;
            seen.add(id);
            const obj = byId.get(id);
            if (!obj || !isReferenceImageObject(obj)) continue;
            await this._addImageObjectAsReference(obj);
        }
    }

    async _addImageObjectAsReference(object) {
        if (!object || !this._composer) return;
        if (this._composer.hasAttachmentForObject?.(object.id)) return;

        try {
            const file = await createFileFromImageObject(object);
            if (!file) return;
            this._composer.addAttachment(file, { sourceObjectId: object.id });
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
        const batchOffset = batch.batchId ? (this._pendingBatchOffsets.get(batch.batchId) ?? 0) : 0;
        const leftmostCenter = anchor.x - ((count - 1) * step) / 2 + batchOffset;

        return {
            x: Math.round(leftmostCenter + index * step),
            y: anchor.y
        };
    }

    _getImageGroupAnchor() {
        const composerRect = this._refs?.composer?.getBoundingClientRect?.();
        if (composerRect) {
            let y = composerRect.top - 250;
            
            const errorBlock = this._refs?.errorBlock;
            if (errorBlock && errorBlock.classList.contains('is-visible')) {
                const errorRect = errorBlock.getBoundingClientRect();
                // Низ картинок примерно y + 150.
                // Хотим чтобы errorRect.top был хотя бы y + 150 + 16 (gap)
                // То есть y + 166 <= errorRect.top
                const minY = errorRect.top - 166;
                if (y > minY) {
                    y = minY;
                }
            }
            
            return {
                x: Math.round(composerRect.left + composerRect.width / 2),
                y: Math.round(y)
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

        const existingRight = this._getAiImageLaneRightBoundary(aiObjects);
        if (!Number.isFinite(existingRight)) return;
        const shift = Math.ceil(existingRight + BOARD_IMAGE_GAP - nextBatchBounds.left);
        if (shift <= 0) return;

        const ids = new Set(aiObjects.map((object) => object.id));
        const objects = this._boardCore?.state?.state?.objects;
        const shiftRecord = [];
        for (const id of ids) {
            const obj = objects?.find((item) => item.id === id);
            if (obj?.position) {
                const key = getAiImageLaneKeyForObject(obj);
                const currentSlot = this._getAiImageLaneSlotForObject(obj);
                const from = { x: obj.position.x, y: obj.position.y };
                if (this._draggingAiImageIds.has(id)) {
                    this._reserveAiImageLaneSlotForObject(obj);
                    continue;
                }
                const fromSlot = currentSlot ? { ...currentSlot } : null;
                const to = {
                    x: Math.round((currentSlot?.x ?? obj.position.x) - shift),
                    y: currentSlot?.y ?? obj.position.y
                };
                const toSlot = {
                    x: to.x,
                    y: to.y,
                    width: currentSlot?.width ?? getBoardObjectWidth(obj),
                    height: currentSlot?.height ?? getBoardObjectHeight(obj)
                };
                if (key) {
                    this._aiImageLaneSlots.set(key, toSlot);
                }
                shiftRecord.push({ id, from, fromSlot });
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
        for (const { id, from, fromSlot } of record) {
            const obj = objects?.find((item) => item.id === id);
            if (obj?.position) {
                const key = getAiImageLaneKeyForObject(obj);
                if (key && fromSlot) {
                    this._aiImageLaneSlots.set(key, fromSlot);
                }
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

    _pushBoardImagesUpIfNeeded() {
        const errorBlock = this._refs.errorBlock;
        if (!errorBlock) return;
        const errorRect = errorBlock.getBoundingClientRect();
        
        const aiObjects = this._getBoardAiImageObjects();
        if (aiObjects.length === 0) return;

        const world = this._boardCore?.pixi?.worldLayer || this._boardCore?.pixi?.app?.stage;
        const s = world?.scale?.x || 1;

        let maxOverlap = 0;
        for (const obj of aiObjects) {
            if (!obj.position) continue;
            const height = getBoardObjectHeight(obj);
            const bottomWorld = obj.position.y + height;
            const bottomScreen = bottomWorld * s + (world?.y || 0);

            const overlap = bottomScreen - (errorRect.top - 16);
            if (overlap > maxOverlap) {
                maxOverlap = overlap;
            }
        }

        if (maxOverlap > 0) {
            const shiftWorld = Math.ceil(maxOverlap / s);
            this._errorShiftAmount = shiftWorld;
            for (const obj of aiObjects) {
                if (obj.position) {
                    const from = { x: obj.position.x, y: obj.position.y };
                    const to = { x: obj.position.x, y: obj.position.y - shiftWorld };
                    this._animateBoardImageToPosition(obj.id, from, to);
                }
            }
        }
    }

    _pullBoardImagesDownIfNeeded() {
        if (!this._errorShiftAmount) return;
        const shiftWorld = this._errorShiftAmount;
        this._errorShiftAmount = 0;

        const aiObjects = this._getBoardAiImageObjects();
        for (const obj of aiObjects) {
            if (obj.position) {
                const from = { x: obj.position.x, y: obj.position.y };
                const to = { x: obj.position.x, y: obj.position.y + shiftWorld };
                this._animateBoardImageToPosition(obj.id, from, to);
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

    _getBoardObjectById(objectId) {
        const objects = this._boardCore?.state?.state?.objects;
        if (!objectId || !Array.isArray(objects)) return null;

        return objects.find((object) => object?.id === objectId) || null;
    }

    _startAiImageLaneDrag(ids) {
        const objects = this._getAiImageObjectsByIds(ids);
        if (objects.length === 0) return;

        this._reserveCurrentAiImageLaneSlots();
        for (const object of objects) {
            this._draggingAiImageIds.add(object.id);
        }
    }

    _updateAiImageLaneDrag(ids) {
        const objects = this._getAiImageObjectsByIds(ids);
        for (const object of objects) {
            this._reserveAiImageLaneSlotForObject(object);
        }
    }

    _endAiImageLaneDrag(ids) {
        const objects = this._getAiImageObjectsByIds(ids);
        for (const object of objects) {
            this._draggingAiImageIds.delete(object.id);
        }
    }

    _getAiImageObjectsByIds(ids) {
        const list = Array.isArray(ids) ? ids : [];
        const objects = [];

        for (const id of list) {
            const object = this._getBoardObjectById(id);
            if (isBoardAiImageObject(object)) {
                objects.push(object);
            }
        }

        return objects;
    }

    _reserveCurrentAiImageLaneSlots() {
        for (const object of this._getBoardAiImageObjects()) {
            this._reserveAiImageLaneSlotForObject(object);
        }
    }

    _reserveAiImageLaneSlotForObject(object) {
        const key = getAiImageLaneKeyForObject(object);
        if (!key || !object?.position) return null;

        const slot = {
            x: Math.round(object.position.x),
            y: Math.round(object.position.y),
            width: getBoardObjectWidth(object),
            height: getBoardObjectHeight(object)
        };
        this._aiImageLaneSlots.set(key, slot);

        return slot;
    }

    _reserveAiImageLaneSlotForMessage(messageId, centerWorldX, centerWorldY) {
        if (!messageId || !Number.isFinite(centerWorldX) || !Number.isFinite(centerWorldY)) return null;

        const [wr, hr] = parseFormatRatio(this._formatId);
        const width = BOARD_IMAGE_WIDTH;
        const height = Math.round(width / (wr / hr));
        const slot = {
            x: Math.round(centerWorldX - width / 2),
            y: Math.round(centerWorldY - height / 2),
            width,
            height
        };
        this._aiImageLaneSlots.set(messageId, slot);

        return slot;
    }

    _getAiImageLaneSlotForObject(object) {
        const key = getAiImageLaneKeyForObject(object);
        return (key && this._aiImageLaneSlots.get(key)) || this._reserveAiImageLaneSlotForObject(object);
    }

    _getAiImageLaneRightBoundary(objects = this._getBoardAiImageObjects(), excludeKey = null) {
        const rights = [];

        for (const object of objects) {
            const key = getAiImageLaneKeyForObject(object);
            if (key && key === excludeKey) continue;

            const slot = this._getAiImageLaneSlotForObject(object);
            if (slot) {
                rights.push(slot.x + slot.width);
            }
        }

        for (const [key, slot] of this._aiImageLaneSlots) {
            if (key === excludeKey) continue;

            if (slot && Number.isFinite(slot.x) && Number.isFinite(slot.width)) {
                rights.push(slot.x + slot.width);
            }
        }

        return rights.length > 0 ? Math.max(...rights) : null;
    }

    _resolveAiImageInsertPoint(msg, x, y, scale) {
        const world = this._boardCore?.pixi?.worldLayer || this._boardCore?.pixi?.app?.stage;
        const s = scale || world?.scale?.x || 1;
        const centerWorldX = (x - (world?.x || 0)) / s;
        const centerWorldY = (y - (world?.y || 0)) / s;
        let slot = this._reserveAiImageLaneSlotForMessage(msg.id, centerWorldX, centerWorldY);

        if (slot && this._doesBoardAiImageOverlapSlot(slot, msg.id)) {
            const right = this._getAiImageLaneRightBoundary(undefined, msg.id);
            if (Number.isFinite(right)) {
                slot = {
                    ...slot,
                    x: Math.round(right + BOARD_IMAGE_GAP)
                };
                this._aiImageLaneSlots.set(msg.id, slot);
            }
        }

        if (!slot) return { x, y };

        return {
            x: Math.round((slot.x + slot.width / 2) * s + (world?.x || 0)),
            y: Math.round((slot.y + slot.height / 2) * s + (world?.y || 0))
        };
    }

    _doesBoardAiImageOverlapSlot(candidate, excludeKey) {
        for (const object of this._getBoardAiImageObjects()) {
            const key = getAiImageLaneKeyForObject(object);
            if (key === excludeKey) continue;

            const slot = {
                x: Math.round(object.position.x),
                y: Math.round(object.position.y),
                width: getBoardObjectWidth(object),
                height: getBoardObjectHeight(object)
            };

            if (rectsOverlap(candidate, slot)) {
                return true;
            }
        }

        return false;
    }

    _addImageToBoard(msg) {
        if (!this._boardCore?.eventBus) return;
        const dataUrl = `data:${msg.mimeType || 'image/jpeg'};base64,${msg.imageBase64}`;
        const world = this._boardCore.pixi?.worldLayer || this._boardCore.pixi?.app?.stage;
        const s = world?.scale?.x || 1;
        const messages = this._session.getState().messages;
        this._shiftExistingImagesForBatch(messages, msg.id, s);

        // Pending-оверлей хранит worldX/worldY, зафиксированные в момент начала генерации.
        // Используем их чтобы разместить изображение в той же мировой точке,
        // независимо от того, сдвинул ли пользователь холст пока шла генерация.
        const pendingRecord = this._pendingOverlays.get(msg.id);
        let x, y;
        if (pendingRecord && typeof pendingRecord.worldX === 'number' && typeof pendingRecord.worldY === 'number') {
            x = Math.round(pendingRecord.worldX * s + (world?.x || 0));
            y = Math.round(pendingRecord.worldY * s + (world?.y || 0));
        } else {
            const slot = this._getImageBatchSlot(messages, msg.id, s);
            x = slot.x;
            y = slot.y;
        }
        const centerWorldX = (x - (world?.x || 0)) / s;
        const centerWorldY = (y - (world?.y || 0)) / s;
        const reservedSlot = this._reserveAiImageLaneSlotForMessage(msg.id, centerWorldX, centerWorldY);
        const insertPoint = pendingRecord && reservedSlot && !this._doesBoardAiImageOverlapSlot(reservedSlot, msg.id)
            ? { x, y }
            : this._resolveAiImageInsertPoint(msg, x, y, s);

        this._boardCore.eventBus.emit(Events.UI.PasteImageAt, {
            x: insertPoint.x,
            y: insertPoint.y,
            src: dataUrl,
            name: 'ai-generated.jpg',
            aiMessageId: msg.id,
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

    const target = list[targetIndex];
    if (target?.batchId) {
        const batchMessages = list.filter((m) => m.batchId === target.batchId);
        const index = batchMessages.findIndex((m) => m.id === messageId);
        return {
            index: Math.max(index, 0),
            count: batchMessages.length,
            ids: batchMessages.map((m) => m.id),
            batchId: target.batchId
        };
    }

    let start = targetIndex;
    while (start > 0 && isImageGenerationMessage(list[start - 1]) && !list[start - 1].batchId) {
        start--;
    }

    let end = targetIndex;
    while (end + 1 < list.length && isImageGenerationMessage(list[end + 1]) && !list[end + 1].batchId) {
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
        && (object.properties?.name === 'ai-generated.jpg' || object.properties?.aiMessageId)
        && object.position
        && Number.isFinite(object.position.x);
}

function getAiImageLaneKeyForObject(object) {
    return object?.properties?.aiMessageId || object?.id || null;
}

function rectsOverlap(a, b) {
    if (!a || !b) return false;

    return a.x < b.x + b.width
        && a.x + a.width > b.x
        && a.y < b.y + b.height
        && a.y + a.height > b.y;
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

function getBoardObjectHeight(object) {
    const height = object?.height ?? object?.properties?.height ?? BOARD_IMAGE_WIDTH;
    return Number.isFinite(height) ? Math.max(1, Math.round(height)) : BOARD_IMAGE_WIDTH;
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
