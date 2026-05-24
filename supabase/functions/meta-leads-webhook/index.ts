// Public webhook for Meta Lead Ads — receives leadgen events and inserts into crm_leads
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-signature-256",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const GRAPH_VERSION = "v21.0";

async function verifySignature(rawBody: string, signatureHeader: string | null, appSecret: string): Promise<boolean> {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const provided = signatureHeader.slice("sha256=".length);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return expected === provided;
}

function extractField(fieldData: Array<{ name: string; values: string[] }>, ...names: string[]): string | null {
  for (const n of names) {
    const f = fieldData.find((x) => x.name?.toLowerCase() === n.toLowerCase());
    if (f && f.values?.[0]) return f.values[0];
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const verifyToken = Deno.env.get("META_VERIFY_TOKEN");
  const appSecret = Deno.env.get("META_APP_SECRET");
  const pageToken = Deno.env.get("META_PAGE_ACCESS_TOKEN");

  // --- GET: Webhook verification handshake ---
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token && verifyToken && token === verifyToken) {
      return new Response(challenge ?? "", { status: 200, headers: corsHeaders });
    }
    return new Response("Verification failed", { status: 403, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  // --- POST: Leadgen event ---
  try {
    const raw = await req.text();

    // Signature check (only when configured)
    if (appSecret) {
      const ok = await verifySignature(raw, req.headers.get("x-hub-signature-256"), appSecret);
      if (!ok) {
        console.warn("Invalid X-Hub-Signature-256");
        return new Response("Invalid signature", { status: 401, headers: corsHeaders });
      }
    }

    if (!pageToken) {
      console.error("META_PAGE_ACCESS_TOKEN not configured");
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    const payload = JSON.parse(raw);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Find the system / admin user to use as created_by (required NOT NULL)
    let createdBy: string | null = null;
    {
      const { data } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin")
        .limit(1)
        .maybeSingle();
      createdBy = data?.user_id ?? null;
    }
    if (!createdBy) {
      console.error("No admin user found to attribute lead to");
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "leadgen") continue;
        const v = change.value ?? {};
        const leadgenId = v.leadgen_id;
        const formId = v.form_id;
        const pageId = v.page_id;
        if (!leadgenId) continue;

        // Fetch full lead details from Graph API
        const graphUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${leadgenId}?access_token=${encodeURIComponent(pageToken)}&fields=field_data,created_time,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id`;
        const graphResp = await fetch(graphUrl);
        if (!graphResp.ok) {
          console.error("Graph API error", graphResp.status, await graphResp.text());
          continue;
        }
        const lead = await graphResp.json();
        const fd: Array<{ name: string; values: string[] }> = lead.field_data ?? [];

        const fullName = extractField(fd, "full_name", "name") ?? "";
        const firstName = extractField(fd, "first_name") ?? "";
        const lastName = extractField(fd, "last_name") ?? "";
        const email = extractField(fd, "email");
        const phone = extractField(fd, "phone_number", "phone");
        const company = extractField(fd, "company_name", "company");

        const displayName = fullName || [firstName, lastName].filter(Boolean).join(" ").trim() || email || company || "Meta Lead";

        // Upsert by meta_lead_id
        const { error: upsertErr } = await supabase
          .from("crm_leads")
          .upsert({
            meta_lead_id: leadgenId,
            meta_form_id: lead.form_id ?? formId ?? null,
            meta_campaign_name: lead.campaign_name ?? null,
            meta_adset_name: lead.adset_name ?? null,
            meta_ad_name: lead.ad_name ?? null,
            name: displayName,
            contact_name: fullName || [firstName, lastName].filter(Boolean).join(" ").trim() || null,
            contact_email: email,
            contact_phone: phone,
            source: "meta_ads",
            stage: "erstkontakt",
            created_by: createdBy,
            last_activity_at: new Date().toISOString(),
          }, { onConflict: "meta_lead_id" });

        if (upsertErr) {
          console.error("Upsert error", upsertErr, { leadgenId, pageId });
          continue;
        }

        // Log activity (best-effort)
        const { data: leadRow } = await supabase
          .from("crm_leads")
          .select("id")
          .eq("meta_lead_id", leadgenId)
          .maybeSingle();

        if (leadRow?.id) {
          await supabase.from("crm_activities").insert({
            lead_id: leadRow.id,
            type: "note",
            title: "Lead aus Meta Lead Ads erhalten",
            body: `Kampagne: ${lead.campaign_name ?? "—"}\nAnzeige: ${lead.ad_name ?? "—"}\nFormular: ${lead.form_id ?? formId ?? "—"}`,
            ai_extracted: false,
            created_by: createdBy,
            metadata: { meta_lead_id: leadgenId, raw_fields: fd },
          });
        }
      }
    }

    return new Response("OK", { status: 200, headers: corsHeaders });
  } catch (e) {
    console.error("Webhook error", e);
    // Always 200 so Meta doesn't retry storms; error is logged
    return new Response("OK", { status: 200, headers: corsHeaders });
  }
});
