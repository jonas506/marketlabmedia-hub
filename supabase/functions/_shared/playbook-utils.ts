export const PLAYBOOK_SOURCE_URL = 'https://hub.marketlab-media.de/';
export const PLAYBOOK_PRIVACY_TEXT = 'Ich habe die Datenschutzerklärung gelesen. Marketlab Media darf mich zum Playbook per E-Mail und telefonisch kontaktieren.';

export function cleanName(value: string, max = 100) {
  let name = value.trim().replace(/\s+/g, ' ').replace(/[^\p{L}\p{M} .'-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, max);
  if (name && (name === name.toLowerCase() || name === name.toUpperCase())) {
    name = name.toLocaleLowerCase('de-DE').replace(/(^|[\s'-])(\p{L})/gu, (_m, prefix: string, letter: string) => prefix + letter.toLocaleUpperCase('de-DE'));
  }
  return name;
}

export function normalizePhone(value: string) {
  const raw = value.trim().replace(/[\s()/-]/g, '');
  if (raw.startsWith('+') && !raw.startsWith('+49') && !raw.startsWith('+490')) return `+${raw.slice(1).replace(/\D/g, '')}`;
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0049')) digits = `49${digits.slice(4)}`;
  else if (digits.startsWith('490')) digits = `49${digits.slice(3)}`;
  else if (digits.startsWith('0')) digits = `49${digits.slice(1)}`;
  else if (!digits.startsWith('49')) digits = `49${digits}`;
  return `+${digits}`;
}

export async function sha256(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function isTestEmail(email: string) {
  return email.trim().toLowerCase().endsWith('@example.com');
}

export async function consentAllowed(db: any, id: string) {
  const { data } = await db.from('vertriebs_check_consents').select('choice,withdrawn_at').eq('id', id).maybeSingle();
  return !!data && data.choice === 'all' && !data.withdrawn_at;
}

export async function playbookUserData(submission: any) {
  const userData: Record<string, unknown> = {
    em: [await sha256(String(submission.email).trim().toLowerCase())],
    ph: [await sha256(normalizePhone(String(submission.phone)).replace(/\D/g, ''))],
    fn: [await sha256(String(submission.first_name).trim().toLowerCase())],
    ln: [await sha256(String(submission.last_name).trim().toLowerCase())],
    external_id: [await sha256(String(submission.lead_id || submission.id))],
  };
  if (submission.fbp) userData.fbp = submission.fbp;
  if (submission.fbc) userData.fbc = submission.fbc;
  if (submission.client_ip) userData.client_ip_address = submission.client_ip;
  if (submission.client_user_agent) userData.client_user_agent = submission.client_user_agent;
  return userData;
}

export async function sendPlaybookMeta(db: any, event: {
  submission: any;
  event_name: 'Lead' | 'Schedule' | 'Purchase';
  event_id: string;
  event_time?: number;
  custom_data?: { value: number; currency: 'EUR' };
}) {
  const s = event.submission;
  if (s.is_test || isTestEmail(s.email)) return { status: 'skipped_test', response: null };
  const log = (status: string, received: number | null, error: string | null) => db.from('capi_log').insert({
    funnel: 'leads-playbook', submission_id: s.id, event_name: event.event_name, event_id: event.event_id,
    status, events_received: received, error, test: false,
  });
  const token = Deno.env.get('META_ACCESS_TOKEN');
  if (!token) { await log('missing_token', null, 'META_ACCESS_TOKEN fehlt'); return { status: 'missing_token', response: null }; }
  try {
    const response = await fetch('https://graph.facebook.com/v26.0/2349392999129892/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        partner_agent: 'lovable',
        data: [{
          event_name: event.event_name, event_id: event.event_id,
          event_time: event.event_time ?? Math.floor(Date.now() / 1000), action_source: 'website',
          event_source_url: PLAYBOOK_SOURCE_URL, user_data: await playbookUserData(s),
          ...(event.custom_data ? { custom_data: event.custom_data } : {}),
        }],
      }),
    });
    const result = await response.json().catch(() => ({}));
    await log(response.ok ? 'accepted' : 'failed', result?.events_received ?? null, response.ok ? null : String(result?.error?.error_user_msg || result?.error?.message || response.status).slice(0, 500));
    return { status: response.ok ? 'accepted' : 'failed', response: result };
  } catch (error) {
    await log('failed', null, String(error).slice(0, 500));
    return { status: 'failed', response: null };
  }
}
