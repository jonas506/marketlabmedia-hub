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
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) throw new Error('RESEND_API_KEY is not configured')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    // Validate auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header')
    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authErr || !user) throw new Error('Unauthorized')

    const { to, subject, body, lead_id } = await req.json()

    if (!to || !subject || !body || !lead_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields: to, subject, body, lead_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return new Response(JSON.stringify({ error: 'Invalid email address' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get sender profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('user_id', user.id)
      .single()

    const senderName = profile?.name || 'Marketlab Media'
    const fromAddress = `${senderName} <noreply@marketlabmedia.de>`

    // Convert plain text body to HTML
    const htmlBody = body
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>')

    // Send via Resend
    const GATEWAY_URL = 'https://connector-gateway.lovable.dev/resend'
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')

    let sendResult: any

    if (LOVABLE_API_KEY) {
      // Use gateway
      const res = await fetch(`${GATEWAY_URL}/emails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'X-Connection-Api-Key': resendApiKey,
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [to],
          subject,
          html: `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.6;">${htmlBody}</div>`,
          reply_to: profile?.email || user.email,
        }),
      })
      sendResult = await res.json()
      if (!res.ok) throw new Error(`Email send failed: ${JSON.stringify(sendResult)}`)
    } else {
      // Direct Resend API
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [to],
          subject,
          html: `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.6;">${htmlBody}</div>`,
          reply_to: profile?.email || user.email,
        }),
      })
      sendResult = await res.json()
      if (!res.ok) throw new Error(`Email send failed: ${JSON.stringify(sendResult)}`)
    }

    // Log as crm_activity
    await supabase.from('crm_activities').insert({
      lead_id,
      type: 'email',
      title: `✉️ E-Mail gesendet: ${subject}`,
      body: `An: ${to}\n\n${body}`,
      created_by: user.id,
    })

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('crm-send-email error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
