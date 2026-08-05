import { Events } from '../../core/events/Events.js';
import { AiClient } from './AiClient.js';
import { IMAGE_MODELS, getImageModelCapability } from './imageModelCapabilities.js';
import { collectGeneratorInputs, collectGeneratorImageInputs } from './imageGeneratorInputs.js';
import { createReferenceFiles } from './imageReferenceFiles.js';
import { commitGeneratorUpdates } from './imageGeneratorState.js';
import {
    IMAGE_GENERATOR_TYPE,
    RESULT_STATUS,
    normalizeGeneratorProperties,
    clampCount,
} from './imageGeneratorContract.js';

const POLL_INTERVAL_MS = 2500;
const POLL_LIMIT_MS = 10 * 60 * 1000;

/** Событие запуска генерации из UI-слоя. */
export const GENERATOR_RUN_EVENT = 'image-generator:run';

/**
 * Движок узла-генератора: собирает промт из связей, ставит задачи в AI-сервис
 * и складывает результаты обратно в properties узла.
 *
 * Одна ответственность: оркестрация запуска. Разметку не трогает, о DOM не знает;
 * состояние передаёт через Events.Object.StateChanged, поэтому его подхватывают
 * и объект сцены, и слой управления, и автосохранение.
 */
export class ImageGeneratorRunner {
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
        this.eventBus.on(GENERATOR_RUN_EVENT, this._onRun);

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
            if (this._onRun) this.eventBus.off(GENERATOR_RUN_EVENT, this._onRun);
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

        const props = normalizeGeneratorProperties(node.properties);
        if (props.results.some((r) => r.status === RESULT_STATUS.Pending)) return;

        const objects = this._objects();
        const { prompt } = collectGeneratorInputs(objects, objectId);
        const { sources: imageSources } = collectGeneratorImageInputs(objects, objectId);

        if (!prompt && imageSources.length === 0) {
            this._failRun(objectId, '', 'Нет данных на входе: подключите текст к порту «Текст» или картинку к порту «Изображение»');
            return;
        }

        // Референсы грузим до постановки задач: молча сгенерировать без картинки,
        // которую пользователь подключил, хуже, чем показать причину отказа.
        let referenceImages = [];
        try {
            referenceImages = await createReferenceFiles(imageSources);
        } catch (err) {
            this._failRun(objectId, prompt, `Не удалось загрузить изображение с входа: ${err?.message || 'ошибка загрузки'}`);
            return;
        }

        const capability = getImageModelCapability(props.params.modelId) || IMAGE_MODELS[0];
        const count = Math.min(clampCount(props.params.count), capability?.maxCount ?? 4);
        const ratio = props.params.ratio;

        const pending = Array.from({ length: count }, () => ({
            id: makeResultId(),
            jobId: null,
            provider: capability?.provider || null,
            model: capability?.model || null,
            modelId: capability?.id || null,
            prompt,
            ratio,
            status: RESULT_STATUS.Pending,
            imageUrl: null,
            mimeType: null,
            error: null,
            createdAt: new Date().toISOString(),
        }));

        this._patch(objectId, { prompt, results: pending, activeResultIndex: 0 });

        const signal = this._abort?.signal;
        await Promise.all(pending.map((result) => this._runOne({
            objectId,
            result,
            capability,
            prompt,
            ratio,
            referenceImages,
            signal,
        })));
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
                status: RESULT_STATUS.Error,
                error: message,
                imageUrl: null,
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
            .filter((obj) => obj?.type === IMAGE_GENERATOR_TYPE)
            .forEach((node) => {
                const props = normalizeGeneratorProperties(node.properties);
                props.results.forEach((result) => {
                    if (result.status !== RESULT_STATUS.Pending || !result.jobId) return;
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

    async _runOne({ objectId, result, capability, prompt, ratio, referenceImages, signal }) {
        try {
            const { widthRatio, heightRatio } = parseRatio(ratio);

            const submitted = await this.client.submitImage({
                provider: capability?.provider,
                model: capability?.model,
                prompt,
                widthRatio,
                heightRatio,
                moodboardId: this._moodboardId(),
                referenceImages: referenceImages?.length ? referenceImages : undefined,
                signal,
            });

            const jobId = submitted?.jobId;
            if (!jobId) throw new Error('Сервис генерации не вернул идентификатор задачи');

            this._patchResult(objectId, result.id, { jobId });

            await this._poll({ objectId, resultId: result.id, jobId, provider: capability?.provider, signal });
        } catch (err) {
            this._patchResult(objectId, result.id, {
                status: RESULT_STATUS.Error,
                error: err?.name === 'AbortError' ? 'Отменено' : (err?.message || 'Ошибка запроса'),
            });
        }
    }

    async _poll({ objectId, resultId, jobId, provider, signal }) {
        if (this._pollingJobIds.has(jobId)) return;
        this._pollingJobIds.add(jobId);

        const startedAt = Date.now();

        try {
            for (;;) {
                if (signal?.aborted) throw new Error('Отменено');

                const status = await this.client.pollImage(jobId, signal, provider);

                if (status?.status === 'done') {
                    this._patchResult(objectId, resultId, {
                        status: RESULT_STATUS.Done,
                        imageUrl: status.imageUrl || null,
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
                status: RESULT_STATUS.Error,
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
        return this._objects().find((obj) => obj?.id === objectId && obj?.type === IMAGE_GENERATOR_TYPE) || null;
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
     * Точечно обновляет один результат: параллельные задачи не должны затирать
     * друг друга, поэтому массив каждый раз перечитывается из состояния.
     */
    _patchResult(objectId, resultId, patch) {
        const node = this._findNode(objectId);
        if (!node) return;

        const props = normalizeGeneratorProperties(node.properties);
        const results = props.results.map((item) => (item.id === resultId ? { ...item, ...patch } : item));

        this._patch(objectId, { results });
    }
}

function makeResultId() {
    return `res_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * @param {string} ratio
 * @returns {{widthRatio: number|undefined, heightRatio: number|undefined}}
 */
export function parseRatio(ratio) {
    if (!ratio || ratio === 'auto') return { widthRatio: undefined, heightRatio: undefined };

    const [w, h] = String(ratio).split(':').map((part) => Number.parseFloat(part));
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
        return { widthRatio: undefined, heightRatio: undefined };
    }

    return { widthRatio: w, heightRatio: h };
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
