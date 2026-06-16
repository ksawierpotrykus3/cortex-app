import { test, expect } from '@playwright/test';

test.describe('Nexus App — podstawowe testy E2E', () => {

  test('powinien renderować aplikację z tytułem Nexus System', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Nexus System/);
  });

  test('powinien wyświetlać nagłówek NEXUS z przyciskami nawigacji', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('NEXUS').first()).toBeVisible();
    await expect(page.getByText('Topology').first()).toBeVisible();
    await expect(page.getByText('Laboratory').first()).toBeVisible();
    await expect(page.getByText('Knowledge Base').first()).toBeVisible();
    await expect(page.getByText('Agents').first()).toBeVisible();
  });

  test('powinien otwierać Command Palette przez Ctrl+K', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Control+k');
    // Po Ctrl+K powinien pojawić się overlay — sprawdzamy czy zniknął przycisk nawigacji (paleta otwarta)
    await expect(page.getByPlaceholder(/search|szukaj/i).first()).toBeVisible({ timeout: 3000 });
  });

  test('powinien zamykać Command Palette przez Escape', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Control+k');
    await expect(page.getByPlaceholder(/search|szukaj/i).first()).toBeVisible({ timeout: 3000 });
    await page.keyboard.press('Escape');
    await expect(page.getByPlaceholder(/search|szukaj/i)).toHaveCount(0);
  });
});
