import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test.use({ headless: false });

const ONE_BY_ONE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAL0lEQVR4nO3NMQEAAAwCoNm/9HI83hQkCq4aV0vFAAAAAAAAAAAAAAAA4G8Gf7sAAbY1g6wAAAAASUVORK5CYII=';

function writeImageToSystemClipboard() {
  const dir = mkdtempSync(join(tmpdir(), 'mb-clipboard-'));
  const imagePath = join(dir, 'paste-image.png');
  writeFileSync(imagePath, Buffer.from(ONE_BY_ONE_PNG_BASE64, 'base64'));

  const command = [
    'Add-Type -AssemblyName System.Windows.Forms;',
    'Add-Type -AssemblyName System.Drawing;',
    `$img=[System.Drawing.Image]::FromFile('${imagePath.replace(/\\/g, '\\\\')}');`,
    '[System.Windows.Forms.Clipboard]::SetImage($img);',
    '$img.Dispose();'
  ].join(' ');

  execFileSync('powershell', ['-NoProfile', '-STA', '-Command', command], {
    stdio: 'pipe'
  });
}

function writeFileToSystemClipboard() {
  const dir = mkdtempSync(join(tmpdir(), 'mb-clipboard-file-'));
  const filePath = join(dir, 'clipboard-real.xlsx');
  // Minimal ZIP signature is enough for file transfer test.
  writeFileSync(filePath, Buffer.from([0x50, 0x4b, 0x03, 0x04]));

  const command = [
    'Add-Type -AssemblyName System.Windows.Forms;',
    'Add-Type -AssemblyName System;',
    '$files = New-Object System.Collections.Specialized.StringCollection;',
    `$files.Add('${filePath.replace(/\\/g, '\\\\')}') | Out-Null;`,
    '[System.Windows.Forms.Clipboard]::SetFileDropList($files);'
  ].join(' ');

  execFileSync('powershell', ['-NoProfile', '-STA', '-Command', command], {
    stdio: 'pipe'
  });
}

function sendCtrlVWithAutoHotkey() {
  const scriptPath = 'd:\\npm-moodboard-futurello\\tests\\helpers\\clipboard-paste.ahk';
  execFileSync('AutoHotkey.exe', [scriptPath], {
    stdio: 'pipe'
  });
}

test.describe('Clipboard Ctrl+V real flow', () => {
  test.beforeEach(async ({ page }) => {

    await page.route('**/mock-image.png', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: Buffer.from(ONE_BY_ONE_PNG_BASE64, 'base64')
      });
    });

    await page.goto('/test-moodboard.html');
    await expect(page.locator('.moodboard-workspace__canvas canvas')).toBeVisible();
    await page.waitForFunction(() => {
      const board = window.moodboard;
      const core = board?.coreMoodboard;
      const toolbarListeners = core?.eventBus?.events?.get?.('toolbar:action');
      return Boolean(board && core && board.actionHandler) && Boolean(toolbarListeners && toolbarListeners.size > 0);
    });

    await page.evaluate(() => {
      const core = window.moodboard.coreMoodboard;
      window.moodboard.clearBoard();

      core.imageUploadService.uploadImage = async (_file, name) => ({
        url: '/mock-image.png',
        name: name || 'clipboard-image.png',
        width: 1,
        height: 1,
        size: 67
      });
      core.imageUploadService.uploadFromDataUrl = async (_dataUrl, name) => ({
        url: '/mock-image.png',
        name: name || 'clipboard-image.png',
        width: 1,
        height: 1,
        size: 67
      });
      core.fileUploadService.uploadFile = async (_file, name) => ({
        src: '/mock-file.xlsx',
        name: name || 'clipboard.xlsx',
        size: 12087,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        formattedSize: '11.8 KB'
      });
    });
  });

  test('pastes real image from clipboard and stores screenshot', async ({ page }, testInfo) => {
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    await canvas.click({ position: { x: 400, y: 300 } });
    writeImageToSystemClipboard();
    await page.bringToFront();

    await page.evaluate(() => {
      window.__pasteDiag = { fired: false, items: [], files: [] };
      document.addEventListener('paste', (e) => {
        const items = e.clipboardData?.items ? Array.from(e.clipboardData.items) : [];
        const files = e.clipboardData?.files ? Array.from(e.clipboardData.files) : [];
        window.__pasteDiag = {
          fired: true,
          items: items.map((i) => ({ kind: i.kind, type: i.type })),
          files: files.map((f) => ({ name: f.name, type: f.type, size: f.size }))
        };
      }, { capture: true, once: true });
    });

    const beforeCount = await page.evaluate(() => {
      const core = window.moodboard.coreMoodboard;
      return (core.state.state.objects || []).filter((o) => o.type === 'image' || o.type === 'revit-screenshot-img').length;
    });

    sendCtrlVWithAutoHotkey();

    let imageCount = beforeCount;
    for (let i = 0; i < 20; i += 1) {
      imageCount = await page.evaluate(() => {
        const core = window.moodboard.coreMoodboard;
        return (core.state.state.objects || []).filter((o) => o.type === 'image' || o.type === 'revit-screenshot-img').length;
      });
      if (imageCount > beforeCount) break;
      await page.waitForTimeout(250);
    }

    const pasteDiag = await page.evaluate(() => window.__pasteDiag || null);
    expect(
      imageCount,
      `paste diag: ${JSON.stringify(pasteDiag)}`
    ).toBeGreaterThan(beforeCount);
    expect(pasteDiag?.fired, `paste event was not fired: ${JSON.stringify(pasteDiag)}`).toBe(true);

    // In test mode we do not always receive server save ack,
    // so explicitly emulate save:success to reveal pending image visibility.
    await page.evaluate(() => {
      window.moodboard.coreMoodboard.eventBus.emit('save:success', { response: { historyVersion: 1 } });
    });
    await page.waitForTimeout(100);

    const imageState = await page.evaluate(() => {
      const core = window.moodboard.coreMoodboard;
      const images = (core.state.state.objects || []).filter((o) => o.type === 'image' || o.type === 'revit-screenshot-img');
      const last = images.at(-1);
      const pixi = last ? core.pixi.objects.get(last.id) : null;
      return {
        id: last?.id || null,
        src: last?.src || null,
        visible: pixi ? Boolean(pixi.visible) : false,
        alpha: pixi?.alpha ?? null
      };
    });

    expect(imageState.id).toBeTruthy();
    expect(imageState.src).toBeTruthy();
    expect(imageState.visible).toBe(true);
    expect(Number(imageState.alpha)).toBeGreaterThan(0);

    const screenshotPath = testInfo.outputPath('clipboard-image-real-paste.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await testInfo.attach('clipboard-image-real-paste', {
      path: screenshotPath,
      contentType: 'image/png'
    });
  });

  test('pastes real file from clipboard and stores screenshot', async ({ page }, testInfo) => {
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    await canvas.click({ position: { x: 450, y: 330 } });
    writeFileToSystemClipboard();
    await page.bringToFront();

    await page.evaluate(() => {
      window.__pasteDiagFile = { fired: false, items: [], files: [] };
      document.addEventListener('paste', (e) => {
        const items = e.clipboardData?.items ? Array.from(e.clipboardData.items) : [];
        const files = e.clipboardData?.files ? Array.from(e.clipboardData.files) : [];
        window.__pasteDiagFile = {
          fired: true,
          items: items.map((i) => ({ kind: i.kind, type: i.type })),
          files: files.map((f) => ({ name: f.name, type: f.type, size: f.size }))
        };
      }, { capture: true, once: true });
    });

    const beforeCount = await page.evaluate(() => {
      const core = window.moodboard.coreMoodboard;
      return (core.state.state.objects || []).filter((o) => o.type === 'file').length;
    });

    sendCtrlVWithAutoHotkey();

    let fileCount = beforeCount;
    for (let i = 0; i < 20; i += 1) {
      fileCount = await page.evaluate(() => {
        const core = window.moodboard.coreMoodboard;
        return (core.state.state.objects || []).filter((o) => o.type === 'file').length;
      });
      if (fileCount > beforeCount) break;
      await page.waitForTimeout(250);
    }

    const pasteDiagFile = await page.evaluate(() => window.__pasteDiagFile || null);
    expect(
      fileCount,
      `file paste diag: ${JSON.stringify(pasteDiagFile)}`
    ).toBeGreaterThan(beforeCount);
    expect(pasteDiagFile?.fired, `file paste event was not fired: ${JSON.stringify(pasteDiagFile)}`).toBe(true);

    // Mirror real save ack to reveal pending file visibility in test environment.
    await page.evaluate(() => {
      window.moodboard.coreMoodboard.eventBus.emit('save:success', { response: { historyVersion: 1 } });
    });
    await page.waitForTimeout(100);

    const fileState = await page.evaluate(() => {
      const core = window.moodboard.coreMoodboard;
      const files = (core.state.state.objects || []).filter((o) => o.type === 'file');
      const last = files.at(-1);
      const pixi = last ? core.pixi.objects.get(last.id) : null;
      return {
        id: last?.id || null,
        src: last?.src || null,
        visible: pixi ? Boolean(pixi.visible) : false,
        alpha: pixi?.alpha ?? null
      };
    });

    expect(fileState.id).toBeTruthy();
    expect(fileState.src).toBeTruthy();
    expect(fileState.visible).toBe(true);
    expect(Number(fileState.alpha)).toBeGreaterThan(0);

    const screenshotPath = testInfo.outputPath('clipboard-file-real-paste.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await testInfo.attach('clipboard-file-real-paste', {
      path: screenshotPath,
      contentType: 'image/png'
    });
  });
});
