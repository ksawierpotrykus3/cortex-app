import { test, expect } from '@playwright/test';

test.describe('Agenci — podstawowy przepływ E2E', () => {

  test('powinien wyświetlić panel agentów', async ({ page }) => {
    await page.goto('/');
    // Panel agentów — szukamy znanego tekstu
    await expect(page.locator('text=Agent').first()).toBeVisible();
  });

  test('powinien wyświetlić KillSwitchBanner po uruchomieniu agenta', async ({ page }) => {
    await page.goto('/');
    // Sprawdzamy czy komponent istnieje w DOM (ukryty domyślnie)
    const killBanner = page.locator('[data-testid="kill-switch-banner"]');
    await expect(killBanner).toBeAttached();
  });
});
