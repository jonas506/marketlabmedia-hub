import { supabase } from "@/integrations/supabase/client";

export type FunnelStep = "besuch" | "video" | "formular" | "eingetragen";

export function getSessionId() {
  let id = sessionStorage.getItem("pa_session");
  if (!id) { id = crypto.randomUUID(); sessionStorage.setItem("pa_session", id); }
  return id;
}

const sent = new Set<FunnelStep>();
export function trackStep(step: FunnelStep) {
  if (sent.has(step)) return;
  sent.add(step);
  // duplicates per session are rejected by a unique constraint; errors are ignored on purpose
  void supabase.from("positioning_funnel_events").insert({ session_id: getSessionId(), step, ...getUtm() }).then(() => {});
  if (step === "video") window.fbq?.("track", "ViewContent", { content_name: "Positionierungs-Analyse VSL" });
}

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"] as const;
/** First-touch attribution: values from the first visit of the session win over later URLs. */
export function getUtm() {
  const p = new URLSearchParams(window.location.search);
  const stored = JSON.parse(sessionStorage.getItem("pa_utm") || "null") as Record<string, string | null> | null;
  if (stored) return stored;
  const utm: Record<string, string | null> = {};
  UTM_KEYS.forEach(k => { utm[k] = p.get(k) || null; });
  sessionStorage.setItem("pa_utm", JSON.stringify(utm));
  return utm;
}

function readCookie(name: string) {
  return document.cookie.split("; ").find(c => c.startsWith(name + "="))?.split("=")[1] ?? null;
}
/** Meta browser identifiers for the Conversions API; fbc is built from fbclid if the cookie is missing. */
export function getMetaIds() {
  const fbclid = getUtm().fbclid;
  return { fbp: readCookie("_fbp"), fbc: readCookie("_fbc") || (fbclid ? `fb.1.${Date.now()}.${fbclid}` : null) };
}

declare global {
  interface Window { fbq?: (...args: unknown[]) => void; _fbq?: unknown; }
}

const META_PIXEL_ID = "2349392999129892";
let pixelInitialized = false;

/** Loads the Meta Pixel once and fires PageView. Scoped to the public funnel pages. */
export function initMetaPixel() {
  if (pixelInitialized || typeof window.fbq === "function") return;
  pixelInitialized = true;
  type Fbq = ((...args: unknown[]) => void) & { queue: unknown[]; loaded: boolean; version: string };
  const fbq = ((...args: unknown[]) => { fbq.queue.push(args); }) as Fbq;
  fbq.queue = [];
  fbq.loaded = true;
  fbq.version = "2.0";
  window.fbq = fbq;
  if (!window._fbq) window._fbq = fbq;
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);
  fbq("init", META_PIXEL_ID);
  fbq("track", "PageView");
}
