import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupClipboardFlow } from '../../src/core/flows/ClipboardFlow.js';
import { Events } from '../../src/core/events/Events.js';

function createEventBus() {
  const listeners = new Map();
  return {
    on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(handler);
    },
    off(event, handler) {
      listeners.get(event)?.delete(handler);
    },
    emit(event, payload) {
      const handlers = listeners.get(event);
      if (!handlers) return;
      for (const handler of handlers) handler(payload);
    }
  };
}

describe('ClipboardFlow - PasteImageAt coordinates', () => {
  let originalImage;

  beforeEach(() => {
    originalImage = global.Image;
  });

  afterEach(() => {
    global.Image = originalImage;
    vi.restoreAllMocks();
  });

  it('конвертирует local canvas координаты в world для изображения (учет pan/zoom)', async () => {
    global.Image = class {
      constructor() {
        this.onload = null;
        this.onerror = null;
        this.naturalWidth = 100;
        this.naturalHeight = 50;
      }
      set src(_value) {
        if (this.onload) this.onload();
      }
    };

    const eventBus = createEventBus();
    const createObject = vi.fn();
    const core = {
      eventBus,
      createObject,
      pixi: {
        app: { stage: {}, view: { clientWidth: 1000, clientHeight: 700 } },
        worldLayer: { x: 180, y: 90, scale: { x: 2 } }
      },
      state: { state: { objects: [] } },
      history: { executeCommand: vi.fn() },
      toolManager: { getActiveTool: vi.fn(() => null) },
      selectTool: null
    };

    setupClipboardFlow(core);

    eventBus.emit(Events.UI.PasteImageAt, {
      x: 580,
      y: 390,
      src: 'data:image/png;base64,AAAA',
      name: 'image.png',
      imageId: 'img-1'
    });

    const worldX = (580 - 180) / 2;
    const worldY = (390 - 90) / 2;
    // w=300, h=150 для natural 100x50
    const expectedPosition = {
      x: Math.round(worldX - 150),
      y: Math.round(worldY - 75)
    };

    expect(createObject).toHaveBeenCalledWith(
      'image',
      expectedPosition,
      expect.objectContaining({
        src: 'data:image/png;base64,AAAA',
        name: 'image.png',
        width: 300,
        height: 150
      }),
      { imageId: 'img-1' }
    );
  });

  it('использует fallback размер 300x200 если загрузка image завершается ошибкой', async () => {
    global.Image = class {
      constructor() {
        this.onload = null;
        this.onerror = null;
      }
      set src(_value) {
        if (this.onerror) this.onerror();
      }
    };

    const eventBus = createEventBus();
    const createObject = vi.fn();
    const core = {
      eventBus,
      createObject,
      pixi: {
        app: { stage: {}, view: { clientWidth: 1000, clientHeight: 700 } },
        worldLayer: { x: 120, y: 40, scale: { x: 1.5 } }
      },
      state: { state: { objects: [] } },
      history: { executeCommand: vi.fn() },
      toolManager: { getActiveTool: vi.fn(() => null) },
      selectTool: null
    };

    setupClipboardFlow(core);

    eventBus.emit(Events.UI.PasteImageAt, {
      x: 420,
      y: 340,
      src: 'broken-src',
      name: 'broken.png',
      imageId: null
    });

    const worldX = (420 - 120) / 1.5;
    const worldY = (340 - 40) / 1.5;
    const expectedPosition = {
      x: Math.round(worldX - 150),
      y: Math.round(worldY - 100)
    };

    expect(createObject).toHaveBeenCalledWith(
      'image',
      expectedPosition,
      expect.objectContaining({
        width: 300,
        height: 200
      }),
      {}
    );
  });
});
