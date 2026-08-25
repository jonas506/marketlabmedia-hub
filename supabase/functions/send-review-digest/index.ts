import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const FROM_ADDRESS = 'Marketlab Media <noreply@marketlabmedia.de>'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')

    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY is not configured')
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    // --- Test mode: send a sample digest to a given address ---
    let body: any = {}
    try { body = await req.json() } catch { /* no body */ }

    if (body?.test_email) {
      const { subject, html, text } = buildEmail(
        'Musterkunde GmbH',
        [
          { piece_type: 'reel', piece_title: 'Hook: 3 Fehler bei Kapitalanlagen' },
          { piece_type: 'reel', piece_title: 'Warum jetzt investieren?' },
          { piece_type: 'carousel', piece_title: 'Checkliste: Immobilienkauf' },
        ],
        'https://hub.marketlab-media.de/approve/demo-token'
      )

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM_ADDRESS, to: [body.test_email], subject: `[TEST] ${subject}`, html, text }),
      })
      const resBody = await res.text()
      return new Response(JSON.stringify({ test: true, ok: res.ok, response: resBody }), {
        status: res.ok ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }


    // Fetch unsent queue items
    const { data: queueItems, error: qErr } = await supabase
      .from('review_notification_queue')
      .select('*')
      .is('sent_at', null)
      .order('created_at', { ascending: true })

    if (qErr) throw qErr
    if (!queueItems || queueItems.length === 0) {
      return new Response(JSON.stringify({ message: 'No pending notifications' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Group by client_id
    const grouped: Record<string, typeof queueItems> = {}
    for (const item of queueItems) {
      if (!grouped[item.client_id]) grouped[item.client_id] = []
      grouped[item.client_id].push(item)
    }

    const results: { client: string; sent: boolean; error?: string }[] = []

    for (const [clientId, pieces] of Object.entries(grouped)) {
      const { data: client } = await supabase
        .from('clients')
        .select('name, review_notify_emails')
        .eq('id', clientId)
        .single()

      if (!client || !client.review_notify_emails || client.review_notify_emails.length === 0) {
        const ids = pieces.map((p) => p.id)
        await supabase
          .from('review_notification_queue')
          .update({ sent_at: new Date().toISOString() })
          .in('id', ids)
        results.push({ client: clientId, sent: false, error: 'No notify emails configured' })
        continue
      }

      const { data: tokenRow } = await supabase
        .from('client_approval_tokens')
        .select('token')
        .eq('client_id', clientId)
        .maybeSingle()

      const approvalLink = tokenRow?.token
        ? `https://hub.marketlab-media.de/approve/${tokenRow.token}`
        : null

      const { data: refRow } = await supabase
        .from('client_referral_pages')
        .select('slug')
        .eq('client_id', clientId)
        .eq('is_active', true)
        .maybeSingle()

      const referralLink = refRow?.slug
        ? `https://hub.marketlab-media.de/ref/${refRow.slug}`
        : 'https://hub.marketlab-media.de/empfehlungen'

      const { subject, html, text } = buildEmail(client.name, pieces, approvalLink, referralLink)

      let sendSuccess = true
      for (const email of client.review_notify_emails) {
        const messageId = crypto.randomUUID()
        try {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: FROM_ADDRESS,
              to: [email],
              subject,
              html,
              text,
            }),
          })

          if (!res.ok) {
            const body = await res.text()
            throw new Error(`[${res.status}] ${body}`)
          }

          console.log(`Sent review digest to ${email}`)

          await supabase.from('email_send_log').insert({
            message_id: messageId,
            template_name: 'review_digest',
            recipient_email: email,
            status: 'sent',
          })
        } catch (sendErr) {
          console.error(`Failed to send to ${email}:`, sendErr)
          sendSuccess = false

          await supabase.from('email_send_log').insert({
            message_id: messageId,
            template_name: 'review_digest',
            recipient_email: email,
            status: 'failed',
            error_message: sendErr instanceof Error ? sendErr.message : String(sendErr),
          })
        }
      }

      // Mark notification queue items as sent
      const ids = pieces.map((p) => p.id)
      await supabase
        .from('review_notification_queue')
        .update({ sent_at: new Date().toISOString() })
        .in('id', ids)

      results.push({ client: client.name, sent: sendSuccess })
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Digest error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// --- Email template builder ---

function buildEmail(
  clientName: string,
  pieces: { piece_type: string | null; piece_title: string | null }[],
  approvalLink: string | null,
  referralLink = 'https://hub.marketlab-media.de/empfehlungen'
) {
  const typeLabels: Record<string, string> = {
    reel: '🎬 Reel',
    carousel: '📸 Karussell',
    story: '📱 Story',
    ad: '📢 Ad',
    youtube_longform: '🎥 YouTube',
  }

  const pieceListHtml = pieces
    .map((p) => {
      const typeLabel = typeLabels[p.piece_type || ''] || p.piece_type || 'Content'
      const title = p.piece_title || 'Ohne Titel'
      return `<tr><td style="padding:8px 12px;border-bottom:1px solid #2a2a2f;font-size:14px;">${typeLabel}</td><td style="padding:8px 12px;border-bottom:1px solid #2a2a2f;font-size:14px;">${title}</td></tr>`
    })
    .join('')

  const pieceListText = pieces
    .map((p) => {
      const typeLabel = typeLabels[p.piece_type || ''] || p.piece_type || 'Content'
      const title = p.piece_title || 'Ohne Titel'
      return `- ${typeLabel}: ${title}`
    })
    .join('\n')

  const count = pieces.length
  const subject = `${count} ${count === 1 ? 'Content Piece' : 'Content Pieces'} zur Freigabe – ${clientName}`

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  @keyframes mlGlow {
    0%,100% { box-shadow:0 0 12px rgba(240,200,90,0.35); border-color:#c9a227; }
    50% { box-shadow:0 0 34px rgba(240,200,90,0.85); border-color:#ffe08a; }
  }
  @keyframes mlPulse {
    0%,100% { transform:scale(1); }
    50% { transform:scale(1.035); }
  }
  .ml-glow { animation: mlGlow 2.2s ease-in-out infinite; }
  .ml-pulse { animation: mlPulse 2.2s ease-in-out infinite; }
</style>
</head>
<body style="margin:0;padding:0;background:#111115;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
    <div style="background:#1a1a1f;border:1px solid #2a2a2f;border-radius:16px;padding:32px;margin-bottom:24px;">
      <h1 style="color:#ffffff;font-size:20px;font-weight:700;margin:0 0 8px;">Neue Inhalte zur Freigabe</h1>
      <p style="color:#8b8b94;font-size:14px;margin:0 0 24px;">
        Für <strong style="color:#ffffff;">${clientName}</strong> ${count === 1 ? 'ist 1 neues Content Piece' : `sind ${count} neue Content Pieces`} bereit zur Freigabe.
      </p>
      <table style="width:100%;border-collapse:collapse;background:#111115;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#1e1e24;">
            <th style="padding:10px 12px;text-align:left;color:#8b8b94;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Typ</th>
            <th style="padding:10px 12px;text-align:left;color:#8b8b94;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Titel</th>
          </tr>
        </thead>
        <tbody style="color:#e0e0e4;">${pieceListHtml}</tbody>
      </table>
      ${bonusHtml(referralLink)}
      ${approvalLink ? `<div style="text-align:center;margin-top:20px;"><a href="${approvalLink}" style="display:inline-block;background:#3b82f6;color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">Zur Freigabe →</a></div>` : ''}
    </div>
    <p style="color:#555;font-size:12px;text-align:center;margin:0;">Marketlab Media · Automatische Benachrichtigung</p>
  </div>
</body>
</html>`

  const text = `Neue Inhalte zur Freigabe\n\nFür ${clientName} ${count === 1 ? 'ist 1 neues Content Piece' : `sind ${count} neue Content Pieces`} bereit zur Freigabe.\n\n${pieceListText}${bonusText(referralLink)}${approvalLink ? `\n\nZur Freigabe: ${approvalLink}` : ''}\n\nMarketlab Media · Automatische Benachrichtigung`


  return { subject, html, text }
}

// --- Empfehlungs-Bonus (Aktion bis 31.08.2026, +50 %) ---
const BONUS_END = new Date('2026-08-31T23:59:59+02:00')

function bonusDaysLeft(): number {
  return Math.ceil((BONUS_END.getTime() - Date.now()) / 86400000)
}

function bonusActive(): boolean {
  return Date.now() < BONUS_END.getTime()
}

function bonusHtml(referralLink: string): string {
  if (!bonusActive()) return ''
  const days = bonusDaysLeft()
  return `<div class="ml-glow" style="margin-top:28px;background:linear-gradient(135deg,#241d07,#3a2c0a);border:1px solid #c9a227;border-radius:16px;padding:22px;box-shadow:0 0 22px rgba(240,200,90,0.45);">
      <p style="color:#f0c85a;font-size:12px;letter-spacing:1px;text-transform:uppercase;margin:0 0 8px;font-weight:700;">+50 % Empfehlungsprämie · nur noch ${days} ${days === 1 ? 'Tag' : 'Tage'}</p>
      <h2 style="color:#ffffff;font-size:18px;margin:0 0 12px;font-weight:700;">Empfiehl uns weiter &amp; sichere dir bis zu 2.250 €</h2>
      <table style="width:100%;border-collapse:collapse;color:#e7dcc0;font-size:14px;">
        <tr><td style="padding:6px 0;">1. Empfehlung</td><td style="padding:6px 0;text-align:right;"><span style="color:#8b8b94;text-decoration:line-through;">1.000 €</span> <strong style="color:#f0c85a;">1.500 €</strong></td></tr>
        <tr><td style="padding:6px 0;">2. Empfehlung</td><td style="padding:6px 0;text-align:right;"><span style="color:#8b8b94;text-decoration:line-through;">1.500 €</span> <strong style="color:#f0c85a;">2.250 €</strong></td></tr>
        <tr><td style="padding:6px 0;">3. Empfehlung</td><td style="padding:6px 0;text-align:right;"><strong style="color:#f0c85a;">1 Monat gratis</strong></td></tr>
      </table>
      <div style="text-align:center;margin-top:18px;">
        <a class="ml-pulse" href="${referralLink}" style="display:inline-block;background:linear-gradient(90deg,#d9a520,#f6d372,#d9a520);color:#241d07;padding:13px 30px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:800;box-shadow:0 0 24px rgba(240,200,90,0.55);">✦ Zu deiner Empfehlungsseite →</a>
      </div>
      <p style="color:#a89968;font-size:12px;margin:14px 0 0;text-align:center;">Gutschrift bei Vertragsabschluss · Aktion endet am 31. August 2026</p>
    </div>`
}

function bonusText(referralLink: string): string {
  if (!bonusActive()) return ''
  const days = bonusDaysLeft()
  return `\n\n+50 % EMPFEHLUNGSPRÄMIE – nur noch ${days} ${days === 1 ? 'Tag' : 'Tage'}\n1. Empfehlung: 1.500 € (statt 1.000 €)\n2. Empfehlung: 2.250 € (statt 1.500 €)\n3. Empfehlung: 1 Monat gratis\nDeine Empfehlungsseite: ${referralLink}\nAktion endet am 31. August 2026.`
}
