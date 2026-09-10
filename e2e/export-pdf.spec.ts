import { copyFile, readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test.setTimeout(120_000);

test('exports the rendered note as a themed, selectable PDF', async ({ page }, testInfo) => {
  const notePath = process.env.E2E_NOTE_PATH;
  expect(notePath, 'Set E2E_NOTE_PATH to a readable note path.').toBeTruthy();

  await page.goto(notePath!, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);

  const title = (await page.locator('[data-note-export-title]').textContent())?.trim();
  expect(title).toBeTruthy();
  await page.locator('[data-note-export-content] .prose').evaluate((content) => {
    content.insertAdjacentHTML(
      'beforeend',
      '<pre class="shiki" style="--shiki-light:#24292e;--shiki-dark:#fff;--shiki-light-bg:#fff;--shiki-dark-bg:#101010"><code><span data-e2e-code style="--shiki-light:#d73a49;--shiki-dark:#a0a0a0">const exported = true</span></code></pre>'
    );
    const figure = document.createElement('figure');
    const imageFrame = document.createElement('div');
    const image = document.createElement('img');
    figure.className =
      'not-prose my-6 aspect-video overflow-hidden rounded-md border border-neutral-800 p-6 md:p-8 bg-neutral-900';
    imageFrame.className = 'relative h-full w-full';
    image.dataset.e2eImage = 'true';
    image.alt = 'Export test';
    image.className =
      'block h-full w-full max-w-none origin-top-left scale-150 rounded-md object-cover object-top-left grayscale';
    image.src =
      'data:image/png;base64,' +
      'iVBORw0KGgoAAAANSUhEUgAAAUAAAAEsCAYAAABi6S7EAAAACXBIWXMAAAsSAAALEgHS3X78AAAAHUlEQVR4nO3BAQ0AAADCoPdPbQ43oAAAAAAAAAAAAAAD4G4GAAAGZC3sAAAAASUVORK5CYII=';
    imageFrame.append(image);
    figure.append(imageFrame);
    content.append(figure);
  });
  await expect(page.locator('[data-e2e-code]')).toHaveCount(1);
  await expect(page.locator('[data-e2e-image]')).toHaveCount(1);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'export pdf' }).click();
  const download = await downloadPromise;
  await expect(page.getByRole('button', { name: 'export pdf' })).toBeEnabled();
  await expect(page.locator('[data-note-export-actions]')).toHaveCount(1);

  expect(download.suggestedFilename()).toBe(`${title}.pdf`);
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const pdfPath = testInfo.outputPath('note-export.pdf');
  await copyFile(downloadPath!, pdfPath);
  const pdf = await readFile(pdfPath);

  expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  expect(pdf.byteLength).toBeGreaterThan(5_000);
});
