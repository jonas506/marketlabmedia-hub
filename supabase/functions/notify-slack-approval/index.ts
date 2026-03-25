import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";
const TARGET_CHANNEL = "content-freigaben";
const FALLBACK_CHANNEL = "mlm-hub";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY is not configured");
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");
  if (!SLACK_API_KEY) {
    console.error("SLACK_API_KEY is not configured");
    return new Response(JSON.stringify({ error: "SLACK_API_KEY missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { content_piece_id, phase } = await req.json();

    if (!content_piece_id) {
      return new Response(JSON.stringify({ error: "content_piece_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isFeedback = phase === "feedback";

    // Fetch piece + client info
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: piece, error: pieceError } = await supabase
      .from("content_pieces")
      .select("title, type, client_id, clients(name)")
      .eq("id", content_piece_id)
      .single();

    if (pieceError || !piece) {
      console.error("Piece not found:", pieceError);
      return new Response(JSON.stringify({ error: "Piece not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create a posting task for Maren (only on approval, not feedback)
    if (!isFeedback) {
      const MAREN_USER_ID = "f2b9549d-016d-4d7e-a2f9-800f38355500";
      const pieceTitle = piece.title || "Ohne Titel";
      const typeMap: Record<string, string> = { reel: "Reel", carousel: "Karussell", ad: "Ad", youtube_longform: "YouTube" };
      const typeName = typeMap[piece.type] || piece.type;

      const { error: taskError } = await supabase.from("tasks").insert({
        client_id: piece.client_id,
        assigned_to: MAREN_USER_ID,
        title: `${typeName} „${pieceTitle}" posten`,
        tag: "Posten",
        priority: "normal",
        status: "offen",
      });
      if (taskError) {
        console.error("Failed to create posting task:", taskError);
      }
    }

    const clientName = (piece as any).clients?.name || "Unbekannt";
    const typeLabels: Record<string, string> = {
      reel: "🎬 Reel",
      carousel: "🖼️ Karussell",
      ad: "📢 Ad",
      youtube_longform: "🎥 YouTube",
    };
    const typeLabel = typeLabels[piece.type] || piece.type;
    const title = piece.title || "Ohne Titel";
    const clientComment = piece.client_comment || "Keine Details";

    // Find channel
    const slackHeaders = {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": SLACK_API_KEY,
      "Content-Type": "application/json",
    };

    // Try to find channel by name
    const channelsRes = await fetch(
      `${GATEWAY_URL}/conversations.list?types=public_channel,private_channel&limit=999&exclude_archived=true`,
      { headers: slackHeaders }
    );
    const channelsData = await channelsRes.json();
    const channels = channelsData.channels || [];

    let channelId = channels.find(
      (c: any) => c.name === TARGET_CHANNEL
    )?.id;

    if (!channelId) {
      channelId = channels.find(
        (c: any) => c.name === FALLBACK_CHANNEL
      )?.id;
    }

    if (!channelId) {
      console.error("No target channel found");
      return new Response(
        JSON.stringify({ error: "Slack channel not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Post message
    const slackText = isFeedback
      ? `🔄 Überarbeitung nötig: ${typeLabel} „${title}" für *${clientName}*`
      : `✅ Content freigegeben: ${typeLabel} „${title}" für *${clientName}*`;
    const slackBlock = isFeedback
      ? `🔄 *Überarbeitung nötig*\n\n${typeLabel} *„${title}"*\nKunde: *${clientName}*\n\n> ${clientComment}`
      : `✅ *Content freigegeben*\n\n${typeLabel} *„${title}"*\nKunde: *${clientName}*`;

    const msgRes = await fetch(`${GATEWAY_URL}/chat.postMessage`, {
      method: "POST",
      headers: slackHeaders,
      body: JSON.stringify({
        channel: channelId,
        text: slackText,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: slackBlock,
            },
          },
        ],
      }),
    });

    const msgData = await msgRes.json();
    if (!msgData.ok) {
      console.error("Slack API error:", JSON.stringify(msgData));
      return new Response(
        JSON.stringify({ error: `Slack error: ${msgData.error}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
