import { test, expect, Page } from '@playwright/test';

// Helper to get all modality cards from the grid
// Card renders with rounded-lg class, grid has gap-3
const getModalityCards = (page: Page) => {
  return page.locator('.grid.gap-3 > div.rounded-lg');
};

test.describe.skip('Modalities Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as ADMIN
    await page.goto('/login');
    await page.fill('input#email', 'admin@boxemaster.pt');
    await page.fill('input#password', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/(admin|owner)/, { timeout: 10000 });
  });

  test('displays default modalities on page load', async ({ page }) => {
    await page.goto('/admin/modalities');

    // Wait for page header
    await expect(page.locator('h1:has-text("MODALIDADES")')).toBeVisible({ timeout: 10000 });

    // Wait for loading to finish - grid should be visible
    await expect(page.locator('.grid.gap-3')).toBeVisible({ timeout: 5000 });

    // Should display default modalities - Badge renders a div with rounded-full class
    await expect(page.locator('div.rounded-full:text-is("boxe")')).toBeVisible();
    await expect(page.locator('div.rounded-full:text-is("muay_thai")')).toBeVisible();
  });

  test('creates a new modality', async ({ page }) => {
    await page.goto('/admin/modalities');

    // Wait for page to load
    await expect(page.locator('h1:has-text("MODALIDADES")')).toBeVisible({ timeout: 10000 });

    // Wait for grid to load
    await expect(page.locator('.grid.gap-3')).toBeVisible({ timeout: 5000 });

    // Generate unique code
    const uniqueCode = `test_${Date.now()}`;

    // Click new modality button
    await page.click('button:has-text("Nova Modalidade")');

    // Wait for dialog
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });

    // Fill form
    await page.fill('input#code', uniqueCode);
    await page.fill('input#nome', 'Test Modality');
    await page.fill('input#description', 'Test description');
    await page.fill('input#sort_order', '99');

    // Submit
    await page.click('button:has-text("Criar")');

    // Verify success - check for toast
    await expect(page.locator('[role="status"]:has-text("criada")').first()).toBeVisible({ timeout: 5000 });

    // Verify new modality appears in list
    await expect(page.locator(`text=${uniqueCode}`)).toBeVisible({ timeout: 3000 });
  });

  test('edits an existing modality', async ({ page }) => {
    await page.goto('/admin/modalities');

    // Wait for page to load
    await expect(page.locator('h1:has-text("MODALIDADES")')).toBeVisible({ timeout: 10000 });

    // Wait for grid to load
    await expect(page.locator('.grid.gap-3')).toBeVisible({ timeout: 5000 });

    // Find the first modality card and click its edit button (last button in the card)
    const firstCard = getModalityCards(page).first();
    await expect(firstCard).toBeVisible();

    // The edit button is the last button in the card (Pencil icon)
    // Use force:true for mobile where card overlay can intercept clicks
    await firstCard.locator('button').last().click({ force: true });

    // Wait for dialog
    await expect(page.locator('text=Editar Modalidade')).toBeVisible({ timeout: 5000 });

    // Update description
    await page.fill('input#description', 'Updated description ' + Date.now());

    // Save
    await page.click('button:has-text("Guardar")');

    // Verify success
    await expect(page.locator('[role="status"]:has-text("atualizada")').first()).toBeVisible({ timeout: 5000 });
  });

  test('toggles modality active status', async ({ page }) => {
    await page.goto('/admin/modalities');

    // Wait for page to load
    await expect(page.locator('h1:has-text("MODALIDADES")')).toBeVisible({ timeout: 10000 });

    // Wait for grid to load
    await expect(page.locator('.grid.gap-3')).toBeVisible({ timeout: 5000 });

    // Find the first modality card and its switch
    const firstCard = getModalityCards(page).first();
    await expect(firstCard).toBeVisible();
    const switchButton = firstCard.locator('button[role="switch"]');

    // Click to toggle
    await switchButton.click();

    // Verify status updated message
    await expect(page.locator('[role="status"]:has-text("Status atualizado")').first()).toBeVisible({ timeout: 5000 });

    // Toggle back to restore state
    await switchButton.click();
    await expect(page.locator('[role="status"]:has-text("Status atualizado")').first()).toBeVisible({ timeout: 5000 });
  });

  test('shows inactive badge when modality is disabled', async ({ page }) => {
    await page.goto('/admin/modalities');

    // Wait for page to load
    await expect(page.locator('h1:has-text("MODALIDADES")')).toBeVisible({ timeout: 10000 });

    // Wait for grid to load
    await expect(page.locator('.grid.gap-3')).toBeVisible({ timeout: 5000 });

    // Find the last modality card and disable it if active
    const lastCard = getModalityCards(page).last();
    await expect(lastCard).toBeVisible();
    const switchButton = lastCard.locator('button[role="switch"]');

    const initialState = await switchButton.getAttribute('data-state');

    // If currently active, disable it
    if (initialState === 'checked') {
      // Use force:true because card elements can intercept clicks on mobile
      await switchButton.click({ force: true });
      await expect(page.locator('[role="status"]:has-text("Status atualizado")').first()).toBeVisible({ timeout: 5000 });

      // Wait for React Query to invalidate and re-render (mobile timing issue)
      await page.waitForTimeout(500);

      // Verify inactive badge appears
      await expect(lastCard.locator('text=Inativo')).toBeVisible({ timeout: 5000 });

      // Re-enable to restore state
      // Use force:true because disabled card has opacity-50 which can intercept clicks on mobile
      await switchButton.click({ force: true });
    } else {
      // Already inactive, should show badge
      await expect(lastCard.locator('text=Inativo')).toBeVisible({ timeout: 5000 });
    }
  });

  test('prevents duplicate modality codes', async ({ page }) => {
    await page.goto('/admin/modalities');

    // Wait for page to load
    await expect(page.locator('h1:has-text("MODALIDADES")')).toBeVisible({ timeout: 10000 });

    // Wait for grid to load
    await expect(page.locator('.grid.gap-3')).toBeVisible({ timeout: 5000 });

    // Try to create modality with existing code
    await page.click('button:has-text("Nova Modalidade")');

    // Wait for dialog
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });

    await page.fill('input#code', 'boxe'); // Already exists
    await page.fill('input#nome', 'Boxe Duplicado');

    await page.click('button:has-text("Criar")');

    // Should show error toast
    await expect(page.locator('[role="status"]:has-text("Erro")').first()).toBeVisible({ timeout: 5000 });
  });
});
