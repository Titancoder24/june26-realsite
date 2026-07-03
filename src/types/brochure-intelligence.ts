export type BrochureViewerMode = "pdf" | "flipbook";

export type BrochureCta = {
  type: "call" | "whatsapp" | "site_visit" | "download" | "enquire";
  label: string;
  url?: string;
  phone?: string;
};

export type BrochureSettings = {
  ctas?: BrochureCta[];
  consentNoticeVersion?: string;
  whatsappNumber?: string;
  callNumber?: string;
  leadGate?: BrochureLeadGateSettings;
  flipbook?: BrochureFlipbookSettings;
};

export type BrochureFlipbookSoundId =
  | "none"
  | "paper-soft"
  | "paper-crisp"
  | "magazine"
  | "book-heavy"
  | "page-snap"
  | "silk"
  | "card"
  | "whoosh"
  | "wood"
  | "camera"
  | "digital"
  | "executive-paper"
  | "premium-vellum"
  | "soft-leather"
  | "gallery-slide"
  | "deal-desk"
  | "quiet-office"
  | "marble"
  | "glass"
  | "studio"
  | "cinematic"
  | "micro-click"
  | "deep-swipe"
  | "brochure-fold"
  | "linen"
  | "velvet"
  | "metallic"
  | "notebook"
  | "air-page"
  | "pro-digital"
  | "signature";

export type BrochureFlipbookPresetId =
  | "standard"
  | "magazine"
  | "luxury"
  | "catalog"
  | "portfolio"
  | "minimal"
  | "shadow-deep"
  | "soft-paper"
  | "presentation"
  | "mobile-swipe"
  | "sales-deck"
  | "gallery";

export type BrochureFlipbookSettings = {
  soundId?: BrochureFlipbookSoundId;
  presetId?: BrochureFlipbookPresetId;
};

export type BrochureLeadGateSettings = {
  brandName?: string;
  logoUrl?: string;
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  helperText?: string;
  buttonLabel?: string;
  primaryColor?: string;
  accentColor?: string;
  theme?: "light" | "dark" | "glass";
  layout?: "split" | "centered";
};

export type BrochureSection = {
  id: string;
  brochure_id: string;
  page_number: number;
  section_id: string;
  label: string;
  category?: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type BrochureEventType =
  | "brochure_opened"
  | "lead_gate_submitted"
  | "page_viewed"
  | "page_left"
  | "page_dwell"
  | "section_visible"
  | "section_dwell"
  | "section_clicked"
  | "scroll_depth"
  | "zoom_changed"
  | "download_clicked"
  | "share_clicked"
  | "cta_clicked"
  | "lead_form_opened"
  | "lead_submitted"
  | "brochure_closed"
  | "click";

export type BrochureTrackingEvent = {
  eventType: BrochureEventType;
  pageNumber?: number;
  sectionId?: string;
  x?: number;
  y?: number;
  payload?: Record<string, unknown>;
};

export type BrochurePageDwellFlush = {
  pageNumber: number;
  seconds: number;
  viewCount: number;
  maxScrollPercent: number;
  maxZoom: number;
};

export type BrochureSectionDwellFlush = {
  pageNumber: number;
  sectionId: string;
  sectionLabel?: string;
  visibleSeconds: number;
  viewCount: number;
  maxVisiblePercent: number;
};

export type BrochureScrollBucketFlush = {
  pageNumber: number;
  scrollBucket: string;
  seconds: number;
};

export type BrochureHeatmapPointFlush = {
  pageNumber: number;
  eventType: string;
  x: number;
  y: number;
  viewportWidth?: number;
  viewportHeight?: number;
  zoom?: number;
};

export type BrochureDwellFlushPayload = {
  sessionId: string;
  brochureId: string;
  pageDwell?: BrochurePageDwellFlush[];
  sectionDwell?: BrochureSectionDwellFlush[];
  scrollDepth?: BrochureScrollBucketFlush[];
  heatmapPoints?: BrochureHeatmapPointFlush[];
  events?: BrochureTrackingEvent[];
  ended?: boolean;
};

export type LeadStatus = "cold" | "warm" | "hot";
