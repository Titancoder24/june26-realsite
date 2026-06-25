# Supabase MCP Connection Guide

Connect Cursor to your Supabase project so the agent can run migrations, query tables, and apply schema changes via MCP.

## Option A — OAuth (easiest in Cursor Desktop)

1. Open **Cursor Desktop** (not cloud agent).
2. Go to **Settings → Cursor Settings → Tools & MCP**.
3. Find **Supabase** and click **Sign in** / **Connect**.
4. Complete the browser OAuth flow and pick your organization + project.
5. Restart Cursor, then ask the agent: *"List tables using Supabase MCP"*.

OAuth does not require a personal access token.

## Option B — Personal Access Token (works in CI / cloud agents)

1. Create a token: [Supabase Access Tokens](https://supabase.com/dashboard/account/tokens)
   - Name it e.g. `cursor-mcp-dev`
   - Scopes: full access (MCP needs database + project tools)

2. Copy your **Project ref** (Project ID):
   - Supabase Dashboard → **Project Settings → General → Project ID**

3. Add to `.env.local` (gitignored):

```bash
SUPABASE_PROJECT_REF=abcdefghijklmnop
SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxxxxxxxx
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

4. Export env vars so Cursor sees them (add to `~/.bashrc` or `~/.zshrc`):

```bash
export SUPABASE_PROJECT_REF=your-project-ref
export SUPABASE_ACCESS_TOKEN=sbp_your_token
```

5. Restart Cursor. Workspace config is in `.cursor/mcp.json`.

## Verify connection

Ask the agent:

```
Use Supabase MCP to list_tables and list_migrations
```

Or hit the app health endpoint after setting app keys:

```
GET /api/health/db
```

Expected: `{ "connected": true, ... }`

## Apply migrations via MCP

Once connected, ask:

```
Apply supabase/migrations/001_initial_schema.sql, 002_v1_live_features.sql, and 003_v1_5_features.sql using Supabase MCP execute_sql or apply_migration
```

## Security

- Use a **development** project, not production.
- Prefer `read_only=true` in the MCP URL if you only need queries:
  `https://mcp.supabase.com/mcp?project_ref=REF&read_only=true`
- Never commit `SUPABASE_ACCESS_TOKEN` or service role keys.
