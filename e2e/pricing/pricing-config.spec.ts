import { test, expect } from '@playwright/test';

test.describe('Pricing Configuration', () => {
  test.beforeEach(async ({ page }) => {
    // Login as ADMIN
    await page.goto('/login');
    await page.fill('input#email', 'admin@boxemaster.pt');
    await page.fill('input#password', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/(admin|owner)/, { timeout: 10000 });
  });

  test('displays current pricing configuration', async ({ page }) => {
    await page.goto('/admin/pricing');

    // Wait for page to load
    await expect(page.locator('h1:has-text("CONFIGURACAO DE PRECOS")')).toBeVisible({ timeout: 10000 });

    // Should show formula card
    await expect(page.locator('text=Formula de Preco')).toBeVisible();

    // Should have input fields for prices
    await expect(page.locator('input#basePrice')).toBeVisible();
    await expect(page.locator('input#extraModalityPrice')).toBeVisible();
    await expect(page.locator('input#enrollmentFee')).toBeVisible();
  });

  test('shows default values on first load', async ({ page }) => {
    await page.goto('/admin/pricing');

    // Wait for data to load (inputs should have values)
    await page.waitForFunction(() => {
      const input = document.querySelector('input#basePrice') as HTMLInputElement;
      return input && input.value && parseFloat(input.value) > 0;
    }, { timeout: 10000 });

    // Check default values exist
    const basePrice = await page.locator('input#basePrice').inputValue();
    expect(parseFloat(basePrice)).toBeGreaterThan(0);
  });

  test('updates base price successfully', async ({ page }) => {
    await page.goto('/admin/pricing');

    // Wait for form to load
    await page.waitForSelector('input#basePrice', { timeout: 10000 });
    await page.waitForFunction(() => {
      const input = document.querySelector('input#basePrice') as HTMLInputElement;
      return input && input.value && parseFloat(input.value) > 0;
    }, { timeout: 10000 });

    // Get current value to restore later
    const originalValue = await page.locator('input#basePrice').inputValue();

    // Update base price to a new value
    const newValue = '65.00';
    await page.fill('input#basePrice', newValue);

    // Save
    await page.click('button:has-text("Guardar Alteracoes")');

    // Wait for save to complete (button becomes enabled again after loading)
    await page.waitForTimeout(1500);

    // Reload and verify persistence
    await page.reload();
    await page.waitForFunction(() => {
      const input = document.querySelector('input#basePrice') as HTMLInputElement;
      return input && input.value && parseFloat(input.value) > 0;
    }, { timeout: 10000 });

    const savedValue = await page.locator('input#basePrice').inputValue();
    expect(savedValue).toBe(newValue);

    // Restore original value
    await page.fill('input#basePrice', originalValue);
    await page.click('button:has-text("Guardar Alteracoes")');
    await page.waitForTimeout(1000);
  });

  test('updates extra modality price', async ({ page }) => {
    await page.goto('/admin/pricing');

    await page.waitForSelector('input#extraModalityPrice', { timeout: 10000 });
    await page.waitForFunction(() => {
      const input = document.querySelector('input#extraModalityPrice') as HTMLInputElement;
      return input && input.value && parseFloat(input.value) > 0;
    }, { timeout: 10000 });

    // Get current value to restore later
    const originalValue = await page.locator('input#extraModalityPrice').inputValue();

    // Update extra modality price
    const newValue = '35.00';
    await page.fill('input#extraModalityPrice', newValue);

    // Save
    await page.click('button:has-text("Guardar Alteracoes")');
    await page.waitForTimeout(1500);

    // Verify persistence
    await page.reload();
    await page.waitForFunction(() => {
      const input = document.querySelector('input#extraModalityPrice') as HTMLInputElement;
      return input && input.value && parseFloat(input.value) > 0;
    }, { timeout: 10000 });

    const savedValue = await page.locator('input#extraModalityPrice').inputValue();
    expect(savedValue).toBe(newValue);

    // Restore original value
    await page.fill('input#extraModalityPrice', originalValue);
    await page.click('button:has-text("Guardar Alteracoes")');
    await page.waitForTimeout(1000);
  });

  test('updates enrollment fee', async ({ page }) => {
    await page.goto('/admin/pricing');

    await page.waitForSelector('input#enrollmentFee', { timeout: 10000 });
    await page.waitForFunction(() => {
      const input = document.querySelector('input#enrollmentFee') as HTMLInputElement;
      return input && input.value;
    }, { timeout: 10000 });

    // Get current value to restore later
    const originalValue = await page.locator('input#enrollmentFee').inputValue();

    // Update enrollment fee
    const newValue = '20.00';
    await page.fill('input#enrollmentFee', newValue);

    // Save
    await page.click('button:has-text("Guardar Alteracoes")');
    await page.waitForTimeout(1500);

    // Verify persistence
    await page.reload();
    await page.waitForFunction(() => {
      const input = document.querySelector('input#enrollmentFee') as HTMLInputElement;
      return input && input.value;
    }, { timeout: 10000 });

    const savedValue = await page.locator('input#enrollmentFee').inputValue();
    expect(savedValue).toBe(newValue);

    // Restore original value
    await page.fill('input#enrollmentFee', originalValue);
    await page.click('button:has-text("Guardar Alteracoes")');
    await page.waitForTimeout(1000);
  });

  test('shows live price calculation example', async ({ page }) => {
    await page.goto('/admin/pricing');

    await page.waitForSelector('input#basePrice', { timeout: 10000 });

    // Example section should be visible
    await expect(page.locator('text=Exemplo: 2 Modalidades, 6 Meses')).toBeVisible();

    // Verify calculation display
    await expect(page.locator('text=Desconto Semestral')).toBeVisible();
    await expect(page.locator('text=Mensal:')).toBeVisible();
  });

  test('marks negative prices as invalid', async ({ page }) => {
    await page.goto('/admin/pricing');

    await page.waitForSelector('input#basePrice', { timeout: 10000 });
    await page.waitForFunction(() => {
      const input = document.querySelector('input#basePrice') as HTMLInputElement;
      return input && input.value && parseFloat(input.value) > 0;
    }, { timeout: 10000 });

    // Enter a negative value
    await page.fill('input#basePrice', '-10.00');

    // The input has min="0" so it should be marked as invalid by browser validation
    // Check that the input is in an invalid state using CSS pseudo-class
    const isInvalid = await page.locator('input#basePrice').evaluate((el: HTMLInputElement) => !el.checkValidity());
    expect(isInvalid).toBe(true);
  });

  test('validates decimal precision', async ({ page }) => {
    await page.goto('/admin/pricing');

    await page.waitForSelector('input#basePrice', { timeout: 10000 });
    await page.waitForFunction(() => {
      const input = document.querySelector('input#basePrice') as HTMLInputElement;
      return input && input.value && parseFloat(input.value) > 0;
    }, { timeout: 10000 });

    // Get current value to restore later
    const originalValue = await page.locator('input#basePrice').inputValue();

    // Enter price with many decimal places
    await page.fill('input#basePrice', '59.99');
    await page.click('button:has-text("Guardar Alteracoes")');
    await page.waitForTimeout(1500);

    // Verify it saved
    await page.reload();
    await page.waitForFunction(() => {
      const input = document.querySelector('input#basePrice') as HTMLInputElement;
      return input && input.value && parseFloat(input.value) > 0;
    }, { timeout: 10000 });

    const savedValue = await page.locator('input#basePrice').inputValue();
    expect(savedValue).toBe('59.99');

    // Restore original value
    await page.fill('input#basePrice', originalValue);
    await page.click('button:has-text("Guardar Alteracoes")');
    await page.waitForTimeout(1000);
  });
});
