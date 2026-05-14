export type FunnelStage = "tofu" | "mofu" | "bofu";

export const FUNNEL_STAGES: { key: FunnelStage; label: string; subtitle: string; dotClass: string; chipClass: string; ringClass: string }[] = [
  {
    key: "tofu",
    label: "TOFU",
    subtitle: "Reichweite",
    dotClass: "bg-blue-500",
    chipClass: "bg-blue-500/15 text-blue-500 border-blue-500/30",
    ringClass: "ring-blue-500/40",
  },
  {
    key: "mofu",
    label: "MOFU",
    subtitle: "Vertrauen",
    dotClass: "bg-violet-500",
    chipClass: "bg-violet-500/15 text-violet-500 border-violet-500/30",
    ringClass: "ring-violet-500/40",
  },
  {
    key: "bofu",
    label: "BOFU",
    subtitle: "Conversion",
    dotClass: "bg-emerald-500",
    chipClass: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
    ringClass: "ring-emerald-500/40",
  },
];

export const stageMeta = (s: string) =>
  FUNNEL_STAGES.find((x) => x.key === (s as FunnelStage)) ?? FUNNEL_STAGES[0];

export type SourceType = "instagram" | "tiktok" | "youtube" | "drive" | "other";

export function detectSourceType(url: string): SourceType {
  const u = url.toLowerCase();
  if (u.includes("instagram.com")) return "instagram";
  if (u.includes("tiktok.com")) return "tiktok";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("drive.google.com")) return "drive";
  return "other";
}

export function slugifyTag(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export interface ContentFormat {
  id: string;
  name: string;
  tag: string;
  funnel_stage: FunnelStage;
  emoji: string | null;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface FormatReference {
  id: string;
  format_id: string;
  url: string;
  title: string | null;
  source_type: SourceType;
  thumbnail_url: string | null;
  is_own: boolean;
  sort_order: number;
  created_at: string;
}
