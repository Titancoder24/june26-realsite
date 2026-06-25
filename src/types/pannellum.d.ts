export interface PannellumHotSpot {
  id?: string;
  pitch: number;
  yaw: number;
  type?: "info" | "scene" | "custom";
  text?: string;
  sceneId?: string;
  cssClass?: string;
  createTooltipFunc?: (hotSpotDiv: HTMLElement, args?: unknown) => void;
  createTooltipArgs?: unknown;
  clickHandlerFunc?: (event: MouseEvent, args?: unknown) => void;
  clickHandlerArgs?: unknown;
}

export interface PannellumConfig {
  type?: "equirectangular" | "cubemap" | "multires";
  panorama: string;
  autoLoad?: boolean;
  yaw?: number;
  pitch?: number;
  hfov?: number;
  minHfov?: number;
  maxHfov?: number;
  haov?: number;
  vaov?: number;
  vOffset?: number;
  hotSpots?: PannellumHotSpot[];
  hotSpotDebug?: boolean;
  showZoomCtrl?: boolean;
  showFullscreenCtrl?: boolean;
  keyboardZoom?: boolean;
  mouseZoom?: boolean | "fullscreenonly";
  friction?: number;
  backgroundColor?: [number, number, number];
  sceneFadeDuration?: number;
}

export interface PannellumViewer {
  destroy: () => void;
  getYaw: () => number;
  getPitch: () => number;
  getHfov: () => number;
  setYaw: (yaw: number) => void;
  setPitch: (pitch: number) => void;
  setHfov: (hfov: number) => void;
  on: (event: string, handler: (...args: unknown[]) => void) => PannellumViewer;
  off: (event: string, handler: (...args: unknown[]) => void) => PannellumViewer;
  addHotSpot: (hotSpot: PannellumHotSpot, sceneId?: string) => void;
  removeHotSpot: (id: string, sceneId?: string) => boolean;
  mouseEventToCoords: (event: MouseEvent) => { yaw: number; pitch: number };
}

declare global {
  interface Window {
    pannellum?: {
      viewer: (container: string | HTMLElement, config: PannellumConfig) => PannellumViewer;
    };
  }
}

export {};
