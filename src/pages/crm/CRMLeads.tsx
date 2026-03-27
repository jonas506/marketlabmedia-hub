import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, ExternalLink, Link2, Upload, Sparkles, Loader2, FileText, CheckSquare, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import CRMLayout from "../CRM";
import ErrorBoundary from "@/components/ErrorBoundary";

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

interface LeadStatus {
  id: string;
  name: string;
  color: string;
}

interface Lead {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  source: string | null;
  status_id: string | null;
  created_at: string;
  status?: LeadStatus;
}

export default function CRMLeads() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newLead, setNewLead] = useState({ name: "", contact_name: "", contact_email: "", contact_phone: "", source: "", status_id: "", website: "" });
  const [loading, setLoading] = useState(true);
  const [importUrl, setImportUrl] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [pdfFiles, setPdfFiles] = useState<{ name: string; text: string }[]>([]);
  const [pdfLoading, setPdfLoading] = useState(false);

  const fetchData = async () => {
    const [{ data: leadsData }, { data: statusData }] = await Promise.all([
      supabase.from("crm_leads").select("*").order("created_at", { ascending: false }),
      supabase.from("crm_lead_statuses").select("*").order("sort_order"),
    ]);
    setStatuses(statusData || []);
    const mapped = (leadsData || []).map((l: any) => ({
      ...l,
      status: (statusData || []).find((s: any) => s.id === l.status_id),
    }));
    setLeads(mapped);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const resetForm = () => {
    setNewLead({ name: "", contact_name: "", contact_email: "", contact_phone: "", source: "", status_id: "", website: "" });
    setImportUrl("");
    setImportResult(null);
    setPdfFiles([]);
  };

  const handleScrapeUrl = async () => {
    if (!importUrl.trim()) return;
    setImportLoading(true);
    try {
      const formatted = importUrl.startsWith("http") ? importUrl : `https://${importUrl}`;
      const { data, error } = await supabase.functions.invoke("firecrawl-scrape", {
        body: { url: formatted, options: { formats: ["markdown"], onlyMainContent: true } },
      });
      if (error) throw new Error(error.message);
      const markdown = data?.data?.markdown || data?.markdown || "";
      if (!markdown) throw new Error("Keine Inhalte gefunden");

      const { data: aiResult, error: aiErr } = await supabase.functions.invoke("crm-smart-import", {
        body: { content: markdown, lead_name: newLead.name || importUrl, source_type: "url" },
      });
      if (aiErr) throw new Error(aiErr.message);

      setImportResult(aiResult);
      // Auto-fill fields
      const ci = aiResult.contact_info || {};
      setNewLead(p => ({
        ...p,
        name: p.name || ci.company || "",
        contact_name: p.contact_name || ci.name || "",
        contact_email: p.contact_email || ci.email || "",
        contact_phone: p.contact_phone || ci.phone || "",
        website: p.website || formatted,
      }));
      toast.success("Website analysiert!");
    } catch (err: any) {
      toast.error(err.message || "Scraping fehlgeschlagen");
    } finally {
      setImportLoading(false);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfLoading(true);
    try {
      const text = await file.text();
      if (!text.trim()) throw new Error("Dokument ist leer");

      const { data: aiResult, error: aiErr } = await supabase.functions.invoke("crm-smart-import", {
        body: { content: text, lead_name: newLead.name || file.name, source_type: "pdf" },
      });
      if (aiErr) throw new Error(aiErr.message);

      setPdfFiles(prev => [...prev, { name: file.name, text: aiResult.summary || "" }]);
      setImportResult(aiResult);
      // Auto-fill
      const ci = aiResult.contact_info || {};
      setNewLead(p => ({
        ...p,
        name: p.name || ci.company || "",
        contact_name: p.contact_name || ci.name || "",
        contact_email: p.contact_email || ci.email || "",
        contact_phone: p.contact_phone || ci.phone || "",
      }));
      toast.success("Dokument analysiert!");
    } catch (err: any) {
      toast.error(err.message || "Analyse fehlgeschlagen");
    } finally {
      setPdfLoading(false);
      e.target.value = "";
    }
  };

  const createLead = async () => {
    if (!newLead.name.trim() || !user) return;
    const defaultStatus = statuses.find(s => s.name === "Neu");
    const { data: created, error } = await supabase.from("crm_leads").insert({
      name: newLead.name,
      contact_name: newLead.contact_name || null,
      contact_email: newLead.contact_email || null,
      contact_phone: newLead.contact_phone || null,
      website: newLead.website || null,
      source: newLead.source || null,
      status_id: newLead.status_id || defaultStatus?.id || null,
      created_by: user.id,
    }).select("id").single();
    if (error) { toast.error(error.message); return; }

    // If we have AI results, save activity + create tasks
    if (created && importResult) {
      await supabase.from("crm_activities").insert({
        lead_id: created.id,
        type: "note" as any,
        title: importResult.summary?.substring(0, 80) || "Smart Import",
        body: importResult.summary + (importResult.key_points?.length ? "\n\n" + importResult.key_points.map((p: string) => `• ${p}`).join("\n") : ""),
        created_by: user.id,
      });
      if (importResult.next_steps?.length) {
        for (const step of importResult.next_steps) {
          await supabase.from("crm_tasks").insert({
            lead_id: created.id,
            title: step,
            assigned_to: user.id,
          } as any);
        }
      }
    }

    toast.success("Lead erstellt" + (importResult?.next_steps?.length ? ` mit ${importResult.next_steps.length} Aufgabe(n)` : ""));
    setShowCreate(false);
    resetForm();
    fetchData();
  };

  const filtered = leads.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    (l.contact_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (l.contact_email || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <CRMLayout>
      <ErrorBoundary level="section">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-[#FAFBFF] font-[Manrope]">Kunden</h1>
          <Button onClick={() => setShowCreate(true)} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Neuer Lead
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Suchen..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-[#2A2A32] border-[#3A3A44] text-[#FAFBFF]"
          />
        </div>

        <div className="rounded-lg border border-[#3A3A44] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#2A2A32] text-[#FAFBFF]/60 text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-medium">Firma</th>
                <th className="text-left px-4 py-3 font-medium">Ansprechpartner</th>
                <th className="text-left px-4 py-3 font-medium">Quelle</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Erstellt</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Laden...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Keine Leads gefunden</td></tr>
              ) : filtered.map(lead => (
                <tr key={lead.id} className="border-t border-[#3A3A44] hover:bg-[#2A2A32]/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/crm/lead/${lead.id}`} className="font-medium text-[#FAFBFF] hover:text-primary transition-colors">
                      {lead.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[#FAFBFF]/70">{lead.contact_name || "–"}</td>
                  <td className="px-4 py-3">
                    {lead.source ? (
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${SOURCE_COLORS[lead.source] || "bg-muted text-muted-foreground"}`}>
                        {SOURCE_OPTIONS.find(s => s.value === lead.source)?.label || lead.source}
                      </span>
                    ) : "–"}
                  </td>
                  <td className="px-4 py-3">
                    {lead.status ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: lead.status.color }} />
                        {lead.status.name}
                      </span>
                    ) : "–"}
                  </td>
                  <td className="px-4 py-3 text-[#FAFBFF]/50 text-xs">
                    {new Date(lead.created_at).toLocaleDateString("de-DE")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-[#2A2A32] border-[#3A3A44] text-[#FAFBFF]">
          <DialogHeader><DialogTitle>Neuer Lead</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Firmenname *" value={newLead.name} onChange={e => setNewLead(p => ({ ...p, name: e.target.value }))} className="bg-[#1E1E24] border-[#3A3A44]" />
            <Input placeholder="Ansprechpartner" value={newLead.contact_name} onChange={e => setNewLead(p => ({ ...p, contact_name: e.target.value }))} className="bg-[#1E1E24] border-[#3A3A44]" />
            <div className="grid gap-3 md:grid-cols-2">
              <Input type="email" placeholder="Email" value={newLead.contact_email} onChange={e => setNewLead(p => ({ ...p, contact_email: e.target.value }))} className="bg-[#1E1E24] border-[#3A3A44]" />
              <Input type="tel" placeholder="Telefonnummer" value={newLead.contact_phone} onChange={e => setNewLead(p => ({ ...p, contact_phone: e.target.value }))} className="bg-[#1E1E24] border-[#3A3A44]" />
            </div>
            <Select value={newLead.source} onValueChange={v => setNewLead(p => ({ ...p, source: v }))}>
              <SelectTrigger className="bg-[#1E1E24] border-[#3A3A44]"><SelectValue placeholder="Quelle" /></SelectTrigger>
              <SelectContent>
                {SOURCE_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={newLead.status_id} onValueChange={v => setNewLead(p => ({ ...p, status_id: v }))}>
              <SelectTrigger className="bg-[#1E1E24] border-[#3A3A44]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                {statuses.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={createLead} className="w-full">Erstellen</Button>
          </div>
        </DialogContent>
      </Dialog>
      </ErrorBoundary>
    </CRMLayout>
  );
}
