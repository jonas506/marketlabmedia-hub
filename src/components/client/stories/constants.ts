export interface Category {
  id: string;
  client_id: string;
  name: string;
  color: string;
  scope: string;
}

export interface Sequence {
  id: string;
  client_id: string;
  title: string;
  status: string;
  posted_at: string | null;
  notes: string | null;
  created_at: string;
  category_id: string | null;
}

export interface Slide {
  id: string;
  sequence_id: string;
  sort_order: number;
  content_text: string;
  slide_type: string;
  image_url: string | null;
  slide_views: number;
  slide_clicks: number;
  slide_replies: number;
  category_id: string | null;
}

export interface Tracking {
  id: string;
  sequence_id: string;
  total_views: number;
  total_replies: number;
  total_link_clicks: number;
  total_profile_visits: number;
  keyword_triggers: number;
  screenshot_urls: string[];
  notes: string | null;
}

export const STATUS_BADGES: Record<string, string> = {
  draft: "bg-slate-500/20 text-slate-400",
  posted: "bg-emerald-500/20 text-emerald-400",
};

export const STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf",
  posted: "Gepostet",
};

export const SLIDE_TYPES = [
  { value: "text", label: "Text", icon: "FileText" },
  { value: "poll", label: "Poll", icon: "BarChart3" },
  { value: "cta", label: "CTA", icon: "Link" },
  { value: "video", label: "Video", icon: "Video" },
  { value: "image", label: "Bild", icon: "Image" },
];

export const CATEGORY_COLORS = ["blue", "emerald", "amber", "purple", "pink", "orange", "red", "cyan", "teal"];

export const COLOR_CLASSES: Record<string, string> = {
  blue: "bg-blue-500/20 text-blue-400",
  emerald: "bg-emerald-500/20 text-emerald-400",
  amber: "bg-amber-500/20 text-amber-400",
  purple: "bg-purple-500/20 text-purple-400",
  pink: "bg-pink-500/20 text-pink-400",
  orange: "bg-orange-500/20 text-orange-400",
  red: "bg-red-500/20 text-red-400",
  cyan: "bg-cyan-500/20 text-cyan-400",
  teal: "bg-teal-500/20 text-teal-400",
};
