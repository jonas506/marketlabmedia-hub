import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODE_PROMPTS: Record<string, string> = {
  reel_scripts: `Du bist ein Social-Media-Skript-Experte. Schreibe kurze, hook-starke Reel-Skripte (max 60 Sek).
Struktur: 1) Hook (erste 3 Sek fesseln), 2) Problem/Frage, 3) Lösung/Mehrwert, 4) CTA.
Schreibe im Stil des Kunden. Nutze die Kunden-Infos für branchenspezifische Inhalte.`,

  ad_scripts: `Du bist ein Performance-Marketing-Texter. Schreibe Ad-Skripte die konvertieren.
Struktur: 1) Pattern Interrupt / Hook, 2) Problem ansprechen, 3) Lösung vorstellen, 4) Social Proof / Ergebnisse, 5) Klarer CTA.
Nutze die Kunden-USPs und Zielgruppen-Infos. Fokus auf Conversion.`,

  carousel: `Du bist ein Karussell-Text-Experte für Instagram. Erstelle Slide-für-Slide Texte.
Slide 1: Starke Headline die zum Swipen einlädt. Slides 2-8: Mehrwert, Tipps oder Story. Letzter Slide: CTA.
Jeder Slide max 3-4 Zeilen. Nutze Emojis sparsam aber gezielt.`,

  captions: `Du bist ein Caption-Experte für Instagram. Schreibe SEO-optimierte Captions.
Struktur: 1) Hook-Zeile, 2) Mehrwert/Story (2-4 Absätze), 3) CTA (Folgen, Speichern, Teilen), 4) 5-10 relevante Hashtags.
Max 2200 Zeichen. Nutze Zeilenumbrüche für Lesbarkeit.`,

  content_ideas: `Du bist ein Content-Stratege. Generiere kreative Content-Ideen basierend auf der Branche und Zielgruppe des Kunden.
Für jede Idee: 1) Titel/Hook, 2) Format (Reel/Karussell/Story), 3) Kernaussage, 4) Warum es funktioniert.
Denke an Trends, Pain Points der Zielgruppe und die USPs des Kunden.`,

  landing_pages: `Du bist ein Landing-Page-Texter und Conversion-Experte. Erstelle Texte und Strukturvorschläge für Landing Pages.
Elemente: Hero-Section (Headline + Subline + CTA), Vorteile/Features, Social Proof, FAQ, finaler CTA.
Fokus auf Conversion-Optimierung. Nutze die Kunden-USPs und Zielgruppen-Infos.`,

  general: `Du bist ein hilfreicher KI-Assistent für eine Social-Media-Agentur. Du hilfst bei allen Fragen rund um Content, Marketing und Strategie für diesen Kunden. Antworte immer auf Deutsch.`,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, clientId, mode } = await req.json();

    if (!messages || !clientId) {
      return new Response(JSON.stringify({ error: "messages and clientId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Fetch client info
    const { data: client } = await sb.from("clients").select("*").eq("id", clientId).single();

    // Fetch knowledge base
    const { data: knowledge } = await sb
      .from("client_knowledge")
      .select("title, content, category")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(50);

    // Build client context
    let clientContext = "";
    if (client) {
      clientContext += `\n## Kunde: ${client.name}`;
      if (client.industry) clientContext += `\nBranche: ${client.industry}`;
      if (client.sector) clientContext += `\nSektor: ${client.sector}`;
      if (client.target_audience) clientContext += `\nZielgruppe: ${client.target_audience}`;
      if (client.usps) clientContext += `\nUSPs: ${client.usps}`;
      if (client.tonality) clientContext += `\nTonalität: ${client.tonality}`;
      if (client.content_topics) clientContext += `\nContent-Themen: ${client.content_topics}`;
      if (client.strategy_text) clientContext += `\nStrategie: ${client.strategy_text}`;
      if (client.website_url) clientContext += `\nWebsite: ${client.website_url}`;
    }

    // Add knowledge base
    if (knowledge?.length) {
      clientContext += `\n\n## Wissensbasis (${knowledge.length} Einträge):\n`;
      for (const entry of knowledge) {
        clientContext += `\n### [${entry.category}] ${entry.title}\n${entry.content}\n`;
      }
    }

    const modePrompt = MODE_PROMPTS[mode || "general"] || MODE_PROMPTS.general;

    const systemPrompt = `${modePrompt}

--- KUNDEN-KONTEXT ---
${clientContext || "Keine Kunden-Informationen verfügbar."}
--- ENDE KONTEXT ---

Antworte immer auf Deutsch. Nutze den Kunden-Kontext und die Wissensbasis, um relevante, maßgeschneiderte Antworten zu geben.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate Limit erreicht. Bitte warte kurz." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Guthaben aufgebraucht. Bitte Credits aufladen." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "KI-Fehler" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("client-ai-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
