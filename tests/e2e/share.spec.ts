import { expect, type Page, test } from '@playwright/test';
import { freshStart, openLeftTab } from './helpers';

const savedName = (page: Page) =>
  page.evaluate(
    () =>
      (JSON.parse(localStorage.getItem('strata:document') ?? 'null') as { document?: { name?: string } } | null)
        ?.document?.name ?? null,
  );

/** Opens the share dialog and returns the generated link. */
async function shareLink(page: Page, present = false): Promise<string> {
  await page.getByRole('button', { name: 'Compartir enlace' }).click();
  const dialog = page.getByRole('dialog', { name: 'Compartir enlace' });
  if (present) await dialog.getByRole('checkbox', { name: 'Abrir directamente en modo presentación' }).check();
  const field = dialog.getByLabel('Enlace');
  await expect(field).toHaveValue(/#s=1\./);
  const url = await field.inputValue();
  await dialog.getByRole('button', { name: 'Cerrar' }).click();
  return url;
}

test.describe('share links', () => {
  test('a link opens read-only without touching the saved diagram', async ({ page }) => {
    // The visitor has their own saved diagram.
    await freshStart(page, '?template=aws-load-testing');
    await page.locator('body').press('Control+s');
    await expect.poll(() => savedName(page)).toBe('AWS Load Testing');

    // Someone shares the RAG template.
    await page.goto('/?template=rag');
    const url = await shareLink(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'AWS Load Testing' })).toBeVisible();

    await page.goto(url);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'RAG documental' })).toBeVisible();
    const banner = page.getByRole('region', { name: 'Vista compartida' });
    await expect(banner).toBeVisible();
    await expect(page.getByRole('button', { name: /Deshacer/ })).toHaveCount(0);

    // Edits are refused and nothing is saved.
    await openLeftTab(page, 'Estructura');
    await page
      .getByRole('button', { name: /Base de datos|Índice|Almacenamiento/ })
      .first()
      .click();
    await page.locator('body').press('Delete');
    await expect(page.getByText(/Vista compartida en solo lectura/)).toBeVisible();
    await page.waitForTimeout(900);
    expect(await savedName(page)).toBe('AWS Load Testing');

    // Back to the visitor's own diagram; the fragment goes away.
    await banner.getByRole('button', { name: 'Volver a mi diagrama' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'AWS Load Testing' })).toBeVisible();
    await expect(banner).toBeHidden();
    expect(new URL(page.url()).hash).toBe('');

    // Keeping a copy asks first, then replaces the saved diagram and keeps a backup.
    await page.goto(url);
    await expect(banner).toBeVisible();
    await banner.getByRole('button', { name: 'Editar una copia' }).click();
    const dialog = page.getByRole('dialog', { name: 'Editar una copia' });
    await expect(dialog).toContainText('sustituirá a «AWS Load Testing»');
    await dialog.getByRole('button', { name: 'Reemplazar y editar' }).click();
    await expect(banner).toBeHidden();
    await expect(page.getByRole('button', { name: /Deshacer/ })).toBeVisible();
    expect(await savedName(page)).toBe('RAG documental');
    const backups = await page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.startsWith('strata:replaced:')),
    );
    expect(backups).toHaveLength(1);
  });

  test('a presentation link starts presenting; broken links are reported', async ({ page }) => {
    await freshStart(page, '?template=multi-agent');
    const url = await shareLink(page, true);
    expect(url).toContain('&p=1');
    await page.goto('/');
    await page.goto(url);
    await page.reload();
    await expect(page.getByRole('region', { name: 'Recorrido explicado' })).toContainText('Paso 1 de');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('region', { name: 'Vista compartida' })).toBeVisible();

    const broken = url.slice(0, url.indexOf('&p=1') - 40);
    await page.goto('/');
    await page.goto(broken);
    await page.reload();
    await expect(page.getByText(/No se pudo abrir el enlace compartido/)).toBeVisible();
    await expect(page.getByRole('region', { name: 'Vista compartida' })).toBeHidden();
    expect(new URL(page.url()).hash).toBe('');
  });
});
