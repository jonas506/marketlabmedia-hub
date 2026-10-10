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
  void supabase.from("positioning_funnel_events").insert({ session_id: getSessionId(), step }).then(() => {});
}

export function getUtm() {
  const p = new URLSearchParams(window.location.search);
  const stored = JSON.parse(sessionStorage.getItem("pa_utm") || "{}");
  const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
  const utm: Record<string, string | null> = {};
  keys.forEach(k => { utm[k] = p.get(k) || stored[k] || null; });
  sessionStorage.setItem("pa_utm", JSON.stringify(utm));
  return utm;
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
  const w = window as unknown as Record<string, unknown>;
  const fbq = ((...args: unknown[]) => { (fbq as unknown as { queue: unknown[] }).queue.push(args); }) as unknown as Record<string, unknown>;
  fbq.queue = [];
  fbq.loaded = true;
  fbq.version = "2.0";
  w.fbq = fbq;
  if (!w._fbq) w._fbq = fbq;
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);
  window.fbq!("init", META_PIXEL_ID);
  window.fbq!("track", "PageView");
}
