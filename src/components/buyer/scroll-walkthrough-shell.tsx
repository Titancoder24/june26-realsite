"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { MotionSceneViewer, type VideoFitMode } from "@/components/buyer/motion-scene-viewer";
import { useIsMobile } from "@/hooks/use-mobile";
import { getIsMobileViewport, isTouchDevice, supportsNativeFullscreen } from "@/lib/mobile-viewport";
import { isSceneIncluded } from "@/lib/walkthrough-scene-meta";
import { VIDEO_WALKTHROUGH_ANNOTATIONS_ENABLED } from "@/lib/walkthrough-video-features";
import {
  logWalkthroughNavigation,
  mapAICommandToPlayer,
  reducePlayerState,
  resolveKeyboardCommand,
  resolveSceneIndex,
  type WalkthroughAICommand,
  type WalkthroughPlayerCommand,
  type WalkthroughPlayerState,
} from "@/lib/walkthrough-player-controller";
import type { WalkthroughAnnotation, WalkthroughScene } from "@/types/cinematic-walkthrough";
import type { PropertyScene, SceneAnnotationRecord } from "@/types/scene-intelligence";
import { ChevronDown, Footprints, LayoutGrid, Maximize2, MessageSquare, Minimize2, Pause, Phone, Play, Smartphone, X } from "lucide-react";

function toPropertyScene(scene: WalkthroughScene, isMobile: boolean): PropertyScene {
  const imageUrl = isMobile && scene.edited_image_url ? scene.edited_image_url : scene.image_url;
  return {
    id: scene.id,
    experience_id: scene.experience_id,
    property_id: scene.property_id,
    title: scene.title,
    description: scene.description ?? undefined,
    image_url: imageUrl,
    edited_image_url: scene.edited_image_url ?? undefined,
    thumbnail_url: scene.thumbnail_url ?? undefined,
    scene_order: scene.scene_order,
    is_start_scene: scene.is_start_scene,
    motion_type: scene.motion_type as PropertyScene["motion_type"],
    motion_config: { duration: scene.duration ?? 6, easing: "ease-in-out" } as PropertyScene["motion_config"],
    duration: scene.duration,
    edit_config: {} as PropertyScene["edit_config"],
    mobile_crop: scene.mobile_crop ?? { x: 0, y: 0, width: 1, height: 1 },
    desktop_crop: scene.desktop_crop ?? { x: 0, y: 0, width: 1, height: 1 },
    ai_context: scene.ai_context ?? undefined,
  };
}

function toAnnotations(anns: WalkthroughAnnotation[] = []): SceneAnnotationRecord[] {
  return anns.map((a) => ({
    id: a.id,
    scene_id: a.scene_id,
    property_id: a.property_id,
    experience_id: a.experience_id,
    title: a.title,
    short_description: a.short_description ?? undefined,
    description: a.description ?? undefined,
    category: a.category as SceneAnnotationRecord["category"],
    x_position: a.x_position,
    y_position: a.y_position,
    visibility: a.visibility as SceneAnnotationRecord["visibility"],
    cta_type: a.cta_type ?? undefined,
    cta_label: a.cta_label ?? undefined,
    media_url: a.media_url ?? undefined,
    ai_context: a.ai_context ?? undefined,
    rag_enabled: a.rag_enabled,
    rag_entry_id: a.rag_entry_id ?? undefined,
    crm_tracking_enabled: a.crm_tracking_enabled,
    sort_order: a.sort_order,
  }));
}

function sceneVideoUrl(scene: WalkthroughScene, isMobile: boolean) {
  if (isMobile) return scene.video_url_mobile ?? scene.video_url_720p ?? scene.video_url;
  return scene.video_url_1080p ?? scene.video_url ?? scene.video_url_720p;
}

function computeScrollState(
  container: HTMLDivElement,
  sections: (HTMLDivElement | null)[],
  sceneCount: number,
  walkMode: boolean,
) {
  const vh = container.clientHeight;
  const scrollTop = container.scrollTop;

  if (walkMode) {
    const idx = Math.min(sceneCount - 1, Math.max(0, Math.round(scrollTop / Math.max(vh, 1))));
    return { activeIndex: idx, scrubProgress: 0 };
  }

  let activeIndex = 0;
  let scrubProgress = 0;

  for (let i = 0; i < Math.min(sections.length, sceneCount); i++) {
    const section = sections[i];
    if (!section) continue;
    const top = section.offsetTop;
    const height = section.offsetHeight;
    const scrubRange = Math.max(height - vh, 1);

    if (scrollTop >= top && scrollTop < top + height) {
      activeIndex = i;
      scrubProgress = Math.min(1, Math.max(0, (scrollTop - top) / scrubRange));
      return { activeIndex, scrubProgress };
    }
    if (scrollTop >= top + height) activeIndex = Math.min(i + 1, sceneCount - 1);
  }

  return { activeIndex, scrubProgress };
}

export type WalkthroughPlayerHandle = {
  goToScene: (sceneId: string) => boolean;
  goToIndex: (index: number) => boolean;
};

export const ScrollWalkthroughShell = forwardRef<
  WalkthroughPlayerHandle,
  {
  scenes: WalkthroughScene[];
  projectName: string;
  propertyName: string;
  brandColor?: string;
  logoUrl?: string;
  onAnnotationClick?: (ann: WalkthroughAnnotation) => void;
  onSceneEvent?: (type: string, payload?: Record<string, unknown>) => void;
  onAskAI?: () => void;
  onContact?: () => void;
  onAICommand?: (cmd: WalkthroughAICommand) => void;
  externalAICommand?: WalkthroughAICommand | null;
  }
>(function ScrollWalkthroughShell({
  scenes,
  projectName,
  propertyName,
  brandColor,
  logoUrl,
  onAnnotationClick,
  onSceneEvent,
  onAskAI,
  onContact,
  onAICommand,
  externalAICommand,
}, ref) {
  const isMobile = useIsMobile();
  const activeScenes = scenes.filter(isSceneIncluded);
  const sceneIds = activeScenes.map((s) => s.id);
  const rootRef = useRef<HTMLDivElement>(null);
  const [videoFit, setVideoFit] = useState<VideoFitMode>(() =>
    getIsMobileViewport() ? "cover" : "contain",
  );
  const [isPortrait, setIsPortrait] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [player, setPlayer] = useState<WalkthroughPlayerState>({
    activeIndex: 0,
    activeSceneId: activeScenes[0]?.id ?? null,
    walkMode: true,
    playing: true,
    highlightedAnnotationId: null,
    isTransitioning: false,
  });
  const storiesAutoplayPausedRef = useRef(false);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scrubProgress, setScrubProgress] = useState(0);
  const [showHint, setShowHint] = useState(true);
  const [showRoomMenu, setShowRoomMenu] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const touchStart = useRef<{ x: number; y: number; scrollTop: number } | null>(null);
  const lastTrackedIndex = useRef(0);
  const playerRef = useRef(player);
  playerRef.current = player;

  const scrollToSceneIndex = useCallback(
    (index: number, behavior: ScrollBehavior = "auto") => {
      const section = sectionRefs.current[index];
      const container = containerRef.current;
      if (!section || !container) {
        logWalkthroughNavigation("scroll_failed", { index, reason: "missing_section_or_container" });
        return false;
      }
      container.scrollTo({ top: section.offsetTop, behavior });
      lastTrackedIndex.current = index;
      logWalkthroughNavigation("scroll_to_index", {
        index,
        sceneId: sceneIds[index],
        title: activeScenes[index]?.title,
        scrollTop: section.offsetTop,
        behavior,
      });
      return true;
    },
    [activeScenes, sceneIds],
  );

  const applyPlayerCommand = useCallback(
    (command: WalkthroughPlayerCommand, source = "dispatch") => {
      const prev = playerRef.current;
      const next = reducePlayerState(prev, command, activeScenes.length, sceneIds);

      const isNavigation =
        command.type === "JUMP_TO_SCENE"
        || command.type === "JUMP_TO_INDEX"
        || command.type === "NEXT_SCENE"
        || command.type === "PREVIOUS_SCENE";

      let final = next;
      if (isNavigation && next.activeIndex !== prev.activeIndex) {
        final = { ...next, playing: true, isTransitioning: true };
      }

      if (command.type === "SET_WALK_MODE") {
        onSceneEvent?.("walk_mode_toggled", { enabled: command.enabled });
      }

      setPlayer(final);

      if (isNavigation && final.activeIndex !== prev.activeIndex) {
        const idx = final.activeIndex;
        const scene = activeScenes[idx];
        logWalkthroughNavigation("player_state_updated", {
          source,
          command: command.type,
          fromIndex: prev.activeIndex,
          toIndex: idx,
          sceneId: scene?.id,
          sceneTitle: scene?.title,
          playing: final.playing,
        });
        if (final.playing) {
          logWalkthroughNavigation("target_clip_playing", {
            index: idx,
            sceneId: scene?.id,
            sceneTitle: scene?.title,
          });
        }

        requestAnimationFrame(() => {
          const scrolled = scrollToSceneIndex(idx, "auto");
          onSceneEvent?.("scene_jump", {
            sceneId: sceneIds[idx],
            index: idx,
            command: command.type,
            scrolled,
          });
          window.setTimeout(() => {
            setPlayer((p) => ({ ...p, isTransitioning: false }));
          }, 400);
        });
      }

      return final;
    },
    [activeScenes, sceneIds, onSceneEvent, scrollToSceneIndex],
  );

  const goToScene = useCallback(
    (sceneId: string) => {
      const idx = resolveSceneIndex(sceneId, sceneIds);
      logWalkthroughNavigation("goToScene_called", {
        sceneId,
        index: idx,
        found: idx >= 0,
        title: idx >= 0 ? activeScenes[idx]?.title : undefined,
      });
      if (idx < 0) return false;
      applyPlayerCommand({ type: "JUMP_TO_INDEX", index: idx }, "goToScene");
      return true;
    },
    [activeScenes, applyPlayerCommand, sceneIds],
  );

  const goToIndex = useCallback(
    (index: number) => {
      if (index < 0 || index >= activeScenes.length) return false;
      applyPlayerCommand({ type: "JUMP_TO_INDEX", index }, "goToIndex");
      return true;
    },
    [activeScenes.length, applyPlayerCommand],
  );

  useImperativeHandle(ref, () => ({ goToScene, goToIndex }), [goToScene, goToIndex]);

  const dispatch = useCallback(
    (command: WalkthroughPlayerCommand) => {
      applyPlayerCommand(command, "dispatch");
    },
    [applyPlayerCommand],
  );

  useEffect(() => {
    setVideoFit(isMobile ? "cover" : "contain");
  }, [isMobile]);

  const showFullscreenControl = !isMobile && !isTouchDevice() && supportsNativeFullscreen();

  useEffect(() => {
    const update = () => setIsPortrait(window.innerHeight >= window.innerWidth);
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  async function toggleFullscreen() {
    const el = rootRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await el.requestFullscreen();
    } catch {
      // Browser may block fullscreen without user gesture
    }
  }

  const trackScene = useCallback((index: number) => {
    const scene = activeScenes[index];
    if (scene) onSceneEvent?.("scene_started", { sceneId: scene.id, title: scene.title, index });
  }, [activeScenes, onSceneEvent]);

  useEffect(() => {
    trackScene(0);
    onSceneEvent?.("viewer_opened", { sceneCount: activeScenes.length });
    const t = setTimeout(() => setShowHint(false), 5000);
    return () => clearTimeout(t);
  }, [activeScenes.length, onSceneEvent, trackScene]);

  useEffect(() => {
    if (!externalAICommand) return;
    onAICommand?.(externalAICommand);
    if (externalAICommand.command === "OPEN_LEAD_FORM") {
      onContact?.();
      return;
    }
    if (externalAICommand.command === "PAUSE_AUTOPLAY") {
      storiesAutoplayPausedRef.current = true;
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
      dispatch({ type: "SET_PLAYING", playing: false });
      const durationMs = externalAICommand.durationMs;
      if (durationMs && durationMs > 0) {
        pauseTimerRef.current = setTimeout(() => {
          storiesAutoplayPausedRef.current = false;
          dispatch({ type: "SET_PLAYING", playing: true });
        }, durationMs);
      }
      onSceneEvent?.("stories_autoplay_paused", { durationMs });
      return;
    }
    if (externalAICommand.command === "RESUME_AUTOPLAY") {
      storiesAutoplayPausedRef.current = false;
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
      dispatch({ type: "SET_PLAYING", playing: true });
      onSceneEvent?.("stories_autoplay_resumed", {});
      return;
    }
    if (externalAICommand.command === "SHOW_ROOM_MENU") {
      setShowRoomMenu(true);
      onSceneEvent?.("room_menu_opened", {});
      return;
    }
    if (externalAICommand.command === "JUMP_TO_SCENE" && externalAICommand.sceneId) {
      logWalkthroughNavigation("external_ai_command", {
        sceneId: externalAICommand.sceneId,
        command: externalAICommand.command,
      });
      goToScene(externalAICommand.sceneId);
      return;
    }
    const mapped = mapAICommandToPlayer(externalAICommand, sceneIds);
    if (mapped) {
      dispatch(mapped);
    }
    if (externalAICommand.command === "HIGHLIGHT_ANNOTATION") {
      dispatch({ type: "HIGHLIGHT_ANNOTATION", annotationId: externalAICommand.annotationId });
    }
  }, [externalAICommand, sceneIds, dispatch, goToScene, onAICommand, onContact, onSceneEvent]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onScroll = () => {
      setShowHint(false);
      const { activeIndex, scrubProgress: progress } = computeScrollState(
        container,
        sectionRefs.current,
        activeScenes.length,
        player.walkMode,
      );

      setScrubProgress(progress);

      if (activeIndex !== lastTrackedIndex.current) {
        lastTrackedIndex.current = activeIndex;
        trackScene(activeIndex);
      }

      setPlayer((p) => (
        p.activeIndex === activeIndex && p.activeSceneId === sceneIds[activeIndex]
          ? p
          : { ...p, activeIndex, activeSceneId: sceneIds[activeIndex] ?? null }
      ));
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => container.removeEventListener("scroll", onScroll);
  }, [player.walkMode, activeScenes.length, sceneIds, trackScene]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const cmd = resolveKeyboardCommand(e.key, player.walkMode);
      if (!cmd) return;
      e.preventDefault();
      if (cmd.type === "MOVE_FORWARD") dispatch({ type: "NEXT_SCENE" });
      else if (cmd.type === "MOVE_BACKWARD") dispatch({ type: "PREVIOUS_SCENE" });
      else dispatch(cmd);
      onSceneEvent?.("keyboard_used", { key: e.key });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch, player.walkMode, onSceneEvent]);

  function isInteractiveTouchTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(
      target.closest(
        ".wt-viewer-dock, .wt-voice-mode, .wt-room-strip, .wt-site-visit-fab, .wt-voice-mode-debug, .wt-voice-mode-buyer-bar, .wt-sheet, button, a, input, select, textarea, label",
      ),
    );
  }

  function onTouchStart(e: React.TouchEvent) {
    if (!player.walkMode) return;
    if (isInteractiveTouchTarget(e.target)) return;
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      scrollTop: containerRef.current?.scrollTop ?? 0,
    };
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (!player.walkMode || !touchStart.current) return;
    if (isInteractiveTouchTarget(e.target)) {
      touchStart.current = null;
      return;
    }
    const scrollDelta = Math.abs((containerRef.current?.scrollTop ?? 0) - touchStart.current.scrollTop);
    if (scrollDelta > 24) {
      touchStart.current = null;
      return;
    }
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 48) {
      dispatch(dy < 0 ? { type: "NEXT_SCENE" } : { type: "PREVIOUS_SCENE" });
      onSceneEvent?.("swipe_used", { direction: dy < 0 ? "up" : "down" });
    } else if (Math.abs(dx) > 48) {
      dispatch(dx < 0 ? { type: "NEXT_SCENE" } : { type: "PREVIOUS_SCENE" });
      onSceneEvent?.("swipe_used", { direction: dx < 0 ? "left" : "right" });
    }
    touchStart.current = null;
  }

  function scrollToScene(index: number) {
    dispatch({ type: "JUMP_TO_INDEX", index });
  }

  function handleStoriesVideoEnded(sceneIndex: number) {
    if (!player.walkMode || !player.playing || storiesAutoplayPausedRef.current) return;
    if (sceneIndex !== player.activeIndex) return;
    if (sceneIndex < activeScenes.length - 1) {
      dispatch({ type: "NEXT_SCENE" });
      onSceneEvent?.("stories_auto_advance", { fromIndex: sceneIndex });
    }
  }

  const scrollControlled = !player.walkMode;
  const videosReady = activeScenes.filter((s) => sceneVideoUrl(s, isMobile)).length;
  const hasVideos = videosReady > 0;
  const showRotateHint = isMobile && isPortrait && videoFit === "contain";

  if (!activeScenes.length) {
    return <div className="wt-viewer-shell flex items-center justify-center bg-black text-white">No scenes published</div>;
  }

  return (
    <div
      ref={rootRef}
      className="wt-viewer-root relative w-full"
      data-mobile={isMobile ? "true" : "false"}
    >
      <div className="wt-viewer-header">
        <div className="flex min-w-0 items-center gap-2.5">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
          )}
          <div className="min-w-0">
            <p className="wt-viewer-subtitle truncate">{projectName}</p>
            <p className="wt-viewer-title truncate" style={brandColor ? { color: brandColor } : undefined}>{propertyName}</p>
          </div>
        </div>
        <p className="shrink-0 text-xs font-medium text-white/80">{player.activeIndex + 1}/{activeScenes.length}</p>
      </div>

      <div className={`wt-room-strip ${showRoomMenu ? "wt-room-strip--expanded" : ""} ${isMobile && !showRoomMenu ? "wt-room-strip--mobile-collapsed" : ""}`}>
        {showRoomMenu && (
          <div className="wt-room-menu-header">
            <p>Jump to a room</p>
            <button type="button" className="wt-room-menu-close" onClick={() => setShowRoomMenu(false)} aria-label="Close room menu">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {activeScenes.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={`wt-room-chip ${i === player.activeIndex ? "wt-room-chip--active" : ""}`}
            onClick={() => {
              scrollToScene(i);
              setShowRoomMenu(false);
            }}
          >
            {s.title}
          </button>
        ))}
      </div>

      <div
        ref={containerRef}
        className={`wt-scroll-viewer ${player.walkMode ? "wt-scroll-viewer--walk-mode" : ""}`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {activeScenes.map((scene, i) => (
          <div
            key={scene.id}
            ref={(el) => { sectionRefs.current[i] = el; }}
            className={`wt-scroll-section ${scrollControlled ? "wt-scroll-section--scrub" : ""}`}
          >
            <div className="wt-scroll-section-sticky">
              <MotionSceneViewer
                scene={toPropertyScene(scene, isMobile)}
                annotations={VIDEO_WALKTHROUGH_ANNOTATIONS_ENABLED ? toAnnotations(scene.walkthrough_annotations) : []}
                isMobile={isMobile}
                playing={player.playing && (player.walkMode ? i === player.activeIndex : false)}
                videoUrl={sceneVideoUrl(scene, isMobile)}
                posterUrl={scene.poster_url ?? scene.thumbnail_url}
                highlightedAnnotationId={VIDEO_WALKTHROUGH_ANNOTATIONS_ENABLED ? player.highlightedAnnotationId : null}
                scrubProgress={scrollControlled && i === player.activeIndex ? scrubProgress : 0}
                scrollControlled={scrollControlled}
                storiesMode={player.walkMode && hasVideos}
                videoFit={videoFit}
                showCaption={false}
                showAnnotations={VIDEO_WALKTHROUGH_ANNOTATIONS_ENABLED}
                onVideoEnded={() => handleStoriesVideoEnded(i)}
                onAnnotationClick={VIDEO_WALKTHROUGH_ANNOTATIONS_ENABLED ? (ann) => {
                  dispatch({ type: "HIGHLIGHT_ANNOTATION", annotationId: ann.id });
                  onSceneEvent?.("annotation_clicked", { sceneId: scene.id, annotationId: ann.id, title: ann.title });
                  const wtAnn = scene.walkthrough_annotations?.find((a) => a.id === ann.id);
                  if (wtAnn) onAnnotationClick?.(wtAnn);
                } : undefined}
              />
              <div className="wt-scroll-section-caption">
                <h2>{scene.title}</h2>
                {scene.caption && <p>{scene.caption}</p>}
              </div>
            </div>
          </div>
        ))}
        <div className={`wt-scroll-section ${scrollControlled ? "wt-scroll-section--scrub" : ""} flex items-center justify-center bg-zinc-900`}>
          <div className="wt-scroll-section-sticky flex items-center justify-center px-6">
            <div className="text-center text-white">
              <h2 className="text-xl font-semibold sm:text-2xl">Interested in this property?</h2>
              <p className="mt-2 text-sm text-white/70">Contact our sales team to schedule a visit.</p>
              <button type="button" className="wt-viewer-btn wt-viewer-btn--primary mt-6 px-8" onClick={() => onContact?.() ?? onSceneEvent?.("contact_clicked", {})}>
                Contact sales
              </button>
            </div>
          </div>
        </div>
      </div>

      {showRotateHint && (
        <div className="wt-rotate-hint">
          <Smartphone className="h-4 w-4 rotate-90" />
          <span>Rotate for a wider view, or switch to Fill Screen below</span>
        </div>
      )}

      {showHint && player.activeIndex === 0 && (
        <div className="wt-scroll-hint">
          <ChevronDown className="h-5 w-5" />
          <span>
            {isMobile
              ? (player.walkMode ? "Videos play room-by-room · swipe to jump" : "Scroll to scrub each room video")
              : (player.walkMode ? "Story tour playing — say a room name to the AI guide" : hasVideos ? "Scroll to scrub each room video" : "Scroll to walk through the property")}
          </span>
        </div>
      )}

      <div className="wt-viewer-dock">
        {!isMobile && (
          <div className="wt-viewer-fit-row">
            <button
              type="button"
              className={`wt-viewer-fit-btn ${videoFit === "contain" ? "wt-viewer-fit-btn--active" : ""}`}
              onClick={() => {
                setVideoFit("contain");
                onSceneEvent?.("video_fit_changed", { mode: "contain" });
              }}
            >
              Fit to Screen
            </button>
            <button
              type="button"
              className={`wt-viewer-fit-btn ${videoFit === "cover" ? "wt-viewer-fit-btn--active" : ""}`}
              onClick={() => {
                setVideoFit("cover");
                onSceneEvent?.("video_fit_changed", { mode: "cover" });
              }}
            >
              Fill Screen
            </button>
            {showFullscreenControl && (
              <button type="button" className="wt-viewer-fit-btn" onClick={toggleFullscreen} aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
                {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                {isFullscreen ? "Exit" : "Fullscreen"}
              </button>
            )}
          </div>
        )}
        <div className="wt-viewer-progress">
          {activeScenes.map((s, i) => (
            <button key={s.id} type="button" className="wt-viewer-dot" data-active={i === player.activeIndex} onClick={() => scrollToScene(i)} aria-label={`Go to ${s.title}`} />
          ))}
        </div>
        <div className="wt-viewer-controls">
          {isMobile && (
            <button
              type="button"
              className="wt-viewer-btn"
              onClick={() => {
                const next = videoFit === "cover" ? "contain" : "cover";
                setVideoFit(next);
                onSceneEvent?.("video_fit_changed", { mode: next });
              }}
              aria-label={videoFit === "cover" ? "Switch to fit screen" : "Switch to fill screen"}
              title={videoFit === "cover" ? "Fit to screen" : "Fill screen"}
            >
              {videoFit === "cover" ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </button>
          )}
          <button
            type="button"
            className={`wt-viewer-btn ${player.walkMode ? "wt-viewer-btn--primary" : ""}`}
            onClick={() => dispatch({ type: "SET_WALK_MODE", enabled: !player.walkMode })}
            aria-label="Toggle walk mode"
            title={player.walkMode ? "Walk mode on" : "Walk mode off — scroll scrubs video"}
          >
            <Footprints className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="wt-viewer-btn"
            onClick={() => setShowRoomMenu((open) => !open)}
            aria-label="Room menu"
          >
            <LayoutGrid className="h-5 w-5" />
          </button>
          {player.walkMode && (
            <button type="button" className="wt-viewer-btn" onClick={() => dispatch({ type: "SET_PLAYING", playing: !player.playing })} aria-label={player.playing ? "Pause" : "Play"}>
              {player.playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
          )}
          {onAskAI && (
            <button type="button" className="wt-viewer-btn wt-viewer-btn--primary" onClick={onAskAI} aria-label="Ask AI">
              <MessageSquare className="h-5 w-5" />
            </button>
          )}
          {onContact && (
            <button type="button" className="wt-viewer-btn" onClick={onContact} aria-label="Contact sales">
              <Phone className="h-5 w-5" />
            </button>
          )}
          <button type="button" className="wt-viewer-btn" onClick={() => dispatch({ type: "NEXT_SCENE" })} aria-label="Next scene">
            <ChevronDown className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-30 h-0.5 bg-white/15">
        <div
          className="h-full bg-white transition-[width] duration-75"
          style={{ width: `${((player.activeIndex + scrubProgress) / Math.max(activeScenes.length, 1)) * 100}%` }}
        />
      </div>
    </div>
  );
});

ScrollWalkthroughShell.displayName = "ScrollWalkthroughShell";
