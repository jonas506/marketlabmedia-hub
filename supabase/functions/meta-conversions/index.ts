import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const PIXEL_ID = "2349392999129892";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256(value: string) {
  const data = new TextEncoder().encode(value.trim().toLowerCase());
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const token = Deno.env.get("META_ACCESS_TOKEN");
    if (!token) return new Response(JSON.stringify({ error: "META_ACCESS_TOKEN not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { email, phone, name, eventSourceUrl, userAgent, clientIp, eventName = "Lead" } = body ?? {};

    const userData: Record<string, unknown> = {};
    if (email) userData.em = [await sha256(email)];
    if (phone) userData.ph = [await sha256(phone.replace(/[^0-9+]/g, ""))];
    if (name) {
      const parts = name.trim().split(/\s+/);
      userData.fn = [await sha256(parts[0])];
      if (parts.length > 1) userData.ln = [await sha256(parts[parts.length - 1])];
    }
    if (userAgent) userData.client_user_agent = userAgent;
    if (clientIp) userData.client_ip_address = clientIp;

    const payload = {
      data: [{
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        event_source_url: eventSourceUrl,
        user_data: userData,
      }],
    };

    const res = await fetch(`https://graph.facebook.com/v21.0/${PIXEL_ID}/events?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    return new Response(JSON.stringify(result), { status: res.ok ? 200 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
