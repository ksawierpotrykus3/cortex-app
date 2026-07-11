import { test, expect } from '@playwright/test';

test.describe('Pipeline — testy E2E', () => {

  test('powinien wyświetlać Pipeline jako opcję w dropdown More', async ({ page }) => {
    await page.goto('/');
    await page.getByText('More').first().click();
    await expect(page.getByText('Pipeline').first()).toBeVisible();
  });

  test('powinien przełączyć widok na Pipeline przez dropdown More', async ({ page }) => {
    await page.goto('/');
    await page.getByText('More').first().click();
    await page.getByText('Pipeline').first().click();
    await expect(page.getByText('Pipeline').first()).toBeVisible();
  });
});
