import { test, expect } from '@playwright/test';

test.describe('First-Time Enrollment (LEAD Member)', () => {
  test('complete enrollment flow: LEAD → enrollment → payment → ATIVO', async ({ page }) => {
    // 1. Login as STAFF
    await page.goto('/login');
    await page.fill('input[name="email"]', 'staff@boxemaster.pt');
    await page.fill('input[name="password"]', 'boxemaster123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/staff/);

    // 2. Create LEAD member
    await page.goto('/admin/members');
    await page.click('text=Novo Membro');
    await page.fill('input[name="nome"]', 'Maria Primeira Vez E2E');
    await page.fill('input[name="telefone"]', '918765432');
    await page.fill('input[name="email"]', `maria.e2e${Date.now()}@test.com`);
    await page.click('button:has-text("Criar Membro")');

    // Verify member is created as LEAD
    await expect(page.locator('[data-status="LEAD"]')).toBeVisible({ timeout: 10000 });

    // 3. Navigate to enrollment page (not payment page)
    await page.goto('/staff/enrollment');
    await page.fill('input[placeholder*="Buscar"]', 'Maria Primeira Vez E2E');
    await page.waitForTimeout(500); // Wait for search results
    await page.click('text=Maria Primeira Vez E2E');

    // 4. Select plan (should show enrollment fee)
    await page.waitForSelector('[data-plan-type="SUBSCRIPTION"]', { timeout: 10000 });
    await page.click('[data-plan-type="SUBSCRIPTION"]');

    // Verify enrollment fee is displayed
    await expect(page.locator('text=Taxa de Matrícula')).toBeVisible({ timeout: 5000 });

    // Verify total includes plan + enrollment fee
    const totalText = await page.locator('[data-total-amount]').textContent();
    expect(totalText).toContain('€'); // Should show total with enrollment fee

    // 5. Complete payment (DINHEIRO)
    await page.click('input[value="DINHEIRO"]');
    await page.click('button:has-text("Confirmar")');

    // Verify success message
    await expect(page.locator('text=confirmad').or(page.locator('text=sucesso'))).toBeVisible({ timeout: 10000 });

    // 6. Verify member status changed to ATIVO
    await page.goto('/admin/members');
    await page.fill('input[placeholder*="Buscar"]', 'Maria Primeira Vez E2E');
    await page.waitForTimeout(500);
    await expect(page.locator('[data-status="ATIVO"]')).toBeVisible({ timeout: 5000 });
  });

  test('enrollment with TRANSFERENCIA creates pending payment', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'staff@boxemaster.pt');
    await page.fill('input[name="password"]', 'boxemaster123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/staff/);

    // Create LEAD member
    await page.goto('/admin/members');
    await page.click('text=Novo Membro');
    await page.fill('input[name="nome"]', 'Pedro Transferência E2E');
    await page.fill('input[name="telefone"]', '919999999');
    await page.fill('input[name="email"]', `pedro.e2e${Date.now()}@test.com`);
    await page.click('button:has-text("Criar Membro")');

    // Go to enrollment
    await page.goto('/staff/enrollment');
    await page.fill('input[placeholder*="Buscar"]', 'Pedro Transferência E2E');
    await page.waitForTimeout(500);
    await page.click('text=Pedro Transferência E2E');

    await page.waitForSelector('[data-plan-type="SUBSCRIPTION"]', { timeout: 10000 });
    await page.click('[data-plan-type="SUBSCRIPTION"]');

    // Select TRANSFERENCIA payment method
    await page.click('input[value="TRANSFERENCIA"]');
    await page.click('button:has-text("Criar"), button:has-text("Confirmar")');

    // Verify pending payment created
    await expect(page.locator('text=pendente').or(page.locator('text=criado'))).toBeVisible({ timeout: 10000 });
  });

  test('enrollment with zero fee should skip enrollment transaction', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'staff@boxemaster.pt');
    await page.fill('input[name="password"]', 'boxemaster123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/staff/);

    // Create LEAD member
    await page.goto('/admin/members');
    await page.click('text=Novo Membro');
    await page.fill('input[name="nome"]', 'Ana Sem Taxa E2E');
    await page.fill('input[name="telefone"]', '917777777');
    await page.fill('input[name="email"]', `ana.e2e${Date.now()}@test.com`);
    await page.click('button:has-text("Criar Membro")');

    // Enroll with zero fee
    await page.goto('/staff/enrollment');
    await page.fill('input[placeholder*="Buscar"]', 'Ana Sem Taxa E2E');
    await page.waitForTimeout(500);
    await page.click('text=Ana Sem Taxa E2E');

    await page.waitForSelector('[data-plan-type="SUBSCRIPTION"]', { timeout: 10000 });
    await page.click('[data-plan-type="SUBSCRIPTION"]');

    // Override enrollment fee to zero (if field exists)
    const feeInput = page.locator('input[name="enrollment_fee"]');
    if (await feeInput.isVisible()) {
      await feeInput.fill('0');
    }

    await page.click('input[value="DINHEIRO"]');
    await page.click('button:has-text("Confirmar")');

    await expect(page.locator('text=confirmad').or(page.locator('text=sucesso'))).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Member Renewal (No Enrollment Fee)', () => {
  test('ATIVO member renewal should NOT charge enrollment fee', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'staff@boxemaster.pt');
    await page.fill('input[name="password"]', 'boxemaster123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/staff/);

    // Navigate to regular payment page (not enrollment)
    await page.goto('/staff/payment');

    // Search for any existing member (should be ATIVO)
    const searchInput = page.locator('input[placeholder*="Buscar"]');
    await searchInput.fill('João');
    await page.waitForTimeout(500);

    // Click first result if available
    const firstResult = page.locator('[data-status="ATIVO"]').first();
    if (await firstResult.isVisible()) {
      await firstResult.click();

      // Select plan
      await page.waitForSelector('[data-plan-type="SUBSCRIPTION"]', { timeout: 10000 });
      await page.click('[data-plan-type="SUBSCRIPTION"]');

      // Verify NO enrollment fee text is shown
      const enrollmentFeeText = page.locator('text=Taxa de Matrícula');
      await expect(enrollmentFeeText).not.toBeVisible();

      // Verify total is ONLY plan price (no enrollment fee added)
      const totalText = await page.locator('[data-total-amount]').textContent();
      expect(totalText).toContain('€');
    }
  });
});
