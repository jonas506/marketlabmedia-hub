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

// ── Google Drive download helper ──
function getGoogleDriveFileId(url: string): string | null {
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return fileMatch[1];
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) return idMatch[1];
  return null;
}

async function downloadFromUrl(url: string): Promise<{ bytes: Uint8Array; fileName: string }> {
  const fileId = getGoogleDriveFileId(url);
  
  if (fileId) {
    // Use the newer usercontent domain which handles large files better
    const downloadUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
    console.log("Downloading from Google Drive:", downloadUrl);
    
    const response = await fetch(downloadUrl, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    
    if (!response.ok) {
      throw new Error(`Google Drive download failed [${response.status}]: ${response.statusText}`);
    }
    
    const contentType = response.headers.get("content-type") || "";
    console.log("Response content-type:", contentType, "status:", response.status);
    
    // If we still got HTML, the file is likely not publicly shared
    if (contentType.includes("text/html")) {
      const html = await response.text();
      console.log("Got HTML response (first 500 chars):", html.substring(0, 500));
      throw new Error("Google Drive Datei konnte nicht heruntergeladen werden. Bitte stelle sicher, dass der Link auf 'Jeder mit dem Link' freigegeben ist.");
    }
    
    const buf = await response.arrayBuffer();
    console.log(`Downloaded ${buf.byteLength} bytes, content-type: ${contentType}`);
    return { bytes: new Uint8Array(buf), fileName: "video.mp4" };
  }
  
  // Non-Google-Drive URL: direct download
  console.log("Downloading from URL:", url);
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`Download failed [${response.status}]`);
  const buf = await response.arrayBuffer();
  return { bytes: new Uint8Array(buf), fileName: "video.mp4" };
}

// ── ElevenLabs Speech-to-Text ──
async function transcribeWithElevenLabs(audioBytes: Uint8Array, fileName: string): Promise<string> {
  const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
  if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY not configured. Bitte ElevenLabs verbinden.");

  const formData = new FormData();
  const blob = new Blob([audioBytes], { type: "video/mp4" });
  formData.append("file", blob, fileName);
  formData.append("model_id", "scribe_v2");
  formData.append("language_code", "deu");

  const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY,
    },
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    if (response.status === 401) {
      throw new Error("ElevenLabs: Zugang verweigert. Bitte prüfe ob dein ElevenLabs-Plan aktiv ist (Free Tier kann blockiert sein).");
    }
    throw new Error(`ElevenLabs STT failed [${response.status}]: ${errText}`);
  }

  const data = await response.json();
  
  // Build transcript with timestamps from words
  if (data.words && data.words.length > 0) {
    let transcript = "";
    let currentTimestamp = -1;
    
    for (const word of data.words) {
      const seconds = Math.floor(word.start_time || 0);
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      const timeStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
      
      // Add timestamp every ~10 seconds
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

function buildCaptionSystemPrompt(clientContext: string, customPrompt?: string): string {
  const base = `Du bist ein Social Media Experte. Erstelle eine Instagram/TikTok Caption für ein Content Piece.
Die Caption soll:
- Aufmerksamkeit erregen (Hook am Anfang)
- Den Kerninhalt zusammenfassen
- Einen Call-to-Action enthalten
- 3-5 relevante Hashtags am Ende haben
- Zur Tonalität des Kunden passen
- Emojis sparsam aber effektiv einsetzen
- Maximal 2200 Zeichen lang sein

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

      let bytes: Uint8Array;
      let fileName: string;

      // Priority: preview_link (Google Drive) > uploaded video
      if (piece.preview_link) {
        console.log("Transcribing from preview_link:", piece.preview_link);
        const downloaded = await downloadFromUrl(piece.preview_link);
        bytes = downloaded.bytes;
        fileName = downloaded.fileName;
      } else if (piece.video_path) {
        // Fallback to uploaded video
        const { data: fileData, error: dlError } = await supabase.storage
          .from("content-videos")
          .download(piece.video_path);
        if (dlError || !fileData) {
          return new Response(JSON.stringify({ error: "Video konnte nicht heruntergeladen werden: " + (dlError?.message || "Unbekannt") }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const arrayBuf = await fileData.arrayBuffer();
        bytes = new Uint8Array(arrayBuf);
        fileName = piece.video_path.split("/").pop() || "video.mp4";
      } else {
        return new Response(JSON.stringify({ error: "Kein Video-Link oder Video vorhanden. Bitte einen Preview-Link setzen." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`Transcribing ${bytes.length} bytes via ElevenLabs...`);
      const transcript = await transcribeWithElevenLabs(bytes, fileName);

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
