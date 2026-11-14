import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3.25.76';
import { cleanName, normalizePhone, isTestEmail, sha256, consentAllowed, sendPlaybookMeta } from '../_shared/playbook-utils.ts';

declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
const uuid = z.string().uuid();
const attribution = z.record(z.string().max(500).nullable()).refine((value) => Object.keys(value).every((key) => ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'].includes(key)));
const submitSchema = z.object({
  request_id: uuid,
  first_name: z.string().trim().min(1).max(100), last_name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255), phone: z.string().trim().min(7).max(32), privacy: z.literal(true),
  variant: z.string().max(40).regex(/^[a-z0-9_-]*$/).nullable().optional(), attribution: attribution.optional(),
  session_id: uuid.nullable().optional(), advertising_consent_id: uuid.nullable().optional(), event_id: uuid.nullable().optional(),
  fbp: z.string().max(200).nullable().optional(), fbc: z.string().max(300).nullable().optional(),
});
const eventSchema = z.object({
  session_id: uuid, consent_id: uuid, event_id: uuid,
  step: z.enum(['besuch', 'formular_start', 'schritt2', 'uebersprungen', 'download']),
  variant: z.string().max(40).regex(/^[a-z0-9_-]*$/).nullable().optional(), attribution: attribution.optional(),
});
const BERATER = ['Makler', 'Finanzberater', 'Versicherungsmakler', 'Kapitalanlage-Vertrieb', 'Sonstiges'] as const;
const UMSATZ = ['Unter 5.000 €', '5.000 bis 15.000 €', '15.000 bis 50.000 €', '50.000 bis 150.000 €', 'Über 150.000 €'] as const;
const TEMPLATE_PATH = 'vorlage/Leads-Playbook-2027_Vorlage.pdf';
const FALLBACK_PATH = 'vorlage/Leads-Playbook-2027_ohne-Name.pdf';
const background = (promise: Promise<unknown>) => { if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(promise); else void promise; };

async function adminId(req: Request, db: any) {
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer /, '');
  const { data } = await db.auth.getUser(jwt);
  if (!data.user) return null;
  const { data: allowed } = await db.rpc('has_role', { _user_id: data.user.id, _role: 'admin' });
  return allowed ? data.user.id : null;
}

async function sendMail(db: any, submission: any) {
  if (submission.is_test || isTestEmail(submission.email)) {
    await db.from('playbook_submissions').update({ mail_status: 'skipped_test' }).eq('id', submission.id);
    return;
  }
  if (['queued', 'sent'].includes(submission.mail_status)) return;
  try {
    const { data, error } = await db.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'leads-playbook-result', recipientEmail: submission.email,
        idempotencyKey: `leads-playbook-result-${submission.id}`,
        templateData: { name: submission.first_name, url: `https://hub.marketlab-media.de/playbook/download/${submission.token}` },
      },
    });
    await db.from('playbook_submissions').update({ mail_status: error || data?.error ? 'failed' : 'queued' }).eq('id', submission.id);
    const source = [submission.attribution?.utm_campaign, submission.attribution?.utm_content].filter(Boolean).join('/') || 'direkt';
    try {
      await db.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'leads-playbook-owner',
          idempotencyKey: `leads-playbook-owner-${submission.id}`,
          templateData: { name: `${submission.first_name} ${submission.last_name}`, email: submission.email, phone: submission.phone, source },
        },
      });
    } catch (ownerError) { console.error('playbook owner mail failed', ownerError); }
  } catch {
    await db.from('playbook_submissions').update({ mail_status: 'failed' }).eq('id', submission.id);
  }
}

async function notifySlack(db: any, submission: any) {
  if (submission.is_test || isTestEmail(submission.email) || submission.slack_status) return;
  const hook = Deno.env.get('SLACK_WEBHOOK_URL');
  if (!hook) { await db.from('playbook_submissions').update({ slack_status: 'missing_secret' }).eq('id', submission.id); return; }
  const source = [submission.attribution?.utm_campaign, submission.attribution?.utm_content].filter(Boolean).join('/') || 'direkt';
  try {
    const response = await fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: `📘 Neues Playbook · ${submission.first_name} · Quelle ${source}\n<https://hub.marketlab-media.de/crm/lead/${submission.lead_id || ''}|Lead im CRM öffnen>` }) });
    await db.from('playbook_submissions').update({ slack_status: response.ok ? 'sent' : 'failed' }).eq('id', submission.id);
  } catch {
    await db.from('playbook_submissions').update({ slack_status: 'failed' }).eq('id', submission.id);
  }
}

async function postSubmit(db: any, id: string) {
  const { data: fresh } = await db.from('playbook_submissions').select('*').eq('id', id).single();
  if (!fresh) return;
  try { await db.functions.invoke('playbook-pdf', { body: { token: fresh.token } }); } catch (error) { console.error('playbook pdf invocation failed', error); }
  await sendMail(db, fresh);
  await notifySlack(db, fresh);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (!['GET', 'POST'].includes(req.method)) return json({ error: 'method_not_allowed' }, 405);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const url = new URL(req.url);
  const action = url.searchParams.get('action') || (req.method === 'GET' ? 'lead' : 'submit');
  const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  try {
    if (Number(req.headers.get('content-length') || 0) > 20000) return json({ error: 'too_large' }, 413);
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};

    if (action === 'settings') {
      const [settings, trust] = await Promise.all([
        db.from('playbook_settings').select('aktion_bis,cover_bild_url').eq('id', true).maybeSingle(),
        db.from('vertriebs_check_settings').select('trustpilot_score,trustpilot_reviews').eq('id', true).maybeSingle(),
      ]);
      if (settings.error || trust.error) throw settings.error || trust.error;
      return json({ aktion_bis: settings.data?.aktion_bis || null, cover_bild_url: settings.data?.cover_bild_url || null, trustpilot_score: Number(trust.data?.trustpilot_score ?? 4.4), trustpilot_reviews: trust.data?.trustpilot_reviews ?? 11 });
    }

    if (action === 'event') {
      const event = eventSchema.parse(body);
      if (!await consentAllowed(db, event.consent_id)) return json({ ignored: true });
      const a = event.attribution || {};
      const { error } = await db.from('positioning_funnel_events').insert({
        funnel: 'leads-playbook', session_id: event.session_id, step: event.step, event_id: event.event_id,
        variant: event.variant || null, utm_source: a.utm_source || null, utm_medium: a.utm_medium || null,
        utm_campaign: a.utm_campaign || null, utm_content: a.utm_content || null, utm_term: a.utm_term || null, fbclid: a.fbclid || null,
      });
      if (error?.code === '23505') return json({ duplicate: true });
      if (error) throw error;
      return json({ saved: true });
    }

    if (action === 'lead') {
      const token = uuid.parse(url.searchParams.get('token') || body.token);
      const { data, error } = await db.from('playbook_submissions').select('first_name,last_name,email,berater_typ,umsatz_stufe,step2_completed_at').eq('token', token).maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: 'Dieser Playbook-Link ist ungültig.' }, 404);
      return json(data);
    }

    if (action === 'step2' || action === 'skip') {
      const token = uuid.parse(body.token);
      const { data: submission, error } = await db.from('playbook_submissions').select('*').eq('token', token).maybeSingle();
      if (error) throw error;
      if (!submission) return json({ error: 'Dieser Playbook-Link ist ungültig.' }, 404);
      if (action === 'skip') {
        const { error: saveError } = await db.from('playbook_submissions').update({ skipped_at: new Date().toISOString(), step2_completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', submission.id);
        if (saveError) throw saveError;
        return json({ success: true });
      }
      const answers = z.object({ berater_typ: z.enum(BERATER), umsatz_stufe: z.enum(UMSATZ) }).parse(body);
      const { error: saveError } = await db.from('playbook_submissions').update({ ...answers, step2_completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', submission.id);
      if (saveError) throw saveError;
      try {
        if (submission.contact_id) {
          const { data: contact } = await db.from('crm_contacts').select('tags').eq('id', submission.contact_id).maybeSingle();
          const tags = [...new Set([...(contact?.tags || []), `berater:${answers.berater_typ}`])];
          await db.from('crm_contacts').update({ tags }).eq('id', submission.contact_id);
        }
        if (submission.lead_id) {
          await db.from('crm_leads').update({ next_step: `Anrufen (15 Min) – Playbook, ${answers.berater_typ}, ${answers.umsatz_stufe}`, last_activity_at: new Date().toISOString() }).eq('id', submission.lead_id);
        }
      } catch (crmError) { console.error('playbook step2 CRM sync failed', crmError); }
      return json({ success: true });
    }

    if (action === 'download') {
      const token = uuid.parse(body.token || url.searchParams.get('token'));
      let { data: submission, error } = await db.from('playbook_submissions').select('*').eq('token', token).maybeSingle();
      if (error) throw error;
      if (!submission) return json({ error: 'Dieser Download-Link ist ungültig.' }, 404);
      if (!submission.pdf_path || submission.pdf_status !== 'ready') {
        try { await db.functions.invoke('playbook-pdf', { body: { token } }); } catch (pdfError) { console.error('playbook download generation failed', pdfError); }
        const fresh = await db.from('playbook_submissions').select('*').eq('token', token).maybeSingle();
        submission = fresh.data || submission;
      }
      const path = submission.pdf_status === 'ready' && submission.pdf_path ? submission.pdf_path : FALLBACK_PATH;
      const first = cleanName(submission.first_name).replace(/\s+/g, '-') || 'Playbook';
      const last = cleanName(submission.last_name).replace(/\s+/g, '-') || '2027';
      const filename = path === FALLBACK_PATH ? 'Leads-Playbook-2027_ohne-Name.pdf' : `Leads-Playbook-2027_${first}-${last}.pdf`;
      const { data, error: signError } = await db.storage.from('playbook').createSignedUrl(path, 3600, { download: filename });
      if (signError || !data?.signedUrl) return json({ error: 'Das PDF ist noch nicht verfügbar. Bitte versuche es gleich erneut.' }, 404);
      return json({ url: data.signedUrl, fallback: path === FALLBACK_PATH });
    }

    if (action === 'status') {
      const id = uuid.parse(body.submission_id);
      const { data: submission, error } = await db.from('playbook_submissions').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!submission || submission.is_test || !submission.tracking_consent || !submission.advertising_consent_id || !await consentAllowed(db, submission.advertising_consent_id)) return json({ ignored: true });
      const { data: lead } = submission.lead_id ? await db.from('crm_leads').select('deal_value').eq('id', submission.lead_id).maybeSingle() : { data: null };
      const output: Record<string, string> = {};
      for (const [name, at, sent] of [['Schedule', 'termin_at', 'schedule_sent_at'], ['Purchase', 'abschluss_at', 'purchase_sent_at']] as const) {
        if (!submission[at] || submission[sent]) continue;
        const { data: claimed } = await db.from('playbook_submissions').update({ [sent]: new Date().toISOString() }).eq('id', submission.id).is(sent, null).select('id').maybeSingle();
        if (!claimed) continue;
        const eventTime = Math.floor(new Date(submission[at]).getTime() / 1000);
        const result = await sendPlaybookMeta(db, { submission, event_name: name, event_id: `${submission.id}-${name.toLowerCase()}`, event_time: Date.now() / 1000 - eventTime > 7 * 86400 ? Math.floor(Date.now() / 1000) : eventTime, custom_data: name === 'Purchase' ? { value: Number(lead?.deal_value || 0), currency: 'EUR' } : undefined });
        if (result.status !== 'accepted') await db.from('playbook_submissions').update({ [sent]: null }).eq('id', submission.id);
        output[name] = result.status;
      }
      return json(output);
    }

    if (action === 'upload_url' || action === 'files' || action === 'cleanup_test') {
      if (!await adminId(req, db)) return json({ error: 'forbidden' }, 403);
      if (action === 'cleanup_test') {
        const token = uuid.parse(body.token);
        const { data: test } = await db.from('playbook_submissions').select('id,pdf_path').eq('token', token).eq('is_test', true).maybeSingle();
        if (!test) return json({ success: true, removed: false });
        if (test.pdf_path?.startsWith('leads/')) {
          const { error: removeError } = await db.storage.from('playbook').remove([test.pdf_path]);
          if (removeError) throw removeError;
        }
        const { error: deleteError } = await db.from('playbook_submissions').delete().eq('id', test.id).eq('is_test', true);
        if (deleteError) throw deleteError;
        return json({ success: true, removed: true });
      }
      if (action === 'files') {
        const { data, error } = await db.storage.from('playbook').list('vorlage', { limit: 20, sortBy: { column: 'name', order: 'asc' } });
        if (error) throw error;
        return json({ files: (data || []).filter((file: any) => file.name !== '.emptyFolderPlaceholder').map((file: any) => ({ name: file.name, size: file.metadata?.size || 0, updated_at: file.updated_at || file.created_at })) });
      }
      const kind = z.enum(['vorlage', 'ohne_name']).parse(body.datei);
      const path = kind === 'vorlage' ? TEMPLATE_PATH : FALLBACK_PATH;
      const { data, error } = await db.storage.from('playbook').createSignedUploadUrl(path, { upsert: true });
      if (error) throw error;
      return json({ ...data, path });
    }

    if (action !== 'submit') return json({ error: 'unknown_action' }, 400);
    const parsed = submitSchema.parse(body);
    const ipHash = await sha256(ip);
    const { data: allowed, error: rateError } = await db.rpc('vc_rate_limit', { _key: `playbook-submit:${ipHash}`, _max: 20 });
    if (rateError || !allowed) return json({ error: 'Bitte später erneut versuchen.' }, 429);
    const cleaned = { ...parsed, first_name: cleanName(parsed.first_name), last_name: cleanName(parsed.last_name), phone: normalizePhone(parsed.phone), email: parsed.email.toLowerCase() };
    if (!cleaned.first_name || !cleaned.last_name || !/^\+[0-9]{7,15}$/.test(cleaned.phone)) return json({ error: 'Bitte prüfe Name und Telefonnummer.' }, 400);
    const { data: result, error } = await db.rpc('playbook_submit', { _data: cleaned });
    if (error) throw error;
    const test = isTestEmail(cleaned.email);
    let tracked = false;
    if (!result.existing) {
      const consent = !test && !!parsed.advertising_consent_id && !!parsed.session_id && await consentAllowed(db, parsed.advertising_consent_id);
      const a = parsed.attribution || {};
      await db.from('playbook_submissions').update({
        attribution: a, tracking_consent: consent, advertising_consent_id: consent ? parsed.advertising_consent_id : null,
        session_id: consent ? parsed.session_id : null, fbp: consent ? parsed.fbp || null : null, fbc: consent ? parsed.fbc || null : null,
        client_ip: consent && ip !== 'unknown' ? ip : null, client_user_agent: consent ? req.headers.get('user-agent') : null,
        updated_at: new Date().toISOString(),
      }).eq('id', result.id);
      if (result.lead_id) {
        const { data: lead } = await db.from('crm_leads').select('vertriebs_check_data').eq('id', result.lead_id).maybeSingle();
        await db.from('crm_leads').update({ vertriebs_check_data: { ...(lead?.vertriebs_check_data || {}), attribution: a, tracking_consent: consent } }).eq('id', result.lead_id);
      }
      if (consent && parsed.event_id) {
        await db.from('positioning_funnel_events').insert({ funnel: 'leads-playbook', session_id: parsed.session_id, step: 'eingetragen', event_id: parsed.event_id, variant: parsed.variant || null, utm_source: a.utm_source || null, utm_medium: a.utm_medium || null, utm_campaign: a.utm_campaign || null, utm_content: a.utm_content || null, utm_term: a.utm_term || null, fbclid: a.fbclid || null });
        tracked = true;
        const { data: fresh } = await db.from('playbook_submissions').select('*').eq('id', result.id).single();
        background(sendPlaybookMeta(db, { submission: fresh, event_name: 'Lead', event_id: parsed.event_id }));
      }
      background(postSubmit(db, result.id));
    }
    return json({ token: result.token, tracked });
  } catch (error) {
    if (error instanceof z.ZodError) return json({ error: 'Bitte prüfe deine Angaben.', fields: error.flatten() }, 400);
    console.error('playbook function failed', action, error instanceof Error ? error.message : 'unknown');
    return json({ error: 'Das hat nicht geklappt. Bitte erneut versuchen.' }, 500);
  }
});
