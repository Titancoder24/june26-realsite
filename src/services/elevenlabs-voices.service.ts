import type { ElevenLabs } from "@elevenlabs/elevenlabs-js";
import {
  isElevenLabsWalkthroughLanguageCode,
} from "@/lib/elevenlabs-languages";
import type { ElevenLabsStudioVoiceConfig } from "@/lib/elevenlabs-studio-voice";
import {
  getLibraryQueriesForWalkthrough,
  isIndianWalkthroughLanguage,
  sortVoicesForWalkthroughLanguage,
  voiceBelongsToWalkthroughLanguage,
  voiceHasVerifiedLanguage,
  type ElevenLabsVoiceLanguageFields,
} from "@/lib/elevenlabs-voice-language";
import { getElevenLabsClient, elevenLabsService } from "@/services/elevenlabs.service";

export type ElevenLabsVerifiedLanguage = {
  language: string;
  accent?: string;
  locale?: string;
  previewUrl?: string;
};

export type ElevenLabsVoiceListItem = ElevenLabsVoiceLanguageFields;

export type ElevenLabsTtsModelOption = {
  modelId: string;
  name: string;
  description?: string;
  canUseStyle?: boolean;
  canUseSpeakerBoost?: boolean;
  languages?: string[];
};

const MAX_SHARED_PAGES = 3;
const SHARED_PAGE_SIZE = 100;

export class ElevenLabsVoicesService {
  isConfigured(): boolean {
    return elevenLabsService.isConfigured();
  }

  async listVoices(
    search?: string,
    _language?: string,
    walkthroughCode?: string,
  ): Promise<ElevenLabsVoiceListItem[]> {
    if (!walkthroughCode?.trim() || !isElevenLabsWalkthroughLanguageCode(walkthroughCode)) {
      return this.listAccountVoices(search?.trim() || undefined);
    }
    return this.listVoicesForWalkthroughLanguage(walkthroughCode, search?.trim() || undefined);
  }

  async listVoiceCatalog(walkthroughCode?: string): Promise<ElevenLabsVoiceListItem[]> {
    if (walkthroughCode && isElevenLabsWalkthroughLanguageCode(walkthroughCode)) {
      return this.listVoicesForWalkthroughLanguage(walkthroughCode);
    }
    return this.listAccountVoices();
  }

  async listVoicesForWalkthroughLanguage(
    walkthroughCode: string,
    accountSearch?: string,
  ): Promise<ElevenLabsVoiceListItem[]> {
    const merged = new Map<string, ElevenLabsVoiceListItem>();

    const client = getElevenLabsClient();
    const queries = getLibraryQueriesForWalkthrough(walkthroughCode);

    for (const query of queries) {
      const batch = await this.fetchSharedPages(client, query);
      for (const voice of batch) {
        if (!voiceBelongsToWalkthroughLanguage(voice, walkthroughCode)) continue;
        if (!merged.has(voice.voiceId)) merged.set(voice.voiceId, voice);
      }
    }

    const accountVoices = await this.listAccountVoices(accountSearch);
    for (const voice of accountVoices) {
      if (!voiceHasVerifiedLanguage(voice, walkthroughCode)) continue;
      if (!merged.has(voice.voiceId)) {
        merged.set(voice.voiceId, { ...voice, source: "account" });
      }
    }

    return sortVoicesForWalkthroughLanguage([...merged.values()], walkthroughCode);
  }

  private async fetchSharedPages(
    client: ReturnType<typeof getElevenLabsClient>,
    query: { language?: string; search?: string },
  ): Promise<ElevenLabsVoiceListItem[]> {
    const out: ElevenLabsVoiceListItem[] = [];
    let page = 1;

    while (page <= MAX_SHARED_PAGES) {
      const response = await client.voices.getShared({
        pageSize: SHARED_PAGE_SIZE,
        page,
        language: query.language,
        search: query.search,
        sort: "usage_character_count_1y",
      });

      const batch = (response.voices ?? []).map((v) => this.mapLibraryVoice(v));
      out.push(...batch);

      if (!response.hasMore || batch.length < SHARED_PAGE_SIZE) break;
      page += 1;
    }

    return out;
  }

  async listAccountVoices(search?: string): Promise<ElevenLabsVoiceListItem[]> {
    const client = getElevenLabsClient();
    const all: ElevenLabs.Voice[] = [];
    let nextPageToken: string | undefined;
    let pages = 0;

    while (pages < 10) {
      const response = await client.voices.search({
        pageSize: 100,
        search: search || undefined,
        sort: "name",
        sortDirection: "asc",
        nextPageToken,
      });
      all.push(...(response.voices ?? []));
      if (!response.hasMore || !response.nextPageToken) break;
      nextPageToken = response.nextPageToken;
      pages += 1;
    }

    return all
      .map((voice) => this.mapVoice(voice))
      .filter((v) => v.voiceId && v.name);
  }

  filterVoicesForLanguage(
    voices: ElevenLabsVoiceListItem[],
    _elevenLabsLanguageCode: string,
    walkthroughCode?: string,
  ): ElevenLabsVoiceListItem[] {
    if (!walkthroughCode) return voices;
    return voices.filter((v) => voiceBelongsToWalkthroughLanguage(v, walkthroughCode));
  }

  async listTtsModels(): Promise<ElevenLabsTtsModelOption[]> {
    const client = getElevenLabsClient();
    const models = await client.models.list();
    return (models ?? [])
      .filter((m) => m.canDoTextToSpeech && m.modelId)
      .map((m) => ({
        modelId: m.modelId,
        name: m.name ?? m.modelId,
        description: m.description,
        canUseStyle: m.canUseStyle,
        canUseSpeakerBoost: m.canUseSpeakerBoost,
        languages: m.languages?.map((l) => l.name ?? l.languageId ?? "").filter(Boolean),
      }));
  }

  async previewVoice(params: {
    text: string;
    config: ElevenLabsStudioVoiceConfig;
    organizationId?: string;
    voiceId?: string;
    languageCode?: string;
  }): Promise<ArrayBuffer> {
    const voiceId = params.voiceId ?? params.config.voice_id;
    const lang = params.languageCode?.trim();
    let modelId = params.config.tts_model;
    if (
      lang
      && isIndianWalkthroughLanguage(lang)
      && !modelId.includes("multilingual")
      && !modelId.includes("v3")
    ) {
      modelId = "eleven_multilingual_v2";
    }

    return elevenLabsService.textToSpeech(params.text, {
      voiceId,
      modelId,
      voiceSettings: {
        stability: params.config.stability,
        similarityBoost: params.config.similarity_boost,
        style: params.config.style,
        speed: params.config.speed,
        useSpeakerBoost: params.config.use_speaker_boost,
      },
      organizationId: params.organizationId,
    });
  }

  private mapLibraryVoice(voice: ElevenLabs.LibraryVoiceResponse): ElevenLabsVoiceListItem {
    return {
      voiceId: voice.voiceId,
      name: voice.name,
      previewUrl: voice.previewUrl,
      labels: {
        ...(voice.accent ? { accent: voice.accent } : {}),
        ...(voice.gender ? { gender: voice.gender } : {}),
        ...(voice.language ? { language: voice.language } : {}),
        ...(voice.locale ? { locale: voice.locale } : {}),
      },
      category: voice.category,
      description: voice.description,
      verifiedLanguages: (voice.verifiedLanguages ?? []).map((v) => ({
        language: v.language ?? "",
        accent: v.accent,
        locale: v.locale,
        previewUrl: v.previewUrl,
      })),
      source: "library",
    };
  }

  private mapVoice(voice: ElevenLabs.Voice): ElevenLabsVoiceListItem {
    return {
      voiceId: voice.voiceId ?? "",
      name: voice.name ?? voice.voiceId ?? "Voice",
      previewUrl: voice.previewUrl,
      labels: voice.labels,
      category: voice.category,
      description: voice.description,
      verifiedLanguages: (voice.verifiedLanguages ?? []).map((v) => ({
        language: v.language ?? "",
        accent: v.accent,
        locale: v.locale,
        previewUrl: v.previewUrl,
      })),
      source: "account",
    };
  }
}

export const elevenLabsVoicesService = new ElevenLabsVoicesService();
