import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { piece_id } = await req.json();
    if (!piece_id) {
      return new Response(JSON.stringify({ error: "piece_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Fetch piece
    const { data: piece, error: pieceError } = await supabase
      .from("content_pieces")
      .select("id, preview_link, type, title, client_id, script_text")
      .eq("id", piece_id)
      .single();

    if (pieceError || !piece) {
      return new Response(JSON.stringify({ error: "Piece not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch client info for context
    const { data: client } = await supabase
      .from("clients")
      .select("name, tonality, target_audience, industry, content_topics, usps")
      .eq("id", piece.client_id)
      .single();

    const clientContext = client
      ? `Kunde: ${client.name}. Branche: ${client.industry || "k.A."}. Tonalität: ${client.tonality || "professionell"}. Zielgruppe: ${client.target_audience || "k.A."}. Themen: ${client.content_topics || "k.A."}. USPs: ${client.usps || "k.A."}.`
      : "";

    // Build content context from available data
    let contentContext = `Content-Typ: ${piece.type}. Titel: ${piece.title || "Ohne Titel"}.`;
    if (piece.script_text) {
      contentContext += `\n\nSkript/Text des Contents:\n${piece.script_text}`;
    }

    console.log("Generating caption via AI...");

    const captionResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `Du bist ein Social Media Experte. Erstelle eine Instagram/TikTok Caption für ein Content Piece.
Die Caption soll:
- Aufmerksamkeit erregen (Hook am Anfang)
- Den Kerninhalt zusammenfassen
- Einen Call-to-Action enthalten
- 3-5 relevante Hashtags am Ende haben
- Zur Tonalität des Kunden passen
- Emojis sparsam aber effektiv einsetzen
- Maximal 2200 Zeichen lang sein

${clientContext}

Antworte NUR mit der fertigen Caption, keine Erklärungen.`,
            },
            {
              role: "user",
              content: contentContext,
            },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      }
    );

    if (!captionResponse.ok) {
      const status = captionResponse.status;
      const errText = await captionResponse.text();
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit erreicht. Bitte versuche es in einer Minute erneut." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Credits aufgebraucht. Bitte Credits aufladen." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI caption generation failed [${status}]: ${errText}`);
    }

    const captionData = await captionResponse.json();
    const caption = captionData.choices?.[0]?.message?.content || "";

    // Save to DB
    await supabase
      .from("content_pieces")
      .update({ caption })
      .eq("id", piece_id);

    console.log("Saved caption for piece", piece_id);

    return new Response(
      JSON.stringify({ success: true, caption }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
