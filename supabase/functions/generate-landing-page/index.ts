import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { messages, clientId, landingPageId } = await req.json();
    if (!messages || !clientId) {
      return new Response(JSON.stringify({ error: "messages and clientId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch client data for context
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const { data: client } = await sb.from("clients").select("*").eq("id", clientId).single();

    const clientContext = client
      ? `
Kunden-Kontext:
- Name: ${client.name}
- Branche: ${client.industry || "k.A."}
- Zielgruppe: ${client.target_audience || "k.A."}
- USPs: ${client.usps || "k.A."}
- Tonalität: ${client.tonality || "k.A."}
- Website: ${client.website_url || "k.A."}
- Content-Themen: ${client.content_topics || "k.A."}
- Zusammenfassung: ${client.summary || "k.A."}
`
      : "";

    const systemPrompt = `Du bist ein erstklassiger Webdesigner und Frontend-Entwickler. Du erstellst vollständige, moderne, responsive Landing Pages als reines HTML mit eingebettetem CSS und optionalem inline JavaScript.

${clientContext}

WICHTIGE REGELN:
1. Liefere IMMER den KOMPLETTEN HTML-Code der Landing Page zurück - von <!DOCTYPE html> bis </html>
2. Verwende modernes CSS mit Flexbox/Grid, schöne Farbverläufe, Animationen und professionelle Typografie
3. Die Seite MUSS vollständig responsive sein (Mobile-First)
4. Verwende Google Fonts für professionelle Typografie
5. Füge sinnvolle Sektionen ein: Hero, Features, Testimonials, CTA, Footer etc.
6. Alle Texte sollen zum Kunden passen (Branche, Tonalität, USPs)
7. Verwende hochwertige Platzhalter-Bilder von unsplash (https://images.unsplash.com)
8. Füge subtile CSS-Animationen hinzu (fade-in, slide-up etc.)
9. Der Code muss eigenständig funktionieren - keine externen Abhängigkeiten außer Google Fonts und Unsplash-Bilder
10. Antworte NUR mit dem HTML-Code, ohne Erklärungen oder Markdown-Codeblöcke

Wenn der Nutzer Änderungen wünscht, gib immer den KOMPLETTEN aktualisierten HTML-Code zurück.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit erreicht. Bitte warte kurz." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Guthaben aufgebraucht." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI Fehler" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-landing-page error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
