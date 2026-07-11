import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('exports the rendered note as a light Geist PDF', async ({ page }, testInfo) => {
  const notePath = process.env.E2E_NOTE_PATH;
  expect(notePath, 'Set E2E_NOTE_PATH to a readable note path.').toBeTruthy();

  await page.addInitScript(() => {
    window.print = () => {
      document.documentElement.dataset.printInvoked = 'true';
      document.documentElement.dataset.printTitle = document.title;
    };
  });

  await page.goto(notePath!, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => document.fonts.ready);

  await page.getByRole('button', { name: 'Export PDF' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-print-invoked', 'true');

  await page.emulateMedia({ media: 'print' });
  const printStyles = await page.locator('[data-note-print-root]').evaluate((root) => {
    const actions = root.querySelector<HTMLElement>('[data-note-export-actions]');
    const rootStyles = getComputedStyle(root);
    return {
      background: rootStyles.backgroundColor,
      fontFamily: rootStyles.fontFamily,
      opacity: rootStyles.opacity,
      actionsDisplay: actions ? getComputedStyle(actions).display : null,
    };
  });

  expect(printStyles.background).toBe('rgb(255, 255, 255)');
  expect(printStyles.fontFamily).toContain('Geist');
  expect(printStyles.fontFamily).not.toContain('Geist Mono');
  expect(printStyles.opacity).toBe('1');
  expect(printStyles.actionsDisplay).toBe('none');

  const pdfPath = testInfo.outputPath('note-export.pdf');
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    preferCSSPageSize: true,
    printBackground: true,
  });
  const pdf = await readFile(pdfPath);

  expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  expect(pdf.byteLength).toBeGreaterThan(5_000);
});
