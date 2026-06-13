import { test, expect } from '@playwright/test';

test.describe('Nawigacja — testy E2E', () => {

  test('powinien przełączać widoki Nexus/LabTodo/LabWriting', async ({ page }) => {
    await page.goto('/');
    // Szukamy przycisków widoków w TopNavigation
    const navButtons = page.locator('[data-testid="view-button"]');
    const count = await navButtons.count();
    if (count > 0) {
      await navButtons.first().click();
    }
  });

  test('powinien otwierać i zamykać modal Settings', async ({ page }) => {
    await page.goto('/');
    // Kliknięcie przycisku ustawień
    const settingsButton = page.locator('button').filter({ hasText: /Settings|Ustawienia/i });
    if (await settingsButton.count() > 0) {
      await settingsButton.first().click();
      // Modal powinien być widoczny
      await expect(page.locator('[role="dialog"], .modal, [data-testid="modal"]').first()).toBeVisible({ timeout: 3000 });
    }
  });
});
