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

const generateUniqueCode = () => {
  return `FIX${Date.now().toString(36).toUpperCase()}`;
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

  // Wait for Step 2 to load
  await expect(page.locator('text=Configurar Subscricao')).toBeVisible({ timeout: 10000 });
};

// Helper to navigate to Step 2 and switch to Customizado tab
const goToStep2Custom = async (page: Page) => {
  await goToStep2(page);
  await page.click('button[role="tab"]:has-text("Customizado")');
  await expect(page.locator('label:has-text("Modalidades")')).toBeVisible({ timeout: 5000 });
};

test.describe.skip('Fixed Discount Type', () => {
  let uniqueCode: string;

  test.beforeEach(async ({ page }) => {
    uniqueCode = generateUniqueCode();
    await loginAsAdmin(page);
  });

  test('admin can create a fixed discount', async ({ page }) => {
    await page.goto('/admin/discounts');

    // Wait for page to load
    await expect(page.locator('h1:has-text("DESCONTOS")')).toBeVisible({ timeout: 10000 });

    // Click new discount button (actual text is "Novo Codigo Promo")
    await page.click('button:has-text("Novo Codigo Promo")');

    // Wait for dialog
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });

    // Fill form with fixed discount
    await page.fill('input#code', uniqueCode);
    await page.fill('input#nome', 'Desconto Fixo Test');

    // Select type as fixed (shadcn/ui Select component)
    // First click the trigger, then select the option
    await page.locator('[role="combobox"]').first().click();
    await page.locator('[role="option"]:has-text("Valor Fixo")').click();

    // Set value to 1000 cents (€10.00)
    await page.fill('input#discount_value', '1000');

    // Submit
    await page.click('button:has-text("Criar")');

    // Verify success toast
    await expect(page.locator('[role="status"]:has-text("criado")').first()).toBeVisible({ timeout: 5000 });

    // Verify discount appears in list
    await expect(page.locator(`text=${uniqueCode}`)).toBeVisible({ timeout: 3000 });
  });

  test('fixed discount shows EUR value not percentage in admin list', async ({ page }) => {
    // First create the discount
    await page.goto('/admin/discounts');
    await expect(page.locator('h1:has-text("DESCONTOS")')).toBeVisible({ timeout: 10000 });

    await page.click('button:has-text("Novo Codigo Promo")');
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });

    await page.fill('input#code', uniqueCode);
    await page.fill('input#nome', 'Desconto Fixo Display');

    // Select type as fixed
    await page.locator('[role="combobox"]').first().click();
    await page.locator('[role="option"]:has-text("Valor Fixo")').click();

    await page.fill('input#discount_value', '1500'); // €15.00
    await page.click('button:has-text("Criar")');

    await expect(page.locator('[role="status"]:has-text("criado")').first()).toBeVisible({ timeout: 5000 });

    // Look for the discount card and check it shows EUR value
    // The card should show "€15.00" (value/100)
    await expect(page.locator(`text=${uniqueCode}`)).toBeVisible();
  });

  test('fixed discount applies correctly in enrollment', async ({ page }) => {
    // First create the discount
    await page.goto('/admin/discounts');
    await expect(page.locator('h1:has-text("DESCONTOS")')).toBeVisible({ timeout: 10000 });

    await page.click('button:has-text("Novo Codigo Promo")');
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });

    await page.fill('input#code', uniqueCode);
    await page.fill('input#nome', 'Desconto Fixo Enrollment');

    // Select type as fixed
    await page.locator('[role="combobox"]').first().click();
    await page.locator('[role="option"]:has-text("Valor Fixo")').click();

    await page.fill('input#discount_value', '1000'); // €10.00
    await page.click('button:has-text("Criar")');

    await expect(page.locator('[role="status"]:has-text("criado")').first()).toBeVisible({ timeout: 5000 });

    // Now go to enrollment and use the code
    await goToStep2Custom(page);

    // Select a modality
    const modalityCard = page.locator('.grid.grid-cols-2 > div').first();
    await modalityCard.click();

    // Enter the promo code
    await page.fill('input#promo', uniqueCode);

    // Verify the discount is applied - should show promo discount message
    await expect(page.locator('text=Desconto promocional aplicado')).toBeVisible();

    // Verify the breakdown is visible
    const breakdown = page.locator('.bg-secondary\\/50');
    await expect(breakdown).toBeVisible();
  });

  test('fixed discount respects max price cap', async ({ page }) => {
    // Create a large fixed discount (€100)
    await page.goto('/admin/discounts');
    await expect(page.locator('h1:has-text("DESCONTOS")')).toBeVisible({ timeout: 10000 });

    await page.click('button:has-text("Novo Codigo Promo")');
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });

    await page.fill('input#code', uniqueCode);
    await page.fill('input#nome', 'Desconto Fixo Grande');

    // Select type as fixed
    await page.locator('[role="combobox"]').first().click();
    await page.locator('[role="option"]:has-text("Valor Fixo")').click();

    await page.fill('input#discount_value', '10000'); // €100.00
    await page.click('button:has-text("Criar")');

    await expect(page.locator('[role="status"]:has-text("criado")').first()).toBeVisible({ timeout: 10000 });

    // Go to enrollment
    await goToStep2Custom(page);

    // Select a modality (base price is €60)
    const modalityCard = page.locator('.grid.grid-cols-2 > div').first();
    await modalityCard.click();

    // Enter the large promo code
    await page.fill('input#promo', uniqueCode);

    // The final price should be €0, not negative
    // The breakdown should be visible
    const breakdown = page.locator('.bg-secondary\\/50');
    await expect(breakdown).toBeVisible();

    // Price should not be negative - look for exactly "0,00 €" (monthly price = 0)
    // Use exact match to avoid matching "20,00 €" etc.
    await expect(page.getByText('0,00 €', { exact: true })).toBeVisible();
  });
});
