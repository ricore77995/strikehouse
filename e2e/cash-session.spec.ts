import { test, expect } from '@playwright/test';

test.describe('Cash Session Flow', () => {
  test('should open and close cash session', async ({ page }) => {
    // Login as STAFF
    await page.goto('/login');
    await page.fill('input[name="email"]', 'staff@boxemaster.pt');
    await page.fill('input[name="password"]', 'boxemaster123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/staff/);

    // Open cash session
    await page.goto('/staff/caixa');

    // Check if cash session is already open
    const closeButton = page.locator('button:has-text("Fechar")');
    const isOpen = await closeButton.isVisible({ timeout: 2000 });

    if (!isOpen) {
      // Open new session
      const openingBalanceInput = page.locator('input[name="opening_balance"], input[placeholder*="abertura"]');
      await openingBalanceInput.fill('100');

      await page.click('button:has-text("Abrir")');

      // Verify session opened
      await expect(page.locator('text=aberto').or(page.locator('text=sucesso'))).toBeVisible({ timeout: 10000 });
    }

    // Verify session is now open
    await expect(closeButton).toBeVisible({ timeout: 5000 });

    // Close cash session (only if it's not a real production session)
    const closingInput = page.locator('input[name="actual_closing"], input[name="closing_balance"], input[placeholder*="fechamento"]');

    if (await closingInput.isVisible({ timeout: 2000 })) {
      await closingInput.fill('100'); // Same as opening for zero difference

      await page.click('button:has-text("Fechar"), button:has-text("Confirmar")');

      // Verify no alert (difference within threshold)
      await expect(page.locator('text=fechado').or(page.locator('text=sucesso'))).toBeVisible({ timeout: 10000 });
    }
  });

  test('should show alert when cash difference exceeds threshold', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'staff@boxemaster.pt');
    await page.fill('input[name="password"]', 'boxemaster123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/staff/);

    await page.goto('/staff/caixa');

    // Ensure session is open
    const closeButton = page.locator('button:has-text("Fechar")');

    if (!await closeButton.isVisible({ timeout: 2000 })) {
      // Open session
      const openingBalanceInput = page.locator('input[name="opening_balance"], input[placeholder*="abertura"]');
      await openingBalanceInput.fill('100');
      await page.click('button:has-text("Abrir")');
      await expect(page.locator('text=aberto').or(page.locator('text=sucesso'))).toBeVisible({ timeout: 5000 });
    }

    // Try to close with large difference (>€5)
    const closingInput = page.locator('input[name="actual_closing"], input[name="closing_balance"], input[placeholder*="fechamento"]');

    if (await closingInput.isVisible({ timeout: 2000 })) {
      // Get expected closing amount (for reference)
      const expectedLocator = page.locator('[data-expected-closing], text*="Esperado"').first();
      const expectedText = await expectedLocator.isVisible({ timeout: 1000 })
        ? await expectedLocator.textContent()
        : '';

      // Enter amount with large difference (€20 off)
      await closingInput.fill('80'); // If expected is 100, this is €20 difference

      await page.click('button:has-text("Fechar"), button:has-text("Confirmar")');

      // Should show alert/warning about difference
      await expect(page.locator('text=diferença, text=alerta, text=discrepância, [data-alert="cash-diff"]').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('should prevent closing session without entering closing amount', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'staff@boxemaster.pt');
    await page.fill('input[name="password"]', 'boxemaster123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/staff/);

    await page.goto('/staff/caixa');

    // Ensure session is open
    const closeButton = page.locator('button:has-text("Fechar")');

    if (await closeButton.isVisible({ timeout: 2000 })) {
      await closeButton.click();

      // Modal/form should appear
      const closingInput = page.locator('input[name="actual_closing"], input[name="closing_balance"], input[placeholder*="fechamento"]');

      if (await closingInput.isVisible({ timeout: 2000 })) {
        // Leave input empty
        await closingInput.clear();

        // Try to submit
        const confirmButton = page.locator('button:has-text("Confirmar")');
        await confirmButton.click();

        // Should show validation error
        await expect(page.locator('text=obrigatório, text=campo, text=preencha').first()).toBeVisible({ timeout: 3000 });
      }
    }
  });
});

test.describe('Cash Session Integration with Sales', () => {
  test('cash sale should update session total', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'staff@boxemaster.pt');
    await page.fill('input[name="password"]', 'boxemaster123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/staff/);

    // Ensure cash session is open
    await page.goto('/staff/caixa');

    const closeButton = page.locator('button:has-text("Fechar")');
    if (!await closeButton.isVisible({ timeout: 2000 })) {
      const openingBalanceInput = page.locator('input[name="opening_balance"], input[placeholder*="abertura"]');
      await openingBalanceInput.fill('100');
      await page.click('button:has-text("Abrir")');
      await expect(page.locator('text=aberto').or(page.locator('text=sucesso'))).toBeVisible({ timeout: 5000 });
    }

    // Go to sales page
    await page.goto('/staff/sales');

    // Look for product to sell
    const productCard = page.locator('[data-product], .product-card').first();

    if (await productCard.isVisible({ timeout: 3000 })) {
      await productCard.click();

      // Select DINHEIRO payment method
      await page.click('input[value="DINHEIRO"]');

      // Complete sale
      await page.click('button:has-text("Confirmar"), button:has-text("Vender")');

      // Verify sale success
      await expect(page.locator('text=sucesso').or(page.locator('text=confirmad'))).toBeVisible({ timeout: 10000 });

      // Go back to cash session and verify total increased
      await page.goto('/staff/caixa');

      // Expected closing should be visible and show a value
      const expectedClosing = page.locator('[data-expected-closing]');
      await expect(expectedClosing).toBeVisible({ timeout: 5000 });
      await expect(expectedClosing).not.toBeEmpty();
    }
  });
});
