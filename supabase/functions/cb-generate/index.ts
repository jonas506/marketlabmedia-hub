import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PROMPTS: Record<string, (idea: string) => string> = {
  linkedin: (i) => `Schreibe einen professionellen LinkedIn-Post auf Deutsch zum Thema: "${i}". Starker Einstieg, 3 Punkte, CTA. Ca. 200 Wörter. Gib NUR den Post-Text zurück.`,
  instagram: (i) => `Instagram-Caption auf Deutsch zu: "${i}". Emotional, mit Hashtags, max. 250 Zeichen. Gib NUR die Caption zurück.`,
  carousel: (i) => `5 Slide-Texte für Instagram Carousel auf Deutsch zu: "${i}". Je kurze Überschrift + 1-2 Sätze. Nummeriert. Gib NUR die Slides zurück.`,
  story: (i) => `Instagram Story Text auf Deutsch zu: "${i}". Max. 3 Zeilen, CTA, emoji-freundlich. Gib NUR den Text zurück.`,
  tweet: (i) => `3 Tweets auf Deutsch zu: "${i}". Max. 280 Zeichen je. Nummeriert 1. 2. 3. Gib NUR die Tweets zurück.`,
};

function buildUserContent(prompt: string, referenceImages?: string[]) {
  if (!referenceImages || referenceImages.length === 0) return prompt;
  const parts: any[] = [{ type: "text", text: prompt }];
  for (const url of referenceImages) parts.push({ type: "image_url", image_url: { url } });
  return parts;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const { type, ctype, idea, model, referenceImages, format, action, topic, slideCount, clientName, handle } = body;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    const aiModel = model === "claude-haiku" ? "google/gemini-2.5-flash-lite" : "google/gemini-3-flash-preview";
    const hasImages = referenceImages && referenceImages.length > 0;
    const imageContext = hasImages ? " Berücksichtige die beigefügten Referenzbilder." : "";

    if (action === "carousel_slides") {
      const count = slideCount || 5;
      const carouselPrompt = `Erstelle genau ${count} Slide-Texte für einen Instagram Carousel Post auf Deutsch zum Thema: "${topic}".
${clientName ? `Für den Account: ${handle || clientName}.` : ""}

Regeln:
- Slide 1: Starke Headline die zum Weiterswipen animiert
- Slides 2-${count - 1}: Jeweils ein klarer Punkt/Fakt/Tipp
- Slide ${count}: CTA (Call-to-Action) — z.B. "Speichern & Teilen"
- Pro Slide max. 3-4 Sätze
- Klar, direkt, ohne Emojis im Text

Antworte NUR als JSON-Array mit ${count} Strings, z.B. ["Slide 1 text", "Slide 2 text", ...]`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: aiModel,
          messages: [
            { role: "system", content: "Du bist ein Social Media Content Creator. Antworte NUR mit validem JSON." },
            { role: "user", content: carouselPrompt },
          ],
          tools: [{
            type: "function",
            function: {
              name: "return_slides",
              description: "Return carousel slide texts",
              parameters: {
                type: "object",
                properties: {
                  slides: { type: "array", items: { type: "string" }, minItems: count, maxItems: count }
                },
                required: ["slides"],
                additionalProperties: false,
              }
            }
          }],
          tool_choice: { type: "function", function: { name: "return_slides" } },
        }),
      });
      if (!response.ok) throw new Error("AI gateway error");
      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall) {
        const parsed = JSON.parse(toolCall.function.arguments);
        return new Response(JSON.stringify({ slides: parsed.slides }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Fallback: try to parse content as JSON
      const content = data.choices?.[0]?.message?.content || "[]";
      const match = content.match(/\[[\s\S]*\]/);
      const slides = match ? JSON.parse(match[0]) : [];
      return new Response(JSON.stringify({ slides }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (type === "image") {
      const imagePrompt = `Generate a professional image for social media about: "${idea}". Style: modern, clean, vibrant colors.`;
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-3.1-flash-image-preview", messages: [{ role: "user", content: buildUserContent(imagePrompt, referenceImages) }], modalities: ["image", "text"] }),
      });
      if (!response.ok) throw new Error("Image generation error");
      const data = await response.json();
      const base64Url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
      if (!base64Url) return new Response(JSON.stringify({ imageUrl: null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      try {
        const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const match = base64Url.match(/^data:image\/(png|jpeg|webp);base64,(.+)$/);
        if (match) {
          const bytes = base64ToUint8Array(match[2]);
          const fileName = `generated/${crypto.randomUUID()}.${match[1]}`;
          const { error } = await supabase.storage.from("reference-images").upload(fileName, bytes, { contentType: `image/${match[1]}`, upsert: true });
          if (!error) { const { data: urlData } = supabase.storage.from("reference-images").getPublicUrl(fileName); return new Response(JSON.stringify({ imageUrl: urlData.publicUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
        }
      } catch (e) { console.error("Upload failed:", e); }
      return new Response(JSON.stringify({ imageUrl: base64Url }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (type === "htmlimage") {
      const htmlPrompt = `Erstelle vollständigen HTML-Code für ein Social-Media-Design zum Thema: "${idea}". Format: ${format || "instagram-post"}. Vollständiges HTML mit eingebetteten Styles. Gib NUR HTML zurück.`;
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: aiModel, messages: [{ role: "system", content: "Du erstellst HTML/CSS Social-Media-Grafiken. Output ist NUR HTML-Code." }, { role: "user", content: buildUserContent(htmlPrompt, referenceImages) }] }),
      });
      if (!response.ok) throw new Error("HTML generation error");
      const data = await response.json();
      let content = data.choices?.[0]?.message?.content || "";
      content = content.replace(/^```html?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      return new Response(JSON.stringify({ content }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new Error(`Unknown type: ${type}`);
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
