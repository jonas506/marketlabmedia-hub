import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function callAI(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const status = response.status;
    const errText = await response.text();
    if (status === 429) throw new Error("RATE_LIMITED");
    if (status === 402) throw new Error("PAYMENT_REQUIRED");
    throw new Error(`AI failed [${status}]: ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

function buildCaptionSystemPrompt(clientContext: string): string {
  return `Du bist ein Social Media Experte. Erstelle eine Instagram/TikTok Caption für ein Content Piece.
Die Caption soll:
- Aufmerksamkeit erregen (Hook am Anfang)
- Den Kerninhalt zusammenfassen
- Einen Call-to-Action enthalten
- 3-5 relevante Hashtags am Ende haben
- Zur Tonalität des Kunden passen
- Emojis sparsam aber effektiv einsetzen
- Maximal 2200 Zeichen lang sein

${clientContext}

Antworte NUR mit der fertigen Caption, keine Erklärungen.`;
}

function buildRefineSystemPrompt(clientContext: string): string {
  return `Du bist ein Social Media Experte. Passe die folgende Caption nach den Wünschen des Users an.
Behalte den grundsätzlichen Stil und die Hashtags bei, es sei denn der User wünscht etwas anderes.
${clientContext}
Antworte NUR mit der überarbeiteten Caption, keine Erklärungen.`;
}

async function getClientContext(supabase: any, clientId: string): Promise<string> {
  const { data: client } = await supabase
    .from("clients")
    .select("name, tonality, target_audience, industry, content_topics, usps")
    .eq("id", clientId)
    .single();

  if (!client) return "";
  return `Kunde: ${client.name}. Branche: ${client.industry || "k.A."}. Tonalität: ${client.tonality || "professionell"}. Zielgruppe: ${client.target_audience || "k.A."}. Themen: ${client.content_topics || "k.A."}. USPs: ${client.usps || "k.A."}.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action = "generate" } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = await getClient();

    // ── Single generate ──
    if (action === "generate") {
      const { piece_id } = body;
      if (!piece_id) {
        return new Response(JSON.stringify({ error: "piece_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: piece } = await supabase
        .from("content_pieces")
        .select("id, type, title, client_id, script_text")
        .eq("id", piece_id)
        .single();

      if (!piece) {
        return new Response(JSON.stringify({ error: "Piece not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const clientContext = await getClientContext(supabase, piece.client_id);
      let userPrompt = `Content-Typ: ${piece.type}. Titel: ${piece.title || "Ohne Titel"}.`;
      if (piece.script_text) userPrompt += `\n\nSkript:\n${piece.script_text}`;

      const caption = await callAI(LOVABLE_API_KEY, buildCaptionSystemPrompt(clientContext), userPrompt);

      await supabase.from("content_pieces").update({ caption }).eq("id", piece_id);

      return new Response(JSON.stringify({ success: true, caption }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Bulk generate ──
    if (action === "bulk_generate") {
      const { piece_ids } = body;
      if (!piece_ids?.length) {
        return new Response(JSON.stringify({ error: "piece_ids required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: pieces } = await supabase
        .from("content_pieces")
        .select("id, type, title, client_id, script_text")
        .in("id", piece_ids);

      if (!pieces?.length) {
        return new Response(JSON.stringify({ error: "No pieces found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get client context (assume all pieces are same client)
      const clientContext = await getClientContext(supabase, pieces[0].client_id);
      const systemPrompt = buildCaptionSystemPrompt(clientContext);

      const results: { id: string; caption: string; error?: string }[] = [];

      // Process sequentially to avoid rate limits
      for (const piece of pieces) {
        try {
          let userPrompt = `Content-Typ: ${piece.type}. Titel: ${piece.title || "Ohne Titel"}.`;
          if (piece.script_text) userPrompt += `\n\nSkript:\n${piece.script_text}`;

          const caption = await callAI(LOVABLE_API_KEY, systemPrompt, userPrompt);
          await supabase.from("content_pieces").update({ caption }).eq("id", piece.id);
          results.push({ id: piece.id, caption });
        } catch (err) {
          results.push({ id: piece.id, caption: "", error: err.message });
        }
      }

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Refine existing caption ──
    if (action === "refine") {
      const { piece_id, current_caption, instruction } = body;
      if (!piece_id || !current_caption || !instruction) {
        return new Response(JSON.stringify({ error: "piece_id, current_caption, and instruction required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: piece } = await supabase
        .from("content_pieces")
        .select("id, client_id")
        .eq("id", piece_id)
        .single();

      if (!piece) {
        return new Response(JSON.stringify({ error: "Piece not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const clientContext = await getClientContext(supabase, piece.client_id);
      const userPrompt = `Aktuelle Caption:\n${current_caption}\n\nGewünschte Änderung:\n${instruction}`;

      const caption = await callAI(LOVABLE_API_KEY, buildRefineSystemPrompt(clientContext), userPrompt);

      await supabase.from("content_pieces").update({ caption }).eq("id", piece_id);

      return new Response(JSON.stringify({ success: true, caption }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    const msg = err.message;
    if (msg === "RATE_LIMITED") {
      return new Response(JSON.stringify({ error: "Rate limit erreicht. Bitte versuche es in einer Minute erneut." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (msg === "PAYMENT_REQUIRED") {
      return new Response(JSON.stringify({ error: "Credits aufgebraucht. Bitte Credits aufladen." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
