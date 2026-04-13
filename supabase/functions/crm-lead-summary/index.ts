const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lead_name, contact_name, stage, timeline } = await req.json();

    if (!timeline) {
      return new Response(
        JSON.stringify({ error: "timeline is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "AI not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "Du bist ein CRM-Assistent. Fasse die Timeline-Einträge eines Leads kurz und prägnant auf Deutsch zusammen. Nutze IMMER exakt dieses Format:\n\n**Status:** [Ein Satz zum aktuellen Stand]\n\n**Erkenntnisse:** [2-3 Sätze zu den wichtigsten Erkenntnissen]\n\n**Nächste Schritte:** [1-2 konkrete nächste Aktionen]\n\nMaximal 5-6 Sätze insgesamt. Antworte direkt mit der Zusammenfassung, kein JSON."
          },
          {
            role: "user",
            content: `Lead: ${lead_name || "Unbekannt"}\nKontakt: ${contact_name || "–"}\nStufe: ${stage || "–"}\n\nTimeline:\n${timeline}`
          }
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI error:", errText);
      return new Response(
        JSON.stringify({ error: "AI request failed" }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content || "Keine Zusammenfassung verfügbar.";

    return new Response(
      JSON.stringify({ summary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
