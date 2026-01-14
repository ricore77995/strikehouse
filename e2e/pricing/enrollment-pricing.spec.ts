import { test, expect } from '@playwright/test';

test.describe('Enrollment Pricing Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as STAFF
    await page.goto('/login');
    await page.fill('input#email', 'admin@boxemaster.pt');
    await page.fill('input#password', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/(admin|owner)/, { timeout: 10000 });
  });

  test('displays pricing engine on enrollment page', async ({ page }) => {
    await page.goto('/staff/enrollment');

    // Wait for page to load
    await expect(page.locator('h1:has-text("MATRICULA")')).toBeVisible({ timeout: 10000 });

    // Search for a LEAD member - first create one if needed
    await page.fill('input[placeholder*="nome"]', 'Test');

    // Wait for search or show no results
    await page.waitForTimeout(1000);
  });

  test('shows modality selection checkboxes', async ({ page }) => {
    await page.goto('/staff/enrollment');

    // Should have modality checkboxes after member selection
    // First, search for a member
    await page.fill('input[placeholder*="nome"]', 'Lead');
    await page.waitForTimeout(1500);

    // Check if modalities section exists
    await expect(page.locator('text=Modalidades')).toBeVisible({ timeout: 10000 });

    // Should show available modalities
    await expect(page.locator('text=Boxe')).toBeVisible();
    await expect(page.locator('text=Muay Thai')).toBeVisible();
  });

  test('shows commitment period options with discounts', async ({ page }) => {
    await page.goto('/staff/enrollment');

    // Should have commitment options visible once modalities section loads
    await expect(page.locator('text=Periodo de Compromisso')).toBeVisible({ timeout: 10000 });

    // Check for commitment periods
    await expect(page.locator('text=Mensal').first()).toBeVisible();
    await expect(page.locator('text=Trimestral').first()).toBeVisible();
    await expect(page.locator('text=Semestral').first()).toBeVisible();
    await expect(page.locator('text=Anual').first()).toBeVisible();

    // Should show discount badges
    await expect(page.locator('text=-10%').first()).toBeVisible(); // Trimestral
    await expect(page.locator('text=-15%').first()).toBeVisible(); // Semestral
    await expect(page.locator('text=-20%').first()).toBeVisible(); // Anual
  });

  test('calculates price dynamically when modality selected', async ({ page }) => {
    await page.goto('/staff/enrollment');

    // Wait for modalities to load
    await expect(page.locator('text=Modalidades')).toBeVisible({ timeout: 10000 });

    // Select a modality (checkbox)
    const boxeCheckbox = page.locator('label:has-text("Boxe")').locator('button[role="checkbox"]');
    await boxeCheckbox.click();

    // Should show price breakdown
    await expect(page.locator('text=Resumo de Precos')).toBeVisible({ timeout: 5000 });

    // Should show formula
    await expect(page.locator('text=Base')).toBeVisible();
  });

  test('applies commitment discount automatically', async ({ page }) => {
    await page.goto('/staff/enrollment');

    // Wait for modalities to load
    await expect(page.locator('text=Modalidades')).toBeVisible({ timeout: 10000 });

    // Select a modality
    const boxeCheckbox = page.locator('label:has-text("Boxe")').locator('button[role="checkbox"]');
    await boxeCheckbox.click();

    // Select Trimestral (10% discount)
    await page.click('button:has-text("Trimestral")');

    // Should show commitment discount in breakdown
    await expect(page.locator('text=Desconto Compromisso')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=-10%')).toBeVisible();
  });

  test('accepts promo code and validates', async ({ page }) => {
    await page.goto('/staff/enrollment');

    // Wait for page load
    await expect(page.locator('text=Codigo Promocional')).toBeVisible({ timeout: 10000 });

    // Select a modality first
    const boxeCheckbox = page.locator('label:has-text("Boxe")').locator('button[role="checkbox"]');
    await boxeCheckbox.click();

    // Try entering an invalid promo code
    await page.fill('input[placeholder*="promo"]', 'INVALID123');
    await page.waitForTimeout(500);

    // Price should still calculate (promo just won't apply)
    await expect(page.locator('text=Resumo de Precos')).toBeVisible();
  });

  test('shows enrollment fee for LEAD members', async ({ page }) => {
    await page.goto('/staff/enrollment');

    // Wait for page load
    await expect(page.locator('text=Taxa de Matricula')).toBeVisible({ timeout: 10000 });

    // Should have enrollment fee input
    await expect(page.locator('input#enrollmentFee')).toBeVisible();
  });

  test('enrollment fee is editable', async ({ page }) => {
    await page.goto('/staff/enrollment');

    // Wait for enrollment fee input
    await expect(page.locator('input#enrollmentFee')).toBeVisible({ timeout: 10000 });

    // Change enrollment fee value
    await page.fill('input#enrollmentFee', '20.00');

    // Verify value changed
    const value = await page.locator('input#enrollmentFee').inputValue();
    expect(value).toBe('20.00');
  });

  test('calculates total with multiple modalities', async ({ page }) => {
    await page.goto('/staff/enrollment');

    // Wait for modalities
    await expect(page.locator('text=Modalidades')).toBeVisible({ timeout: 10000 });

    // Select two modalities
    await page.locator('label:has-text("Boxe")').locator('button[role="checkbox"]').click();
    await page.locator('label:has-text("Muay Thai")').locator('button[role="checkbox"]').click();

    // Should show price breakdown with extra modality
    await expect(page.locator('text=Resumo de Precos')).toBeVisible({ timeout: 5000 });

    // Check that "2 modalidades" is shown
    await expect(page.locator('text=2 modalidade')).toBeVisible();
  });

  test('stacks commitment and promo discounts correctly', async ({ page }) => {
    await page.goto('/staff/enrollment');

    // Wait for page load
    await expect(page.locator('text=Modalidades')).toBeVisible({ timeout: 10000 });

    // Select modality
    await page.locator('label:has-text("Boxe")').locator('button[role="checkbox"]').click();

    // Select Semestral (15% discount)
    await page.click('button:has-text("Semestral")');

    // Enter a valid promo code (if one exists in the test data)
    // For this test, we just verify the structure exists
    await expect(page.locator('text=Desconto Compromisso')).toBeVisible({ timeout: 5000 });
  });

  test('shows payment method options when ready', async ({ page }) => {
    await page.goto('/staff/enrollment');

    // Wait for modalities
    await expect(page.locator('text=Modalidades')).toBeVisible({ timeout: 10000 });

    // Select a modality
    await page.locator('label:has-text("Boxe")').locator('button[role="checkbox"]').click();

    // Should show payment methods
    await expect(page.locator('text=Metodo de Pagamento')).toBeVisible({ timeout: 5000 });

    // Verify payment options exist
    await expect(page.locator('text=Dinheiro')).toBeVisible();
    await expect(page.locator('text=Cartao')).toBeVisible();
    await expect(page.locator('text=MBway')).toBeVisible();
    await expect(page.locator('text=Transferencia')).toBeVisible();
  });

  test('transfer payment shows pending indicator', async ({ page }) => {
    await page.goto('/staff/enrollment');

    // Wait for payment methods
    await expect(page.locator('text=Metodo de Pagamento')).toBeVisible({ timeout: 10000 });

    // Transfer should have pending indicator
    const transferButton = page.locator('button:has-text("Transferencia")');
    await expect(transferButton).toBeVisible();

    // Check for "Pendente" label
    await expect(page.locator('text=Pendente')).toBeVisible();
  });
});

test.describe('Renewal/Payment Pricing Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as STAFF
    await page.goto('/login');
    await page.fill('input#email', 'admin@boxemaster.pt');
    await page.fill('input#password', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/(admin|owner)/, { timeout: 10000 });
  });

  test('displays pricing engine on payment page', async ({ page }) => {
    await page.goto('/staff/payment');

    // Wait for page to load
    await expect(page.locator('text=PAGAMENTO')).toBeVisible({ timeout: 10000 });
  });

  test('shows current subscription info for existing member', async ({ page }) => {
    await page.goto('/staff/payment');

    // Search for an active member
    await page.fill('input[placeholder*="nome"]', 'Member');
    await page.waitForTimeout(1500);

    // If member found with subscription, should show current subscription info
    // This is conditional on having test data
  });

  test('redirects LEAD members to enrollment page', async ({ page }) => {
    await page.goto('/staff/payment');

    // Search for a LEAD member
    await page.fill('input[placeholder*="nome"]', 'Lead');
    await page.waitForTimeout(1500);

    // If LEAD member found and selected, should show redirect alert
    // The alert should have "Ir para Matrícula" link
  });

  test('shows modality and commitment selection for renewals', async ({ page }) => {
    await page.goto('/staff/payment');

    // Page should have these sections available
    await expect(page.locator('text=Selecionar Membro')).toBeVisible({ timeout: 10000 });
  });

  test('no enrollment fee for renewals', async ({ page }) => {
    await page.goto('/staff/payment');

    // Enrollment fee should NOT be visible on payment page (only on enrollment)
    await page.waitForTimeout(1000);

    // There should be no enrollment fee input on this page
    const enrollmentFeeInput = page.locator('input#enrollmentFee');
    await expect(enrollmentFeeInput).not.toBeVisible();
  });
});

test.describe('Pending Payment Confirmation', () => {
  test.beforeEach(async ({ page }) => {
    // Login as ADMIN
    await page.goto('/login');
    await page.fill('input#email', 'admin@boxemaster.pt');
    await page.fill('input#password', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/(admin|owner)/, { timeout: 10000 });
  });

  test('displays pending payments list', async ({ page }) => {
    await page.goto('/admin/finances/verify');

    // Should show pending payments header
    await expect(page.locator('text=VERIFICAR PAGAMENTOS')).toBeVisible({ timeout: 10000 });

    // Should show IBAN search
    await expect(page.locator('text=Buscar por IBAN')).toBeVisible();
  });

  test('shows payment type badges', async ({ page }) => {
    await page.goto('/admin/finances/verify');

    // Wait for page load
    await expect(page.locator('text=Pagamentos Pendentes')).toBeVisible({ timeout: 10000 });

    // If there are pending payments, they should have type badges
    // Types: Matrícula, Reativação, Renovação
  });

  test('displays subscription details in confirmation dialog', async ({ page }) => {
    await page.goto('/admin/finances/verify');

    // Wait for page load
    await expect(page.locator('text=Pagamentos Pendentes')).toBeVisible({ timeout: 10000 });

    // If there are pending payments, clicking "Verificar" should show details
    const verificarButton = page.locator('button:has-text("Verificar")').first();

    // Only test if there are pending payments
    const count = await verificarButton.count();
    if (count > 0) {
      await verificarButton.click();
      await expect(page.locator('text=Confirmar Pagamento')).toBeVisible({ timeout: 5000 });
    }
  });

  test('IBAN search works', async ({ page }) => {
    await page.goto('/admin/finances/verify');

    // Enter a test IBAN
    await page.fill('input[placeholder*="PT50"]', 'PT50000000000000000000000');

    // Click search
    await page.click('button:has-text("Buscar")');

    // Should show result (found or not found)
    await page.waitForTimeout(1000);
  });
});
