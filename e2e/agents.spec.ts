import { test, expect } from '@playwright/test';

test.describe('Agenci — podstawowy przepływ E2E', () => {

  test('powinien przełączyć widok na Agents', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Agents').first().click();
    // W widoku agents powinien być widoczny przycisk Kill Switch
    await expect(page.getByText('Kill Switch').first()).toBeVisible();
  });

  test('powinien wyświetlać przycisk Kill Switch w domyślnym widoku', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Kill Switch').first()).toBeVisible();
  });
});
