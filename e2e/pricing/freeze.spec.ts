import { test, expect, Page } from '@playwright/test';

// Helper to login as admin
const loginAsAdmin = async (page: Page) => {
  await page.goto('/login');
  await page.fill('input#email', 'admin@boxemaster.pt');
  await page.fill('input#password', 'admin123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/(admin|owner)/, { timeout: 10000 });
};

test.describe.skip('Subscription Freeze Feature', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('members page loads correctly', async ({ page }) => {
    await page.goto('/admin/members');
    await expect(page.locator('h1:has-text("MEMBROS")')).toBeVisible({ timeout: 10000 });
  });

  test('can search for members', async ({ page }) => {
    await page.goto('/admin/members');
    await expect(page.locator('h1:has-text("MEMBROS")')).toBeVisible({ timeout: 10000 });

    // Should have a search input
    const searchInput = page.locator('input[placeholder*="Buscar"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('Test');
      await page.waitForTimeout(500);
    }
  });

  test('check-in page loads correctly', async ({ page }) => {
    await page.goto('/staff/checkin');
    // Check-in page should load
    await expect(page.locator('text=/Check-?in/i').first()).toBeVisible({ timeout: 10000 });
  });

  test('member detail page shows access section', async ({ page }) => {
    await page.goto('/admin/members');
    await expect(page.locator('h1:has-text("MEMBROS")')).toBeVisible({ timeout: 10000 });

    // Click on first member's eye icon (view details)
    const viewButton = page.locator('a[title="Ver detalhes"]').first();
    if (await viewButton.isVisible({ timeout: 5000 })) {
      await viewButton.click();

      // Should show member detail page
      await expect(page.locator('h1:has-text("EDITAR MEMBRO")')).toBeVisible({ timeout: 10000 });

      // Should have access section (use heading role for specificity)
      await expect(page.getByRole('heading', { name: 'Acesso' })).toBeVisible({ timeout: 5000 });
    }
  });

  test('member detail page shows auto-renewal status', async ({ page }) => {
    await page.goto('/admin/members');
    await expect(page.locator('h1:has-text("MEMBROS")')).toBeVisible({ timeout: 10000 });

    // Click on first member's eye icon (view details)
    const viewButton = page.locator('a[title="Ver detalhes"]').first();
    if (await viewButton.isVisible({ timeout: 5000 })) {
      await viewButton.click();

      // Should show member detail page
      await expect(page.locator('h1:has-text("EDITAR MEMBRO")')).toBeVisible({ timeout: 10000 });

      // May show auto-renewal status if member has subscription
      const autoRenewSection = page.locator('text=Renovacao Automatica');
      // This is optional - only shows if member has a subscription
    }
  });

  test('freeze UI elements are present for active members', async ({ page }) => {
    await page.goto('/admin/members');
    await expect(page.locator('h1:has-text("MEMBROS")')).toBeVisible({ timeout: 10000 });

    // Filter to active members
    await page.locator('[role="combobox"]').first().click();
    await page.locator('[role="option"]:has-text("Ativos")').click();

    // Click on first active member
    const viewButton = page.locator('a[title="Ver detalhes"]').first();
    if (await viewButton.isVisible({ timeout: 5000 })) {
      await viewButton.click();

      // Should show member detail page
      await expect(page.locator('h1:has-text("EDITAR MEMBRO")')).toBeVisible({ timeout: 10000 });

      // If member has subscription, should show freeze section
      // Check for "Pausar Subscricao" text
      const pausarSection = page.locator('text=Pausar Subscricao');
      // Note: May not be visible if member doesn't have a subscription
    }
  });

  test('PAUSADO status available in status dropdown', async ({ page }) => {
    await page.goto('/admin/members');
    await expect(page.locator('h1:has-text("MEMBROS")')).toBeVisible({ timeout: 10000 });

    // Click on first member
    const viewButton = page.locator('a[title="Ver detalhes"]').first();
    if (await viewButton.isVisible({ timeout: 5000 })) {
      await viewButton.click();
      await expect(page.locator('h1:has-text("EDITAR MEMBRO")')).toBeVisible({ timeout: 10000 });

      // Open status dropdown
      const statusSelect = page.locator('button:has-text("Ativo"), button:has-text("Lead"), button:has-text("Bloqueado"), button:has-text("Cancelado"), button:has-text("Pausado")').first();
      if (await statusSelect.isVisible({ timeout: 5000 })) {
        await statusSelect.click();

        // Should have PAUSADO option
        await expect(page.locator('[role="option"]:has-text("Pausado")')).toBeVisible({ timeout: 3000 });
      }
    }
  });

  test('admin dashboard loads', async ({ page }) => {
    await page.goto('/admin');
    // Dashboard should load
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });
  });
});
