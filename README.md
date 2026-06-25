# Spatial Sales Platform

Production-grade AI spatial sales infrastructure for real estate developers.

**Two creation engines from day one:**
- 360° Realistic Photo Experience
- World Labs 3D Splat / World Generator

**Stack:** Next.js 15 · Supabase · OpenRouter · ElevenLabs · World Labs API

## Quick Start

```bash
cp .env.example .env.local   # configure secrets
pnpm install
pnpm dev
```

Apply database schema: `supabase/migrations/001_initial_schema.sql`

## Documentation

Read **[SPATIAL_SALES_PLATFORM.md](./SPATIAL_SALES_PLATFORM.md)** — the master engineering document with architecture, file map, API contracts, prompts, and LLM index.

## Routes

| Path | Description |
|------|-------------|
| `/dashboard` | Developer dashboard |
| `/dashboard/experiences/new` | Create 360° or 3D experience |
| `/view/demo` | Buyer viewer demo |
| `/admin/worldlabs` | World Labs job operations |

## Security

API keys are server-side only. Never commit `.env.local`.
