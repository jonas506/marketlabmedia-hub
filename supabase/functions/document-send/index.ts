import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) throw new Error('RESEND_API_KEY fehlt');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Nicht angemeldet');
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authErr || !user) throw new Error('Nicht autorisiert');

    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    if (!roleRow) throw new Error('Nur Administratoren dürfen Dokumente versenden');

    const { documentId, reminder } = await req.json();
    if (!documentId) throw new Error('documentId fehlt');

    const { data: doc, error: dErr } = await supabase
      .from('signature_documents')
      .select('*')
      .eq('id', documentId)
      .single();
    if (dErr || !doc) throw new Error('Dokument nicht gefunden');
    if (doc.status === 'accepted') throw new Error('Dokument wurde bereits angenommen');
    if (doc.status === 'revoked') throw new Error('Dokument wurde zurückgezogen');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(doc.recipient_email ?? ''))
      throw new Error('Ungültige Empfänger-E-Mail');

    // Vertragslinks dürfen niemals von der Admin-/Preview-Domain abhängen.
    const link = `https://hub.marketlab-media.de/dokument/${doc.token}`;

    const { data: profile } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('user_id', user.id)
      .maybeSingle();
    // Anzeigename im From-Header immer fix & ASCII-sauber halten (Gmail-Spoofing-Warnung vermeiden).
    const senderName = (profile?.name || 'Marketlab Media').replace(/[^\p{L}\p{N} .\-]/gu, '').trim() || 'Marketlab Media';
    const fromAddress = 'Marketlab Media <noreply@marketlabmedia.de>';

    const greeting = doc.recipient_name ? `Hallo ${doc.recipient_name},` : 'Hallo,';
    const intro = reminder
      ? '<p>kurze Erinnerung: das folgende Dokument wartet noch auf deine Bestätigung.</p>'
      : '';
    const bodyHtml = (doc.message_body || '')
      .split('\n')
      .map((l: string) => `<p style="margin:0 0 10px">${l}</p>`)
      .join('');

    const html = `
      <div style="font-family:Arial,sans-serif;font-size:15px;color:#1E1E24;line-height:1.65;max-width:640px;margin:0 auto;padding:24px">
        <p>${greeting}</p>
        ${intro}
        ${bodyHtml}
        <div style="margin:32px 0;text-align:center">
          <a href="${link}" style="display:inline-block;padding:16px 32px;background:linear-gradient(135deg,#0083F7,#21089B);color:#fff;text-decoration:none;border-radius:12px;font-weight:700;font-size:15px">
            Dokument ansehen &amp; annehmen
          </a>
        </div>
        <p style="color:#666;font-size:12px">Oder öffne diesen Link: <a href="${link}" style="color:#0083F7">${link}</a></p>
        <p style="color:#999;font-size:12px;margin-top:24px">${senderName} · Marketlab Media</p>
      </div>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: `${senderName} <noreply@marketlabmedia.de>`,
        to: [doc.recipient_email],
        subject: reminder ? `Erinnerung: ${doc.subject}` : doc.subject,
        html,
        reply_to: profile?.email || user.email,
      }),
    });
    if (!res.ok) throw new Error(`E-Mail-Versand fehlgeschlagen: ${await res.text()}`);

    if (!reminder || doc.status === 'draft') {
      await supabase
        .from('signature_documents')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', doc.id);
    }

    if (doc.lead_id) {
      await supabase.from('crm_activities').insert({
        lead_id: doc.lead_id,
        type: 'email',
        title: `📄 Dokument ${reminder ? 'erinnert' : 'gesendet'}: ${doc.title}`,
        body: `An: ${doc.recipient_email}\nLink: ${link}`,
        created_by: user.id,
      });
    }

    return json({ success: true, link });
  } catch (e) {
    console.error('document-send error:', e);
    return json({ error: (e as Error).message }, 400);
  }
});
