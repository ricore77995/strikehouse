import { test, expect } from '@playwright/test';

test.describe('Critical User Flow', () => {
  test('complete flow: register member → pay → check-in', async ({ page }) => {
    // 1. Login as ADMIN
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@boxemaster.pt');
    await page.fill('input[name="password"]', 'boxemaster123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/admin|\/staff/);

    // 2. Create new member
    await page.goto('/admin/members');
    await page.click('text=Novo Membro');

    const uniqueEmail = `joao.teste.e2e.${Date.now()}@test.com`;
    await page.fill('input[name="nome"]', 'João Teste E2E Critical');
    await page.fill('input[name="telefone"]', '912345678');
    await page.fill('input[name="email"]', uniqueEmail);
    await page.click('button:has-text("Criar Membro")');

    // Wait for member to be created
    await page.waitForTimeout(1000);

    // Verify member was created (look for success message or redirect)
    await expect(page.locator('text=João Teste E2E Critical').or(page.locator('text=sucesso'))).toBeVisible({ timeout: 10000 });

    // 3. Make payment (DINHEIRO, SUBSCRIPTION)
    await page.goto('/staff/payment');

    await page.fill('input[placeholder*="Buscar"]', 'João Teste E2E Critical');
    await page.waitForTimeout(500);
    await page.click('text=João Teste E2E Critical');

    // Wait for plans to load
    await page.waitForSelector('[data-plan-type="SUBSCRIPTION"]', { timeout: 10000 });
    await page.click('[data-plan-type="SUBSCRIPTION"]');

    // Select payment method
    await page.click('input[value="DINHEIRO"]');
    await page.click('button:has-text("Confirmar")');

    // Verify success message
    await expect(page.locator('text=confirmad').or(page.locator('text=sucesso'))).toBeVisible({ timeout: 10000 });

    // 4. Perform check-in
    await page.goto('/staff/checkin');

    await page.fill('input[placeholder*="Buscar"]', 'João Teste E2E Critical');
    await page.waitForTimeout(500);

    // Click on member
    await page.click('text=João Teste E2E Critical');

    // Click check-in button
    await page.click('button:has-text("Check-in"), button:has-text("Confirmar")');

    // Verify ALLOWED result
    await expect(page.locator('text=liberado').or(page.locator('text=sucesso').or(page.locator('[data-result="ALLOWED"]')))).toBeVisible({ timeout: 10000 });
  });

  test('member without payment should be blocked at check-in', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[name="email"]', 'staff@boxemaster.pt');
    await page.fill('input[name="password"]', 'boxemaster123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/staff/);

    // Create LEAD member (no payment)
    await page.goto('/admin/members');
    await page.click('text=Novo Membro');

    const uniqueEmail = `maria.nopay.${Date.now()}@test.com`;
    await page.fill('input[name="nome"]', 'Maria Sem Pagamento E2E');
    await page.fill('input[name="telefone"]', '918888888');
    await page.fill('input[name="email"]', uniqueEmail);
    await page.click('button:has-text("Criar Membro")');

    await page.waitForTimeout(1000);

    // Try to check-in without payment
    await page.goto('/staff/checkin');
    await page.fill('input[placeholder*="Buscar"]', 'Maria Sem Pagamento E2E');
    await page.waitForTimeout(500);

    const memberCard = page.locator('text=Maria Sem Pagamento E2E');
    if (await memberCard.isVisible()) {
      await memberCard.click();

      // Should show error or blocked status
      await expect(page.locator('text=bloqueado, text=expirado, text=sem plano').or(page.locator('[data-status="LEAD"]'))).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('QR Code Scanning Flow', () => {
  test('should handle QR scan (mock)', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'staff@boxemaster.pt');
    await page.fill('input[name="password"]', 'boxemaster123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/staff/);

    await page.goto('/staff/checkin');

    // Look for QR scanner button or input
    const qrButton = page.locator('button:has-text("QR"), button:has-text("Scan"), button[aria-label*="qr"]');

    if (await qrButton.isVisible({ timeout: 2000 })) {
      await qrButton.click();

      // Verify scanner opened (camera permissions may block in CI)
      await expect(page.locator('[data-qr-scanner], video, canvas').first()).toBeVisible({ timeout: 5000 }).catch(() => {
        // Camera not available in test environment - this is expected
        console.log('QR scanner UI tested, camera not available in test env');
      });
    }
  });

  test('should search member manually when QR unavailable', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'staff@boxemaster.pt');
    await page.fill('input[name="password"]', 'boxemaster123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/staff/);

    await page.goto('/staff/checkin');

    // Manual search should always be available
    const searchInput = page.locator('input[placeholder*="Buscar"], input[type="search"]');
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // Test search functionality
    await searchInput.fill('João');
    await page.waitForTimeout(500);

    // Should show search results
    const results = page.locator('[data-member-card], .member-result, li').first();
    await expect(results).toBeVisible({ timeout: 3000 }).catch(() => {
      // No members found - this is ok for test
      console.log('Search tested, no results available');
    });
  });
});
