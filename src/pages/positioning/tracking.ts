import { supabase } from "@/integrations/supabase/client";

export type FunnelStep = "besuch" | "video" | "formular" | "eingetragen";

export type Consent = "all" | "necessary";
const CONSENT_KEY = "pa_consent";
/** Stored decision (strictly necessary storage). null = not decided yet. */
export function getConsent(): Consent | null {
  const v = localStorage.getItem(CONSENT_KEY);
  return v === "all" || v === "necessary" ? v : null;
}
export const hasTrackingConsent = () => getConsent() === "all";
export function setConsent(value: Consent) {
  const previous = getConsent();
  localStorage.setItem(CONSENT_KEY, value);
  if (value === "necessary") {
    sessionStorage.removeItem("pa_session");
    sessionStorage.removeItem("pa_utm");
    ["_fbp", "_fbc"].forEach(n => {
      document.cookie = `${n}=; Max-Age=0; path=/`;
      document.cookie = `${n}=; Max-Age=0; path=/; domain=.${location.hostname.split(".").slice(-2).join(".")}`;
    });
    // a loaded pixel cannot be unloaded, so reload without it
    if (previous === "all") location.reload();
  }
}

/** Only with consent; otherwise no browser identifier is created. */
export function getSessionId(): string | null {
  if (!hasTrackingConsent()) return null;
  let id = sessionStorage.getItem("pa_session");
  if (!id) { id = crypto.randomUUID(); sessionStorage.setItem("pa_session", id); }
  return id;
}

const sent = new Set<FunnelStep>();
export function trackStep(step: FunnelStep) {
  if (!hasTrackingConsent() || sent.has(step)) return;
  sent.add(step);
  // duplicates per session are rejected by a unique constraint; errors are ignored on purpose
  void supabase.from("positioning_funnel_events").insert({ session_id: getSessionId()!, step, ...getUtm() }).then(() => {});
  if (step === "video") window.fbq?.("track", "ViewContent", { content_name: "Positionierungs-Analyse VSL" });
}

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"] as const;
/** First-touch attribution: values from the first visit of the session win over later URLs. */
export function getUtm() {
  const p = new URLSearchParams(window.location.search);
  if (!hasTrackingConsent()) {
    // without consent: read campaign values from the current URL only, store nothing in the browser
    const utm: Record<string, string | null> = {};
    UTM_KEYS.forEach(k => { utm[k] = p.get(k) || null; });
    return utm;
  }
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
  if (!hasTrackingConsent()) return;
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
