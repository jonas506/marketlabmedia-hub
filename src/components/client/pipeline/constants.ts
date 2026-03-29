import confetti from "canvas-confetti";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import type { PipelineConfig, PriorityOption } from "./types";

export const relativeTime = (dateStr: string | null | undefined) => {
  if (!dateStr) return null;
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "gerade eben";
  if (mins < 60) return `vor ${mins} Min.`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "gestern";
  if (days < 7) return `vor ${days} Tagen`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `vor ${weeks} Wo.`;
  return format(new Date(dateStr), "dd. MMM", { locale: de });
};

export const PRIORITY_OPTIONS: PriorityOption[] = [
  { value: "low", label: "Niedrig", color: "text-muted-foreground", bg: "bg-muted/60" },
  { value: "normal", label: "Normal", color: "text-foreground", bg: "bg-muted/60" },
  { value: "high", label: "Hoch", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/10" },
  { value: "urgent", label: "Dringend", color: "text-destructive", bg: "bg-destructive/10" },
];

export const PIPELINE_CONFIG: Record<string, PipelineConfig> = {
  reel: {
    label: "Reels",
    emoji: "🎬",
    phases: [
      { key: "script", label: "Skript", emoji: "📝" },
      { key: "filmed", label: "Gedreht", emoji: "📹" },
      { key: "editing", label: "Im Schnitt", emoji: "✂️" },
      { key: "review", label: "Zur Freigabe", emoji: "👁️" },
      { key: "feedback", label: "Feedback", emoji: "💬" },
      { key: "approved", label: "Freigegeben", emoji: "✅" },
      { key: "handed_over", label: "Übergeben", emoji: "🚀" },
    ],
    addLabel: "+ Reel",
  },
  carousel: {
    label: "Karussells",
    emoji: "🖼️",
    phases: [
      { key: "script", label: "Skript", emoji: "📝" },
      { key: "review", label: "Zur Freigabe", emoji: "👁️" },
      { key: "feedback", label: "Feedback", emoji: "💬" },
      { key: "approved", label: "Freigegeben", emoji: "✅" },
      { key: "handed_over", label: "Übergeben", emoji: "🚀" },
    ],
    addLabel: "+ Karussell",
  },
  story: {
    label: "Story Ads",
    emoji: "📱",
    phases: [
      { key: "script", label: "Skript", emoji: "📝" },
      { key: "review", label: "Zur Freigabe", emoji: "👁️" },
      { key: "feedback", label: "Feedback", emoji: "💬" },
      { key: "approved", label: "Freigegeben", emoji: "✅" },
      { key: "handed_over", label: "Übergeben", emoji: "🚀" },
    ],
    addLabel: "+ Story Ad",
  ad: {
    label: "Ads",
    emoji: "📢",
    phases: [
      { key: "filmed", label: "Gedreht", emoji: "📹" },
      { key: "editing", label: "Im Schnitt", emoji: "✂️" },
      { key: "review", label: "Zur Freigabe", emoji: "👁️" },
      { key: "feedback", label: "Feedback", emoji: "💬" },
      { key: "approved", label: "Freigegeben", emoji: "✅" },
      { key: "handed_over", label: "Übergeben", emoji: "🚀" },
    ],
    addLabel: "+ Ad",
  },
  youtube_longform: {
    label: "YouTube",
    emoji: "🎥",
    phases: [
      { key: "filmed", label: "Gedreht", emoji: "📹" },
      { key: "editing", label: "Im Schnitt", emoji: "✂️" },
      { key: "review", label: "Zur Freigabe", emoji: "👁️" },
      { key: "feedback", label: "Feedback", emoji: "💬" },
      { key: "approved", label: "Freigegeben", emoji: "✅" },
      { key: "handed_over", label: "Übergeben", emoji: "🚀" },
    ],
    addLabel: "+ YouTube Video",
  },
};

export const PRIORITY_WEIGHT: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export const fireConfetti = () => {
  confetti({
    particleCount: 80,
    spread: 60,
    origin: { y: 0.7 },
    colors: ["#0083F7", "#21089B", "#FAFBFF", "#10B981"],
  });
};

export const fireSmallCelebration = () => {
  confetti({
    particleCount: 30,
    spread: 40,
    origin: { y: 0.8, x: 0.7 },
    colors: ["#0083F7", "#21089B"],
    gravity: 1.2,
  });
};

export const TAG_COLORS = [
  "bg-primary/15 text-primary",
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400",
];

export const hashTag = (s: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0) % TAG_COLORS.length;
};
