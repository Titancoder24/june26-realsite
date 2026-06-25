"use client";

import { Camera, Smartphone, Footprints, Box, Sparkles, Clapperboard, ArrowRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExperienceType } from "@/types/domain";
import "@/styles/scene-studio.css";

type ExperienceOption = {
  type: ExperienceType;
  title: string;
  description: string;
  badge: string;
  badgeVariant?: "default" | "new" | "coming-soon";
  icon: typeof Camera;
  steps: string;
  nextLabel: string;
  comingSoon?: boolean;
};

const capture360Options: ExperienceOption[] = [
  {
    type: "cinematic_walkthrough",
    title: "Property Walkthrough",
    description: "Upload normal property images and generate an AI-guided walkthrough with Veo motion clips and property AI chat.",
    badge: "AI Video",
    badgeVariant: "new",
    icon: Footprints,
    steps: "Upload → plan → motion → publish",
    nextLabel: "Start walkthrough",
  },
  {
    type: "mobile_360_capture",
    title: "Mobile 360° Capture",
    description: "Guided room-by-room capture with your phone. No 360 camera required.",
    badge: "Coming Soon",
    badgeVariant: "coming-soon",
    icon: Smartphone,
    steps: "Rooms → capture → connect → publish",
    nextLabel: "Coming Soon",
    comingSoon: true,
  },
  {
    type: "360_realistic",
    title: "360° Panorama Tour",
    description: "Upload equirectangular 360° panoramas and connect rooms with spatial annotations.",
    badge: "Coming Soon",
    badgeVariant: "coming-soon",
    icon: Camera,
    steps: "Panoramas → rooms → hotspots → publish",
    nextLabel: "Coming Soon",
    comingSoon: true,
  },
];

const spatialOptions: ExperienceOption[] = [
  {
    type: "worldlabs_splat",
    title: "3D Walkthrough",
    description: "Generate an explorable 3D world from multiple listing photos via World Labs.",
    badge: "Coming Soon",
    badgeVariant: "coming-soon",
    icon: Box,
    steps: "Media → generate → review → publish",
    nextLabel: "Coming Soon",
    comingSoon: true,
  },
  {
    type: "immersive_world",
    title: "Immersive World",
    description: "Single-photo to explorable 3D environment. Fast Echo generation pipeline.",
    badge: "Coming Soon",
    badgeVariant: "coming-soon",
    icon: Sparkles,
    steps: "Photo → 3D world → annotate → publish",
    nextLabel: "Coming Soon",
    comingSoon: true,
  },
];

const sceneIntelligenceOption: ExperienceOption = {
  type: "scene_intelligence",
  title: "Scene Intelligence Builder",
  description: "Turn listing photos into cinematic motion scenes with object pins, AI knowledge, and an interactive buyer viewer.",
  badge: "Coming Soon",
  badgeVariant: "coming-soon",
  icon: Clapperboard,
  steps: "Images → edit → motion → pins → publish",
  nextLabel: "Coming Soon",
  comingSoon: true,
};

function PickerCard({
  opt,
  active,
  disabled,
  loading,
  onContinue,
}: {
  opt: ExperienceOption;
  active: boolean;
  disabled?: boolean;
  loading?: boolean;
  onContinue: (type: ExperienceType) => void;
}) {
  const Icon = opt.icon;
  const featured = opt.type === "cinematic_walkthrough";
  const isComingSoon = opt.comingSoon;

  return (
    <div
      className={cn(
        "picker-card group",
        featured && "picker-card-featured",
        isComingSoon && "opacity-75",
      )}
      data-active={active}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="picker-icon">
          <Icon className="h-5 w-5" />
        </div>
        <span
          className={cn(
            "picker-badge",
            opt.badgeVariant === "new" && "picker-badge-new",
            opt.badgeVariant === "coming-soon" && "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
          )}
        >
          {opt.badgeVariant === "coming-soon" && <Clock className="mr-1 inline h-3 w-3" />}
          {opt.badge}
        </span>
      </div>
      <p className="picker-title">{opt.title}</p>
      <p className="picker-desc">{opt.description}</p>
      <p className="picker-steps">{opt.steps}</p>

      <button
        type="button"
        className="picker-next mt-4 flex w-full items-center justify-center gap-2"
        disabled={disabled || loading || isComingSoon}
        onClick={() => !isComingSoon && onContinue(opt.type)}
      >
        {isComingSoon ? "Coming Soon" : loading && active ? "Opening…" : opt.nextLabel}
        {!isComingSoon && <ArrowRight className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function ExperienceTypeSelector({
  selected,
  onContinue,
  continuing,
  canContinue,
}: {
  selected?: ExperienceType;
  onContinue: (type: ExperienceType) => void;
  continuing?: boolean;
  canContinue?: boolean;
}) {
  const disabled = !canContinue;

  return (
    <div className="experience-picker space-y-6">
      <div>
        <p className="picker-section-label">360° Capture</p>
        <p className="mb-3 text-sm text-muted-foreground">
          Property Walkthrough for AI video clips, or panorama capture when ready.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {capture360Options.map((opt) => (
            <PickerCard
              key={opt.type}
              opt={opt}
              active={selected === opt.type}
              disabled={disabled}
              loading={continuing && selected === opt.type}
              onContinue={onContinue}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="picker-section-label">3D spatial engines</p>
        <div className="grid gap-3 md:grid-cols-2">
          {spatialOptions.map((opt) => (
            <PickerCard
              key={opt.type}
              opt={opt}
              active={selected === opt.type}
              disabled={disabled}
              loading={continuing && selected === opt.type}
              onContinue={onContinue}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="picker-section-label">Scene studio (advanced)</p>
        <PickerCard
          opt={sceneIntelligenceOption}
          active={selected === sceneIntelligenceOption.type}
          disabled={disabled}
          loading={continuing && selected === sceneIntelligenceOption.type}
          onContinue={onContinue}
        />
      </div>
    </div>
  );
}
