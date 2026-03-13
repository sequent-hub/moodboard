import { test, expect } from '@playwright/test';

test.describe('File drop viewport smoke', () => {
  test('handleDrop places file at world coordinates under pan/zoom', async ({ page }) => {
    await page.goto('/test-moodboard.html');
    await expect(page.locator('.moodboard-workspace__canvas canvas')).toBeVisible();
    await page.waitForFunction(() => {
      const board = window.moodboard;
      return !!(board && board.coreMoodboard && board.actionHandler);
    });

    const result = await page.evaluate(async () => {
      const core = window.moodboard.coreMoodboard;
      const world = core.pixi.worldLayer || core.pixi.app.stage;
      world.scale.set(2);
      world.x = 180;
      world.y = 90;

      core.fileUploadService.uploadFile = async (_file, name) => ({
        id: 'file-e2e-1',
        fileId: 'file-e2e-1',
        name: name || 'drop.txt',
        size: 4,
        mimeType: 'text/plain',
        formattedSize: '4 B',
        url: '/api/files/file-e2e-1/download'
      });

      const canvas = core.pixi.app.view;
      const rect = canvas.getBoundingClientRect();
      const local = { x: 580, y: 390 };
      const client = { x: rect.left + local.x, y: rect.top + local.y };

      const file = new File(['test'], 'drop.txt', { type: 'text/plain' });
      await core.toolManager.handleDrop({
        preventDefault() {},
        clientX: client.x,
        clientY: client.y,
        dataTransfer: {
          files: [file],
          getData() { return ''; }
        }
      });

      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      let last = null;
      for (let i = 0; i < 20; i += 1) {
        const boardData = window.moodboard.exportBoard();
        const files = (boardData?.objects || []).filter((o) => o.type === 'file');
        last = files[files.length - 1] || null;
        if (last) break;
        await wait(25);
      }
      const expected = {
        x: Math.round((local.x - world.x) / world.scale.x - 60),
        y: Math.round((local.y - world.y) / world.scale.x - 70)
      };

      return { last, expected };
    });

    expect(result.last).toBeTruthy();
    expect(result.last.position).toEqual(result.expected);
  });
});
