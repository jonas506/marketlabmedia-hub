import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const FIRECRAWL_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL_KEY) {
    return new Response(JSON.stringify({ error: "FIRECRAWL_API_KEY missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Optionally accept a single client_id
    let clientId: string | null = null;
    try {
      const body = await req.json();
      clientId = body?.client_id || null;
    } catch { /* no body */ }

    // Get clients without logos that have a website
    let query = supabase
      .from("clients")
      .select("id, name, website_url")
      .not("website_url", "is", null);

    if (clientId) {
      query = query.eq("id", clientId);
    } else {
      query = query.or("logo_url.is.null,logo_url.eq.");
    }

    const { data: clients, error } = await query;
    if (error) throw error;

    const results: { id: string; name: string; logo_url: string | null; error?: string }[] = [];

    for (const client of clients || []) {
      try {
        const url = client.website_url!.startsWith("http")
          ? client.website_url!
          : `https://${client.website_url}`;

        console.log(`Scraping branding for ${client.name}: ${url}`);

        const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${FIRECRAWL_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url,
            formats: ["branding"],
            onlyMainContent: false,
            waitFor: 3000,
          }),
        });

        if (!resp.ok) {
          const errText = await resp.text();
          console.error(`Firecrawl error for ${client.name}:`, errText);
          results.push({ id: client.id, name: client.name, logo_url: null, error: errText });
          continue;
        }

        const data = await resp.json();
        const branding = data?.data?.branding || data?.branding;
        const logoUrl = branding?.logo || branding?.images?.logo || branding?.images?.favicon || null;

        if (logoUrl) {
          await supabase
            .from("clients")
            .update({ logo_url: logoUrl })
            .eq("id", client.id);
          console.log(`✅ Logo set for ${client.name}: ${logoUrl}`);
        } else {
          console.log(`⚠️ No logo found for ${client.name}`);
        }

        results.push({ id: client.id, name: client.name, logo_url: logoUrl });

        // Small delay to avoid rate limiting
        await new Promise((r) => setTimeout(r, 500));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error(`Error for ${client.name}:`, msg);
        results.push({ id: client.id, name: client.name, logo_url: null, error: msg });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
