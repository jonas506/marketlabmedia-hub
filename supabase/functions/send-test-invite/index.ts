import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { InviteEmail } from '../_shared/email-templates/invite.tsx'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SITE_NAME = 'marketlabmedia-hub'
const ROOT_DOMAIN = 'marketlabmedia.de'
const SENDER_DOMAIN = 'notify.marketlabmedia.de'
const FROM_DOMAIN = 'marketlabmedia.de'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { to, confirmationUrl } = await req.json()
    if (!to) throw new Error('to required')

    const props = {
      siteName: SITE_NAME,
      siteUrl: `https://${ROOT_DOMAIN}`,
      confirmationUrl: confirmationUrl || `https://${ROOT_DOMAIN}/accept-invite`,
    }

    const html = await renderAsync(React.createElement(InviteEmail, props))
    const text = await renderAsync(React.createElement(InviteEmail, props), { plainText: true })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const messageId = crypto.randomUUID()

    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: 'invite',
      recipient_email: to,
      status: 'pending',
    })

    const { error } = await supabase.rpc('enqueue_email', {
      queue_name: 'auth_emails',
      payload: {
        run_id: crypto.randomUUID(),
        message_id: messageId,
        to,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject: "You've been invited",
        html,
        text,
        purpose: 'transactional',
        label: 'invite',
        queued_at: new Date().toISOString(),
      },
    })
    if (error) throw error

    return new Response(JSON.stringify({ success: true, messageId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('send-test-invite error', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
