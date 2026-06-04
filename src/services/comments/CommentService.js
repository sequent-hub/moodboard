import { Events } from '../../core/events/Events.js';

/**
 * Хранилище тредов/сообщений и вызовы инжектированного CommentsAdapter.
 * Без HTTP — только adapter из options.
 */
export class CommentService {
    constructor({ eventBus, boardId, adapter, currentUser }) {
        this.eventBus = eventBus;
        this.boardId = boardId;
        this.adapter = adapter;
        this.currentUser = currentUser || null;
        /** @type {Map<number, object>} */
        this.threads = new Map();
        this._appliedMessageIds = new Set();
        this._appliedThreadIds = new Set();
        this._onObjectDeleted = this._onObjectDeleted.bind(this);
    }

    attach() {
        this.eventBus.on(Events.Object.Deleted, this._onObjectDeleted);
    }

    detach() {
        this.eventBus.off(Events.Object.Deleted, this._onObjectDeleted);
    }

    destroy() {
        this.detach();
        this.threads.clear();
        this._appliedMessageIds.clear();
        this._appliedThreadIds.clear();
    }

    getThread(threadId) {
        return this.threads.get(Number(threadId)) || null;
    }

    getAllThreads() {
        return Array.from(this.threads.values());
    }

    async loadInitial() {
        if (!this.adapter?.loadThreads) return;
        const data = await this.adapter.loadThreads(this.boardId, {
            include_resolved: true,
        });
        const items = data?.items || [];
        for (const item of items) {
            this._upsertThread(item);
            if (item.id != null) this._appliedThreadIds.add(Number(item.id));
            for (const msg of item.messages?.items || []) {
                if (msg?.id != null) this._appliedMessageIds.add(Number(msg.id));
            }
        }
    }

    /**
     * @param {{ x: number, y: number, anchor_object_id?: string, anchor_dx?: number, anchor_dy?: number, content: string }} payload
     */
    async createThread(payload) {
        if (!this.adapter?.createThread) {
            throw new Error('CommentsAdapter.createThread is not configured');
        }
        const result = await this.adapter.createThread(this.boardId, payload);
        const thread = result?.thread;
        if (thread) {
            this._upsertThread(thread);
            if (thread.id != null) this._appliedThreadIds.add(Number(thread.id));
            for (const msg of thread.messages?.items || []) {
                if (msg?.id != null) this._appliedMessageIds.add(Number(msg.id));
            }
            this.eventBus.emit(Events.Comment.PinCreated, {
                threadId: thread.id,
                x: thread.x,
                y: thread.y,
                anchorObjectId: thread.anchor_object_id || undefined,
            });
        }
        return thread;
    }

    async addReply(threadId, content) {
        const message = await this.adapter.addReply(this.boardId, threadId, content);
        this._applyMessageToThread(threadId, message);
        this.eventBus.emit(Events.Comment.MessageAdded, { threadId, message });
        if (message?.id != null) this._appliedMessageIds.add(Number(message.id));
        return message;
    }

    async resolveThread(threadId, resolved) {
        const thread = await this.adapter.resolveThread(this.boardId, threadId, resolved);
        if (thread) {
            this._upsertThread({ ...this.getThread(threadId), ...thread });
            this.eventBus.emit(Events.Comment.Resolved, {
                threadId,
                resolved: !!thread.resolved,
                resolvedBy: thread.resolved_by ?? undefined,
            });
        }
        return thread;
    }

    async updateMessage(messageId, content) {
        return this.adapter.updateMessage(this.boardId, messageId, content);
    }

    async deleteMessage(messageId) {
        const data = await this.adapter.deleteMessage(this.boardId, messageId);
        const threadId = data?.thread_id;
        const thread = threadId != null ? this.getThread(threadId) : null;
        if (thread?.messages?.items) {
            thread.messages.items = thread.messages.items.filter((m) => m.id !== messageId);
            thread.messages.count = thread.messages.items.length;
        }
        this.eventBus.emit(Events.Comment.Deleted, { threadId, messageId });
        return data;
    }

    openThread(threadId) {
        this.eventBus.emit(Events.Comment.ThreadOpened, { threadId });
    }

    /**
     * Payload из broadcastWith() §3.3
     */
    applyRemote(event) {
        if (!event) return;
        if (event.board_id != null && String(event.board_id) !== String(this.boardId)) return;
        const action = event.action;
        switch (action) {
            case 'thread.created': {
                const thread = event.thread;
                if (thread?.id != null && this._appliedThreadIds.has(Number(thread.id))) break;
                if (thread) {
                    this._upsertThread(thread);
                    if (thread.id != null) this._appliedThreadIds.add(Number(thread.id));
                }
                break;
            }
            case 'thread.updated': {
                const thread = event.thread;
                if (thread) {
                    const prev = this.getThread(thread.id);
                    this._upsertThread({ ...prev, ...thread, ...(event.changes || {}) });
                }
                break;
            }
            case 'thread.resolved': {
                const thread = event.thread;
                if (thread) {
                    const prev = this.getThread(thread.id);
                    this._upsertThread({ ...prev, ...thread });
                }
                break;
            }
            case 'comment.created': {
                const message = event.message;
                if (message?.id != null && this._appliedMessageIds.has(Number(message.id))) break;
                if (message?.thread_id != null) {
                    this._applyMessageToThread(message.thread_id, message);
                    if (message.id != null) this._appliedMessageIds.add(Number(message.id));
                }
                if (event.thread) {
                    const prev = this.getThread(event.thread.id);
                    this._upsertThread({ ...prev, ...event.thread });
                }
                break;
            }
            case 'comment.updated': {
                const message = event.message;
                if (message?.thread_id != null) {
                    this._replaceMessageInThread(message.thread_id, message);
                }
                break;
            }
            case 'comment.deleted': {
                const message = event.message;
                if (message?.thread_id != null && message?.id != null) {
                    const thread = this.getThread(message.thread_id);
                    if (thread?.messages?.items) {
                        thread.messages.items = thread.messages.items.filter((m) => m.id !== message.id);
                        thread.messages.count = thread.messages.items.length;
                    }
                }
                break;
            }
            default:
                break;
        }
        this.eventBus.emit(Events.Comment.RemoteUpdated, {
            action: event.action,
            boardId: event.board_id,
            thread: event.thread,
            message: event.message,
            changes: event.changes,
        });
    }

    _upsertThread(thread) {
        if (!thread || thread.id == null) return;
        const id = Number(thread.id);
        const prev = this.threads.get(id);
        const messages = thread.messages || prev?.messages;
        this.threads.set(id, { ...prev, ...thread, messages });
    }

    _applyMessageToThread(threadId, message) {
        const thread = this.getThread(threadId);
        if (!thread) return;
        if (!thread.messages) {
            thread.messages = { count: 0, has_more: false, items: [] };
        }
        const items = thread.messages.items || [];
        const idx = items.findIndex((m) => m.id === message.id);
        if (idx >= 0) items[idx] = message;
        else items.push(message);
        thread.messages.items = items;
        thread.messages.count = items.length;
        thread.messages_count = items.length;
    }

    _replaceMessageInThread(threadId, message) {
        const thread = this.getThread(threadId);
        if (!thread?.messages?.items) return;
        const idx = thread.messages.items.findIndex((m) => m.id === message.id);
        if (idx >= 0) thread.messages.items[idx] = message;
    }

    _onObjectDeleted({ objectId }) {
        if (!objectId) return;
        for (const thread of this.threads.values()) {
            if (thread.detached || thread.anchor_object_id !== objectId) continue;
            const wx = thread.x;
            const wy = thread.y;
            thread.detached = true;
            thread.x = wx;
            thread.y = wy;
            thread.anchor_object_id = null;
            thread.anchor_dx = null;
            thread.anchor_dy = null;
        }
    }

    /**
     * World-позиция пина для отрисовки
     */
    getThreadWorldPosition(thread, core) {
        if (!thread) return null;
        if (thread.detached || !thread.anchor_object_id) {
            return { x: thread.x, y: thread.y };
        }
        const pos = { objectId: thread.anchor_object_id, position: null };
        this.eventBus.emit(Events.Tool.GetObjectPosition, pos);
        if (!pos.position) {
            return { x: thread.x, y: thread.y };
        }
        return {
            x: pos.position.x + (thread.anchor_dx || 0),
            y: pos.position.y + (thread.anchor_dy || 0),
        };
    }
}
