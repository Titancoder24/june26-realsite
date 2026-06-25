"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";

type CursorMode = "default" | "crosshair" | "text";

const CURSOR_ROOT_ID = "figma-cursor-root";

const INTERACTIVE_SELECTOR =
  "[data-cursor='crosshair'], button, a, [role='button'], label, input, textarea, select, [contenteditable='true'], .studio-clickable, .picker-card, .picker-next, [data-sidebar='menu-button'], [data-slot='sidebar-menu-button']";

const SPARKLE_COLORS = ["#ffffff", "#ffd700", "#0d99ff", "#c4b5fd", "#f9a8d4"];

function resolveMode(target: EventTarget | null): CursorMode {
  if (!(target instanceof Element)) return "default";
  if (target.closest("[data-cursor='crosshair']")) return "crosshair";
  if (target.closest("input, textarea, select, [contenteditable='true']")) return "text";
  return "default";
}

function isInteractive(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(INTERACTIVE_SELECTOR));
}

function ensureCursorRoot(): HTMLElement {
  let root = document.getElementById(CURSOR_ROOT_ID);
  if (!root) {
    root = document.createElement("div");
    root.id = CURSOR_ROOT_ID;
    document.documentElement.appendChild(root);
  } else {
    document.documentElement.appendChild(root);
  }
  return root;
}

function spawnClickSparkles(x: number, y: number, root: HTMLElement) {
  const count = 10;
  for (let i = 0; i < count; i++) {
    const sparkle = document.createElement("span");
    sparkle.className = "figma-cursor-sparkle";
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
    const dist = 14 + Math.random() * 22;
    sparkle.style.left = `${x}px`;
    sparkle.style.top = `${y}px`;
    sparkle.style.setProperty("--tx", `${Math.cos(angle) * dist}px`);
    sparkle.style.setProperty("--ty", `${Math.sin(angle) * dist}px`);
    sparkle.style.setProperty("--rot", `${Math.random() * 180}deg`);
    sparkle.style.background = SPARKLE_COLORS[i % SPARKLE_COLORS.length];
    sparkle.style.animationDelay = `${Math.random() * 60}ms`;
    root.appendChild(sparkle);
    sparkle.addEventListener("animationend", () => sparkle.remove(), { once: true });
  }

  const flash = document.createElement("span");
  flash.className = "figma-cursor-click-flash";
  flash.style.left = `${x}px`;
  flash.style.top = `${y}px`;
  root.appendChild(flash);
  flash.addEventListener("animationend", () => flash.remove(), { once: true });
}

/**
 * Single arrow cursor everywhere — scales up over interactive targets.
 * Click sparkles fire on buttons, links, and sidebar items.
 */
export function FigmaCursor() {
  const pathname = usePathname();
  const disabled =
    pathname?.startsWith("/walkthrough/") || pathname?.startsWith("/image-walkthrough/");

  const [root, setRoot] = useState<HTMLElement | null>(null);
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (disabled) {
      document.body.classList.remove("figma-cursor-active");
      setRoot(null);
      return;
    }
    if (window.matchMedia("(pointer: coarse)").matches) return;
    setRoot(ensureCursorRoot());
  }, [disabled]);

  useEffect(() => {
    if (disabled || !root) return;
    const layer = layerRef.current;
    if (!layer) return;

    document.body.classList.add("figma-cursor-active");

    const onMove = (e: PointerEvent) => {
      layer.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      if (layer.style.opacity !== "1") layer.style.opacity = "1";
    };

    const onOver = (e: PointerEvent) => {
      const mode = resolveMode(e.target);
      if (layer.dataset.mode !== mode) layer.dataset.mode = mode;

      const interactive = isInteractive(e.target) ? "true" : "false";
      if (layer.dataset.interactive !== interactive) layer.dataset.interactive = interactive;
    };

    const onLeave = () => {
      layer.style.opacity = "0";
    };

    const onDown = (e: PointerEvent) => {
      layer.classList.add("figma-cursor-down");
      if (isInteractive(e.target)) spawnClickSparkles(e.clientX, e.clientY, root);
    };

    const onUp = () => layer.classList.remove("figma-cursor-down");

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerover", onOver, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);

    return () => {
      document.body.classList.remove("figma-cursor-active");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerover", onOver);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [disabled, root]);

  if (disabled || !root) return null;

  return createPortal(
    <div ref={layerRef} className="figma-cursor-layer" data-mode="default" data-interactive="false" style={{ opacity: 0 }}>
      <svg className="figma-cursor-svg" data-cursor-mode="default" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M5 3L5 25L12 18L24 18Z"
          fill="#0a0a0a"
          stroke="#ffffff"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
      </svg>

      <svg className="figma-cursor-svg" data-cursor-mode="crosshair" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="3" fill="#0d99ff" stroke="#fff" strokeWidth="2" />
        <line x1="16" y1="4" x2="16" y2="11" stroke="#18181b" strokeWidth="2" strokeLinecap="round" />
        <line x1="16" y1="21" x2="16" y2="28" stroke="#18181b" strokeWidth="2" strokeLinecap="round" />
        <line x1="4" y1="16" x2="11" y2="16" stroke="#18181b" strokeWidth="2" strokeLinecap="round" />
        <line x1="21" y1="16" x2="28" y2="16" stroke="#18181b" strokeWidth="2" strokeLinecap="round" />
      </svg>

      <svg className="figma-cursor-svg" data-cursor-mode="text" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 3v18M8 3h8M8 21h8" stroke="#18181b" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 3v18M8 3h8M8 21h8" stroke="#fff" strokeWidth="0.75" strokeLinecap="round" />
      </svg>
    </div>,
    root,
  );
}
