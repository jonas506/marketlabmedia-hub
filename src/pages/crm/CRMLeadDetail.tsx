import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  ArrowLeft, Globe, Sparkles, Upload, Link2, Loader2, AlertTriangle,
  FileText, Image, Trash2, X, Mail, User,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import { getSourceInfo } from "@/lib/crm-constants";
import { useCrmStages, getStageColor as dynGetStageColor } from "@/hooks/useCrmStages";
import { useQuery } from "@tanstack/react-query";
import LeadPipelinesPopover from "@/components/crm/LeadPipelinesPopover";
import CrmDetailHeader, { buildQuickActions } from "@/components/crm/detail/CrmDetailHeader";
import DetailsPanel, { type DetailGroup, linkHref } from "@/components/crm/detail/DetailsPanel";
import ActivityPanel from "@/components/crm/detail/ActivityPanel";
import { NextStepCard, TasksCard, OffersCard } from "@/components/crm/detail/SideCards";
import type { CrmActivity } from "@/lib/crm-activity";

const SETTING_CALL_QUESTIONS = [
  "Wie kommst du gerade an deine Kunden? (Empfehlung, Netzwerk, Ads, Bestand?)",
  "Wie viele Abschlüsse bzw. wie viel Umsatz machst du aktuell im Monat?",
  "Verkaufst du feste Objekte oder eher das Konzept (Steuern sparen, Altersvorsorge) und suchst dann das passende Objekt?",
  "Wenn du morgen 5 qualifizierte Termine mehr hättest – könntest du die abarbeiten und closen?",
  "Was ist dein Ziel für die nächsten 6–12 Monate – in Abschlüssen oder Volumen?",
  "Was hält dich aktuell davon ab, das schon zu erreichen?",
  "Hast du für Marketing/Leadgenerierung schon mal Geld in die Hand genommen – und wenn ja, in welchem Rahmen?",
] as const;

interface LeadData {
  id: string;
  name: string;
  contact_id: string | null;
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
  created_at: string;
  setting_call_answers: Record<string, string> | null;
}

export default function CRMLeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: crmStages = [] } = useCrmStages();

  const [lead, setLead] = useState<LeadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [crmTasks, setCrmTasks] = useState<any[]>([]);
  const [leadFiles, setLeadFiles] = useState<any[]>([]);
  const [editingSettingIdx, setEditingSettingIdx] = useState<number | null>(null);

  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  // Email compose
  const [showEmailCompose, setShowEmailCompose] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailSending, setEmailSending] = useState(false);

  // Files & import
  const [fileUploading, setFileUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [importDragOver, setImportDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importUrl, setImportUrl] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [showLinkedInHint, setShowLinkedInHint] = useState(false);

  const { data: leadDocuments = [] } = useQuery({
    queryKey: ["lead-documents", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signature_documents")
        .select("id, title, status, amount_net, created_at, token")
        .eq("lead_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: linkedContact } = useQuery({
    queryKey: ["crm-contact", lead?.contact_id],
    enabled: !!lead?.contact_id,
    queryFn: async () => (await supabase.from("crm_contacts").select("id, full_name").eq("id", lead!.contact_id!).single()).data,
  });

  const { data: sourceTags = [] } = useQuery({
    queryKey: ["crm-source-tags"],
    queryFn: async () => (await supabase.from("crm_source_tags").select("*").order("name")).data ?? [],
  });

  const fetchLead = async () => {
    if (!id) return;
    const [{ data: leadData }, { data: actData }, { data: taskData }, { data: fileData }] = await Promise.all([
      supabase.from("crm_leads").select("*").eq("id", id).single(),
      supabase.from("crm_activities").select("id, type, title, body, created_at, created_by, lead_id, contact_id, metadata").eq("lead_id", id).order("created_at", { ascending: false }),
      supabase.from("crm_tasks").select("id, title, due_date, is_completed").eq("lead_id", id).order("is_completed").order("due_date", { ascending: true, nullsFirst: false }),
      supabase.from("crm_files").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
    ]);
    if (leadData) setLead(leadData as any);
    setActivities((actData || []) as CrmActivity[]);
    setCrmTasks((taskData || []) as any[]);
    setLeadFiles((fileData || []) as any[]);
    setLoading(false);
  };

  useEffect(() => { fetchLead(); }, [id]);

  const saveField = async (field: string, value: any) => {
    if (!id) return;
    const { error } = await supabase.from("crm_leads").update({ [field]: value } as any).eq("id", id);
    if (error) { toast.error("Speichern fehlgeschlagen"); return; }
    setLead(p => p ? { ...p, [field]: value } : p);
  };

  const generateSummary = async () => {
    if (!lead || activities.length === 0) return;
    setSummaryLoading(true);
    setShowSummary(true);
    try {
      const timelineText = activities
        .map(a => `[${new Date(a.created_at).toLocaleDateString("de-DE")}] ${a.title}${a.body ? ": " + a.body.slice(0, 200) : ""}`)
        .join("\n");
      const res = await supabase.functions.invoke("crm-lead-summary", {
        body: { lead_name: lead.name, contact_name: lead.contact_name, stage: lead.stage, timeline: timelineText },
      });
      if (res.error) throw res.error;
      setSummaryText(res.data?.summary || "Keine Zusammenfassung verfügbar.");
    } catch {
      toast.error("Zusammenfassung fehlgeschlagen");
      setSummaryText(null);
      setShowSummary(false);
    } finally {
      setSummaryLoading(false);
    }
  };

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    if (!id || !user || files.length === 0) return;
    setFileUploading(true);
    try {
      for (const file of Array.from(files)) {
        const storagePath = `${id}/${Date.now()}-${file.name}`;
        const { error: uploadErr } = await supabase.storage.from("crm-files").upload(storagePath, file);
        if (uploadErr) { toast.error(`Upload fehlgeschlagen: ${file.name}`); continue; }
        const { data: urlData } = supabase.storage.from("crm-files").getPublicUrl(storagePath);
        await supabase.from("crm_files").insert({
          lead_id: id, name: file.name, file_url: urlData.publicUrl,
          mime_type: file.type || "application/octet-stream", file_size: file.size, uploaded_by: user.id,
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
    const pathMatch = fileUrl.split("/crm-files/")[1];
    if (pathMatch) await supabase.storage.from("crm-files").remove([decodeURIComponent(pathMatch)]);
    await supabase.from("crm_files").delete().eq("id", fileId);
    setLeadFiles(prev => prev.filter(f => f.id !== fileId));
    toast.success("Datei gelöscht");
  };

  const sendEmail = async () => {
    if (!emailTo.trim() || !emailSubject.trim() || !emailBody.trim() || !id) return;
    setEmailSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("crm-send-email", {
        body: { to: emailTo, subject: emailSubject, body: emailBody, lead_id: id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("E-Mail gesendet");
      setShowEmailCompose(false);
      setEmailTo(""); setEmailSubject(""); setEmailBody("");
      fetchLead();
    } catch (err: any) {
      toast.error(err.message || "E-Mail konnte nicht gesendet werden");
    } finally {
      setEmailSending(false);
    }
  };

  const deleteLead = async () => {
    if (!id) return;
    if (!confirm("Lead wirklich endgültig löschen? Alle zugehörigen Daten werden ebenfalls entfernt.")) return;
    await Promise.all([
      supabase.from("crm_activities").delete().eq("lead_id", id),
      supabase.from("crm_tasks").delete().eq("lead_id", id),
      supabase.from("crm_files").delete().eq("lead_id", id),
    ]);
    const { error } = await supabase.from("crm_leads").delete().eq("id", id);
    if (error) { toast.error("Fehler beim Löschen des Leads"); return; }
    toast.success("Lead gelöscht");
    navigate("/crm");
  };

  // Smart Import
  const isLinkedInUrl = (url: string) => /linkedin\.com/i.test(url);

  const logImportActivity = async (title: string, body: string | null) => {
    if (!id || !user) return;
    await supabase.from("crm_activities").insert({ lead_id: id, type: "note" as any, title, body, created_by: user.id });
  };

  const applyContactInfo = async (ci: any) => {
    const updates: any = {};
    if (ci.name && !lead?.contact_name) updates.contact_name = ci.name;
    if (ci.email && !lead?.contact_email) updates.contact_email = ci.email;
    if (ci.phone && !lead?.contact_phone) updates.contact_phone = ci.phone;
    if (ci.website && !lead?.website) updates.website = ci.website;
    if (ci.instagram && !lead?.instagram_handle) updates.instagram_handle = ci.instagram;
    if (ci.linkedin && !lead?.linkedin_url) updates.linkedin_url = ci.linkedin;
    if (Object.keys(updates).length > 0) {
      await supabase.from("crm_leads").update(updates).eq("id", id!);
      setLead(p => p ? { ...p, ...updates } : p);
    }
  };

  const importBody = (aiResult: any) =>
    aiResult.summary + (aiResult.key_points?.length ? "\n\n**Wichtige Punkte:**\n" + aiResult.key_points.map((p: string) => `• ${p}`).join("\n") : "");

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
      if (aiResult.contact_info) await applyContactInfo(aiResult.contact_info);
      await logImportActivity(`🔗 Website analysiert: ${importUrl}`, importBody(aiResult));
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
      if (file.type.startsWith("image/")) {
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ""));
        const storagePath = `${id}/${Date.now()}-${file.name}`;
        const [uploadResult, aiResult] = await Promise.all([
          supabase.storage.from("crm-files").upload(storagePath, file),
          supabase.functions.invoke("crm-smart-import", {
            body: { image_base64: base64, image_mime_type: file.type, lead_name: lead?.name, source_type: "image" },
          }),
        ]);
        if (uploadResult.error) throw new Error(uploadResult.error.message);
        const { data: urlData } = supabase.storage.from("crm-files").getPublicUrl(storagePath);
        await supabase.from("crm_files").insert({
          lead_id: id, name: file.name, file_url: urlData.publicUrl,
          mime_type: file.type, file_size: file.size, uploaded_by: user.id,
        });
        const aiData = aiResult.data;
        if (aiData && !aiResult.error) {
          setImportResult(aiData);
          if (aiData.contact_info) await applyContactInfo(aiData.contact_info);
          if (aiData.source_channel && !lead?.source) {
            const channelMap: Record<string, string> = { instagram: "Instagram", linkedin: "LinkedIn", whatsapp: "WhatsApp", email: "Email", phone: "Telefon", website: "Website" };
            const sourceName = channelMap[aiData.source_channel] || aiData.source_channel;
            await supabase.from("crm_leads").update({ source: sourceName }).eq("id", id);
            setLead(p => p ? { ...p, source: sourceName } : p);
          }
          const emoji = aiData.source_channel ? "📋" : "📋";
          const actTitle = aiData.activity_title || `${emoji} Kontakt analysiert`;
          await logImportActivity(actTitle, importBody(aiData));
          toast.success("Bild analysiert & Infos extrahiert");
        } else {
          await logImportActivity(`🖼️ Bild hochgeladen: ${file.name}`, null);
          toast.success("Bild hochgeladen");
        }
        fetchLead();
        return;
      }
      const text = file.type === "application/pdf" || file.name.endsWith(".pdf") ? await extractPdfText(file) : await file.text();
      if (!text.trim()) throw new Error("Dokument ist leer");
      const { data: aiResult, error: aiErr } = await supabase.functions.invoke("crm-smart-import", {
        body: { content: text, lead_name: lead?.name, source_type: "pdf" },
      });
      if (aiErr) throw new Error(aiErr.message);
      setImportResult(aiResult);
      if (aiResult.contact_info) await applyContactInfo(aiResult.contact_info);
      await logImportActivity(`📄 Dokument analysiert: ${file.name}`, importBody(aiResult));
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

  if (loading || !lead) {
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

  const stageColor = dynGetStageColor(crmStages, lead.stage);
  const sourceInfo = getSourceInfo(lead.source);
  const answeredCount = Object.values(lead.setting_call_answers || {}).filter(v => v && String(v).trim()).length;

  const groups: DetailGroup[] = [
    {
      title: "Kontakt",
      fields: [
        { key: "contact_name", label: "Ansprechpartner", value: lead.contact_name },
        { key: "contact_email", label: "E-Mail", value: lead.contact_email, href: linkHref("email", lead.contact_email) },
        { key: "contact_phone", label: "Telefon", value: lead.contact_phone, href: linkHref("tel", lead.contact_phone) },
        { key: "website", label: "Website", value: lead.website, href: linkHref("link", lead.website) },
        { key: "linkedin_url", label: "LinkedIn", value: lead.linkedin_url, href: linkHref("link", lead.linkedin_url) },
        { key: "instagram_handle", label: "Instagram", value: lead.instagram_handle },
      ],
    },
    {
      title: "CRM",
      fields: [
        { key: "deal_value", label: "Deal-Wert", value: lead.deal_value ? `${Number(lead.deal_value).toLocaleString("de-DE")} €` : null },
        { key: "source", label: "Quelle", value: lead.source, type: "select", options: sourceTags.map((s: any) => ({ value: s.name, label: s.name })) },
        { key: "next_step_date", label: "Follow-up", value: lead.next_step_date, type: "date" },
      ],
    },
    {
      title: "System",
      fields: [
        { key: "created_at", label: "Erstellt am", value: lead.created_at ? format(new Date(lead.created_at), "dd.MM.yyyy") : null },
      ],
    },
  ];

  const background = lead.notes ? (
    <div className="rounded-lg border border-primary/30 bg-card p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">Hintergrund</p>
      <Textarea key={lead.notes} defaultValue={lead.notes} className="min-h-[60px] border-none bg-transparent p-0 text-sm text-foreground/80 focus-visible:ring-0"
        onBlur={e => { const v = e.target.value.trim(); if (v !== (lead.notes ?? "")) saveField("notes", v || null); }} />
    </div>
  ) : undefined;

  return (
    <AppLayout>
      <ErrorBoundary level="section">
        <div className="space-y-5">
          <Link to="/crm" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />CRM
          </Link>

          <CrmDetailHeader
            name={lead.name}
            subtitle={lead.contact_name}
            badges={
              <>
                <Select value={lead.stage} onValueChange={v => saveField("stage", v)}>
                  <SelectTrigger className="h-7 w-auto gap-1.5 px-2.5 border-border bg-transparent text-xs font-medium"
                    style={{ color: stageColor, borderColor: stageColor + "44" }}>
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stageColor }} />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {crmStages.map(s => (
                      <SelectItem key={s.value} value={s.value}>
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                          {s.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <LeadPipelinesPopover leadId={lead.id} />
                {sourceInfo && (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${sourceInfo.color}`} style={sourceInfo.style}>{sourceInfo.label}</span>
                )}
                {linkedContact && (
                  <Link to={`/crm/kontakt/${linkedContact.id}`} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground hover:text-primary">
                    <User className="h-3 w-3" />{linkedContact.full_name}
                  </Link>
                )}
              </>
            }
            actions={buildQuickActions({
              email: lead.contact_email, phone: lead.contact_phone,
              linkedin_url: lead.linkedin_url, instagram_handle: lead.instagram_handle,
            })}
            extra={
              <>
                <Button size="sm" variant="outline" onClick={() => { setEmailTo(lead.contact_email || ""); setEmailSubject(""); setEmailBody(""); setShowEmailCompose(true); }}>
                  <Mail className="h-4 w-4 mr-1.5" />E-Mail
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive/60 hover:text-destructive hover:bg-destructive/10" onClick={deleteLead}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            }
          />

          <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)_320px] items-start">
            {/* Links: Details */}
            <DetailsPanel groups={groups} onSave={(key, value) => {
              if (key === "created_at") return;
              if (key === "deal_value") {
                const n = Number(String(value ?? "").replace(/[^\d.,-]/g, "").replace(",", "."));
                saveField("deal_value", value && !isNaN(n) ? n : null);
                return;
              }
              saveField(key, value);
            }} />

            {/* Mitte: Tabs */}
            <Tabs defaultValue="aktivitaet">
              <div className="flex items-center justify-between">
                <TabsList>
                  <TabsTrigger value="aktivitaet">Aktivität</TabsTrigger>
                  <TabsTrigger value="qualifizierung">Qualifizierung{answeredCount > 0 ? ` · ${answeredCount}/${SETTING_CALL_QUESTIONS.length}` : ""}</TabsTrigger>
                  <TabsTrigger value="dateien">Dateien{leadFiles.length > 0 ? ` · ${leadFiles.length}` : ""}</TabsTrigger>
                </TabsList>
                <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs gap-1.5 text-muted-foreground hover:text-primary"
                  onClick={generateSummary} disabled={summaryLoading || activities.length === 0}>
                  {summaryLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Zusammenfassung
                </Button>
              </div>

              <TabsContent value="aktivitaet" className="mt-4">
                {showSummary && (
                  <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-primary/10">
                      <span className="text-sm font-semibold text-primary flex items-center gap-2"><Sparkles className="h-3.5 w-3.5" />KI-Zusammenfassung</span>
                      <button onClick={() => setShowSummary(false)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                    </div>
                    <div className="px-4 py-3">
                      {summaryLoading ? (
                        <div className="flex items-center gap-3 py-4 justify-center">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <span className="text-sm text-muted-foreground">Analyse läuft…</span>
                        </div>
                      ) : summaryText ? (
                        <div className="space-y-2">
                          {summaryText.split("\n").filter(l => l.trim()).map((line, i) => (
                            <p key={i} className="text-[13px] text-foreground/80 leading-relaxed">{line.replace(/^\*\*(.+?):\*\*\s*/, "$1: ")}</p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
                <ActivityPanel activities={activities} leadId={id} contactId={lead.contact_id} onChanged={fetchLead} background={background} />
              </TabsContent>

              <TabsContent value="qualifizierung" className="mt-4">
                <div className="bg-card border border-border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Setting-Call-Fragen</h2>
                    <span className="text-xs text-muted-foreground">{answeredCount}/{SETTING_CALL_QUESTIONS.length}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${(answeredCount / SETTING_CALL_QUESTIONS.length) * 100}%` }} />
                  </div>
                  {SETTING_CALL_QUESTIONS.map((q, idx) => {
                    const key = `q${idx + 1}`;
                    const answers = lead.setting_call_answers || {};
                    const value = answers[key] || "";
                    return (
                      <div key={key} className="space-y-1">
                        <p className="text-xs font-medium text-foreground/80 leading-snug">{idx + 1}. {q}</p>
                        {editingSettingIdx === idx ? (
                          <Textarea autoFocus defaultValue={value} rows={2} className="bg-background text-xs" placeholder="Antwort…"
                            onBlur={async e => {
                              const next = { ...answers, [key]: e.target.value };
                              setLead(p => p ? { ...p, setting_call_answers: next } : p);
                              setEditingSettingIdx(null);
                              await saveField("setting_call_answers", next);
                            }} />
                        ) : (
                          <button onClick={() => setEditingSettingIdx(idx)}
                            className="text-xs text-left w-full min-h-[24px] px-2 py-1 rounded hover:bg-muted/30 transition-colors">
                            {value ? <span className="text-foreground/70 whitespace-pre-wrap">{value}</span> : <span className="text-muted-foreground/50">Antwort hinzufügen…</span>}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="dateien" className="mt-4 space-y-4">
                {/* Upload */}
                <div className="bg-card border border-border rounded-lg p-4 space-y-3">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dateien</h2>
                  <div
                    onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files); }}
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={e => { e.preventDefault(); setDragOver(false); }}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed py-6 cursor-pointer transition-all",
                      dragOver ? "border-primary bg-primary/10" : "border-border hover:border-muted-foreground/40 hover:bg-muted/30"
                    )}
                  >
                    {fileUploading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <Upload className="h-5 w-5 text-muted-foreground" />}
                    <span className="text-xs text-muted-foreground">{fileUploading ? "Lädt hoch…" : dragOver ? "Loslassen zum Hochladen" : "Dateien hierher ziehen oder klicken"}</span>
                    <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.md,.pptx" className="hidden"
                      onChange={e => { if (e.target.files) uploadFiles(e.target.files); e.target.value = ""; }} />
                  </div>
                  {leadFiles.map(file => {
                    const isImage = file.mime_type?.startsWith("image/");
                    return (
                      <div key={file.id} className="flex items-center gap-2 group rounded-md px-2 py-1.5 hover:bg-muted/30 transition-colors">
                        {isImage ? <Image className="h-3.5 w-3.5 text-blue-400 shrink-0" /> : <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                        <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="flex-1 text-xs truncate text-foreground/70 hover:text-foreground">{file.name}</a>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {file.file_size > 1048576 ? `${(file.file_size / 1048576).toFixed(1)} MB` : `${Math.round(file.file_size / 1024)} KB`}
                        </span>
                        <button onClick={() => deleteFile(file.id, file.file_url)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                        </button>
                      </div>
                    );
                  })}
                  {leadFiles.length === 0 && !fileUploading && <p className="text-xs text-muted-foreground text-center">Keine Dateien</p>}
                </div>

                {/* Smart Import */}
                <div className="bg-card border border-border rounded-lg p-4 space-y-3">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Sparkles className="h-3 w-3" />Smart Import</h2>
                  <div className="flex gap-1.5">
                    <div className="relative flex-1">
                      <Link2 className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                      <Input placeholder="https://beispiel.de" value={importUrl} onChange={e => setImportUrl(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleUrlImport()} className="h-8 pl-7 text-xs bg-background" disabled={importLoading} />
                    </div>
                    <Button size="sm" className="h-8 px-2.5 text-xs gap-1" onClick={handleUrlImport} disabled={importLoading || !importUrl.trim()}>
                      {importLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}Go
                    </Button>
                  </div>
                  {showLinkedInHint && (
                    <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 p-2.5 text-xs text-amber-300">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <p>LinkedIn → „Als PDF speichern“ → hier hochladen ↓</p>
                    </div>
                  )}
                  <div
                    className={cn("relative rounded-lg border-2 border-dashed py-3 transition-all",
                      importDragOver ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50")}
                    onDrop={e => {
                      e.preventDefault(); setImportDragOver(false);
                      if (e.dataTransfer.files?.[0]) handlePdfImport({ target: { files: e.dataTransfer.files, value: "" } } as any);
                    }}
                    onDragOver={e => { e.preventDefault(); setImportDragOver(true); }}
                    onDragLeave={e => { e.preventDefault(); setImportDragOver(false); }}
                  >
                    <input type="file" accept="image/*,.txt,.pdf,.md,.csv" onChange={handlePdfImport} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={importLoading} />
                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      {importLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      {importLoading ? "Analysiert…" : importDragOver ? "Loslassen…" : "Datei/Bild hochladen oder reinziehen"}
                    </div>
                  </div>
                  {importResult && (
                    <div className="space-y-3 rounded-lg bg-primary/5 p-4 border border-primary/20">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-primary flex items-center gap-2"><Sparkles className="h-3 w-3" />AI-Analyse</span>
                        <button onClick={() => setImportResult(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                      </div>
                      <p className="text-[13px] text-foreground/80 leading-relaxed">{importResult.summary}</p>
                      {importResult.key_points?.length > 0 && (
                        <div className="rounded-md border border-border/60 bg-background/50 p-3 space-y-1.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Erkenntnisse</p>
                          {importResult.key_points.map((p: string, i: number) => (
                            <div key={i} className="flex items-start gap-2">
                              <div className="h-1.5 w-1.5 rounded-full bg-primary/60 mt-[5px] shrink-0" />
                              <p className="text-xs text-foreground/70 leading-relaxed">{p}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {importResult.contact_info && (
                        <div className="flex flex-wrap gap-1.5">
                          {importResult.contact_info.name && <Badge variant="secondary" className="text-[10px]">👤 {importResult.contact_info.name}</Badge>}
                          {importResult.contact_info.email && <Badge variant="secondary" className="text-[10px]">✉️ {importResult.contact_info.email}</Badge>}
                          {importResult.contact_info.phone && <Badge variant="secondary" className="text-[10px]">📞 {importResult.contact_info.phone}</Badge>}
                        </div>
                      )}
                      {importResult.next_steps?.length > 0 && (
                        <Button size="sm" variant="outline" className="w-full h-8 text-xs gap-1.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                          onClick={() => createTasksFromResult(importResult.next_steps)}>
                          {importResult.next_steps.length} Aufgabe(n) erstellen
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            {/* Rechts: Karten */}
            <div className="space-y-4">
              <NextStepCard
                date={lead.next_step_date}
                text={lead.next_step}
                onSave={(date, text) => {
                  if (date !== lead.next_step_date) saveField("next_step_date", date);
                  if (text !== undefined && text !== lead.next_step) saveField("next_step", text);
                }}
              />
              <TasksCard tasks={crmTasks} leadId={id} onChanged={fetchLead} />
              <OffersCard documents={leadDocuments} />
            </div>
          </div>
        </div>

        {/* Email compose dialog */}
        <Dialog open={showEmailCompose} onOpenChange={setShowEmailCompose}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" />E-Mail senden</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">An</label>
                <Input placeholder="email@beispiel.de" value={emailTo} onChange={e => setEmailTo(e.target.value)} className="bg-background" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Betreff</label>
                <Input placeholder="Betreff eingeben…" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} className="bg-background" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nachricht</label>
                <Textarea placeholder="Ihre Nachricht…" value={emailBody} onChange={e => setEmailBody(e.target.value)} rows={8} className="bg-background" />
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-muted-foreground">Gesendet von noreply@marketlabmedia.de</span>
                <Button onClick={sendEmail} disabled={emailSending || !emailTo.trim() || !emailSubject.trim() || !emailBody.trim()} className="gap-2">
                  {emailSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  Senden
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </ErrorBoundary>
    </AppLayout>
  );
}
