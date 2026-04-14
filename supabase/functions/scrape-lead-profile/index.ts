import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function scrapeProfileImage(url: string, apiKey: string): Promise<string | null> {
  try {
    console.log("Scraping:", url);
    const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown", "links"],
        onlyMainContent: false,
        waitFor: 5000,
      }),
    });

    if (!resp.ok) {
      console.error("Firecrawl error:", resp.status, await resp.text());
      return null;
    }

    const data = await resp.json();
    const markdown = data?.data?.markdown || data?.markdown || "";
    const html = data?.data?.html || data?.html || "";
    const metadata = data?.data?.metadata || data?.metadata || {};

    // Try og:image from metadata first
    if (metadata?.ogImage) {
      console.log("Found og:image from metadata");
      return metadata.ogImage;
    }

    // Try to find profile image URLs in markdown - common patterns
    // Instagram profile pics often contain cdninstagram or scontent
    const igProfileMatch = markdown.match(/!\[.*?\]\((https:\/\/[^\s)]*(?:cdninstagram|scontent|fbcdn)[^\s)]*)\)/);
    if (igProfileMatch?.[1]) {
      console.log("Found IG CDN image");
      return igProfileMatch[1];
    }

    // LinkedIn profile pics
    const liProfileMatch = markdown.match(/!\[.*?\]\((https:\/\/media\.licdn\.com[^\s)]*)\)/);
    if (liProfileMatch?.[1]) {
      console.log("Found LinkedIn media image");
      return liProfileMatch[1];
    }

    // Generic first image in markdown
    const firstImgMatch = markdown.match(/!\[.*?\]\((https:\/\/[^\s)]+)\)/);
    if (firstImgMatch?.[1] && !firstImgMatch[1].includes('icon') && !firstImgMatch[1].includes('logo') && !firstImgMatch[1].includes('sprite')) {
      console.log("Found first markdown image");
      return firstImgMatch[1];
    }

    console.log("No profile image found");
    return null;
  } catch (e) {
    console.error("Scrape error:", e);
    return null;
  }
}

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

    let query = supabase
      .from("crm_leads")
      .select("id, name, instagram_handle, linkedin_url, profile_image_url");

    if (leadId) {
      query = query.eq("id", leadId);
    } else {
      query = query.is("profile_image_url", null)
        .or("instagram_handle.not.is.null,linkedin_url.not.is.null");
    }

    const { data: leads, error } = await query;
    if (error) throw error;

    const results: { id: string; name: string; profile_image_url: string | null; error?: string }[] = [];

    for (const lead of leads || []) {
      try {
        if (!lead.instagram_handle && !lead.linkedin_url) {
          results.push({ id: lead.id, name: lead.name, profile_image_url: null });
          continue;
        }

        let profileImageUrl: string | null = null;

        // Try Instagram
        if (lead.instagram_handle && !profileImageUrl) {
          // Clean the handle - might be a full URL or just @handle
          let handle = lead.instagram_handle;
          // Extract handle from URL
          const urlMatch = handle.match(/instagram\.com\/([^/?#]+)/);
          if (urlMatch) {
            handle = urlMatch[1];
          }
          handle = handle.replace(/^@/, "");
          const igUrl = `https://www.instagram.com/${handle}/`;
          profileImageUrl = await scrapeProfileImage(igUrl, FIRECRAWL_KEY);
        }

        // Try LinkedIn
        if (lead.linkedin_url && !profileImageUrl) {
          let liUrl = lead.linkedin_url;
          if (!liUrl.startsWith("http")) liUrl = `https://${liUrl}`;
          profileImageUrl = await scrapeProfileImage(liUrl, FIRECRAWL_KEY);
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
