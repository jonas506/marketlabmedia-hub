import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token') ?? (req.method === 'POST' ? (await req.clone().json())?.token : null);
    if (!token || !/^[a-f0-9]{16,80}$/.test(token)) throw new Error('Invalid token');

    const { data: offer, error } = await supabase
      .from('offers').select('*').eq('token', token).maybeSingle();
    if (error) throw error;
    if (!offer) throw new Error('Offer not found');

    // GET: return public view + mark viewed
    if (req.method === 'GET') {
      if (offer.status === 'sent') {
        await supabase.from('offers').update({
          status: 'viewed', viewed_at: new Date().toISOString(),
        }).eq('id', offer.id);
      }
      const publicOffer = {
        id: offer.id,
        plan_name: offer.plan_name,
        duration_months: offer.duration_months,
        monthly_price: offer.monthly_price,
        setup_price: offer.setup_price,
        discount_pct: offer.discount_pct,
        addons: offer.addons,
        subject: offer.subject,
        custom_body: offer.custom_body,
        recipient_name: offer.recipient_name,
        status: offer.status,
        accepted_at: offer.accepted_at,
      };
      return new Response(JSON.stringify(publicOffer), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST: accept
    if (req.method === 'POST') {
      if (offer.status === 'accepted') {
        return new Response(JSON.stringify({ success: true, alreadyAccepted: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Resolve or create client
      let clientId = offer.client_id;
      if (!clientId) {
        // Try lead first
        let leadName: string | null = null;
        if (offer.lead_id) {
          const { data: lead } = await supabase
            .from('crm_leads').select('company_name, first_name, last_name').eq('id', offer.lead_id).maybeSingle();
          leadName = lead?.company_name || [lead?.first_name, lead?.last_name].filter(Boolean).join(' ') || null;
        }
        const clientName = leadName || offer.recipient_name || offer.recipient_email;
        const { data: newClient, error: cErr } = await supabase
          .from('clients').insert({
            name: clientName,
            status: 'onboarding',
            contact_email: offer.recipient_email,
            contact_name: offer.recipient_name,
          }).select('id').single();
        if (cErr) throw cErr;
        clientId = newClient.id;
      }

      // Create contract
      const start = new Date();
      const startStr = start.toISOString().slice(0, 10);
      const end = new Date(start);
      end.setMonth(end.getMonth() + offer.duration_months);
      end.setDate(end.getDate() - 1);
      const endStr = end.toISOString().slice(0, 10);

      const addonNote = Array.isArray(offer.addons) && offer.addons.length > 0
        ? `\n\nAdd-ons (nach Nutzung abgerechnet):\n${(offer.addons as any[]).map((a: any) => `• ${a.name}: ${a.price_text}`).join('\n')}`
        : '';
      const note = `Automatisch aus Angebot ${offer.id.slice(0, 8)}\nSetup: ${offer.setup_price} € netto${offer.discount_pct > 0 ? `\nRabatt: ${offer.discount_pct}%` : ''}${addonNote}`;

      const { data: contract, error: ctrErr } = await supabase
        .from('client_contracts').insert({
          client_id: clientId,
          start_date: startStr,
          billing_start_date: startStr,
          end_date: endStr,
          duration_months: offer.duration_months,
          note,
          status: 'active',
        }).select('id').single();
      if (ctrErr) throw ctrErr;

      // Monthly rows
      const monthRows = [];
      for (let i = 0; i < offer.duration_months; i++) {
        const d = new Date(start);
        d.setMonth(d.getMonth() + i);
        monthRows.push({
          contract_id: contract.id,
          month_number: i + 1,
          billing_month: d.getMonth() + 1,
          billing_year: d.getFullYear(),
          amount_netto: offer.monthly_price,
          invoice_status: 'upcoming',
        });
      }
      const { error: mErr } = await supabase.from('client_contract_months').insert(monthRows);
      if (mErr) throw mErr;

      await supabase.from('offers').update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        client_id: clientId,
      }).eq('id', offer.id);

      if (offer.lead_id) {
        await supabase.from('crm_activities').insert({
          lead_id: offer.lead_id,
          type: 'note',
          title: `✅ Angebot angenommen: ${offer.plan_name}`,
          body: `Vertrag automatisch angelegt (${offer.duration_months} Monate à ${offer.monthly_price} € netto).`,
        });
      }

      return new Response(JSON.stringify({ success: true, contractId: contract.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  } catch (e: any) {
    console.error('offer-public error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
