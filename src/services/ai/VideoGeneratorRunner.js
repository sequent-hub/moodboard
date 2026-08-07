import { Events } from '../../core/events/Events.js';
import { AiClient } from './AiClient.js';
import { VIDEO_MODELS, getVideoModelCapability } from './videoModelCapabilities.js';
import { collectVideoGeneratorInputs } from './videoGeneratorInputs.js';
import { createReferenceFiles } from './imageReferenceFiles.js';
import { commitGeneratorUpdates } from './imageGeneratorState.js';
import {
    VIDEO_GENERATOR_TYPE,
    VIDEO_RESULT_STATUS,
    normalizeVideoGeneratorProperties,
    clampDuration,
} from './videoGeneratorContract.js';

const POLL_INTERVAL_MS = 3000;
const POLL_LIMIT_MS = 10 * 60 * 1000;

/** Событие запуска генерации из UI-слоя. */
export const VIDEO_GENERATOR_RUN_EVENT = 'video-generator:run';

/**
 * Движок узла-генератора видео: собирает промт и кадры из связей, ставит задачу
 * в AI-сервис и складывает результат обратно в properties узла.
 *
 * Одна ответственность: оркестрация запуска. Разметку не трогает, о DOM не знает;
 * состояние передаёт через commitGeneratorUpdates, поэтому его подхватывают и
 * объект сцены, и слой управления, и автосохранение.
 *
 * Поллинг здесь свой, а не через VideoSessionController: контроллер держит одну
 * сессию на инстанс и не умеет подхватывать задачу, поставленную до перезагрузки
 * страницы. Видео генерируется минутами — потерять результат из-за F5 нельзя.
 */
export class VideoGeneratorRunner {
    /**
     * @param {object} deps
     * @param {object} deps.core ядро мудборда
     * @param {AiClient} [deps.aiClient]
     */
    constructor({ core, aiClient } = {}) {
        this.core = core;
        this.eventBus = core?.eventBus || null;
        this.client = aiClient || new AiClient();
        this._pollingJobIds = new Set();
        this._abort = null;
        this._onRun = null;
        this._onBoardLoaded = null;
    }

    attach() {
        if (!this.eventBus) return;

        this._abort = new AbortController();

        this._onRun = (payload) => {
            const objectId = typeof payload === 'string' ? payload : payload?.objectId;
            if (objectId) void this.run(objectId);
        };
        this.eventBus.on(VIDEO_GENERATOR_RUN_EVENT, this._onRun);

        this._onBoardLoaded = () => {
            void this.resumeActiveJobs();
        };
        this.eventBus.on(Events.Board.Loaded, this._onBoardLoaded);
    }

    destroy() {
        try {
            this._abort?.abort();
        } catch (_) {}
        if (this.eventBus) {
            if (this._onRun) this.eventBus.off(VIDEO_GENERATOR_RUN_EVENT, this._onRun);
            if (this._onBoardLoaded) this.eventBus.off(Events.Board.Loaded, this._onBoardLoaded);
        }
        this._onRun = null;
        this._onBoardLoaded = null;
        this._pollingJobIds.clear();
        this.eventBus = null;
        this.core = null;
    }

    /**
     * Запускает генерацию для узла.
     * @param {string} objectId
     * @returns {Promise<void>}
     */
    async run(objectId) {
        const node = this._findNode(objectId);
        if (!node) return;

        const props = normalizeVideoGeneratorProperties(node.properties);
        if (props.results.some((r) => r.status === VIDEO_RESULT_STATUS.Pending)) return;

        const objects = this._objects();
        const { prompt, firstFrame, lastFrame } = collectVideoGeneratorInputs(objects, objectId);

        if (!prompt && !firstFrame) {
            this._failRun(objectId, '', 'Нет данных на входе: подключите текст к порту «Текст» или картинку к порту «Первый кадр»');
            return;
        }

        // Кадры грузим до постановки задачи: молча сгенерировать без картинки,
        // которую пользователь подключил, хуже, чем показать причину отказа.
        let referenceImages = [];
        let lastFrameFile;
        try {
            referenceImages = await createReferenceFiles(firstFrame ? [firstFrame] : []);
            [lastFrameFile] = await createReferenceFiles(lastFrame ? [lastFrame] : []);
        } catch (err) {
            this._failRun(objectId, prompt, `Не удалось загрузить изображение с входа: ${err?.message || 'ошибка загрузки'}`);
            return;
        }

        const capability = getVideoModelCapability(props.params.modelId) || VIDEO_MODELS[0];
        const ratio = props.params.ratio;
        const resolution = props.params.resolution;
        const duration = clampDuration(props.params.duration);

        const result = {
            id: makeResultId(),
            jobId: null,
            provider: capability?.provider || null,
            model: capability?.model || null,
            modelId: capability?.id || null,
            prompt,
            ratio,
            resolution,
            duration,
            status: VIDEO_RESULT_STATUS.Pending,
            videoUrl: null,
            mimeType: null,
            error: null,
            createdAt: new Date().toISOString(),
        };

        this._patch(objectId, { prompt, results: [result], activeResultIndex: 0 });

        const signal = this._abort?.signal;

        try {
            const submitted = await this.client.submitVideo({
                provider: capability?.provider,
                model: capability?.model,
                prompt,
                ratio,
                resolution,
                duration,
                moodboardId: this._moodboardId(),
                referenceImages: referenceImages.length ? referenceImages : undefined,
                lastFrame: lastFrameFile,
                signal,
            });

            const jobId = submitted?.jobId;
            if (!jobId) throw new Error('Сервис генерации не вернул идентификатор задачи');

            this._patchResult(objectId, result.id, { jobId });

            await this._poll({ objectId, resultId: result.id, jobId, provider: capability?.provider, signal });
        } catch (err) {
            this._patchResult(objectId, result.id, {
                status: VIDEO_RESULT_STATUS.Error,
                error: err?.name === 'AbortError' ? 'Отменено' : (err?.message || 'Ошибка запроса'),
            });
        }
    }

    /**
     * Останавливает запуск с понятной причиной вместо пустой генерации.
     *
     * @param {string} objectId
     * @param {string} prompt
     * @param {string} message
     */
    _failRun(objectId, prompt, message) {
        this._patch(objectId, {
            prompt,
            results: [{
                id: makeResultId(),
                status: VIDEO_RESULT_STATUS.Error,
                error: message,
                videoUrl: null,
                createdAt: new Date().toISOString(),
            }],
            activeResultIndex: 0,
        });
    }

    /**
     * Досматривает задачи, поставленные до перезагрузки страницы.
     * @returns {Promise<void>}
     */
    async resumeActiveJobs() {
        const signal = this._abort?.signal;

        const tasks = [];
        this._objects()
            .filter((obj) => obj?.type === VIDEO_GENERATOR_TYPE)
            .forEach((node) => {
                const props = normalizeVideoGeneratorProperties(node.properties);
                props.results.forEach((result) => {
                    if (result.status !== VIDEO_RESULT_STATUS.Pending || !result.jobId) return;
                    tasks.push(this._poll({
                        objectId: node.id,
                        resultId: result.id,
                        jobId: result.jobId,
                        provider: result.provider,
                        signal,
                    }).catch(() => {}));
                });
            });

        await Promise.all(tasks);
    }

    async _poll({ objectId, resultId, jobId, provider, signal }) {
        if (this._pollingJobIds.has(jobId)) return;
        this._pollingJobIds.add(jobId);

        const startedAt = Date.now();

        try {
            for (;;) {
                if (signal?.aborted) throw new Error('Отменено');

                const status = await this.client.pollVideo(jobId, signal, provider);

                if (status?.status === 'done') {
                    this._patchResult(objectId, resultId, {
                        status: VIDEO_RESULT_STATUS.Done,
                        videoUrl: status.videoUrl || null,
                        mimeType: status.mimeType || null,
                        error: null,
                    });
                    return;
                }

                if (status?.status === 'error') {
                    throw new Error(status?.error || 'Генерация не удалась');
                }

                if (Date.now() - startedAt > POLL_LIMIT_MS) {
                    throw new Error('Генерация не завершилась за отведённое время');
                }

                await sleep(POLL_INTERVAL_MS);
            }
        } catch (err) {
            this._patchResult(objectId, resultId, {
                status: VIDEO_RESULT_STATUS.Error,
                error: err?.message || 'Ошибка запроса',
            });
        } finally {
            this._pollingJobIds.delete(jobId);
        }
    }

    _objects() {
        try {
            return this.core?.state?.getObjects?.() || [];
        } catch (_) {
            return [];
        }
    }

    _findNode(objectId) {
        return this._objects().find((obj) => obj?.id === objectId && obj?.type === VIDEO_GENERATOR_TYPE) || null;
    }

    _moodboardId() {
        const id = this.core?.options?.boardId ?? this.core?.state?.state?.board?.id ?? null;
        return id == null ? undefined : String(id);
    }

    _patch(objectId, propertiesPatch) {
        if (!this.eventBus) return;
        commitGeneratorUpdates(this.core, this.eventBus, objectId, { properties: propertiesPatch });
    }

    /**
     * Точечно обновляет один результат: массив каждый раз перечитывается из
     * состояния, чтобы параллельные задачи не затирали друг друга.
     */
    _patchResult(objectId, resultId, patch) {
        const node = this._findNode(objectId);
        if (!node) return;

        const props = normalizeVideoGeneratorProperties(node.properties);
        const results = props.results.map((item) => (item.id === resultId ? { ...item, ...patch } : item));

        this._patch(objectId, { results });
    }
}

function makeResultId() {
    return `res_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
