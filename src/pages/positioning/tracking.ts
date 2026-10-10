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
