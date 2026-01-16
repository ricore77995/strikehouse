import { test, expect, Page } from '@playwright/test';

// Helper to login as admin
const loginAsAdmin = async (page: Page) => {
  await page.goto('/login');
  await page.fill('input#email', 'admin@boxemaster.pt');
  await page.fill('input#password', 'admin123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/(admin|owner)/, { timeout: 10000 });
};

// Helper to generate unique test data
const generateUniqueName = () => {
  const timestamp = Date.now().toString(36);
  return `Test Lead ${timestamp}`;
};

const generateUniquePhone = () => {
  return `9${Math.floor(10000000 + Math.random() * 90000000)}`;
};

// Helper to navigate to Step 2 by creating a test member
const goToStep2 = async (page: Page) => {
  await page.goto('/staff/enrollment');
  await expect(page.locator('h1:has-text("MATRICULA")')).toBeVisible({ timeout: 10000 });

  // Click "Criar Novo" tab
  await page.click('button[role="tab"]:has-text("Criar Novo")');

  // Fill in test member data
  await page.fill('input[placeholder="Nome completo"]', generateUniqueName());
  await page.fill('input[placeholder="912345678"]', generateUniquePhone());

  // Submit to create member and advance to Step 2
  await page.click('button:has-text("Criar e Continuar")');

  // Wait for Step 2 to load
  await expect(page.locator('text=Configurar Subscricao')).toBeVisible({ timeout: 10000 });
};

// Helper to navigate to Step 2 and switch to Customizado tab
const goToStep2Custom = async (page: Page) => {
  await goToStep2(page);
  await page.click('button[role="tab"]:has-text("Customizado")');
  await expect(page.locator('label:has-text("Modalidades")')).toBeVisible({ timeout: 5000 });
};

test.describe.skip('Auto-Renewal Feature', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('shows auto-renewal checkbox in Plans tab', async ({ page }) => {
    await goToStep2(page);

    // Select a plan first
    const planCard = page.locator('.grid.gap-3 > div').first();
    await planCard.click();

    // Should show auto-renewal section after selecting a plan
    await expect(page.locator('label:has-text("Renovacao Automatica")')).toBeVisible();
    // shadcn Checkbox uses button[role="checkbox"] not input
    await expect(page.locator('button#autoRenewPlan[role="checkbox"]')).toBeVisible();
  });

  test('shows auto-renewal checkbox in Custom tab', async ({ page }) => {
    await goToStep2Custom(page);

    // Should show auto-renewal section
    await expect(page.locator('label:has-text("Renovacao Automatica")')).toBeVisible();
    await expect(page.locator('button#autoRenew[role="checkbox"]')).toBeVisible();
  });

  test('auto-renewal checkbox can be toggled in Custom tab', async ({ page }) => {
    await goToStep2Custom(page);

    const checkbox = page.locator('button#autoRenew[role="checkbox"]');

    // Initially unchecked
    await expect(checkbox).toHaveAttribute('data-state', 'unchecked');

    // Click to enable
    await checkbox.click();
    await expect(checkbox).toHaveAttribute('data-state', 'checked');

    // Click to disable
    await checkbox.click();
    await expect(checkbox).toHaveAttribute('data-state', 'unchecked');
  });

  test('auto-renewal checkbox can be toggled in Plans tab', async ({ page }) => {
    await goToStep2(page);

    // Select a plan first
    const planCard = page.locator('.grid.gap-3 > div').first();
    await planCard.click();

    const checkbox = page.locator('button#autoRenewPlan[role="checkbox"]');

    // Initially unchecked
    await expect(checkbox).toHaveAttribute('data-state', 'unchecked');

    // Click to enable
    await checkbox.click();
    await expect(checkbox).toHaveAttribute('data-state', 'checked');
  });

  test('auto-renewal description is visible', async ({ page }) => {
    await goToStep2Custom(page);

    // Should show description text
    await expect(page.locator('text=A subscricao sera renovada automaticamente quando expirar')).toBeVisible();
  });
});
