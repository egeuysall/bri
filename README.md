# bri

bri is a minimalist Next.js app for sharing Markdown instantly.

## Stack

- Next.js 16
- Bun
- Convex

## Local Development

1. Copy the required variables into `.env.local`.
2. Install dependencies:

```bash
bun i
```

3. Start the app:

```bash
bun dev
```

## CLI

```bash
curl -fsSL https://bri.fyi/install.sh | bash
```

The installer resolves the latest release tag, installs Bun if needed, downloads the source bundle, installs dependencies, auto-adds the install directory to `PATH`, and configures a daily background reinstall job.

The app will be available at `http://localhost:3000`.

## Required Environment Variables

```bash
CONVEX_DEPLOYMENT=
NEXT_PUBLIC_CONVEX_URL=
NEXT_PUBLIC_CONVEX_SITE_URL=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
AI_GATEWAY_API_KEY=vck_...
AI_GATEWAY_MODEL=openai/gpt-oss-20b
```

`AI_GATEWAY_API_KEY` is server-only. Do not expose it with a `NEXT_PUBLIC_` prefix.

## License

This project is licensed under the GNU General Public License v3.0 (GPL-3.0). See the [LICENSE](LICENSE) file for details.
