import { copyFile, readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test.setTimeout(120_000);

test('exports the rendered note as a light Geist PDF', async ({ page }, testInfo) => {
  const notePath = process.env.E2E_NOTE_PATH;
  expect(notePath, 'Set E2E_NOTE_PATH to a readable note path.').toBeTruthy();

  await page.goto(notePath!, { waitUntil: 'domcontentloaded' });
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
      'data:image/svg+xml,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#dbeafe"/><circle cx="160" cy="90" r="48" fill="#2563eb"/></svg>'
      );
    imageFrame.append(image);
    figure.append(imageFrame);
    content.append(figure);
  });
  const sourceStyles = await page.locator('[data-note-export-root]').evaluate((root) => {
    const title = root.querySelector<HTMLElement>('[data-note-export-title]');
    const image = root.querySelector<HTMLElement>('[data-e2e-image]');
    const figure = image?.closest('figure');
    return {
      titleFontSize: title ? getComputedStyle(title).fontSize : null,
      titleLineHeight: title ? getComputedStyle(title).lineHeight : null,
      imageFilter: image ? getComputedStyle(image).filter : null,
      imageFit: image ? getComputedStyle(image).objectFit : null,
      imageTransform: image ? getComputedStyle(image).transform : null,
      imageAspectRatio: figure ? getComputedStyle(figure).aspectRatio : null,
    };
  });

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'export pdf' }).click();
  const exportDocument = page.locator('.pdf-export-document');
  await expect(exportDocument).toBeAttached();
  const exportStyles = await exportDocument.evaluate((root) => {
    const code = root.querySelector<HTMLElement>('[data-e2e-code]');
    const image = root.querySelector<HTMLElement>('[data-e2e-image]');
    const figure = image?.closest('figure');
    const title = root.querySelector<HTMLElement>('[data-note-export-title]');
    const rootStyles = getComputedStyle(root);
    return {
      background: rootStyles.backgroundColor,
      fontFamily: rootStyles.fontFamily,
      opacity: rootStyles.opacity,
      hasActions: Boolean(root.querySelector('[data-note-export-actions]')),
      codeColor: code ? getComputedStyle(code).color : null,
      titleFontSize: title ? getComputedStyle(title).fontSize : null,
      titleLineHeight: title ? getComputedStyle(title).lineHeight : null,
      imageFilter: image ? getComputedStyle(image).filter : null,
      imageFit: image ? getComputedStyle(image).objectFit : null,
      imageTransform: image ? getComputedStyle(image).transform : null,
      imageAspectRatio: figure ? getComputedStyle(figure).aspectRatio : null,
    };
  });

  expect(exportStyles.background).toBe('rgb(255, 255, 255)');
  expect(exportStyles.fontFamily).toContain('Geist');
  expect(exportStyles.fontFamily).not.toContain('Geist Mono');
  expect(exportStyles.opacity).toBe('1');
  expect(exportStyles.hasActions).toBe(false);
  expect(exportStyles.codeColor).toBe('rgb(215, 58, 73)');
  expect(exportStyles.titleFontSize).toBe(sourceStyles.titleFontSize);
  expect(exportStyles.titleLineHeight).toBe(sourceStyles.titleLineHeight);
  expect(exportStyles.imageFilter).toBe(sourceStyles.imageFilter);
  expect(exportStyles.imageFit).toBe(sourceStyles.imageFit);
  expect(exportStyles.imageTransform).toBe(sourceStyles.imageTransform);
  expect(exportStyles.imageAspectRatio).toBe(sourceStyles.imageAspectRatio);

  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`${title}.pdf`);
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const pdfPath = testInfo.outputPath('note-export.pdf');
  await copyFile(downloadPath!, pdfPath);
  const pdf = await readFile(pdfPath);

  expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  expect(pdf.byteLength).toBeGreaterThan(5_000);
});
