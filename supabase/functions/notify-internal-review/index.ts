import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";
const JONAS_EMAIL = "jonas@marketlab-media.de";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");
  if (!LOVABLE_API_KEY || !SLACK_API_KEY) {
    return new Response(JSON.stringify({ error: "Slack not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { content_piece_id } = await req.json();
    if (!content_piece_id) {
      return new Response(JSON.stringify({ error: "content_piece_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: piece } = await supabase
      .from("content_pieces")
      .select("title, type, preview_link, internal_note, client_id, clients(name)")
      .eq("id", content_piece_id)
      .single();

    if (!piece) {
      return new Response(JSON.stringify({ error: "Piece not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientName = (piece as any).clients?.name || "Unbekannt";
    const typeLabels: Record<string, string> = {
      reel: "🎬 Reel", carousel: "🖼️ Karussell", ad: "📢 Ad",
      youtube_longform: "🎥 YouTube", story: "📱 Story",
    };
    const typeLabel = typeLabels[piece.type] || piece.type;
    const title = piece.title || "Ohne Titel";
    const previewLine = piece.preview_link
      ? `\n🔗 ${piece.preview_link.split("\n")[0]}`
      : "";
    const noteLine = piece.internal_note
      ? `\n📝 _${piece.internal_note}_`
      : "";

    const slackHeaders = {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": SLACK_API_KEY,
      "Content-Type": "application/json",
    };

    // Lookup Jonas's Slack user via email
    const lookupRes = await fetch(
      `${GATEWAY_URL}/users.lookupByEmail?email=${encodeURIComponent(JONAS_EMAIL)}`,
      { headers: slackHeaders }
    );
    const lookupData = await lookupRes.json();
    if (!lookupData.ok || !lookupData.user?.id) {
      console.error("Slack lookup failed:", JSON.stringify(lookupData));
      return new Response(JSON.stringify({ error: "Slack user lookup failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = lookupData.user.id;

    // Open DM channel
    const openRes = await fetch(`${GATEWAY_URL}/conversations.open`, {
      method: "POST", headers: slackHeaders,
      body: JSON.stringify({ users: userId }),
    });
    const openData = await openRes.json();
    if (!openData.ok || !openData.channel?.id) {
      console.error("Slack DM open failed:", JSON.stringify(openData));
      return new Response(JSON.stringify({ error: "Slack DM open failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const text = `🛡️ *Interne Freigabe nötig*\n\n${typeLabel} *„${title}"*\nKunde: *${clientName}*${previewLine}${noteLine}`;

    const msgRes = await fetch(`${GATEWAY_URL}/chat.postMessage`, {
      method: "POST", headers: slackHeaders,
      body: JSON.stringify({
        channel: openData.channel.id,
        text: `🛡️ Interne Freigabe nötig: ${typeLabel} „${title}" für ${clientName}`,
        blocks: [{ type: "section", text: { type: "mrkdwn", text } }],
      }),
    });
    const msgData = await msgRes.json();
    if (!msgData.ok) {
      console.error("Slack post failed:", JSON.stringify(msgData));
      return new Response(JSON.stringify({ error: msgData.error }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
