import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Model3dSessionController } from '../../src/services/ai/Model3dSessionController.js';

// Синхронизировано с POLL_INTERVAL_MS = 2500 в реализации.
const POLL_MS = 2500;

/**
 * Создаёт mock-клиент с дефолтным happy-path (glb, нет конвертации).
 * Отдельные методы переопределяются через overrides.
 */
function makeClient(overrides = {}) {
    return {
        submit3dModel: vi.fn().mockResolvedValue({ jobId: 'gen-1' }),
        poll3dModel: vi.fn().mockResolvedValue({
            status: 'done',
            needsConvert: false,
            previewBase64: 'base64preview',
            mimeType: 'image/png',
            modelUrl: '/model.glb',
            format: 'glb',
        }),
        submitConvert3d: vi.fn().mockResolvedValue({ jobId: 'conv-1' }),
        pollConvert3d: vi.fn().mockResolvedValue({
            status: 'done',
            modelUrl: '/model.fbx',
            format: 'fbx',
        }),
        ...overrides,
    };
}

describe('Model3dSessionController', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    // ─── downloadFormat 'glb' — один джоб ──────────────────────────────────────

    describe('downloadFormat "glb" — один джоб', () => {
        it('после done генерации сразу устанавливает result, submitConvert3d не вызывается', async () => {
            const client = makeClient();
            const ctrl = new Model3dSessionController({ aiClient: client });

            const p = ctrl.start({ mode: 'text', prompt: 'a robot', downloadFormat: 'glb' });
            await vi.advanceTimersByTimeAsync(POLL_MS + 100);
            await p;

            expect(client.submitConvert3d).not.toHaveBeenCalled();
            expect(ctrl.getState().status).toBe('done');
            expect(ctrl.getState().result).toMatchObject({
                format: 'glb',
                modelUrl: '/model.glb',
                previewBase64: 'base64preview',
                mimeType: 'image/png',
            });
        });

        it('poll3dModel вызывается с (jobId, signal, undefined, format)', async () => {
            const client = makeClient();
            const ctrl = new Model3dSessionController({ aiClient: client });

            const p = ctrl.start({ mode: 'text', prompt: 'x', downloadFormat: 'glb' });
            await vi.advanceTimersByTimeAsync(POLL_MS + 100);
            await p;

            expect(client.poll3dModel).toHaveBeenCalledWith(
                'gen-1',
                expect.anything(),
                undefined,
                'glb'
            );
        });

        it('состояние меняется: idle → submitting → polling → done', async () => {
            const client = makeClient();
            const ctrl = new Model3dSessionController({ aiClient: client });
            const statuses = [];
            ctrl.subscribe(s => statuses.push(s.status));

            const p = ctrl.start({ mode: 'text', prompt: 'x', downloadFormat: 'glb' });
            await vi.advanceTimersByTimeAsync(POLL_MS + 100);
            await p;

            expect(statuses).toEqual(['submitting', 'polling', 'done']);
        });
    });

    // ─── downloadFormat 'fbx' — двухфазная оркестрация ─────────────────────────

    describe('downloadFormat "fbx" — двухфазная оркестрация', () => {
        function makeFbxClient() {
            return makeClient({
                poll3dModel: vi.fn().mockResolvedValue({
                    status: 'done',
                    needsConvert: true,
                    sourceGlbUrl: '/gen.glb',
                    previewBase64: 'genPreview',
                    mimeType: 'image/png',
                }),
            });
        }

        it('после done генерации с needsConvert вызывает submitConvert3d с sourceGlbUrl', async () => {
            const client = makeFbxClient();
            const ctrl = new Model3dSessionController({ aiClient: client });

            const p = ctrl.start({ mode: 'image', downloadFormat: 'fbx' });
            await vi.advanceTimersByTimeAsync(POLL_MS + 100); // ждём poll генерации
            await vi.advanceTimersByTimeAsync(POLL_MS + 100); // ждём poll конвертации
            await p;

            expect(client.submitConvert3d).toHaveBeenCalledWith(
                expect.objectContaining({ glbUrl: '/gen.glb', format: 'fbx' })
            );
        });

        it('финальный result.format="fbx", result.preview взят из фазы генерации', async () => {
            const client = makeFbxClient();
            const ctrl = new Model3dSessionController({ aiClient: client });

            const p = ctrl.start({ mode: 'image', downloadFormat: 'fbx' });
            await vi.advanceTimersByTimeAsync(POLL_MS + 100);
            await vi.advanceTimersByTimeAsync(POLL_MS + 100);
            await p;

            const { result } = ctrl.getState();
            expect(ctrl.getState().status).toBe('done');
            expect(result.format).toBe('fbx');
            expect(result.modelUrl).toBe('/model.fbx');
            expect(result.previewBase64).toBe('genPreview'); // берётся из генерации, не из конвертации
            expect(result.mimeType).toBe('image/png');
        });

        it('pollConvert3d вызывается с (convertJobId, signal, format)', async () => {
            const client = makeFbxClient();
            const ctrl = new Model3dSessionController({ aiClient: client });

            const p = ctrl.start({ mode: 'image', downloadFormat: 'fbx' });
            await vi.advanceTimersByTimeAsync(POLL_MS + 100);
            await vi.advanceTimersByTimeAsync(POLL_MS + 100);
            await p;

            expect(client.pollConvert3d).toHaveBeenCalledWith(
                'conv-1',
                expect.anything(),
                'fbx'
            );
        });
    });

    // ─── abort ─────────────────────────────────────────────────────────────────

    describe('abort', () => {
        it('abort до первого поллинга — poll3dModel не вызывается', async () => {
            let resolveSubmit;
            const client = makeClient({
                submit3dModel: vi.fn().mockImplementation(
                    () => new Promise(r => { resolveSubmit = r; })
                ),
            });
            const ctrl = new Model3dSessionController({ aiClient: client });

            const p = ctrl.start({ downloadFormat: 'glb' });
            ctrl.abort();
            resolveSubmit({ jobId: 'gen-1' }); // submit разрешается после abort → start возвращает early

            await p;

            expect(client.poll3dModel).not.toHaveBeenCalled();
            expect(ctrl.getState().status).not.toBe('done');
        });

        it('abort во время ожидания submitConvert3d — фаза 2 не запускается', async () => {
            let resolveConvertSubmit;
            const client = makeClient({
                poll3dModel: vi.fn().mockResolvedValue({
                    status: 'done',
                    needsConvert: true,
                    sourceGlbUrl: '/gen.glb',
                    previewBase64: 'prev',
                    mimeType: 'image/png',
                }),
                submitConvert3d: vi.fn().mockImplementation(
                    () => new Promise(r => { resolveConvertSubmit = r; })
                ),
            });
            const ctrl = new Model3dSessionController({ aiClient: client });

            const p = ctrl.start({ downloadFormat: 'fbx' });
            await vi.advanceTimersByTimeAsync(POLL_MS + 100); // gen poll завершён, submitConvert3d pending

            ctrl.abort();
            resolveConvertSubmit({ jobId: 'conv-1' }); // разрешается после abort → signal.aborted → return

            await p;

            expect(client.pollConvert3d).not.toHaveBeenCalled();
            expect(ctrl.getState().status).not.toBe('done');
        });
    });

    // ─── ошибки ────────────────────────────────────────────────────────────────

    describe('ошибки', () => {
        it('ошибка poll3dModel устанавливает status="error" с сообщением', async () => {
            const client = makeClient({
                poll3dModel: vi.fn().mockRejectedValue(new Error('network timeout')),
            });
            const ctrl = new Model3dSessionController({ aiClient: client });

            const p = ctrl.start({ downloadFormat: 'glb' });
            await vi.advanceTimersByTimeAsync(POLL_MS + 100);
            await p;

            expect(ctrl.getState().status).toBe('error');
            expect(ctrl.getState().error).toContain('network timeout');
        });

        it('ошибка submit3dModel устанавливает status="error"', async () => {
            const client = makeClient({
                submit3dModel: vi.fn().mockRejectedValue(new Error('submit failed')),
            });
            const ctrl = new Model3dSessionController({ aiClient: client });

            await ctrl.start({ downloadFormat: 'glb' });

            expect(ctrl.getState().status).toBe('error');
            expect(ctrl.getState().error).toContain('submit failed');
        });
    });
});
