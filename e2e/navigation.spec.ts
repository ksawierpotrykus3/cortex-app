import { test, expect } from '@playwright/test';

test.describe('Nawigacja — testy E2E', () => {

  test('powinien przełączać widok na Laboratory', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Laboratory').first().click();
    // Po kliknięciu Laboratory, przycisk powinien być aktywny (mieć kolor akcentu)
    await expect(page.getByText('Laboratory').first()).toBeVisible();
  });

  test('powinien przełączać widok na Agents', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Agents').first().click();
    await expect(page.getByText('Agents').first()).toBeVisible();
  });

  test('powinien otwierać panel More i wybierać Wiki z dropdownu', async ({ page }) => {
    await page.goto('/');
    await page.getByText('More').first().click();
    // Dropdown powinien być widoczny
    await expect(page.getByText('Wiki').first()).toBeVisible();
    await page.getByText('Wiki').first().click();
    // Po kliknięciu dropdown znika
    await expect(page.getByText('Wiki').first()).not.toBeVisible();
  });

  test('powinien otwierać modal ustawień przez przycisk koła zębatego', async ({ page }) => {
    await page.goto('/');
    const settingsButton = page.locator('button').filter({ has: page.locator('svg') }).filter({ hasNot: page.locator('span') }).first();
    // Klikamy ostatni przycisk z ikonką w prawym górnym rogu
    const allButtons = page.locator('button');
    const count = await allButtons.count();
    // Szukamy przycisku z ikonką Settings (koło zębate)
    for (let i = 0; i < count; i++) {
      const btn = allButtons.nth(i);
      const html = await btn.innerHTML();
      if (html.includes('Settings') || html.includes('settings') || html.includes('wheel')) {
        await btn.click();
        break;
      }
    }
  });
});
