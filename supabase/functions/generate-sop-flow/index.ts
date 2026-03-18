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
  "connections": [...]
}
\`\`\`

Und danach eine kurze Erklärung in Markdown.

## Node-Typen und ihre Verwendung:
- "rectangle": Standard-Aktionsschritt (blau)
- "diamond": Entscheidung / Ja-Nein-Frage (gelb/orange)
- "oval": Start / Ende (grün/rot)
- "circle": Meilenstein oder Checkpoint
- "triangle": Warnung oder Achtung
- "hexagon": Prozess mit Untergruppen
- "trapezoid": Eingabe / Ausgabe
- "parallelogram": Daten oder Dokument
- "sticky": Notiz / Kommentar
- "text": Beschriftung

## Node-Format:
{
  "id": "sn_1", // eindeutige ID
  "type": "rectangle",
  "x": 300, "y": 100, // Position
  "w": 180, "h": 80,  // Größe
  "label": "Schritt-Text",
  "color": "#3b82f6", // Hex-Farbe
  "fontSize": 12
}

## Connection-Format:
{
  "id": "sc_1",
  "from": "sn_1", // ID des Start-Nodes
  "to": "sn_2",   // ID des Ziel-Nodes
  "label": "Ja"   // Optional: Beschriftung auf dem Pfeil
}

## Layout-Regeln:
- Starte bei x:300, y:50
- Vertikaler Abstand zwischen Nodes: ~120px
- Bei Verzweigungen (Diamond): Platziere "Ja" rechts und "Nein" links, mit ~250px horizontalem Abstand
- Start-Node immer als "oval" mit grüner Farbe (#10b981)
- End-Node immer als "oval" mit roter Farbe (#ef4444)
- Entscheidungen als "diamond" mit gelber/oranger Farbe (#f59e0b)
- Aktionen als "rectangle" mit blauer Farbe (#3b82f6)
- Verwende verschiedene Farben zur Visualisierung unterschiedlicher Phasen

## Kontext:
Die Agentur erstellt Social-Media-Content (Reels, Carousels, Stories) für Kunden. Typische Prozesse:
- Kunden-Onboarding
- Content-Produktion (Skript → Dreh → Schnitt → Review → Freigabe)
- Monatsplanung
- Shoot-Day Vorbereitung
- Marketing-Kampagnen Setup`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, currentBoard, templateName } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const contextMsg = currentBoard?.nodes?.length > 0
      ? `\n\nAktuelles Board "${templateName}" hat ${currentBoard.nodes.length} Nodes und ${currentBoard.connections.length} Verbindungen. Hier ist der aktuelle Stand:\n\`\`\`json\n${JSON.stringify(currentBoard, null, 2)}\n\`\`\`\nBearbeite dieses Board basierend auf der Anfrage des Nutzers.`
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

    // Extract JSON from response
    let board = null;
    const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        board = JSON.parse(jsonMatch[1]);
      } catch (e) {
        console.error("JSON parse error:", e);
      }
    }

    // Remove JSON block from message
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
