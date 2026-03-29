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
    const { assigned_to, task_title, task_count, client_name, tag } = await req.json();

    if (!assigned_to || !task_title) {
      return new Response(
        JSON.stringify({ error: "assigned_to and task_title required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch assignee profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, email, slack_user_id")
      .eq("user_id", assigned_to)
      .single();

    const assigneeName = profile?.name || "Unbekannt";
    const slackUserId = profile?.slack_user_id || null;

    const slackHeaders = {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": SLACK_API_KEY,
      "Content-Type": "application/json",
    };

    // Try DM first
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
        console.log("DM open failed:", e);
      }
    }

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
      return new Response(JSON.stringify({ success: false, slack_sent: false, reason: "no_channel" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tagLabel = tag ? ({ reel: "🎬 Reel", carousel: "🖼️ Karussell", ad: "📢 Ad", youtube_longform: "🎥 YouTube" }[tag] || tag) : "";
    const isGroup = (task_count || 1) > 1;

    const messageText = dmChannelId
      ? isGroup
        ? `📋 Dir wurden *${task_count} neue Aufgaben* zugewiesen:\n\n${tagLabel ? tagLabel + " — " : ""}*${task_title}*${client_name ? `\nKunde: *${client_name}*` : ""}`
        : `📋 Neue Aufgabe für dich:\n\n${tagLabel ? tagLabel + " — " : ""}*${task_title}*${client_name ? `\nKunde: *${client_name}*` : ""}`
      : isGroup
        ? `📋 *${assigneeName}* hat *${task_count} neue Aufgaben* erhalten:\n\n${tagLabel ? tagLabel + " — " : ""}*${task_title}*${client_name ? `\nKunde: *${client_name}*` : ""}`
        : `📋 *${assigneeName}* hat eine neue Aufgabe:\n\n${tagLabel ? tagLabel + " — " : ""}*${task_title}*${client_name ? `\nKunde: *${client_name}*` : ""}`;

    const msgRes = await fetch(`${GATEWAY_URL}/chat.postMessage`, {
      method: "POST",
      headers: slackHeaders,
      body: JSON.stringify({
        channel: targetChannelId,
        text: messageText,
        blocks: [
          {
            type: "section",
            text: { type: "mrkdwn", text: messageText },
          },
        ],
      }),
    });

    const msgData = await msgRes.json();
    if (!msgData.ok) {
      console.error("Slack API error:", JSON.stringify(msgData));
    }

    return new Response(
      JSON.stringify({ success: true, slack_sent: msgData.ok }),
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
