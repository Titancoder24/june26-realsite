/**
 * Room-aware scene navigation with alias matching and confidence scoring.
 * Used by voice agent fast-path (client) and walkthrough-agent (server).
 */

export type WalkthroughNavScene = {
  id: string;
  title: string;
  room_type?: string | null;
  description?: string | null;
  caption?: string | null;
  ai_context?: string | null;
};

export type RoomCategory =
  | "kitchen"
  | "living_room"
  | "bathroom"
  | "bedroom"
  | "balcony"
  | "pool"
  | "terrace"
  | "dining"
  | "entrance";

export const ROOM_ALIASES: Record<RoomCategory, string[]> = {
  kitchen: ["kitchen", "cooking area", "modular kitchen"],
  living_room: ["living room", "livingroom", "hall", "lounge", "sitting area", "sitting room"],
  bathroom: ["bathroom", "washroom", "wash room", "bath room", "bath-room", "restroom", "toilet"],
  bedroom: ["bedroom", "bed room", "bed-room", "master bedroom", "bedroom 1", "bedroom 2"],
  balcony: ["balcony", "sitout", "sit out"],
  pool: ["pool", "swimming pool", "swim pool", "swiming pool"],
  terrace: ["terrace", "rooftop"],
  dining: ["dining", "dining area", "dining room"],
  entrance: ["entrance", "entry", "foyer"],
};

/** Generic tokens that must never drive a match on their own. */
const WEAK_TOKENS = new Set(["room", "area", "view", "space", "the", "and", "with"]);

const NAV_PREFIX =
  /^(?:please\s+)?(?:go(?:\s+to)?|take\s+me(?:\s+to)?|show(?:\s+me)?(?:\s+the)?|open(?:\s+the)?|visit(?:\s+the)?|see(?:\s+the)?|view(?:\s+the)?|move(?:\s+to)?|navigate(?:\s+to)?|jump(?:\s+to)?)\s+/i;

const WHERE_PREFIX = /^(?:where\s+is|where's)\s+(?:the\s+)?/i;

export type SceneMatchResult = {
  sceneId: string;
  label: string;
  confidence: number;
  matchType: "exact" | "alias" | "room_type" | "fuzzy";
  roomCategory?: RoomCategory;
  targetRoom: string;
};

export type SceneNavigationResult =
  | { action: "navigate"; match: SceneMatchResult }
  | { action: "clarify"; message: string; candidates: SceneMatchResult[] }
  | { action: "none" };

/** Minimum confidence to auto-navigate without asking. */
export const NAVIGATE_CONFIDENCE_THRESHOLD = 0.72;

/** Minimum confidence to consider a candidate at all. */
const CANDIDATE_THRESHOLD = 0.45;

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Collapse spacing/punctuation variants: "bath room" → "bathroom", "living-room" → "livingroom". */
export function compactNormalize(value: string): string {
  return normalizeText(value).replace(/[\s_-]/g, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/** Safe fuzzy score on compact strings; exact/alias matches should beat this. */
function fuzzyCompactScore(query: string, target: string): number | null {
  const q = compactNormalize(query);
  const t = compactNormalize(target);
  if (!q || !t) return null;
  if (q === t) return 1;

  const maxLen = Math.max(q.length, t.length);
  if (maxLen < 4) return null;

  if (q.includes(t) || t.includes(q)) {
    return 0.9 * Math.min(q.length, t.length) / maxLen;
  }

  const dist = levenshtein(q, t);
  const maxDist = maxLen >= 9 ? 2 : maxLen >= 5 ? 1 : 0;
  if (dist > maxDist) return null;

  return Math.max(0.72, 0.88 - dist * 0.06);
}

function hasWord(text: string, word: string): boolean {
  if (!word || word.length < 3) return false;
  if (WEAK_TOKENS.has(word)) return false;
  return new RegExp(`\\b${escapeRegExp(word)}\\b`, "i").test(text);
}

function normalizeRoomType(roomType: string | null | undefined): string {
  return normalizeText(roomType ?? "").replace(/\s+/g, "_");
}

export function extractNavigationTarget(query: string): string {
  let text = query.trim();
  text = text.replace(NAV_PREFIX, "").replace(WHERE_PREFIX, "");
  return text.replace(/[?.!,]+$/, "").trim();
}

type CategoryCandidate = { category: RoomCategory; score: number; priority: number };

function scoreCategoryAlias(
  normalized: string,
  compact: string,
  alias: string,
): { score: number; priority: number } | null {
  const na = normalizeText(alias);
  const ca = compactNormalize(alias);
  if (!na && !ca) return null;

  if (normalized === na) return { score: 1, priority: 4 };
  if (compact === ca) return { score: 0.98, priority: 3 };

  if (na.length >= 4 && (normalized.includes(na) || na.includes(normalized))) {
    return { score: 0.94 * (na.length / Math.max(normalized.length, na.length)), priority: 2 };
  }
  if (ca.length >= 4 && (compact.includes(ca) || ca.includes(compact))) {
    return { score: 0.92 * (ca.length / Math.max(compact.length, ca.length)), priority: 2 };
  }

  const fuzzy = fuzzyCompactScore(compact, ca);
  if (fuzzy != null) return { score: fuzzy * 0.86, priority: 1 };

  return null;
}

export function resolveRoomCategory(text: string): RoomCategory | null {
  const normalized = normalizeText(text);
  const compact = compactNormalize(text);
  if (!normalized && !compact) return null;

  let best: CategoryCandidate | null = null;

  for (const [category, aliases] of Object.entries(ROOM_ALIASES) as [RoomCategory, string[]][]) {
    for (const alias of aliases) {
      const scored = scoreCategoryAlias(normalized, compact, alias);
      if (!scored) continue;

      if (scored.priority === 4) return category;

      const candidate: CategoryCandidate = { category, ...scored };
      if (
        !best
        || candidate.priority > best.priority
        || (candidate.priority === best.priority && candidate.score > best.score)
      ) {
        best = candidate;
      }
    }
  }

  return best && best.score >= 0.72 ? best.category : null;
}

export function isNavigationIntent(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;

  const lower = trimmed.toLowerCase();

  if (
    /(?:^|\b)(?:go(?:\s+to|\s+b)?|take\s+me(?:\s+to)?|show(?:\s+me)?|open|visit|see(?:\s+the)?|view(?:\s+the)?|move(?:\s+to)?|navigate(?:\s+to)?|jump(?:\s+to)?|where\s+is|where's)\b/i.test(
      lower,
    )
  ) {
    return true;
  }

  const target = extractNavigationTarget(trimmed);
  if (resolveRoomCategory(target)) return true;
  if (resolveRoomCategory(trimmed)) return true;

  return false;
}

function sceneHaystack(scene: WalkthroughNavScene): string {
  return normalizeText(
    [scene.title, scene.room_type, scene.description, scene.caption, scene.ai_context]
      .filter(Boolean)
      .join(" "),
  );
}

function sceneHaystackCompact(scene: WalkthroughNavScene): string {
  return compactNormalize(sceneHaystack(scene));
}

function conflictingCategoriesInTitle(title: string, target: RoomCategory): RoomCategory[] {
  const found: RoomCategory[] = [];
  for (const [category, aliases] of Object.entries(ROOM_ALIASES) as [RoomCategory, string[]][]) {
    if (category === target) continue;
    for (const alias of aliases) {
      const words = normalizeText(alias).split(/\s+/).filter((w) => w.length >= 4 && !WEAK_TOKENS.has(w));
      if (words.some((w) => hasWord(title, w))) {
        found.push(category);
        break;
      }
    }
  }
  return found;
}

function scoreSceneForTarget(
  scene: WalkthroughNavScene,
  targetText: string,
  category: RoomCategory | null,
): SceneMatchResult | null {
  const title = normalizeText(scene.title ?? "");
  const titleCompact = compactNormalize(scene.title ?? "");
  const haystack = sceneHaystack(scene);
  const haystackCompact = sceneHaystackCompact(scene);
  const target = normalizeText(targetText);
  const targetCompact = compactNormalize(targetText);
  if (!target && !targetCompact && !category) return null;

  const roomTypeNorm = normalizeRoomType(scene.room_type);

  if (category && (roomTypeNorm === category || roomTypeNorm.replace(/_/g, " ") === category.replace(/_/g, " "))) {
    return {
      sceneId: scene.id,
      label: scene.title,
      confidence: 0.96,
      matchType: "room_type",
      roomCategory: category,
      targetRoom: targetText,
    };
  }

  const aliases = category ? ROOM_ALIASES[category] : [targetText];
  let bestScore = 0;
  let bestType: SceneMatchResult["matchType"] = "fuzzy";

  for (const alias of aliases) {
    const na = normalizeText(alias);
    const ca = compactNormalize(alias);
    if (!na && !ca) continue;

    if (title === na || titleCompact === ca) {
      bestScore = Math.max(bestScore, 1);
      bestType = "exact";
      continue;
    }

    if (title.startsWith(na) || title.startsWith(`the ${na}`) || titleCompact.startsWith(ca)) {
      bestScore = Math.max(bestScore, 0.94);
      bestType = "alias";
      continue;
    }

    const aliasWords = na.split(/\s+/).filter((w) => w.length >= 3 && !WEAK_TOKENS.has(w));
    const titleHasAll = aliasWords.length > 0 && aliasWords.every((w) => hasWord(title, w));
    if (titleHasAll) {
      const conflicts = category ? conflictingCategoriesInTitle(title, category) : [];
      const score = conflicts.length ? 0.62 : 0.9;
      if (score > bestScore) {
        bestScore = score;
        bestType = "alias";
      }
      continue;
    }

    if (ca.length >= 4 && (titleCompact.includes(ca) || ca.includes(titleCompact))) {
      const conflicts = category ? conflictingCategoriesInTitle(title, category) : [];
      const score = conflicts.length ? 0.58 : 0.88;
      if (score > bestScore) {
        bestScore = score;
        bestType = "alias";
      }
    }

    for (const word of aliasWords) {
      if (hasWord(title, word)) {
        const conflicts = category ? conflictingCategoriesInTitle(title, category) : [];
        const score = conflicts.length ? 0.55 : 0.82;
        if (score > bestScore) {
          bestScore = score;
          bestType = "fuzzy";
        }
      }
    }

    const fuzzyTitle = fuzzyCompactScore(titleCompact, ca);
    if (fuzzyTitle != null) {
      const conflicts = category ? conflictingCategoriesInTitle(title, category) : [];
      const score = conflicts.length ? fuzzyTitle * 0.65 : fuzzyTitle * 0.84;
      if (score > bestScore) {
        bestScore = score;
        bestType = "fuzzy";
      }
    }
  }

  if (!category && target) {
    if (title === target || titleCompact === targetCompact) {
      bestScore = Math.max(bestScore, 0.98);
      bestType = "exact";
    } else if (title.includes(target) || target.includes(title) || titleCompact.includes(targetCompact)) {
      const targetWords = target.split(/\s+/).filter((w) => w.length >= 4 && !WEAK_TOKENS.has(w));
      if (targetWords.length > 0 && targetWords.every((w) => hasWord(title, w))) {
        bestScore = Math.max(bestScore, 0.88);
        bestType = "alias";
      }
    }

    const fuzzyTarget = fuzzyCompactScore(titleCompact, targetCompact);
    if (fuzzyTarget != null) {
      bestScore = Math.max(bestScore, fuzzyTarget * 0.82);
      bestType = "fuzzy";
    }
  }

  if (bestScore < CANDIDATE_THRESHOLD) {
    const targetWords = target.split(/\s+/).filter((w) => w.length >= 4 && !WEAK_TOKENS.has(w));
    if (targetWords.length) {
      const matched = targetWords.filter((w) => hasWord(haystack, w));
      if (matched.length === targetWords.length) {
        bestScore = Math.max(bestScore, 0.7);
        bestType = "fuzzy";
      } else if (matched.length > 0 && matched.length < targetWords.length) {
        bestScore = Math.max(bestScore, 0.4);
      }
    }

    if (targetCompact.length >= 4 && haystackCompact.includes(targetCompact)) {
      bestScore = Math.max(bestScore, 0.75);
      bestType = "fuzzy";
    }
  }

  if (bestScore < CANDIDATE_THRESHOLD) return null;

  return {
    sceneId: scene.id,
    label: scene.title,
    confidence: bestScore,
    matchType: bestType,
    roomCategory: category ?? undefined,
    targetRoom: targetText,
  };
}

export function resolveSceneNavigation(
  query: string,
  scenes: WalkthroughNavScene[],
): SceneNavigationResult {
  const trimmed = query.trim();
  if (!trimmed || !scenes.length) return { action: "none" };

  if (!isNavigationIntent(trimmed)) return { action: "none" };

  const targetText = extractNavigationTarget(trimmed) || trimmed;
  const targetTokens = normalizeText(targetText).split(/\s+/).filter(Boolean);
  if (targetTokens.length > 0 && targetTokens.every((token) => WEAK_TOKENS.has(token))) {
    return { action: "none" };
  }

  const category = resolveRoomCategory(targetText) ?? resolveRoomCategory(trimmed);

  if (process.env.NODE_ENV === "development") {
    logVoiceNavigationDev({
      transcript: trimmed,
      intent: "match",
      targetRoom: targetText,
      normalizedInput: normalizeText(trimmed),
      compactInput: compactNormalize(trimmed),
      roomCategory: category ?? undefined,
      success: true,
      action: "resolve_input",
    });
  }

  const candidates: SceneMatchResult[] = [];
  for (const scene of scenes) {
    const scored = scoreSceneForTarget(scene, targetText, category);
    if (scored) candidates.push(scored);
  }

  candidates.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    const aIdx = scenes.findIndex((s) => s.id === a.sceneId);
    const bIdx = scenes.findIndex((s) => s.id === b.sceneId);
    return aIdx - bIdx;
  });

  const uniqueByScene = candidates.filter(
    (c, i, arr) => arr.findIndex((x) => x.sceneId === c.sceneId) === i,
  );

  if (!uniqueByScene.length) return { action: "none" };

  const best = uniqueByScene[0];
  const second = uniqueByScene[1];

  if (best.confidence >= NAVIGATE_CONFIDENCE_THRESHOLD) {
    if (
      second
      && second.confidence >= best.confidence - 0.08
      && second.sceneId !== best.sceneId
      && second.roomCategory !== best.roomCategory
    ) {
      const options = uniqueByScene.slice(0, 3).map((c) => c.label).join(", ");
      return {
        action: "clarify",
        message: `I found several spaces that could match. Did you mean ${options}?`,
        candidates: uniqueByScene.slice(0, 3),
      };
    }
    return { action: "navigate", match: best };
  }

  if (best.confidence >= CANDIDATE_THRESHOLD) {
    const options = uniqueByScene.slice(0, 3).map((c) => c.label).join(", ");
    return {
      action: "clarify",
      message: `I'm not sure which space you mean. Did you mean ${options}?`,
      candidates: uniqueByScene.slice(0, 3),
    };
  }

  return { action: "none" };
}

/** Backward-compatible helper — returns best match only when confidence is high enough. */
export function matchSceneLocally(
  query: string,
  scenes: WalkthroughNavScene[],
): { sceneId: string; label: string; confidence: number } | null {
  const result = resolveSceneNavigation(query, scenes);
  if (result.action === "navigate") {
    return {
      sceneId: result.match.sceneId,
      label: result.match.label,
      confidence: result.match.confidence,
    };
  }
  return null;
}

export function logVoiceNavigationDev(payload: {
  transcript: string;
  intent: string;
  targetRoom?: string;
  normalizedInput?: string;
  compactInput?: string;
  roomCategory?: string;
  match?: SceneMatchResult | null;
  confidence?: number;
  sceneId?: string;
  sceneTitle?: string;
  responseText?: string;
  success: boolean;
  action: string;
}) {
  if (process.env.NODE_ENV !== "development") return;
  console.info("[voice-nav]", payload);
}
