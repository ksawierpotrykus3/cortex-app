import { test, expect } from '@playwright/test';

test.describe('Workflows — testy E2E', () => {

  test('powinien przełączyć widok na Workflows przez panel More', async ({ page }) => {
    await page.goto('/');
    await page.getByText('More').first().click();
    await expect(page.getByText('Workflows').first()).toBeVisible();
    await page.getByText('Workflows').first().click();
  });

  test('powinien wyświetlać przycisk Workflows jako opcję w dropdown More', async ({ page }) => {
    await page.goto('/');
    await page.getByText('More').first().click();
    await expect(page.getByText('Workflows').first()).toBeVisible();
    await expect(page.getByText('Pipeline').first()).toBeVisible();
    await expect(page.getByText('Git').first()).toBeVisible();
  });
});
