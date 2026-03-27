import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const googleApiKey = Deno.env.get("GOOGLE_API_KEY");

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get body if provided (for single client), otherwise process all
    let targetClientId: string | null = null;
    try {
      const body = await req.json();
      targetClientId = body?.client_id || null;
    } catch {
      // no body = cron call, process all
    }

    // Get clients with social handles
    let query = supabase
      .from("clients")
      .select("id, name, instagram_handle, youtube_channel_id, tiktok_handle")
      .eq("status", "active");

    if (targetClientId) {
      query = query.eq("id", targetClientId);
    }

    const { data: clients, error: clientsErr } = await query;
    if (clientsErr) throw clientsErr;

    const today = new Date().toISOString().split("T")[0];
    const results: { client: string; platform: string; count: number | null; error?: string }[] = [];

    for (const client of clients || []) {
      // YouTube tracking
      if (client.youtube_channel_id && googleApiKey) {
        try {
          const channelId = client.youtube_channel_id.trim();
          // Support both channel IDs and @handles
          let apiUrl: string;
          if (channelId.startsWith("@")) {
            apiUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics&forHandle=${encodeURIComponent(channelId)}&key=${googleApiKey}`;
          } else {
            apiUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${encodeURIComponent(channelId)}&key=${googleApiKey}`;
          }

          const ytRes = await fetch(apiUrl);
          const ytData = await ytRes.json();

          if (ytData.items?.[0]?.statistics?.subscriberCount) {
            const count = parseInt(ytData.items[0].statistics.subscriberCount);
            await supabase.from("follower_snapshots").upsert(
              {
                client_id: client.id,
                platform: "youtube",
                follower_count: count,
                snapshot_date: today,
              },
              { onConflict: "client_id,platform,snapshot_date" }
            );
            results.push({ client: client.name, platform: "youtube", count });
          } else {
            results.push({ client: client.name, platform: "youtube", count: null, error: "Channel not found" });
          }
        } catch (e) {
          results.push({ client: client.name, platform: "youtube", count: null, error: String(e) });
        }
      }

      // Instagram tracking via Instagram Graph API
      // Requires INSTAGRAM_ACCESS_TOKEN secret per client or global
      // For now we log that it needs setup
      if (client.instagram_handle) {
        const igToken = Deno.env.get("INSTAGRAM_ACCESS_TOKEN");
        if (igToken) {
          try {
            // First get user ID from handle
            const searchRes = await fetch(
              `https://graph.instagram.com/me?fields=id,username,followers_count&access_token=${igToken}`
            );
            const igData = await searchRes.json();

            if (igData.followers_count !== undefined) {
              await supabase.from("follower_snapshots").upsert(
                {
                  client_id: client.id,
                  platform: "instagram",
                  follower_count: igData.followers_count,
                  snapshot_date: today,
                },
                { onConflict: "client_id,platform,snapshot_date" }
              );
              results.push({ client: client.name, platform: "instagram", count: igData.followers_count });
            }
          } catch (e) {
            results.push({ client: client.name, platform: "instagram", count: null, error: String(e) });
          }
        } else {
          results.push({ client: client.name, platform: "instagram", count: null, error: "No INSTAGRAM_ACCESS_TOKEN configured" });
        }
      }
    }

    return new Response(JSON.stringify({ success: true, tracked: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error tracking followers:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
