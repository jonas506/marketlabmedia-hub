import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2.49.4/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RECIPIENT_EMAIL = "jonas@marketlab-media.de";
const HUB_URL = "https://marketlabmedia-hub.lovable.app";

const MONTHS_DE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

function fmtEur(n: number): string {
  return n.toFixed(2).replace(".", ",") + " €";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Previous month
    const now = new Date();
    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth(); // 1-12
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

    // Get all profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, name, email");

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ message: "No profiles found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: string[] = [];

    for (const profile of profiles) {
      // Get expenses for this user in previous month
      const { data: expenses } = await supabase
        .from("travel_expenses")
        .select("*")
        .eq("user_id", profile.user_id)
        .eq("month", prevMonth)
        .eq("year", prevYear)
        .in("status", ["submitted", "approved"]);

      if (!expenses || expenses.length === 0) continue;

      // Calculate totals
      let totalMeals = 0, totalKm = 0, totalOvernight = 0, totalExtras = 0;
      for (const e of expenses) {
        totalMeals += Number(e.meals_total);
        totalKm += Math.round(Number(e.km_driven) * Number(e.km_rate) * 100) / 100;
        totalOvernight += Math.round(Number(e.overnight_count) * Number(e.overnight_rate) * 100) / 100;
        totalExtras += Number(e.extras_amount);
      }
      const grandTotal = Math.round((totalMeals + totalKm + totalOvernight + totalExtras) * 100) / 100;

      const monthLabel = MONTHS_DE[prevMonth - 1];
      const employeeName = profile.name || profile.email || "Mitarbeiter";
      const hubLink = `${HUB_URL}/crew?tab=reisekosten`;

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a1a1a;">Reisekostenabrechnung ${employeeName} — ${monthLabel} ${prevYear}</h2>
          <p>Hallo Jonas,</p>
          <p>die Reisekostenabrechnung von <strong>${employeeName}</strong> für <strong>${monthLabel} ${prevYear}</strong> liegt bereit:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 6px 0; color: #555;">Verpflegungsmehraufwand</td><td style="text-align: right; font-weight: 600;">${fmtEur(totalMeals)}</td></tr>
            <tr><td style="padding: 6px 0; color: #555;">Fahrtkosten</td><td style="text-align: right; font-weight: 600;">${fmtEur(totalKm)}</td></tr>
            <tr><td style="padding: 6px 0; color: #555;">Übernachtungspauschale</td><td style="text-align: right; font-weight: 600;">${fmtEur(totalOvernight)}</td></tr>
            <tr><td style="padding: 6px 0; color: #555;">Nebenkosten</td><td style="text-align: right; font-weight: 600;">${fmtEur(totalExtras)}</td></tr>
            <tr style="border-top: 2px solid #333;"><td style="padding: 10px 0; font-weight: bold; font-size: 16px;">GESAMTBETRAG</td><td style="text-align: right; font-weight: bold; font-size: 16px;">${fmtEur(grandTotal)}</td></tr>
          </table>
          <p><a href="${hubLink}" style="display: inline-block; background: #2563eb; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">Im Hub öffnen und als PDF herunterladen</a></p>
          <p style="color: #888; font-size: 13px; margin-top: 24px;">Bitte die Abrechnung prüfen, als PDF herunterladen, unterschreiben und an den Steuerberater weiterleiten.</p>
          <p style="color: #aaa; font-size: 12px;">— Marketlab Media Hub</p>
        </div>
      `;

      // Upsert report record
      await supabase
        .from("travel_expense_reports")
        .upsert({
          user_id: profile.user_id,
          month: prevMonth,
          year: prevYear,
          total_meals: totalMeals,
          total_km: totalKm,
          total_overnight: totalOvernight,
          total_extras: totalExtras,
          grand_total: grandTotal,
          status: "sent",
          sent_at: new Date().toISOString(),
        }, { onConflict: "user_id,year,month" });

      // Send email via Resend (existing infrastructure)
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (RESEND_API_KEY) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "Marketlab Media <noreply@marketlabmedia.de>",
            to: [RECIPIENT_EMAIL],
            subject: `Reisekostenabrechnung ${employeeName} — ${monthLabel} ${prevYear}`,
            html: htmlBody,
          }),
        });
      }

      results.push(employeeName);
    }

    return new Response(
      JSON.stringify({ message: `Reports sent for: ${results.join(", ") || "nobody"}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
