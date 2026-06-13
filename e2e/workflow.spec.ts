import { test, expect } from '@playwright/test';

test.describe('Workflows — testy E2E', () => {

  test('powinien wyświetlić WorkflowEditor', async ({ page }) => {
    await page.goto('/');
    const workflowEditor = page.locator('[data-testid="workflow-editor"]');
    await expect(workflowEditor).toBeAttached();
  });

  test('powinien wyświetlić przycisk akcji Workflow', async ({ page }) => {
    await page.goto('/');
    // Szukamy elementów związanych z Workflow
    await expect(page.locator('text=Workflow').first()).toBeVisible();
  });
});
