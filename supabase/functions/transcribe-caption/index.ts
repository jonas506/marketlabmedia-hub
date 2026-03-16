import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getClient() {
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
      max_tokens: 2000,
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

async function getClientContext(supabase: any, clientId: string): Promise<string> {
  const { data: client } = await supabase
    .from("clients")
    .select("name, tonality, target_audience, industry, content_topics, usps")
    .eq("id", clientId)
    .single();

  if (!client) return "";
  return `Kunde: ${client.name}. Branche: ${client.industry || "k.A."}. Tonalität: ${client.tonality || "professionell"}. Zielgruppe: ${client.target_audience || "k.A."}. Themen: ${client.content_topics || "k.A."}. USPs: ${client.usps || "k.A."}.`;
}

// ── Google Drive helpers ──
function getGoogleDriveFileId(url: string): string | null {
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return fileMatch[1];
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) return idMatch[1];
  return null;
}

function getGoogleDriveDirectUrl(url: string): string | null {
  const fileId = getGoogleDriveFileId(url);
  if (!fileId) return null;
  const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
  if (!GOOGLE_API_KEY) return null;
  return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${GOOGLE_API_KEY}`;
}

// ── Stream video from URL directly to ElevenLabs (no full buffering) ──
async function transcribeViaStreaming(sourceUrl: string, fileName: string): Promise<string> {
  const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
  if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY not configured. Bitte ElevenLabs verbinden.");

  console.log("Fetching video stream from:", sourceUrl.substring(0, 80) + "...");
  
  // Fetch the video as a stream
  const videoResponse = await fetch(sourceUrl, { redirect: "follow" });
  if (!videoResponse.ok) {
    const errText = await videoResponse.text();
    if (videoResponse.status === 404) {
      throw new Error("Datei nicht gefunden. Bitte prüfe ob der Google Drive Link korrekt ist und die Datei freigegeben ist.");
    }
    if (videoResponse.status === 403) {
      throw new Error("Zugriff verweigert. Bitte stelle sicher, dass die Datei auf 'Jeder mit dem Link' freigegeben ist.");
    }
    throw new Error(`Download Fehler [${videoResponse.status}]: ${errText.substring(0, 200)}`);
  }

  const contentLength = videoResponse.headers.get("content-length");
  const fileSizeBytes = contentLength ? parseInt(contentLength) : 0;
  console.log(`Video size: ${fileSizeBytes} bytes (${Math.round(fileSizeBytes / 1024 / 1024)} MB)`);

  // For large files (>50MB), we need to extract audio first or use a different approach
  // ElevenLabs accepts up to 1GB files, but edge functions have ~150MB memory
  // Strategy: Stream the response body directly into ElevenLabs FormData
  
  if (fileSizeBytes > 100 * 1024 * 1024) {
    // For very large files, read in chunks and build a smaller buffer
    // We'll read only the first 50MB which should contain enough audio for transcription
    console.log("Large file detected, reading first 50MB for transcription...");
    const MAX_BYTES = 50 * 1024 * 1024;
    const reader = videoResponse.body!.getReader();
    const chunks: Uint8Array[] = [];
    let totalRead = 0;

    while (totalRead < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalRead += value.length;
    }
    reader.cancel();

    console.log(`Read ${totalRead} bytes (${Math.round(totalRead / 1024 / 1024)} MB), sending to ElevenLabs...`);
    
    const combined = new Uint8Array(totalRead);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    return await sendToElevenLabs(combined, fileName, ELEVENLABS_API_KEY);
  }

  // For smaller files (<100MB), buffer entirely
  const buf = await videoResponse.arrayBuffer();
  console.log(`Downloaded ${buf.byteLength} bytes, sending to ElevenLabs...`);
  return await sendToElevenLabs(new Uint8Array(buf), fileName, ELEVENLABS_API_KEY);
}

async function sendToElevenLabs(audioBytes: Uint8Array, fileName: string, apiKey: string): Promise<string> {
  const formData = new FormData();
  const blob = new Blob([audioBytes], { type: "video/mp4" });
  formData.append("file", blob, fileName);
  formData.append("model_id", "scribe_v2");
  formData.append("language_code", "deu");

  const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    if (response.status === 401) {
      throw new Error("ElevenLabs: Zugang verweigert. Bitte prüfe ob dein ElevenLabs-Plan aktiv ist.");
    }
    throw new Error(`ElevenLabs STT failed [${response.status}]: ${errText}`);
  }

  const data = await response.json();

  // Build transcript with timestamps
  if (data.words && data.words.length > 0) {
    let transcript = "";
    let currentTimestamp = -1;

    for (const word of data.words) {
      const seconds = Math.floor(word.start_time || 0);
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      const timeStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

      if (seconds - currentTimestamp >= 10 || currentTimestamp === -1) {
        if (transcript) transcript += "\n\n";
        transcript += `[${timeStr}] `;
        currentTimestamp = seconds;
      }

      transcript += (word.text || "") + " ";
    }

    return transcript.trim();
  }

  return data.text || "";
}

// ── Download from Supabase storage (smaller files) ──
async function downloadFromStorage(supabase: any, videoPath: string): Promise<{ bytes: Uint8Array; fileName: string }> {
  const { data: fileData, error: dlError } = await supabase.storage
    .from("content-videos")
    .download(videoPath);
  if (dlError || !fileData) {
    throw new Error("Video konnte nicht heruntergeladen werden: " + (dlError?.message || "Unbekannt"));
  }
  const arrayBuf = await fileData.arrayBuffer();
  return { bytes: new Uint8Array(arrayBuf), fileName: videoPath.split("/").pop() || "video.mp4" };
}

function buildCaptionSystemPrompt(clientContext: string, customPrompt?: string): string {
  const base = `Du bist ein Social Media Experte und SEO-Spezialist. Erstelle eine Instagram/TikTok Caption basierend auf dem Transkript eines Content Pieces.

Die Caption soll:
- SEO-optimiert sein mit relevanten Keywords im Text
- Einen starken Hook am Anfang haben (Frage, Statement, Provokation)
- Den Kerninhalt des Transkripts zusammenfassen
- Einen passenden Call-to-Action enthalten – wähle den sinnvollsten je nach Content-Art:
  • "Folge für mehr [Thema]" bei lehrreichen/informativen Inhalten
  • "Speichere diesen Post für später 🔖" bei Tipps, Anleitungen, Listen
  • "Teile das mit jemandem, der das braucht" bei relatable/motivierenden Inhalten
  • "Schreib mir in die Kommentare..." bei Meinungs-/Diskussionsthemen
  • "Link in Bio" bei produktbezogenen Inhalten
  • Kombiniere max. 2 CTAs wenn sinnvoll
- 5-10 relevante Hashtags am Ende (Mix aus Nischen- und Reichweiten-Hashtags)
- Zur Tonalität des Kunden passen
- Emojis sparsam aber effektiv einsetzen
- Maximal 2200 Zeichen lang sein
- Absätze und Zeilenumbrüche für Lesbarkeit nutzen

${clientContext}`;

  if (customPrompt) {
    return base + `\n\nZusätzliche Anweisung vom User:\n${customPrompt}\n\nAntworte NUR mit der fertigen Caption, keine Erklärungen.`;
  }
  return base + `\n\nAntworte NUR mit der fertigen Caption, keine Erklärungen.`;
}

function buildRefineSystemPrompt(clientContext: string): string {
  return `Du bist ein Social Media Experte. Passe die folgende Caption nach den Wünschen des Users an.
Behalte den grundsätzlichen Stil und die Hashtags bei, es sei denn der User wünscht etwas anderes.
${clientContext}
Antworte NUR mit der überarbeiteten Caption, keine Erklärungen.`;
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

    const supabase = getClient();

    // ── Transcribe video via ElevenLabs ──
    if (action === "transcribe") {
      const { piece_id } = body;
      if (!piece_id) {
        return new Response(JSON.stringify({ error: "piece_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: piece } = await supabase
        .from("content_pieces")
        .select("id, client_id, video_path, preview_link")
        .eq("id", piece_id)
        .single();

      if (!piece) {
        return new Response(JSON.stringify({ error: "Piece not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let transcript: string;

      if (piece.preview_link) {
        console.log("Transcribing from preview_link:", piece.preview_link);
        
        // Check if it's a Google Drive URL and get direct API URL
        const directUrl = getGoogleDriveDirectUrl(piece.preview_link);
        const sourceUrl = directUrl || piece.preview_link;
        
        transcript = await transcribeViaStreaming(sourceUrl, "video.mp4");
      } else if (piece.video_path) {
        const { bytes, fileName } = await downloadFromStorage(supabase, piece.video_path);
        const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
        if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY not configured");
        transcript = await sendToElevenLabs(bytes, fileName, ELEVENLABS_API_KEY);
      } else {
        return new Response(JSON.stringify({ error: "Kein Video-Link oder Video vorhanden. Bitte einen Preview-Link setzen." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("content_pieces").update({ transcript }).eq("id", piece_id);

      return new Response(JSON.stringify({ success: true, transcript }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Generate caption ──
    if (action === "generate") {
      const { piece_id, custom_prompt } = body;
      if (!piece_id) {
        return new Response(JSON.stringify({ error: "piece_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: piece } = await supabase
        .from("content_pieces")
        .select("id, type, title, client_id, script_text, transcript")
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
      if (piece.transcript) userPrompt += `\n\nEchtes Transkript des Videos:\n${piece.transcript}`;

      const caption = await callAI(LOVABLE_API_KEY, buildCaptionSystemPrompt(clientContext, custom_prompt), userPrompt);

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
        .select("id, type, title, client_id, script_text, transcript")
        .in("id", piece_ids);

      if (!pieces?.length) {
        return new Response(JSON.stringify({ error: "No pieces found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const clientContext = await getClientContext(supabase, pieces[0].client_id);
      const captionSystemPrompt = buildCaptionSystemPrompt(clientContext);

      const results: { id: string; caption: string; error?: string }[] = [];

      for (const piece of pieces) {
        try {
          let userPrompt = `Content-Typ: ${piece.type}. Titel: ${piece.title || "Ohne Titel"}.`;
          if (piece.script_text) userPrompt += `\n\nSkript:\n${piece.script_text}`;
          if (piece.transcript) userPrompt += `\n\nEchtes Transkript des Videos:\n${piece.transcript}`;

          const caption = await callAI(LOVABLE_API_KEY, captionSystemPrompt, userPrompt);
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
