import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { buildLeadMessage, sendSlack, TEST_MESSAGE } from "./message.ts";

const Input = z.union([
  z.object({ test: z.literal(true) }).strict(),
  z.object({ notification_id: z.string().uuid() }).strict(),
]);
const reply = (status: number, body: object) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });
  try {
    const raw = await req.text();
    if (raw.length > 1024) return reply(400, { error: "Invalid request" });
    const input = Input.safeParse(JSON.parse(raw));
    if (!input.success) return reply(400, { error: "Invalid request" });
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const webhook = Deno.env.get("SLACK_WEBHOOK_URL");
    if (!url || !serviceKey || !anonKey) return reply(503, { error: "Configuration unavailable" });

    if ("test" in input.data) {
      const authorization = req.headers.get("authorization");
      if (!authorization?.startsWith("Bearer ")) return reply(401, { error: "Unauthorized" });
      const userClient = createClient(url, anonKey, {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false },
      });
      const { data: user, error: authError } = await userClient.auth.getUser(authorization.slice(7));
      if (authError || !user.user) return reply(401, { error: "Unauthorized" });
      const { data: admin, error } = await userClient.rpc("is_funnel_admin");
      if (error || admin !== true) return reply(403, { error: "Forbidden" });
      if (!webhook) return reply(503, { error: "Webhook not configured" });
      const sent = await sendSlack(webhook, TEST_MESSAGE);
      return reply(sent ? 200 : 502, { sent, test: true });
    }

    if (!webhook) {
      console.error("lead-slack-notify: webhook not configured");
      return reply(503, { error: "Webhook not configured" });
    }
    const db = createClient(url, serviceKey, { auth: { persistSession: false } });
    // The unguessable, service-role-only outbox ID authorizes one delivery.
    // Atomically consume it to prevent repeated requests from sending duplicates.
    const { data: job, error: claimError } = await db.from("positioning_slack_outbox")
      .delete().eq("id", input.data.notification_id)
      .gte("created_at", new Date(Date.now() - 86400000).toISOString())
      .select("lead_id").maybeSingle();
    if (claimError) {
      console.error("lead-slack-notify: notification claim failed");
      return reply(500, { error: "Notification unavailable" });
    }
    if (!job) return reply(202, { accepted: true });
    const { data: lead, error } = await db.from("positioning_analysis_leads")
      .select("id, contact_name, company, industry, utm_source, utm_campaign, utm_content, created_at")
      .eq("id", job.lead_id).maybeSingle();
    if (error || !lead) {
      console.error("lead-slack-notify: lead lookup failed");
      return reply(202, { accepted: true });
    }
    await sendSlack(webhook, buildLeadMessage(lead));
    return reply(202, { accepted: true });
  } catch {
    console.error("lead-slack-notify: request processing failed");
    return reply(400, { error: "Request could not be processed" });
  }
});