import { createClient } from "npm:@supabase/supabase-js@2";

// Read-only, numbers-only stats for the /positionierungs-analyse ads reporting (Google Sheet).
// Score logic mirrors src/pages/positioning/scoring.ts (70 % revenue, 30 % industry; A>=80, B>=60).
const REVENUE_POINTS: Record<string, number> = { "Unter 20.000 €": 20, "20.000 bis 50.000 €": 50, "50.000 bis 100.000 €": 75, "Über 100.000 €": 100 };
const INDUSTRY_POINTS: Record<string, number> = { Kapitalanlagevertrieb: 100, Finanzdienstleister: 90, Immobilienmakler: 70, Sonstiges: 30 };
const score = (r: string, i: string) => Math.round((REVENUE_POINTS[r] ?? 0) * 0.7 + (INDUSTRY_POINTS[i] ?? 0) * 0.3);

const ADS_RE = /facebook|fb|ig|instagram|meta/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

const berlinDay = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const out: T[] = [];
  for (let off = 0; ; off += 1000) {
    const { data, error } = await build(off, off + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const key = Deno.env.get("ADS_STATS_KEY");
  const given = req.headers.get("x-api-key") ?? "";
  if (!key || !safeEqual(given, key)) return json({ error: "unauthorized" }, 401);

  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const onlyAds = url.searchParams.get("nur_ads") === "1";
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || isNaN(Date.parse(from)) || isNaN(Date.parse(to)) || from > to)
    return json({ error: "from/to müssen YYYY-MM-DD sein und from <= to" }, 400);
  const span = (Date.parse(to) - Date.parse(from)) / 86400000;
  if (span > 366) return json({ error: "Zeitraum max. 366 Tage" }, 400);

  // UTC window with a 1-day buffer on each side; exact Berlin day filtering happens below.
  const start = new Date(Date.parse(from) - 86400000).toISOString();
  const end = new Date(Date.parse(to) + 2 * 86400000).toISOString();

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const funnel = url.searchParams.get("funnel");
  if (funnel !== null && funnel !== "vertriebs-check") return json({ error: "unbekannter funnel" }, 400);
  if (funnel === "vertriebs-check") {
    try { return json({ days: await vertriebsCheck(db, from, to, start, end, onlyAds) }); } catch (_e) { return json({ error: "internal_error" }, 500); }
  }

  try {
    const [events, leads] = await Promise.all([
      fetchAll<{ session_id: string; step: string; created_at: string; utm_source: string | null }>((a, b) =>
        db.from("positioning_funnel_events").select("session_id, step, created_at, utm_source").eq("funnel", "positionierung").in("step", ["besuch", "video", "formular", "eingetragen"])
          .gte("created_at", start).lt("created_at", end).order("created_at").range(a, b)),
      fetchAll<{ created_at: string; status: string; monthly_revenue: string; industry: string; utm_source: string | null; session_id: string | null }>((a, b) =>
        db.from("positioning_analysis_leads").select("created_at, status, monthly_revenue, industry, utm_source, session_id")
          .gte("created_at", start).lt("created_at", end).order("created_at").range(a, b)),
    ]);

    // nur_ads: an event counts if it carries an ads utm_source itself, or (older events without UTM) its session belongs to an ads lead.
    const adsSessions = new Set<string>();
    if (onlyAds) {
      const all = await fetchAll<{ session_id: string | null; utm_source: string | null }>((a, b) =>
        db.from("positioning_analysis_leads").select("session_id, utm_source").not("session_id", "is", null).range(a, b));
      all.forEach((l) => { if (l.session_id && l.utm_source && ADS_RE.test(l.utm_source)) adsSessions.add(l.session_id); });
      events.forEach((e) => { if (e.utm_source && ADS_RE.test(e.utm_source)) adsSessions.add(e.session_id); });
    }

    type Day = { date: string; besucher: number; video: number; formular: number; eingetragen: number; leads: number; ab_leads: number; termine: number; angebote: number; abschluss: number; unqualifiziert: number };
    const days = new Map<string, Day>();
    const sets = new Map<string, { besuch: Set<string>; video: Set<string>; formular: Set<string>; eingetragen: Set<string> }>();
    for (let t = Date.parse(from); t <= Date.parse(to); t += 86400000) {
      const d = new Date(t).toISOString().slice(0, 10);
      days.set(d, { date: d, besucher: 0, video: 0, formular: 0, eingetragen: 0, leads: 0, ab_leads: 0, termine: 0, angebote: 0, abschluss: 0, unqualifiziert: 0 });
      sets.set(d, { besuch: new Set(), video: new Set(), formular: new Set(), eingetragen: new Set() });
    }

    for (const e of events) {
      const s = sets.get(berlinDay(e.created_at));
      if (!s || (onlyAds && !adsSessions.has(e.session_id))) continue;
      s[e.step as "besuch" | "video" | "formular" | "eingetragen"].add(e.session_id);
    }
    for (const [d, s] of sets) { const day = days.get(d)!; day.besucher = s.besuch.size; day.video = s.video.size; day.formular = s.formular.size; day.eingetragen = s.eingetragen.size; }

    for (const l of leads) {
      const day = days.get(berlinDay(l.created_at));
      if (!day || (onlyAds && !(l.utm_source && ADS_RE.test(l.utm_source)))) continue;
      day.leads++;
      if (score(l.monthly_revenue, l.industry) >= 60) day.ab_leads++;
      if (["termin", "angebot", "abschluss"].includes(l.status)) day.termine++;
      if (["angebot", "abschluss"].includes(l.status)) day.angebote++;
      if (l.status === "abschluss") day.abschluss++;
      if (["unqualifiziert", "doppelt"].includes(l.status)) day.unqualifiziert++;
    }

    return json({ days: [...days.values()] });
  } catch (_e) {
    return json({ error: "internal_error" }, 500);
  }
});

// Vertriebs-Check: aggregate counts only. Lead milestones are cumulative (a sale also counts as contacted and scheduled).
// deno-lint-ignore no-explicit-any
async function vertriebsCheck(db: any, from: string, to: string, start: string, end: string, onlyAds: boolean) {
  const STEPS = ["besuch", "check_start", "kein_meta", "formular", "eingetragen"] as const;
  const [events, subs] = await Promise.all([
    fetchAll<{ session_id: string; step: string; created_at: string; utm_source: string | null }>((a, b) =>
      db.from("positioning_funnel_events").select("session_id, step, created_at, utm_source").eq("funnel", "vertriebs-check")
        .gte("created_at", start).lt("created_at", end).order("created_at").range(a, b)),
    fetchAll<{ created_at: string; weg: string; attribution: Record<string, string | null> | null; kontakt_at: string | null; termin_at: string | null; abschluss_at: string | null }>((a, b) =>
      db.from("vertriebs_check_submissions").select("created_at, weg, attribution, kontakt_at, termin_at, abschluss_at")
        .gte("created_at", start).lt("created_at", end).order("created_at").range(a, b)),
  ]);
  const days = new Map<string, Record<string, number | string>>();
  const sets = new Map<string, Record<string, Set<string>>>();
  for (let t = Date.parse(from); t <= Date.parse(to); t += 86400000) {
    const d = new Date(t).toISOString().slice(0, 10);
    days.set(d, { date: d, besucher: 0, check_start: 0, kein_meta: 0, formular: 0, eingetragen: 0, leads: 0, weg_a: 0, weg_b: 0, kontaktiert: 0, termine: 0, abschluss: 0 });
    sets.set(d, Object.fromEntries(STEPS.map((s) => [s, new Set<string>()])));
  }
  for (const e of events) {
    const s = sets.get(berlinDay(e.created_at));
    if (!s || !s[e.step] || (onlyAds && !(e.utm_source && ADS_RE.test(e.utm_source)))) continue;
    s[e.step].add(e.session_id);
  }
  for (const [d, s] of sets) { const day = days.get(d)!; day.besucher = s.besuch.size; for (const k of STEPS.slice(1)) day[k] = s[k].size; }
  const inc = (day: Record<string, number | string>, k: string) => { day[k] = (day[k] as number) + 1; };
  for (const l of subs) {
    const day = days.get(berlinDay(l.created_at));
    const src = l.attribution?.utm_source;
    if (!day || (onlyAds && !(src && ADS_RE.test(src)))) continue;
    inc(day, "leads"); inc(day, l.weg === "a" ? "weg_a" : "weg_b");
    if (l.kontakt_at || l.termin_at || l.abschluss_at) inc(day, "kontaktiert");
    if (l.termin_at || l.abschluss_at) inc(day, "termine");
    if (l.abschluss_at) inc(day, "abschluss");
  }
  return [...days.values()];
}
