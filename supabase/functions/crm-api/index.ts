import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const SEGMENTS = ["immo_finanz", "mittelstand", "kunde", "partner", "creator", "sonstiges"] as const;
const RELATIONSHIPS = ["kunde", "lead", "netzwerk", "event_kontakt", "partner", "team", "kalt"] as const;
const CHANNELS = ["whatsapp", "linkedin", "mail", "instagram", "telefon", "brief", "persoenlich"] as const;
const GUEST = ["angefragt", "eingeladen", "vielleicht", "zusage", "spaeter", "absage", "bounce", "erschienen"] as const;
const ACT_TYPES = ["note", "call", "email", "sms", "whatsapp", "linkedin", "instagram", "brief", "event"] as const;
const TYPE_CHANNEL: Record<string, string | null> = {
  whatsapp: "whatsapp", linkedin: "linkedin", email: "mail", instagram: "instagram",
  call: "telefon", sms: "telefon", brief: "brief", event: "persoenlich", note: null,
};

const str = z.string().max(5000).optional().nullable();
const Contact = z.object({
  full_name: z.string().max(300).optional().nullable(),
  first_name: str, company: str, role: str, email: str, phone: str, whatsapp: str, linkedin_url: str,
  instagram_handle: str, website: str, city: str, region: str,
  segment: z.enum(SEGMENTS).optional().nullable(),
  relationship: z.enum(RELATIONSHIPS).optional().nullable(),
  tags: z.array(z.string().max(100)).max(50).optional(),
  source: str,
  last_contact_at: z.string().datetime({ offset: true }).optional().nullable(),
  last_channel: z.enum(CHANNELS).optional().nullable(),
  next_followup_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  notes: str, do_not_contact: z.boolean().optional().nullable(),
  lat: z.number().optional().nullable(), lon: z.number().optional().nullable(),
  external_ref: z.string().max(300).optional().nullable(),
});

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("upsert_contacts"), contacts: z.array(z.unknown()).min(1).max(500) }),
  z.object({ action: z.literal("add_activities"), activities: z.array(z.object({
    contact_ref: z.string().min(1).max(300), lead_id: z.string().uuid().optional().nullable(),
    type: z.enum(ACT_TYPES), title: z.string().max(500).optional().nullable(), body: z.string().max(20000).optional().nullable(),
    occurred_at: z.string().datetime({ offset: true }).optional().nullable(),
  })).min(1).max(500) }),
  z.object({ action: z.literal("set_event_guests"), event_slug: z.string().min(1).max(200), guests: z.array(z.object({
    contact_ref: z.string().min(1).max(300), status: z.enum(GUEST), invited_via: z.enum(CHANNELS).optional().nullable(),
    note: z.string().max(2000).optional().nullable(), plus_ones: z.number().int().min(0).max(20).optional(),
  })).min(1).max(500) }),
  z.object({ action: z.literal("upsert_leads"), leads: z.array(z.object({
    id: z.string().uuid().optional(), contact_ref: z.string().min(1).max(300), name: z.string().max(300).optional(),
    pipeline: z.string().min(1).max(200), stage: z.string().min(1).max(200), source: str, next_step: str,
    next_step_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(), deal_value: z.number().optional(),
  })).min(1).max(200) }),
  z.object({ action: z.literal("search"), q: z.string().max(200).optional(), segment: z.enum(SEGMENTS).optional(), event_slug: z.string().max(200).optional(), limit: z.number().int().min(1).max(200).optional() }),
  z.object({ action: z.literal("list_events") }),
]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const key = Deno.env.get("CRM_API_KEY") ?? "";
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!key || !token || !safeEqual(token, key)) return json({ error: "unauthorized" }, 401);

  let raw: unknown;
  try { raw = await req.json(); } catch { return json({ error: "invalid JSON" }, 400); }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const body = parsed.data;

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: adminRow } = await db.from("user_roles").select("user_id").eq("role", "admin").limit(1).maybeSingle();
  const adminId = adminRow?.user_id ?? null;

  const refCache = new Map<string, string | null>();
  const resolveContact = async (ref: string): Promise<string | null> => {
    if (refCache.has(ref)) return refCache.get(ref)!;
    let q = db.from("crm_contacts").select("id").limit(1);
    if (UUID.test(ref)) q = q.eq("id", ref);
    else if (ref.includes("@")) q = q.ilike("email", ref.trim());
    else q = q.eq("external_ref", ref);
    const { data } = await q.maybeSingle();
    const id = data?.id ?? null;
    refCache.set(ref, id);
    return id;
  };

  try {
    switch (body.action) {
      case "upsert_contacts": {
        const results = [];
        for (let i = 0; i < body.contacts.length; i++) {
          const p = Contact.safeParse(body.contacts[i]);
          if (!p.success) { results.push({ index: i, error: p.error.flatten().fieldErrors }); continue; }
          const { data, error } = await db.rpc("crm_upsert_contact", { _c: p.data, _created_by: adminId });
          if (error) { results.push({ index: i, error: error.message }); continue; }
          results.push({ index: i, ...(data as Record<string, unknown>) });
        }
        return json({ results, created: results.filter(r => (r as any).status === "created").length, updated: results.filter(r => (r as any).status === "updated").length });
      }

      case "add_activities": {
        const results = [];
        for (const [i, a] of body.activities.entries()) {
          const cid = await resolveContact(a.contact_ref);
          if (!cid) { results.push({ index: i, error: "contact not found" }); continue; }
          const at = a.occurred_at ?? new Date().toISOString();
          const { data, error } = await db.from("crm_activities").insert({
            contact_id: cid, lead_id: a.lead_id ?? null, type: a.type, title: a.title ?? null, body: a.body ?? null,
            created_at: at, created_by: adminId, metadata: { via: "crm-api" },
          }).select("id").single();
          if (error) { results.push({ index: i, error: error.message }); continue; }
          const { data: c } = await db.from("crm_contacts").select("last_contact_at").eq("id", cid).single();
          if (!c?.last_contact_at || new Date(c.last_contact_at) <= new Date(at)) {
            await db.from("crm_contacts").update({ last_contact_at: at, ...(TYPE_CHANNEL[a.type] ? { last_channel: TYPE_CHANNEL[a.type] } : {}) }).eq("id", cid);
          }
          results.push({ index: i, id: data.id, contact_id: cid });
        }
        return json({ results });
      }

      case "set_event_guests": {
        const { data: ev } = await db.from("crm_events").select("id").eq("slug", body.event_slug).maybeSingle();
        if (!ev) return json({ error: "event not found" }, 404);
        const results = [];
        for (const [i, g] of body.guests.entries()) {
          const cid = await resolveContact(g.contact_ref);
          if (!cid) { results.push({ index: i, error: "contact not found" }); continue; }
          const responded = ["vielleicht", "zusage", "spaeter", "absage", "erschienen"].includes(g.status);
          const { data, error } = await db.from("crm_event_guests").upsert({
            event_id: ev.id, contact_id: cid, status: g.status,
            ...(g.invited_via ? { invited_via: g.invited_via } : {}),
            ...(g.note != null ? { note: g.note } : {}),
            ...(g.plus_ones != null ? { plus_ones: g.plus_ones } : {}),
            ...(responded ? { responded_at: new Date().toISOString() } : {}),
          }, { onConflict: "event_id,contact_id" }).select("id").single();
          results.push(error ? { index: i, error: error.message } : { index: i, id: data.id, contact_id: cid });
        }
        return json({ results });
      }

      case "upsert_leads": {
        const { data: pipes } = await db.from("crm_pipelines").select("id, name");
        const results = [];
        for (const [i, l] of body.leads.entries()) {
          const pipe = (pipes ?? []).find(p => p.id === l.pipeline || p.name.toLowerCase() === l.pipeline.toLowerCase());
          if (!pipe) { results.push({ index: i, error: "pipeline not found" }); continue; }
          const { data: stages } = await db.from("crm_stage_config").select("value, label").eq("pipeline_id", pipe.id);
          const st = (stages ?? []).find(s => s.label.toLowerCase() === l.stage.toLowerCase() || s.value === l.stage);
          if (!st) { results.push({ index: i, error: "stage not found", stages: (stages ?? []).map(s => s.label) }); continue; }
          const cid = await resolveContact(l.contact_ref);
          if (!cid) { results.push({ index: i, error: "contact not found" }); continue; }
          const { data: contact } = await db.from("crm_contacts").select("full_name, company, email, phone, linkedin_url").eq("id", cid).single();

          let leadId = l.id ?? null;
          if (!leadId) {
            const { data: existing } = await db.from("crm_leads").select("id, crm_lead_pipelines!inner(pipeline_id)")
              .eq("contact_id", cid).eq("crm_lead_pipelines.pipeline_id", pipe.id).limit(1).maybeSingle();
            leadId = existing?.id ?? null;
          }
          const fields: Record<string, unknown> = {};
          if (l.source) fields.source = l.source;
          if (l.next_step) fields.next_step = l.next_step;
          if (l.next_step_date) fields.next_step_date = l.next_step_date;
          if (l.deal_value != null) fields.deal_value = l.deal_value;
          let status = "updated";
          if (leadId) {
            const { error } = await db.from("crm_leads").update({ ...fields, ...(l.name ? { name: l.name } : {}), last_activity_at: new Date().toISOString() }).eq("id", leadId);
            if (error) { results.push({ index: i, error: error.message }); continue; }
          } else {
            const { data, error } = await db.from("crm_leads").insert({
              ...fields, name: l.name || contact?.company || contact?.full_name || "Lead",
              contact_id: cid, contact_name: contact?.full_name, contact_email: contact?.email, contact_phone: contact?.phone,
              linkedin_url: contact?.linkedin_url, stage: st.value, pipeline_id: pipe.id, created_by: adminId,
            }).select("id").single();
            if (error) { results.push({ index: i, error: error.message }); continue; }
            leadId = data.id; status = "created";
          }
          await db.from("crm_lead_pipelines").upsert({ lead_id: leadId, pipeline_id: pipe.id, stage: st.value }, { onConflict: "lead_id,pipeline_id" });
          results.push({ index: i, id: leadId, status });
        }
        return json({ results });
      }

      case "search": {
        const limit = body.limit ?? 50;
        let ids: string[] | null = null;
        let eventId: string | null = null;
        if (body.event_slug) {
          const { data: ev } = await db.from("crm_events").select("id").eq("slug", body.event_slug).maybeSingle();
          if (!ev) return json({ contacts: [] });
          eventId = ev.id;
          const { data: g } = await db.from("crm_event_guests").select("contact_id").eq("event_id", ev.id);
          ids = (g ?? []).map(x => x.contact_id);
          if (!ids.length) return json({ contacts: [] });
        }
        let q = db.from("crm_contacts").select("id, full_name, company, email, phone, region, city, segment, relationship, tags, last_contact_at, last_channel, next_followup_date, do_not_contact, external_ref").limit(limit).order("full_name");
        if (body.q) {
          const s = body.q.replace(/[%,()]/g, " ").trim();
          q = q.or(`full_name.ilike.%${s}%,company.ilike.%${s}%,email.ilike.%${s}%,city.ilike.%${s}%,region.ilike.%${s}%`);
        }
        if (body.segment) q = q.eq("segment", body.segment);
        if (ids) q = q.in("id", ids);
        const { data: contacts, error } = await q;
        if (error) throw error;
        const cids = (contacts ?? []).map(c => c.id);
        const { data: guests } = cids.length
          ? await db.from("crm_event_guests").select("contact_id, status, crm_events(slug, name)").in("contact_id", cids)
          : { data: [] as any[] };
        return json({
          contacts: (contacts ?? []).map(c => ({
            ...c,
            events: (guests ?? []).filter((g: any) => g.contact_id === c.id && (!eventId || true)).map((g: any) => ({ slug: g.crm_events?.slug, name: g.crm_events?.name, status: g.status })),
          })),
        });
      }

      case "list_events": {
        const { data: events } = await db.from("crm_events").select("*").order("date", { nullsFirst: false });
        const { data: guests } = await db.from("crm_event_guests").select("event_id, status, plus_ones");
        return json({
          events: (events ?? []).map(e => {
            const mine = (guests ?? []).filter(g => g.event_id === e.id);
            const counts: Record<string, number> = {};
            mine.forEach(g => { counts[g.status] = (counts[g.status] ?? 0) + 1; });
            const seats = mine.filter(g => g.status === "zusage" || g.status === "erschienen").reduce((s, g) => s + 1 + (g.plus_ones ?? 0), 0);
            return { ...e, guests_total: mine.length, counts, seats_taken: seats };
          }),
        });
      }
    }
  } catch (e) {
    console.error("crm-api error", body.action, e instanceof Error ? e.message : "unknown");
    return json({ error: "internal error" }, 500);
  }
});
