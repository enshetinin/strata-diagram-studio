import { expect, test } from '@playwright/test';
import { dragHandle, expectSceneCounts, freshStart } from './helpers';

test.describe('2D editing reflected in 3D', () => {
  test('first launch shows a complete 3D architecture with title, legend and 2D access', async ({ page }) => {
    await freshStart(page);
    await expect(page.getByRole('heading', { level: 1, name: 'AWS Load Testing' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Leyenda' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Editar en 2D/ })).toBeVisible();
    await expectSceneCounts(page, { nodes: 16, edges: 17 });
  });

  test('add, rename and connect in 2D, then see the same graph in 3D; undo/redo', async ({ page }) => {
    await freshStart(page, '?template=aws-load-testing');
    await expectSceneCounts(page, { nodes: 16, edges: 17 });

    // Add a component from the library.
    await page.getByRole('tab', { name: 'Biblioteca' }).click();
    await page.getByRole('button', { name: 'Añadir Base de datos' }).click();
    await page.getByRole('radio', { name: 'Editar 2D' }).click();
    await expect(page.locator('.react-flow__node-strata')).toHaveCount(17);

    // Rename it through the inspector.
    const label = page.getByLabel('Etiqueta', { exact: true });
    await label.fill('Sesiones');
    await label.press('Enter');
    await expect(page.locator('.react-flow__node-strata', { hasText: 'Sesiones' })).toBeVisible();

    // Frame two neighbours and connect them by dragging ports.
    await page.getByRole('tab', { name: 'Estructura' }).click();
    await page.getByRole('button', { name: /Frontend\s+Panel de resultados/ }).click();
    await page.getByRole('button', { name: 'Enfocar en la vista' }).first().click();
    await page.waitForTimeout(600);
    await dragHandle(page, '.react-flow__node[data-id="n-dashboard"] .react-flow__handle[data-handleid="p-right"]', '.react-flow__node[data-id="n-auth"] .react-flow__handle[data-handleid="p-left"]');
    await expect(page.locator('.react-flow__edge')).toHaveCount(18);
    await expect(page.getByText('17 nodos · 18 relaciones · 5 grupos')).toBeVisible();

    // Same semantics in 3D.
    await page.getByRole('radio', { name: '3D' }).click();
    await expectSceneCounts(page, { nodes: 17, edges: 18 });

    // Undo the connection, then redo it.
    await page.locator('body').press('Control+z');
    await expectSceneCounts(page, { nodes: 17, edges: 17 });
    await page.locator('body').press('Control+Shift+z');
    await expectSceneCounts(page, { nodes: 17, edges: 18 });
  });

  test('copy, cut and paste nodes and groups with the keyboard', async ({ page }) => {
    await freshStart(page, '?template=aws-load-testing');
    await page.getByRole('tab', { name: 'Estructura' }).click();
    const summary = page.getByText(/\d+ nodos · \d+ relaciones · \d+ grupos/);
    await expect(summary).toContainText('16 nodos · 17 relaciones · 5 grupos');

    // A single node: copy + paste adds one, cut removes the original.
    await page.getByRole('button', { name: /Frontend\s+Panel de resultados/ }).click();
    await page.locator('body').press('Control+c');
    await page.locator('body').press('Control+v');
    await expect(summary).toContainText('17 nodos · 17 relaciones · 5 grupos');
    await page.locator('body').press('Control+x');
    await expect(summary).toContainText('16 nodos · 17 relaciones · 5 grupos');
    await page.locator('body').press('Control+v');
    await expect(summary).toContainText('17 nodos · 17 relaciones · 5 grupos');

    // A group travels with its nested groups, nodes and internal relations; one undo reverts it.
    await page.getByRole('button', { name: /Grupo\s+Región AWS/ }).click();
    await page.locator('body').press('Control+c');
    await page.getByRole('radio', { name: 'Editar 2D' }).click();
    await page.locator('body').press('Control+v');
    await expect(summary).not.toContainText('17 nodos · 17 relaciones · 5 grupos');
    const [nodes, edges, groups] = (await summary.textContent())!.match(/\d+/g)!.map(Number);
    expect(nodes).toBeGreaterThan(17);
    expect(edges).toBeGreaterThan(17);
    expect(groups).toBeGreaterThan(5);
    await page.getByRole('radio', { name: '3D' }).click();
    await expectSceneCounts(page, { nodes: nodes!, edges: edges! });
    await page.locator('body').press('Control+z');
    await expect(summary).toContainText('17 nodos · 17 relaciones · 5 grupos');
  });

  test('walkthrough editor: create, reorder, present and edit from the inspector', async ({ page }) => {
    await freshStart(page, '?template=aws-load-testing');
    await page.getByRole('tab', { name: 'Recorrido' }).click();
    const steps = page.getByRole('list', { name: 'Pasos del recorrido' }).locator(':scope > li');
    await expect(steps).toHaveCount(11);
    await expect(page.getByText(/11 pasos · 15 relaciones narradas/)).toBeVisible();

    // Opening a step selects its relation; a new step claims it and lands right after.
    await page.getByRole('button', { name: 'Paso 2: HTTPS' }).click();
    await page.getByRole('button', { name: 'Nuevo paso (1)' }).click();
    await expect(steps).toHaveCount(12);
    await expect(steps.nth(2).getByRole('button', { name: 'Paso 3: HTTPS' })).toHaveAttribute('aria-expanded', 'true');
    await expect(steps.nth(1)).toContainText('Sin relaciones');

    // Keyboard reorder, then present from that step.
    await page.getByRole('button', { name: 'Paso 3: HTTPS' }).press('Alt+ArrowUp');
    await expect(page.getByRole('button', { name: 'Paso 2: HTTPS' })).toBeFocused();
    await page.getByRole('button', { name: 'Presentar desde este paso' }).click();
    const presentation = page.getByRole('region', { name: 'Recorrido explicado' });
    await expect(presentation).toContainText('Paso 2 de 12');
    await expect(presentation.getByRole('heading', { name: 'HTTPS' })).toBeVisible();
    await page.keyboard.press('Escape');

    // The open step's relation is still selected: the inspector takes it out of the walkthrough.
    await page.getByRole('tab', { name: 'Inspector' }).click();
    await page.getByLabel('Paso del recorrido').selectOption({ label: 'Fuera del recorrido' });
    await page.getByRole('tab', { name: 'Recorrido' }).click();
    await expect(page.getByText(/12 pasos · 14 relaciones narradas/)).toBeVisible();
    await page.locator('body').press('Control+z');
    await expect(page.getByText(/12 pasos · 15 relaciones narradas/)).toBeVisible();
  });

  test('deleting a group keeps its children by default', async ({ page }) => {
    await freshStart(page, '?template=aws-load-testing');
    await page.getByRole('tab', { name: 'Estructura' }).click();
    await page.getByRole('button', { name: /Grupo\s+VPC/ }).click();
    await page.locator('body').press('Delete');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Borrar el grupo «VPC»');
    await dialog.getByRole('button', { name: 'Borrar solo el grupo' }).click();
    await expect(page.getByText('16 nodos · 17 relaciones · 4 grupos')).toBeVisible();
    await expectSceneCounts(page, { nodes: 16, edges: 17 });
  });

  test('changing the style keeps ids, membership and connections', async ({ page }) => {
    await freshStart(page, '?template=multi-agent');
    await expectSceneCounts(page, { nodes: 14, edges: 18 });
    await page.getByRole('tab', { name: 'Apariencia' }).click();
    await page.getByRole('radio', { name: /Blueprint Spatial/ }).click();
    await expect(page.getByText('Blueprint Spatial', { exact: true }).first()).toBeVisible();
    await expectSceneCounts(page, { nodes: 14, edges: 18 });
  });

  test('local rule-based generator previews before inserting', async ({ page }) => {
    await freshStart(page, '?template=aws-load-testing');
    await page.getByRole('tab', { name: 'Generar' }).click();
    await expect(page.getByText('Generador local basado en reglas.')).toBeVisible();
    await page.getByRole('button', { name: 'Generar vista previa' }).click();
    const dialog = page.getByRole('dialog', { name: 'Vista previa' });
    await expect(dialog).toContainText('Generador local por reglas');
    await expect(page.getByRole('heading', { level: 1, name: 'AWS Load Testing' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Insertar y reemplazar' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'RAG · variación 7' })).toBeVisible();
  });
});

test('losing the WebGL context falls back to 2D without touching the document', async ({ page }) => {
  await freshStart(page, '?template=data-platform');
  await expectSceneCounts(page, { nodes: 17, edges: 16 });
  await page.evaluate(() => {
    const canvas = document.querySelector('.viewer3d canvas') as HTMLCanvasElement;
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  });
  await expect(page.getByRole('heading', { name: 'Se perdió el contexto 3D' })).toBeVisible();
  await page.getByRole('button', { name: 'Continuar en 2D' }).click();
  await expect(page.locator('.react-flow__node-strata')).toHaveCount(17);
  await expect(page.locator('.react-flow__edge')).toHaveCount(16);
});

test('reconnecting an edge end in 2D keeps its id and updates the target', async ({ page }) => {
  await freshStart(page, '?template=aws-load-testing&mode=2d');
  await page.getByRole('tab', { name: 'Estructura' }).click();
  await page.getByRole('button', { name: /Frontend\s+Panel de resultados/ }).click();
  await page.getByRole('button', { name: 'Enfocar en la vista' }).first().click();
  await page.waitForTimeout(600);
  await dragHandle(page, '.react-flow__edge[data-id="e-n-dashboard-n-api"] .react-flow__edgeupdater-target', '.react-flow__node[data-id="n-auth"] .react-flow__handle[data-handleid="p-bottom"]');
  await expect(page.getByRole('button', { name: /Panel de resultados → Autenticación «Consulta resultados»/ })).toBeVisible();
  await expect(page.locator('.react-flow__edge[data-id="e-n-dashboard-n-api"]')).toHaveCount(1);
});

test('marquee drag on the 2D canvas selects every enclosed element and moves them together', async ({ page }) => {
  await freshStart(page, '?template=aws-load-testing&mode=2d');
  await expect(page.locator('.react-flow__node-strata')).toHaveCount(16);
  const pane = await page.locator('.react-flow__pane').boundingBox();
  if (!pane) throw new Error('pane not visible');
  // Corner to corner: groups let the drag through, so the marquee starts anywhere.
  await page.mouse.move(pane.x + 4, pane.y + 4);
  await page.mouse.down();
  await page.mouse.move(pane.x + pane.width / 2, pane.y + pane.height / 2, { steps: 5 });
  await page.mouse.move(pane.x + pane.width - 4, pane.y + pane.height - 4, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('.react-flow__node-strata.selected')).toHaveCount(16);
  await expect(page.locator('.react-flow__node-group.selected')).toHaveCount(5);

  // Clicking empty canvas clears it.
  await page.mouse.click(pane.x + 4, pane.y + pane.height - 4);
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(0);
});

test('dragging a selected edge slides its middle segment; double click restores it', async ({ page }) => {
  await freshStart(page, '?template=aws-load-testing&mode=2d');
  await page.getByRole('tab', { name: 'Estructura' }).click();
  await page.getByRole('button', { name: /Frontend\s+Panel de resultados/ }).click();
  await page.getByRole('button', { name: 'Enfocar en la vista' }).first().click();
  await page.waitForTimeout(600);
  const edge = page.locator('.react-flow__edge[data-id="e-n-dashboard-n-api"]');
  const path = edge.locator('.react-flow__edge-path');
  // Largest coordinate change against the initial route (sub-pixel noise from framing ignored).
  const numbers = (d: string | null) => (d?.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  const initial = numbers(await path.getAttribute('d'));
  const drift = async () => Math.max(...numbers(await path.getAttribute('d')).map((n, i) => Math.abs(n - (initial[i] ?? 0))));
  await edge.locator('.react-flow__edge-interaction').click({ force: true, position: await midpoint(page, '[data-id="e-n-dashboard-n-api"] .react-flow__edge-path') });
  await expect(edge).toHaveClass(/selected/);

  const grip = page.locator('.strata-edge-label.is-selected, .strata-edge-grip').first();
  const box = await grip.boundingBox();
  if (!box) throw new Error('grip not visible');
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 40, start.y + 40, { steps: 4 });
  await page.mouse.move(start.x + 80, start.y + 80, { steps: 4 });
  await page.mouse.up();
  await expect.poll(drift).toBeGreaterThan(20);
  await expect(edge).toHaveClass(/selected/);

  const moved = await page.locator('.strata-edge-label.is-selected, .strata-edge-grip').first().boundingBox();
  if (!moved) throw new Error('grip not visible');
  await page.mouse.dblclick(moved.x + moved.width / 2, moved.y + moved.height / 2);
  await expect.poll(drift).toBeLessThan(1);
});

/** Point halfway along an SVG path, relative to the edge's interaction element box. */
async function midpoint(page: import('@playwright/test').Page, selector: string) {
  const point = await page.locator(selector).evaluate((element) => {
    const svgPath = element as SVGPathElement;
    const mid = svgPath.getPointAtLength(svgPath.getTotalLength() / 2);
    const screen = new DOMPoint(mid.x, mid.y).matrixTransform(svgPath.getScreenCTM()!);
    return { x: screen.x, y: screen.y };
  });
  const box = await page.locator(selector.replace('.react-flow__edge-path', '.react-flow__edge-interaction')).boundingBox();
  if (!box) throw new Error('edge not visible');
  return { x: point.x - box.x, y: point.y - box.y };
}
