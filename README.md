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
curl -fsSL https://bri.egeuysal.com/install.sh | bash
```

The installer pulls the latest cross-platform CLI asset from GitHub Releases, validates checksums, auto-adds the install directory to `PATH`, and configures a daily background `self-update` job.

The app will be available at `http://localhost:3000`.

## Required Environment Variables

```bash
CONVEX_DEPLOYMENT=
NEXT_PUBLIC_CONVEX_URL=
NEXT_PUBLIC_CONVEX_SITE_URL=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## License

This project is licensed under the GNU General Public License v3.0 (GPL-3.0). See the [LICENSE](LICENSE) file for details.
