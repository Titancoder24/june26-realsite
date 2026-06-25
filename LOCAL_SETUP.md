# Local development setup

## Prerequisites

- Node.js 20+
- pnpm (recommended) or npm
- Supabase project (remote or local)
- Google Vertex AI key for Image Walkthrough enhancement & analysis (optional but recommended)

## Steps

1. **Clone the repo**
   ```bash
   git clone <repo-url>
   cd realsiteappv1-fork-
   ```

2. **Checkout your branch**
   ```bash
   git checkout <your-branch>
   ```

3. **Install dependencies**
   ```bash
   pnpm install
   ```

4. **Configure environment**
   ```bash
   cp .env.example .env.local
   ```
   Fill in your company credentials in `.env.local`. **Never commit `.env.local`.**

5. **Apply database migrations** (if needed)
   ```bash
   supabase db push
   ```
   Or apply SQL migrations manually in the Supabase SQL editor (including `021_image_walkthrough_enhancement.sql`).

6. **Run the dev server**
   ```bash
   pnpm dev
   ```

7. **Open the app**
   ```
   http://localhost:3000
   ```

## Test Image Walkthrough

1. Log in to the dashboard
2. Go to **Launch 360° Capture** → select a property → **Image Walkthrough**
3. **Upload** property photos
4. **Enhance** images (Vertex Gemini) or skip
5. **Analyze** → **Organize** → **Hotspots** → **Annotations**
6. **Preview** → open full-screen preview
7. Toggle **Depth View** in the viewer dock for lightweight parallax
8. **Publish** when checklist is complete

## Required env vars (minimum)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Server API / storage |
| `GOOGLE_VERTEX_API_KEY` | Image enhancement & AI analysis |
| `SARVAM_API_KEY` | Indian Languages AI — Samvaad duplex voice + STT/TTS fallback |
| `SARVAM_SAMVAAD_ORG_ID` | Samvaad org (from [agents.sarvam.ai](https://agents.sarvam.ai)) |
| `SARVAM_SAMVAAD_WORKSPACE_ID` | Samvaad workspace id |
| `SARVAM_SAMVAAD_APP_ID` | Samvaad app id (committed property-tour agent) |
| `ELEVENLABS_API_KEY` | Global Voice AI — ElevenLabs ConvAI (WebRTC) + Scribe v2 |
| `ELEVENLABS_AGENT_ID` | Optional — auto-discovers first agent if unset |
| `NEXT_PUBLIC_APP_URL` | Published walkthrough links |

See `.env.example` for the full list.

## Sarvam Samvaad voice (walkthrough buyer — preferred)

Indian Languages mode uses **Samvaad** (Sarvam conversational AI) via `sarvam-conv-ai-sdk`, aligned with [sarvam-mcp](https://github.com/sarvamai/sarvam-mcp) (`uvx sarvam-mcp` in `.cursor/mcp.json`).

1. Create a property-tour agent on [agents.sarvam.ai](https://agents.sarvam.ai) and commit a version.
2. Set `SARVAM_SAMVAAD_ORG_ID`, `SARVAM_SAMVAAD_WORKSPACE_ID`, `SARVAM_SAMVAAD_APP_ID` in `.env.local`.
3. Optional per-experience override in `experiences.viewer_config.samvaad`.

Flow:

- Buyer mic ↔ `ConversationAgent` (`sarvam-conv-ai-sdk/browser`)
- Session bootstrap → `/api/walkthrough/samvaad/session` (injects RAG knowledge from chat UI into `agent_variables`)
- Signed URL proxy → `/api/walkthrough/samvaad/runtime/orgs/.../url` (keeps `SARVAM_API_KEY` server-side)
- Live RAG tool (optional) → POST `/api/walkthrough/samvaad/rag` with `propertyId` + `query` (same `knowledge_entries` as studio chat)

If Samvaad env vars are missing, Indian profile falls back to Sarvam WebSocket STT + Vertex + TTS.

## ElevenLabs ConvAI voice (Global Voice — preferred)

Global Voice uses **ElevenLabs Conversational AI** via API + `@elevenlabs/client` WebRTC. **No dashboard setup required** — the app provisions the agent automatically.

### API endpoints (all server-side ElevenLabs REST)

| Endpoint | Purpose |
|----------|---------|
| `POST /api/walkthrough/elevenlabs/provision` | Create/update **Realsite Property Tour** agent + RAG webhook tool (auth required) |
| `GET /api/walkthrough/elevenlabs/provision` | Check provisioned `agentId` |
| `POST /api/walkthrough/elevenlabs/session` | WebRTC `conversationToken` + per-property `dynamicVariables` (RAG summary) |
| `POST /api/walkthrough/elevenlabs/rag` | RAG tool webhook (used by agent `get_property_info`) |

### Auto-provisioned agent (via API)

On first buyer voice session, if no `ELEVENLABS_AGENT_ID` is set, the server:

1. Creates webhook tool `get_property_info` → your `/elevenlabs/rag` route
2. Creates agent **Realsite Property Tour** with:
   - **ASR:** `scribe_realtime` (Scribe v2 realtime)
   - **TTS:** `eleven_v3_conversational`
   - **LLM:** ElevenLabs-hosted (`gpt-4o-mini`)
   - **Client tools:** `jump_to_scene`, `pause_tour`, `resume_tour`
   - **Dynamic variables:** `knowledge_summary`, `scenes_list`, `property_name`, etc.

### `.env.local`

```bash
ELEVENLABS_API_KEY=your_key
ELEVENLABS_STT_MODEL=scribe_v2
# Optional — skip auto-discovery if set:
ELEVENLABS_AGENT_ID=agent_xxxxx
ELEVENLABS_CONVAI_TOOL_SECRET=optional_rag_secret
```

### Manual provision (studio / curl)

While logged into the dashboard, call:

```bash
curl -X POST http://localhost:3000/api/walkthrough/elevenlabs/provision \
  -H "Cookie: ..." 
```

Or open a walkthrough preview with Global Voice — session bootstrap auto-provisions if needed.

Without `ELEVENLABS_API_KEY`, Global Voice falls back to batch STT/TTS + Vertex.

## Sarvam real-time voice fallback

Indian Languages mode without Samvaad uses **Sarvam WebSocket streaming** (`saaras:v3` STT-translate + Bulbul TTS):

- Buyer mic → PCM 16 kHz → `/api/walkthrough/voice/realtime/audio`
- Sarvam VAD detects end of speech → `/api/walkthrough/voice/realtime/process` → Vertex LLM → TTS
- Cursor MCP uses the same Sarvam APIs for studio testing; see `src/lib/sarvam-mcp-alignment.ts`
