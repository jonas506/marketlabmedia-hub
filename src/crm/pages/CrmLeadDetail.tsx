import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowLeft, Globe, Plus, CheckCircle2, Circle, Trash2, Phone, Mail,
  MessageSquare, StickyNote, Activity as ActivityIcon, MoreHorizontal,
  Calendar, User, DollarSign, ChevronDown, Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const activityIcons: Record<string, any> = {
  note: StickyNote,
  call: Phone,
  email: Mail,
  sms: MessageSquare,
  status_change: ActivityIcon,
  opportunity_change: DollarSign,
  task_completed: CheckCircle2,
  created: Plus,
};

const activityColors: Record<string, string> = {
  note: "#0083F7",
  call: "#8B5CF6",
  email: "#F59E0B",
  sms: "#EC4899",
  status_change: "#F59E0B",
  opportunity_change: "#22C55E",
  task_completed: "#22C55E",
  created: "#6B7280",
};

export default function CrmLeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [noteText, setNoteText] = useState("");
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [addOppOpen, setAddOppOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ first_name: "", last_name: "", email: "", phone: "", position: "" });
  const [taskForm, setTaskForm] = useState({ title: "", due_date: "" });
  const [oppForm, setOppForm] = useState({ pipeline_id: "", stage_id: "", value: "", note: "" });
  const [activityFilter, setActivityFilter] = useState("all");

  const { data: lead, isLoading } = useQuery({
    queryKey: ["crm-lead", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_leads")
        .select("*, crm_lead_statuses(*)")
        .eq("id", id!)
        .single();
      return data;
    },
    enabled: !!id,
  });

  const { data: statuses = [] } = useQuery({
    queryKey: ["crm-lead-statuses"],
    queryFn: async () => {
      const { data } = await supabase.from("crm_lead_statuses").select("*").order("sort_order");
      return data || [];
    },
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["crm-contacts", id],
    queryFn: async () => {
      const { data } = await supabase.from("crm_contacts").select("*").eq("lead_id", id!).order("created_at");
      return data || [];
    },
    enabled: !!id,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["crm-tasks", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_tasks")
        .select("*")
        .eq("lead_id", id!)
        .order("is_completed")
        .order("due_date", { ascending: true, nullsFirst: false });
      return data || [];
    },
    enabled: !!id,
  });

  const { data: opportunities = [] } = useQuery({
    queryKey: ["crm-opportunities", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_opportunities")
        .select("*, crm_pipeline_stages(*), crm_pipelines(name), crm_contacts(first_name, last_name)")
        .eq("lead_id", id!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["crm-activities", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_activities")
        .select("*")
        .eq("lead_id", id!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  const { data: pipelines = [] } = useQuery({
    queryKey: ["crm-pipelines"],
    queryFn: async () => {
      const { data } = await supabase.from("crm_pipelines").select("*, crm_pipeline_stages(*)").order("name");
      return data || [];
    },
  });

  const updateLead = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { error } = await supabase.from("crm_leads").update(updates).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-lead", id] }),
  });

  const changeStatus = useMutation({
    mutationFn: async (statusId: string) => {
      const oldStatus = lead?.crm_lead_statuses?.name || "Unbekannt";
      const newStatus = statuses.find((s: any) => s.id === statusId);
      await supabase.from("crm_leads").update({ status_id: statusId }).eq("id", id!);
      await supabase.from("crm_activities").insert({
        lead_id: id!,
        type: "status_change" as any,
        title: `Status: ${oldStatus} → ${newStatus?.name}`,
        metadata: { old_status: oldStatus, new_status: newStatus?.name },
        created_by: user!.id,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-lead", id] });
      qc.invalidateQueries({ queryKey: ["crm-activities", id] });
      toast.success("Status aktualisiert");
    },
  });

  const addNote = useMutation({
    mutationFn: async () => {
      await supabase.from("crm_notes").insert({ lead_id: id!, body: noteText, created_by: user!.id });
      await supabase.from("crm_activities").insert({
        lead_id: id!,
        type: "note" as any,
        title: "Notiz hinzugefügt",
        body: noteText,
        created_by: user!.id,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-activities", id] });
      setNoteText("");
      toast.success("Notiz gespeichert");
    },
  });

  const addContact = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("crm_contacts").insert({ lead_id: id!, ...contactForm });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-contacts", id] });
      setAddContactOpen(false);
      setContactForm({ first_name: "", last_name: "", email: "", phone: "", position: "" });
      toast.success("Kontakt hinzugefügt");
    },
  });

  const addTask = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("crm_tasks").insert({
        lead_id: id!,
        title: taskForm.title,
        due_date: taskForm.due_date || null,
        assigned_to: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-tasks", id] });
      setAddTaskOpen(false);
      setTaskForm({ title: "", due_date: "" });
      toast.success("Aufgabe erstellt");
    },
  });

  const toggleTask = useMutation({
    mutationFn: async (task: any) => {
      const completed = !task.is_completed;
      await supabase.from("crm_tasks").update({
        is_completed: completed,
        completed_at: completed ? new Date().toISOString() : null,
      }).eq("id", task.id);
      if (completed) {
        await supabase.from("crm_activities").insert({
          lead_id: id!,
          type: "task_completed" as any,
          title: `Aufgabe erledigt: ${task.title}`,
          created_by: user!.id,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-tasks", id] });
      qc.invalidateQueries({ queryKey: ["crm-activities", id] });
    },
  });

  const addOpportunity = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("crm_opportunities").insert({
        lead_id: id!,
        pipeline_id: oppForm.pipeline_id,
        stage_id: oppForm.stage_id,
        value: Number(oppForm.value) || 0,
        note: oppForm.note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-opportunities", id] });
      setAddOppOpen(false);
      setOppForm({ pipeline_id: "", stage_id: "", value: "", note: "" });
      toast.success("Opportunity erstellt");
    },
  });

  const selectedPipelineStages = pipelines.find((p: any) => p.id === oppForm.pipeline_id)?.crm_pipeline_stages || [];

  if (isLoading || !lead) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-crm-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const filteredActivities = activityFilter === "all"
    ? activities
    : activityFilter === "notes"
    ? activities.filter((a: any) => a.type === "note")
    : activities;

  return (
    <div className="flex h-full">
      {/* LEFT COLUMN */}
      <div className="w-[380px] shrink-0 border-r border-crm-border overflow-y-auto">
        {/* Header */}
        <div className="px-5 py-4 border-b border-crm-border">
          <button onClick={() => navigate("/crm/leads")} className="flex items-center gap-1.5 text-crm-muted text-sm mb-3 hover:text-crm-text">
            <ArrowLeft className="w-4 h-4" /> Leads
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-crm-primary/20 text-crm-primary flex items-center justify-center text-sm font-bold">
              {lead.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold truncate">{lead.name}</h1>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1 mt-0.5">
                    <span
                      className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: (lead.crm_lead_statuses as any)?.color + "22",
                        color: (lead.crm_lead_statuses as any)?.color,
                      }}
                    >
                      {(lead.crm_lead_statuses as any)?.name || "Kein Status"}
                    </span>
                    <ChevronDown className="w-3 h-3 text-crm-muted" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-crm-surface border-crm-border">
                  {statuses.map((s: any) => (
                    <DropdownMenuItem
                      key={s.id}
                      onClick={() => changeStatus.mutate(s.id)}
                      className="text-crm-text"
                    >
                      <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* ABOUT */}
        <div className="px-5 py-4 border-b border-crm-border">
          <h3 className="text-xs font-semibold text-crm-muted uppercase tracking-wider mb-3">About</h3>
          {lead.website && (
            <a href={lead.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-crm-primary hover:underline mb-2">
              <Globe className="w-3.5 h-3.5" /> {lead.website}
            </a>
          )}
          {lead.description && <p className="text-sm text-crm-muted">{lead.description}</p>}
          {!lead.website && !lead.description && <p className="text-sm text-crm-muted italic">Keine Details</p>}
        </div>

        {/* TASKS */}
        <div className="px-5 py-4 border-b border-crm-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-crm-muted uppercase tracking-wider">Tasks</h3>
            <button onClick={() => setAddTaskOpen(true)} className="text-crm-primary hover:text-crm-primary-hover">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-1.5">
            {tasks.map((t: any) => (
              <div
                key={t.id}
                className="flex items-center gap-2 group"
              >
                <button onClick={() => toggleTask.mutate(t)} className="shrink-0">
                  {t.is_completed ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <Circle className="w-4 h-4 text-crm-muted group-hover:text-crm-primary" />
                  )}
                </button>
                <span className={`text-sm flex-1 ${t.is_completed ? "line-through text-crm-muted" : ""}`}>
                  {t.title}
                </span>
                {t.due_date && !t.is_completed && (
                  <span className={`text-xs ${new Date(t.due_date) < new Date() ? "text-red-400" : "text-crm-muted"}`}>
                    {format(new Date(t.due_date), "dd.MM.")}
                  </span>
                )}
              </div>
            ))}
            {tasks.length === 0 && <p className="text-sm text-crm-muted italic">Keine Aufgaben</p>}
          </div>
        </div>

        {/* OPPORTUNITIES */}
        <div className="px-5 py-4 border-b border-crm-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-crm-muted uppercase tracking-wider">Opportunities</h3>
            <button onClick={() => setAddOppOpen(true)} className="text-crm-primary hover:text-crm-primary-hover">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {opportunities.map((opp: any) => (
              <div key={opp.id} className="p-3 rounded-lg bg-crm-bg border border-crm-border">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold">{Number(opp.value).toLocaleString("de-DE")} €</span>
                  <span className="text-xs text-crm-muted">{opp.crm_pipeline_stages?.win_probability}%</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-crm-muted">{opp.crm_pipelines?.name}</span>
                  <span
                    className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium"
                    style={{
                      backgroundColor: opp.crm_pipeline_stages?.color + "22",
                      color: opp.crm_pipeline_stages?.color,
                    }}
                  >
                    {opp.crm_pipeline_stages?.name}
                  </span>
                </div>
                {opp.note && <p className="text-xs text-crm-muted mt-1">{opp.note}</p>}
              </div>
            ))}
            {opportunities.length === 0 && <p className="text-sm text-crm-muted italic">Keine Opportunities</p>}
          </div>
        </div>

        {/* CONTACTS */}
        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-crm-muted uppercase tracking-wider">Contacts</h3>
            <button onClick={() => setAddContactOpen(true)} className="text-crm-primary hover:text-crm-primary-hover">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {contacts.map((c: any) => (
              <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-crm-bg/50">
                <div className="w-8 h-8 rounded-full bg-crm-border flex items-center justify-center text-xs font-medium">
                  {(c.first_name[0] || "") + (c.last_name[0] || "")}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.first_name} {c.last_name}</p>
                  {c.position && <p className="text-xs text-crm-muted">{c.position}</p>}
                </div>
                <div className="flex gap-1">
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="p-1.5 rounded hover:bg-crm-border">
                      <Mail className="w-3.5 h-3.5 text-crm-muted" />
                    </a>
                  )}
                  {c.phone && (
                    <a href={`tel:${c.phone}`} className="p-1.5 rounded hover:bg-crm-border">
                      <Phone className="w-3.5 h-3.5 text-crm-muted" />
                    </a>
                  )}
                </div>
              </div>
            ))}
            {contacts.length === 0 && <p className="text-sm text-crm-muted italic">Keine Kontakte</p>}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Action Bar */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-crm-border">
          {[
            { label: "Note", icon: StickyNote, action: () => {} },
            { label: "Call", icon: Phone, action: () => {} },
          ].map(btn => (
            <Button key={btn.label} variant="ghost" size="sm" className="text-crm-muted hover:text-crm-text hover:bg-crm-bg">
              <btn.icon className="w-4 h-4 mr-1.5" />
              {btn.label}
            </Button>
          ))}
        </div>

        {/* Note input */}
        <div className="px-6 py-3 border-b border-crm-border">
          <div className="flex gap-2">
            <Textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Notiz hinzufügen..."
              className="min-h-[60px] bg-crm-bg border-crm-border text-crm-text placeholder:text-crm-muted resize-none"
              rows={2}
            />
            <Button
              onClick={() => addNote.mutate()}
              disabled={!noteText.trim()}
              size="icon"
              className="bg-crm-primary hover:bg-crm-primary-hover text-white shrink-0 self-end"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-4 px-6 py-2 border-b border-crm-border">
          {["all", "notes"].map(f => (
            <button
              key={f}
              onClick={() => setActivityFilter(f)}
              className={`text-sm pb-1 border-b-2 transition-colors ${
                activityFilter === f
                  ? "border-crm-primary text-crm-primary font-medium"
                  : "border-transparent text-crm-muted hover:text-crm-text"
              }`}
            >
              {f === "all" ? "Alle" : "Notizen"}
            </button>
          ))}
        </div>

        {/* Activity Timeline */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
          {filteredActivities.map((a: any) => {
            const Icon = activityIcons[a.type] || ActivityIcon;
            const color = activityColors[a.type] || "#6B7280";
            return (
              <div key={a.id} className="flex gap-3 py-3 border-b border-crm-border/50 last:border-0">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ backgroundColor: color + "18" }}
                >
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{a.title}</p>
                  {a.body && <p className="text-sm text-crm-muted mt-0.5 whitespace-pre-wrap">{a.body}</p>}
                </div>
                <span className="text-xs text-crm-muted shrink-0">
                  {format(new Date(a.created_at), "d MMM", { locale: de })}
                </span>
              </div>
            );
          })}
          {filteredActivities.length === 0 && (
            <p className="text-center text-crm-muted py-8">Keine Aktivitäten</p>
          )}
        </div>
      </div>

      {/* Add Contact Dialog */}
      <Dialog open={addContactOpen} onOpenChange={setAddContactOpen}>
        <DialogContent className="bg-crm-surface border-crm-border text-crm-text">
          <DialogHeader><DialogTitle>Kontakt hinzufügen</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-crm-muted text-xs">Vorname *</Label>
              <Input value={contactForm.first_name} onChange={e => setContactForm(f => ({ ...f, first_name: e.target.value }))} className="mt-1 bg-crm-bg border-crm-border text-crm-text" />
            </div>
            <div>
              <Label className="text-crm-muted text-xs">Nachname *</Label>
              <Input value={contactForm.last_name} onChange={e => setContactForm(f => ({ ...f, last_name: e.target.value }))} className="mt-1 bg-crm-bg border-crm-border text-crm-text" />
            </div>
            <div>
              <Label className="text-crm-muted text-xs">Email</Label>
              <Input value={contactForm.email} onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))} className="mt-1 bg-crm-bg border-crm-border text-crm-text" />
            </div>
            <div>
              <Label className="text-crm-muted text-xs">Telefon</Label>
              <Input value={contactForm.phone} onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))} className="mt-1 bg-crm-bg border-crm-border text-crm-text" />
            </div>
            <div className="col-span-2">
              <Label className="text-crm-muted text-xs">Position</Label>
              <Input value={contactForm.position} onChange={e => setContactForm(f => ({ ...f, position: e.target.value }))} className="mt-1 bg-crm-bg border-crm-border text-crm-text" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddContactOpen(false)} className="text-crm-muted">Abbrechen</Button>
            <Button onClick={() => addContact.mutate()} disabled={!contactForm.first_name.trim()} className="bg-crm-primary hover:bg-crm-primary-hover text-white">Hinzufügen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Task Dialog */}
      <Dialog open={addTaskOpen} onOpenChange={setAddTaskOpen}>
        <DialogContent className="bg-crm-surface border-crm-border text-crm-text">
          <DialogHeader><DialogTitle>Aufgabe erstellen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-crm-muted text-xs">Titel *</Label>
              <Input value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} className="mt-1 bg-crm-bg border-crm-border text-crm-text" />
            </div>
            <div>
              <Label className="text-crm-muted text-xs">Fällig am</Label>
              <Input type="date" value={taskForm.due_date} onChange={e => setTaskForm(f => ({ ...f, due_date: e.target.value }))} className="mt-1 bg-crm-bg border-crm-border text-crm-text" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddTaskOpen(false)} className="text-crm-muted">Abbrechen</Button>
            <Button onClick={() => addTask.mutate()} disabled={!taskForm.title.trim()} className="bg-crm-primary hover:bg-crm-primary-hover text-white">Erstellen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Opportunity Dialog */}
      <Dialog open={addOppOpen} onOpenChange={setAddOppOpen}>
        <DialogContent className="bg-crm-surface border-crm-border text-crm-text">
          <DialogHeader><DialogTitle>Opportunity erstellen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-crm-muted text-xs">Pipeline *</Label>
              <select
                value={oppForm.pipeline_id}
                onChange={e => setOppForm(f => ({ ...f, pipeline_id: e.target.value, stage_id: "" }))}
                className="mt-1 w-full rounded-md border border-crm-border bg-crm-bg text-crm-text px-3 py-2 text-sm"
              >
                <option value="">Auswählen...</option>
                {pipelines.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            {oppForm.pipeline_id && (
              <div>
                <Label className="text-crm-muted text-xs">Stage *</Label>
                <select
                  value={oppForm.stage_id}
                  onChange={e => setOppForm(f => ({ ...f, stage_id: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-crm-border bg-crm-bg text-crm-text px-3 py-2 text-sm"
                >
                  <option value="">Auswählen...</option>
                  {selectedPipelineStages
                    .sort((a: any, b: any) => a.sort_order - b.sort_order)
                    .map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.win_probability}%)</option>)}
                </select>
              </div>
            )}
            <div>
              <Label className="text-crm-muted text-xs">Wert (€)</Label>
              <Input type="number" value={oppForm.value} onChange={e => setOppForm(f => ({ ...f, value: e.target.value }))} className="mt-1 bg-crm-bg border-crm-border text-crm-text" placeholder="z.B. 999" />
            </div>
            <div>
              <Label className="text-crm-muted text-xs">Notiz</Label>
              <Textarea value={oppForm.note} onChange={e => setOppForm(f => ({ ...f, note: e.target.value }))} className="mt-1 bg-crm-bg border-crm-border text-crm-text resize-none" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOppOpen(false)} className="text-crm-muted">Abbrechen</Button>
            <Button onClick={() => addOpportunity.mutate()} disabled={!oppForm.pipeline_id || !oppForm.stage_id} className="bg-crm-primary hover:bg-crm-primary-hover text-white">Erstellen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
