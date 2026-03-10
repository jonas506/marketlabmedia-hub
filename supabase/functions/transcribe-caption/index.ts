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

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      throw new Error("ELEVENLABS_API_KEY not configured");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Fetch piece
    const { data: piece, error: pieceError } = await supabase
      .from("content_pieces")
      .select("id, preview_link, type, title, client_id")
      .eq("id", piece_id)
      .single();

    if (pieceError || !piece) {
      return new Response(JSON.stringify({ error: "Piece not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!piece.preview_link) {
      return new Response(JSON.stringify({ error: "No preview_link set" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch client info for context
    const { data: client } = await supabase
      .from("clients")
      .select("name, tonality, target_audience, industry, content_topics")
      .eq("id", piece.client_id)
      .single();

    // Download the video file
    console.log("Downloading video from:", piece.preview_link);
    const videoResponse = await fetch(piece.preview_link);
    if (!videoResponse.ok) {
      throw new Error(`Failed to download video: ${videoResponse.status}`);
    }
    const videoBlob = await videoResponse.blob();

    // Transcribe via ElevenLabs Speech-to-Text
    console.log("Transcribing via ElevenLabs...");
    const formData = new FormData();
    formData.append("file", videoBlob, "video.mp4");
    formData.append("model_id", "scribe_v2");
    formData.append("language_code", "deu");

    const transcribeResponse = await fetch(
      "https://api.elevenlabs.io/v1/speech-to-text",
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
        },
        body: formData,
      }
    );

    if (!transcribeResponse.ok) {
      const errText = await transcribeResponse.text();
      throw new Error(`ElevenLabs STT failed [${transcribeResponse.status}]: ${errText}`);
    }

    const transcription = await transcribeResponse.json();
    const transcript = transcription.text || "";
    console.log("Transcript:", transcript.substring(0, 200));

    if (!transcript.trim()) {
      // Save empty transcript, no caption
      await supabase
        .from("content_pieces")
        .update({ transcript: "", caption: "" })
        .eq("id", piece_id);

      return new Response(
        JSON.stringify({ success: true, transcript: "", caption: "", message: "No speech detected" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate caption via Lovable AI
    console.log("Generating caption via AI...");
    const clientContext = client
      ? `Kunde: ${client.name}. Branche: ${client.industry || "k.A."}. Tonalität: ${client.tonality || "professionell"}. Zielgruppe: ${client.target_audience || "k.A."}. Themen: ${client.content_topics || "k.A."}.`
      : "";

    const captionResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `Du bist ein Social Media Experte. Erstelle eine Instagram/TikTok Caption basierend auf dem Transkript eines Videos. 
Die Caption soll:
- Aufmerksamkeit erregen (Hook am Anfang)
- Den Kerninhalt des Videos zusammenfassen
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
              content: `Content-Typ: ${piece.type}. Titel: ${piece.title || "Ohne Titel"}\n\nTranskript:\n${transcript}`,
            },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      }
    );

    if (!captionResponse.ok) {
      const errText = await captionResponse.text();
      throw new Error(`AI caption generation failed [${captionResponse.status}]: ${errText}`);
    }

    const captionData = await captionResponse.json();
    const caption = captionData.choices?.[0]?.message?.content || "";

    // Save to DB
    await supabase
      .from("content_pieces")
      .update({ transcript, caption })
      .eq("id", piece_id);

    console.log("Saved transcript and caption");

    return new Response(
      JSON.stringify({ success: true, transcript, caption }),
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
