import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";
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
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");
  if (!SLACK_API_KEY) {
    return new Response(JSON.stringify({ error: "SLACK_API_KEY missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { content_piece_id, assigned_to } = await req.json();

    if (!content_piece_id || !assigned_to) {
      return new Response(
        JSON.stringify({ error: "content_piece_id and assigned_to required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch piece + client info
    const { data: piece, error: pieceError } = await supabase
      .from("content_pieces")
      .select("title, type, client_id, target_month, target_year, clients(name)")
      .eq("id", content_piece_id)
      .single();

    if (pieceError || !piece) {
      console.error("Piece not found:", pieceError);
      return new Response(JSON.stringify({ error: "Piece not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch assignee profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, email, slack_user_id")
      .eq("user_id", assigned_to)
      .single();

    const assigneeName = profile?.name || "Unbekannt";
    const slackUserId = profile?.slack_user_id || null;
    const clientName = (piece as any).clients?.name || "Unbekannt";
    const typeLabels: Record<string, string> = {
      reel: "🎬 Reel",
      carousel: "🖼️ Karussell",
      ad: "📢 Ad",
      youtube_longform: "🎥 YouTube",
    };
    const typeLabel = typeLabels[piece.type] || piece.type;
    const title = piece.title || "Ohne Titel";

    // 1. Create a task for the assignee
    const { error: taskError } = await supabase.from("tasks").insert({
      client_id: piece.client_id,
      title: `${typeLabel} "${title}" bearbeiten`,
      assigned_to,
      priority: "normal",
      status: "open",
      tag: piece.type,
    });

    if (taskError) {
      console.error("Task creation error:", taskError);
    }

    // 2. Send Slack notification
    const slackHeaders = {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": SLACK_API_KEY,
      "Content-Type": "application/json",
    };

    // Try to open DM with stored Slack user ID
    let dmChannelId: string | null = null;

    if (slackUserId) {
      try {
        const dmRes = await fetch(`${GATEWAY_URL}/conversations.open`, {
          method: "POST",
          headers: slackHeaders,
          body: JSON.stringify({ users: slackUserId }),
        });
        const dmData = await dmRes.json();
        if (dmData.ok && dmData.channel?.id) {
          dmChannelId = dmData.channel.id;
        }
      } catch (e) {
        console.log("DM open failed, falling back to channel:", e);
      }
    }

    // If no DM possible, fall back to channel
    let targetChannelId = dmChannelId;

    if (!targetChannelId) {
      const channelsRes = await fetch(
        `${GATEWAY_URL}/conversations.list?types=public_channel&limit=999&exclude_archived=true`,
        { headers: slackHeaders }
      );
      const channelsData = await channelsRes.json();
      const channels = channelsData.channels || [];
      targetChannelId = channels.find((c: any) => c.name === FALLBACK_CHANNEL)?.id;
    }

    if (!targetChannelId) {
      console.error("No Slack channel found");
      return new Response(JSON.stringify({ success: true, task_created: !taskError, slack_sent: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messageText = dmChannelId
      ? `📋 Dir wurde ein neues Content-Piece zugewiesen:\n\n${typeLabel} *„${title}"*\nKunde: *${clientName}*`
      : `📋 *${assigneeName}* wurde ein Content-Piece zugewiesen:\n\n${typeLabel} *„${title}"*\nKunde: *${clientName}*`;

    const msgRes = await fetch(`${GATEWAY_URL}/chat.postMessage`, {
      method: "POST",
      headers: slackHeaders,
      body: JSON.stringify({
        channel: targetChannelId,
        text: messageText,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: messageText,
            },
          },
        ],
      }),
    });

    const msgData = await msgRes.json();
    if (!msgData.ok) {
      console.error("Slack API error:", JSON.stringify(msgData));
    }

    return new Response(
      JSON.stringify({ success: true, task_created: !taskError, slack_sent: msgData.ok }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
