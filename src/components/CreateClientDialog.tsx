import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createNewClientChecklists } from "@/hooks/useChecklistTriggers";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Upload, Globe, FileText, Sparkles, Loader2, X, ChevronRight, ChevronLeft, Building2, Users, Trophy, MessageSquare, Lightbulb, PenLine, Target } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";

interface ClientProfile {
  name: string;
  industry: string;
  target_audience: string;
  usps: string;
  tonality: string;
  content_topics: string;
  summary: string;
}

const PROFILE_SECTIONS = [
  { key: "industry", label: "Branche", icon: Building2, color: "from-blue-500/20 to-blue-600/10", iconColor: "text-blue-400" },
  { key: "target_audience", label: "Zielgruppe", icon: Users, color: "from-emerald-500/20 to-emerald-600/10", iconColor: "text-emerald-400" },
  { key: "usps", label: "USPs", icon: Trophy, color: "from-amber-500/20 to-amber-600/10", iconColor: "text-amber-400" },
  { key: "tonality", label: "Tonalität", icon: MessageSquare, color: "from-purple-500/20 to-purple-600/10", iconColor: "text-purple-400" },
  { key: "content_topics", label: "Content-Themen", icon: Lightbulb, color: "from-pink-500/20 to-pink-600/10", iconColor: "text-pink-400" },
] as const;

const CreateClientDialog = () => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [editingField, setEditingField] = useState<string | null>(null);

  // Step 1: Sources
  const [urls, setUrls] = useState<string[]>([]);
  const [currentUrl, setCurrentUrl] = useState("");
  const [freeText, setFreeText] = useState("");
  const [pdfTexts, setPdfTexts] = useState<string[]>([]);
  const [pdfNames, setPdfNames] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Step 2: AI Profile
  const [profile, setProfile] = useState<ClientProfile | null>(null);

  // Step 3: Services & Kontingent
  const [services, setServices] = useState<string[]>([]);
  const [reels, setReels] = useState(0);
  const [carousels, setCarousels] = useState(0);
  const [stories, setStories] = useState(0);
  const [youtubeLongform, setYoutubeLongform] = useState(0);

  const qc = useQueryClient();

  const resetAll = () => {
    setStep(1);
    setUrls([]);
    setCurrentUrl("");
    setFreeText("");
    setPdfTexts([]);
    setPdfNames([]);
    setProfile(null);
    setServices([]);
    setReels(0);
    setCarousels(0);
    setStories(0);
    setYoutubeLongform(0);
    setIsAnalyzing(false);
    setEditingField(null);
  };

  const addUrl = () => {
    const trimmed = currentUrl.trim();
    if (!trimmed) return;
    const formatted = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    setUrls((prev) => [...prev, formatted]);
    setCurrentUrl("");
  };

  const handlePdfUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (file.type !== "application/pdf") {
        toast.error(`${file.name} ist keine PDF-Datei`);
        continue;
      }
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`${file.name} ist zu groß (max. 20MB)`);
        continue;
      }
      const text = await file.text();
      const readable = text
        .replace(/[^\x20-\x7E\xC0-\xFF\u00C0-\u024F]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 10000);
      setPdfTexts((prev) => [...prev, readable]);
      setPdfNames((prev) => [...prev, file.name]);
    }
    e.target.value = "";
  }, []);

  const analyze = async () => {
    const texts = freeText.trim() ? [freeText.trim()] : [];
    if (urls.length === 0 && texts.length === 0 && pdfTexts.length === 0) {
      toast.error("Bitte füge mindestens eine Quelle hinzu");
      return;
    }

    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-client", {
        body: { urls, texts, pdfTexts },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setProfile(data as ClientProfile);
      setStep(2);
    } catch (err: any) {
      toast.error(err.message || "Analyse fehlgeschlagen");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error("Kein Profil");
      const { data, error } = await supabase.from("clients").insert({
        name: profile.name,
        summary: profile.summary,
        industry: profile.industry,
        target_audience: profile.target_audience,
        usps: profile.usps,
        tonality: profile.tonality,
        content_topics: profile.content_topics,
        monthly_reels: reels,
        monthly_carousels: carousels,
        monthly_stories: stories,
      }).select("id").single();
      if (error) throw error;
      // Trigger new_client SOP checklists
      await createNewClientChecklists(data.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients-dashboard"] });
      toast.success("Kunde erfolgreich angelegt!");
      setOpen(false);
      resetAll();
    },
    onError: (err: Error) => {
      toast.error("Fehler: " + err.message);
    },
  });

  const hasAnySources = urls.length > 0 || freeText.trim().length > 0 || pdfTexts.length > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetAll(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Neuer Kunde
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto border-border/50 bg-card/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            {step === 1 && "Quellen hinzufügen"}
            {step === 2 && "KI-Kundenprofil"}
            {step === 3 && "Kontingent festlegen"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            {step === 1 && "Lade PDFs, Links oder Notizen hoch – die KI analysiert den Kunden."}
            {step === 2 && "Das KI-generierte Profil. Klicke auf ein Feld zum Bearbeiten."}
            {step === 3 && "Lege die monatlichen Content-Kontingente fest."}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${
                s === step ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" :
                s < step ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
              }`}>
                {s}
              </div>
              {s < 3 && <div className={`w-8 h-px transition-colors ${s < step ? "bg-primary" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Sources */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Globe className="h-3.5 w-3.5" /> Website-Links</Label>
              <div className="flex gap-2">
                <Input
                  value={currentUrl}
                  onChange={(e) => setCurrentUrl(e.target.value)}
                  placeholder="https://beispiel.de"
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addUrl())}
                  className="bg-background/50"
                />
                <Button type="button" variant="outline" size="sm" onClick={addUrl}>+</Button>
              </div>
              {urls.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {urls.map((url, i) => (
                    <Badge key={i} variant="secondary" className="gap-1 text-xs">
                      {new URL(url).hostname}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setUrls((p) => p.filter((_, j) => j !== i))} />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><FileText className="h-3.5 w-3.5" /> PDF-Dokumente</Label>
              <div className="relative">
                <input type="file" accept=".pdf" multiple onChange={handlePdfUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 p-4 text-sm text-muted-foreground hover:bg-muted/30 transition-colors">
                  <Upload className="h-4 w-4" /> PDFs hier ablegen oder klicken
                </div>
              </div>
              {pdfNames.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {pdfNames.map((name, i) => (
                    <Badge key={i} variant="secondary" className="gap-1 text-xs">
                      {name}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => { setPdfNames((p) => p.filter((_, j) => j !== i)); setPdfTexts((p) => p.filter((_, j) => j !== i)); }} />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><FileText className="h-3.5 w-3.5" /> Eigene Notizen</Label>
              <Textarea value={freeText} onChange={(e) => setFreeText(e.target.value)} placeholder="Was weißt du bereits über den Kunden?" rows={4} className="bg-background/50" />
            </div>

            <Button onClick={analyze} disabled={!hasAnySources || isAnalyzing} className="w-full gap-2">
              {isAnalyzing ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> KI analysiert...</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Mit KI analysieren</>
              )}
            </Button>
          </div>
        )}

        {/* Step 2: AI Profile — Beautiful Card Layout */}
        {step === 2 && profile && (
          <div className="space-y-4">
            {/* Company Name Header */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/20 p-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  {editingField === "name" ? (
                    <Input
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      onBlur={() => setEditingField(null)}
                      onKeyDown={(e) => e.key === "Enter" && setEditingField(null)}
                      autoFocus
                      className="text-lg font-bold bg-background/50 h-9"
                    />
                  ) : (
                    <h3
                      className="text-lg font-display font-bold cursor-pointer hover:text-primary transition-colors group flex items-center gap-2"
                      onClick={() => setEditingField("name")}
                    >
                      {profile.name}
                      <PenLine className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                    </h3>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-0.5">KI-generiertes Kundenprofil</p>
                </div>
              </div>
            </motion.div>

            {/* Info Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PROFILE_SECTIONS.map(({ key, label, icon: Icon, color, iconColor }, i) => (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`rounded-xl bg-gradient-to-br ${color} border border-border/30 p-3.5 group cursor-pointer hover:border-border/60 transition-all`}
                  onClick={() => editingField !== key && setEditingField(key)}
                >
                  <div className="flex items-start gap-2.5 mb-2">
                    <div className={`w-7 h-7 rounded-lg bg-background/40 flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
                    </div>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
                      <PenLine className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0" />
                    </div>
                  </div>
                  {editingField === key ? (
                    <Input
                      value={profile[key]}
                      onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
                      onBlur={() => setEditingField(null)}
                      onKeyDown={(e) => e.key === "Enter" && setEditingField(null)}
                      autoFocus
                      className="text-sm bg-background/50 h-8"
                    />
                  ) : (
                    <p className="text-sm leading-relaxed text-foreground/90">
                      {profile[key] || <span className="text-muted-foreground italic">Nicht erkannt</span>}
                    </p>
                  )}
                </motion.div>
              ))}
            </div>

            {/* Summary */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-xl bg-gradient-to-br from-muted/50 to-muted/20 border border-border/30 p-4 group cursor-pointer hover:border-border/60 transition-all"
              onClick={() => editingField !== "summary" && setEditingField("summary")}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-background/40 flex items-center justify-center">
                  <Target className="h-3.5 w-3.5 text-foreground/60" />
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Zusammenfassung</span>
                <PenLine className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity" />
              </div>
              {editingField === "summary" ? (
                <Textarea
                  value={profile.summary}
                  onChange={(e) => setProfile({ ...profile, summary: e.target.value })}
                  onBlur={() => setEditingField(null)}
                  autoFocus
                  rows={3}
                  className="text-sm bg-background/50"
                />
              ) : (
                <p className="text-sm leading-relaxed text-foreground/80">
                  {profile.summary || <span className="text-muted-foreground italic">Keine Zusammenfassung</span>}
                </p>
              )}
            </motion.div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setStep(1)} className="gap-1">
                <ChevronLeft className="h-4 w-4" /> Zurück
              </Button>
              <Button onClick={() => setStep(3)} className="flex-1 gap-1">
                Weiter <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Kontingent */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Reels / Monat", value: reels, set: setReels, color: "from-blue-500/15 to-blue-600/5" },
                { label: "Carousels / Monat", value: carousels, set: setCarousels, color: "from-emerald-500/15 to-emerald-600/5" },
                { label: "Stories / Monat", value: stories, set: setStories, color: "from-purple-500/15 to-purple-600/5" },
              ].map(({ label, value, set, color }) => (
                <div key={label} className={`rounded-xl bg-gradient-to-br ${color} border border-border/30 p-3 space-y-2`}>
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</Label>
                  <Input type="number" min={0} value={value} onChange={(e) => set(Number(e.target.value))} className="bg-background/50 text-center text-lg font-bold h-10" />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)} className="gap-1">
                <ChevronLeft className="h-4 w-4" /> Zurück
              </Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="flex-1 gap-1">
                {saveMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Wird gespeichert...</> : "Kunde anlegen"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CreateClientDialog;
