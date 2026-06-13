import { test, expect } from '@playwright/test';

test.describe('Nexus App — podstawowe testy E2E', () => {

  test('powinien renderować aplikację z tytułem Nexus System', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Nexus System/);
  });

  test('powinien wyświetlać TopNavigation z kluczowymi przyciskami', async ({ page }) => {
    await page.goto('/');
    // Spodziewane elementy nawigacji
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('text=Nexus').first()).toBeVisible();
  });

  test('powinien otwierać LeftSidebar', async ({ page }) => {
    await page.goto('/');
    // Sidebar powinien być widoczny
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();
  });

  test('powinien otwierać Command Palette przez Ctrl+K', async ({ page }) => {
    await page.goto('/');
    // Symulacja Ctrl+K
    await page.keyboard.press('Control+k');
    // Command palette powinna się pojawić
    await expect(page.locator('[data-testid="command-palette"]').first()).toBeVisible({ timeout: 5000 });
  });
});
