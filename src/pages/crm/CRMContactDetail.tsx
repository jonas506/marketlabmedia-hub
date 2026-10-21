import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { ArrowLeft, Briefcase, Pencil, Check, X } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useCrmEvents, useCrmEventGuests, type CrmContact } from "@/hooks/useCrmContacts";
import { useCrmStages, useCrmPipelines, getStageLabel } from "@/hooks/useCrmStages";
import { SEGMENTS, RELATIONSHIPS, labelOf, colorOf } from "@/lib/crm-contacts";
import CrmDetailHeader, { buildQuickActions } from "@/components/crm/detail/CrmDetailHeader";
import DetailsPanel, { type DetailGroup, linkHref } from "@/components/crm/detail/DetailsPanel";
import ActivityPanel from "@/components/crm/detail/ActivityPanel";
import { NextStepCard, TasksCard, EventsCard, OffersCard } from "@/components/crm/detail/SideCards";
import type { CrmActivity } from "@/lib/crm-activity";

export default function CRMContactDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: events = [] } = useCrmEvents();
  const { data: allGuests = [] } = useCrmEventGuests();
  const { data: stages = [] } = useCrmStages(null);
  const { data: pipelines = [] } = useCrmPipelines();
  const [editNotes, setEditNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");

  const { data: contact, isLoading } = useQuery({
    queryKey: ["crm-contact", id],
    queryFn: async () => (await supabase.from("crm_contacts").select("*").eq("id", id!).single()).data,
  });
  const { data: leads = [] } = useQuery({
    queryKey: ["crm-contact-leads", id],
    queryFn: async () => (await supabase.from("crm_leads").select("id, name, stage, deal_value").eq("contact_id", id!)).data ?? [],
  });
  const leadIds = leads.map(l => l.id);
  const { data: activities = [] } = useQuery({
    queryKey: ["crm-contact-activities", id, leadIds.join(",")],
    queryFn: async () => {
      let q = supabase.from("crm_activities").select("id, type, title, body, created_at, created_by, lead_id, contact_id, metadata").order("created_at", { ascending: false }).limit(300);
      q = leadIds.length ? q.or(`contact_id.eq.${id},lead_id.in.(${leadIds.join(",")})`) : q.eq("contact_id", id!);
      return ((await q).data ?? []) as CrmActivity[];
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
  const { data: documents = [] } = useQuery({
    queryKey: ["crm-contact-documents", id, leadIds.join(",")],
    enabled: leadIds.length > 0,
    queryFn: async () => (await supabase.from("signature_documents").select("id, title, status, amount_net").in("lead_id", leadIds).order("created_at", { ascending: false })).data ?? [],
  });

  const refresh = () => {
    ["crm-contact", "crm-contacts", "crm-contact-activities", "crm-contact-tasks", "crm-contact-leads", "crm-contact-documents"].forEach(k => qc.invalidateQueries({ queryKey: [k] }));
  };
  const save = async (patch: Partial<CrmContact>) => {
    const { error } = await supabase.from("crm_contacts").update(patch as any).eq("id", id!);
    if (error) toast.error("Speichern fehlgeschlagen"); else refresh();
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

  if (isLoading || !contact) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <Skeleton className="h-16 w-2/3" />
          <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)_320px]">
            <Skeleton className="h-64" /><Skeleton className="h-96" /><Skeleton className="h-64" />
          </div>
        </div>
      </AppLayout>
    );
  }

  const guests = allGuests.filter(g => g.contact_id === contact.id);
  const groups: DetailGroup[] = [
    {
      title: "Kontakt",
      fields: [
        { key: "email", label: "E-Mail", value: contact.email, href: linkHref("email", contact.email) },
        { key: "phone", label: "Telefon", value: contact.phone, href: linkHref("tel", contact.phone) },
        { key: "whatsapp", label: "WhatsApp", value: contact.whatsapp },
        { key: "linkedin_url", label: "LinkedIn", value: contact.linkedin_url, href: linkHref("link", contact.linkedin_url) },
        { key: "instagram_handle", label: "Instagram", value: contact.instagram_handle },
        { key: "website", label: "Website", value: contact.website, href: linkHref("link", contact.website) },
      ],
    },
    {
      title: "Firma",
      fields: [
        { key: "company", label: "Firma", value: contact.company },
        { key: "role", label: "Rolle", value: contact.role },
      ],
    },
    {
      title: "Ort",
      fields: [
        { key: "city", label: "Ort", value: contact.city },
        { key: "region", label: "Region", value: contact.region },
      ],
    },
    {
      title: "CRM",
      fields: [
        { key: "segment", label: "Segment", value: contact.segment, type: "select", options: SEGMENTS.map(s => ({ value: s.value, label: s.label })) },
        { key: "relationship", label: "Beziehung", value: contact.relationship, type: "select", options: RELATIONSHIPS.map(s => ({ value: s.value, label: s.label })) },
        { key: "source", label: "Quelle", value: contact.source },
        { key: "next_followup_date", label: "Follow-up", value: contact.next_followup_date, type: "date" },
      ],
    },
    {
      title: "System",
      fields: [
        { key: "created_at", label: "Erstellt am", value: contact.created_at ? format(new Date(contact.created_at), "dd.MM.yyyy") : null },
        { key: "last_contact_at", label: "Letzter Kontakt", value: contact.last_contact_at ? formatDistanceToNow(new Date(contact.last_contact_at), { addSuffix: true, locale: de }) : null },
      ],
    },
  ];

  const background = contact.notes ? (
    <div className="rounded-lg border border-primary/30 bg-card p-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Hintergrund</p>
        {!editNotes && (
          <button onClick={() => { setNotesDraft(contact.notes ?? ""); setEditNotes(true); }} className="p-1 text-muted-foreground/50 hover:text-foreground" title="Bearbeiten">
            <Pencil className="h-3 w-3" />
          </button>
        )}
      </div>
      {editNotes ? (
        <div className="mt-2 space-y-2">
          <Textarea autoFocus value={notesDraft} onChange={e => setNotesDraft(e.target.value)} className="min-h-[80px] text-sm bg-background" />
          <div className="flex gap-1.5 justify-end">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditNotes(false)}><X className="h-3 w-3 mr-1" />Abbrechen</Button>
            <Button size="sm" className="h-7 text-xs" onClick={() => { save({ notes: notesDraft.trim() || null }); setEditNotes(false); }}><Check className="h-3 w-3 mr-1" />Speichern</Button>
          </div>
        </div>
      ) : (
        <p className="mt-1.5 text-sm text-foreground/80 whitespace-pre-wrap">{contact.notes}</p>
      )}
    </div>
  ) : undefined;

  return (
    <AppLayout>
      <div className="space-y-5">
        <Link to="/crm" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Kontakte
        </Link>

        <CrmDetailHeader
          name={contact.full_name}
          subtitle={[contact.role, contact.company].filter(Boolean).join(" · ") || null}
          doNotContact={contact.do_not_contact}
          badges={
            <>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: colorOf(SEGMENTS, contact.segment) + "22", color: colorOf(SEGMENTS, contact.segment) }}>
                {labelOf(SEGMENTS, contact.segment)}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{labelOf(RELATIONSHIPS, contact.relationship)}</span>
            </>
          }
          tags={contact.tags ?? []}
          onTagsChange={tags => save({ tags })}
          actions={buildQuickActions(contact)}
          extra={<Button size="sm" onClick={makeLead}><Briefcase className="h-4 w-4 mr-1.5" />Lead daraus machen</Button>}
        />

        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)_320px] items-start">
          {/* Links: Details */}
          <div className="space-y-4">
            <DetailsPanel groups={groups} onSave={(key, value) => {
              if (key === "created_at" || key === "last_contact_at") return;
              save({ [key]: value } as any);
            }} />
            <label className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-xs cursor-pointer">
              <span>Nicht kontaktieren (Abmeldung)</span>
              <Switch checked={contact.do_not_contact} onCheckedChange={v => save({ do_not_contact: v })} />
            </label>
          </div>

          {/* Mitte: Aktivität */}
          <Tabs defaultValue="aktivitaet">
            <TabsList>
              <TabsTrigger value="aktivitaet">Aktivität</TabsTrigger>
            </TabsList>
            <TabsContent value="aktivitaet" className="mt-4">
              <ActivityPanel activities={activities} contactId={id} onChanged={refresh} background={background} />
            </TabsContent>
          </Tabs>

          {/* Rechts: Karten */}
          <div className="space-y-4">
            <NextStepCard
              date={contact.next_followup_date}
              text={null}
              onSave={(date) => save({ next_followup_date: date })}
            />
            <TasksCard tasks={tasks} contactId={id} onChanged={refresh} />
            <EventsCard guests={guests} events={events} contactId={id!} onChanged={refresh} />
            <section className="bg-card border border-border rounded-lg p-4 space-y-2.5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Verknüpfte Leads</h2>
              {leads.length === 0 && <p className="text-xs text-muted-foreground">Keine Leads.</p>}
              {leads.map(l => (
                <Link key={l.id} to={`/crm/lead/${l.id}`} className="flex items-center justify-between text-sm hover:text-primary">
                  <span className="truncate">{l.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {getStageLabel(stages, l.stage)}{Number(l.deal_value) > 0 ? ` · ${Number(l.deal_value).toLocaleString("de-DE")} €` : ""}
                  </span>
                </Link>
              ))}
            </section>
            <OffersCard documents={documents} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
