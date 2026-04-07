/**
 * Тесты эмоджи-popup: Place.Set, контракты payload, клик по кнопке.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { Events } from '../../../src/core/events/Events.js';

const TINY_PNG_DATA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

vi.mock('../../../src/utils/iconLoader.js', () => ({
  IconLoader: class {
    async init() {}
    async loadAllIcons() {
      return {
        image: '<svg></svg>',
        shapes: '<svg></svg>',
        pencil: '<svg></svg>',
        emoji: '<svg></svg>',
        frame: '<svg></svg>'
      };
    }
  }
}));

vi.mock('../../../src/utils/inlinePngEmojis.js', () => ({
  getInlinePngEmojiUrl: (code) => (code ? TINY_PNG_DATA : null)
}));

import { Toolbar } from '../../../src/ui/Toolbar.js';

function createEventBus() {
  const handlers = new Map();
  return {
    on: vi.fn((event, handler) => {
      if (!handlers.has(event)) handlers.set(event, []);
      handlers.get(event).push(handler);
    }),
    emit: vi.fn((event, payload) => {
      const list = handlers.get(event) || [];
      list.forEach((h) => h(payload));
    }),
    off: vi.fn(),
    removeAllListeners: vi.fn(),
    _handlers: handlers
  };
}

async function flushToolbarInit() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('ToolbarPopupsController emoji', () => {
  let container;
  let toolbar;
  let eventBus;

  beforeEach(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    container = document.createElement('div');
    document.body.appendChild(container);
    eventBus = createEventBus();
    toolbar = new Toolbar(container, eventBus);
    await flushToolbarInit();
  });

  afterEach(() => {
    toolbar?.destroy?.();
    container?.remove();
    vi.restoreAllMocks();
  });

  it('клик по эмоджи в popup эмитит Place.Set с type image, isEmojiIcon true', () => {
    container.querySelector('.moodboard-toolbar__button--emoji').click();
    const popup = container.querySelector('.moodboard-toolbar__popup--emoji');
    expect(popup).toBeTruthy();
    const firstBtn = popup?.querySelector('.moodboard-emoji__btn');
    expect(firstBtn).toBeTruthy();

    firstBtn?.click();

    expect(eventBus.emit).toHaveBeenCalledWith(
      Events.Place.Set,
      expect.objectContaining({
        type: 'image',
        properties: expect.objectContaining({
          src: expect.any(String),
          width: 64,
          height: 64,
          isEmojiIcon: true
        }),
        size: expect.objectContaining({ width: 64, height: 64 })
      })
    );
  });

  it('popup содержит несколько эмоджи-кнопок с валидным src', () => {
    container.querySelector('.moodboard-toolbar__button--emoji').click();
    const btns = container.querySelectorAll('.moodboard-toolbar__popup--emoji .moodboard-emoji__btn');
    const imgs = container.querySelectorAll('.moodboard-toolbar__popup--emoji .moodboard-emoji__img');
    expect(btns.length).toBeGreaterThan(1);
    expect(imgs.length).toBeGreaterThan(1);
    imgs.forEach((img) => {
      expect(img.getAttribute('src')).toBeTruthy();
    });
  });

  it('Place.Set payload содержит size для ghost (64x64)', () => {
    container.querySelector('.moodboard-toolbar__button--emoji').click();
    const btn = container.querySelector('.moodboard-toolbar__popup--emoji .moodboard-emoji__btn');
    btn?.click();

    const placeSetCall = eventBus.emit.mock.calls.find((c) => c[0] === Events.Place.Set);
    expect(placeSetCall).toBeTruthy();
    const payload = placeSetCall[1];
    expect(payload.size).toEqual({ width: 64, height: 64 });
  });

  it('при emojiBasePath сохраняет локальный src вместо inline data URL', async () => {
    toolbar?.destroy?.();
    container.innerHTML = '';
    toolbar = new Toolbar(container, eventBus, 'light', { emojiBasePath: '/emoji-assets' });
    await flushToolbarInit();

    container.querySelector('.moodboard-toolbar__button--emoji').click();
    const btn = container.querySelector('.moodboard-toolbar__popup--emoji .moodboard-emoji__btn');
    btn?.click();

    const placeSetCall = eventBus.emit.mock.calls.find((c) => c[0] === Events.Place.Set);
    expect(placeSetCall).toBeTruthy();
    const payload = placeSetCall[1];
    const src = payload?.properties?.src;

    expect(typeof src).toBe('string');
    expect(src).toContain('/emoji-assets/');
    expect(src.startsWith('data:image/')).toBe(false);
  });
});
