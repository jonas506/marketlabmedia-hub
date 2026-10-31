import { supabase } from '@/integrations/supabase/client';

export type Choice = 'all' | 'necessary';
export type Step = 'besuch' | 'check_start' | 'kein_meta' | 'formular';
const KEY = 'vc_consent';
const PIXEL_ID = '2349392999129892';
interface Consent { choice: Choice; id: string | null; at: string; version: string }
const KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'] as const;

export function readConsent(): Consent | null {
  try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && ['all', 'necessary'].includes(v.choice) ? v : null; } catch { return null; }
}
export const permitted = () => { const c = readConsent(); return c?.choice === 'all' && !!c.id; };

function clearTracking() {
  window.fbq?.('consent', 'revoke');
  Object.keys(sessionStorage).filter(k => k.startsWith('vc_')).forEach(k => sessionStorage.removeItem(k));
  ['_fbp', '_fbc'].forEach(n => { document.cookie = `${n}=; Max-Age=0; path=/`; });
}

export async function chooseConsent(choice: Choice) {
  const old = readConsent();
  // A withdrawal is applied locally before any network call.
  localStorage.setItem(KEY, JSON.stringify({ choice, id: old?.id || null, at: new Date().toISOString(), version: 'vc-2026-10-31' }));
  if (choice === 'necessary') clearTracking();
  window.dispatchEvent(new Event('vc-consent'));
  const { data, error } = await supabase.functions.invoke('vertriebs-check?action=consent', { body: { choice, id: old?.id || undefined } });
  if (error) throw error;
  localStorage.setItem(KEY, JSON.stringify({ choice, id: data.id, at: new Date().toISOString(), version: 'vc-2026-10-31' }));
  window.dispatchEvent(new Event('vc-consent'));
  if (choice === 'all') initPixel();
  return data.id as string;
}

/** First-touch origin. With consent it is remembered for the visit; without, it is read from the current URL only. */
export function attribution(): Record<string, string | null> {
  const query = new URLSearchParams(location.search);
  const current: Record<string, string | null> = {};
  for (const k of KEYS) current[k] = query.get(k)?.slice(0, 500) || null;
  if (!permitted()) return Object.values(current).some(Boolean) ? current : {};
  try { const stored = JSON.parse(sessionStorage.getItem('vc_utm') || 'null'); if (stored) return stored; } catch { /* ignore */ }
  if (Object.values(current).some(Boolean)) { sessionStorage.setItem('vc_utm', JSON.stringify(current)); return current; }
  return {};
}

export function sessionId() {
  if (!permitted()) return null;
  let id = sessionStorage.getItem('vc_session');
  if (!id) { id = crypto.randomUUID(); sessionStorage.setItem('vc_session', id); }
  return id;
}
function cookie(n: string) { if (!permitted()) return null; return document.cookie.split('; ').find(v => v.startsWith(n + '='))?.slice(n.length + 1) || null; }
function fbc() { const c = cookie('_fbc'); if (c) return c; const id = attribution().fbclid; return id ? `fb.1.${Date.now()}.${id}` : null; }

let initialized = false;
export function initPixel() {
  if (!permitted()) return;
  if (initialized) { window.fbq?.('consent', 'grant'); return; }
  initialized = true;
  if (!window.fbq) {
    type Pixel = NonNullable<Window['fbq']> & { queue: unknown[]; callMethod?: (...args: unknown[]) => void; push: unknown; loaded: boolean; version: string };
    const fbq = ((...args: unknown[]) => { if (fbq.callMethod) fbq.callMethod.apply(fbq, args); else fbq.queue.push(args); }) as Pixel;
    fbq.queue = []; fbq.push = fbq; fbq.loaded = true; fbq.version = '2.0';
    window.fbq = fbq; window._fbq = fbq;
    const script = document.createElement('script'); script.src = 'https://connect.facebook.net/en_US/fbevents.js'; script.async = true; document.head.append(script);
  }
  window.fbq?.('init', PIXEL_ID, {}, { agent: 'lovable' });
  window.fbq?.('consent', 'grant');
}

const BROWSER_EVENT: Partial<Record<Step, string>> = { besuch: 'PageView', check_start: 'InitiateCheckout' };

/** Funnel event; no-op without consent. Each step counts once per session. */
export async function track(step: Step, extra: { weg?: 'a' | 'b' | null; variant?: string | null } = {}) {
  if (!permitted()) return;
  const sid = sessionId(), consent = readConsent();
  if (!sid || !consent?.id) return;
  const marker = `vc_event_${step}`;
  if (sessionStorage.getItem(marker)) return;
  sessionStorage.setItem(marker, '1');
  const eventId = crypto.randomUUID();
  const name = BROWSER_EVENT[step];
  initPixel();
  if (name) window.fbq?.('track', name, {}, { eventID: eventId });
  const { error } = await supabase.functions.invoke('vertriebs-check?action=event', {
    body: { step, event_id: eventId, session_id: sid, consent_id: consent.id, attribution: attribution(), weg: extra.weg ?? null, variant: extra.variant || null, fbp: cookie('_fbp'), fbc: fbc() },
  });
  if (error) sessionStorage.removeItem(marker);
}

/** Extra fields for the form submit. Empty without consent. */
export function submitTracking() {
  const consent = readConsent();
  if (!permitted() || !consent?.id) return { attribution: attribution() };
  return { attribution: attribution(), session_id: sessionId(), advertising_consent_id: consent.id, event_id: crypto.randomUUID(), fbp: cookie('_fbp'), fbc: fbc() };
}
export function trackRegistration(eventId?: string) {
  if (!eventId || !permitted()) return;
  initPixel();
  window.fbq?.('track', 'CompleteRegistration', {}, { eventID: eventId });
}

export function mountTracking(onVisit: () => void) {
  const update = () => { if (permitted()) { initPixel(); onVisit(); } else window.fbq?.('consent', 'revoke'); };
  window.addEventListener('storage', update);
  window.addEventListener('vc-consent', update);
  update();
  return () => { window.removeEventListener('storage', update); window.removeEventListener('vc-consent', update); };
}
