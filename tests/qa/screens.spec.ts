import { expect, type Page, test } from '@playwright/test';

const OUT = 'docs/qa';
const TEMPLATES = ['aws-load-testing', 'rag', 'multi-agent', 'event-commerce', 'data-platform', 'edge-iot'];
const STYLES = ['porcelain', 'midnight', 'glass', 'blueprint', 'monochrome', 'orbit'];

async function settle(page: Page) {
  await expect(page.locator('.viewer3d')).toHaveAttribute('data-rendered-nodes', /[1-9]/, { timeout: 30_000 });
  // Fonts (troika SDF) and the demand-driven frame need a moment after mount.
  await page.waitForTimeout(2_500);
}

test('six templates in their recommended style', async ({ page }) => {
  for (const template of TEMPLATES) {
    await page.goto(`/?template=${template}&panels=closed`);
    await settle(page);
    await page.screenshot({ path: `${OUT}/template-${template}.png` });
  }
});

test('one template in the six styles', async ({ page }) => {
  for (const style of STYLES) {
    await page.goto(`/?template=aws-load-testing&style=${style}&panels=closed`);
    await settle(page);
    await page.screenshot({ path: `${OUT}/style-${style}.png` });
  }
});

test('editor, panels and narrow layout', async ({ page }) => {
  await page.goto('/?template=aws-load-testing');
  await settle(page);
  await page.screenshot({ path: `${OUT}/app-3d-panels.png` });
  await page.goto('/?template=event-commerce&mode=2d');
  await page.waitForTimeout(1_500);
  await page.screenshot({ path: `${OUT}/app-2d-editor.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?template=rag&panels=closed');
  await settle(page);
  await page.screenshot({ path: `${OUT}/narrow-3d.png` });
});

test('dark colour scheme chrome', async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: 'dark', viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto('http://localhost:4317/?template=multi-agent');
  await settle(page);
  // The chrome defaults to light; dark mode is an explicit, remembered choice.
  await page.getByRole('button', { name: 'Cambiar a modo oscuro' }).click();
  await page.screenshot({ path: `${OUT}/app-dark-scheme.png` });
  await context.close();
});
