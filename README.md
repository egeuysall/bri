# Bridge

Bridge is a minimalist Next.js app for sharing Markdown instantly.

## Stack

- Next.js 16
- Bun
- Supabase (`@supabase/ssr`)

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
curl -fsSL https://bridge.egeuysal.com/install.sh | bash
```

The app will be available at `http://localhost:3000`.

## Required Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## License

This project is licensed under the GNU General Public License v3.0 (GPL-3.0). See the [LICENSE](LICENSE) file for details.
