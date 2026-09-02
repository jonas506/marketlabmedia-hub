import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) throw new Error('RESEND_API_KEY missing');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No auth');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (authErr || !user) throw new Error('Unauthorized');

    // Verify admin
    const { data: roleRow } = await supabase
      .from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    if (!roleRow) throw new Error('Forbidden — admin only');

    const { offerId } = await req.json();
    if (!offerId) throw new Error('offerId required');

    const { data: offer, error: oErr } = await supabase
      .from('offers').select('*').eq('id', offerId).single();
    if (oErr || !offer) throw new Error('Offer not found');

    const rawEmail = String(offer.recipient_email ?? '').trim();
    // Falls z. B. "Max <max@firma.de>" gespeichert wurde: Adresse extrahieren
    const bracket = rawEmail.match(/<([^>]+)>/);
    const recipientEmail = (bracket ? bracket[1] : rawEmail).trim().replace(/^mailto:/i, '');
    if (!recipientEmail) throw new Error('Recipient email missing');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail))
      throw new Error(`Invalid recipient email: "${recipientEmail}"`);
    offer.recipient_email = recipientEmail;

    // Immer die eigene Domain – niemals Preview-/Lovable-URLs an Kunden schicken
    const acceptUrl = `https://hub.marketlab-media.de/angebot/${offer.token}`;

    // Get sender name
    const { data: profile } = await supabase
      .from('profiles').select('name, email').eq('user_id', user.id).single();
    const senderName = (profile?.name || 'Marketlab Media').replace(/[^\p{L}\p{N} .\-]/gu, '').trim() || 'Marketlab Media';
    // Anzeigename fix halten – variable Namen im From-Header lösen Gmail-Spoofing-Warnungen aus.
    const fromAddress = 'Marketlab Media <noreply@marketlabmedia.de>';

    const doc: any = offer.document && typeof offer.document === 'object' ? offer.document : null;
    const positions: any[] = Array.isArray(doc?.positions) ? doc.positions : [];
    const total = positions.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const fmt = (n: number) => `${n.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`;
    const esc = (v: unknown) => String(v ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
    const greetName = (offer.recipient_name || '').split(' ')[0];

    const summaryRows = positions
      .map((p) => `<tr><td style="padding:8px 0;border-bottom:1px solid #E4E9F2;font-size:14px;">${esc(p.title)}</td><td style="padding:8px 0;border-bottom:1px solid #E4E9F2;font-size:14px;text-align:right;font-weight:700;white-space:nowrap;">${p.amount > 0 ? fmt(Number(p.amount)) : '—'}</td></tr>`)
      .join('');

    const html = doc
      ? `
      <div style="font-family: Arial, Helvetica, sans-serif; font-size:15px; color:#0B0B0F; line-height:1.65; max-width:620px; margin:0 auto; padding:24px;">
        <p style="font-size:11px;letter-spacing:2px;color:#2F6BFF;font-weight:700;margin:0 0 16px;">ANGEBOT ${esc(offer.offer_number || '')}</p>
        <p>Hallo${greetName ? ' ' + esc(greetName) : ''},</p>
        <p>vielen Dank für das gute Gespräch. Hier ist unser Angebot <strong>${esc(doc.titleMain || offer.plan_name)}</strong> im Überblick:</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;">${summaryRows}
          <tr><td style="padding:14px 0 0;font-size:16px;font-weight:700;">Gesamt netto</td><td style="padding:14px 0 0;font-size:20px;font-weight:800;text-align:right;">${fmt(total)}</td></tr>
        </table>
        <p style="font-size:13px;color:#5A6377;">Das vollständige Angebot mit allen Details, Leistungen und Zahlungsplan findest du unter dem Button – dort kannst du es mit einem Klick verbindlich annehmen.</p>
        <div style="margin:32px 0;text-align:center;">
          <a href="${acceptUrl}" style="display:inline-block;padding:16px 32px;background:linear-gradient(135deg,#0083F7,#21089B);color:#fff;text-decoration:none;border-radius:12px;font-weight:700;font-size:15px;">Angebot ansehen &amp; annehmen</a>
        </div>
        <p style="color:#8B94A7;font-size:12px;">Oder öffne diesen Link: <a href="${acceptUrl}" style="color:#0083F7;">${acceptUrl}</a></p>
      </div>
    `
      : `
      <div style="font-family: Arial, sans-serif; font-size: 15px; color: #1E1E24; line-height: 1.65; max-width: 640px; margin: 0 auto; padding: 24px;">
        ${offer.custom_body || ''}
        <div style="margin: 36px 0; text-align: center;">
          <a href="${acceptUrl}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg,#0083F7,#21089B); color:#fff; text-decoration:none; border-radius: 12px; font-weight: 700; font-size: 15px;">
            Angebot ansehen &amp; annehmen
          </a>
        </div>
        <p style="color:#666; font-size: 12px; margin-top: 32px;">Oder öffne diesen Link: <a href="${acceptUrl}" style="color:#0083F7;">${acceptUrl}</a></p>
      </div>
    `;

    const text = [
      doc ? `Angebot ${offer.offer_number || ''} — Gesamt netto ${fmt(total)}` : (offer.custom_body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      '',
      `Angebot ansehen & annehmen: ${acceptUrl}`,
      '',
      `${senderName} · Marketlab Media`,
    ].filter(Boolean).join('\n');

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [offer.recipient_email],
        subject: offer.subject,
        html,
        text,
        reply_to: profile?.email || user.email,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Email send failed: ${t}`);
    }

    await supabase.from('offers').update({
      status: 'sent',
      sent_at: new Date().toISOString(),
    }).eq('id', offerId);

    if (offer.lead_id) {
      await supabase.from('crm_activities').insert({
        lead_id: offer.lead_id,
        type: 'email',
        title: `📄 Angebot gesendet: ${offer.plan_name}`,
        body: `An: ${offer.recipient_email}\nBetreff: ${offer.subject}\nLink: ${acceptUrl}`,
        created_by: user.id,
      });
    }

    return new Response(JSON.stringify({ success: true, acceptUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('offer-send error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
