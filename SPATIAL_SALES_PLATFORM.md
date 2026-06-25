# Spatial Sales Platform — Master Engineering Document

> **Purpose:** Single source of truth for humans and LLMs. Read this before touching any file.
> **Product:** Production V1 AI spatial sales platform for real estate developers.
> **Engines:** 360° Realistic Tour (day one) + World Labs 3D Splat (day one, not optional).

---

## 0. OODA Loop Applied to This Codebase

| Phase | Action | Where in repo |
|-------|--------|---------------|
| **Observe** | Buyer sessions, lead events, World Labs job status, AI fallback rate | `buyer_sessions`, `lead_events`, `worldlabs_jobs`, `conversation_messages` |
| **Orient** | Intent scoring, RAG readiness, engine health dashboards | `intent-engine.service.ts`, `rag.service.ts`, `ExecutiveOverviewDashboard` |
| **Decide** | Publish/block AI, retry 3D job, assign hot lead, switch to 360 fallback | `admin/worldlabs`, `KnowledgeBaseManager`, `ExperienceTypeSelector` |
| **Act** | Generate world, publish experience, CRM follow-up, voice response | `spatial-generation.service.ts`, API routes, `crm.service.ts` |

Every module is designed so a new developer can **Observe → Orient → Decide → Act** without reading the entire repo.

---

## 1. Product Hierarchy (Data Model)

```
Organization → Projects → Properties → Experiences → Scenes/Worlds
                                              ↓
                                    Buyer Sessions → Leads → Intent CRM
```

**Key rule:** Property is the business entity. Experience is the visual output. One property can have both `360_realistic` and `worldlabs_splat` experiences.

---

## 2. Tech Stack & Libraries

| Layer | Technology | Version | Role |
|-------|-----------|---------|------|
| Framework | Next.js App Router | 15.x | Full-stack React, API routes, SSR |
| Language | TypeScript | 5.x | Strict typing across services |
| Styling | Tailwind CSS | 4.x | Utility-first UI |
| Components | Radix UI + shadcn patterns | — | Accessible primitives |
| UI Shell | Efferd-inspired `SpatialSalesAppShell` | — | Dashboard layout (app-shell-5 pattern) |
| Database | Supabase Postgres | 15 | Primary datastore + RLS |
| Vectors | pgvector | — | RAG embeddings (`knowledge_embeddings`) |
| Auth | Supabase Auth + `@supabase/ssr` | — | Session cookies, RLS |
| 3D Engine | World Labs Marble API | v1 | `worlds:generate`, async polling |
| LLM | OpenRouter | — | `google/gemini-2.5-flash-preview` (configurable) |
| Voice TTS | ElevenLabs | — | `text-to-speech`, streaming capable |
| Voice STT | ElevenLabs | — | `speech-to-text`, `scribe_v2` |
| Validation | Zod | 3.x | API request schemas |
| Toasts | Sonner | — | User feedback |
| Icons | Lucide React | — | Consistent iconography |
| Themes | next-themes | — | Dark/light mode |

### Install commands used

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm build        # production build
pnpm typecheck    # tsc --noEmit
```

### Efferd blocks (reference — install when extending dashboards)

```bash
pnpm dlx shadcn@latest add @efferd/app-shell-5
pnpm dlx shadcn@latest add @efferd/dashboard-1  # Executive
pnpm dlx shadcn@latest add @efferd/dashboard-2  # CRM
pnpm dlx shadcn@latest add @efferd/dashboard-3  # AI Ops
pnpm dlx shadcn@latest add @efferd/dashboard-5  # Analytics
```

---

## 3. Environment Variables

Copy `.env.example` → `.env.local`. **Never commit `.env.local`.**

| Variable | Side | Purpose |
|----------|------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client | Public anon key (RLS enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Admin client for jobs/CRM |
| `WORLD_LABS_API_KEY` | Server only | Header `WLT-Api-Key` |
| `WORLD_LABS_API_BASE` | Server | Default `https://api.worldlabs.ai` |
| `OPENROUTER_API_KEY` | Server only | Bearer token |
| `OPENROUTER_PRIMARY_MODEL` | Server | Default `google/gemini-2.5-flash-preview` |
| `ELEVENLABS_API_KEY` | Server only | Header `xi-api-key` |
| `ELEVENLABS_VOICE_ID` | Server | TTS voice |
| `NEXT_PUBLIC_APP_URL` | Both | OpenRouter referer |

Validated in `src/lib/env.ts` via Zod. Server keys accessed via `requireServerKey()`.

---

## 4. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js App Router                       │
├──────────────┬──────────────────────────────┬───────────────┤
│  Dashboard   │       Buyer Viewer           │  Admin Panel  │
│  (Efferd UI) │  Tour360 / Splat adapters    │  World Labs   │
├──────────────┴──────────────────────────────┴───────────────┤
│                      API Routes (/api/*)                     │
├─────────────────────────────────────────────────────────────┤
│  SpatialGenerationService                                    │
│    ├── Tour360Engine                                         │
│    ├── WorldLabsEngine → WorldLabsService                    │
│    └── FutureInHouseSplatEngine (throws)                     │
│  AIService → RAGService + OpenRouterService                  │
│  VoiceService → ElevenLabsService                            │
│  CRMService → IntentEngineService                            │
├─────────────────────────────────────────────────────────────┤
│  Supabase Postgres + pgvector + RLS                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Complete File Map (LLM Index)

### 5.1 Configuration

| File | Purpose |
|------|---------|
| `package.json` | Dependencies, scripts |
| `tsconfig.json` | Path alias `@/*` → `src/*` |
| `next.config.ts` | Image domains, server action body limit |
| `postcss.config.mjs` | Tailwind v4 postcss |
| `eslint.config.mjs` | Next.js ESLint |
| `.env.example` | Template for all secrets |
| `supabase/config.toml` | Local Supabase CLI config |
| `supabase/migrations/001_initial_schema.sql` | **Full production schema + RLS** |

### 5.2 Types (`src/types/`)

| File | Exports | Use when |
|------|---------|----------|
| `domain.ts` | `ExperienceType`, `WorldLabsJobStatus`, `KnowledgeCategory`, `AIResponse`, `IntentSignal` | Any business logic typing |

### 5.3 Lib (`src/lib/`)

| File | Lines | Purpose |
|------|-------|---------|
| `utils.ts` | `cn()`, `formatCurrency()`, `formatRelativeTime()` | UI class merging, display helpers |
| `env.ts` | Zod schemas for client + server env | **Always use** instead of raw `process.env` for typed config |
| `supabase/client.ts` | `createClient()` | Browser Supabase |
| `supabase/server.ts` | `createClient()` async | Server components, cookie session |
| `supabase/admin.ts` | `createAdminClient()` | Service role — jobs, CRM, RAG admin |

### 5.4 Services (`src/services/`) — **Core business logic**

| File | Class | Responsibility |
|------|-------|----------------|
| `world-labs.service.ts` | `WorldLabsService` | `prepare_upload`, `worlds:generate`, poll operations, extract SPZ URLs |
| `openrouter.service.ts` | `OpenRouterService` | Grounded chat, sensitive topic detection, confidence scoring |
| `elevenlabs.service.ts` | `ElevenLabsService` | TTS + STT |
| `rag.service.ts` | `RAGService` | Retrieve knowledge by org+property, readiness score |
| `spatial-generation.service.ts` | `SpatialGenerationService` | Engine abstraction; `processWorldLabsJob()` full lifecycle |
| `ai.service.ts` | `AIService` | Zero-hallucination answer pipeline |
| `intent-engine.service.ts` | `IntentEngineService` | Explainable intent scoring |
| `crm.service.ts` | `CRMService` | Lead events, timeline, intent refresh |
| `index.ts` | Re-exports | `import { aiService } from "@/services"` |

### 5.5 API Routes (`src/app/api/`)

| Route | Method | Body | Returns |
|-------|--------|------|---------|
| `/api/worldlabs/generate` | POST | `{ experienceId, propertyId, prompt?, mediaAssetIds? }` | `{ jobId, status }` — triggers async job |
| `/api/worldlabs/jobs/[jobId]` | GET | — | Job status + developer-friendly label |
| `/api/ai/chat` | POST | `{ organizationId, propertyId, query, sessionId? }` | `AIResponse` |
| `/api/ai/voice` | POST | FormData: `audio`, ids | MPEG audio + `X-AI-Answer` header |
| `/api/sessions` | POST | `{ propertyId, organizationId, utm* }` | `{ sessionId }` |
| `/api/leads` | POST | `{ organizationId, propertyId, sessionId, name?, phone? }` | Lead record |

### 5.6 Pages (`src/app/`)

| Route | Component | Audience |
|-------|-----------|----------|
| `/` | Landing | Marketing |
| `/dashboard` | `ExecutiveOverviewDashboard` | Org admin |
| `/dashboard/leads` | `BuyerIntentDashboard` | Sales manager |
| `/dashboard/knowledge` | `KnowledgeBaseManager` | Content team |
| `/dashboard/projects` | Project list | PM |
| `/dashboard/properties` | Property list | PM |
| `/dashboard/experiences/new` | `ExperienceTypeSelector` | Builder |
| `/dashboard/experiences/builder` | `Tour360Builder` or `WorldLabsBuilder` | Builder |
| `/view/[slug]` | `BuyerViewer` | Buyer (public) |
| `/admin` | Admin hub | Platform admin |
| `/admin/worldlabs` | Job operations | Platform admin |

### 5.7 Components (`src/components/`)

| Path | Component | PRD mapping |
|------|-----------|-------------|
| `shell/spatial-sales-app-shell.tsx` | `SpatialSalesAppShell` | Efferd app-shell-5 adapted |
| `dashboard/executive-overview-dashboard.tsx` | KPI home | Efferd dashboard-1 |
| `dashboard/buyer-intent-dashboard.tsx` | CRM overview | Efferd dashboard-2 |
| `crm/intent-score-explainer.tsx` | Why lead is hot | PRD §13.4 |
| `experience/experience-type-selector.tsx` | 360 vs 3D choice | PRD §6.4 |
| `experience/tour360-builder.tsx` | Panorama builder | PRD §6.5 |
| `experience/worldlabs-builder.tsx` | 3D generation wizard | PRD §6.6 |
| `experience/worldlabs-job-status.tsx` | Polls `/api/worldlabs/jobs` | PRD §5.4 |
| `buyer/buyer-viewer.tsx` | Full-screen immersive viewer | PRD §7 |
| `buyer/ai-voice-panel.tsx` | Text/voice AI panel | PRD §7.5 |
| `knowledge/knowledge-base-manager.tsx` | RAG readiness | PRD §6.9 |
| `ui/*` | shadcn primitives | Button, Card, Badge, etc. |

---

## 6. World Labs Integration (Production — Day One)

### 6.1 Flow

```
Developer uploads media → media_assets table
  → POST /api/worldlabs/generate
  → WorldLabsEngine creates worldlabs_jobs row
  → spatialGenerationService.processWorldLabsJob() [async]
      → worldLabsService.generateWorld()
      → poll /marble/v1/operations/{id} every 20s
      → extract SPZ URLs (100k, 500k, full_res)
      → upsert splat_worlds
      → status → ready_for_review
  → Frontend polls GET /api/worldlabs/jobs/{id}
  → BuyerViewer uses SplatViewerAdapter with device-appropriate SPZ
```

### 6.2 Job Status States

See `WorldLabsJobStatus` in `src/types/domain.ts`. Developer sees simplified labels via `worldLabsService.getDeveloperStatus()`.

### 6.3 Security

- **World Labs key NEVER in browser**
- All calls through `WorldLabsService` server-side only
- Header: `WLT-Api-Key: ${WORLD_LABS_API_KEY}`

### 6.4 API Endpoints (World Labs)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/marble/v1/media-assets:prepare_upload` | POST | Signed upload URL |
| `/marble/v1/worlds:generate` | POST | Start generation → returns Operation |
| `/marble/v1/operations/{id}` | GET | Poll until `done: true` |

---

## 7. AI Pipeline (Zero-Hallucination)

### 7.1 System Prompt (in `openrouter.service.ts`)

```
You are a real estate sales AI agent. Answer ONLY from the provided property context.
Never invent prices, areas, possession dates, RERA status, legal approvals, bank approvals,
loan terms, tax, offers, discounts, availability, booking amounts, or refund terms.
If context is insufficient, respond: "I do not have that exact information in the
developer-approved property data. I can connect you with the sales team to confirm it."
```

### 7.2 Pipeline Steps

```
Buyer query → RAGService.retrieve(org, property, scene, checkpoint)
  → OpenRouterService.shouldFallback()?
      yes → fixed fallback string
      no  → buildGroundedMessages() → OpenRouter chat (temp 0.15)
  → store conversation_messages + lead_events
  → optional ElevenLabs TTS
```

### 7.3 Sensitive Topics (auto-detected)

`price, pricing, cost, area, possession, rera, legal, bank, loan, tax, offer, discount, availability, booking, refund`

If sensitive + low confidence (<0.6) → **must fallback**.

---

## 8. Database Schema Summary

Migration: `supabase/migrations/001_initial_schema.sql`

| Table | Key columns |
|-------|-------------|
| `organizations` | `id`, `name`, `slug`, `branding` |
| `profiles` | `id` (auth.users), `organization_id`, `role` |
| `projects` | `organization_id`, `name`, `rera_number`, `city` |
| `properties` | `project_id`, `unit_type`, `price_min/max` |
| `experiences` | `property_id`, `type`, `status`, `primary_experience` |
| `worldlabs_jobs` | `operation_id`, `world_id`, `status`, `retry_count` |
| `splat_worlds` | `spz_100k_url`, `spz_500k_url`, `spz_full_res_url` |
| `tour_360_scenes` | `room_name`, `image_url`, `hotspots`, `ai_context` |
| `checkpoints` | `checkpoint_type`, `ai_context`, `position` |
| `knowledge_entries` | `category`, `content`, `approved` |
| `knowledge_embeddings` | `embedding vector(1536)` |
| `buyer_sessions` | `utm_*`, `device` |
| `leads` | `intent_score`, `intent_signals`, `lead_status` |
| `lead_events` | `event_type`, `payload` — **CRM timeline** |
| `analytics_events` | Heat map + analytics raw events |
| `admin_audit_logs` | Admin actions with reason |

### RLS

All org-scoped tables filter by `auth_user_org_id()`. Published experiences have public SELECT.

### Apply migration

```bash
supabase db push
# or
psql $DATABASE_URL -f supabase/migrations/001_initial_schema.sql
```

---

## 9. Intent CRM Event Types

Defined in `intent-engine.service.ts` `SIGNAL_WEIGHTS`:

| Event | Weight | Meaning |
|-------|--------|---------|
| `asked_price` | +15 | Price interest |
| `requested_callback` | +20 | Hot signal |
| `invited_family` | +15 | Family buying unit |
| `asked_rera` | +10 | Compliance check |
| `price_concern` | -5 | Objection |

**Rule:** Never show intent score without `IntentScoreExplainer` reasons.

---

## 10. RBAC Roles

`organization_admin | project_manager | sales_manager | sales_agent | marketing_manager | viewer | platform_admin`

Enforced at: UI (shell nav), API (future middleware), DB (RLS policies).

---

## 11. Prompts Used to Build This App

### 11.1 Product PRD (user-provided)

Full production PRD specifying:
- Two engines from day one (360° + World Labs)
- SpatialGenerationService abstraction
- Supabase RAG + OpenRouter + ElevenLabs
- Buyer intent CRM with explainable scoring
- Efferd dashboard UI mapping (dashboard-1 through dashboard-5, app-shell-5)
- Zero-hallucination framework for real estate sensitive data

### 11.2 UI Component Guide (user-provided)

Maps Efferd free blocks to product screens:
- dashboard-1 → ExecutiveOverviewDashboard
- dashboard-2 → BuyerIntentDashboard
- dashboard-3 → AIAgentOperationsDashboard (stub ready)
- dashboard-5 → BuyerExperienceAnalyticsDashboard (stub ready)
- app-shell-5 → SpatialSalesAppShell

### 11.3 Implementation directive

> "Make production grade, modular, any developer can start immediately, World Labs integrated from day one not phase 2."

### 11.4 AI system prompts (in codebase)

| Location | Prompt role |
|----------|-------------|
| `openrouter.service.ts` `SYSTEM_PROMPT` | Grounded sales agent, no invention |
| `openrouter.service.ts` `buildGroundedMessages()` | Injects RAG context + scene |
| Fallback string | Fixed response when RAG insufficient |

---

## 12. How to Extend (New Developer Onboarding)

### Add a new experience engine

1. Create class implementing `SpatialEngine` in `spatial-generation.service.ts`
2. Register in `SpatialGenerationService.engines`
3. Add type to `ExperienceType` in `domain.ts`
4. Add option in `ExperienceTypeSelector`
5. Create viewer adapter in `buyer-viewer.tsx`

### Add a new knowledge category

1. Add to `KnowledgeCategory` in `domain.ts`
2. Add to `CATEGORIES` in `knowledge-base-manager.tsx`
3. Add to `critical` array in `rag.service.ts` `getReadinessScore()`

### Add a new CRM event

1. Add weight in `intent-engine.service.ts` `SIGNAL_WEIGHTS`
2. Call `crmService.recordEvent()` from the triggering action

### Add a new API route

1. Create `src/app/api/{name}/route.ts`
2. Validate with Zod
3. Use service layer — **never call external APIs directly from route**
4. Document in this file §5.5

---

## 13. Production Checklist

- [ ] Supabase project created — apply `001_initial_schema.sql` + `002_v1_live_features.sql`
- [ ] `.env.local` configured (keys server-side only)
- [x] Auth + middleware (`/login`, `/signup`, RBAC)
- [x] Full CRUD APIs (projects, properties, experiences, scenes, floor maps, checkpoints, knowledge)
- [x] Media upload via Supabase Storage + World Labs prepare_upload
- [x] Publish flow + public buyer viewer (`/api/experiences/public/[slug]`)
- [x] Panorama viewer (`@photo-sphere-viewer/core`) + Splat viewer (`@mkkellogg/gaussian-splats-3d`)
- [x] pgvector RAG via `match_knowledge` + `EmbeddingService`
- [x] AI test console, voice pipeline, CRM timeline, analytics, campaigns
- [x] Admin live World Labs jobs, engine control, model settings
- [x] Rate limiting on `/api/ai/chat`
- [ ] BullMQ/Redis job queue (in-process async today)
- [ ] WebRTC family sessions (V1.5 — LiveKit)
- [ ] Sentry + OpenTelemetry

---

## 14. Key Code References

### Engine abstraction

```typescript
// src/services/spatial-generation.service.ts
SpatialGenerationService
  ├── Tour360Engine        // type: "360_realistic"
  ├── WorldLabsEngine      // type: "worldlabs_splat" — PRODUCTION
  └── FutureInHouseEngine  // type: "future_inhouse_splat" — throws
```

### World Labs poll loop

```typescript
// src/services/world-labs.service.ts
async pollUntilDone(operationId, { intervalMs: 20000, maxAttempts: 30 })
```

### Zero-hallucination gate

```typescript
// src/services/ai.service.ts
if (openRouterService.shouldFallback(contexts, query)) {
  return { answer: FALLBACK, fallbackUsed: true, ... };
}
```

---

## 15. Security Warnings

1. **Rotate API keys** if they were shared in chat/logs
2. Never expose `WORLD_LABS_API_KEY`, `OPENROUTER_API_KEY`, `ELEVENLABS_API_KEY`, or `SUPABASE_SERVICE_ROLE_KEY` to client
3. `.env.local` is gitignored — use Vercel/host secrets in production
4. WebRTC: do not record raw audio/video by default (PRD §12)

---

## 16. Quick Start

```bash
git clone <repo>
cd spatial-sales-platform
cp .env.example .env.local   # fill values
pnpm install
# Apply supabase/migrations/001_initial_schema.sql to your Supabase project
pnpm dev
```

| URL | What |
|-----|------|
| http://localhost:3000 | Landing |
| http://localhost:3000/dashboard | Developer dashboard |
| http://localhost:3000/view/demo | Buyer demo viewer |
| http://localhost:3000/admin/worldlabs | World Labs ops |

---

*This document is the canonical reference. Update it when adding modules. LLMs: search this file first — file paths, service names, and API contracts are indexed here to minimize hallucination.*
