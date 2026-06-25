export type WalkthroughPlayerCommand =
  | { type: "MOVE_FORWARD" }
  | { type: "MOVE_BACKWARD" }
  | { type: "NEXT_SCENE" }
  | { type: "PREVIOUS_SCENE" }
  | { type: "JUMP_TO_SCENE"; sceneId: string }
  | { type: "JUMP_TO_INDEX"; index: number }
  | { type: "HIGHLIGHT_ANNOTATION"; annotationId: string; sceneId?: string }
  | { type: "RESET_HIGHLIGHT" }
  | { type: "SET_WALK_MODE"; enabled: boolean }
  | { type: "SET_PLAYING"; playing: boolean };

export type WalkthroughAICommand =
  | { command: "JUMP_TO_SCENE"; sceneId: string; annotationId?: string }
  | { command: "HIGHLIGHT_ANNOTATION"; annotationId: string; sceneId: string }
  | { command: "OPEN_LEAD_FORM" }
  | { command: "SHOW_ROOM_MENU" }
  | { command: "PAUSE_AUTOPLAY"; durationMs?: number }
  | { command: "RESUME_AUTOPLAY" }
  | { command: "NONE" };

export interface WalkthroughPlayerState {
  activeIndex: number;
  activeSceneId: string | null;
  walkMode: boolean;
  playing: boolean;
  highlightedAnnotationId: string | null;
  isTransitioning: boolean;
}

export function resolveSceneIndex(sceneId: string, sceneIds: string[]): number {
  return sceneIds.indexOf(sceneId);
}

export function logWalkthroughNavigation(
  step: string,
  payload: Record<string, unknown>,
) {
  if (process.env.NODE_ENV !== "development") return;
  console.info(`[walkthrough-nav] ${step}`, payload);
}

export function reducePlayerState(
  state: WalkthroughPlayerState,
  command: WalkthroughPlayerCommand,
  sceneCount: number,
  sceneIds: string[],
): WalkthroughPlayerState {
  switch (command.type) {
    case "JUMP_TO_INDEX": {
      const idx = Math.min(sceneCount - 1, Math.max(0, command.index));
      return { ...state, activeIndex: idx, activeSceneId: sceneIds[idx] ?? null, isTransitioning: true };
    }
    case "JUMP_TO_SCENE": {
      const idx = sceneIds.indexOf(command.sceneId);
      if (idx < 0) return state;
      return { ...state, activeIndex: idx, activeSceneId: command.sceneId, isTransitioning: true };
    }
    case "NEXT_SCENE":
      return reducePlayerState(state, { type: "JUMP_TO_INDEX", index: state.activeIndex + 1 }, sceneCount, sceneIds);
    case "PREVIOUS_SCENE":
      return reducePlayerState(state, { type: "JUMP_TO_INDEX", index: state.activeIndex - 1 }, sceneCount, sceneIds);
    case "HIGHLIGHT_ANNOTATION":
      return { ...state, highlightedAnnotationId: command.annotationId };
    case "RESET_HIGHLIGHT":
      return { ...state, highlightedAnnotationId: null };
    case "SET_WALK_MODE":
      return { ...state, walkMode: command.enabled };
    case "SET_PLAYING":
      return { ...state, playing: command.playing };
    default:
      return state;
  }
}

export function mapAICommandToPlayer(
  ai: WalkthroughAICommand,
  sceneIds: string[],
): WalkthroughPlayerCommand | null {
  if (ai.command === "NONE") return null;
  if (ai.command === "JUMP_TO_SCENE" && ai.sceneId) {
    return { type: "JUMP_TO_SCENE", sceneId: ai.sceneId };
  }
  if (ai.command === "HIGHLIGHT_ANNOTATION" && ai.annotationId) {
    const cmds: WalkthroughPlayerCommand[] = [];
    if (ai.sceneId && sceneIds.includes(ai.sceneId)) {
      cmds.push({ type: "JUMP_TO_SCENE", sceneId: ai.sceneId });
    }
    return { type: "HIGHLIGHT_ANNOTATION", annotationId: ai.annotationId, sceneId: ai.sceneId };
  }
  return null;
}

export function resolveKeyboardCommand(key: string, walkMode: boolean): WalkthroughPlayerCommand | null {
  const k = key.toLowerCase();
  if (k === "w" || k === "arrowup") return { type: "MOVE_FORWARD" };
  if (k === "s" || k === "arrowdown") return { type: "MOVE_BACKWARD" };
  if (k === "d" || k === "arrowright") return { type: "NEXT_SCENE" };
  if (k === "a" || k === "arrowleft") return { type: "PREVIOUS_SCENE" };
  if (walkMode && k === " ") return { type: "SET_PLAYING", playing: false };
  return null;
}
