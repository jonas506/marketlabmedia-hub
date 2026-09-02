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
        document: offer.document,
        offer_number: offer.offer_number,
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
            .from('crm_leads').select('name, contact_name').eq('id', offer.lead_id).maybeSingle();
          leadName = lead?.name || lead?.contact_name || null;
        }
        const clientName = leadName || offer.recipient_name || offer.recipient_email;
        const { data: newClient, error: cErr } = await supabase
          .from('clients').insert({
            name: clientName,
            status: 'active',
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

      const acceptedAtIso = new Date().toISOString();
      await supabase.from('offers').update({
        status: 'accepted',
        accepted_at: acceptedAtIso,
        client_id: clientId,
      }).eq('id', offer.id);

      // PDF erzeugen, unter Dokumente ablegen und dem Kunden per Mail bestätigen
      try {
        const acceptedAtLabel = new Date(acceptedAtIso).toLocaleString('de-DE', {
          timeZone: 'Europe/Berlin',
        }) + ' Uhr';
        const acceptedBy = offer.recipient_name || offer.recipient_company || 'Kunde';
        const docJson = offer.document && typeof offer.document === 'object' ? offer.document : {};
        const pdfBytes = await buildOfferPdf(docJson, {
          acceptedAt: acceptedAtLabel,
          acceptedBy,
          acceptedEmail: offer.recipient_email,
        });

        const safeNumber = String(offer.offer_number || offer.id.slice(0, 8)).replace(/[^\w.-]+/g, '-');
        const fileName = `Angebot-${safeNumber}-angenommen.pdf`;
        const filePath = `offers/${offer.id}/${fileName}`;
        await supabase.storage.from('documents').upload(filePath, pdfBytes, {
          contentType: 'application/pdf',
          upsert: true,
        });

        const hashBuf = await crypto.subtle.digest('SHA-256', pdfBytes);
        const fileHash = Array.from(new Uint8Array(hashBuf))
          .map((b) => b.toString(16).padStart(2, '0')).join('');

        const { data: sigDoc } = await supabase.from('signature_documents').insert({
          title: `Angebot ${offer.offer_number || ''} – ${offer.plan_name || ''}`.trim(),
          file_path: filePath,
          file_name: fileName,
          file_hash: fileHash,
          file_size: pdfBytes.byteLength,
          recipient_name: offer.recipient_name,
          recipient_email: offer.recipient_email,
          lead_id: offer.lead_id,
          client_id: clientId,
          subject: offer.subject || `Angebot ${offer.offer_number || ''}`,
          message_body: 'Automatisch erzeugt aus dem angenommenen Angebot.',
          status: 'accepted',
          sent_at: acceptedAtIso,
          accepted_at: acceptedAtIso,
        }).select('id').single();

        if (sigDoc) {
          await supabase.from('signature_acceptances').insert({
            document_id: sigDoc.id,
            typed_name: acceptedBy,
            consent_text: 'Angebot wurde über den persönlichen Angebotslink verbindlich angenommen.',
            ip_address: req.headers.get('x-forwarded-for'),
            user_agent: req.headers.get('user-agent'),
            file_hash: fileHash,
            accepted_at: acceptedAtIso,
          });
        }

        const resendApiKey = Deno.env.get('RESEND_API_KEY');
        if (resendApiKey) {
          const b64 = base64(pdfBytes);
          const greet = (offer.recipient_name || '').split(' ')[0];
          const html = `
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#0B0B0F;line-height:1.65;max-width:620px;margin:0 auto;padding:24px">
              <p style="font-size:11px;letter-spacing:2px;color:#2F6BFF;font-weight:700;margin:0 0 16px">ANGEBOT ANGENOMMEN</p>
              <p>Hallo${greet ? ' ' + greet : ''},</p>
              <p>vielen Dank – dein Angebot <strong>${offer.offer_number || ''}</strong> wurde am ${acceptedAtLabel} verbindlich angenommen. Damit ist der Vertrag zustande gekommen.</p>
              <p>Im Anhang findest du das vollständige Angebot inklusive Annahmebestätigung als PDF für deine Unterlagen.</p>
              <p>Wir melden uns zeitnah mit den nächsten Schritten zum Start.</p>
              <p style="color:#999;font-size:12px;margin-top:24px">Marketlab Media</p>
            </div>`;
          const text = [
            `Hallo${greet ? ' ' + greet : ''},`,
            `dein Angebot ${offer.offer_number || ''} wurde am ${acceptedAtLabel} verbindlich angenommen.`,
            'Im Anhang findest du das Angebot inkl. Annahmebestätigung als PDF.',
            '',
            'Marketlab Media',
          ].join('\n');

          const mailRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendApiKey}` },
            body: JSON.stringify({
              from: 'Marketlab Media <noreply@marketlabmedia.de>',
              to: [offer.recipient_email],
              bcc: ['jonas@marketlab-media.de'],
              reply_to: 'jonas@marketlab-media.de',
              subject: `Bestätigung: Angebot ${offer.offer_number || ''} angenommen`,
              html,
              text,
              attachments: [{ filename: fileName, content: b64 }],
            }),
          });
          if (!mailRes.ok) console.error('offer confirmation mail failed:', await mailRes.text());
        }
      } catch (postErr) {
        // Annahme darf nie an PDF/Mail scheitern
        console.error('offer accept post-processing failed:', postErr);
      }


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
