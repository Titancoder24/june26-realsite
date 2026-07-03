export type DeviceInfo = {
  device: "mobile" | "tablet" | "desktop";
  browser: string;
  os: string;
  screenWidth: number;
  screenHeight: number;
  language: string;
  timezone: string;
};

export function parseDeviceFromUserAgent(
  ua: string,
  screenWidth = 0,
  screenHeight = 0,
  language = "en",
  timezone = "UTC",
): DeviceInfo {
  const lower = ua.toLowerCase();
  let device: DeviceInfo["device"] = "desktop";
  if (/ipad|tablet|playbook|silk/.test(lower) || (screenWidth >= 768 && screenWidth < 1024 && /android/.test(lower))) {
    device = "tablet";
  } else if (/mobile|iphone|ipod|android|blackberry|iemobile|opera mini/.test(lower) || screenWidth < 768) {
    device = "mobile";
  }

  let browser = "Unknown";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/chrome/i.test(ua) && !/edg/i.test(ua)) browser = "Chrome";
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = "Safari";
  else if (/firefox/i.test(ua)) browser = "Firefox";

  let os = "Unknown";
  if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  else if (/mac os x/i.test(ua)) os = "macOS";
  else if (/windows/i.test(ua)) os = "Windows";
  else if (/linux/i.test(ua)) os = "Linux";

  return { device, browser, os, screenWidth, screenHeight, language, timezone };
}

export function formatDeviceLabel(info: Pick<DeviceInfo, "device" | "browser" | "os">): string {
  const parts = [
    info.device === "mobile" ? "Mobile" : info.device === "tablet" ? "Tablet" : "Desktop",
    info.browser,
    info.os,
  ].filter(Boolean);
  return parts.join(" / ");
}
