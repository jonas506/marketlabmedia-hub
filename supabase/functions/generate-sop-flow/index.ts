import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Du bist ein SOP-Flowchart-Generator für eine Social-Media-Agentur. Du erstellst und bearbeitest visuelle Flowcharts als JSON.

WICHTIG: Antworte IMMER mit einem JSON-Block im Format:
\`\`\`json
{
  "nodes": [...],
  "connections": [...],
  "swimlanes": [...]
}
\`\`\`

Und danach eine kurze Erklärung in Markdown.

## Node-Typen und ihre Verwendung:
- "start": Start-Punkt (abgerundete Pill-Form, grün #10b981)
- "end": End-Punkt (abgerundete Pill-Form, rot #ef4444)
- "process": Standard-Aktionsschritt (Rechteck, blau #3b82f6)
- "decision": Entscheidung / Ja-Nein-Frage (Raute, orange #f59e0b)
- "parallel": Parallele Aktionen (Rechteck mit Doppellinie, lila #8b5cf6)
- "checklist": Checklisten-Schritt (Rechteck mit Checkbox, cyan #06b6d4)
- "note": Hinweis / Bonus Info (Post-it-Style, gelb #eab308)
- "text": Beschriftung / Label

## Node-Format:
{
  "id": "sn_1",
  "type": "process",
  "x": 300, "y": 100,
  "w": 180, "h": 80,
  "label": "Schritt-Text",
  "color": "#3b82f6",
  "fontSize": 12,
  "responsible": "Head of Content",
  "timeframe": "innerhalb 24h",
  "description": "Detaillierte Beschreibung des Schritts",
  "checklistItems": [
    { "id": "ci_1", "text": "Unteraufgabe 1", "done": false },
    { "id": "ci_2", "text": "Unteraufgabe 2", "done": false }
  ]
}

## Connection-Format:
{
  "id": "sc_1",
  "from": "sn_1",
  "to": "sn_2",
  "label": "Ja"
}

## Swimlane-Format (optional):
{
  "id": "sl_1",
  "label": "Head of Content",
  "color": "#3b82f620",
  "y": 0,
  "height": 250
}

## Verantwortliche (responsible):
Typische Rollen: "Geschäftsführer", "Head of Content", "Cutter", "Jonas", "Katha", "Alle"

## Befehle die du verstehen musst:
- "Erstelle Prozess: [Beschreibung]" → Generiere vollständigen Flow mit Start, Prozessschritten, Entscheidungen und Ende
- "Füge Checkliste hinzu für: [Node-Name]" → Finde den Node und ergänze checklistItems
- "Wer ist verantwortlich für [Schritt]?" → Zeige den Verantwortlichen des Nodes
- "Erstelle Swimlanes für [Personen]" → Erstelle horizontale Lanes und ordne Nodes zu

## Layout-Regeln:
- Starte bei x:300, y:80
- Vertikaler Abstand zwischen Nodes: ~130px
- Bei Verzweigungen (decision): "Ja" rechts (+250px), "Nein" links (-250px)
- Start-Node immer als "start" mit grüner Farbe (#10b981)
- End-Node immer als "end" mit roter Farbe (#ef4444)
- Setze sinnvolle responsible und timeframe Werte
- Füge bei komplexen Schritten checklistItems hinzu
- Nutze "parallel" für gleichzeitige Aktionen
- Nutze "note" für wichtige Hinweise

## Kontext:
Die Agentur erstellt Social-Media-Content (Reels, Carousels, Stories) für Kunden. Typische Prozesse:
- Kunden-Onboarding (Vertrag → Setup → Kick-off → Strategie)
- Content-Produktion (Skript → Dreh → Schnitt → Review → Freigabe)
- Monatsplanung (Ideen → Skripte → Planung → Produktion)
- Shoot-Day (Vorbereitung → Location → Dreh → Nachbereitung)
- Marketing-Kampagnen (Briefing → Creative → Launch → Optimierung)`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, currentBoard, templateName } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const contextMsg = currentBoard?.nodes?.length > 0
      ? `\n\nAktuelles Board "${templateName}" hat ${currentBoard.nodes.length} Nodes, ${currentBoard.connections.length} Verbindungen und ${currentBoard.swimlanes?.length || 0} Swimlanes. Hier ist der aktuelle Stand:\n\`\`\`json\n${JSON.stringify(currentBoard, null, 2)}\n\`\`\`\nBearbeite dieses Board basierend auf der Anfrage des Nutzers.`
      : `\n\nDas Board "${templateName}" ist noch leer. Erstelle ein neues Flowchart basierend auf der Anfrage.`;

    const aiMessages = [
      { role: "system", content: SYSTEM_PROMPT + contextMsg },
      ...messages,
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate-Limit erreicht. Bitte warte kurz." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits aufgebraucht. Bitte lade Credits nach." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    let board = null;
    const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        board = JSON.parse(jsonMatch[1]);
      } catch (e) {
        console.error("JSON parse error:", e);
      }
    }

    const message = content.replace(/```json[\s\S]*?```/g, "").trim();

    return new Response(JSON.stringify({ board, message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-sop-flow error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
