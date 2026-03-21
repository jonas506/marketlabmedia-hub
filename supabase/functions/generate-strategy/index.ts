import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STRATEGY_SYSTEM_PROMPT = `Du bist der Strategie-Experte von Marketlab Media, einer Performance-Marketing-Agentur für die deutsche Immobilienbranche (Bauträger, Makler, Immobilienvertriebe, Finanzdienstleister für Kapitalanlage-Immobilien).

Deine Aufgabe: Analysiere die bereitgestellten Informationen über einen Kunden und erstelle eine Marketing-Strategie.

KONTEXT ÜBER MARKETLAB MEDIA:
- Kernkompetenz: Vertrauensaufbau VOR dem Erstgespräch (nicht mehr Leads generieren, sondern bessere Abschlussquote)
- Hauptkanäle: Meta Ads (Facebook/Instagram), Google Ads, YouTube, Content Marketing
- Content-Typen: Reels, Karussells, Stories, Testimonial-Videos, Ad Creatives
- Typische Pain Points der Kunden: Niedrige Abschlussquote, schlechte Lead-Qualität, niedrige Show-Up-Raten, fehlende Differenzierung, mangelndes Vertrauen
- USP: "Wir sorgen dafür, dass dein Lead dir schon vertraut bevor er zum Gespräch kommt"

DEINE AUSGABE: Antworte NUR mit validem JSON. Kein Markdown, kein erläuternder Text, nur JSON.

Das JSON beschreibt die visuellen Elemente die auf einem Whiteboard platziert werden sollen. Struktur:

{
  "strategy_title": "Strategie für [Kundenname]",
  "summary": "Kurze Zusammenfassung der Strategie in 2-3 Sätzen",
  "sections": [
    {
      "type": "funnel | journey | content_plan | info_block",
      "title": "Sektions-Titel",
      "position": { "x": number, "y": number },
      "width": number,
      "height": number,
      "elements": [
        {
          "type": "sticky | text | arrow",
          "content": "Text-Inhalt",
          "color": "blue | yellow | red | green | orange | violet | white",
          "position": { "x": number, "y": number },
          "width": number,
          "height": number,
          "fontSize": "s | m | l | xl"
        }
      ]
    }
  ],
  "key_insights": [
    "Erkenntnis 1 aus der Analyse",
    "Erkenntnis 2",
    "Erkenntnis 3"
  ]
}

REGELN FÜR DIE STRATEGIE:
- Die Strategie muss spezifisch auf den Kunden zugeschnitten sein — keine generischen Empfehlungen
- Verwende konkrete Maßnahmen die Marketlab Media umsetzen kann
- Nenne spezifische Content-Formate (Reels, Karussells, Stories)
- Gib konkrete Hook-Ideen und Kernbotschaften an
- Definiere klare Kanäle (Meta, Google, YouTube)
- Alles auf Deutsch
- Halte es auf High-Level — Funnel-Stufen, Kanäle, Kernbotschaften, keine detaillierten Texte
- Nutze die Immobilien-Terminologie (Exposé, Besichtigung, Abschlussquote, Lead, Kapitalanlage, etc.)
- Positioniere Sections so dass sie nicht überlappen. Nutze großzügigen Abstand (mindestens 400px zwischen Sections).
- Maximal 4-5 Sections für Übersichtlichkeit
- Standard-Section-Größe: 800x600px
- Sticky Notes Position ist RELATIV zur Section (0,0 = oben links in der Section)
- Sticky Notes: 200x200px Standard
- Farbzuordnung: blue=Kanäle, yellow=Ideen, green=Maßnahmen, red=Pain Points, orange=Warnungen, violet=KPIs, white=Neutral

STRATEGIE-TYP MAPPING:
- "funnel": Vertikaler Performance-Marketing-Funnel (Awareness → Interest → Decision → Action), Sections untereinander
- "journey": Horizontale Customer Journey Map (5 Phasen nebeneinander), Sections nebeneinander
- "content_plan": Grid mit Swimlanes (Reels, Karussells, Stories, Ads), Sections als Grid
- "full": Kombination aus Funnel + Journey + Content Plan, großzügig verteilt`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { briefing, strategyType, clientData, documents, urls, boardId } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build user message
    let userMessage = "";

    if (clientData) {
      userMessage += `\n--- KUNDENDATEN AUS DEM SYSTEM ---\n${JSON.stringify(clientData, null, 2)}\n`;
    }

    if (documents && documents.length > 0) {
      userMessage += `\n--- HOCHGELADENE DOKUMENTE ---\n`;
      for (const doc of documents) {
        userMessage += `Dokument "${doc.name}":\n${doc.text}\n\n`;
      }
    }

    if (briefing) {
      userMessage += `\n--- BRIEFING NOTIZEN ---\n${briefing}\n`;
    }

    if (urls && urls.length > 0) {
      userMessage += `\n--- ANALYSIERTE WEBSITES ---\n`;
      for (const url of urls) {
        userMessage += `URL "${url.url}":\n${url.text}\n\n`;
      }
    }

    userMessage += `\n--- GEWÜNSCHTER STRATEGIE-TYP ---\n${strategyType || "full"}\n`;
    userMessage += `\nErstelle jetzt die Strategie als JSON.`;

    // Call Lovable AI
    const aiResponse = await fetch("https://ai-gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: STRATEGY_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        max_tokens: 8192,
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error(`AI API error [${aiResponse.status}]: ${errText}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    let strategy;
    try {
      strategy = JSON.parse(content);
    } catch {
      // Try extracting JSON from markdown code block
      const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        strategy = JSON.parse(match[1]);
      } else {
        throw new Error("Could not parse strategy JSON");
      }
    }

    // Save sources to board
    if (boardId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const sources = [];
      if (clientData) sources.push({ type: "client", name: clientData.name || "Kundendaten" });
      if (documents) documents.forEach((d: any) => sources.push({ type: "document", name: d.name }));
      if (urls) urls.forEach((u: any) => sources.push({ type: "url", name: u.url }));
      if (briefing) sources.push({ type: "briefing", name: "Freitext-Briefing" });

      await supabase
        .from("strategy_boards")
        .update({ sources, ai_generated: true })
        .eq("id", boardId);
    }

    return new Response(JSON.stringify({ success: true, strategy }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error generating strategy:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
