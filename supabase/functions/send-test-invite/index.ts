import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { InviteEmail } from '../_shared/email-templates/invite.tsx'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SITE_NAME = 'marketlabmedia-hub'
const ROOT_DOMAIN = 'marketlabmedia.de'
const FROM_ADDRESS = `${SITE_NAME} <noreply@${ROOT_DOMAIN}>`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { to, confirmationUrl } = await req.json()
    if (!to) throw new Error('to required')

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')
    if (!resendApiKey) throw new Error('RESEND_API_KEY not configured')

    const props = {
      siteName: SITE_NAME,
      siteUrl: `https://${ROOT_DOMAIN}`,
      confirmationUrl: confirmationUrl || `https://${ROOT_DOMAIN}/accept-invite`,
    }

    const html = await renderAsync(React.createElement(InviteEmail, props))
    const text = await renderAsync(React.createElement(InviteEmail, props), { plainText: true })

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [to],
        subject: "You've been invited",
        html,
        text,
      }),
    })
    const result = await res.json()
    if (!res.ok) {
      console.error('resend error', res.status, result)
      throw new Error(`Resend failed: ${JSON.stringify(result)}`)
    }

    return new Response(JSON.stringify({ success: true, id: result.id }), {
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
