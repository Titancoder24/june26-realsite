import "pannellum/build/pannellum.css";
import type { PannellumConfig, PannellumViewer } from "@/types/pannellum";

let loadPromise: Promise<NonNullable<typeof window.pannellum>> | null = null;

/** Load Pannellum once (browser-only). https://pannellum.org/documentation/overview/ */
export async function loadPannellum() {
  if (typeof window === "undefined") throw new Error("Pannellum requires browser");
  if (window.pannellum) return window.pannellum;
  if (!loadPromise) {
    loadPromise = import("pannellum/build/pannellum.js").then(() => {
      if (!window.pannellum) throw new Error("Pannellum failed to initialize");
      return window.pannellum;
    });
  }
  return loadPromise;
}

export async function createPannellumViewer(
  container: HTMLElement,
  config: PannellumConfig,
): Promise<PannellumViewer> {
  const pannellum = await loadPannellum();
  return pannellum.viewer(container, { autoLoad: true, ...config });
}
