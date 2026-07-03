import type {
  BrochureFlipbookPresetId,
  BrochureFlipbookSettings,
  BrochureFlipbookSoundId,
} from "@/types/brochure-intelligence";

export type FlipbookSoundOption = {
  id: BrochureFlipbookSoundId;
  label: string;
  description: string;
  frequency: number;
  sweepTo: number;
  duration: number;
  gain: number;
  noise?: boolean;
};

export type FlipbookPresetOption = {
  id: BrochureFlipbookPresetId;
  label: string;
  description: string;
  className: string;
  flipTime: number;
  drawShadow: boolean;
  maxShadowOpacity: number;
  showCover: boolean;
};

export const DEFAULT_FLIPBOOK_SETTINGS: Required<BrochureFlipbookSettings> = {
  soundId: "paper-soft",
  presetId: "standard",
};

export const FLIPBOOK_SOUND_OPTIONS: FlipbookSoundOption[] = [
  { id: "none", label: "No sound", description: "Silent page turns.", frequency: 0, sweepTo: 0, duration: 0, gain: 0 },
  { id: "paper-soft", label: "Soft paper", description: "Gentle brochure page sound.", frequency: 720, sweepTo: 280, duration: 0.11, gain: 0.025, noise: true },
  { id: "paper-crisp", label: "Crisp page", description: "Sharper paper flick.", frequency: 980, sweepTo: 340, duration: 0.09, gain: 0.03, noise: true },
  { id: "magazine", label: "Magazine gloss", description: "Glossy magazine turn.", frequency: 620, sweepTo: 220, duration: 0.14, gain: 0.026, noise: true },
  { id: "book-heavy", label: "Heavy book", description: "Thicker premium page.", frequency: 260, sweepTo: 120, duration: 0.16, gain: 0.035 },
  { id: "page-snap", label: "Page snap", description: "Fast sales-deck snap.", frequency: 1120, sweepTo: 520, duration: 0.07, gain: 0.024 },
  { id: "silk", label: "Silk slide", description: "Smooth luxury slide.", frequency: 520, sweepTo: 410, duration: 0.18, gain: 0.018 },
  { id: "card", label: "Card flip", description: "Short card-like flick.", frequency: 860, sweepTo: 180, duration: 0.08, gain: 0.026 },
  { id: "whoosh", label: "Light whoosh", description: "Airy transition.", frequency: 420, sweepTo: 160, duration: 0.2, gain: 0.02 },
  { id: "wood", label: "Wood desk", description: "Muted desk-page touch.", frequency: 180, sweepTo: 90, duration: 0.12, gain: 0.03 },
  { id: "camera", label: "Camera tick", description: "Tiny mechanical click.", frequency: 1320, sweepTo: 760, duration: 0.045, gain: 0.018 },
  { id: "digital", label: "Digital flip", description: "Clean interface tick.", frequency: 1040, sweepTo: 1040, duration: 0.055, gain: 0.016 },
  { id: "executive-paper", label: "Executive paper", description: "Refined boardroom page turn.", frequency: 680, sweepTo: 260, duration: 0.13, gain: 0.022, noise: true },
  { id: "premium-vellum", label: "Premium vellum", description: "Soft high-end stationery feel.", frequency: 560, sweepTo: 240, duration: 0.17, gain: 0.019, noise: true },
  { id: "soft-leather", label: "Soft leather", description: "Warm luxury binder movement.", frequency: 220, sweepTo: 110, duration: 0.18, gain: 0.026 },
  { id: "gallery-slide", label: "Gallery slide", description: "Smooth portfolio gallery transition.", frequency: 480, sweepTo: 300, duration: 0.16, gain: 0.018 },
  { id: "deal-desk", label: "Deal desk", description: "Confident sales-room page flick.", frequency: 760, sweepTo: 310, duration: 0.1, gain: 0.026, noise: true },
  { id: "quiet-office", label: "Quiet office", description: "Subtle page sound for calm rooms.", frequency: 420, sweepTo: 210, duration: 0.12, gain: 0.012, noise: true },
  { id: "marble", label: "Marble lobby", description: "Polished low-touch premium sound.", frequency: 300, sweepTo: 160, duration: 0.15, gain: 0.021 },
  { id: "glass", label: "Glass touch", description: "Light modern showroom tap.", frequency: 1480, sweepTo: 920, duration: 0.052, gain: 0.013 },
  { id: "studio", label: "Studio clean", description: "Clean edited media transition.", frequency: 900, sweepTo: 520, duration: 0.085, gain: 0.018 },
  { id: "cinematic", label: "Cinematic sweep", description: "Soft film-like page sweep.", frequency: 340, sweepTo: 130, duration: 0.22, gain: 0.019 },
  { id: "micro-click", label: "Micro click", description: "Tiny professional UI click.", frequency: 1600, sweepTo: 1240, duration: 0.036, gain: 0.012 },
  { id: "deep-swipe", label: "Deep swipe", description: "Fuller low-end swipe motion.", frequency: 240, sweepTo: 95, duration: 0.19, gain: 0.028 },
  { id: "brochure-fold", label: "Brochure fold", description: "Tri-fold brochure paper movement.", frequency: 700, sweepTo: 190, duration: 0.12, gain: 0.027, noise: true },
  { id: "linen", label: "Linen paper", description: "Textured luxury paper feel.", frequency: 610, sweepTo: 260, duration: 0.145, gain: 0.021, noise: true },
  { id: "velvet", label: "Velvet turn", description: "Very soft premium page motion.", frequency: 390, sweepTo: 250, duration: 0.2, gain: 0.015 },
  { id: "metallic", label: "Metallic tick", description: "Sharp modern product tap.", frequency: 1260, sweepTo: 560, duration: 0.06, gain: 0.015 },
  { id: "notebook", label: "Notebook page", description: "Familiar page flip sound.", frequency: 820, sweepTo: 280, duration: 0.115, gain: 0.024, noise: true },
  { id: "air-page", label: "Air page", description: "Light airy page movement.", frequency: 500, sweepTo: 150, duration: 0.21, gain: 0.014, noise: true },
  { id: "pro-digital", label: "Pro digital", description: "Premium software transition.", frequency: 1180, sweepTo: 880, duration: 0.065, gain: 0.014 },
  { id: "signature", label: "Signature flip", description: "Balanced premium default alternative.", frequency: 660, sweepTo: 240, duration: 0.13, gain: 0.024, noise: true },
];

export const FLIPBOOK_PRESET_OPTIONS: FlipbookPresetOption[] = [
  { id: "standard", label: "Standard Flipbook", description: "Classic page turn for most brochures.", className: "bi-flip-preset-standard", flipTime: 700, drawShadow: true, maxShadowOpacity: 0.45, showCover: true },
  { id: "magazine", label: "Magazine", description: "Wide glossy magazine feel.", className: "bi-flip-preset-magazine", flipTime: 620, drawShadow: true, maxShadowOpacity: 0.55, showCover: true },
  { id: "luxury", label: "Luxury", description: "Slow premium turn with rich shadow.", className: "bi-flip-preset-luxury", flipTime: 900, drawShadow: true, maxShadowOpacity: 0.65, showCover: true },
  { id: "catalog", label: "Catalog", description: "Clean catalog browsing.", className: "bi-flip-preset-catalog", flipTime: 560, drawShadow: true, maxShadowOpacity: 0.35, showCover: false },
  { id: "portfolio", label: "Portfolio", description: "Large visual showcase.", className: "bi-flip-preset-portfolio", flipTime: 760, drawShadow: true, maxShadowOpacity: 0.5, showCover: true },
  { id: "minimal", label: "Minimal", description: "Flat, quiet, minimal transition.", className: "bi-flip-preset-minimal", flipTime: 520, drawShadow: false, maxShadowOpacity: 0.12, showCover: false },
  { id: "shadow-deep", label: "Deep Shadow", description: "Dramatic page depth.", className: "bi-flip-preset-shadow-deep", flipTime: 820, drawShadow: true, maxShadowOpacity: 0.75, showCover: true },
  { id: "soft-paper", label: "Soft Paper", description: "Warm paper-like page surface.", className: "bi-flip-preset-soft-paper", flipTime: 740, drawShadow: true, maxShadowOpacity: 0.42, showCover: true },
  { id: "presentation", label: "Presentation", description: "Fast business review mode.", className: "bi-flip-preset-presentation", flipTime: 460, drawShadow: true, maxShadowOpacity: 0.28, showCover: false },
  { id: "mobile-swipe", label: "Mobile Swipe", description: "Shorter swipe-friendly motion.", className: "bi-flip-preset-mobile-swipe", flipTime: 420, drawShadow: false, maxShadowOpacity: 0.16, showCover: false },
  { id: "sales-deck", label: "Sales Deck", description: "Sharp high-contrast sales deck.", className: "bi-flip-preset-sales-deck", flipTime: 540, drawShadow: true, maxShadowOpacity: 0.38, showCover: false },
  { id: "gallery", label: "Gallery", description: "Photo-gallery style browsing.", className: "bi-flip-preset-gallery", flipTime: 680, drawShadow: true, maxShadowOpacity: 0.48, showCover: true },
];

export function resolveFlipbookSettings(settings?: BrochureFlipbookSettings | null) {
  const sound = FLIPBOOK_SOUND_OPTIONS.find((option) => option.id === settings?.soundId) ?? FLIPBOOK_SOUND_OPTIONS.find((option) => option.id === DEFAULT_FLIPBOOK_SETTINGS.soundId)!;
  const preset = FLIPBOOK_PRESET_OPTIONS.find((option) => option.id === settings?.presetId) ?? FLIPBOOK_PRESET_OPTIONS.find((option) => option.id === DEFAULT_FLIPBOOK_SETTINGS.presetId)!;
  return { sound, preset };
}

let audioContext: AudioContext | null = null;

export function playFlipbookSound(soundId?: BrochureFlipbookSoundId) {
  const sound = FLIPBOOK_SOUND_OPTIONS.find((option) => option.id === soundId) ?? FLIPBOOK_SOUND_OPTIONS.find((option) => option.id === DEFAULT_FLIPBOOK_SETTINGS.soundId)!;
  if (sound.id === "none" || typeof window === "undefined") return;
  const AudioContextCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return;
  audioContext ??= new AudioContextCtor();
  const ctx = audioContext;
  const now = ctx.currentTime;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(sound.frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(sound.sweepTo, 1), now + sound.duration);
  gain.gain.setValueAtTime(sound.gain, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + sound.duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(now);
  oscillator.stop(now + sound.duration);

  if (sound.noise) {
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * sound.duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const noise = ctx.createBufferSource();
    const noiseGain = ctx.createGain();
    noise.buffer = buffer;
    noiseGain.gain.setValueAtTime(sound.gain * 0.6, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + sound.duration);
    noise.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + sound.duration);
  }
}
