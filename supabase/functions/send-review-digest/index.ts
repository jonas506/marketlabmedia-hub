import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, serviceKey)

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
      // Fetch client with notify emails
      const { data: client } = await supabase
        .from('clients')
        .select('name, review_notify_emails, approval_token')
        .eq('id', clientId)
        .single()

      if (!client || !client.review_notify_emails || client.review_notify_emails.length === 0) {
        // Mark as sent even if no emails configured (don't re-queue forever)
        const ids = pieces.map((p) => p.id)
        await supabase
          .from('review_notification_queue')
          .update({ sent_at: new Date().toISOString() })
          .in('id', ids)
        results.push({ client: clientId, sent: false, error: 'No notify emails configured' })
        continue
      }

      // Build approval link
      const approvalLink = client.approval_token
        ? `https://marketlabmedia-hub.lovable.app/approve/${client.approval_token}`
        : null

      // Build piece list HTML
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

      const emailSubject = `${pieces.length} ${pieces.length === 1 ? 'Content Piece' : 'Content Pieces'} zur Freigabe – ${client.name}`

      const emailText = `Neue Inhalte zur Freigabe\n\nFür ${client.name} ${pieces.length === 1 ? 'ist 1 neues Content Piece' : `sind ${pieces.length} neue Content Pieces`} bereit zur Freigabe.\n\n${pieceListText}${approvalLink ? `\n\nZur Freigabe: ${approvalLink}` : ''}\n\nMarketLab Media · Automatische Benachrichtigung`

      const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#111115;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
    <div style="background:#1a1a1f;border:1px solid #2a2a2f;border-radius:16px;padding:32px;margin-bottom:24px;">
      <h1 style="color:#ffffff;font-size:20px;font-weight:700;margin:0 0 8px;">
        Neue Inhalte zur Freigabe
      </h1>
      <p style="color:#8b8b94;font-size:14px;margin:0 0 24px;">
        Für <strong style="color:#ffffff;">${client.name}</strong> ${pieces.length === 1 ? 'ist 1 neues Content Piece' : `sind ${pieces.length} neue Content Pieces`} bereit zur Freigabe.
      </p>

      <table style="width:100%;border-collapse:collapse;background:#111115;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#1e1e24;">
            <th style="padding:10px 12px;text-align:left;color:#8b8b94;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Typ</th>
            <th style="padding:10px 12px;text-align:left;color:#8b8b94;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Titel</th>
          </tr>
        </thead>
        <tbody style="color:#e0e0e4;">
          ${pieceListHtml}
        </tbody>
      </table>

      ${approvalLink ? `
      <div style="text-align:center;margin-top:28px;">
        <a href="${approvalLink}" style="display:inline-block;background:#3b82f6;color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">
          Zur Freigabe →
        </a>
      </div>
      ` : ''}
    </div>

    <p style="color:#555;font-size:12px;text-align:center;margin:0;">
      MarketLab Media · Automatische Benachrichtigung
    </p>
  </div>
</body>
</html>`

      // Enqueue emails into transactional_emails queue (processed by process-email-queue cron)
      let enqueueSuccess = true
      for (const email of client.review_notify_emails) {
        const messageId = `review-digest-${clientId}-${email}-${Date.now()}`
        const { error: rpcError } = await supabase.rpc('enqueue_email', {
          queue_name: 'transactional_emails',
          payload: {
            to: email,
            from: `MarketLab Media <notify@notify.marketlabmedia.de>`,
            sender_domain: 'notify.marketlabmedia.de',
            subject: emailSubject,
            html: emailHtml,
            text: emailText,
            purpose: 'transactional',
            label: 'review_digest',
            message_id: messageId,
            queued_at: new Date().toISOString(),
          },
        })

        if (rpcError) {
          console.error(`Failed to enqueue email for ${email}:`, rpcError)
          enqueueSuccess = false
        } else {
          console.log(`Enqueued review digest for ${email}`)
        }
      }

      // Mark notification queue items as sent
      const ids = pieces.map((p) => p.id)
      await supabase
        .from('review_notification_queue')
        .update({ sent_at: new Date().toISOString() })
        .in('id', ids)

      results.push({ client: client.name, sent: enqueueSuccess })
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
