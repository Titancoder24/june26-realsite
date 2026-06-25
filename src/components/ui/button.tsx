import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/** Shared raised / pressed tactile interaction for all button variants */
const tactileInteraction =
  "relative border transition-[transform,box-shadow,background-color] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] select-none hover:-translate-y-px active:translate-y-px disabled:translate-y-0 disabled:pointer-events-none disabled:opacity-50"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-[550] tracking-[-0.01em] whitespace-nowrap outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: cn(
          tactileInteraction,
          "border-primary bg-primary text-primary-foreground",
          "shadow-[inset_0_1px_0_rgb(255,255,255,0.14),0_1px_2px_color-mix(in_srgb,var(--primary)_28%,transparent),0_3px_10px_-2px_color-mix(in_srgb,var(--primary)_32%,transparent)]",
          "hover:bg-[var(--primary-hover)] hover:border-[var(--primary-hover)]",
          "hover:shadow-[inset_0_1px_0_rgb(255,255,255,0.1),0_2px_6px_color-mix(in_srgb,var(--primary)_30%,transparent),0_6px_16px_-4px_color-mix(in_srgb,var(--primary)_36%,transparent)]",
          "active:bg-[var(--primary-active)] active:border-[var(--primary-active)]",
          "active:shadow-[inset_0_2px_4px_rgb(0,0,0,0.18),0_1px_2px_color-mix(in_srgb,var(--primary)_20%,transparent)]"
        ),
        destructive: cn(
          tactileInteraction,
          "border-destructive/80 bg-gradient-to-b from-destructive/95 to-destructive text-white",
          "shadow-[0_1px_0_0_rgba(255,255,255,0.16)_inset,0_1px_2px_rgba(0,0,0,0.12),0_3px_6px_rgba(220,38,38,0.28)]",
          "hover:from-destructive hover:to-destructive/88 hover:shadow-[0_1px_0_0_rgba(255,255,255,0.1)_inset,0_0_1px_rgba(0,0,0,0.08),inset_0_2px_5px_rgba(0,0,0,0.16)]",
          "active:shadow-[inset_0_3px_8px_rgba(0,0,0,0.32),0_0_0_1px_rgba(0,0,0,0.08)]",
          "focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40"
        ),
        outline: cn(
          tactileInteraction,
          "border-border bg-background text-foreground",
          "shadow-[inset_0_1px_0_rgb(255,255,255,0.8),0_1px_2px_rgb(17_24_39/0.04)]",
          "hover:bg-muted hover:border-border",
          "hover:shadow-[inset_0_1px_0_rgb(255,255,255,0.7),0_2px_6px_rgb(17_24_39/0.06)]",
          "active:bg-muted/80 active:shadow-[inset_0_2px_3px_rgb(17_24_39/0.06)]"
        ),
        secondary: cn(
          tactileInteraction,
          "border-border bg-secondary text-secondary-foreground",
          "shadow-[inset_0_1px_0_rgb(255,255,255,0.7),0_1px_2px_rgb(17_24_39/0.04)]",
          "hover:bg-muted",
          "hover:shadow-[inset_0_1px_0_rgb(255,255,255,0.6),0_2px_6px_rgb(17_24_39/0.06)]",
          "active:bg-muted/80 active:shadow-[inset_0_2px_3px_rgb(17_24_39/0.06)]"
        ),
        ghost: cn(
          tactileInteraction,
          "border border-transparent bg-transparent text-foreground shadow-none",
          "hover:bg-muted hover:border-transparent",
          "active:bg-muted/80"
        ),
        link: "text-primary underline-offset-4 hover:underline",
        premium: cn(
          tactileInteraction,
          "border-zinc-800/90 bg-gradient-to-b from-zinc-700 to-zinc-900 text-white",
          "shadow-[0_1px_0_0_rgba(255,255,255,0.14)_inset,0_1px_2px_rgba(0,0,0,0.18),0_3px_8px_rgba(0,0,0,0.22)]",
          "hover:from-zinc-700 hover:to-zinc-950 hover:shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset,0_0_1px_rgba(0,0,0,0.1),inset_0_2px_5px_rgba(0,0,0,0.22)]",
          "active:shadow-[inset_0_3px_8px_rgba(0,0,0,0.45),0_0_0_1px_rgba(0,0,0,0.12)]",
          "dark:border-zinc-600/80 dark:from-zinc-600 dark:to-zinc-900"
        ),
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
