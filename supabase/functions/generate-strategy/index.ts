import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STRATEGY_SYSTEM_PROMPT = `Du bist der Strategie-Architekt von Marketlab Media. Du erstellst professionelle, visuell strukturierte Marketing-Strategien als Flowcharts auf einem Whiteboard.

KONTEXT ÜBER MARKETLAB MEDIA:
- Performance-Marketing-Agentur für die deutsche Immobilienbranche
- Kernkompetenz: Vertrauensaufbau VOR dem Erstgespräch
- Hauptkanäle: Meta Ads, Google Ads, YouTube, Content Marketing
- Content-Typen: Reels, Karussells, Stories, Testimonial-Videos, Ad Creatives

VISUELLES SHAPE-SYSTEM — jeder Shape-Typ hat eine feste Bedeutung:
- "ellipse": Kanal, Plattform, Traffic-Quelle (Farbe: orange)
- "diamond": Entscheidungspunkt, Interaktion, Verzweigung (Farbe: yellow)
- "rectangle": Content-Typ, Maßnahme, Prozess-Schritt (Farbe: violet)
- "note": Kernbotschaft, Erklärung, Zusatzinfo (Farbe: light-yellow)
- "hexagon": Ergebnis, Ziel, Abschluss (Farbe: green für positiv, red für kritisch)
- "arrow": Verbindung/Fluss zwischen Elementen (mit optionalem Label)
- "frame": Gruppierung/Phase (nur als Rahmen, keine Füllung)

FARBPALETTE:
- orange: Kampagnen, Paid Traffic, aktive Maßnahmen
- yellow: Entscheidungspunkte, Interaktionen, Trigger
- violet: Content-Formate (Reels, Stories, Karussells)
- green: Positive Ergebnisse, Abschluss, Erfolg
- red: Kritische Schritte, Blocker, Hervorhebungen
- light-red: Warnungen, Risiken
- light-blue: Neutrale Prozess-Schritte

DEINE AUSGABE: Antworte NUR mit validem JSON. Kein Markdown, kein Text drumherum.

JSON-Struktur:
{
  "strategy_title": "Strategie für [Kundenname]",
  "summary": "2-3 Sätze Zusammenfassung",
  "nodes": [
    {
      "id": "n1",
      "shape": "ellipse" | "diamond" | "rectangle" | "note" | "hexagon",
      "label": "Text im Shape",
      "color": "orange" | "yellow" | "violet" | "green" | "red" | "light-red" | "light-blue",
      "x": 400,
      "y": 100,
      "w": 200,
      "h": 80
    }
  ],
  "arrows": [
    {
      "from": "n1",
      "to": "n2",
      "label": "optionaler Pfeil-Text"
    }
  ],
  "frames": [
    {
      "title": "Phase 1: Awareness",
      "x": 50,
      "y": 50,
      "w": 900,
      "h": 500
    }
  ],
  "key_insights": [
    "Erkenntnis 1",
    "Erkenntnis 2"
  ]
}

LAYOUT-REGELN:
- Flowchart fließt von OBEN nach UNTEN oder von LINKS nach RECHTS
- Nutze klare Hierarchie: Kanäle oben → Prozesse Mitte → Ergebnisse unten
- Shapes haben 80-120px Abstand zueinander
- Standard Shape-Größe: 200x80px für Rechtecke, 160x80px für Ellipsen, 140x140px für Diamonds
- Frames umschließen logische Gruppen mit 40px Padding
- Maximal 15-25 Nodes für Übersichtlichkeit
- Nutze Arrows um den Fluss klar zu zeigen — jeder Node sollte mindestens eine Verbindung haben
- Vermeide Überlappungen — positioniere sorgfältig
- Notes (Sticky) sparsam einsetzen — nur für erklärende Zusatzinfos neben dem Hauptfluss

STRATEGIE-TYP MAPPING:
- "funnel": Vertikaler Flow von oben nach unten (Awareness → Interest → Decision → Action)
- "journey": Horizontaler Flow von links nach rechts (5 Phasen nebeneinander)
- "content_plan": Grid-Layout mit Swimlanes (Kanäle als Zeilen, Wochen als Spalten)
- "full": Kombination — Funnel links, Content-Plan rechts, verbunden durch Arrows

INHALTLICHE REGELN:
- Spezifisch auf den Kunden zugeschnitten
- Konkrete Maßnahmen die Marketlab umsetzen kann
- Immobilien-Terminologie verwenden
- Alles auf Deutsch
- Verwende das Shape-System konsequent (Kanäle = Ellipsen, Entscheidungen = Rauten, etc.)`;

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
    userMessage += `\nErstelle jetzt die Strategie als JSON mit dem Flowchart-Shape-System.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
      const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        strategy = JSON.parse(match[1]);
      } else {
        throw new Error("Could not parse strategy JSON");
      }
    }

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
