import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Events } from '../../src/core/events/Events.js';

vi.mock('../../src/assets/icons/cursor-default.svg?raw', () => ({
    default: '<svg width="32px" height="64px"></svg>',
}));

import { ToolManager } from '../../src/tools/ToolManager.js';

describe('ToolManager - drag and drop image upload', () => {
    let eventBus;
    let container;
    let core;
    let manager;
    let originalFileReader;
    let consoleWarnSpy;
    let originalMoodboardGlobal;

    beforeEach(() => {
        eventBus = { emit: vi.fn() };
        container = document.createElement('div');
        container.getBoundingClientRect = vi.fn(() => ({ left: 0, top: 0 }));
        core = { imageUploadService: { uploadImage: vi.fn() } };
        manager = new ToolManager(eventBus, container, null, core);
        originalFileReader = global.FileReader;
        originalMoodboardGlobal = (typeof window !== 'undefined') ? window.moodboard : undefined;
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        global.FileReader = originalFileReader;
        if (typeof window !== 'undefined') {
            window.moodboard = originalMoodboardGlobal;
        }
        consoleWarnSpy.mockRestore();
        vi.restoreAllMocks();
    });

    it('при успешном uploadImage эмитит PasteImageAt с server URL', async () => {
        core.imageUploadService.uploadImage.mockResolvedValue({
            url: '/api/v2/images/img-1/download',
            name: 'special.png'
        });

        const file = new Blob(['png'], { type: 'image/png' });
        file.name = 'special.png';
        const event = {
            preventDefault: vi.fn(),
            clientX: 100,
            clientY: 200,
            dataTransfer: {
                files: [file],
                getData: vi.fn(() => ''),
            },
        };

        await manager.handleDrop(event);

        expect(eventBus.emit).toHaveBeenCalledWith(Events.UI.PasteImageAt, {
            x: 100,
            y: 200,
            src: '/api/v2/images/img-1/download',
            name: 'special.png'
        });
    });

    it('при ошибке uploadImage не эмитит PasteImageAt и показывает warning', async () => {
        core.imageUploadService.uploadImage.mockRejectedValue(new Error('net::ERR_CONNECTION_TIMED_OUT'));
        const notifySpy = vi.fn();
        if (typeof window !== 'undefined') {
            window.moodboard = {
                workspaceManager: { showNotification: notifySpy }
            };
        }

        const file = new Blob(['png'], { type: 'image/png' });
        file.name = 'special.png';
        const event = {
            preventDefault: vi.fn(),
            clientX: 50,
            clientY: 60,
            dataTransfer: {
                files: [file],
                getData: vi.fn(() => ''),
            },
        };

        await manager.handleDrop(event);

        const imagePasteCalls = eventBus.emit.mock.calls.filter(([evt]) => evt === Events.UI.PasteImageAt);
        expect(imagePasteCalls).toHaveLength(0);
        expect(notifySpy).toHaveBeenCalledWith('Не удалось загрузить "special.png" на сервер. Изображение не добавлено.');
    });

    it('при drop обычного файла эмитит ToolbarAction type="file"', async () => {
        core.fileUploadService = { uploadFile: vi.fn().mockResolvedValue({
            id: 'file-1',
            fileId: 'file-1',
            name: 'report.pdf',
            size: 12345,
            mimeType: 'application/pdf',
            formattedSize: '12 KB',
            url: '/api/v2/files/file-1/download',
        }) };

        const file = new Blob(['pdf-content'], { type: 'application/pdf' });
        file.name = 'report.pdf';

        const event = {
            preventDefault: vi.fn(),
            clientX: 70,
            clientY: 90,
            dataTransfer: {
                files: [file],
                getData: vi.fn(() => ''),
            },
        };

        await manager.handleDrop(event);

        expect(eventBus.emit).toHaveBeenCalledWith(Events.UI.ToolbarAction, expect.objectContaining({
            type: 'file',
            id: 'file',
            fileId: 'file-1',
            position: { x: 10, y: 20 },
            properties: expect.objectContaining({
                fileName: 'report.pdf',
                mimeType: 'application/pdf',
                url: '/api/v2/files/file-1/download',
            }),
        }));
    });

    it('учитывает смещение canvas при drop изображения (client -> local)', async () => {
        container.getBoundingClientRect = vi.fn(() => ({ left: 120, top: 80 }));
        core.imageUploadService.uploadImage.mockResolvedValue({
            url: '/api/v2/images/img-2/download',
            name: 'offset.png'
        });

        const file = new Blob(['png'], { type: 'image/png' });
        file.name = 'offset.png';
        const event = {
            preventDefault: vi.fn(),
            clientX: 220,
            clientY: 230,
            dataTransfer: {
                files: [file],
                getData: vi.fn(() => ''),
            },
        };

        await manager.handleDrop(event);

        expect(eventBus.emit).toHaveBeenCalledWith(Events.UI.PasteImageAt, {
            x: 100,
            y: 150,
            src: '/api/v2/images/img-2/download',
            name: 'offset.png'
        });
    });

    it('для нескольких файлов применяет веерную раскладку от точки курсора', async () => {
        core.fileUploadService = {
            uploadFile: vi
                .fn()
                .mockResolvedValueOnce({
                    id: 'file-1',
                    fileId: 'file-1',
                    name: 'a.pdf',
                    size: 100,
                    mimeType: 'application/pdf',
                    formattedSize: '100 B',
                    url: '/api/v2/files/file-1/download',
                })
                .mockResolvedValueOnce({
                    id: 'file-2',
                    fileId: 'file-2',
                    name: 'b.pdf',
                    size: 200,
                    mimeType: 'application/pdf',
                    formattedSize: '200 B',
                    url: '/api/v2/files/file-2/download',
                })
                .mockResolvedValueOnce({
                    id: 'file-3',
                    fileId: 'file-3',
                    name: 'c.pdf',
                    size: 300,
                    mimeType: 'application/pdf',
                    formattedSize: '300 B',
                    url: '/api/v2/files/file-3/download',
                }),
        };

        const fileA = new Blob(['a'], { type: 'application/pdf' });
        fileA.name = 'a.pdf';
        const fileB = new Blob(['b'], { type: 'application/pdf' });
        fileB.name = 'b.pdf';
        const fileC = new Blob(['c'], { type: 'application/pdf' });
        fileC.name = 'c.pdf';

        const event = {
            preventDefault: vi.fn(),
            clientX: 100,
            clientY: 200,
            dataTransfer: {
                files: [fileA, fileB, fileC],
                getData: vi.fn(() => ''),
            },
        };

        await manager.handleDrop(event);

        const toolbarActions = eventBus.emit.mock.calls
            .filter(([evt]) => evt === Events.UI.ToolbarAction)
            .map(([, payload]) => payload);

        expect(toolbarActions).toHaveLength(3);
        expect(toolbarActions[0]).toEqual(expect.objectContaining({
            type: 'file',
            position: { x: 40, y: 130 },
            fileId: 'file-1',
        }));
        expect(toolbarActions[1]).toEqual(expect.objectContaining({
            type: 'file',
            position: { x: 65, y: 130 },
            fileId: 'file-2',
        }));
        expect(toolbarActions[2]).toEqual(expect.objectContaining({
            type: 'file',
            position: { x: 65, y: 155 },
            fileId: 'file-3',
        }));
    });

    it('для file route пересчитывает drop-позицию в world с учетом pan/zoom', async () => {
        core.fileUploadService = {
            uploadFile: vi.fn().mockResolvedValue({
                id: 'file-1',
                fileId: 'file-1',
                name: 'coords.txt',
                size: 4,
                mimeType: 'text/plain',
                formattedSize: '4 B',
                url: '/api/v2/files/file-1/download',
            }),
        };
        core.pixi = {
            worldLayer: {
                x: 180,
                y: 90,
                scale: { x: 2 }
            }
        };

        const file = new Blob(['test'], { type: 'text/plain' });
        file.name = 'coords.txt';
        const event = {
            preventDefault: vi.fn(),
            clientX: 580,
            clientY: 390,
            dataTransfer: {
                files: [file],
                getData: vi.fn(() => ''),
            },
        };

        await manager.handleDrop(event);

        const toolbarActionCall = eventBus.emit.mock.calls.find(([evt]) => evt === Events.UI.ToolbarAction);
        expect(toolbarActionCall).toBeTruthy();
        const payload = toolbarActionCall[1];
        const expectedWorld = { x: (580 - 180) / 2, y: (390 - 90) / 2 };
        expect(payload.position).toEqual({
            x: Math.round(expectedWorld.x - 60),
            y: Math.round(expectedWorld.y - 70),
        });
    });

    it('stale drop guard: результаты старого drop не эмитятся после нового drop', async () => {
        let resolveFirst;
        let resolveSecond;
        core.imageUploadService.uploadImage = vi
            .fn()
            .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
            .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));

        const file1 = new Blob(['png1'], { type: 'image/png' });
        file1.name = 'first.png';
        const file2 = new Blob(['png2'], { type: 'image/png' });
        file2.name = 'second.png';

        const firstDrop = manager.handleDrop({
            preventDefault: vi.fn(),
            clientX: 100,
            clientY: 120,
            dataTransfer: {
                files: [file1],
                getData: vi.fn(() => ''),
            },
        });

        const secondDrop = manager.handleDrop({
            preventDefault: vi.fn(),
            clientX: 200,
            clientY: 220,
            dataTransfer: {
                files: [file2],
                getData: vi.fn(() => ''),
            },
        });

        resolveSecond({
            url: '/api/v2/images/img-2/download',
            name: 'second.png'
        });
        await secondDrop;

        resolveFirst({
            url: '/api/v2/images/img-1/download',
            name: 'first.png'
        });
        await firstDrop;

        const pasteEvents = eventBus.emit.mock.calls
            .filter(([eventName]) => eventName === Events.UI.PasteImageAt)
            .map(([, payload]) => payload);

        expect(pasteEvents).toHaveLength(1);
        expect(pasteEvents[0]).toEqual({
            x: 200,
            y: 220,
            src: '/api/v2/images/img-2/download',
            name: 'second.png'
        });
    });

    it('ограничивает параллелизм file upload до 2 задач', async () => {
        const resolvers = new Map();
        const started = [];
        core.fileUploadService = {
            uploadFile: vi.fn((file) => new Promise((resolve) => {
                started.push(file.name);
                resolvers.set(file.name, () => resolve({
                    id: `id-${file.name}`,
                    fileId: `id-${file.name}`,
                    name: file.name,
                    size: file.size,
                    mimeType: file.type,
                    formattedSize: '1 B',
                    url: `/api/v2/files/${file.name}/download`,
                }));
            })),
        };

        const fileA = new Blob(['a'], { type: 'application/pdf' });
        fileA.name = 'a.pdf';
        const fileB = new Blob(['b'], { type: 'application/pdf' });
        fileB.name = 'b.pdf';
        const fileC = new Blob(['c'], { type: 'application/pdf' });
        fileC.name = 'c.pdf';

        const dropPromise = manager.handleDrop({
            preventDefault: vi.fn(),
            clientX: 100,
            clientY: 200,
            dataTransfer: {
                files: [fileA, fileB, fileC],
                getData: vi.fn(() => ''),
            },
        });

        await Promise.resolve();
        expect(started).toEqual(['a.pdf', 'b.pdf']);

        resolvers.get('a.pdf')();
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(started).toEqual(['a.pdf', 'b.pdf', 'c.pdf']);

        resolvers.get('b.pdf')();
        resolvers.get('c.pdf')();
        await dropPromise;

        const fileActions = eventBus.emit.mock.calls
            .filter(([eventName]) => eventName === Events.UI.ToolbarAction);
        expect(fileActions).toHaveLength(3);
    });

    it('ограничивает обработку до maxFilesPerDrop и показывает предупреждение', async () => {
        const notifySpy = vi.fn();
        if (typeof window !== 'undefined') {
            window.moodboard = {
                workspaceManager: { showNotification: notifySpy }
            };
        }
        core.fileUploadService = {
            uploadFile: vi.fn(async (file, name) => ({
                id: `id-${name}`,
                fileId: `id-${name}`,
                name: name || file.name,
                size: file.size || 0,
                mimeType: file.type || 'application/octet-stream',
                formattedSize: '1 B',
                url: `/api/v2/files/${name}/download`,
            })),
        };

        const files = Array.from({ length: 55 }, (_, i) => ({ name: `f${i}.txt`, size: 1, type: 'text/plain' }));
        await manager.handleDrop({
            preventDefault: vi.fn(),
            clientX: 100,
            clientY: 100,
            dataTransfer: {
                files,
                getData: vi.fn(() => ''),
            },
        });

        expect(core.fileUploadService.uploadFile).toHaveBeenCalledTimes(50);
        expect(notifySpy).toHaveBeenCalledWith('Обработаны первые 50 файлов из 55');
    });

    it('пропускает oversized файлы и обрабатывает только допустимые', async () => {
        const notifySpy = vi.fn();
        if (typeof window !== 'undefined') {
            window.moodboard = {
                workspaceManager: { showNotification: notifySpy }
            };
        }
        core.fileUploadService = {
            uploadFile: vi.fn(async (file, name) => ({
                id: `id-${name}`,
                fileId: `id-${name}`,
                name: name || file.name,
                size: file.size || 0,
                mimeType: file.type || 'application/octet-stream',
                formattedSize: '1 B',
                url: `/api/v2/files/${name}/download`,
            })),
        };

        const okFile = { name: 'ok.txt', size: 1024, type: 'text/plain' };
        const hugeFile = { name: 'huge.bin', size: 60 * 1024 * 1024, type: 'application/octet-stream' };

        await manager.handleDrop({
            preventDefault: vi.fn(),
            clientX: 100,
            clientY: 100,
            dataTransfer: {
                files: [okFile, hugeFile],
                getData: vi.fn(() => ''),
            },
        });

        expect(core.fileUploadService.uploadFile).toHaveBeenCalledTimes(1);
        expect(core.fileUploadService.uploadFile).toHaveBeenCalledWith(okFile, 'ok.txt');
        expect(notifySpy).toHaveBeenCalledWith('Пропущено 1 файлов: размер каждого должен быть не более 50 МБ');
    });
});
