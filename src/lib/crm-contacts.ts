export const SEGMENTS = [
  { value: "immo_finanz", label: "Immo & Finanz", color: "#0EA5E9" },
  { value: "mittelstand", label: "Mittelstand", color: "#F59E0B" },
  { value: "kunde", label: "Kunde", color: "#22C55E" },
  { value: "partner", label: "Partner", color: "#8B5CF6" },
  { value: "creator", label: "Creator", color: "#EC4899" },
  { value: "sonstiges", label: "Sonstiges", color: "#6B7280" },
] as const;

export const RELATIONSHIPS = [
  { value: "kunde", label: "Kunde" },
  { value: "lead", label: "Lead" },
  { value: "netzwerk", label: "Netzwerk" },
  { value: "event_kontakt", label: "Event-Kontakt" },
  { value: "partner", label: "Partner" },
  { value: "team", label: "Team" },
  { value: "kalt", label: "Kalt" },
] as const;

export const CHANNELS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "mail", label: "Mail" },
  { value: "instagram", label: "Instagram" },
  { value: "telefon", label: "Telefon" },
  { value: "brief", label: "Brief" },
  { value: "persoenlich", label: "Persönlich" },
] as const;

export const GUEST_STATUSES = [
  { value: "angefragt", label: "Angefragt", color: "#6B7280" },
  { value: "eingeladen", label: "Eingeladen", color: "#3B82F6" },
  { value: "vielleicht", label: "Vielleicht", color: "#F59E0B" },
  { value: "zusage", label: "Zusage", color: "#22C55E" },
  { value: "spaeter", label: "Später", color: "#A855F7" },
  { value: "absage", label: "Absage", color: "#EF4444" },
  { value: "bounce", label: "Bounce", color: "#B91C1C" },
  { value: "erschienen", label: "Erschienen", color: "#10B981" },
] as const;

export type GuestStatus = typeof GUEST_STATUSES[number]["value"];

/** Statuses that occupy a seat. */
export const SEAT_STATUSES: string[] = ["zusage", "erschienen"];
/** Statuses that still wait for an answer. */
export const OPEN_STATUSES: string[] = ["angefragt", "eingeladen", "vielleicht"];

export const CONTACT_FIELDS = [
  "full_name", "first_name", "company", "role", "email", "phone", "whatsapp", "linkedin_url",
  "instagram_handle", "website", "city", "region", "segment", "relationship", "tags", "source",
  "last_contact_at", "last_channel", "next_followup_date", "notes", "do_not_contact", "lat", "lon", "external_ref",
] as const;

export const labelOf = (list: readonly { value: string; label: string }[], v?: string | null) =>
  list.find(x => x.value === v)?.label ?? v ?? "—";
export const colorOf = (list: readonly { value: string; color: string }[], v?: string | null) =>
  list.find(x => x.value === v)?.color ?? "#6B7280";

export type ContactLite = {
  id: string;
  full_name: string;
  company: string | null;
  email: string | null;
  linkedin_url: string | null;
  relationship?: string | null;
  last_contact_at?: string | null;
  next_followup_date?: string | null;
  do_not_contact?: boolean;
};

const norm = (s?: string | null) => (s ?? "").trim().toLowerCase().replace(/\/+$/, "");

/** Groups of possible duplicates: same e-mail, same LinkedIn URL or same name. */
export function findDuplicateGroups<T extends { id: string; full_name: string; email: string | null; linkedin_url: string | null }>(items: T[]) {
  const groups: { reason: string; key: string; items: T[] }[] = [];
  const seen = new Set<string>();
  const add = (reason: string, keyFn: (c: T) => string) => {
    const map = new Map<string, T[]>();
    items.forEach(c => { const k = keyFn(c); if (k) map.set(k, [...(map.get(k) ?? []), c]); });
    map.forEach((arr, k) => {
      if (arr.length < 2) return;
      const sig = arr.map(a => a.id).sort().join("|");
      if (seen.has(sig)) return;
      seen.add(sig);
      groups.push({ reason, key: k, items: arr });
    });
  };
  add("Gleiche E-Mail", c => norm(c.email));
  add("Gleiche LinkedIn-URL", c => norm(c.linkedin_url));
  add("Gleicher Name", c => norm(c.full_name));
  return groups;
}

const dayStr = (d: Date) => d.toISOString().slice(0, 10);

export function isFollowupDue(c: { next_followup_date?: string | null }, today = new Date()) {
  return !!c.next_followup_date && c.next_followup_date <= dayStr(today);
}

const WARM = ["kunde", "lead", "netzwerk", "event_kontakt", "partner"];
/** Warm contact (not cold, not opted out) without contact for at least `days`. */
export function isWarmStale(c: ContactLite, days = 30, now = new Date()) {
  if (c.do_not_contact || !WARM.includes(c.relationship ?? "")) return false;
  if (!c.last_contact_at) return true;
  return now.getTime() - new Date(c.last_contact_at).getTime() >= days * 86400000;
}

/** Minimal CSV parser (comma or semicolon, quoted fields). */
export function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some(c => c.trim() !== "")) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some(c => c.trim() !== "")) rows.push(row);
  return rows;
}

export function toCsv(rows: (string | number | null | undefined)[][]) {
  return rows.map(r => r.map(v => {
    const s = v == null ? "" : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(";")).join("\n");
}

export const waLink = (n?: string | null) => n ? `https://wa.me/${n.replace(/\D/g, "").replace(/^00/, "").replace(/^0/, "49")}` : null;
