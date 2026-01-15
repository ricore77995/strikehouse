import { test, expect } from '@playwright/test';

test.describe('Access Control', () => {
  test('STAFF cannot access /admin routes', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'staff@boxemaster.pt');
    await page.fill('input[name="password"]', 'boxemaster123');
    await page.click('button[type="submit"]');

    // Should redirect to staff area
    await expect(page).toHaveURL(/\/staff/);

    // Try to access admin route
    await page.goto('/admin/dashboard');

    // Should redirect back to /staff or show access denied
    await expect(page).toHaveURL(/\/staff|\/login/);

    // Or should show access denied message
    const accessDenied = page.locator('text=acesso negado, text=não autorizado, text=permissão');
    const isAccessDenied = await accessDenied.isVisible({ timeout: 2000 });

    // Either redirected OR shows access denied
    expect(isAccessDenied || page.url().includes('/staff') || page.url().includes('/login')).toBeTruthy();
  });

  test('ADMIN can access all routes', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@boxemaster.pt');
    await page.fill('input[name="password"]', 'boxemaster123');
    await page.click('button[type="submit"]');

    // Should be able to access admin routes
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await expect(page.locator('h1, h2, [data-testid="dashboard"]')).toBeVisible({ timeout: 10000 });

    // Should also be able to access staff routes
    await page.goto('/staff/checkin');
    await expect(page).toHaveURL(/\/staff\/checkin/);
    await expect(page.locator('h1, h2, input[placeholder*="Buscar"]')).toBeVisible({ timeout: 10000 });

    // Should be able to access owner routes
    await page.goto('/owner/dashboard');
    await expect(page).toHaveURL(/\/owner\/dashboard|\/admin\/dashboard/); // May redirect if not OWNER
  });

  test('Unauthenticated user redirected to login', async ({ page }) => {
    // Try to access protected route without login
    await page.goto('/admin/dashboard');

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('input[name="email"]')).toBeVisible({ timeout: 10000 });
  });

  test('Invalid credentials show error', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[name="email"]', 'invalid@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator('text=inválid, text=incorret, text=erro, [role="alert"]').first()).toBeVisible({ timeout: 5000 });

    // Should still be on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('User can logout successfully', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="email"]', 'staff@boxemaster.pt');
    await page.fill('input[name="password"]', 'boxemaster123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/staff/);

    // Find and click logout button
    const logoutButton = page.locator('button:has-text("Sair"), button:has-text("Logout"), a:has-text("Sair")');

    if (await logoutButton.isVisible({ timeout: 3000 })) {
      await logoutButton.click();

      // Should redirect to login or home page
      await expect(page).toHaveURL(/\/login|\/$/);
    } else {
      // Logout button might be in a menu
      const menuButton = page.locator('button[aria-label*="menu"], button[aria-label*="user"], [data-user-menu]');

      if (await menuButton.isVisible({ timeout: 2000 })) {
        await menuButton.click();

        const logoutInMenu = page.locator('button:has-text("Sair"), a:has-text("Sair")');
        await logoutInMenu.click();

        await expect(page).toHaveURL(/\/login|\/$/);
      }
    }
  });
});

test.describe('Role-Based Menu Visibility', () => {
  test('STAFF sees only staff menu items', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'staff@boxemaster.pt');
    await page.fill('input[name="password"]', 'boxemaster123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/staff/);

    // Staff should see these menu items
    await expect(page.locator('a:has-text("Check-in"), a[href*="checkin"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('a:has-text("Pagamento"), a[href*="payment"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('a:has-text("Caixa"), a[href*="caixa"]')).toBeVisible({ timeout: 5000 });

    // Staff should NOT see admin-only items
    const adminOnlyItems = page.locator('a:has-text("Configurações"), a[href*="settings"], a:has-text("Funcionários")');
    await expect(adminOnlyItems).toBeHidden({ timeout: 2000 });
  });

  test('ADMIN sees all menu items', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@boxemaster.pt');
    await page.fill('input[name="password"]', 'boxemaster123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/admin|\/owner/);

    // Admin should see admin menu items
    await expect(page.locator('a:has-text("Dashboard"), a[href*="dashboard"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('a:has-text("Membros"), a[href*="members"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('a:has-text("Finanças"), a[href*="finances"]')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Session Persistence', () => {
  test('session persists across page refreshes', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'staff@boxemaster.pt');
    await page.fill('input[name="password"]', 'boxemaster123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/staff/);

    // Refresh the page
    await page.reload();

    // Should still be logged in (not redirected to login)
    await expect(page).toHaveURL(/\/staff/);
    await expect(page.locator('input[name="email"]')).not.toBeVisible({ timeout: 2000 });
  });

  test('session expires after logout', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'staff@boxemaster.pt');
    await page.fill('input[name="password"]', 'boxemaster123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/staff/);

    // Logout
    const logoutButton = page.locator('button:has-text("Sair"), a:has-text("Sair")');
    if (await logoutButton.isVisible({ timeout: 2000 })) {
      await logoutButton.click();
    } else {
      const menuButton = page.locator('button[aria-label*="menu"], [data-user-menu]');
      if (await menuButton.isVisible({ timeout: 2000 })) {
        await menuButton.click();
        await page.locator('button:has-text("Sair"), a:has-text("Sair")').click();
      }
    }

    // Try to access protected route
    await page.goto('/staff/checkin');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });
});
