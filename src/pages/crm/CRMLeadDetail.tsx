import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  ArrowLeft, StickyNote, Phone, Mail, Users2, Globe, Save,
  ChevronDown, ChevronRight, Plus, ExternalLink, Lightbulb,
  Search, Filter, MoreHorizontal, CheckSquare, CalendarIcon, Clock,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import CRMLayout from "../CRM";

const SOURCE_OPTIONS = [
  { value: "empfehlung", label: "Empfehlung" },
  { value: "ads", label: "Ads" },
  { value: "kaltakquise_telefon", label: "Kaltakquise Telefon" },
  { value: "linkedin", label: "LinkedIn" },
];

const SOURCE_COLORS: Record<string, string> = {
  empfehlung: "bg-emerald-500/20 text-emerald-400",
  ads: "bg-blue-500/20 text-blue-400",
  kaltakquise_telefon: "bg-orange-500/20 text-orange-400",
  linkedin: "bg-sky-500/20 text-sky-400",
};

const ACTIVITY_TYPES = [
  { value: "note", label: "Notiz", icon: StickyNote, color: "#F59E0B" },
  { value: "email", label: "Email", icon: Mail, color: "#0083F7" },
  { value: "call", label: "Anruf", icon: Phone, color: "#22C55E" },
  { value: "sms", label: "Meeting", icon: Users2, color: "#8B5CF6" },
] as const;

const ACTIVITY_ICON_MAP: Record<string, { icon: typeof StickyNote; color: string }> = {
  note: { icon: StickyNote, color: "#F59E0B" },
  call: { icon: Phone, color: "#22C55E" },
  email: { icon: Mail, color: "#0083F7" },
  sms: { icon: Users2, color: "#8B5CF6" },
  status_change: { icon: Lightbulb, color: "#F59E0B" },
  opportunity_change: { icon: Lightbulb, color: "#F59E0B" },
  task_completed: { icon: CheckSquare, color: "#22C55E" },
  created: { icon: StickyNote, color: "#6B7280" },
};

const TIMELINE_FILTERS = ["Alle", "Notizen", "Anrufe", "Emails", "Meetings"] as const;
const FILTER_MAP: Record<string, string | null> = {
  Alle: null, Notizen: "note", Anrufe: "call", Emails: "email", Meetings: "sms",
};

interface LeadData {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  notes: string | null;
  description: string | null;
  source: string | null;
  status_id: string | null;
}

interface Activity {
  id: string;
  type: string;
  title: string;
  body: string | null;
  created_at: string;
}

interface Status {
  id: string;
  name: string;
  color: string;
}

interface Opportunity {
  id: string;
  value: number;
  note: string | null;
  pipeline_name: string;
  stage_name: string;
  stage_color: string;
  win_probability: number;
}

interface CrmTask {
  id: string;
  title: string;
  due_date: string | null;
  due_time: string | null;
  is_completed: boolean;
  completed_at: string | null;
  lead_id: string | null;
  assigned_to: string;
}

export default function CRMLeadDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [lead, setLead] = useState<LeadData | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [showActivity, setShowActivity] = useState(false);
  const [activityType, setActivityType] = useState<string>("note");
  const [activityTitle, setActivityTitle] = useState("");
  const [activityBody, setActivityBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [timelineFilter, setTimelineFilter] = useState<string>("Alle");
  const [timelineSearch, setTimelineSearch] = useState("");

  // Collapsible sections
  const [aboutOpen, setAboutOpen] = useState(true);
  const [oppsOpen, setOppsOpen] = useState(true);
  const [contactOpen, setContactOpen] = useState(true);
  const [tasksOpen, setTasksOpen] = useState(true);

  // Tasks state
  const [crmTasks, setCrmTasks] = useState<CrmTask[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDate, setNewTaskDate] = useState<Date | undefined>();
  const [newTaskTime, setNewTaskTime] = useState("");

  const fetchLead = async () => {
    if (!id) return;
    const [{ data: leadData }, { data: actData }, { data: statusData }, { data: oppData }, { data: taskData }] = await Promise.all([
      supabase.from("crm_leads").select("*").eq("id", id).single(),
      supabase.from("crm_activities").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
      supabase.from("crm_lead_statuses").select("*").order("sort_order"),
      supabase.from("crm_opportunities").select("*, crm_pipelines(name), crm_pipeline_stages(name, color, win_probability)").eq("lead_id", id),
      supabase.from("crm_tasks").select("*").eq("lead_id", id).order("is_completed").order("due_date", { ascending: true, nullsFirst: false }),
    ]);
    if (leadData) setLead(leadData as any);
    setActivities((actData || []) as any[]);
    setStatuses(statusData || []);
    setOpportunities((oppData || []).map((o: any) => ({
      id: o.id,
      value: o.value,
      note: o.note,
      pipeline_name: o.crm_pipelines?.name || "",
      stage_name: o.crm_pipeline_stages?.name || "",
      stage_color: o.crm_pipeline_stages?.color || "#6B7280",
      win_probability: o.crm_pipeline_stages?.win_probability || 0,
    })));
    setCrmTasks((taskData || []) as any[]);
  };

  useEffect(() => { fetchLead(); }, [id]);

  const saveField = async (field: string, value: any) => {
    if (!id) return;
    await supabase.from("crm_leads").update({ [field]: value }).eq("id", id);
    setEditingField(null);
  };

  const saveLead = async () => {
    if (!lead || !id) return;
    setSaving(true);
    const { error } = await supabase.from("crm_leads").update({
      name: lead.name,
      contact_name: lead.contact_name,
      contact_email: lead.contact_email,
      contact_phone: lead.contact_phone,
      website: lead.website,
      notes: lead.notes,
      source: lead.source,
      status_id: lead.status_id,
    }).eq("id", id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Gespeichert");
  };

  const addActivity = async () => {
    if (!activityTitle.trim() || !id || !user) return;
    const { error } = await supabase.from("crm_activities").insert({
      lead_id: id,
      type: activityType as any,
      title: activityTitle,
      body: activityBody || null,
      created_by: user.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Eintrag erstellt");
    setShowActivity(false);
    setActivityTitle("");
    setActivityBody("");
    fetchLead();
  };

  const addCrmTask = async () => {
    if (!newTaskTitle.trim() || !id || !user) return;
    const { error } = await supabase.from("crm_tasks").insert({
      lead_id: id,
      title: newTaskTitle,
      due_date: newTaskDate ? format(newTaskDate, "yyyy-MM-dd") : null,
      due_time: newTaskTime || null,
      assigned_to: user.id,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("To-Do erstellt");
    setNewTaskTitle("");
    setNewTaskDate(undefined);
    setNewTaskTime("");
    fetchLead();
  };

  const toggleCrmTask = async (task: CrmTask) => {
    const completed = !task.is_completed;
    await supabase.from("crm_tasks").update({
      is_completed: completed,
      completed_at: completed ? new Date().toISOString() : null,
    }).eq("id", task.id);
    fetchLead();
  };

  const filteredActivities = activities.filter(act => {
    const typeFilter = FILTER_MAP[timelineFilter];
    if (typeFilter && act.type !== typeFilter) return false;
    if (timelineSearch) {
      const q = timelineSearch.toLowerCase();
      return act.title.toLowerCase().includes(q) || (act.body || "").toLowerCase().includes(q);
    }
    return true;
  });

  if (!lead) return <CRMLayout><div className="flex items-center justify-center h-64 text-muted-foreground">Laden...</div></CRMLayout>;

  const currentStatus = statuses.find(s => s.id === lead.status_id);

  return (
    <CRMLayout>
      <div className="flex flex-col h-[calc(100vh-48px)] -m-6">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-[#3A3A44] bg-[#1E1E24] shrink-0">
          <div className="flex items-center gap-3">
            <Link to="/crm" className="text-muted-foreground hover:text-[#FAFBFF] transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-lg font-bold text-[#FAFBFF] font-[Manrope]">{lead.name}</h1>
            {/* Status dropdown */}
            <Select
              value={lead.status_id || ""}
              onValueChange={v => {
                setLead(p => p ? { ...p, status_id: v } : p);
                saveField("status_id", v);
              }}
            >
              <SelectTrigger className="h-7 w-auto gap-1.5 px-2.5 border-[#3A3A44] bg-transparent text-xs font-medium" style={currentStatus ? { color: currentStatus.color, borderColor: currentStatus.color + "44" } : {}}>
                {currentStatus && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: currentStatus.color }} />}
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statuses.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {lead.source && (
              <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${SOURCE_COLORS[lead.source] || ""}`}>
                {SOURCE_OPTIONS.find(s => s.value === lead.source)?.label || lead.source}
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            {ACTIVITY_TYPES.map(t => (
              <Button
                key={t.value}
                variant="outline"
                size="sm"
                className="gap-1.5 h-8 text-xs border-[#3A3A44] bg-transparent hover:bg-[#2A2A32] text-[#FAFBFF]/80"
                onClick={() => { setActivityType(t.value); setShowActivity(true); }}
              >
                <t.icon className="h-3.5 w-3.5" style={{ color: t.color }} />
                {t.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Two-column layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* LEFT PANEL */}
          <div className="w-[380px] shrink-0 border-r border-[#3A3A44] overflow-y-auto">
            {/* ABOUT section */}
            <div className="border-b border-[#3A3A44]">
              <button
                onClick={() => setAboutOpen(!aboutOpen)}
                className="flex items-center gap-2 w-full px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#FAFBFF]/50 hover:text-[#FAFBFF]/70 transition-colors"
              >
                {aboutOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                <StickyNote className="h-3 w-3" />
                About
              </button>
              {aboutOpen && (
                <div className="px-4 pb-4 space-y-2.5">
                  {/* Website */}
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {lead.website ? (
                      <a href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate text-sm">
                        {lead.website.replace(/^https?:\/\//, "")}
                      </a>
                    ) : (
                      <button onClick={() => setEditingField("website")} className="text-muted-foreground/50 hover:text-muted-foreground text-sm">Website hinzufügen...</button>
                    )}
                  </div>

                  {/* Source */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Quelle:</span>
                    <Select value={lead.source || ""} onValueChange={v => { setLead(p => p ? { ...p, source: v } : p); saveField("source", v); }}>
                      <SelectTrigger className="h-6 w-auto gap-1 px-2 border-none bg-transparent text-xs">
                        <SelectValue placeholder="Quelle wählen..." />
                      </SelectTrigger>
                      <SelectContent>
                        {SOURCE_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Notes / Description */}
                  <div>
                    {editingField === "notes" ? (
                      <Textarea
                        autoFocus
                        value={lead.notes || ""}
                        onChange={e => setLead(p => p ? { ...p, notes: e.target.value } : p)}
                        onBlur={() => { saveField("notes", lead.notes); }}
                        rows={3}
                        className="bg-[#1E1E24] border-[#3A3A44] text-sm"
                        placeholder="Beschreibung..."
                      />
                    ) : (
                      <button
                        onClick={() => setEditingField("notes")}
                        className="text-sm text-left w-full"
                      >
                        {lead.notes ? (
                          <span className="text-[#FAFBFF]/70 whitespace-pre-wrap">{lead.notes}</span>
                        ) : (
                          <span className="text-muted-foreground/50 hover:text-muted-foreground">Beschreibung hinzufügen...</span>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* OPPORTUNITIES section */}
            <div className="border-b border-[#3A3A44]">
              <button
                onClick={() => setOppsOpen(!oppsOpen)}
                className="flex items-center gap-2 w-full px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#FAFBFF]/50 hover:text-[#FAFBFF]/70 transition-colors"
              >
                {oppsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                <Lightbulb className="h-3 w-3" />
                Opportunities
                <span className="ml-1 text-[10px] text-muted-foreground">{opportunities.length}</span>
              </button>
              {oppsOpen && (
                <div className="px-4 pb-4 space-y-2">
                  {opportunities.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Keine Opportunities</p>
                  ) : opportunities.map(opp => (
                    <div key={opp.id} className="flex items-start gap-2.5 rounded-lg bg-[#2A2A32] p-3 border border-[#3A3A44]">
                      <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: opp.stage_color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-semibold text-[#FAFBFF]">€{opp.value.toLocaleString("de-DE")}</span>
                          <span className="text-[10px] text-muted-foreground">{opp.win_probability}%</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#3A3A44] text-[#FAFBFF]/70 truncate">{opp.pipeline_name}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium truncate" style={{ backgroundColor: opp.stage_color + "22", color: opp.stage_color }}>
                            {opp.stage_name}
                          </span>
                        </div>
                        {opp.note && <p className="text-[11px] text-[#FAFBFF]/50 mt-1.5">{opp.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CONTACT section */}
            <div className="border-b border-[#3A3A44]">
              <button
                onClick={() => setContactOpen(!contactOpen)}
                className="flex items-center gap-2 w-full px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#FAFBFF]/50 hover:text-[#FAFBFF]/70 transition-colors"
              >
                {contactOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                <Users2 className="h-3 w-3" />
                Kontakt
              </button>
              {contactOpen && (
                <div className="px-4 pb-4 space-y-3">
                  {/* Contact name */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center h-7 w-7 rounded-full bg-[#3A3A44] text-[10px] font-bold text-[#FAFBFF]">
                        {(lead.contact_name || "?")[0]?.toUpperCase()}
                      </div>
                      {editingField === "contact_name" ? (
                        <Input
                          autoFocus
                          value={lead.contact_name || ""}
                          onChange={e => setLead(p => p ? { ...p, contact_name: e.target.value } : p)}
                          onBlur={() => saveField("contact_name", lead.contact_name)}
                          onKeyDown={e => e.key === "Enter" && saveField("contact_name", lead.contact_name)}
                          className="h-7 bg-[#1E1E24] border-[#3A3A44] text-sm w-40"
                        />
                      ) : (
                        <button onClick={() => setEditingField("contact_name")} className="text-sm font-medium text-[#FAFBFF] hover:text-primary transition-colors">
                          {lead.contact_name || "Name hinzufügen..."}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {lead.contact_email && (
                        <a href={`mailto:${lead.contact_email}`} className="flex items-center justify-center h-7 w-7 rounded hover:bg-[#3A3A44] text-muted-foreground hover:text-[#FAFBFF] transition-colors">
                          <Mail className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {lead.contact_phone && (
                        <a href={`tel:${lead.contact_phone}`} className="flex items-center justify-center h-7 w-7 rounded hover:bg-[#3A3A44] text-muted-foreground hover:text-[#FAFBFF] transition-colors">
                          <Phone className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Email */}
                  <div className="flex items-center gap-2 pl-9">
                    <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                    {editingField === "contact_email" ? (
                      <Input
                        autoFocus
                        value={lead.contact_email || ""}
                        onChange={e => setLead(p => p ? { ...p, contact_email: e.target.value } : p)}
                        onBlur={() => saveField("contact_email", lead.contact_email)}
                        onKeyDown={e => e.key === "Enter" && saveField("contact_email", lead.contact_email)}
                        className="h-6 bg-[#1E1E24] border-[#3A3A44] text-xs w-48"
                      />
                    ) : (
                      <button onClick={() => setEditingField("contact_email")} className="text-xs text-[#FAFBFF]/60 hover:text-[#FAFBFF] transition-colors">
                        {lead.contact_email || "Email hinzufügen..."}
                      </button>
                    )}
                  </div>

                  {/* Phone */}
                  <div className="flex items-center gap-2 pl-9">
                    <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                    {editingField === "contact_phone" ? (
                      <Input
                        autoFocus
                        value={lead.contact_phone || ""}
                        onChange={e => setLead(p => p ? { ...p, contact_phone: e.target.value } : p)}
                        onBlur={() => saveField("contact_phone", lead.contact_phone)}
                        onKeyDown={e => e.key === "Enter" && saveField("contact_phone", lead.contact_phone)}
                        className="h-6 bg-[#1E1E24] border-[#3A3A44] text-xs w-48"
                      />
                    ) : (
                      <button onClick={() => setEditingField("contact_phone")} className="text-xs text-[#FAFBFF]/60 hover:text-[#FAFBFF] transition-colors">
                        {lead.contact_phone || "Telefon hinzufügen..."}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANEL – Activity Timeline */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Timeline filters */}
            <div className="flex items-center justify-between px-5 py-2.5 border-b border-[#3A3A44] shrink-0">
              <div className="flex items-center gap-1">
                {TIMELINE_FILTERS.map(f => (
                  <button
                    key={f}
                    onClick={() => setTimelineFilter(f)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      timelineFilter === f
                        ? "bg-primary/15 text-primary"
                        : "text-[#FAFBFF]/50 hover:text-[#FAFBFF]/80 hover:bg-[#2A2A32]"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input
                    placeholder="Suchen..."
                    value={timelineSearch}
                    onChange={e => setTimelineSearch(e.target.value)}
                    className="h-7 w-48 pl-7 text-xs bg-transparent border-[#3A3A44]"
                  />
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="flex-1 overflow-y-auto px-5 py-3">
              <div className="relative">
                {filteredActivities.length > 0 && (
                  <div className="absolute left-[15px] top-4 bottom-4 w-px bg-[#3A3A44]" />
                )}
                <div className="space-y-0">
                  {filteredActivities.length === 0 ? (
                    <p className="text-center text-muted-foreground py-12 text-sm">Noch keine Einträge</p>
                  ) : filteredActivities.map(act => {
                    const config = ACTIVITY_ICON_MAP[act.type] || ACTIVITY_ICON_MAP.note;
                    const Icon = config.icon;
                    return (
                      <div key={act.id} className="flex gap-3.5 py-3 relative group">
                        <div className="relative z-10 flex items-center justify-center h-[30px] w-[30px] rounded-full bg-[#1E1E24] border border-[#3A3A44] shrink-0">
                          <Icon className="h-3.5 w-3.5" style={{ color: config.color }} />
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="text-sm font-medium text-[#FAFBFF]">{act.title}</p>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {new Date(act.created_at).toLocaleDateString("de-DE", { day: "numeric", month: "short" })}
                            </span>
                          </div>
                          {act.body && (
                            <p className="text-xs text-[#FAFBFF]/50 mt-1 whitespace-pre-wrap leading-relaxed">{act.body}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add activity dialog */}
      <Dialog open={showActivity} onOpenChange={setShowActivity}>
        <DialogContent className="bg-[#2A2A32] border-[#3A3A44] text-[#FAFBFF]">
          <DialogHeader>
            <DialogTitle>
              {ACTIVITY_TYPES.find(t => t.value === activityType)?.label || "Eintrag"} hinzufügen
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Titel *" value={activityTitle} onChange={e => setActivityTitle(e.target.value)} className="bg-[#1E1E24] border-[#3A3A44]" onKeyDown={e => e.key === "Enter" && !e.shiftKey && addActivity()} />
            <Textarea placeholder="Details (optional)" value={activityBody} onChange={e => setActivityBody(e.target.value)} rows={3} className="bg-[#1E1E24] border-[#3A3A44]" />
            <Button onClick={addActivity} className="w-full">Hinzufügen</Button>
          </div>
        </DialogContent>
      </Dialog>
    </CRMLayout>
  );
}
