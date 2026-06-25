import type { WalkthroughMotionType } from "@/types/cinematic-walkthrough";

const MOTION_PHRASES: Record<WalkthroughMotionType, string> = {
  push_in: "Slow forward dolly push-in with subtle parallax",
  pull_out: "Slow pull-out reveal showing the full space",
  truck_left: "Smooth truck left across the room with subtle parallax",
  truck_right: "Smooth truck right across the room with subtle parallax",
  pedestal_up: "Gentle pedestal up with stable horizon",
  pedestal_down: "Gentle pedestal down with stable horizon",
  slow_rotate: "Very slow premium rotate with minimal distortion",
  cinematic_zoom: "Cinematic slow zoom with depth parallax",
  static_premium: "Minimal premium hold with barely-there ambient motion",
  depth_parallax: "Soft depth parallax drift through the scene",
};

export function veoPromptForMotion(roomType: string, title: string, motionType: WalkthroughMotionType): string {
  const motion = MOTION_PHRASES[motionType] ?? MOTION_PHRASES.push_in;
  return `Create a premium real-estate walkthrough motion from this ${roomType} image (${title}). ${motion}. Preserve exact room layout, architecture, furniture, walls, flooring, windows, lighting, and proportions. Do not add people. Do not change architecture. Do not distort objects. Do not add fake furniture.`;
}
