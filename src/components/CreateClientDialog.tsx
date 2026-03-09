import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Upload, Globe, FileText, Sparkles, Loader2, X, ChevronRight, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface ClientProfile {
  name: string;
  industry: string;
  target_audience: string;
  usps: string;
  tonality: string;
  content_topics: string;
  summary: string;
}

const CreateClientDialog = () => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Sources
  const [urls, setUrls] = useState<string[]>([]);
  const [currentUrl, setCurrentUrl] = useState("");
  const [freeText, setFreeText] = useState("");
  const [pdfTexts, setPdfTexts] = useState<string[]>([]);
  const [pdfNames, setPdfNames] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Step 2: AI Profile
  const [profile, setProfile] = useState<ClientProfile | null>(null);

  // Step 3: Kontingent
  const [reels, setReels] = useState(0);
  const [carousels, setCarousels] = useState(0);
  const [stories, setStories] = useState(0);

  const qc = useQueryClient();

  const resetAll = () => {
    setStep(1);
    setUrls([]);
    setCurrentUrl("");
    setFreeText("");
    setPdfTexts([]);
    setPdfNames([]);
    setProfile(null);
    setReels(0);
    setCarousels(0);
    setStories(0);
    setIsAnalyzing(false);
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
      // Read as text (rough extraction)
      const text = await file.text();
      // Extract readable text from PDF binary (rough approach)
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
      const { error } = await supabase.from("clients").insert({
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
      });
      if (error) throw error;
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
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 1 && "Quellen hinzufügen"}
            {step === 2 && "KI-Kundenprofil prüfen"}
            {step === 3 && "Kontingent festlegen"}
          </DialogTitle>
          <DialogDescription>
            {step === 1 && "Lade PDFs, Links oder Notizen hoch – die KI analysiert den Kunden."}
            {step === 2 && "Prüfe und bearbeite das generierte Profil."}
            {step === 3 && "Lege die monatlichen Content-Kontingente fest."}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                s === step ? "bg-primary text-primary-foreground" :
                s < step ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
              }`}>
                {s}
              </div>
              {s < 3 && <div className={`w-8 h-px ${s < step ? "bg-primary" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Sources */}
        {step === 1 && (
          <div className="space-y-4">
            {/* URLs */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Globe className="h-4 w-4" /> Website-Links</Label>
              <div className="flex gap-2">
                <Input
                  value={currentUrl}
                  onChange={(e) => setCurrentUrl(e.target.value)}
                  placeholder="https://beispiel.de"
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addUrl())}
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

            {/* PDFs */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><FileText className="h-4 w-4" /> PDF-Dokumente</Label>
              <div className="relative">
                <input
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={handlePdfUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground hover:bg-muted/50 transition-colors">
                  <Upload className="h-4 w-4" />
                  PDFs hier ablegen oder klicken
                </div>
              </div>
              {pdfNames.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {pdfNames.map((name, i) => (
                    <Badge key={i} variant="secondary" className="gap-1 text-xs">
                      {name}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => {
                        setPdfNames((p) => p.filter((_, j) => j !== i));
                        setPdfTexts((p) => p.filter((_, j) => j !== i));
                      }} />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Free text */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><FileText className="h-4 w-4" /> Eigene Notizen</Label>
              <Textarea
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                placeholder="Was weißt du bereits über den Kunden? Branche, Zielgruppe, Besonderheiten..."
                rows={4}
              />
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

        {/* Step 2: Review AI Profile */}
        {step === 2 && profile && (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Branche</Label>
              <Input value={profile.industry} onChange={(e) => setProfile({ ...profile, industry: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Zielgruppe</Label>
              <Input value={profile.target_audience} onChange={(e) => setProfile({ ...profile, target_audience: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>USPs</Label>
              <Input value={profile.usps} onChange={(e) => setProfile({ ...profile, usps: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Tonalität</Label>
              <Input value={profile.tonality} onChange={(e) => setProfile({ ...profile, tonality: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Content-Themen</Label>
              <Input value={profile.content_topics} onChange={(e) => setProfile({ ...profile, content_topics: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Zusammenfassung</Label>
              <Textarea value={profile.summary} onChange={(e) => setProfile({ ...profile, summary: e.target.value })} rows={3} />
            </div>
            <div className="flex gap-2">
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
              <div className="space-y-2">
                <Label>Reels / Monat</Label>
                <Input type="number" min={0} value={reels} onChange={(e) => setReels(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Carousels / Monat</Label>
                <Input type="number" min={0} value={carousels} onChange={(e) => setCarousels(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Stories / Monat</Label>
                <Input type="number" min={0} value={stories} onChange={(e) => setStories(Number(e.target.value))} />
              </div>
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
