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
    let leadId: string | null = null;
    try {
      const body = await req.json();
      leadId = body?.lead_id || null;
    } catch { /* no body */ }

    // Get leads that have instagram or linkedin but no profile image
    let query = supabase
      .from("crm_leads")
      .select("id, name, instagram_handle, linkedin_url, profile_image_url")
      .or("instagram_handle.neq.,linkedin_url.neq.");

    if (leadId) {
      query = query.eq("id", leadId);
    } else {
      query = query.is("profile_image_url", null);
    }

    const { data: leads, error } = await query;
    if (error) throw error;

    const results: { id: string; name: string; profile_image_url: string | null; error?: string }[] = [];

    for (const lead of leads || []) {
      try {
        // Skip if no social links
        if (!lead.instagram_handle && !lead.linkedin_url) {
          results.push({ id: lead.id, name: lead.name, profile_image_url: null });
          continue;
        }

        let profileImageUrl: string | null = null;

        // Try Instagram first
        if (lead.instagram_handle && !profileImageUrl) {
          const handle = lead.instagram_handle.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/$/, "");
          const igUrl = `https://www.instagram.com/${handle}/`;
          console.log(`Scraping IG profile for ${lead.name}: ${igUrl}`);

          try {
            const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${FIRECRAWL_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                url: igUrl,
                formats: ["html"],
                onlyMainContent: false,
                waitFor: 5000,
              }),
            });

            if (resp.ok) {
              const data = await resp.json();
              const html = data?.data?.html || data?.html || "";
              
              // Try to extract profile picture from meta tags
              const ogImageMatch = html.match(/property="og:image"\s+content="([^"]+)"/);
              if (ogImageMatch?.[1]) {
                profileImageUrl = ogImageMatch[1];
              }
              
              // Try Twitter image meta
              if (!profileImageUrl) {
                const twitterImageMatch = html.match(/name="twitter:image"\s+content="([^"]+)"/);
                if (twitterImageMatch?.[1]) {
                  profileImageUrl = twitterImageMatch[1];
                }
              }
            }
          } catch (e) {
            console.error(`IG scrape failed for ${lead.name}:`, e);
          }
        }

        // Try LinkedIn if no IG image
        if (lead.linkedin_url && !profileImageUrl) {
          let liUrl = lead.linkedin_url;
          if (!liUrl.startsWith("http")) liUrl = `https://${liUrl}`;
          console.log(`Scraping LinkedIn profile for ${lead.name}: ${liUrl}`);

          try {
            const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${FIRECRAWL_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                url: liUrl,
                formats: ["html"],
                onlyMainContent: false,
                waitFor: 5000,
              }),
            });

            if (resp.ok) {
              const data = await resp.json();
              const html = data?.data?.html || data?.html || "";
              
              const ogImageMatch = html.match(/property="og:image"\s+content="([^"]+)"/);
              if (ogImageMatch?.[1]) {
                profileImageUrl = ogImageMatch[1];
              }
            }
          } catch (e) {
            console.error(`LinkedIn scrape failed for ${lead.name}:`, e);
          }
        }

        if (profileImageUrl) {
          await supabase
            .from("crm_leads")
            .update({ profile_image_url: profileImageUrl })
            .eq("id", lead.id);
          console.log(`✅ Profile image set for ${lead.name}`);
        } else {
          console.log(`⚠️ No profile image found for ${lead.name}`);
        }

        results.push({ id: lead.id, name: lead.name, profile_image_url: profileImageUrl });

        // Rate limit
        await new Promise((r) => setTimeout(r, 1000));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error(`Error for ${lead.name}:`, msg);
        results.push({ id: lead.id, name: lead.name, profile_image_url: null, error: msg });
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
