import { sendLovableEmail } from 'npm:@lovable.dev/email-js'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const SENDER_DOMAIN = 'notify.marketlabmedia.de'
const FROM_ADDRESS = 'Marketlab Media <noreply@marketlabmedia.de>'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const apiKey = Deno.env.get('LOVABLE_API_KEY')

    if (!apiKey) {
      throw new Error('LOVABLE_API_KEY is not configured')
    }

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
      const { data: client } = await supabase
        .from('clients')
        .select('name, review_notify_emails, approval_token')
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

      const approvalLink = client.approval_token
        ? `https://marketlabmedia-hub.lovable.app/approve/${client.approval_token}`
        : null

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
      Marketlab Media · Automatische Benachrichtigung
    </p>
  </div>
</body>
</html>`

      const emailText = `Neue Inhalte zur Freigabe\n\nFür ${client.name} ${pieces.length === 1 ? 'ist 1 neues Content Piece' : `sind ${pieces.length} neue Content Pieces`} bereit zur Freigabe.\n\n${pieceListText}${approvalLink ? `\n\nZur Freigabe: ${approvalLink}` : ''}\n\nMarketlab Media · Automatische Benachrichtigung`

      let sendSuccess = true
      for (const email of client.review_notify_emails) {
        const messageId = crypto.randomUUID()
        try {
          await sendLovableEmail(
            {
              to: email,
              from: FROM_ADDRESS,
              sender_domain: SENDER_DOMAIN,
              subject: emailSubject,
              html: emailHtml,
              text: emailText,
              purpose: 'transactional',
              label: 'review_digest',
              message_id: messageId,
            },
            { apiKey, sendUrl: Deno.env.get('LOVABLE_SEND_URL') }
          )
          console.log(`Sent review digest to ${email}`)

          // Log success
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
