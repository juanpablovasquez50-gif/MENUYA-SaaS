import { test, expect } from '@playwright/test';

const publicRoutes = [
  { path: '/', label: 'inicio' },
  { path: '/login', label: 'inicio de sesión' },
  { path: '/register', label: 'registro' },
  { path: '/forgot-password', label: 'recuperación de contraseña' },
  { path: '/reset-password', label: 'restablecimiento de contraseña' },
  { path: '/track', label: 'seguimiento de pedidos' },
];

for (const route of publicRoutes) {
  test(`${route.label}: se adapta al viewport sin desbordamiento horizontal`, async ({ page }) => {
    await page.goto(route.path);
    await page.locator('body').waitFor();
    await expect.poll(async () => page.evaluate(() => document.readyState)).toBe('complete');

    const layout = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
      metaViewport: document.querySelector('meta[name="viewport"]')?.getAttribute('content') || '',
    }));

    expect(layout.metaViewport, 'Debe existir una etiqueta viewport para móviles').not.toBe('');
    expect(
      Math.max(layout.document, layout.body),
      `La página ${route.path} desborda horizontalmente: documento=${layout.document}px, viewport=${layout.viewport}px`,
    ).toBeLessThanOrEqual(layout.viewport + 1);
  });
}

for (const path of ['/login', '/register', '/forgot-password', '/reset-password']) {
  test(`${path}: los campos visibles caben en pantalla y son utilizables`, async ({ page }) => {
    await page.goto(path);
    const fields = page.locator('input:visible, button:visible, select:visible, textarea:visible');
    const count = await fields.count();
    expect(count, 'La pantalla debe mostrar controles de formulario').toBeGreaterThan(0);

    for (let index = 0; index < count; index += 1) {
      const box = await fields.nth(index).boundingBox();
      if (!box) continue;
      expect(box.x, `Control ${index} queda fuera por la izquierda`).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width, `Control ${index} queda fuera por la derecha`).toBeLessThanOrEqual(page.viewportSize().width + 1);
    }
  });
}
