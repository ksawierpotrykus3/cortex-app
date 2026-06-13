import { test, expect } from '@playwright/test';

test.describe('Pipeline — testy E2E', () => {

  test('powinien wyświetlić PipelineEditor', async ({ page }) => {
    await page.goto('/');
    // PipelineEditor powinien być dostępny w widoku pipline
    const pipelineEditor = page.locator('[data-testid="pipeline-editor"]');
    await expect(pipelineEditor).toBeAttached();
  });

  test('powinien wyświetlić listę pipelineów', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Pipeline').first()).toBeVisible();
  });
});
