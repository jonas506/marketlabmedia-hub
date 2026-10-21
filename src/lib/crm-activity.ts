import { StickyNote, Phone, Mail, MessageCircle, Users2, Linkedin, Instagram, FileText, User, type LucideIcon } from "lucide-react";

export type ActivityType = {
  value: string;
  label: string;
  icon: LucideIcon;
  color: string;
  channel: string | null;
};

export const ACTIVITY_TYPES: ActivityType[] = [
  { value: "note", label: "Notiz", icon: StickyNote, color: "#F59E0B", channel: null },
  { value: "call", label: "Anruf", icon: Phone, color: "#22C55E", channel: "telefon" },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle, color: "#25D366", channel: "whatsapp" },
  { value: "email", label: "Mail", icon: Mail, color: "#0083F7", channel: "mail" },
  { value: "meeting", label: "Meeting", icon: Users2, color: "#8B5CF6", channel: "persoenlich" },
  { value: "linkedin", label: "LinkedIn", icon: Linkedin, color: "#0A66C2", channel: "linkedin" },
  { value: "instagram", label: "Instagram", icon: Instagram, color: "#E1306C", channel: "instagram" },
  { value: "brief", label: "Brief", icon: FileText, color: "#6B7280", channel: "brief" },
  { value: "event", label: "Persönlich", icon: User, color: "#A855F7", channel: "persoenlich" },
];

export const ACTIVITY_TYPE_MAP: Record<string, ActivityType> = Object.fromEntries(ACTIVITY_TYPES.map(t => [t.value, t]));
// legacy: "sms" was used for meetings
ACTIVITY_TYPE_MAP.sms = ACTIVITY_TYPE_MAP.meeting as ActivityType;

export const TIMELINE_FILTERS = ["Alle", "Notizen", "Anrufe", "WhatsApp", "Mails", "Meetings", "Status"] as const;
export const FILTER_TYPES: Record<string, string[] | null> = {
  Alle: null,
  Notizen: ["note"],
  Anrufe: ["call"],
  WhatsApp: ["whatsapp"],
  Mails: ["email"],
  Meetings: ["meeting", "sms", "event"],
  Status: ["status_change", "opportunity_change", "created", "task_completed"],
};

export const COMPACT_TYPES = new Set(["status_change", "opportunity_change", "created", "task_completed"]);

export interface CrmActivity {
  id: string;
  type: string;
  title: string;
  body: string | null;
  created_at: string;
  created_by: string | null;
  lead_id?: string | null;
  contact_id?: string | null;
  metadata?: { pinned?: boolean } | null;
}

/** First line of the text becomes the title (max 80 chars), rest stays as body. */
export function splitTitleBody(text: string, fallbackLabel: string): { title: string; body: string | null } {
  const lines = text.trim().split("\n");
  const first = (lines[0] ?? "").trim();
  const title = (first || fallbackLabel).slice(0, 80);
  const rest = lines.slice(1).join("\n").trim();
  return { title, body: rest || null };
}

const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function dayLabel(iso: string, now = new Date()): string {
  const key = dayKey(iso);
  const today = dayKey(now.toISOString());
  const yesterday = dayKey(new Date(now.getTime() - 86400000).toISOString());
  if (key === today) return "Heute";
  if (key === yesterday) return "Gestern";
  return new Date(iso).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
}

/** Groups activities by calendar day (newest first), pinned notes always on top. */
export function groupActivitiesByDay(activities: CrmActivity[]): { label: string; items: CrmActivity[] }[] {
  const pinned = activities.filter(a => a.metadata?.pinned);
  const rest = activities.filter(a => !a.metadata?.pinned);
  const groups = new Map<string, CrmActivity[]>();
  rest.forEach(a => {
    const k = dayKey(a.created_at);
    groups.set(k, [...(groups.get(k) ?? []), a]);
  });
  const out: { label: string; items: CrmActivity[] }[] = [];
  if (pinned.length) out.push({ label: "Angepinnt", items: pinned });
  Array.from(groups.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .forEach(([k, items]) => out.push({ label: dayLabel(items[0].created_at), items }));
  return out;
}

export function filterActivities(activities: CrmActivity[], filter: string): CrmActivity[] {
  const types = FILTER_TYPES[filter];
  if (!types) return activities;
  return activities.filter(a => types.includes(a.type));
}

/** Builds the insert payload for a new activity; shared by contact and lead pages. */
export function buildActivityInsert(opts: {
  text: string;
  type: string;
  userId: string;
  leadId?: string | null;
  contactId?: string | null;
  at?: Date;
}) {
  const t = ACTIVITY_TYPE_MAP[opts.type] ?? ACTIVITY_TYPES[0];
  const { title, body } = splitTitleBody(opts.text, t.label);
  return {
    type: t.value === "meeting" ? "meeting" : t.value,
    title,
    body,
    created_by: opts.userId,
    created_at: (opts.at ?? new Date()).toISOString(),
    ...(opts.leadId ? { lead_id: opts.leadId } : {}),
    ...(opts.contactId ? { contact_id: opts.contactId } : {}),
  };
}
