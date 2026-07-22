import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");
  if (!LOVABLE_API_KEY || !SLACK_API_KEY) {
    return new Response(JSON.stringify({ error: "keys missing" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const slackHeaders = {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": SLACK_API_KEY,
    "Content-Type": "application/json",
  };

  const today = new Date().toISOString().slice(0, 10);

  // All open tasks with a deadline <= today, grouped by assignee
  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("id, title, deadline, priority, assigned_to, client_id, clients(name)")
    .eq("is_completed", false)
    .not("assigned_to", "is", null)
    .not("deadline", "is", null)
    .lte("deadline", today);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const byUser: Record<string, any[]> = {};
  (tasks || []).forEach((t: any) => {
    (byUser[t.assigned_to] ||= []).push(t);
  });

  const userIds = Object.keys(byUser);
  if (userIds.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, name, email, slack_user_id")
    .in("user_id", userIds);

  let sent = 0;
  for (const p of profiles || []) {
    const userTasks = byUser[p.user_id];
    if (!userTasks?.length) continue;

    let slackUserId = p.slack_user_id;
    if (!slackUserId && p.email) {
      const r = await fetch(`${GATEWAY_URL}/users.lookupByEmail?email=${encodeURIComponent(p.email)}`, {
        method: "POST", headers: slackHeaders,
      });
      const d = await r.json();
      if (d.ok && d.user?.id) {
        slackUserId = d.user.id;
        await supabase.from("profiles").update({ slack_user_id: slackUserId }).eq("user_id", p.user_id);
      }
    }
    if (!slackUserId) continue;

    let channelId = slackUserId.startsWith("D") ? slackUserId : null;
    if (!channelId) {
      const r = await fetch(`${GATEWAY_URL}/conversations.open`, {
        method: "POST", headers: slackHeaders,
        body: JSON.stringify({ users: slackUserId }),
      });
      const d = await r.json();
      if (d.ok) channelId = d.channel?.id;
    }
    if (!channelId) continue;

    const overdue = userTasks.filter(t => t.deadline < today);
    const dueToday = userTasks.filter(t => t.deadline === today);
    const lines: string[] = [];
    lines.push(`🌅 *Guten Morgen ${p.name || ""}!*`);
    if (overdue.length) lines.push(`\n⚠️ *${overdue.length} überfällig:*`);
    overdue.slice(0, 10).forEach(t => {
      const client = t.clients?.name ? ` · ${t.clients.name}` : "";
      lines.push(`• ${t.title}${client}`);
    });
    if (dueToday.length) lines.push(`\n📌 *${dueToday.length} heute fällig:*`);
    dueToday.slice(0, 10).forEach(t => {
      const client = t.clients?.name ? ` · ${t.clients.name}` : "";
      lines.push(`• ${t.title}${client}`);
    });
    lines.push(`\n<https://hub.marketlab-media.de/tasks?person=me|Alle meine Aufgaben →>`);

    const msg = lines.join("\n");
    const r = await fetch(`${GATEWAY_URL}/chat.postMessage`, {
      method: "POST", headers: slackHeaders,
      body: JSON.stringify({ channel: channelId, text: msg }),
    });
    const d = await r.json();
    if (d.ok) sent++;
  }

  return new Response(JSON.stringify({ sent, total_users: userIds.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
