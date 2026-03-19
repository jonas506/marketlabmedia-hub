import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, StickyNote, Phone, Mail, Users2, Globe, Save } from "lucide-react";
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
  { value: "call", label: "Anruf", icon: Phone, color: "#22C55E" },
  { value: "email", label: "Email", icon: Mail, color: "#0083F7" },
  { value: "sms", label: "Meeting", icon: Users2, color: "#8B5CF6" },
] as const;

interface LeadData {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  notes: string | null;
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

export default function CRMLeadDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [lead, setLead] = useState<LeadData | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [showActivity, setShowActivity] = useState(false);
  const [activityType, setActivityType] = useState<string>("note");
  const [activityTitle, setActivityTitle] = useState("");
  const [activityBody, setActivityBody] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchLead = async () => {
    if (!id) return;
    const [{ data: leadData }, { data: actData }, { data: statusData }] = await Promise.all([
      supabase.from("crm_leads").select("*").eq("id", id).single(),
      supabase.from("crm_activities").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
      supabase.from("crm_lead_statuses").select("*").order("sort_order"),
    ]);
    if (leadData) setLead(leadData as any);
    setActivities((actData || []) as any[]);
    setStatuses(statusData || []);
  };

  useEffect(() => { fetchLead(); }, [id]);

  const updateField = async (field: string, value: any) => {
    if (!id) return;
    setLead(prev => prev ? { ...prev, [field]: value } : prev);
    await supabase.from("crm_leads").update({ [field]: value }).eq("id", id);
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

  if (!lead) return <CRMLayout><div className="flex items-center justify-center h-64 text-muted-foreground">Laden...</div></CRMLayout>;

  const currentStatus = statuses.find(s => s.id === lead.status_id);

  return (
    <CRMLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link to="/crm" className="text-muted-foreground hover:text-[#FAFBFF] transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-bold text-[#FAFBFF] font-[Manrope]">{lead.name}</h1>
          {currentStatus && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: currentStatus.color + "22", color: currentStatus.color }}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: currentStatus.color }} />
              {currentStatus.name}
            </span>
          )}
          {lead.source && (
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${SOURCE_COLORS[lead.source] || ""}`}>
              {SOURCE_OPTIONS.find(s => s.value === lead.source)?.label || lead.source}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6">
          {/* Left: Lead info */}
          <div className="space-y-4">
            <div className="rounded-lg border border-[#3A3A44] bg-[#2A2A32] p-4 space-y-3">
              <h2 className="text-sm font-semibold text-[#FAFBFF]/70 uppercase tracking-wider">Stammdaten</h2>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Firmenname</label>
                <Input value={lead.name} onChange={e => setLead(p => p ? { ...p, name: e.target.value } : p)} className="bg-[#1E1E24] border-[#3A3A44]" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Ansprechpartner</label>
                  <Input value={lead.contact_name || ""} onChange={e => setLead(p => p ? { ...p, contact_name: e.target.value } : p)} className="bg-[#1E1E24] border-[#3A3A44]" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Email</label>
                  <Input value={lead.contact_email || ""} onChange={e => setLead(p => p ? { ...p, contact_email: e.target.value } : p)} className="bg-[#1E1E24] border-[#3A3A44]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Telefon</label>
                  <Input value={lead.contact_phone || ""} onChange={e => setLead(p => p ? { ...p, contact_phone: e.target.value } : p)} className="bg-[#1E1E24] border-[#3A3A44]" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Website</label>
                  <Input value={lead.website || ""} onChange={e => setLead(p => p ? { ...p, website: e.target.value } : p)} className="bg-[#1E1E24] border-[#3A3A44]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Quelle</label>
                  <Select value={lead.source || ""} onValueChange={v => setLead(p => p ? { ...p, source: v } : p)}>
                    <SelectTrigger className="bg-[#1E1E24] border-[#3A3A44]"><SelectValue placeholder="Quelle" /></SelectTrigger>
                    <SelectContent>
                      {SOURCE_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Status</label>
                  <Select value={lead.status_id || ""} onValueChange={v => setLead(p => p ? { ...p, status_id: v } : p)}>
                    <SelectTrigger className="bg-[#1E1E24] border-[#3A3A44]"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      {statuses.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Notizen</label>
                <Textarea value={lead.notes || ""} onChange={e => setLead(p => p ? { ...p, notes: e.target.value } : p)} rows={4} className="bg-[#1E1E24] border-[#3A3A44]" />
              </div>
              <Button onClick={saveLead} disabled={saving} size="sm" className="gap-1.5">
                <Save className="h-3.5 w-3.5" /> {saving ? "Speichern..." : "Speichern"}
              </Button>
            </div>
          </div>

          {/* Right: Activity timeline */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#FAFBFF]/70 uppercase tracking-wider">Kontakt-Chronik</h2>
              <div className="flex gap-1.5">
                {ACTIVITY_TYPES.map(t => (
                  <Button
                    key={t.value}
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs border-[#3A3A44] hover:bg-[#3A3A44]"
                    onClick={() => { setActivityType(t.value); setShowActivity(true); }}
                  >
                    <t.icon className="h-3 w-3" style={{ color: t.color }} />
                    {t.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="relative">
              {/* Vertical line */}
              {activities.length > 0 && (
                <div className="absolute left-[15px] top-3 bottom-3 w-px bg-[#3A3A44]" />
              )}
              <div className="space-y-0">
                {activities.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">Noch keine Einträge</p>
                ) : activities.map(act => {
                  const config = ACTIVITY_TYPES.find(t => t.value === act.type) || ACTIVITY_TYPES[0];
                  const Icon = config.icon;
                  return (
                    <div key={act.id} className="flex gap-3 py-3 relative">
                      <div className="relative z-10 flex items-center justify-center h-[30px] w-[30px] rounded-full bg-[#2A2A32] border border-[#3A3A44] shrink-0">
                        <Icon className="h-3.5 w-3.5" style={{ color: config.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-sm font-medium text-[#FAFBFF]">{act.title}</p>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {new Date(act.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        {act.body && <p className="text-xs text-[#FAFBFF]/60 mt-0.5 whitespace-pre-wrap">{act.body}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showActivity} onOpenChange={setShowActivity}>
        <DialogContent className="bg-[#2A2A32] border-[#3A3A44] text-[#FAFBFF]">
          <DialogHeader>
            <DialogTitle>
              {ACTIVITY_TYPES.find(t => t.value === activityType)?.label || "Eintrag"} hinzufügen
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Titel *" value={activityTitle} onChange={e => setActivityTitle(e.target.value)} className="bg-[#1E1E24] border-[#3A3A44]" />
            <Textarea placeholder="Details (optional)" value={activityBody} onChange={e => setActivityBody(e.target.value)} rows={3} className="bg-[#1E1E24] border-[#3A3A44]" />
            <Button onClick={addActivity} className="w-full">Hinzufügen</Button>
          </div>
        </DialogContent>
      </Dialog>
    </CRMLayout>
  );
}
