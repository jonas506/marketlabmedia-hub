import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { ArrowLeft, MessageCircle, Linkedin, Mail, Phone, Globe, Instagram, Briefcase, Ban, CheckCircle2, Circle, Plus } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCrmEvents, useCrmEventGuests, type CrmContact } from "@/hooks/useCrmContacts";
import { useCrmStages, useCrmPipelines, getStageLabel } from "@/hooks/useCrmStages";
import { SEGMENTS, RELATIONSHIPS, GUEST_STATUSES, labelOf, colorOf, waLink } from "@/lib/crm-contacts";
import { CHANNEL_ICON } from "@/components/crm/ContactsTab";

const ACT_TYPES = [
  { value: "note", label: "Notiz", channel: null },
  { value: "call", label: "Anruf", channel: "telefon" },
  { value: "email", label: "Mail", channel: "mail" },
  { value: "whatsapp", label: "WhatsApp", channel: "whatsapp" },
  { value: "linkedin", label: "LinkedIn", channel: "linkedin" },
  { value: "instagram", label: "Instagram", channel: "instagram" },
  { value: "brief", label: "Brief", channel: "brief" },
  { value: "event", label: "Event / persönlich", channel: "persoenlich" },
] as const;

const FIELDS: { key: keyof CrmContact; label: string; type?: string }[] = [
  { key: "full_name", label: "Name" }, { key: "first_name", label: "Vorname" }, { key: "company", label: "Firma" },
  { key: "role", label: "Rolle" }, { key: "email", label: "E-Mail" }, { key: "phone", label: "Telefon" },
  { key: "whatsapp", label: "WhatsApp" }, { key: "linkedin_url", label: "LinkedIn" }, { key: "instagram_handle", label: "Instagram" },
  { key: "website", label: "Website" }, { key: "city", label: "Ort" }, { key: "region", label: "Region" },
  { key: "source", label: "Quelle" }, { key: "next_followup_date", label: "Nächstes Follow-up", type: "date" },
];

export default function CRMContactDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: events = [] } = useCrmEvents();
  const { data: allGuests = [] } = useCrmEventGuests();
  const { data: stages = [] } = useCrmStages(null);
  const { data: pipelines = [] } = useCrmPipelines();
  const [actType, setActType] = useState<string>("note");
  const [actBody, setActBody] = useState("");
  const [taskTitle, setTaskTitle] = useState("");

  const { data: contact } = useQuery({
    queryKey: ["crm-contact", id],
    queryFn: async () => (await supabase.from("crm_contacts").select("*").eq("id", id!).single()).data,
  });
  const { data: leads = [] } = useQuery({
    queryKey: ["crm-contact-leads", id],
    queryFn: async () => (await supabase.from("crm_leads").select("id, name, stage, deal_value, next_step").eq("contact_id", id!)).data ?? [],
  });
  const leadIds = leads.map(l => l.id);
  const { data: activities = [] } = useQuery({
    queryKey: ["crm-contact-activities", id, leadIds.join(",")],
    queryFn: async () => {
      let q = supabase.from("crm_activities").select("id, type, title, body, created_at, lead_id").order("created_at", { ascending: false }).limit(300);
      q = leadIds.length ? q.or(`contact_id.eq.${id},lead_id.in.(${leadIds.join(",")})`) : q.eq("contact_id", id!);
      return (await q).data ?? [];
    },
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ["crm-contact-tasks", id, leadIds.join(",")],
    queryFn: async () => {
      let q = supabase.from("crm_tasks").select("id, title, due_date, is_completed").order("due_date", { nullsFirst: false });
      q = leadIds.length ? q.or(`contact_id.eq.${id},lead_id.in.(${leadIds.join(",")})`) : q.eq("contact_id", id!);
      return (await q).data ?? [];
    },
  });

  const refresh = () => {
    ["crm-contact", "crm-contacts", "crm-contact-activities", "crm-contact-tasks", "crm-contact-leads"].forEach(k => qc.invalidateQueries({ queryKey: [k] }));
  };
  const save = async (patch: Partial<CrmContact>) => {
    const { error } = await supabase.from("crm_contacts").update(patch as any).eq("id", id!);
    if (error) toast.error("Speichern fehlgeschlagen"); else refresh();
  };

  const addActivity = async () => {
    if (!actBody.trim()) return;
    const t = ACT_TYPES.find(a => a.value === actType)!;
    const { error } = await supabase.from("crm_activities").insert({ contact_id: id, type: actType as any, title: t.label, body: actBody.trim(), created_by: user?.id });
    if (error) { toast.error("Aktivität konnte nicht gespeichert werden"); return; }
    if (t.channel) await supabase.from("crm_contacts").update({ last_contact_at: new Date().toISOString(), last_channel: t.channel as any }).eq("id", id!);
    setActBody(""); refresh();
  };
  const addTask = async () => {
    if (!taskTitle.trim()) return;
    await supabase.from("crm_tasks").insert({ contact_id: id, title: taskTitle.trim(), assigned_to: user?.id });
    setTaskTitle(""); refresh();
  };
  const toggleTask = async (tid: string, done: boolean) => {
    await supabase.from("crm_tasks").update({ is_completed: !done, completed_at: !done ? new Date().toISOString() : null }).eq("id", tid);
    refresh();
  };
  const makeLead = async () => {
    if (!contact) return;
    const pipe = pipelines[0];
    const { data: st } = await supabase.from("crm_stage_config").select("value").eq("pipeline_id", pipe?.id ?? "").order("sort_order").limit(1).maybeSingle();
    const stage = st?.value ?? "interessiert";
    const { data, error } = await supabase.from("crm_leads").insert({
      name: contact.company || contact.full_name, contact_id: contact.id, contact_name: contact.full_name, contact_email: contact.email,
      contact_phone: contact.phone, linkedin_url: contact.linkedin_url, instagram_handle: contact.instagram_handle, website: contact.website,
      source: contact.source, stage, pipeline_id: pipe?.id ?? null, created_by: user?.id,
    }).select("id").single();
    if (error || !data) { toast.error("Lead konnte nicht angelegt werden"); return; }
    if (pipe) await supabase.from("crm_lead_pipelines").upsert({ lead_id: data.id, pipeline_id: pipe.id, stage }, { onConflict: "lead_id,pipeline_id" });
    qc.invalidateQueries({ queryKey: ["crm-lead-pipelines"] });
    nav(`/crm/lead/${data.id}`);
  };

  if (!contact) return <AppLayout><div className="py-12 text-center text-muted-foreground">Kontakt wird geladen…</div></AppLayout>;
  const guests = allGuests.filter(g => g.contact_id === contact.id);
  const wa = waLink(contact.whatsapp || contact.phone);
  const links = [
    wa && { href: wa, icon: MessageCircle, label: "WhatsApp" },
    contact.linkedin_url && { href: contact.linkedin_url, icon: Linkedin, label: "LinkedIn" },
    contact.email && { href: `mailto:${contact.email}`, icon: Mail, label: "Mail" },
    contact.phone && { href: `tel:${contact.phone}`, icon: Phone, label: "Anrufen" },
    contact.instagram_handle && { href: `https://instagram.com/${contact.instagram_handle.replace(/^@/, "")}`, icon: Instagram, label: "Instagram" },
    contact.website && { href: /^https?:/.test(contact.website) ? contact.website : `https://${contact.website}`, icon: Globe, label: "Website" },
  ].filter(Boolean) as { href: string; icon: typeof Mail; label: string }[];

  return (
    <AppLayout>
      <div className="space-y-4">
        <Link to="/crm" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Kontakte</Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">{contact.full_name}{contact.do_not_contact && <Ban className="h-5 w-5 text-destructive" />}</h1>
            <p className="text-sm text-muted-foreground">{[contact.role, contact.company].filter(Boolean).join(" · ") || "—"}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: colorOf(SEGMENTS, contact.segment) + "22", color: colorOf(SEGMENTS, contact.segment) }}>{labelOf(SEGMENTS, contact.segment)}</span>
              {(contact.tags ?? []).map(t => <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{t}</span>)}
            </div>
          </div>
          <Button onClick={makeLead}><Briefcase className="h-4 w-4 mr-1" />Lead daraus machen</Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="space-y-4">
            <section className="bg-card border border-border rounded-lg p-4 space-y-3">
              <h2 className="text-sm font-semibold">Info & Kontakt</h2>
              {links.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {links.map(l => (
                    <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border hover:border-primary/50 hover:text-primary">
                      <l.icon className="h-3.5 w-3.5" />{l.label}
                    </a>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-muted-foreground">Segment</label>
                  <Select value={contact.segment} onValueChange={v => save({ segment: v as any })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{SEGMENTS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground">Beziehung</label>
                  <Select value={contact.relationship} onValueChange={v => save({ relationship: v as any })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{RELATIONSHIPS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {FIELDS.map(f => (
                  <div key={f.key as string}>
                    <label className="text-[11px] text-muted-foreground">{f.label}</label>
                    <Input key={`${f.key as string}-${contact.updated_at}`} type={f.type ?? "text"} className="h-8 text-xs" defaultValue={(contact[f.key] as string) ?? ""}
                      onBlur={e => {
                        const v = e.target.value.trim();
                        if (v === ((contact[f.key] as string) ?? "")) return;
                        if (f.key === "full_name" && !v) return;
                        save({ [f.key]: v || null } as any);
                      }} />
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="text-[11px] text-muted-foreground">Tags (Komma-getrennt)</label>
                  <Input key={`tags-${contact.updated_at}`} className="h-8 text-xs" defaultValue={(contact.tags ?? []).join(", ")}
                    onBlur={e => { const tags = e.target.value.split(",").map(t => t.trim()).filter(Boolean); if (tags.join(",") !== (contact.tags ?? []).join(",")) save({ tags }); }} />
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] text-muted-foreground">Notizen</label>
                  <Textarea key={`notes-${contact.updated_at}`} className="text-xs min-h-[70px]" defaultValue={contact.notes ?? ""}
                    onBlur={e => e.target.value !== (contact.notes ?? "") && save({ notes: e.target.value || null })} />
                </div>
                <label className="col-span-2 flex items-center justify-between text-xs">
                  <span>Nicht kontaktieren (Abmeldung)</span>
                  <Switch checked={contact.do_not_contact} onCheckedChange={v => save({ do_not_contact: v })} />
                </label>
              </div>
              {contact.last_contact_at && (
                <p className="text-xs text-muted-foreground">Letzter Kontakt {formatDistanceToNow(new Date(contact.last_contact_at), { addSuffix: true, locale: de })}{contact.last_channel ? ` via ${contact.last_channel}` : ""}</p>
              )}
            </section>

            <section className="bg-card border border-border rounded-lg p-4 space-y-2">
              <h2 className="text-sm font-semibold">Events</h2>
              {guests.length === 0 && <p className="text-xs text-muted-foreground">Noch bei keinem Event.</p>}
              {guests.map(g => {
                const e = events.find(x => x.id === g.event_id);
                return (
                  <Link key={g.id} to={`/crm/event/${g.event_id}`} className="flex items-center justify-between text-sm hover:text-primary">
                    <span>{e?.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: colorOf(GUEST_STATUSES, g.status) + "22", color: colorOf(GUEST_STATUSES, g.status) }}>{labelOf(GUEST_STATUSES, g.status)}</span>
                  </Link>
                );
              })}
            </section>

            <section className="bg-card border border-border rounded-lg p-4 space-y-2">
              <h2 className="text-sm font-semibold">Verknüpfte Leads</h2>
              {leads.length === 0 && <p className="text-xs text-muted-foreground">Keine Leads.</p>}
              {leads.map(l => (
                <Link key={l.id} to={`/crm/lead/${l.id}`} className="flex items-center justify-between text-sm hover:text-primary">
                  <span>{l.name}</span>
                  <span className="text-xs text-muted-foreground">{getStageLabel(stages, l.stage)}{Number(l.deal_value) > 0 ? ` · ${Number(l.deal_value).toLocaleString("de-DE")} €` : ""}</span>
                </Link>
              ))}
            </section>

            <section className="bg-card border border-border rounded-lg p-4 space-y-2">
              <h2 className="text-sm font-semibold">To-dos</h2>
              {tasks.map(t => (
                <button key={t.id} onClick={() => toggleTask(t.id, t.is_completed)} className="flex w-full items-center gap-2 text-sm text-left">
                  {t.is_completed ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                  <span className={t.is_completed ? "line-through text-muted-foreground" : ""}>{t.title}</span>
                  {t.due_date && <span className="ml-auto text-xs text-muted-foreground">{format(new Date(t.due_date), "dd.MM.")}</span>}
                </button>
              ))}
              <div className="flex gap-2">
                <Input className="h-8 text-xs" placeholder="Neues To-do" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && addTask()} />
                <Button size="sm" variant="outline" onClick={addTask}><Plus className="h-3.5 w-3.5" /></Button>
              </div>
            </section>
          </div>

          <section className="bg-card border border-border rounded-lg p-4 space-y-3">
            <h2 className="text-sm font-semibold">Timeline</h2>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Select value={actType} onValueChange={setActType}>
                  <SelectTrigger className="h-9 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{ACT_TYPES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
                </Select>
                <Button size="sm" onClick={addActivity} disabled={!actBody.trim()}>Speichern</Button>
              </div>
              <Textarea placeholder="Was ist passiert?" value={actBody} onChange={e => setActBody(e.target.value)} className="text-sm min-h-[70px]" />
            </div>
            <div className="space-y-3 border-l border-border pl-4">
              {activities.map(a => {
                const ch = ACT_TYPES.find(t => t.value === a.type)?.channel;
                const Icon = ch ? CHANNEL_ICON[ch] : null;
                return (
                  <div key={a.id} className="relative">
                    <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {Icon && <Icon className="h-3.5 w-3.5" />}
                      <span className="font-medium text-foreground">{a.title || a.type}</span>
                      <span>· {format(new Date(a.created_at), "dd.MM.yyyy HH:mm")}</span>
                      {a.lead_id && <Link to={`/crm/lead/${a.lead_id}`} className="text-primary">· Lead</Link>}
                    </div>
                    {a.body && <p className="text-sm whitespace-pre-wrap mt-0.5">{a.body}</p>}
                  </div>
                );
              })}
              {activities.length === 0 && <p className="text-xs text-muted-foreground">Noch keine Aktivitäten.</p>}
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
