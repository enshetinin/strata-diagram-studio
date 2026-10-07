import { readFile, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { expectSceneCounts, freshStart, openLeftTab } from './helpers';

function pngSize(buffer: Buffer) {
  const signature = buffer.subarray(0, 8).toString('hex');
  return { signature, width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), colorType: buffer[25] };
}

test.describe('save, reload, import and export', () => {
  test('autosave survives a reload', async ({ page }) => {
    await freshStart(page, '?template=edge-iot');
    await expectSceneCounts(page, { nodes: 17, edges: 20 });
    await openLeftTab(page, 'Biblioteca');
    await page.getByRole('button', { name: 'Añadir Caché', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: /^Guardado/ })).toBeVisible({ timeout: 10_000 });
    // Reload without URL parameters: the autosaved document must come back.
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Edge / IoT' })).toBeVisible();
    await expectSceneCounts(page, { nodes: 18, edges: 20 });
  });

  test('corrupt saved data is reported and backed up, not loaded', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('strata:document', '{"schemaVersion":1,"document":{"broken":true'));
    await page.reload();
    await expect(page.getByText(/dañado/)).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'AWS Load Testing' })).toBeVisible();
    const backups = await page.evaluate(
      () => Object.keys(localStorage).filter((key) => key.startsWith('strata:recovered:')).length,
    );
    expect(backups).toBeGreaterThan(0);
  });

  test('JSON export → import round-trip; invalid imports do not touch the document', async ({ page }, testInfo) => {
    await freshStart(page, '?template=rag');
    await page.getByRole('button', { name: 'Exportar' }).click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: /JSON del documento/ }).click(),
    ]);
    const path = testInfo.outputPath('rag.json');
    await download.saveAs(path);
    const exported = JSON.parse(await readFile(path, 'utf8'));
    expect(exported.schemaVersion).toBe(1);
    expect(exported.nodes).toHaveLength(14);

    // Re-import a renamed copy.
    exported.name = 'RAG importado';
    const renamed = testInfo.outputPath('renamed.json');
    await writeFile(renamed, JSON.stringify(exported));
    await page.locator('[data-testid="import-input"]').setInputFiles(renamed);
    await expect(page.getByRole('heading', { level: 1, name: 'RAG importado' })).toBeVisible();

    // Unknown version is rejected explicitly.
    const future = testInfo.outputPath('future.json');
    await writeFile(future, JSON.stringify({ ...exported, schemaVersion: 99 }));
    await page.locator('[data-testid="import-input"]').setInputFiles(future);
    const dialog = page.getByRole('dialog', { name: 'No se pudo importar el archivo' });
    await expect(dialog).toContainText('schemaVersion 99 no es compatible');
    await dialog.getByRole('button', { name: 'Entendido' }).click();

    // Broken references are rejected after the schema check.
    const broken = testInfo.outputPath('broken.json');
    exported.edges[0].target.nodeId = 'ghost';
    await writeFile(broken, JSON.stringify(exported));
    await page.locator('[data-testid="import-input"]').setInputFiles(broken);
    await expect(page.getByRole('dialog', { name: 'No se pudo importar el archivo' })).toContainText(
      'referencias inválidas',
    );
    await page.getByRole('button', { name: 'Entendido' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'RAG importado' })).toBeVisible();
  });

  test('SVG export contains real vector content', async ({ page }, testInfo) => {
    await freshStart(page, '?template=event-commerce');
    await page.getByRole('button', { name: 'Exportar' }).click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: /SVG de la vista 2D/ }).click(),
    ]);
    const path = testInfo.outputPath('diagram.svg');
    await download.saveAs(path);
    const svg = await readFile(path, 'utf8');
    const width = Number(/<svg[^>]*width="(\d+)"/.exec(svg)?.[1]);
    const height = Number(/<svg[^>]*height="(\d+)"/.exec(svg)?.[1]);
    expect(width).toBeGreaterThan(800);
    expect(height).toBeGreaterThan(400);
    expect(svg).toContain('Servicio de');
    expect(svg).toContain('>queue<');
    expect(svg.match(/data-node=/g)).toHaveLength(12);
    expect(svg.match(/data-edge=/g)).toHaveLength(15);
    expect(svg).toContain('@font-face');
  });

  test('PNG export composes the 3D scene with title and legend in several formats', async ({ page }, testInfo) => {
    // Three exports, one of them 4K, rendered by software WebGL (SwiftShader) in CI.
    test.setTimeout(120_000);
    await freshStart(page, '?template=aws-load-testing');
    await expectSceneCounts(page, { nodes: 16, edges: 17 });
    const cases = [
      { format: /16:9 · Full HD/, transparent: false, width: 1920, height: 1080, file: 'scene-hd.png' },
      { format: /1:1 · Cuadrado/, transparent: true, width: 1080, height: 1080, file: 'scene-square-transparent.png' },
      { format: /16:9 · 4K/, transparent: false, width: 3840, height: 2160, file: 'scene-4k.png' },
    ];
    for (const { format, transparent, width, height, file } of cases) {
      await page.getByRole('button', { name: 'Exportar' }).click();
      await page.getByRole('menuitem', { name: /Imagen PNG/ }).click();
      const dialog = page.getByRole('dialog', { name: 'Exportar imagen' });
      await dialog.getByRole('radio', { name: format }).check();
      const background = dialog.getByRole('checkbox', { name: 'Fondo transparente' });
      if (transparent) await background.check();
      else await background.uncheck();
      await expect(dialog.locator('figure')).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 60_000 }),
        dialog.getByRole('button', { name: 'Exportar PNG' }).click(),
      ]);
      await expect(dialog).toBeHidden();
      const path = testInfo.outputPath(file);
      await download.saveAs(path);
      const buffer = await readFile(path);
      const info = pngSize(buffer);
      expect(info.signature).toBe('89504e470d0a1a0a');
      expect(info.width).toBe(width);
      expect(info.height).toBe(height);
      // Decode in the browser and check it is not a blank frame.
      const stats = await page.evaluate(async (base64) => {
        const image = new Image();
        image.src = `data:image/png;base64,${base64}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d');
        if (!context) return { colors: 0, transparent: 0 };
        context.drawImage(image, 0, 0);
        const data = context.getImageData(0, 0, image.width, image.height).data;
        const colors = new Set<number>();
        let transparentPixels = 0;
        for (let index = 0; index < data.length; index += 4 * 97) {
          colors.add((data[index]! << 16) | (data[index + 1]! << 8) | data[index + 2]!);
          if (data[index + 3] === 0) transparentPixels += 1;
        }
        return { colors: colors.size, transparent: transparentPixels };
      }, buffer.toString('base64'));
      expect(stats.colors).toBeGreaterThan(40);
      if (transparent) expect(stats.transparent).toBeGreaterThan(100);
      else expect(stats.transparent).toBe(0);
    }
  });
});
