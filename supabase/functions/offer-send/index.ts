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

    const { offerId, appUrl } = await req.json();
    if (!offerId) throw new Error('offerId required');

    const { data: offer, error: oErr } = await supabase
      .from('offers').select('*').eq('id', offerId).single();
    if (oErr || !offer) throw new Error('Offer not found');

    if (!offer.recipient_email) throw new Error('Recipient email missing');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(offer.recipient_email))
      throw new Error('Invalid recipient email');

    const acceptUrl = `${appUrl || 'https://hub.marketlab-media.de'}/angebot/${offer.token}`;

    // Get sender name
    const { data: profile } = await supabase
      .from('profiles').select('name, email').eq('user_id', user.id).single();
    const senderName = profile?.name || 'Marketlab Media';
    const fromAddress = `${senderName} <noreply@marketlabmedia.de>`;

    const html = `
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

    const res = await fetch('https://connector-gateway.lovable.dev/resend/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY') ?? ''}`,
        'X-Connection-Api-Key': resendApiKey,
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [offer.recipient_email],
        subject: offer.subject,
        html,
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
