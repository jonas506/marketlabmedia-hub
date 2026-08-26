import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const CONSENT_TEXT =
  'Ich habe das Dokument gelesen und nehme es hiermit verbindlich an. Mit dieser Bestätigung kommt ein rechtsgültiger Vertrag zustande.';

const APP_URL = 'https://hub.marketlab-media.de';

async function sendMail(to: string[], subject: string, html: string) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) return;
  try {
    await fetch('https://connector-gateway.lovable.dev/resend/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('LOVABLE_API_KEY') ?? ''}`,
        'X-Connection-Api-Key': resendApiKey,
      },
      body: JSON.stringify({
        from: 'Marketlab Media <noreply@marketlabmedia.de>',
        to,
        subject,
        html,
      }),
    });
  } catch (e) {
    console.error('mail failed', e);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    let token: string | null = null;
    let body: Record<string, unknown> = {};

    if (req.method === 'POST') {
      body = await req.json().catch(() => ({}));
      token = typeof body.token === 'string' ? body.token : null;
    } else {
      token = new URL(req.url).searchParams.get('token');
    }

    if (!token || !/^[a-f0-9]{20,80}$/.test(token)) return json({ error: 'Ungültiger Link' }, 400);

    const { data: doc, error } = await supabase
      .from('signature_documents')
      .select('*')
      .eq('token', token)
      .maybeSingle();
    if (error) throw error;
    if (!doc || doc.status === 'draft') return json({ error: 'Dokument nicht gefunden' }, 404);
    if (doc.status === 'revoked') return json({ error: 'Dieses Dokument wurde zurückgezogen.' }, 410);

    const expired = doc.expires_at && new Date(doc.expires_at) < new Date();
    if (expired && doc.status !== 'accepted') {
      return json({ error: 'Der Link ist abgelaufen.' }, 410);
    }

    // signed URL for the PDF (1 hour)
    const { data: signed } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.file_path, 3600);

    if (req.method === 'GET') {
      if (doc.status === 'sent') {
        await supabase
          .from('signature_documents')
          .update({ status: 'viewed', viewed_at: new Date().toISOString() })
          .eq('id', doc.id);
      }

      let acceptance: Record<string, unknown> | null = null;
      if (doc.status === 'accepted') {
        const { data: a } = await supabase
          .from('signature_acceptances')
          .select('typed_name, accepted_at, consent_text')
          .eq('document_id', doc.id)
          .maybeSingle();
        acceptance = a ?? null;
      }

      return json({
        id: doc.id,
        title: doc.title,
        subject: doc.subject,
        message_body: doc.message_body,
        recipient_name: doc.recipient_name,
        file_name: doc.file_name,
        status: doc.status,
        accepted_at: doc.accepted_at,
        expires_at: doc.expires_at,
        consent_text: CONSENT_TEXT,
        pdf_url: signed?.signedUrl ?? null,
        acceptance,
      });
    }

    // POST → accept
    if (doc.status === 'accepted') {
      return json({ success: true, alreadyAccepted: true });
    }

    const typedName = typeof body.typed_name === 'string' ? body.typed_name.trim() : '';
    const consent = body.consent === true;
    if (typedName.length < 2 || typedName.length > 120) {
      return json({ error: 'Bitte gib deinen vollständigen Namen ein.' }, 400);
    }
    if (!consent) return json({ error: 'Bitte bestätige die Annahme über die Checkbox.' }, 400);

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('cf-connecting-ip') ??
      null;
    const ua = req.headers.get('user-agent')?.slice(0, 500) ?? null;
    const acceptedAt = new Date();

    const { error: aErr } = await supabase.from('signature_acceptances').insert({
      document_id: doc.id,
      typed_name: typedName,
      consent_text: CONSENT_TEXT,
      ip_address: ip,
      user_agent: ua,
      file_hash: doc.file_hash,
      accepted_at: acceptedAt.toISOString(),
    });
    if (aErr) throw aErr;

    await supabase
      .from('signature_documents')
      .update({ status: 'accepted', accepted_at: acceptedAt.toISOString() })
      .eq('id', doc.id);

    // Confirmation emails with 7-day download link
    const { data: longSigned } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.file_path, 60 * 60 * 24 * 7);

    const stamp = acceptedAt.toLocaleString('de-DE', { timeZone: 'Europe/Berlin' });
    const protocol = `
      <table style="width:100%;border-collapse:collapse;font-size:13px;color:#333;margin-top:8px">
        <tr><td style="padding:6px 0;color:#777">Dokument</td><td style="padding:6px 0"><strong>${doc.title}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#777">Angenommen von</td><td style="padding:6px 0"><strong>${typedName}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#777">E-Mail</td><td style="padding:6px 0">${doc.recipient_email}</td></tr>
        <tr><td style="padding:6px 0;color:#777">Zeitpunkt</td><td style="padding:6px 0">${stamp} (Europe/Berlin)</td></tr>
        <tr><td style="padding:6px 0;color:#777">IP-Adresse</td><td style="padding:6px 0">${ip ?? '—'}</td></tr>
        <tr><td style="padding:6px 0;color:#777">Gerät</td><td style="padding:6px 0;word-break:break-all">${ua ?? '—'}</td></tr>
        <tr><td style="padding:6px 0;color:#777">Datei-Prüfsumme</td><td style="padding:6px 0;word-break:break-all">${doc.file_hash ?? '—'}</td></tr>
      </table>
      <p style="font-size:12px;color:#777;margin-top:14px">Zustimmungstext: „${CONSENT_TEXT}"</p>
    `;

    const html = `
      <div style="font-family:Arial,sans-serif;font-size:15px;color:#1E1E24;line-height:1.6;max-width:640px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 8px">Annahme bestätigt</h2>
        <p>Das Dokument <strong>${doc.title}</strong> wurde verbindlich angenommen.</p>
        <div style="margin:24px 0;text-align:center">
          <a href="${longSigned?.signedUrl ?? APP_URL}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#0083F7,#21089B);color:#fff;text-decoration:none;border-radius:12px;font-weight:700">Dokument herunterladen</a>
        </div>
        <h3 style="font-size:14px;margin:24px 0 0;text-transform:uppercase;letter-spacing:.08em;color:#777">Annahme-Protokoll</h3>
        ${protocol}
        <p style="font-size:12px;color:#999;margin-top:24px">Der Download-Link ist 7 Tage gültig.</p>
      </div>`;

    await sendMail([doc.recipient_email], `Bestätigt: ${doc.title}`, html);

    const { data: admins } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');
    const adminIds = (admins ?? []).map((a: { user_id: string }) => a.user_id);
    if (adminIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('email')
        .in('user_id', adminIds);
      const emails = (profs ?? []).map((p: { email: string }) => p.email).filter(Boolean);
      if (emails.length > 0) {
        await sendMail(
          emails,
          `✅ Angenommen: ${doc.title} — ${typedName}`,
          `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1E1E24;max-width:640px;margin:0 auto;padding:24px">
            <h2 style="margin:0 0 8px">Dokument angenommen</h2>
            <p><strong>${typedName}</strong> hat „${doc.title}" verbindlich angenommen.</p>
            ${protocol}
            <p style="margin-top:24px"><a href="${APP_URL}/dokumente" style="color:#0083F7">Im Hub öffnen</a></p>
          </div>`,
        );
      }
    }

    return json({ success: true, accepted_at: acceptedAt.toISOString(), typed_name: typedName });
  } catch (e) {
    console.error('document-public error:', e);
    return json({ error: (e as Error).message }, 400);
  }
});
