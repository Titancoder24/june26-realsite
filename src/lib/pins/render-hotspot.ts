import { getPin } from "@/lib/pins/pin-library";
import type { SceneAnnotation } from "@/types/annotations";
import type { PannellumHotSpot } from "@/types/pannellum";

export function pinCssClass(typeId: string): string {
  const safe = typeId.replace(/[^a-z0-9_-]/gi, "_");
  return `pnlm-pin pnlm-pin-${safe}`;
}

export function buildAnnotationHotspots(
  annotations: SceneAnnotation[],
  handlers: {
    onClick?: (a: SceneAnnotation) => void;
    editMode?: boolean;
    selectedId?: string | null;
  } = {},
): PannellumHotSpot[] {
  return annotations.map((a) => {
    const pin = getPin(a.type);
    const isSelected = handlers.selectedId === a.id;
    return {
      id: a.id,
      pitch: a.pitch,
      yaw: a.yaw,
      cssClass: `${pinCssClass(a.type)}${isSelected ? " pnlm-pin-selected" : ""}${handlers.editMode ? " pnlm-pin-editable" : ""}`,
      createTooltipFunc: (div) => {
        div.classList.add("pnlm-pointer");
        div.style.setProperty("--pin-color", pin.color);
        const icon = document.createElement("span");
        icon.className = "pnlm-pin-icon";
        icon.textContent = pin.icon;
        icon.setAttribute("aria-hidden", "true");
        div.appendChild(icon);
        if (a.label) {
          const label = document.createElement("span");
          label.className = "pnlm-hotspot-label";
          label.textContent = a.label;
          div.appendChild(label);
        }
      },
      clickHandlerFunc: () => handlers.onClick?.(a),
    };
  });
}
