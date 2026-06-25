/**
 * Maps walkthrough voice routes to Sarvam MCP tool equivalents (sarvam-mcp / Cursor).
 * Runtime uses the same Sarvam REST + WebSocket APIs as the MCP server.
 */
export const SARVAM_MCP_TOOL_MAP = {
  stt_stream: {
    mcpTool: "sarvam_stt_stream / speech-to-text streaming",
    appRoute: "/api/walkthrough/voice/realtime/session + /realtime/audio",
    sarvamApi: "speech-to-text-translate/ws (saaras:v3)",
  },
  stt_transcribe: {
    mcpTool: "sarvam_stt_transcribe",
    appRoute: "/api/walkthrough/voice (multipart)",
    sarvamApi: "/speech-to-text (saaras:v3)",
  },
  tts_speak: {
    mcpTool: "sarvam_tts_stream / sarvam_tts_speak",
    appRoute: "/api/walkthrough/voice (speakOnly) + realtime/process",
    sarvamApi: "/text-to-speech (bulbul:v3)",
  },
  translate: {
    mcpTool: "sarvam_translate",
    appRoute: "walkthrough-voice.service (Indian profile)",
    sarvamApi: "/translate",
  },
  voice_agent: {
    mcpTool: "sarvam_tools_voice",
    appRoute: "/api/walkthrough/voice + realtime/process (fallback)",
    sarvamApi: "STT translate WS + Vertex + TTS",
  },
  samvaad_convai: {
    mcpTool: "sarvam-conv-ai-sdk / Samvaad platform",
    appRoute: "/api/walkthrough/samvaad/session + runtime proxy + WalkthroughVoiceAgent",
    sarvamApi: "apps.sarvam.ai Samvaad duplex voice (preferred Indian profile)",
  },
  samvaad_rag_tool: {
    mcpTool: "ragService.retrieve (property knowledge from chat UI)",
    appRoute: "/api/walkthrough/samvaad/rag",
    sarvamApi: "Supabase knowledge_entries + structured_property_knowledge",
  },
  llm_complete: {
    mcpTool: "sarvam_llm_complete",
    appRoute: "Samvaad hosted LLM or walkthrough-agent Vertex fallback",
    sarvamApi: "sarvam-30b / sarvam-105b",
  },
} as const;
