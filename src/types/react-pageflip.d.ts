declare module "react-pageflip" {
  import type { ReactNode, Ref } from "react";

  export interface FlipEvent {
    data: number;
    object: unknown;
  }

  export interface HTMLFlipBookProps {
    width: number;
    height: number;
    size?: "fixed" | "stretch";
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
    showCover?: boolean;
    drawShadow?: boolean;
    flippingTime?: number;
    maxShadowOpacity?: number;
    mobileScrollSupport?: boolean;
    className?: string;
    onFlip?: (e: FlipEvent) => void;
    children?: ReactNode;
    ref?: Ref<{ pageFlip: () => { flipNext: () => void; flipPrev: () => void; getCurrentPageIndex: () => number } }>;
  }

  export default function HTMLFlipBook(props: HTMLFlipBookProps): JSX.Element;
}
