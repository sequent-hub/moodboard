import { test, expect } from '@playwright/test';

test.describe('ImageObject2 toolbar button (Playwright)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-moodboard.html');
    await expect(page.locator('.moodboard-toolbar')).toBeVisible();
  });

  test('button exists and is visible', async ({ page }) => {
    const button = page.locator('.moodboard-toolbar__button--image2');
    await expect(button).toBeVisible();
  });

  test('button changes styles on hover', async ({ page }) => {
    const button = page.locator('.moodboard-toolbar__button--image2');
    await expect(button).toBeVisible();

    await button.hover();

    await expect(button).toHaveCSS('background-color', 'rgb(128, 216, 255)');
  });

  test('tooltip appears with expected text', async ({ page }) => {
    const button = page.locator('.moodboard-toolbar__button--image2');
    await button.hover();

    const visibleTooltip = page.locator('.moodboard-tooltip:visible', { hasText: 'Добавить картинку' });
    await expect(visibleTooltip).toHaveCount(1);
  });

  test('click opens file chooser', async ({ page }) => {
    const button = page.locator('.moodboard-toolbar__button--image2');
    await expect(button).toBeVisible();

    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      button.click()
    ]);

    expect(chooser).toBeTruthy();
  });
});
