const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, client_name, client_industry } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    let markdown = "";
    let screenshot: string | null = null;

    // Step 1: Scrape with Firecrawl (screenshot + markdown)
    if (firecrawlKey) {
      let formattedUrl = url.trim();
      if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
        formattedUrl = `https://${formattedUrl}`;
      }

      console.log("Scraping:", formattedUrl);
      const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${firecrawlKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: formattedUrl,
          formats: ["markdown", "screenshot"],
          onlyMainContent: false,
          waitFor: 3000,
        }),
      });

      const scrapeData = await scrapeRes.json();
      if (scrapeRes.ok && scrapeData.success !== false) {
        markdown = scrapeData.data?.markdown || scrapeData.markdown || "";
        screenshot = scrapeData.data?.screenshot || scrapeData.screenshot || null;
        console.log("Scrape OK, markdown length:", markdown.length, "has screenshot:", !!screenshot);
      } else {
        console.error("Firecrawl error:", scrapeData);
      }
    } else {
      console.warn("No FIRECRAWL_API_KEY, skipping scrape");
    }

    // Step 2: AI Analysis
    let analysis = "";
    if (lovableKey && markdown.length > 50) {
      const truncatedMarkdown = markdown.slice(0, 8000);

      const prompt = `Du bist ein Social-Media-Stratege für eine Content-Agentur. Analysiere die folgende Webseite/Profil als Inspiration für den Kunden "${client_name || "unbekannt"}" (Branche: ${client_industry || "unbekannt"}).

Webseite-Inhalt:
${truncatedMarkdown}

Erstelle eine kompakte Analyse (max 200 Wörter) mit folgenden Punkten:
1. **Was macht dieser Account/diese Seite gut?** (Content-Strategie, Posting-Mix, Tonalität)
2. **Übertragbare Ideen** für ${client_name || "den Kunden"}: Konkrete Format- und Themen-Vorschläge
3. **Key Takeaway**: Ein Satz, der das Wichtigste zusammenfasst

Antworte auf Deutsch, knapp und actionable.`;

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 600,
        }),
      });

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        analysis = aiData.choices?.[0]?.message?.content || "";
        console.log("AI analysis done, length:", analysis.length);
      } else {
        console.error("AI error:", await aiRes.text());
      }
    }

    // Step 3: Generate title from URL if no markdown
    let autoTitle = "";
    try {
      const u = new URL(url.startsWith("http") ? url : `https://${url}`);
      autoTitle = u.hostname.replace("www.", "");
      if (u.pathname && u.pathname !== "/") {
        autoTitle += u.pathname.replace(/\/$/, "");
      }
    } catch {
      autoTitle = url;
    }

    return new Response(
      JSON.stringify({
        success: true,
        title: autoTitle,
        screenshot,
        analysis,
        markdown_preview: markdown.slice(0, 500),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
