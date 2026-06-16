import { test, expect } from '@playwright/test';

test.describe('Wiki — testy E2E', () => {

  test('powinien otwierać widok Wiki przez panel More', async ({ page }) => {
    await page.goto('/');
    await page.getByText('More').first().click();
    await expect(page.getByText('Wiki').first()).toBeVisible();
    await page.getByText('Wiki').first().click();
  });

  test('powinien wyświetlać przycisk Axioms w prawym panelu', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Axioms').first()).toBeVisible();
  });
});
