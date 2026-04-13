import { useState, useEffect, useCallback, useRef } from "react";
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
import {
  ArrowLeft, StickyNote, Phone, Mail, Users2, Globe,
  ChevronDown, ChevronRight, Plus, DollarSign,
  Search, CheckSquare, CalendarIcon, Clock,
  Sparkles, Upload, Link2, Loader2, AlertTriangle,
  Paperclip, FileText, Image, Trash2, X,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import { CRM_STAGES, getStageLabel, getStageColor, getSourceInfo } from "@/lib/crm-constants";
import { useQuery } from "@tanstack/react-query";

const ACTIVITY_TYPES = [
  { value: "note", label: "Notiz", icon: StickyNote, color: "#F59E0B" },
  { value: "call", label: "Anruf", icon: Phone, color: "#22C55E" },
  { value: "email", label: "Email", icon: Mail, color: "#0083F7" },
  { value: "sms", label: "Meeting", icon: Users2, color: "#8B5CF6" },
] as const;

const ACTIVITY_ICON_MAP: Record<string, { icon: typeof StickyNote; color: string }> = {
  note: { icon: StickyNote, color: "#F59E0B" },
  call: { icon: Phone, color: "#22C55E" },
  email: { icon: Mail, color: "#0083F7" },
  sms: { icon: Users2, color: "#8B5CF6" },
  status_change: { icon: StickyNote, color: "#F59E0B" },
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
  stage: string;
  deal_value: number | null;
  next_step: string | null;
  next_step_date: string | null;
  instagram_handle: string | null;
  linkedin_url: string | null;
  ai_summary: string | null;
}

interface Activity {
  id: string;
  type: string;
  title: string;
  body: string | null;
  created_at: string;
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
  const [showActivity, setShowActivity] = useState(false);
  const [activityType, setActivityType] = useState<string>("note");
  const [activityTitle, setActivityTitle] = useState("");
  const [activityBody, setActivityBody] = useState("");
  const [editingField, setEditingField] = useState<string | null>(null);
  const [timelineFilter, setTimelineFilter] = useState<string>("Alle");
  const [timelineSearch, setTimelineSearch] = useState("");

  const [contactOpen, setContactOpen] = useState(true);
  const [tasksOpen, setTasksOpen] = useState(true);
  const [smartImportOpen, setSmartImportOpen] = useState(false);

  const [crmTasks, setCrmTasks] = useState<CrmTask[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDate, setNewTaskDate] = useState<Date | undefined>();
  const [newTaskTime, setNewTaskTime] = useState("");

  const [importUrl, setImportUrl] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [showLinkedInHint, setShowLinkedInHint] = useState(false);

  // Files
  const [filesOpen, setFilesOpen] = useState(true);
  const [leadFiles, setLeadFiles] = useState<any[]>([]);
  const [fileUploading, setFileUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [importDragOver, setImportDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchLead = async () => {
    if (!id) return;
    const [{ data: leadData }, { data: actData }, { data: taskData }, { data: fileData }] = await Promise.all([
      supabase.from("crm_leads").select("*").eq("id", id).single(),
      supabase.from("crm_activities").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
      supabase.from("crm_tasks").select("*").eq("lead_id", id).order("is_completed").order("due_date", { ascending: true, nullsFirst: false }),
      supabase.from("crm_files").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
    ]);
    if (leadData) setLead(leadData as any);
    setActivities((actData || []) as any[]);
    setCrmTasks((taskData || []) as any[]);
    setLeadFiles((fileData || []) as any[]);
  };

  useEffect(() => { fetchLead(); }, [id]);

  // File upload handler
  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    if (!id || !user || files.length === 0) return;
    setFileUploading(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "";
        const storagePath = `${id}/${Date.now()}-${file.name}`;
        const { error: uploadErr } = await supabase.storage.from("crm-files").upload(storagePath, file);
        if (uploadErr) { toast.error(`Upload fehlgeschlagen: ${file.name}`); continue; }
        const { data: urlData } = supabase.storage.from("crm-files").getPublicUrl(storagePath);
        await supabase.from("crm_files").insert({
          lead_id: id,
          name: file.name,
          file_url: urlData.publicUrl,
          mime_type: file.type || "application/octet-stream",
          file_size: file.size,
          uploaded_by: user.id,
        });
      }
      toast.success(`${files.length === 1 ? "Datei" : `${files.length} Dateien`} hochgeladen`);
      fetchLead();
    } catch (err: any) {
      toast.error(err.message || "Upload fehlgeschlagen");
    } finally {
      setFileUploading(false);
    }
  }, [id, user]);

  const deleteFile = async (fileId: string, fileUrl: string) => {
    // Extract storage path from URL
    const pathMatch = fileUrl.split("/crm-files/")[1];
    if (pathMatch) {
      await supabase.storage.from("crm-files").remove([decodeURIComponent(pathMatch)]);
    }
    await supabase.from("crm_files").delete().eq("id", fileId);
    setLeadFiles(prev => prev.filter(f => f.id !== fileId));
    toast.success("Datei gelöscht");
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files);
  }, [uploadFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const { data: sourceTags = [] } = useQuery({
    queryKey: ["crm-source-tags"],
    queryFn: async () => {
      const { data } = await supabase.from("crm_source_tags").select("*").order("name");
      return data ?? [];
    },
  });

  const saveField = async (field: string, value: any) => {
    if (!id) return;
    await supabase.from("crm_leads").update({ [field]: value } as any).eq("id", id);
    setEditingField(null);
  };

  const addActivity = async () => {
    if (!activityTitle.trim() || !id || !user) return;
    const { error } = await supabase.from("crm_activities").insert({
      lead_id: id, type: activityType as any, title: activityTitle,
      body: activityBody || null, created_by: user.id,
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
      lead_id: id, title: newTaskTitle,
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
      is_completed: completed, completed_at: completed ? new Date().toISOString() : null,
    }).eq("id", task.id);
    fetchLead();
  };

  // Smart Import handlers
  const isLinkedInUrl = (url: string) => /linkedin\.com/i.test(url);

  const handleUrlImport = async () => {
    if (!importUrl.trim() || !id || !user) return;
    if (isLinkedInUrl(importUrl)) {
      toast.info("LinkedIn kann nicht gescrapt werden. Lade das Profil als PDF herunter.", { duration: 6000 });
      setShowLinkedInHint(true);
      return;
    }
    setImportLoading(true);
    setImportResult(null);
    try {
      const { data: scrapeData, error: scrapeErr } = await supabase.functions.invoke("firecrawl-scrape", {
        body: { url: importUrl, options: { formats: ["markdown"], onlyMainContent: true } },
      });
      if (scrapeErr) throw new Error(scrapeErr.message);
      const markdown = scrapeData?.data?.markdown || scrapeData?.markdown || "";
      if (!markdown) throw new Error("Keine Inhalte gefunden");

      const { data: aiResult, error: aiErr } = await supabase.functions.invoke("crm-smart-import", {
        body: { content: markdown, lead_name: lead?.name, source_type: "url" },
      });
      if (aiErr) throw new Error(aiErr.message);
      setImportResult(aiResult);

      if (aiResult.contact_info) {
        const ci = aiResult.contact_info;
        const updates: any = {};
        if (ci.name && !lead?.contact_name) updates.contact_name = ci.name;
        if (ci.email && !lead?.contact_email) updates.contact_email = ci.email;
        if (ci.phone && !lead?.contact_phone) updates.contact_phone = ci.phone;
        if (ci.website && !lead?.website) updates.website = ci.website;
        if (Object.keys(updates).length > 0) {
          await supabase.from("crm_leads").update(updates).eq("id", id);
          setLead(p => p ? { ...p, ...updates } : p);
        }
      }

      await supabase.from("crm_activities").insert({
        lead_id: id, type: "note" as any,
        title: `🔗 Website analysiert: ${importUrl}`,
        body: aiResult.summary + (aiResult.key_points?.length ? "\n\n**Wichtige Punkte:**\n" + aiResult.key_points.map((p: string) => `• ${p}`).join("\n") : ""),
        created_by: user.id,
      });
      toast.success("Website analysiert & importiert");
      setImportUrl("");
      fetchLead();
    } catch (err: any) {
      toast.error(err.message || "Import fehlgeschlagen");
    } finally {
      setImportLoading(false);
    }
  };

  const extractPdfText = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((item: any) => item.str).join(" "));
    }
    return pages.join("\n\n");
  };

  const handlePdfImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id || !user) return;
    setImportLoading(true);
    setImportResult(null);
    try {
      // If it's an image, upload to storage + log activity
      if (file.type.startsWith("image/")) {
        const storagePath = `${id}/${Date.now()}-${file.name}`;
        const { error: uploadErr } = await supabase.storage.from("crm-files").upload(storagePath, file);
        if (uploadErr) throw new Error(uploadErr.message);
        const { data: urlData } = supabase.storage.from("crm-files").getPublicUrl(storagePath);
        await supabase.from("crm_files").insert({
          lead_id: id, name: file.name, file_url: urlData.publicUrl,
          mime_type: file.type, file_size: file.size, uploaded_by: user.id,
        });
        await supabase.from("crm_activities").insert({
          lead_id: id, type: "note" as any,
          title: `🖼️ Bild hochgeladen: ${file.name}`,
          body: null, created_by: user.id,
        });
        toast.success("Bild hochgeladen");
        fetchLead();
        return;
      }

      let text: string;
      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        text = await extractPdfText(file);
      } else {
        text = await file.text();
      }
      if (!text.trim()) throw new Error("Dokument ist leer");

      const { data: aiResult, error: aiErr } = await supabase.functions.invoke("crm-smart-import", {
        body: { content: text, lead_name: lead?.name, source_type: "pdf" },
      });
      if (aiErr) throw new Error(aiErr.message);
      setImportResult(aiResult);

      if (aiResult.contact_info) {
        const ci = aiResult.contact_info;
        const updates: any = {};
        if (ci.name && !lead?.contact_name) updates.contact_name = ci.name;
        if (ci.email && !lead?.contact_email) updates.contact_email = ci.email;
        if (ci.phone && !lead?.contact_phone) updates.contact_phone = ci.phone;
        if (ci.website && !lead?.website) updates.website = ci.website;
        if (Object.keys(updates).length > 0) {
          await supabase.from("crm_leads").update(updates).eq("id", id);
          setLead(p => p ? { ...p, ...updates } : p);
        }
      }

      await supabase.from("crm_activities").insert({
        lead_id: id, type: "note" as any,
        title: `📄 Dokument analysiert: ${file.name}`,
        body: aiResult.summary + (aiResult.key_points?.length ? "\n\n**Wichtige Punkte:**\n" + aiResult.key_points.map((p: string) => `• ${p}`).join("\n") : ""),
        created_by: user.id,
      });
      setShowLinkedInHint(false);
      toast.success("Dokument analysiert");
      fetchLead();
    } catch (err: any) {
      toast.error(err.message || "Import fehlgeschlagen");
    } finally {
      setImportLoading(false);
      if (e.target?.value !== undefined) e.target.value = "";
    }
  };

  const createTasksFromResult = async (nextSteps: string[]) => {
    if (!id || !user) return;
    for (const step of nextSteps) {
      await supabase.from("crm_tasks").insert({ lead_id: id, title: step, assigned_to: user.id } as any);
    }
    toast.success(`${nextSteps.length} Aufgabe(n) erstellt`);
    setImportResult(null);
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

  if (!lead) return (
    <AppLayout>
      <div className="flex items-center justify-center h-64 text-muted-foreground">Laden...</div>
    </AppLayout>
  );

  const stageColor = getStageColor(lead.stage);
  const sourceInfo = getSourceInfo(lead.source);

  return (
    <AppLayout>
      <ErrorBoundary level="section">
        <div className="flex flex-col h-[calc(100vh-48px)] -m-6">
          {/* Top bar */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card shrink-0">
            <div className="flex items-center gap-3">
              <Link to="/crm" className="text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="h-4 w-4" />
              </Link>
              
              {/* Name – click to edit */}
              {editingField === "name" ? (
                <Input
                  autoFocus
                  value={lead.name}
                  onChange={e => setLead(p => p ? { ...p, name: e.target.value } : p)}
                  onBlur={() => saveField("name", lead.name)}
                  onKeyDown={e => e.key === "Enter" && saveField("name", lead.name)}
                  className="h-8 text-lg font-bold w-64 bg-background border-border"
                />
              ) : (
                <button onClick={() => setEditingField("name")} className="text-lg font-bold text-foreground hover:text-primary transition-colors">
                  {lead.name}
                </button>
              )}

              {/* Stage */}
              <Select
                value={lead.stage}
                onValueChange={v => {
                  setLead(p => p ? { ...p, stage: v } : p);
                  saveField("stage", v);
                }}
              >
                <SelectTrigger
                  className="h-7 w-auto gap-1.5 px-2.5 border-border bg-transparent text-xs font-medium"
                  style={{ color: stageColor, borderColor: stageColor + "44" }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stageColor }} />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CRM_STAGES.map(s => (
                    <SelectItem key={s.value} value={s.value}>
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                        {s.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {sourceInfo && (
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${sourceInfo.color}`}>
                  {sourceInfo.label}
                </span>
              )}
            </div>

            {/* Quick-add activity buttons */}
            <div className="flex items-center gap-1.5">
              {ACTIVITY_TYPES.map(t => (
                <Button
                  key={t.value}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-8 text-xs border-border bg-transparent"
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
            <div className="w-[340px] shrink-0 border-r border-border overflow-y-auto bg-card/50">

              {/* KONTAKT + INFO – always visible */}
              <div className="border-b border-border">
                <button
                  onClick={() => setContactOpen(!contactOpen)}
                  className="flex items-center gap-2 w-full px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                >
                  {contactOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  <Users2 className="h-3 w-3" />
                  Info & Kontakt
                </button>
                {contactOpen && (
                  <div className="px-4 pb-4 space-y-2.5">
                    {/* Inline-editable fields */}
                    {[
                      { field: "contact_name", icon: Users2, label: "Ansprechpartner", value: lead.contact_name },
                      { field: "contact_email", icon: Mail, label: "Email", value: lead.contact_email },
                      { field: "contact_phone", icon: Phone, label: "Telefon", value: lead.contact_phone },
                      { field: "website", icon: Globe, label: "Website", value: lead.website },
                    ].map(({ field, icon: Icon, label, value }) => (
                      <div key={field} className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        {editingField === field ? (
                          <Input
                            autoFocus
                            value={value || ""}
                            onChange={e => setLead(p => p ? { ...p, [field]: e.target.value } : p)}
                            onBlur={() => saveField(field, (lead as any)[field])}
                            onKeyDown={e => e.key === "Enter" && saveField(field, (lead as any)[field])}
                            className="h-6 bg-background border-border text-xs flex-1"
                          />
                        ) : (
                          <button onClick={() => setEditingField(field)} className="text-xs text-foreground/60 hover:text-foreground transition-colors truncate text-left">
                            {value || <span className="text-muted-foreground/50">{label}...</span>}
                          </button>
                        )}
                      </div>
                    ))}

                    {/* Deal value */}
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      {editingField === "deal_value" ? (
                        <Input
                          autoFocus
                          type="number"
                          value={lead.deal_value ?? ""}
                          onChange={e => setLead(p => p ? { ...p, deal_value: e.target.value ? Number(e.target.value) : null } : p)}
                          onBlur={() => saveField("deal_value", lead.deal_value)}
                          onKeyDown={e => e.key === "Enter" && saveField("deal_value", lead.deal_value)}
                          className="h-6 bg-background border-border text-xs flex-1 w-24"
                          placeholder="0"
                        />
                      ) : (
                        <button onClick={() => setEditingField("deal_value")} className="text-xs text-foreground/60 hover:text-foreground transition-colors">
                          {lead.deal_value ? `${Number(lead.deal_value).toLocaleString("de-DE")} €` : <span className="text-muted-foreground/50">Deal-Wert…</span>}
                        </button>
                      )}
                    </div>

                    {/* Source */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">Quelle:</span>
                      <Select value={lead.source || ""} onValueChange={v => { setLead(p => p ? { ...p, source: v } : p); saveField("source", v); }}>
                        <SelectTrigger className="h-6 w-auto gap-1 px-2 border-none bg-transparent text-xs">
                          <SelectValue placeholder="Wählen..." />
                        </SelectTrigger>
                        <SelectContent>
                          {sourceTags.map(s => (
                            <SelectItem key={s.id} value={s.name}>
                              <span className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: s.color }} />
                                {s.name}
                              </span>
                            </SelectItem>
                          ))}
                          {sourceTags.length === 0 && (
                            <div className="px-3 py-2 text-xs text-muted-foreground">Noch keine Quellen erstellt</div>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Notes */}
                    <div className="pt-1">
                      {editingField === "notes" ? (
                        <Textarea
                          autoFocus
                          value={lead.notes || ""}
                          onChange={e => setLead(p => p ? { ...p, notes: e.target.value } : p)}
                          onBlur={() => saveField("notes", lead.notes)}
                          rows={3}
                          className="bg-background border-border text-sm"
                          placeholder="Notizen..."
                        />
                      ) : (
                        <button onClick={() => setEditingField("notes")} className="text-sm text-left w-full">
                          {lead.notes ? (
                            <span className="text-foreground/70 whitespace-pre-wrap">{lead.notes}</span>
                          ) : (
                            <span className="text-muted-foreground/50 hover:text-muted-foreground">Notizen hinzufügen...</span>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* TO-DOS */}
              <div className="border-b border-border">
                <button
                  onClick={() => setTasksOpen(!tasksOpen)}
                  className="flex items-center gap-2 w-full px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                >
                  {tasksOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  <CheckSquare className="h-3 w-3" />
                  To-Dos
                  <span className="ml-1 text-[10px] text-muted-foreground">{crmTasks.filter(t => !t.is_completed).length}</span>
                </button>
                {tasksOpen && (
                  <div className="px-4 pb-4 space-y-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Follow up, Anrufen..."
                        value={newTaskTitle}
                        onChange={e => setNewTaskTitle(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && addCrmTask()}
                        className="h-7 text-xs bg-background border-border flex-1"
                      />
                      <Button size="sm" className="h-7 px-2 text-xs" onClick={addCrmTask} disabled={!newTaskTitle.trim()}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className={cn("h-7 gap-1.5 text-xs border-border bg-transparent", !newTaskDate && "text-muted-foreground")}>
                            <CalendarIcon className="h-3 w-3" />
                            {newTaskDate ? format(newTaskDate, "dd.MM.yyyy") : "Datum"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={newTaskDate} onSelect={setNewTaskDate} initialFocus className="p-3 pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                      <div className="relative">
                        <Clock className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                        <Input
                          type="time"
                          value={newTaskTime}
                          onChange={e => setNewTaskTime(e.target.value)}
                          className="h-7 w-24 pl-7 text-xs bg-background border-border"
                        />
                      </div>
                    </div>

                    {crmTasks.map(task => {
                      const today = new Date().toISOString().split("T")[0];
                      const isOverdue = task.due_date && !task.is_completed && task.due_date < today;
                      return (
                        <div key={task.id} className={cn("flex items-center gap-2 py-1.5", task.is_completed && "opacity-40")}>
                          <Checkbox checked={task.is_completed} onCheckedChange={() => toggleCrmTask(task)} className="shrink-0" />
                          <span className={cn("flex-1 text-xs truncate", task.is_completed && "line-through text-muted-foreground")}>{task.title}</span>
                          {task.due_date && (
                            <span className={cn("text-[10px] font-mono shrink-0", isOverdue ? "text-destructive font-semibold" : "text-muted-foreground")}>
                              {format(new Date(task.due_date), "dd.MM")}
                              {task.due_time && ` ${task.due_time.slice(0, 5)}`}
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {crmTasks.length === 0 && <p className="text-xs text-muted-foreground">Keine To-Dos</p>}
                  </div>
                )}
              </div>

              {/* DATEIEN – drag & drop */}
              <div className="border-b border-border">
                <button
                  onClick={() => setFilesOpen(!filesOpen)}
                  className="flex items-center gap-2 w-full px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                >
                  {filesOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  <Paperclip className="h-3 w-3" />
                  Dateien
                  <span className="ml-1 text-[10px] text-muted-foreground">{leadFiles.length}</span>
                </button>
                {filesOpen && (
                  <div className="px-4 pb-4 space-y-2">
                    {/* Drop zone */}
                    <div
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onClick={() => fileInputRef.current?.click()}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed py-5 cursor-pointer transition-all",
                        dragOver
                          ? "border-primary bg-primary/10 scale-[1.02]"
                          : "border-border hover:border-muted-foreground/40 hover:bg-muted/30"
                      )}
                    >
                      {fileUploading ? (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      ) : (
                        <Upload className="h-5 w-5 text-muted-foreground" />
                      )}
                      <span className="text-xs text-muted-foreground">
                        {fileUploading ? "Lädt hoch..." : dragOver ? "Loslassen zum Hochladen" : "Dateien hierher ziehen oder klicken"}
                      </span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.md,.pptx"
                        className="hidden"
                        onChange={e => {
                          if (e.target.files) uploadFiles(e.target.files);
                          e.target.value = "";
                        }}
                      />
                    </div>

                    {/* File list */}
                    {leadFiles.map(file => {
                      const isImage = file.mime_type?.startsWith("image/");
                      return (
                        <div key={file.id} className="flex items-center gap-2 group rounded-md px-2 py-1.5 hover:bg-muted/30 transition-colors">
                          {isImage ? (
                            <Image className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                          ) : (
                            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          )}
                          <a
                            href={file.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 text-xs truncate text-foreground/70 hover:text-foreground transition-colors"
                          >
                            {file.name}
                          </a>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {file.file_size > 1048576
                              ? `${(file.file_size / 1048576).toFixed(1)} MB`
                              : `${Math.round(file.file_size / 1024)} KB`}
                          </span>
                          <button
                            onClick={() => deleteFile(file.id, file.file_url)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                          </button>
                        </div>
                      );
                    })}
                    {leadFiles.length === 0 && !fileUploading && (
                      <p className="text-xs text-muted-foreground text-center">Keine Dateien</p>
                    )}
                  </div>
                )}
              </div>

              <div className="border-b border-border">
                <button
                  onClick={() => setSmartImportOpen(!smartImportOpen)}
                  className="flex items-center gap-2 w-full px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                >
                  {smartImportOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  <Sparkles className="h-3 w-3" />
                  Smart Import
                </button>
                {smartImportOpen && (
                  <div className="px-4 pb-4 space-y-3">
                    <div className="flex gap-1.5">
                      <div className="relative flex-1">
                        <Link2 className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                        <Input
                          placeholder="https://beispiel.de"
                          value={importUrl}
                          onChange={e => setImportUrl(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && handleUrlImport()}
                          className="h-8 pl-7 text-xs bg-background border-border"
                          disabled={importLoading}
                        />
                      </div>
                      <Button size="sm" className="h-8 px-2.5 text-xs gap-1" onClick={handleUrlImport} disabled={importLoading || !importUrl.trim()}>
                        {importLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                        Go
                      </Button>
                    </div>

                    {showLinkedInHint && (
                      <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 p-2.5 text-xs text-amber-300">
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <p>LinkedIn → "Als PDF speichern" → hier hochladen ↓</p>
                      </div>
                    )}

                    <div
                      className={cn(
                        "relative rounded-lg border-2 border-dashed py-3 transition-all",
                        importDragOver
                          ? "border-primary bg-primary/10 scale-[1.02]"
                          : "border-border hover:bg-muted/50"
                      )}
                      onDrop={e => {
                        e.preventDefault();
                        setImportDragOver(false);
                        if (e.dataTransfer.files?.[0]) {
                          const fakeEvent = { target: { files: e.dataTransfer.files, value: "" } } as any;
                          handlePdfImport(fakeEvent);
                        }
                      }}
                      onDragOver={e => { e.preventDefault(); setImportDragOver(true); }}
                      onDragLeave={e => { e.preventDefault(); setImportDragOver(false); }}
                    >
                      <input type="file" accept="image/*,.txt,.pdf,.md,.csv" onChange={handlePdfImport} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={importLoading} />
                      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                        {importLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                        {importLoading ? "Analysiert..." : importDragOver ? "Loslassen…" : "Datei/Bild hochladen oder reinziehen"}
                      </div>
                    </div>

                    {importResult && (
                      <div className="space-y-2.5 rounded-lg bg-background p-3 border border-primary/20">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="h-3 w-3 text-primary" />
                          <span className="text-xs font-semibold text-primary">AI-Zusammenfassung</span>
                        </div>
                        <p className="text-xs text-foreground/80 leading-relaxed">{importResult.summary}</p>

                        {importResult.next_steps?.length > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full h-7 text-xs gap-1.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                            onClick={() => createTasksFromResult(importResult.next_steps)}
                          >
                            <Plus className="h-3 w-3" />
                            {importResult.next_steps.length} To-Do(s) erstellen
                          </Button>
                        )}

                        {importResult.contact_info && (
                          <div className="flex flex-wrap gap-1">
                            {importResult.contact_info.name && <Badge variant="secondary" className="text-[10px]">👤 {importResult.contact_info.name}</Badge>}
                            {importResult.contact_info.email && <Badge variant="secondary" className="text-[10px]">✉️ {importResult.contact_info.email}</Badge>}
                          </div>
                        )}

                        <Button variant="ghost" size="sm" className="h-6 text-[10px] text-muted-foreground" onClick={() => setImportResult(null)}>Schließen</Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT PANEL – Activity Timeline */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-5 py-2.5 border-b border-border shrink-0">
                <div className="flex items-center gap-1">
                  {TIMELINE_FILTERS.map(f => (
                    <button
                      key={f}
                      onClick={() => setTimelineFilter(f)}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        timelineFilter === f ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input
                    placeholder="Suchen..."
                    value={timelineSearch}
                    onChange={e => setTimelineSearch(e.target.value)}
                    className="h-7 w-48 pl-7 text-xs bg-transparent border-border"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-3">
                <div className="relative">
                  {filteredActivities.length > 0 && (
                    <div className="absolute left-[15px] top-4 bottom-4 w-px bg-border" />
                  )}
                  <div className="space-y-0">
                    {filteredActivities.length === 0 ? (
                      <p className="text-center text-muted-foreground py-12 text-sm">Noch keine Einträge</p>
                    ) : filteredActivities.map(act => {
                      const config = ACTIVITY_ICON_MAP[act.type] || ACTIVITY_ICON_MAP.note;
                      const Icon = config.icon;
                      return (
                        <div key={act.id} className="flex gap-3.5 py-3 relative">
                          <div className="relative z-10 flex items-center justify-center h-[30px] w-[30px] rounded-full bg-background border border-border shrink-0">
                            <Icon className="h-3.5 w-3.5" style={{ color: config.color }} />
                          </div>
                          <div className="flex-1 min-w-0 pt-0.5">
                            <div className="flex items-baseline justify-between gap-3">
                              <p className="text-sm font-medium text-foreground">{act.title}</p>
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                {new Date(act.created_at).toLocaleDateString("de-DE", { day: "numeric", month: "short" })}
                              </span>
                            </div>
                            {act.body && (
                              <p className="text-xs text-foreground/50 mt-1 whitespace-pre-wrap leading-relaxed">{act.body}</p>
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{ACTIVITY_TYPES.find(t => t.value === activityType)?.label || "Eintrag"} hinzufügen</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Titel *" value={activityTitle} onChange={e => setActivityTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && addActivity()} />
              <Textarea placeholder="Details (optional)" value={activityBody} onChange={e => setActivityBody(e.target.value)} rows={3} />
              <Button onClick={addActivity} className="w-full">Hinzufügen</Button>
            </div>
          </DialogContent>
        </Dialog>
      </ErrorBoundary>
    </AppLayout>
  );
}
