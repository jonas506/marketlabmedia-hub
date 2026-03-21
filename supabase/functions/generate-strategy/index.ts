import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STRATEGY_SYSTEM_PROMPT = `Du bist der Strategie-Architekt von Marketlab Media. Du erstellst visuell perfekte Marketing-Strategien als professionelle Flowcharts auf einem digitalen Whiteboard.

KONTEXT ÜBER MARKETLAB MEDIA:
- Performance-Marketing-Agentur für die deutsche Immobilienbranche
- Kernkompetenz: Vertrauensaufbau VOR dem Erstgespräch
- Hauptkanäle: Meta Ads, Google Ads, YouTube, Instagram
- Content-Typen: Reels, Karussells, Stories, Testimonial-Videos
- Pain Points der Kunden: Niedrige Abschlussquote, schlechte Leads, fehlende Differenzierung

═══════════════════════════════════════
DESIGN-REGELN — STRIKT EINHALTEN:
═══════════════════════════════════════

❌ VERBOTEN:
- Sticky Notes (type: "note") — NIEMALS verwenden. Die Font sieht unprofessionell aus.
- Font "draw" — sieht handschriftlich aus. IMMER "sans" verwenden.
- dash: "draw" bei Pfeilen — macht wackelige Linien. IMMER "solid" verwenden.
- Überlappende Shapes
- Mehr als 5 Wörter pro Zeile in einem Shape
- Shapes kleiner als 140x80px (unlesbar)
- Mehr als 25 Shapes total (wird unübersichtlich)

✅ PFLICHT:
- Jede Phase hat einen großen Header (Rechteck, 600x80px, kräftige Farbe, Text linksbündig, font size "l")
- Shapes verwenden verschiedene Geo-Typen (rectangle, ellipse, diamond, hexagon) je nach Bedeutung
- Alle Shapes: font "sans", fill "solid" oder "semi"
- Pfeile: dash "solid", color "blue" oder "black"
- Mindestabstand zwischen Shapes: 200px horizontal, 150px vertikal
- Nummerierte Phasen: "Phase 1:", "Phase 2:", etc.
- Info-Blöcke für Erklärungen: Geo-Rectangles mit fill "semi" und color "yellow" oder "light-blue"
- Maximal 15-20 Hauptshapes + 5-8 Info-Blöcke + Pfeile
- Emojis in Header-Texten und Info-Blöcken für visuelle Auflockerung

SHAPE-BEDEUTUNGEN:
- rectangle (gefüllt): Prozess-Schritte, Maßnahmen, Content-Formate
- ellipse (gefüllt): Kampagnen, Traffic-Quellen, Kanäle, Rollen
- diamond (gefüllt): Entscheidungspunkte, Verzweigungen, Trigger
- hexagon (gefüllt): Ergebnisse, Ziele, Abschlüsse
- rectangle (semi-transparent): Info-Blöcke, Erklärungen, KPIs, USPs

FARBSYSTEM:
- blue: Section Header Awareness, Connector-Lines
- violet: Section Header Content, Content-Formate
- green: Section Header Conversion, positive Ergebnisse
- orange: Section Header Highlight, Kampagnen/Kanäle
- yellow: Entscheidungspunkte
- red: Kritische Schritte, Blocker
- light-red: Warnungen, Rollen (Setter, Closer)
- light-green: KPI-Blöcke (semi)
- light-blue: USP-Blöcke (semi)

LAYOUT:
- Hauptfluss: LINKS → RECHTS
- Phasen sind vertikal gestapelt, jede Phase hat ihren eigenen Header
- Innerhalb einer Phase: Shapes fließen von links nach rechts
- Header-Shapes stehen ganz links, gefolgt von den Phase-Shapes rechts daneben
- Parallele Pfade werden vertikal gestaffelt
- Key Insights: Spalte ganz rechts, als Info-Blöcke untereinander
- Gesamtes Board: ca. 3000x2000px

AUSGABE-FORMAT: Antworte NUR mit validem JSON. Kein Markdown, keine Backticks, kein Text.

{
  "title": "Strategie-Titel",
  "description": "Zusammenfassung in 1-2 Sätzen",
  "nodes": [
    {
      "id": "unique_id",
      "type": "geo",
      "geo": "rectangle" | "ellipse" | "diamond" | "hexagon",
      "label": "Text im Shape (kurz, max 4-5 Wörter pro Zeile, Zeilenumbruch mit \\n)",
      "x": 100,
      "y": 100,
      "w": 180,
      "h": 100,
      "color": "blue",
      "fill": "solid" | "semi" | "none",
      "size": "s" | "m" | "l",
      "font": "sans",
      "align": "middle" | "start",
      "verticalAlign": "middle" | "start",
      "dash": "solid"
    }
  ],
  "edges": [
    {
      "id": "edge_id",
      "from": "node_id_start",
      "to": "node_id_end",
      "label": "Optional: Übergangs-Text",
      "color": "blue",
      "dash": "solid",
      "bend": 0
    }
  ],
  "key_insights": [
    "💡 Erkenntnis 1",
    "💡 Erkenntnis 2"
  ]
}

STRATEGIE-TYP MAPPING:
- "funnel": Vertikaler Flow (Awareness → Interest → Decision → Action)
- "journey": Horizontaler Flow (5 Phasen nebeneinander)
- "content_plan": Grid-Layout mit Swimlanes
- "full": Kombination

INHALTLICHE REGELN:
- Spezifisch auf den Kunden zugeschnitten
- Konkrete Maßnahmen die Marketlab umsetzen kann
- Immobilien-Terminologie verwenden
- Alles auf Deutsch
- WICHTIG: Halte dich EXAKT an das Format und diese Design-Qualität. Das Board wird einem Kunden präsentiert und muss absolut professionell aussehen.`;

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
    userMessage += `\nErstelle jetzt die Strategie als JSON. Denke daran: KEINE Sticky Notes, NUR geo shapes, font immer "sans", dash immer "solid".`;

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
