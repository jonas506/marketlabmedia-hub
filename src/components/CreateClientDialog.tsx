import { useState, useCallback, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createNewClientChecklists } from "@/hooks/useChecklistTriggers";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Sparkles, Loader2, ChevronRight, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { ClientProfile, TOTAL_STEPS, STEP_TITLES, STEP_DESCRIPTIONS } from "@/components/create-client/types";
import { StepSources } from "@/components/create-client";
import { StepAIProfile } from "@/components/create-client";
import { StepBranding } from "@/components/create-client";
import { StepContract } from "@/components/create-client";
import { StepStrategy } from "@/components/create-client";

const CreateClientDialog = () => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [editingField, setEditingField] = useState<string | null>(null);

  // Step 1: Sources
  const [urls, setUrls] = useState<string[]>([]);
  const [freeText, setFreeText] = useState("");
  const [pdfTexts, setPdfTexts] = useState<string[]>([]);
  const [pdfNames, setPdfNames] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Step 2: AI Profile
  const [profile, setProfile] = useState<ClientProfile | null>(null);

  // Step 3: Basis & Branding
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [driveBrandingLink, setDriveBrandingLink] = useState("");
  const [driveLogoLink, setDriveLogoLink] = useState("");
  const [driveStyleguideLink, setDriveStyleguideLink] = useState("");
  const [brandingFiles, setBrandingFiles] = useState<File[]>([]);

  // Step 4: Vertrag & Kontingent
  const [services, setServices] = useState<string[]>([]);
  const [reels, setReels] = useState(0);
  const [carousels, setCarousels] = useState(0);
  const [stories, setStories] = useState(0);
  const [youtubeLongform, setYoutubeLongform] = useState(0);
  const [contractStart, setContractStart] = useState("");
  const [contractDuration, setContractDuration] = useState("");
  const [monthlyPrice, setMonthlyPrice] = useState<number | "">("");
  const [additionalProducts, setAdditionalProducts] = useState<string[]>([]);

  // Step 5: Strategie & Abschluss
  const [strategyText, setStrategyText] = useState("");
  const [isAiStrategy, setIsAiStrategy] = useState(false);
  const [notifyEmails, setNotifyEmails] = useState<string[]>([]);
  const [clientStatus, setClientStatus] = useState("active");

  const qc = useQueryClient();

  const resetAll = () => {
    setStep(1);
    setUrls([]); setFreeText("");
    setPdfTexts([]); setPdfNames([]);
    setProfile(null); setEditingField(null); setIsAnalyzing(false);
    setContactName(""); setContactEmail(""); setContactPhone(""); setWebsiteUrl("");
    setDriveBrandingLink(""); setDriveLogoLink(""); setDriveStyleguideLink("");
    setBrandingFiles([]);
    setServices([]); setReels(0); setCarousels(0); setStories(0); setYoutubeLongform(0);
    setContractStart(""); setContractDuration(""); setMonthlyPrice("");
    setAdditionalProducts([]);
    setStrategyText(""); setIsAiStrategy(false);
    setNotifyEmails([]); setClientStatus("active");
  };

  const handlePdfUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      if (file.type !== "application/pdf") { toast.error(`${file.name} ist keine PDF-Datei`); continue; }
      if (file.size > 20 * 1024 * 1024) { toast.error(`${file.name} ist zu groß (max. 20MB)`); continue; }
      const text = await file.text();
      const readable = text.replace(/[^\x20-\x7E\xC0-\xFF\u00C0-\u024F]/g, " ").replace(/\s+/g, " ").trim().slice(0, 10000);
      setPdfTexts(prev => [...prev, readable]);
      setPdfNames(prev => [...prev, file.name]);
    }
    e.target.value = "";
  }, []);

  const handleBrandingUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const allowed = ["application/pdf", "image/svg+xml", "image/png", "image/jpeg", "image/webp"];
    for (const file of Array.from(files)) {
      if (!allowed.includes(file.type) && !file.name.endsWith(".svg")) {
        toast.error(`${file.name}: Nur PDFs, SVGs und Bilder erlaubt`);
        continue;
      }
      if (file.size > 20 * 1024 * 1024) { toast.error(`${file.name} ist zu groß (max. 20MB)`); continue; }
      setBrandingFiles(prev => [...prev, file]);
    }
    e.target.value = "";
  };

  const analyze = async () => {
    const texts = freeText.trim() ? [freeText.trim()] : [];
    if (urls.length === 0 && texts.length === 0 && pdfTexts.length === 0) {
      toast.error("Bitte füge mindestens eine Quelle hinzu");
      return;
    }
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-client", { body: { urls, texts, pdfTexts } });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setProfile(data as ClientProfile);
      if (urls.length > 0) setWebsiteUrl(urls[0]);
      setStep(2);
    } catch (err: any) {
      toast.error(err.message || "Analyse fehlgeschlagen");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateStrategy = async () => {
    if (!profile) return;
    setIsAiStrategy(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-client", {
        body: {
          urls: [],
          texts: [`Erstelle eine Social-Media-Strategie für ${profile.name}.
Branche: ${profile.industry}
Zielgruppe: ${profile.target_audience}
USPs: ${profile.usps}
Tonalität: ${profile.tonality}
Content-Themen: ${profile.content_topics}
Zusammenfassung: ${profile.summary}
Services: ${services.join(", ")}
Kontingent: ${reels} Reels, ${carousels} Karussells, ${stories} Story Ads, ${youtubeLongform} YouTube pro Monat

Erstelle eine kurze, umsetzbare Strategie (3-5 Sätze): Was ist das Ziel? Welche Content-Säulen? Welche Posting-Kadenz? Was macht den Content besonders?`],
          pdfTexts: [],
        },
      });
      if (error) throw error;
      if (data?.summary) {
        setStrategyText(data.summary);
      } else if (typeof data === "object") {
        const text = data.strategy_text || data.summary || data.content_topics || JSON.stringify(data);
        setStrategyText(typeof text === "string" ? text : JSON.stringify(text));
      }
    } catch (err: any) {
      toast.error("Strategie-Generierung fehlgeschlagen: " + (err.message || "Unbekannter Fehler"));
    } finally {
      setIsAiStrategy(false);
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
        logo_url: profile.logo_url || null,
        services,
        monthly_reels: reels,
        monthly_carousels: carousels,
        monthly_stories: stories,
        monthly_youtube_longform: youtubeLongform,
        contact_name: contactName || null,
        contact_email: contactEmail || null,
        contact_phone: contactPhone || null,
        website_url: websiteUrl || null,
        drive_branding_link: driveBrandingLink || null,
        drive_logo_link: driveLogoLink || null,
        drive_styleguide_link: driveStyleguideLink || null,
        contract_start: contractStart || null,
        contract_duration: contractDuration || null,
        monthly_price: monthlyPrice || null,
        additional_products: additionalProducts.length > 0 ? additionalProducts : null,
        strategy_text: strategyText || null,
        review_notify_emails: notifyEmails,
        status: clientStatus,
      }).select("id").single();
      if (error) throw error;
      if (brandingFiles.length > 0) {
        for (const file of brandingFiles) {
          const path = `${data.id}/ci-assets/${Date.now()}-${file.name}`;
          await supabase.storage.from("client-logos").upload(path, file, { contentType: file.type });
        }
      }
      await createNewClientChecklists(data.id);
      return data.id;
    },
    onSuccess: (clientId) => {
      qc.invalidateQueries({ queryKey: ["clients-dashboard"] });
      qc.invalidateQueries({ queryKey: ["onboarding-overview"] });
      setOpen(false);
      resetAll();
      toast.success("Kunde erfolgreich angelegt!", {
        description: "Onboarding-Checkliste wurde automatisch erstellt.",
        action: { label: "Onboarding starten →", onClick: () => window.location.href = `/client/${clientId}` },
        duration: 8000,
      });
    },
    onError: (err: Error) => { toast.error("Fehler: " + err.message); },
  });

  const hasAnySources = urls.length > 0 || freeText.trim().length > 0 || pdfTexts.length > 0;

  const handleBrandingFieldUpdate = useCallback((field: string, value: string) => {
    const setters: Record<string, (v: string) => void> = {
      contactName: setContactName, contactEmail: setContactEmail, contactPhone: setContactPhone,
      websiteUrl: setWebsiteUrl, driveBrandingLink: setDriveBrandingLink,
      driveLogoLink: setDriveLogoLink, driveStyleguideLink: setDriveStyleguideLink,
    };
    setters[field]?.(value);
  }, []);

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetAll(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Neuer Kunde
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto border-border/50 bg-card/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">{STEP_TITLES[step]}</DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">{STEP_DESCRIPTIONS[step]}</DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-1.5 mb-2">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
            <div key={s} className="flex items-center gap-1.5">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                s === step ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" :
                s < step ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
              }`}>
                {s}
              </div>
              {s < TOTAL_STEPS && <div className={`w-5 h-px transition-colors ${s < step ? "bg-primary" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.15 }}>

            {step === 1 && (
              <>
                <StepSources
                  urls={urls}
                  onAddUrl={(url) => setUrls(prev => [...prev, url])}
                  onRemoveUrl={(i) => setUrls(prev => prev.filter((_, j) => j !== i))}
                  pdfNames={pdfNames}
                  onPdfUpload={handlePdfUpload}
                  onRemovePdf={(i) => { setPdfNames(prev => prev.filter((_, j) => j !== i)); setPdfTexts(prev => prev.filter((_, j) => j !== i)); }}
                  freeText={freeText}
                  onFreeTextChange={setFreeText}
                />
                <Button onClick={analyze} disabled={!hasAnySources || isAnalyzing} className="w-full gap-2 mt-4">
                  {isAnalyzing ? <><Loader2 className="h-4 w-4 animate-spin" /> KI analysiert...</> : <><Sparkles className="h-4 w-4" /> Mit KI analysieren</>}
                </Button>
              </>
            )}

            {step === 2 && profile && (
              <>
                <StepAIProfile profile={profile} onProfileChange={setProfile} editingField={editingField} onEditField={setEditingField} />
                <NavButtons back={() => setStep(1)} next={() => setStep(3)} />
              </>
            )}

            {step === 3 && (
              <>
                <StepBranding
                  data={{ contactName, contactEmail, contactPhone, websiteUrl, driveBrandingLink, driveLogoLink, driveStyleguideLink }}
                  onUpdate={handleBrandingFieldUpdate}
                  brandingFiles={brandingFiles}
                  onBrandingUpload={handleBrandingUpload}
                  onRemoveBrandingFile={(i) => setBrandingFiles(prev => prev.filter((_, j) => j !== i))}
                />
                <NavButtons back={() => setStep(2)} next={() => setStep(4)} />
              </>
            )}

            {step === 4 && (
              <>
                <StepContract
                  contractStart={contractStart} setContractStart={setContractStart}
                  contractDuration={contractDuration} setContractDuration={setContractDuration}
                  monthlyPrice={monthlyPrice} setMonthlyPrice={setMonthlyPrice}
                  additionalProducts={additionalProducts} setAdditionalProducts={setAdditionalProducts}
                  services={services} setServices={setServices}
                  reels={reels} setReels={setReels}
                  carousels={carousels} setCarousels={setCarousels}
                  stories={stories} setStories={setStories}
                  youtubeLongform={youtubeLongform} setYoutubeLongform={setYoutubeLongform}
                />
                <NavButtons back={() => setStep(3)} next={() => setStep(5)} />
              </>
            )}

            {step === 5 && (
              <>
                <StepStrategy
                  strategyText={strategyText} setStrategyText={setStrategyText}
                  isAiStrategy={isAiStrategy} onGenerateStrategy={generateStrategy}
                  notifyEmails={notifyEmails} setNotifyEmails={setNotifyEmails}
                  clientStatus={clientStatus} setClientStatus={setClientStatus}
                />
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" onClick={() => setStep(4)} className="gap-1">
                    <ChevronLeft className="h-4 w-4" /> Zurück
                  </Button>
                  <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !profile} className="flex-1 gap-1">
                    {saveMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Wird gespeichert...</> : "Kunde anlegen"}
                  </Button>
                </div>
              </>
            )}

          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

const NavButtons: React.FC<{ back: () => void; next: () => void; nextLabel?: string; nextDisabled?: boolean }> = ({ back, next, nextLabel, nextDisabled }) => (
  <div className="flex gap-2 pt-3">
    <Button variant="outline" onClick={back} className="gap-1">
      <ChevronLeft className="h-4 w-4" /> Zurück
    </Button>
    <Button onClick={next} disabled={nextDisabled} className="flex-1 gap-1">
      {nextLabel || "Weiter"} <ChevronRight className="h-4 w-4" />
    </Button>
  </div>
);

export default CreateClientDialog;
