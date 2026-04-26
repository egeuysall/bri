import { Command } from 'commander';
import { closeFlagsClient, initFlagsClient, resolveCliFlags } from '../flags';
import { loadConfig } from '../config';
import { publishMarkdown } from '../core/http';
import {
  DEFAULT_API_ENDPOINT,
  DEFAULT_MAX_BYTES,
  DEFAULT_RETRIES,
  DEFAULT_SITE_URL,
  DEFAULT_TIMEOUT_MS,
  type PublishOptions,
  copyToClipboard,
  createPrinter,
  getBooleanSetting,
  getNumberSetting,
  getStringSetting,
  openInBrowser,
  parseOptionalPositiveInt,
  parseTitleFromMarkdown,
  parseVisibility,
  readMarkdownFile,
  readMarkdownStdin,
  renderPublishOutput,
  validateUrl,
} from '../core/shared';

export async function runPublish(options: PublishOptions, command: Command): Promise<void> {
  const config = await loadConfig();

  const flagsClient = await initFlagsClient();
  const flagValues = await resolveCliFlags(flagsClient, {
    autoOpen: true,
    autoCopy: true,
    useColor: true,
    retries: DEFAULT_RETRIES,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  });

  const endpointRaw = getStringSetting(
    command,
    'endpoint',
    options.endpoint,
    process.env.BRI_ENDPOINT,
    config.endpoint,
    DEFAULT_API_ENDPOINT
  );

  const siteUrlRaw = getStringSetting(
    command,
    'siteUrl',
    options.siteUrl,
    process.env.BRI_SITE_URL,
    config.siteUrl,
    DEFAULT_SITE_URL
  );

  const apiKey = getStringSetting(
    command,
    'apiKey',
    options.apiKey,
    process.env.BRI_API_KEY ?? process.env.BRI_TOKEN,
    config.apiKey,
    ''
  ).trim();

  const timeoutMs = getNumberSetting(
    command,
    'timeout',
    options.timeout,
    process.env.BRI_TIMEOUT_MS,
    config.timeoutMs,
    flagValues.timeoutMs,
    DEFAULT_TIMEOUT_MS
  );

  const maxBytes = getNumberSetting(
    command,
    'maxBytes',
    options.maxBytes,
    process.env.BRI_MAX_BYTES,
    config.maxBytes,
    DEFAULT_MAX_BYTES,
    DEFAULT_MAX_BYTES
  );

  const retries = getNumberSetting(
    command,
    'retries',
    options.retries,
    process.env.BRI_RETRIES,
    config.retries,
    flagValues.retries,
    DEFAULT_RETRIES
  );

  const copy = getBooleanSetting(
    command,
    'copy',
    options.copy,
    process.env.BRI_COPY,
    config.copy,
    flagValues.autoCopy,
    true
  );

  const open = getBooleanSetting(
    command,
    'open',
    options.open,
    process.env.BRI_OPEN,
    config.open,
    flagValues.autoOpen,
    true
  );

  const color = getBooleanSetting(
    command,
    'color',
    options.color,
    process.env.BRI_COLOR,
    config.color,
    flagValues.useColor,
    process.stdout.isTTY
  );

  const printer = createPrinter(color, Boolean(options.quiet) || Boolean(options.json));

  try {
    if (!apiKey) {
      throw new Error('missing api key. run `bri login --api-key <key>`');
    }

    const endpoint = validateUrl(endpointRaw, 'endpoint');
    const siteUrl = validateUrl(siteUrlRaw, 'site-url');

    let content = '';
    let sourcePath = options.path;

    if (options.stdin) {
      content = await readMarkdownStdin(maxBytes);
      sourcePath = sourcePath ?? 'stdin.md';
    } else if (options.path) {
      const loaded = await readMarkdownFile(options.path, maxBytes);
      content = loaded.content;
      sourcePath = loaded.absolutePath;
    } else {
      throw new Error('missing input. use --path <file> or --stdin');
    }

    const title = options.title?.trim() || parseTitleFromMarkdown(content);
    if (!title) {
      throw new Error('missing title. pass --title or include markdown H1');
    }
    const visibility = parseVisibility(options.visibility);
    const expireDays = parseOptionalPositiveInt(options.expireDays);
    const expiresInDays = expireDays ? Math.min(30, expireDays) : 30;

    if (options.dryRun) {
      const usernameHint =
        (config.username?.trim() || process.env.BRI_USERNAME?.trim() || '').toLowerCase();
      const dryRunPath = usernameHint ? `/${usernameHint}/<slug-from-title>` : '/<username>/<slug-from-title>';
      const dryRunUrl = new URL(dryRunPath, siteUrl).toString();

      if (options.json) {
        console.log(
          JSON.stringify(
            {
              dryRun: true,
              title,
              visibility,
              expiresInDays,
              url: dryRunUrl,
              source: sourcePath,
            },
            null,
            2
          )
        );
      } else {
        renderPublishOutput({
          enableColor: color,
          dryRun: true,
          source: sourcePath ?? 'stdin.md',
          slug: title,
          url: dryRunUrl,
        });
      }

      return;
    }

    const published = await publishMarkdown({
      endpoint,
      apiKey,
      title,
      visibility,
      expiresInDays,
      content,
      timeoutMs,
      retries,
    });

    const normalizedSlug = published.slug.replace(/^\/+/, '');
    const username = published.username.replace(/^\/+/, '');
    const postUrl = new URL(`/${username}/${normalizedSlug}`, siteUrl).toString();

    if (options.json) {
      console.log(
        JSON.stringify(
          {
            dryRun: false,
            username,
            slug: normalizedSlug,
            url: postUrl,
            elapsedMs: published.elapsedMs,
            statusCode: published.statusCode,
          },
          null,
          2
        )
      );
    } else {
      renderPublishOutput({
        enableColor: color,
        dryRun: false,
        source: sourcePath ?? 'stdin.md',
        slug: normalizedSlug,
        url: postUrl,
        elapsedMs: published.elapsedMs,
      });
    }

    if (!options.json) {
      if (copy && !copyToClipboard(postUrl)) {
        printer.warn('clipboard unavailable');
      }

      if (open && !openInBrowser(postUrl)) {
        printer.warn('browser open failed');
      }
    }
  } finally {
    await closeFlagsClient(flagsClient);
  }
}
