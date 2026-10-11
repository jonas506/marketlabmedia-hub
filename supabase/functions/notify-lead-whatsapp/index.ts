import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/whatsapp'
const TEMPLATE_NAME = 'positionierungs_analyse_bestaetigung'

function normalizePhone(raw: string): string | null {
  // Keep digits only, convert German local format to E.164 without '+'
  let digits = raw.replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith('0')) digits = '49' + digits.slice(1)
  return digits.length >= 10 ? digits : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    const WHATSAPP_API_KEY = Deno.env.get('WHATSAPP_API_KEY')
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured')
    if (!WHATSAPP_API_KEY) throw new Error('WHATSAPP_API_KEY is not configured')

    const { phone, name } = await req.json()
    if (!phone || typeof phone !== 'string') {
      return new Response(JSON.stringify({ error: 'phone is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const recipient = normalizePhone(phone)
    if (!recipient) {
      return new Response(JSON.stringify({ error: 'invalid phone number' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const firstName = (typeof name === 'string' && name.trim().split(' ')[0]) || 'du'

    const response = await fetch(`${GATEWAY_URL}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': WHATSAPP_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'template',
        template: {
          name: TEMPLATE_NAME,
          language: { code: 'de' },
          components: [
            { type: 'body', parameters: [{ type: 'text', text: firstName }] },
          ],
        },
      }),
    })

    const responseBody = await response.text()
    if (!response.ok) {
      console.error(`WhatsApp send failed [${response.status}]: ${responseBody}`)
      return new Response(
        JSON.stringify({ error: 'WhatsApp send failed', status: response.status, details: responseBody }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('notify-lead-whatsapp error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
