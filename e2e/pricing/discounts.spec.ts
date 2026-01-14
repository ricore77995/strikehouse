import { test, expect } from '@playwright/test';

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

    // Should show default commitment discounts
    await expect(page.locator('text=MENSAL')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=TRIMESTRAL')).toBeVisible();
    await expect(page.locator('text=SEMESTRAL')).toBeVisible();
    await expect(page.locator('text=ANUAL')).toBeVisible();

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
    await expect(page.locator('text=MENSAL')).toBeVisible({ timeout: 5000 });

    // Verify discount values are displayed
    await expect(page.locator('text=0%')).toBeVisible();
    await expect(page.locator('text=10%')).toBeVisible();
    await expect(page.locator('text=15%')).toBeVisible();
    await expect(page.locator('text=20%')).toBeVisible();
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
    const uniqueCode = `TEST${Date.now()}`.substring(0, 10).toUpperCase();
    await page.fill('input#code', uniqueCode);
    await page.fill('input#nome', 'Teste E2E Desconto');
    await page.fill('input#discount_value', '15');

    // Submit
    await page.click('button:has-text("Criar")');

    // Verify success
    await expect(page.locator('[role="status"]:has-text("criado")')).toBeVisible({ timeout: 5000 });

    // Verify code appears in list
    await expect(page.locator(`text=${uniqueCode}`)).toBeVisible({ timeout: 3000 });
  });

  test('creates promo code with expiration date', async ({ page }) => {
    await page.goto('/admin/discounts');

    await expect(page.locator('h1:has-text("DESCONTOS")')).toBeVisible({ timeout: 10000 });

    await page.click('button:has-text("Novo Codigo Promo")');
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });

    const uniqueCode = `EXP${Date.now()}`.substring(0, 10).toUpperCase();
    await page.fill('input#code', uniqueCode);
    await page.fill('input#nome', 'Promo Expira');
    await page.fill('input#discount_value', '20');

    // Set expiration date (7 days from now)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const dateStr = futureDate.toISOString().split('T')[0];
    await page.fill('input#valid_until', dateStr);

    await page.click('button:has-text("Criar")');

    await expect(page.locator('[role="status"]:has-text("criado")')).toBeVisible({ timeout: 5000 });
  });

  test('creates promo code with max uses limit', async ({ page }) => {
    await page.goto('/admin/discounts');

    await expect(page.locator('h1:has-text("DESCONTOS")')).toBeVisible({ timeout: 10000 });

    await page.click('button:has-text("Novo Codigo Promo")');
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });

    const uniqueCode = `LIM${Date.now()}`.substring(0, 10).toUpperCase();
    await page.fill('input#code', uniqueCode);
    await page.fill('input#nome', 'Promo Limitada');
    await page.fill('input#discount_value', '10');
    await page.fill('input#max_uses', '50');

    await page.click('button:has-text("Criar")');

    await expect(page.locator('[role="status"]:has-text("criado")')).toBeVisible({ timeout: 5000 });

    // Verify usage counter shown
    await expect(page.locator(`text=0/50`)).toBeVisible({ timeout: 3000 });
  });

  test('creates promo code for new members only', async ({ page }) => {
    await page.goto('/admin/discounts');

    await expect(page.locator('h1:has-text("DESCONTOS")')).toBeVisible({ timeout: 10000 });

    await page.click('button:has-text("Novo Codigo Promo")');
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });

    const uniqueCode = `NEW${Date.now()}`.substring(0, 10).toUpperCase();
    await page.fill('input#code', uniqueCode);
    await page.fill('input#nome', 'Novos Membros');
    await page.fill('input#discount_value', '25');

    // Toggle new members only
    await page.locator('[role="dialog"]').locator('button[role="switch"]').click();

    await page.click('button:has-text("Criar")');

    await expect(page.locator('[role="status"]:has-text("criado")')).toBeVisible({ timeout: 5000 });

    // Verify badge shown
    await expect(page.locator('text=Novos membros')).toBeVisible({ timeout: 3000 });
  });

  test('edits an existing promo code', async ({ page }) => {
    await page.goto('/admin/discounts');

    await expect(page.locator('h1:has-text("DESCONTOS")')).toBeVisible({ timeout: 10000 });

    // First create a promo code
    await page.click('button:has-text("Novo Codigo Promo")');
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });

    const uniqueCode = `EDT${Date.now()}`.substring(0, 10).toUpperCase();
    await page.fill('input#code', uniqueCode);
    await page.fill('input#nome', 'Para Editar');
    await page.fill('input#discount_value', '10');
    await page.click('button:has-text("Criar")');

    await expect(page.locator('[role="status"]:has-text("criado")')).toBeVisible({ timeout: 5000 });

    // Wait for dialog to close
    await page.waitForTimeout(500);

    // Now edit it - find the card with the code and click the edit button
    const promoCard = page.locator(`text=${uniqueCode}`).locator('..').locator('..').locator('..');
    await promoCard.locator('button').last().click();

    // Wait for edit dialog
    await expect(page.locator('text=Editar Desconto')).toBeVisible({ timeout: 5000 });

    // Update name
    await page.fill('input#nome', 'Editado E2E');
    await page.click('button:has-text("Guardar")');

    // Verify success
    await expect(page.locator('[role="status"]:has-text("atualizado")')).toBeVisible({ timeout: 5000 });
  });

  test('toggles promo code active status', async ({ page }) => {
    await page.goto('/admin/discounts');

    await expect(page.locator('h1:has-text("DESCONTOS")')).toBeVisible({ timeout: 10000 });

    // Create a promo code first
    await page.click('button:has-text("Novo Codigo Promo")');
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });

    const uniqueCode = `TGL${Date.now()}`.substring(0, 10).toUpperCase();
    await page.fill('input#code', uniqueCode);
    await page.fill('input#nome', 'Para Toggle');
    await page.fill('input#discount_value', '5');
    await page.click('button:has-text("Criar")');

    await expect(page.locator('[role="status"]:has-text("criado")')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);

    // Find and toggle switch - it's in the card, not the dialog
    const promoCard = page.locator(`text=${uniqueCode}`).locator('..').locator('..').locator('..');
    const switchBtn = promoCard.locator('button[role="switch"]');
    await switchBtn.click();

    // Verify status updated
    await expect(page.locator('[role="status"]:has-text("Status atualizado")')).toBeVisible({ timeout: 5000 });
  });

  test('prevents duplicate promo codes', async ({ page }) => {
    await page.goto('/admin/discounts');

    await expect(page.locator('h1:has-text("DESCONTOS")')).toBeVisible({ timeout: 10000 });

    // Create first promo
    await page.click('button:has-text("Novo Codigo Promo")');
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });

    const uniqueCode = `DUP${Date.now()}`.substring(0, 10).toUpperCase();
    await page.fill('input#code', uniqueCode);
    await page.fill('input#nome', 'Original');
    await page.fill('input#discount_value', '10');
    await page.click('button:has-text("Criar")');

    await expect(page.locator('[role="status"]:has-text("criado")')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);

    // Try to create duplicate
    await page.click('button:has-text("Novo Codigo Promo")');
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
    await page.fill('input#code', uniqueCode);
    await page.fill('input#nome', 'Duplicado');
    await page.fill('input#discount_value', '20');
    await page.click('button:has-text("Criar")');

    // Should show error
    await expect(page.locator('[role="status"]:has-text("Erro")')).toBeVisible({ timeout: 5000 });
  });

  test('creates fixed amount discount', async ({ page }) => {
    await page.goto('/admin/discounts');

    await expect(page.locator('h1:has-text("DESCONTOS")')).toBeVisible({ timeout: 10000 });

    await page.click('button:has-text("Novo Codigo Promo")');
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });

    const uniqueCode = `FIX${Date.now()}`.substring(0, 10).toUpperCase();
    await page.fill('input#code', uniqueCode);
    await page.fill('input#nome', 'Desconto Fixo');

    // Select fixed type using the Select component
    await page.locator('[role="dialog"]').locator('button[role="combobox"]').click();
    await page.click('div[role="option"]:has-text("Valor Fixo")');

    // Enter fixed amount
    await page.fill('input#discount_value', '500');

    await page.click('button:has-text("Criar")');

    await expect(page.locator('[role="status"]:has-text("criado")')).toBeVisible({ timeout: 5000 });
  });
});
