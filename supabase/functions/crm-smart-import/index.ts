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
    const { content, lead_name, source_type, image_base64, image_mime_type } = await req.json();

    if (!content && !image_base64) {
      return new Response(
        JSON.stringify({ error: "Content or image is required" }),
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

    const systemPrompt = `Du bist ein CRM-Assistent für eine Social-Media-Agentur. Du analysierst Inhalte und extrahierst strukturierte Informationen.

Antworte IMMER als valides JSON mit genau diesem Schema:
{
  "summary": "Kurze Zusammenfassung (2-4 Sätze) worum es geht",
  "key_points": ["Wichtige Punkte als Array"],
  "next_steps": ["Konkrete nächste Schritte/Aufgaben als Array"],
  "contact_info": {
    "name": "Falls erkennbar, Ansprechpartner-Name oder null",
    "email": "Falls erkennbar, E-Mail oder null",
    "phone": "Falls erkennbar, Telefonnummer oder null",
    "company": "Falls erkennbar, Firmenname oder null",
    "website": "Falls erkennbar, Website oder null",
    "instagram": "Falls erkennbar, Instagram-Handle (z.B. @name) oder null",
    "linkedin": "Falls erkennbar, LinkedIn-URL oder null"
  },
  "source_channel": "Erkannter Kontaktkanal: 'instagram', 'linkedin', 'whatsapp', 'email', 'phone', 'website' oder null"
}

Wenn es ein Screenshot eines Chats ist (z.B. Instagram DM, WhatsApp, LinkedIn):
- Erkenne die Plattform und setze source_channel entsprechend
- Fasse zusammen was besprochen wurde
- Extrahiere Namen, Kontaktinformationen
- Identifiziere nächste Schritte

Wenn es ein Call-Transkript ist, fokussiere dich auf:
- Was wurde besprochen?
- Was sind die nächsten Schritte?
- Welche Aufgaben ergeben sich daraus?

Wenn es eine Website ist, fokussiere dich auf:
- Was macht die Firma?
- Kontaktinformationen
- Potenzielle Anknüpfungspunkte für Social-Media-Marketing`;

    // Build messages array
    const messages: any[] = [{ role: "system", content: systemPrompt }];

    if (image_base64) {
      // Vision request with image
      const mimeType = image_mime_type || "image/jpeg";
      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: `Analysiere dieses Bild für den Lead "${lead_name || "Unbekannt"}". Extrahiere alle erkennbaren Informationen wie Kontaktdaten, Gesprächsinhalt, Plattform etc.`,
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${image_base64}`,
            },
          },
        ],
      });
    } else {
      const userPrompt = source_type === "pdf"
        ? `Analysiere dieses Call-Transkript/Dokument für den Lead "${lead_name || "Unbekannt"}":\n\n${content.substring(0, 15000)}`
        : `Analysiere diese gescrapte Website-Informationen für den Lead "${lead_name || "Unbekannt"}":\n\n${content.substring(0, 15000)}`;
      messages.push({ role: "user", content: userPrompt });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI error:", errText);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit erreicht, bitte versuche es gleich nochmal." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI-Credits aufgebraucht." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "AI analysis failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await response.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "{}";

    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      parsed = { summary: rawContent, key_points: [], next_steps: [], contact_info: {} };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
