export const MOBILE_BREAKPOINT = 768;

/** Synchronous mobile check — defaults to true during SSR for phone-first rendering. */
export function getIsMobileViewport(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches;
}

export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
}

export function supportsNativeFullscreen(): boolean {
  if (typeof document === "undefined") return false;
  return typeof document.documentElement.requestFullscreen === "function";
}
