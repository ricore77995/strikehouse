import { test, expect, Page } from '@playwright/test';

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

  // Fill in test member data using exact placeholders
  await page.fill('input[placeholder="Nome completo"]', generateUniqueName());
  await page.fill('input[placeholder="912345678"]', generateUniquePhone());

  // Submit to create member and advance to Step 2
  await page.click('button:has-text("Criar e Continuar")');

  // Wait for Step 2 to load - look for the specific card title
  await expect(page.locator('text=Configurar Subscricao')).toBeVisible({ timeout: 10000 });
};

// Helper to select a modality in Step 2
const selectModality = async (page: Page, modalityName: string) => {
  // The modality cards have the name in a span, click on the card
  const modalityCard = page.locator(`div:has(span:text-is("${modalityName}"))`).first();
  await modalityCard.click();
};

test.describe('Enrollment Pricing Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as STAFF
    await page.goto('/login');
    await page.fill('input#email', 'admin@boxemaster.pt');
    await page.fill('input#password', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/(admin|owner)/, { timeout: 10000 });
  });

  test('displays enrollment page with step 1', async ({ page }) => {
    await page.goto('/staff/enrollment');

    // Wait for page to load
    await expect(page.locator('h1:has-text("MATRICULA")')).toBeVisible({ timeout: 10000 });

    // Should show Step 1 - member selection
    await expect(page.locator('text=Selecionar ou Criar Membro')).toBeVisible();

    // Should have tabs for search and create
    await expect(page.locator('button[role="tab"]:has-text("Buscar Existente")')).toBeVisible();
    await expect(page.locator('button[role="tab"]:has-text("Criar Novo")')).toBeVisible();
  });

  test('can create a new member in step 1', async ({ page }) => {
    await page.goto('/staff/enrollment');
    await expect(page.locator('h1:has-text("MATRICULA")')).toBeVisible({ timeout: 10000 });

    // Click "Criar Novo" tab
    await page.click('button[role="tab"]:has-text("Criar Novo")');

    // Should show the form fields
    await expect(page.locator('input[placeholder="Nome completo"]')).toBeVisible();
    await expect(page.locator('input[placeholder="912345678"]')).toBeVisible();
    await expect(page.locator('button:has-text("Criar e Continuar")')).toBeVisible();
  });

  test('advances to step 2 after creating member', async ({ page }) => {
    await goToStep2(page);

    // Should be on Step 2
    await expect(page.locator('text=Configurar Subscricao')).toBeVisible();
  });

  test('shows modality section in step 2', async ({ page }) => {
    await goToStep2(page);

    // Should show modalities label (use exact match to avoid header)
    await expect(page.locator('label:has-text("Modalidades")')).toBeVisible();
  });

  test('shows commitment period options', async ({ page }) => {
    await goToStep2(page);

    // Should have commitment options
    await expect(page.locator('label:has-text("Periodo de Compromisso")')).toBeVisible();

    // Check for commitment periods (use exact matches)
    await expect(page.locator('p:text-is("Mensal")')).toBeVisible();
    await expect(page.locator('p:text-is("Trimestral")')).toBeVisible();
    await expect(page.locator('p:text-is("Semestral")')).toBeVisible();
    await expect(page.locator('p:text-is("Anual")')).toBeVisible();
  });

  test('shows enrollment fee for LEAD members', async ({ page }) => {
    await goToStep2(page);

    // Should have enrollment fee section
    await expect(page.locator('label:has-text("Taxa de Matricula")')).toBeVisible();

    // Should have enrollment fee input
    await expect(page.locator('input#enrollmentFee')).toBeVisible();
  });

  test('enrollment fee is editable', async ({ page }) => {
    await goToStep2(page);

    // Wait for enrollment fee input
    const feeInput = page.locator('input#enrollmentFee');
    await expect(feeInput).toBeVisible();

    // Clear and enter new value
    await feeInput.fill('20.00');

    // Verify value changed
    await expect(feeInput).toHaveValue('20.00');
  });

  test('shows promo code input', async ({ page }) => {
    await goToStep2(page);

    // Should have promo code section
    await expect(page.locator('label:has-text("Codigo Promocional")')).toBeVisible();
    await expect(page.locator('input#promo')).toBeVisible();
  });

  test('promo code accepts uppercase input', async ({ page }) => {
    await goToStep2(page);

    // Enter a promo code
    const promoInput = page.locator('input#promo');
    await promoInput.fill('testcode');

    // Should convert to uppercase
    await expect(promoInput).toHaveValue('TESTCODE');
  });

  test('shows continue and back buttons in step 2', async ({ page }) => {
    await goToStep2(page);

    // Should show navigation buttons
    await expect(page.locator('button:has-text("Voltar")')).toBeVisible();
    await expect(page.locator('button:has-text("Continuar")')).toBeVisible();
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

  test('displays payment page', async ({ page }) => {
    await page.goto('/staff/payment');

    // Wait for page to load
    await expect(page.locator('h1:has-text("PAGAMENTO")')).toBeVisible({ timeout: 10000 });
  });

  test('shows member search on payment page', async ({ page }) => {
    await page.goto('/staff/payment');

    // Should have member search section
    await expect(page.locator('h1:has-text("PAGAMENTO")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[placeholder*="nome"]')).toBeVisible();
  });

  test('no enrollment fee input on payment page', async ({ page }) => {
    await page.goto('/staff/payment');

    // Wait for page to load
    await expect(page.locator('h1:has-text("PAGAMENTO")')).toBeVisible({ timeout: 10000 });

    // Enrollment fee input should NOT be visible on payment page
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

  test('displays pending payments page', async ({ page }) => {
    await page.goto('/admin/finances/verify');

    // Should show pending payments header
    await expect(page.locator('text=VERIFICAR PAGAMENTOS')).toBeVisible({ timeout: 10000 });
  });

  test('shows IBAN search section', async ({ page }) => {
    await page.goto('/admin/finances/verify');

    // Should show IBAN search
    await expect(page.locator('text=Buscar por IBAN')).toBeVisible({ timeout: 10000 });
  });

  test('IBAN search accepts input', async ({ page }) => {
    await page.goto('/admin/finances/verify');

    // Enter a test IBAN
    const ibanInput = page.locator('input[placeholder*="PT50"]');
    await ibanInput.fill('PT50000000000000000000000');

    // Click search
    await page.click('button:has-text("Buscar")');

    // Should process search (result depends on data)
    await page.waitForTimeout(1000);
  });
});
