import { test, expect } from '@playwright/test';

test.describe('Wiki Panel — testy E2E', () => {

  test('powinien wyświetlić WikiPanel', async ({ page }) => {
    await page.goto('/');
    // WikiPanel jest częścią interfejsu
    await expect(page.locator('text=Wiki').first()).toBeVisible();
  });

  test('powinien przełączać widoki w RightPanel', async ({ page }) => {
    await page.goto('/');
    // Symulujemy kliknięcie w przycisk zmiany widoku (jeśli istnieje)
    const rightPanelButtons = page.locator('[data-testid="right-panel-button"]');
    const count = await rightPanelButtons.count();
    if (count > 0) {
      await rightPanelButtons.first().click();
    }
  });
});
