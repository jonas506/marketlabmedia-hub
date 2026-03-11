import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { urls, texts, pdfTexts } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Scrape URLs if provided
    const scrapedContents: string[] = [];
    let extractedLogoUrl: string | null = null;

    if (urls && urls.length > 0) {
      // Try to extract logo from first URL using Firecrawl branding
      const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
      if (firecrawlKey) {
        try {
          const brandingResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${firecrawlKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              url: urls[0].startsWith("http") ? urls[0] : `https://${urls[0]}`,
              formats: ["markdown", "branding"],
              onlyMainContent: false,
              waitFor: 3000,
            }),
          });

          if (brandingResp.ok) {
            const brandingData = await brandingResp.json();
            const branding = brandingData?.data?.branding;
            
            // Extract logo URL from branding data
            if (branding?.logo) {
              extractedLogoUrl = branding.logo;
              console.log("Extracted logo URL:", extractedLogoUrl);
            }
            
            // Also use the markdown content for analysis
            const md = brandingData?.data?.markdown;
            if (md) {
              scrapedContents.push(`[Website: ${urls[0]}]\n${md.slice(0, 8000)}`);
            }
          }
        } catch (e) {
          console.error("Firecrawl branding extraction failed:", e);
        }
      }

      // Scrape remaining URLs (or first one if Firecrawl failed)
      for (const url of urls.slice(scrapedContents.length > 0 ? 1 : 0, 5)) {
        try {
          const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
          if (resp.ok) {
            const html = await resp.text();
            const text = html.replace(/<script[\s\S]*?<\/script>/gi, "")
              .replace(/<style[\s\S]*?<\/style>/gi, "")
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 8000);
            scrapedContents.push(`[Website: ${url}]\n${text}`);
          }
        } catch (e) {
          console.error(`Failed to scrape ${url}:`, e);
        }
      }
    }

    // Combine all input
    const allInputs: string[] = [];
    if (texts && texts.length > 0) allInputs.push(...texts.map((t: string) => `[Notizen]\n${t}`));
    if (pdfTexts && pdfTexts.length > 0) allInputs.push(...pdfTexts.map((t: string) => `[PDF-Inhalt]\n${t}`));
    allInputs.push(...scrapedContents);

    if (allInputs.length === 0) {
      return new Response(JSON.stringify({ error: "Keine Inhalte zum Analysieren" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const combinedInput = allInputs.join("\n\n---\n\n").slice(0, 30000);

    const systemPrompt = `Du bist ein Marketing-Analyst. Analysiere die bereitgestellten Informationen über ein Unternehmen und erstelle ein strukturiertes Kundenprofil.

Antworte IMMER als JSON mit exakt diesen Feldern:
- "name": Der Firmenname
- "industry": Branche/Industrie (kurz, 2-5 Wörter)
- "target_audience": Zielgruppe (1-2 Sätze)
- "usps": Alleinstellungsmerkmale / USPs (2-3 Stichpunkte, kommagetrennt)
- "tonality": Empfohlene Tonalität für Social Media Content (z.B. "professionell & nahbar")
- "content_topics": Relevante Content-Themen für Social Media (3-5 Themen, kommagetrennt)
- "summary": Zusammenfassung: Was macht das Unternehmen, wer ist es, was ist besonders? (3-5 Sätze)

Antworte NUR mit validem JSON, kein Markdown, keine Erklärung.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: combinedInput },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Zu viele Anfragen, bitte versuche es gleich nochmal." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "KI-Guthaben aufgebraucht." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    let parsed;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      parsed = JSON.parse(jsonMatch[1].trim());
    } catch {
      console.error("Failed to parse AI response:", content);
      throw new Error("KI-Antwort konnte nicht verarbeitet werden");
    }

    // If we extracted a logo, upload it to storage and include the URL
    if (extractedLogoUrl) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const sb = createClient(supabaseUrl, supabaseKey);

        // Download the logo
        const logoResp = await fetch(extractedLogoUrl);
        if (logoResp.ok) {
          const logoBlob = await logoResp.blob();
          const ext = extractedLogoUrl.split(".").pop()?.split("?")[0] || "png";
          const logoPath = `extracted-logos/${Date.now()}-logo.${ext}`;
          
          const { error: uploadError } = await sb.storage
            .from("client-logos")
            .upload(logoPath, logoBlob, { contentType: logoBlob.type || "image/png" });
          
          if (!uploadError) {
            const { data: publicUrlData } = sb.storage.from("client-logos").getPublicUrl(logoPath);
            parsed.logo_url = publicUrlData.publicUrl;
            console.log("Logo uploaded and stored:", parsed.logo_url);
          } else {
            console.error("Logo upload failed:", uploadError);
            // Fall back to direct URL
            parsed.logo_url = extractedLogoUrl;
          }
        }
      } catch (e) {
        console.error("Logo processing error:", e);
        parsed.logo_url = extractedLogoUrl;
      }
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-client error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
