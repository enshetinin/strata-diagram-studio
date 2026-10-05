import { expect, type Page } from '@playwright/test';

/** Number of elements the 3D scene graph actually contains (published by the viewer). */
export async function sceneCounts(page: Page) {
  const viewer = page.locator('.viewer3d');
  await expect(viewer).toBeVisible();
  return viewer.evaluate((element) => ({
    nodes: Number((element as HTMLElement).dataset.renderedNodes),
    edges: Number((element as HTMLElement).dataset.renderedEdges),
    groups: Number((element as HTMLElement).dataset.renderedGroups),
  }));
}

export async function expectSceneCounts(page: Page, expected: { nodes: number; edges: number }) {
  await expect.poll(async () => sceneCounts(page), { timeout: 20_000 }).toMatchObject(expected);
}

export async function freshStart(page: Page, query = '') {
  await page.goto(`/${query}`);
  await page.evaluate(() => localStorage.clear());
  await page.goto(`/${query}`);
}

/** Drags from one React Flow handle to another with real pointer events. */
export async function dragHandle(page: Page, from: string, to: string) {
  const source = page.locator(from);
  const target = page.locator(to);
  const a = await source.boundingBox();
  const b = await target.boundingBox();
  if (!a || !b) throw new Error('handle not visible');
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 5 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
}
