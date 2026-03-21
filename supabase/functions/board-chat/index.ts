import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BOARD_CHAT_SYSTEM = `Du bist der AI-Strategie-Assistent auf einem Marketlab Media Strategy Board. Du hilfst dem User seine Marketing-Strategie zu verfeinern.

Du kannst:
- Fragen zur bestehenden Strategie beantworten
- Neue Elemente zum Board hinzufügen
- Bestehende Elemente modifizieren
- Erklärungen und Empfehlungen geben

DESIGN-REGELN:
- KEINE Sticky Notes (type: "note"). Verwende NUR geo shapes (type: "geo").
- Font ist IMMER "sans". Niemals "draw".
- Dash ist IMMER "solid" (außer "dashed" für gestrichelte Linien). Niemals "draw".
- Verwende das Farbsystem:
  - ellipse (orange) = Kampagnen/Kanäle
  - rectangle (violet) = Content/Maßnahmen
  - diamond (yellow) = Entscheidungspunkte
  - hexagon (green) = Ergebnisse
  - rectangle mit fill "semi" = Info-Blöcke/Erklärungen

Wenn der User möchte dass du etwas auf dem Board ÄNDERST oder HINZUFÜGST, antworte mit:
1. Einem kurzen erklärenden Text
2. Einem JSON-Block mit den Änderungen im Format:

\`\`\`json
{"board_actions": [
  {
    "action": "add_node",
    "node": {
      "id": "new_1",
      "type": "geo",
      "geo": "rectangle",
      "label": "Retargeting\\nKampagne",
      "x": 800, "y": 600,
      "w": 180, "h": 100,
      "color": "orange",
      "fill": "solid",
      "size": "m",
      "font": "sans",
      "align": "middle",
      "verticalAlign": "middle",
      "dash": "solid"
    }
  },
  {
    "action": "add_edge",
    "edge": {
      "id": "new_e1",
      "from": "existing_node_id",
      "to": "new_1",
      "label": "Kein Abschluss",
      "color": "orange",
      "dash": "dashed",
      "bend": -20
    }
  }
]}
\`\`\`

Wenn der User nur eine Frage stellt, antworte nur mit Text (kein JSON).

REGELN:
- Antworte auf Deutsch
- Sei konkret und praxisnah
- Beziehe dich auf die Immobilienbranche
- Halte Antworten kurz (max 3-4 Sätze + Board-Aktionen)
- Platziere neue Elemente an sinnvollen Positionen (positive x/y Werte, genug Abstand zu bestehenden)`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, boardShapes, chatHistory, boardId } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let systemWithContext = BOARD_CHAT_SYSTEM;
    if (boardShapes && boardShapes.length > 0) {
      const shapesSummary = boardShapes.map((s: any) => ({
        id: s.id,
        type: s.type,
        text: s.props?.text || s.props?.name || "",
        x: Math.round(s.x),
        y: Math.round(s.y),
      }));
      systemWithContext += `\n\nAKTUELLER BOARD-STATE (Shapes):\n${JSON.stringify(shapesSummary, null, 2)}`;
    }

    const messages = [];
    const recentHistory = (chatHistory || []).slice(-20);
    for (const msg of recentHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }
    messages.push({ role: "user", content: message });

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemWithContext },
          ...messages,
        ],
        max_tokens: 4096,
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

    let boardActions = null;
    const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.board_actions) {
          boardActions = parsed.board_actions;
        }
      } catch {
        // Not valid JSON, ignore
      }
    }

    const responseText = content.replace(/```json[\s\S]*?```/g, "").trim();

    if (boardId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const updatedHistory = [
        ...recentHistory,
        { role: "user", content: message, timestamp: new Date().toISOString() },
        { role: "assistant", content: content, timestamp: new Date().toISOString() },
      ].slice(-40);

      await supabase
        .from("strategy_boards")
        .update({ chat_history: updatedHistory })
        .eq("id", boardId);
    }

    return new Response(JSON.stringify({
      success: true,
      response: responseText,
      board_actions: boardActions,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in board chat:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
