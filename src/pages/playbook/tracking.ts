import { supabase } from '@/integrations/supabase/client';

export type Choice = 'all' | 'necessary';
export type Step = 'besuch' | 'formular_start' | 'schritt2' | 'uebersprungen' | 'download';
interface Consent { choice: Choice; id: string | null; at: string; version: string }
const KEY = 'vc_consent';
const PIXEL_ID = '2349392999129892';
const ATTR_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'] as const;

export function readConsent(): Consent | null {
  try { const value = JSON.parse(localStorage.getItem(KEY) || 'null'); return value && ['all', 'necessary'].includes(value.choice) ? value : null; } catch { return null; }
}
export const permitted = () => { const consent = readConsent(); return consent?.choice === 'all' && !!consent.id; };

function clearTracking() {
  window.fbq?.('consent', 'revoke');
  Object.keys(sessionStorage).filter((key) => key.startsWith('pb_')).forEach((key) => sessionStorage.removeItem(key));
  ['_fbp', '_fbc'].forEach((name) => { document.cookie = `${name}=; Max-Age=0; path=/`; });
}

export async function chooseConsent(choice: Choice) {
  const old = readConsent();
  localStorage.setItem(KEY, JSON.stringify({ choice, id: old?.id || null, at: new Date().toISOString(), version: 'vc-2026-10-31' }));
  if (choice === 'necessary') clearTracking();
  window.dispatchEvent(new Event('pb-consent'));
  const { data, error } = await supabase.functions.invoke('vertriebs-check?action=consent', { body: { choice, id: old?.id || undefined } });
  if (error) throw error;
  localStorage.setItem(KEY, JSON.stringify({ choice, id: data.id, at: new Date().toISOString(), version: 'vc-2026-10-31' }));
  window.dispatchEvent(new Event('pb-consent'));
  if (choice === 'all') initPixel();
  return data.id as string;
}

export function attribution(): Record<string, string | null> {
  const query = new URLSearchParams(location.search);
  const current: Record<string, string | null> = {};
  for (const key of ATTR_KEYS) current[key] = query.get(key)?.slice(0, 500) || null;
  if (!permitted()) return Object.values(current).some(Boolean) ? current : {};
  try { const stored = JSON.parse(sessionStorage.getItem('pb_utm') || 'null'); if (stored) return stored; } catch { /* ignore */ }
  if (Object.values(current).some(Boolean)) { sessionStorage.setItem('pb_utm', JSON.stringify(current)); return current; }
  return {};
}

export function sessionId() {
  if (!permitted()) return null;
  let id = sessionStorage.getItem('pb_session');
  if (!id) { id = crypto.randomUUID(); sessionStorage.setItem('pb_session', id); }
  return id;
}
function cookie(name: string) { if (!permitted()) return null; return document.cookie.split('; ').find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1) || null; }
function fbc() { const value = cookie('_fbc'); if (value) return value; const id = attribution().fbclid; return id ? `fb.1.${Date.now()}.${id}` : null; }

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

export async function track(step: Step, variant?: string) {
  if (!permitted()) return;
  const sid = sessionId(); const consent = readConsent();
  if (!sid || !consent?.id) return;
  const marker = `pb_event_${step}`;
  if (sessionStorage.getItem(marker)) return;
  sessionStorage.setItem(marker, '1');
  const eventId = crypto.randomUUID();
  initPixel();
  if (step === 'besuch') window.fbq?.('track', 'PageView', {}, { eventID: eventId });
  const { error } = await supabase.functions.invoke('playbook?action=event', {
    body: { step, event_id: eventId, session_id: sid, consent_id: consent.id, attribution: attribution(), variant: variant || null },
  });
  if (error) sessionStorage.removeItem(marker);
}

export function submitTracking() {
  const consent = readConsent();
  if (!permitted() || !consent?.id) return { attribution: attribution() };
  return { attribution: attribution(), session_id: sessionId(), advertising_consent_id: consent.id, event_id: crypto.randomUUID(), fbp: cookie('_fbp'), fbc: fbc() };
}

export function trackLead(eventId?: string, test = false) {
  if (!eventId || test || !permitted()) return;
  initPixel();
  window.fbq?.('track', 'Lead', {}, { eventID: eventId });
}

export function mountTracking(onVisit: () => void) {
  const update = () => { if (permitted()) { initPixel(); onVisit(); } else window.fbq?.('consent', 'revoke'); };
  window.addEventListener('storage', update);
  window.addEventListener('pb-consent', update);
  update();
  return () => { window.removeEventListener('storage', update); window.removeEventListener('pb-consent', update); };
}
