import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { expectSceneCounts, freshStart } from './helpers';

/** WCAG 2.2 level A and AA rules (axe includes the 2.0 and 2.1 sets under their own tags). */
const WCAG_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'];
const STYLES = ['porcelain', 'editorial', 'midnight', 'blueprint'] as const;
const SCHEMES = ['light', 'dark'] as const;

async function violations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  return results.violations.map((violation) => ({
    rule: violation.id,
    impact: violation.impact,
    targets: violation.nodes.slice(0, 5).map((node) => `${node.target.join(' ')} — ${node.failureSummary ?? ''}`),
  }));
}

for (const scheme of SCHEMES) {
  for (const style of STYLES) {
    test(`WCAG 2.2 AA · ${style} · app ${scheme} · 3D and 2D`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await freshStart(page, `?template=aws-load-testing&style=${style}`);
      await expectSceneCounts(page, { nodes: 16, edges: 17 });
      expect(await violations(page)).toEqual([]);

      await page.getByRole('button', { name: 'Editar en 2D' }).click();
      await expect(page.locator('.editor2d .react-flow__node').first()).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });
  }
}

test('connects two components and moves the camera without dragging (WCAG 2.5.7)', async ({ page }) => {
  await freshStart(page, '?template=aws-load-testing');
  await expectSceneCounts(page, { nodes: 16, edges: 17 });
  for (const label of ['Girar a la izquierda', 'Ver más desde arriba', 'Acercar', 'Alejar']) {
    await page.getByRole('group', { name: 'Cámara' }).getByRole('button', { name: label }).click();
  }
  await page.getByRole('button', { name: 'Editar en 2D' }).click();
  await page.locator('.react-flow__node', { hasText: 'Equipo de QA' }).click();
  await page.getByLabel('Destino').selectOption({ label: 'Escenarios' });
  await page.getByLabel('Tipo de relación').selectOption({ label: 'Datos' });
  await page.getByRole('button', { name: 'Conectar', exact: true }).click();
  await expect(page.getByRole('button', { name: /Deshacer: Conectar/ })).toBeVisible();
  await expect(page.locator('.editor2d .react-flow__edge')).toHaveCount(18);
  await expect(page.getByRole('group', { name: 'Datos: Equipo de QA → Escenarios' })).toBeAttached();
});

test('flow particles can be paused (WCAG 2.2.2) and the scene has a text alternative (1.1.1)', async ({ page }) => {
  await freshStart(page, '?template=aws-load-testing');
  await expectSceneCounts(page, { nodes: 16, edges: 17 });
  const canvas = page.locator('.viewer3d canvas');
  await expect(canvas).toHaveAttribute('aria-describedby', 'scene-description');
  await expect(page.locator('#scene-description li').first()).toBeAttached();
  await page.getByRole('button', { name: 'Presentar' }).click();
  const pause = page.getByRole('button', { name: 'Pausar animación' });
  await pause.click();
  await expect(page.getByRole('button', { name: 'Reanudar animación' })).toHaveAttribute('aria-pressed', 'true');
});

test('WCAG 2.2 AA · panels, inspector and phone layout', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await freshStart(page, '?template=aws-load-testing&mode=2d');
  await page.locator('.react-flow__node', { hasText: 'Equipo de QA' }).click();
  await expect(page.getByLabel('Destino')).toBeVisible();
  expect(await violations(page)).toEqual([]);
  await page
    .locator('.react-flow__node-group', { hasText: 'Frontend y API' })
    .first()
    .click({ position: { x: 40, y: 20 } });
  expect(await violations(page)).toEqual([]);
  await page.getByRole('tab', { name: 'Apariencia' }).click();
  expect(await violations(page)).toEqual([]);
  await page.getByRole('button', { name: 'Mostrar estructura y biblioteca' }).click();
  expect(await violations(page)).toEqual([]);

  await page.setViewportSize({ width: 390, height: 844 });
  await freshStart(page, '?template=rag&panels=closed');
  await expectSceneCounts(page, { nodes: 14, edges: 16 });
  expect(await violations(page)).toEqual([]);
});
