import { test, expect } from '@playwright/test';

// Helper to generate truly unique codes
const generateUniqueCode = (prefix: string) => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `${prefix}${timestamp}${random}`.substring(0, 12).toUpperCase();
};

test.describe('Discounts Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as ADMIN
    await page.goto('/login');
    await page.fill('input#email', 'admin@boxemaster.pt');
    await page.fill('input#password', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/(admin|owner)/, { timeout: 10000 });
  });

  test('displays commitment discounts tab', async ({ page }) => {
    await page.goto('/admin/discounts');

    // Wait for page header
    await expect(page.locator('h1:has-text("DESCONTOS")')).toBeVisible({ timeout: 10000 });

    // Should have tabs for promo and commitment
    await expect(page.locator('button[role="tab"]:has-text("Promocionais")')).toBeVisible();
    await expect(page.locator('button[role="tab"]:has-text("Compromisso")')).toBeVisible();

    // Click commitment tab
    await page.click('button[role="tab"]:has-text("Compromisso")');

    // Should show default commitment discounts (use first() to avoid strict mode)
    await expect(page.locator('text=MENSAL').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=TRIMESTRAL').first()).toBeVisible();
    await expect(page.locator('text=SEMESTRAL').first()).toBeVisible();
    await expect(page.locator('text=ANUAL').first()).toBeVisible();

    // Should show explanatory text
    await expect(page.locator('text=automaticamente')).toBeVisible();
  });

  test('shows discount percentages for commitment periods', async ({ page }) => {
    await page.goto('/admin/discounts');

    // Wait for page header
    await expect(page.locator('h1:has-text("DESCONTOS")')).toBeVisible({ timeout: 10000 });

    // Go to commitment tab
    await page.click('button[role="tab"]:has-text("Compromisso")');

    // Wait for content
    await expect(page.locator('text=MENSAL').first()).toBeVisible({ timeout: 5000 });

    // Verify discount values are displayed (use first() to avoid strict mode)
    await expect(page.locator('text=0%').first()).toBeVisible();
    await expect(page.locator('text=10%').first()).toBeVisible();
    await expect(page.locator('text=15%').first()).toBeVisible();
    await expect(page.locator('text=20%').first()).toBeVisible();
  });

  test('creates a new promo code', async ({ page }) => {
    await page.goto('/admin/discounts');

    // Wait for page header
    await expect(page.locator('h1:has-text("DESCONTOS")')).toBeVisible({ timeout: 10000 });

    // Click new promo button
    await page.click('button:has-text("Novo Codigo Promo")');

    // Wait for dialog
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });

    // Fill form
    const uniqueCode = generateUniqueCode('T');
    await page.fill('input#code', uniqueCode);
    await page.fill('input#nome', 'Teste E2E Desconto');
    await page.fill('input#discount_value', '15');

    // Submit
    await page.click('button:has-text("Criar")');

    // Wait for dialog to close (indicates success)
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5000 });

    // Verify code appears in list (primary verification)
    await expect(page.locator(`text=${uniqueCode}`)).toBeVisible({ timeout: 5000 });
  });

  test('creates promo code with expiration date', async ({ page }) => {
    await page.goto('/admin/discounts');

    await expect(page.locator('h1:has-text("DESCONTOS")')).toBeVisible({ timeout: 10000 });

    await page.click('button:has-text("Novo Codigo Promo")');
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });

    const uniqueCode = generateUniqueCode('E');
    await page.fill('input#code', uniqueCode);
    await page.fill('input#nome', 'Promo Expira');
    await page.fill('input#discount_value', '20');

    // Set expiration date (7 days from now)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const dateStr = futureDate.toISOString().split('T')[0];
    await page.fill('input#valid_until', dateStr);

    await page.click('button:has-text("Criar")');

    // Wait for dialog to close (indicates success)
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5000 });

    // Verify code appears in list
    await expect(page.locator(`text=${uniqueCode}`)).toBeVisible({ timeout: 5000 });
  });

  test('creates promo code with max uses limit', async ({ page }) => {
    await page.goto('/admin/discounts');

    await expect(page.locator('h1:has-text("DESCONTOS")')).toBeVisible({ timeout: 10000 });

    await page.click('button:has-text("Novo Codigo Promo")');
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });

    const uniqueCode = generateUniqueCode('L');
    await page.fill('input#code', uniqueCode);
    await page.fill('input#nome', 'Promo Limitada');
    await page.fill('input#discount_value', '10');
    await page.fill('input#max_uses', '50');

    await page.click('button:has-text("Criar")');

    // Wait for dialog to close (indicates success)
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5000 });

    // Verify code appears in list with usage counter
    await expect(page.locator(`text=${uniqueCode}`)).toBeVisible({ timeout: 5000 });
    await expect(page.locator(`text=0/50`).first()).toBeVisible({ timeout: 3000 });
  });

  test('creates promo code for new members only', async ({ page }) => {
    await page.goto('/admin/discounts');

    await expect(page.locator('h1:has-text("DESCONTOS")')).toBeVisible({ timeout: 10000 });

    await page.click('button:has-text("Novo Codigo Promo")');
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });

    const uniqueCode = generateUniqueCode('N');
    await page.fill('input#code', uniqueCode);
    await page.fill('input#nome', 'Novos Membros');
    await page.fill('input#discount_value', '25');

    // Toggle new members only
    await page.locator('[role="dialog"]').locator('button[role="switch"]').click();

    await page.click('button:has-text("Criar")');

    // Wait for dialog to close (indicates success)
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5000 });

    // Verify code appears in list
    await expect(page.locator(`text=${uniqueCode}`)).toBeVisible({ timeout: 5000 });
  });

  test('edits an existing promo code', async ({ page }) => {
    await page.goto('/admin/discounts');

    await expect(page.locator('h1:has-text("DESCONTOS")')).toBeVisible({ timeout: 10000 });

    // First create a promo code
    await page.click('button:has-text("Novo Codigo Promo")');
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });

    const uniqueCode = generateUniqueCode('D');
    await page.fill('input#code', uniqueCode);
    await page.fill('input#nome', 'Para Editar');
    await page.fill('input#discount_value', '10');
    await page.click('button:has-text("Criar")');

    // Wait for dialog to close (indicates success)
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5000 });

    // Verify code appears in list
    await expect(page.locator(`text=${uniqueCode}`)).toBeVisible({ timeout: 5000 });

    // Now edit it - find the card with the code and click the edit button
    const promoCard = page.locator(`text=${uniqueCode}`).locator('..').locator('..').locator('..');
    await promoCard.locator('button').last().click();

    // Wait for edit dialog
    await expect(page.locator('text=Editar Desconto')).toBeVisible({ timeout: 5000 });

    // Update name
    await page.fill('input#nome', 'Editado E2E');
    await page.click('button:has-text("Guardar")');

    // Wait for dialog to close (indicates success)
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5000 });

    // Verify the specific code card now shows the new name
    // Re-locate the card to get fresh DOM
    const updatedCard = page.locator(`text=${uniqueCode}`).locator('..').locator('..').locator('..');
    await expect(updatedCard.locator('text=Editado E2E')).toBeVisible({ timeout: 3000 });
  });

  test('toggles promo code active status', async ({ page }) => {
    await page.goto('/admin/discounts');

    await expect(page.locator('h1:has-text("DESCONTOS")')).toBeVisible({ timeout: 10000 });

    // Create a promo code first
    await page.click('button:has-text("Novo Codigo Promo")');
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });

    const uniqueCode = generateUniqueCode('G');
    await page.fill('input#code', uniqueCode);
    await page.fill('input#nome', 'Para Toggle');
    await page.fill('input#discount_value', '5');
    await page.click('button:has-text("Criar")');

    // Wait for dialog to close
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5000 });

    // Verify code appears in list
    await expect(page.locator(`text=${uniqueCode}`)).toBeVisible({ timeout: 5000 });

    // Find and toggle switch - it's in the card, not the dialog
    const promoCard = page.locator(`text=${uniqueCode}`).locator('..').locator('..').locator('..');
    const switchBtn = promoCard.locator('button[role="switch"]');

    // Get initial state
    const initialState = await switchBtn.getAttribute('data-state');
    await switchBtn.click();

    // Wait for state to change
    await page.waitForTimeout(500);
    const newState = await switchBtn.getAttribute('data-state');
    expect(newState).not.toBe(initialState);
  });

  test('prevents duplicate promo codes', async ({ page }) => {
    await page.goto('/admin/discounts');

    await expect(page.locator('h1:has-text("DESCONTOS")')).toBeVisible({ timeout: 10000 });

    // Create first promo
    await page.click('button:has-text("Novo Codigo Promo")');
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });

    const uniqueCode = generateUniqueCode('P');
    await page.fill('input#code', uniqueCode);
    await page.fill('input#nome', 'Original');
    await page.fill('input#discount_value', '10');
    await page.click('button:has-text("Criar")');

    // Wait for dialog to close
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5000 });

    // Verify code appears in list
    await expect(page.locator(`text=${uniqueCode}`)).toBeVisible({ timeout: 5000 });

    // Try to create duplicate
    await page.click('button:has-text("Novo Codigo Promo")');
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
    await page.fill('input#code', uniqueCode);
    await page.fill('input#nome', 'Duplicado');
    await page.fill('input#discount_value', '20');
    await page.click('button:has-text("Criar")');

    // Dialog should stay open (indicates error)
    await page.waitForTimeout(1000);
    await expect(page.locator('[role="dialog"]')).toBeVisible();
  });

  test('creates fixed amount discount', async ({ page }) => {
    await page.goto('/admin/discounts');

    await expect(page.locator('h1:has-text("DESCONTOS")')).toBeVisible({ timeout: 10000 });

    await page.click('button:has-text("Novo Codigo Promo")');
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });

    const uniqueCode = generateUniqueCode('F');
    await page.fill('input#code', uniqueCode);
    await page.fill('input#nome', 'Desconto Fixo');

    // Select fixed type using the Select component
    await page.locator('[role="dialog"]').locator('button[role="combobox"]').click();
    await page.click('div[role="option"]:has-text("Valor Fixo")');

    // Enter fixed amount
    await page.fill('input#discount_value', '500');

    await page.click('button:has-text("Criar")');

    // Wait for dialog to close (indicates success)
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5000 });

    // Verify code appears in list
    await expect(page.locator(`text=${uniqueCode}`)).toBeVisible({ timeout: 5000 });
  });
});
