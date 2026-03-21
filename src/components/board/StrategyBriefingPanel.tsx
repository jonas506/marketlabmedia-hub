import { useState, useCallback, useEffect } from "react";
import { X, Upload, Plus, Globe, Sparkles, FileText, Loader2, Check, ChevronDown, ChevronUp, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface SourceFile {
  name: string;
  size: number;
  text: string;
  status: "processing" | "done" | "error";
}

interface AnalyzedUrl {
  url: string;
  title: string;
  text: string;
  status: "processing" | "done" | "error";
}

interface ClientData {
  id: string;
  name: string;
  industry?: string;
  target_audience?: string;
  usps?: string;
  tonality?: string;
  content_topics?: string;
  services?: string[];
  summary?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onGenerate: (payload: any) => Promise<void>;
  clientData?: ClientData | null;
  boardId: string;
}

const STRATEGY_TYPES = [
  { value: "funnel", icon: "🎯", label: "Performance Funnel", desc: "Vollständiger Marketing-Funnel von Awareness bis Conversion" },
  { value: "journey", icon: "🗺️", label: "Customer Journey Map", desc: "Komplette Kundenreise mit Touchpoints und Maßnahmen" },
  { value: "content_plan", icon: "📅", label: "Content-Strategie", desc: "Content-Plan mit Kanälen, Formaten und Themen" },
  { value: "full", icon: "🔄", label: "Vollständige Strategie", desc: "Kombiniert Funnel, Journey und Content-Plan" },
];

interface ClientFile {
  name: string;
  path: string;
  selected: boolean;
}

const StrategyBriefingPanel = ({ open, onClose, onGenerate, clientData, boardId }: Props) => {
  const [files, setFiles] = useState<SourceFile[]>([]);
  const [briefing, setBriefing] = useState("");
  const [urls, setUrls] = useState<AnalyzedUrl[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [strategyType, setStrategyType] = useState("full");
  const [includeClientData, setIncludeClientData] = useState(true);
  const [showStructured, setShowStructured] = useState(false);
  const [structured, setStructured] = useState({ company: "", audience: "", problem: "", measures: "", goal: "", budget: "" });
  const [generating, setGenerating] = useState(false);
  const [genPhase, setGenPhase] = useState("");
  const [clientFiles, setClientFiles] = useState<ClientFile[]>([]);
  const [loadingClientFiles, setLoadingClientFiles] = useState(false);

  // Load CI-assets from client storage when panel opens
  useEffect(() => {
    if (!open || !clientData?.id) {
      setClientFiles([]);
      return;
    }
    const loadClientFiles = async () => {
      setLoadingClientFiles(true);
      try {
        const { data: fileList } = await supabase.storage
          .from("client-logos")
          .list(`${clientData.id}/ci-assets`, { limit: 50 });
        if (fileList && fileList.length > 0) {
          setClientFiles(
            fileList
              .filter(f => f.name !== ".emptyFolderPlaceholder")
              .map(f => ({
                name: f.name,
                path: `${clientData.id}/ci-assets/${f.name}`,
                selected: false,
              }))
          );
        }
      } catch {
        // ignore
      } finally {
        setLoadingClientFiles(false);
      }
    };
    loadClientFiles();
  }, [open, clientData?.id]);

  const hasSource = files.length > 0 || briefing.trim() || urls.length > 0 || (clientData && includeClientData) || Object.values(structured).some(v => v.trim()) || clientFiles.some(f => f.selected);

  const handleFileUpload = useCallback(async (fileList: FileList) => {
    for (const file of Array.from(fileList)) {
      const entry: SourceFile = { name: file.name, size: file.size, text: "", status: "processing" };
      setFiles(prev => [...prev, entry]);

      try {
        // Upload to storage
        const path = `${boardId}/${Date.now()}_${file.name}`;
        await supabase.storage.from("board-files").upload(path, file);

        // Extract text based on type
        let text = "";
        if (file.type === "text/plain" || file.name.endsWith(".txt")) {
          text = await file.text();
        } else if (file.type === "application/pdf") {
          text = `[PDF-Inhalt: ${file.name} — ${(file.size / 1024).toFixed(0)}KB. Bitte analysiere basierend auf dem Dateinamen und Kontext.]`;
        } else if (file.type.startsWith("image/")) {
          text = `[Bild hochgeladen: ${file.name}]`;
        } else {
          text = await file.text().catch(() => `[Datei: ${file.name}]`);
        }

        // Save to board_source_files
        await supabase.from("board_source_files").insert({
          board_id: boardId,
          file_name: file.name,
          file_type: file.type,
          file_path: path,
          extracted_text: text.substring(0, 10000),
          file_size: file.size,
        } as any);

        setFiles(prev => prev.map(f => f.name === file.name ? { ...f, text, status: "done" as const } : f));
      } catch {
        setFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: "error" as const } : f));
      }
    }
  }, [boardId]);

  const handleAddUrl = useCallback(async () => {
    if (!urlInput.trim()) return;
    const url = urlInput.trim();
    setUrlInput("");

    const entry: AnalyzedUrl = { url, title: "", text: "", status: "processing" };
    setUrls(prev => [...prev, entry]);

    try {
      const { data, error } = await supabase.functions.invoke("analyze-url", { body: { url } });
      if (error || !data?.success) throw new Error(data?.error || "Failed");
      setUrls(prev => prev.map(u => u.url === url ? { ...u, title: data.data.title, text: data.data.text, status: "done" as const } : u));
    } catch {
      setUrls(prev => prev.map(u => u.url === url ? { ...u, status: "error" as const } : u));
      toast.error("URL konnte nicht analysiert werden");
    }
  }, [urlInput]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);

    try {
      setGenPhase("📄 Dokumente werden gelesen...");
      await new Promise(r => setTimeout(r, 800));

      setGenPhase("🔍 Markt & Kontext werden analysiert...");

      // Build briefing text
      let fullBriefing = briefing;
      if (showStructured) {
        const parts = [];
        if (structured.company) parts.push(`Unternehmen & Branche: ${structured.company}`);
        if (structured.audience) parts.push(`Zielgruppe: ${structured.audience}`);
        if (structured.problem) parts.push(`Problem / Pain Point: ${structured.problem}`);
        if (structured.measures) parts.push(`Bisherige Maßnahmen: ${structured.measures}`);
        if (structured.goal) parts.push(`Ziel: ${structured.goal}`);
        if (structured.budget) parts.push(`Budget: ${structured.budget}`);
        if (parts.length > 0) fullBriefing = (fullBriefing ? fullBriefing + "\n\n" : "") + parts.join("\n");
      }

      // Download text from selected client files
      const clientFileDocs: { name: string; text: string }[] = [];
      for (const cf of clientFiles.filter(f => f.selected)) {
        try {
          const { data } = await supabase.storage.from("client-logos").download(cf.path);
          if (data) {
            const text = await data.text().catch(() => `[Datei: ${cf.name}]`);
            clientFileDocs.push({ name: cf.name, text: text.substring(0, 10000) });
          }
        } catch {
          clientFileDocs.push({ name: cf.name, text: `[Datei: ${cf.name}]` });
        }
      }

      const payload = {
        briefing: fullBriefing || undefined,
        strategyType,
        clientData: (clientData && includeClientData) ? clientData : undefined,
        documents: [
          ...files.filter(f => f.status === "done").map(f => ({ name: f.name, text: f.text })),
          ...clientFileDocs,
        ],
        urls: urls.filter(u => u.status === "done").map(u => ({ url: u.url, text: u.text })),
        boardId,
      };

      setGenPhase("🎨 Strategie wird auf dem Board erstellt...");
      await onGenerate(payload);

      setGenPhase("✅ Strategie erstellt!");
      await new Promise(r => setTimeout(r, 1000));
      onClose();
    } catch (e) {
      toast.error("Strategie-Generierung fehlgeschlagen. Bitte versuche es erneut.");
    } finally {
      setGenerating(false);
      setGenPhase("");
    }
  }, [briefing, structured, showStructured, strategyType, clientData, includeClientData, files, urls, boardId, onGenerate, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ x: 420, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 420, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 250 }}
          className="fixed right-0 top-0 bottom-0 w-[420px] bg-card border-l border-border z-[100] flex flex-col shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="text-base font-display font-semibold">AI Strategie</h2>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-5 space-y-6">
              {/* Section 1: Sources */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Quellen</h3>

                {/* Client data */}
                {clientData && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/10">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs font-medium">Kundendaten: {clientData.name}</p>
                        <p className="text-[10px] text-muted-foreground">{clientData.industry || "Keine Branche"}</p>
                      </div>
                    </div>
                    <Switch checked={includeClientData} onCheckedChange={setIncludeClientData} />
                  </div>
                )}

                {/* File upload */}
                <div
                  className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                  onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={e => { e.preventDefault(); e.stopPropagation(); handleFileUpload(e.dataTransfer.files); }}
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.multiple = true;
                    input.accept = ".pdf,.docx,.txt,.png,.jpg,.jpeg";
                    input.onchange = (e) => {
                      const files = (e.target as HTMLInputElement).files;
                      if (files) handleFileUpload(files);
                    };
                    input.click();
                  }}
                >
                  <Upload className="h-5 w-5 mx-auto mb-1.5 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">PDFs, Exposés oder Briefings hier ablegen</p>
                </div>

                {/* File list */}
                {files.length > 0 && (
                  <div className="space-y-1.5">
                    {files.map((f, i) => (
                      <div key={i} className="flex items-center justify-between text-xs p-2 rounded bg-muted/50">
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{f.name}</span>
                          <span className="text-muted-foreground shrink-0">({(f.size / 1024).toFixed(0)}KB)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {f.status === "processing" && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                          {f.status === "done" && <Check className="h-3 w-3 text-emerald-500" />}
                          {f.status === "error" && <span className="text-destructive">✗</span>}
                          <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Client CI-Assets */}
                {clientData && clientFiles.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                      <Label className="text-xs">Kunden-Dokumente</Label>
                    </div>
                    {clientFiles.map((cf, i) => (
                      <label
                        key={i}
                        className={`flex items-center justify-between text-xs p-2 rounded cursor-pointer transition-colors ${
                          cf.selected ? "bg-primary/10 border border-primary/20" : "bg-muted/50 hover:bg-muted"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <input
                            type="checkbox"
                            checked={cf.selected}
                            onChange={() => setClientFiles(prev => prev.map((f, j) => j === i ? { ...f, selected: !f.selected } : f))}
                            className="rounded border-border"
                          />
                          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{cf.name}</span>
                        </div>
                        {cf.selected && <Check className="h-3 w-3 text-primary shrink-0" />}
                      </label>
                    ))}
                  </div>
                )}
                {loadingClientFiles && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Kunden-Dokumente werden geladen...
                  </div>
                )}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Briefing-Notizen</Label>
                    <button
                      className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                      onClick={() => setShowStructured(!showStructured)}
                    >
                      {showStructured ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      Strukturiertes Briefing
                    </button>
                  </div>
                  <Textarea
                    value={briefing}
                    onChange={e => setBriefing(e.target.value)}
                    placeholder="Beschreibe die Ausgangssituation des Kunden, seine Ziele, Herausforderungen..."
                    className="min-h-[100px] text-xs resize-none"
                  />
                </div>

                {/* Structured fields */}
                <AnimatePresence>
                  {showStructured && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="space-y-2 overflow-hidden"
                    >
                      {[
                        { key: "company", label: "Unternehmen & Branche" },
                        { key: "audience", label: "Zielgruppe" },
                        { key: "problem", label: "Aktuelles Problem / Pain Point" },
                        { key: "measures", label: "Bisherige Marketing-Maßnahmen" },
                        { key: "goal", label: "Ziel / gewünschtes Ergebnis" },
                      ].map(field => (
                        <div key={field.key}>
                          <Label className="text-[10px] text-muted-foreground">{field.label}</Label>
                          <Input
                            value={structured[field.key as keyof typeof structured]}
                            onChange={e => setStructured(prev => ({ ...prev, [field.key]: e.target.value }))}
                            className="h-8 text-xs mt-0.5"
                          />
                        </div>
                      ))}
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Budget-Rahmen</Label>
                        <select
                          value={structured.budget}
                          onChange={e => setStructured(prev => ({ ...prev, budget: e.target.value }))}
                          className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 mt-0.5"
                        >
                          <option value="">— Nicht angegeben —</option>
                          <option value="<2k">Unter 2.000€ / Monat</option>
                          <option value="2-5k">2.000 – 5.000€ / Monat</option>
                          <option value="5-10k">5.000 – 10.000€ / Monat</option>
                          <option value=">10k">Über 10.000€ / Monat</option>
                        </select>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* URL analysis */}
                <div className="space-y-2">
                  <Label className="text-xs">URL-Analyse</Label>
                  <div className="flex gap-1.5">
                    <Input
                      value={urlInput}
                      onChange={e => setUrlInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleAddUrl()}
                      placeholder="Website oder Konkurrenz-URL..."
                      className="h-8 text-xs"
                    />
                    <Button size="sm" variant="outline" className="h-8 px-2.5 shrink-0" onClick={handleAddUrl} disabled={!urlInput.trim()}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {urls.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {urls.map((u, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px] gap-1 pl-1.5 pr-1">
                          <Globe className="h-2.5 w-2.5" />
                          <span className="max-w-[140px] truncate">{u.url}</span>
                          {u.status === "processing" && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                          {u.status === "done" && <Check className="h-2.5 w-2.5 text-emerald-500" />}
                          <button onClick={() => setUrls(prev => prev.filter((_, j) => j !== i))}>
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Section 2: Strategy Type */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Strategie-Typ</h3>
                <RadioGroup value={strategyType} onValueChange={setStrategyType} className="space-y-2">
                  {STRATEGY_TYPES.map(t => (
                    <label
                      key={t.value}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        strategyType === t.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                      }`}
                    >
                      <RadioGroupItem value={t.value} className="mt-0.5" />
                      <div>
                        <p className="text-xs font-medium">{t.icon} {t.label}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{t.desc}</p>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              </div>
            </div>
          </ScrollArea>

          {/* Generate button */}
          <div className="p-5 border-t border-border shrink-0 space-y-2">
            {generating && genPhase && (
              <div className="flex items-center gap-2 text-xs text-primary">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>{genPhase}</span>
              </div>
            )}
            <Button
              className="w-full gap-2"
              disabled={!hasSource || generating}
              onClick={handleGenerate}
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generiere...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Strategie generieren
                </>
              )}
            </Button>
            <p className="text-[10px] text-muted-foreground text-center">
              Dauert ca. 15-30 Sekunden
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StrategyBriefingPanel;
