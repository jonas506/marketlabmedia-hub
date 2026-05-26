import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM_ADDRESS = "Marketlab Media <noreply@marketlabmedia.de>";

const TYPE_LABELS: Record<string, string> = {
  vacation: "Urlaub",
  sick: "Krank",
  special: "Sonderurlaub",
  unpaid: "Unbezahlt",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { requester_name, start_date, end_date, days, type, note, half_day } = await req.json();

    // Find all admin user_ids
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    const adminIds = (adminRoles || []).map((r: any) => r.user_id);
    if (adminIds.length === 0) {
      return new Response(JSON.stringify({ message: "No admins" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("email, name")
      .in("user_id", adminIds);

    const recipients = (profiles || []).map((p: any) => p.email).filter(Boolean);
    if (recipients.length === 0) {
      return new Response(JSON.stringify({ message: "No admin emails" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const typeLabel = TYPE_LABELS[type] || type;
    const fmt = (s: string) => {
      const [y, m, d] = s.split("-");
      return `${d}.${m}.${y}`;
    };
    const daysLabel = half_day ? "½ Tag" : `${days} ${days === 1 ? "Tag" : "Tage"}`;
    const periodLabel = start_date === end_date ? fmt(start_date) : `${fmt(start_date)} – ${fmt(end_date)}`;

    const subject = `🏖️ Neuer Urlaubsantrag von ${requester_name}`;
    const html = `
      <div style="font-family:-apple-system,system-ui,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
        <h2 style="margin:0 0 16px;font-size:18px">Neuer Urlaubsantrag</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:6px 0;color:#666;width:120px">Mitarbeiter</td><td style="padding:6px 0;font-weight:600">${requester_name}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Art</td><td style="padding:6px 0">${typeLabel}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Zeitraum</td><td style="padding:6px 0">${periodLabel}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Umfang</td><td style="padding:6px 0">${daysLabel}</td></tr>
          ${note ? `<tr><td style="padding:6px 0;color:#666;vertical-align:top">Notiz</td><td style="padding:6px 0;font-style:italic">${note}</td></tr>` : ""}
        </table>
        <div style="margin-top:24px">
          <a href="https://marketlabmedia-hub.lovable.app/time-tracking" style="display:inline-block;background:#3b82f6;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500">Antrag prüfen</a>
        </div>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: recipients,
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Resend error:", errText);
      throw new Error(`Resend ${res.status}`);
    }

    return new Response(JSON.stringify({ sent: recipients.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("notify-vacation-request error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
