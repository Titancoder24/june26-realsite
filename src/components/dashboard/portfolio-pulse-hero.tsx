"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DASHBOARD_HERO_IMAGE } from "@/lib/marketing-images";
import { Camera, Plus } from "lucide-react";

export function PortfolioPulseHero() {
  return (
    <div className="portfolio-hero-media relative h-[min(380px,max(240px,34svh))] w-full sm:h-[min(440px,max(300px,36svh))] md:h-[min(480px,40svh)] lg:h-[min(520px,42svh)] xl:h-[min(560px,44svh)]">
      <Image
        src={DASHBOARD_HERO_IMAGE}
        alt="Premium residential development at golden hour"
        fill
        priority
        sizes="(min-width: 1536px) 1200px, (min-width: 1024px) 90vw, 100vw"
        className="object-cover object-[center_38%] sm:object-[center_42%] md:object-center"
      />

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-slate-950/22 to-transparent sm:h-32 sm:from-slate-950/18"
        aria-hidden
      />

      <div className="portfolio-hero-content relative z-10 flex h-full min-w-0 flex-col justify-end px-4 pb-8 pt-5 sm:px-8 sm:pb-12 sm:pt-6 md:px-10 md:pb-14 lg:pb-16">
        <p className="text-[0.75rem] font-medium tracking-[0.06em] text-white/85 uppercase sm:text-[0.8125rem]">
          Welcome back
        </p>
        <h1 className="dashboard-title mt-1.5 text-white sm:mt-2">
          Portfolio Pulse
        </h1>
        <p className="type-body mt-2 max-w-xl text-sm text-white/90 sm:mt-2.5 sm:text-base">
          AI-powered Property Intelligence for Indian real-estate developers
        </p>

        <div className="portfolio-hero-actions mt-5 flex w-full flex-col gap-2.5 sm:mt-8 sm:w-auto sm:flex-row sm:flex-wrap sm:gap-3">
          <Button
            variant="secondary"
            className="h-11 min-h-11 w-full border-white/20 bg-white/95 text-slate-900 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-white hover:shadow-md active:translate-y-0 sm:w-auto"
            asChild
          >
            <Link href="/dashboard/experiences/new">
              <Camera className="mr-2 h-4 w-4" />
              Launch 360° Capture
            </Link>
          </Button>
          <Button
            className="h-11 min-h-11 w-full shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 sm:w-auto"
            asChild
          >
            <Link href="/dashboard/projects/new">
              <Plus className="mr-2 h-4 w-4" />
              New Development
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
