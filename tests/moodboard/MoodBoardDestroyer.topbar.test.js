/**
 * Проверка: destroyMoodBoard вызывает topbar.destroy для корректного lifecycle.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createMoodBoard,
  mockState,
  resetMoodBoardTestState,
  settleMoodBoard,
  setupMoodBoardDom,
} from './MoodBoard.baseline.helpers.js';

describe('MoodBoardDestroyer: topbar lifecycle', () => {
  let container;
  let board;

  beforeEach(() => {
    resetMoodBoardTestState();
    container = setupMoodBoardDom();
  });

  afterEach(() => {
    board?.destroy?.();
    container?.remove();
    window.moodboardHtmlTextLayer = null;
    window.moodboardHtmlHandlesLayer = null;
  });

  it('destroyMoodBoard вызывает topbar.destroy', async () => {
    board = createMoodBoard(container, { autoLoad: false });
    await settleMoodBoard(board);

    const topbar = mockState.topbarInstances[0];
    expect(topbar).toBeTruthy();
    expect(topbar.destroy).toBeDefined();

    board.destroy();

    expect(topbar.destroy).toHaveBeenCalledTimes(1);
  });
});
