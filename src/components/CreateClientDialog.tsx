import { useState, useCallback, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createNewClientChecklists } from "@/hooks/useChecklistTriggers";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Plus, Upload, Globe, FileText, Sparkles, Loader2, X, ChevronRight, ChevronLeft,
  Building2, Users, Trophy, MessageSquare, Lightbulb, PenLine, Target,
  Phone, Mail, User, Folder, Image, BookOpen, Bell, Calendar, DollarSign, Tag,
  FileImage, Trash2
} from "lucide-react";
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
  logo_url?: string;
}

const PROFILE_SECTIONS = [
  { key: "industry", label: "Branche", icon: Building2, color: "from-blue-500/20 to-blue-600/10", iconColor: "text-blue-400" },
  { key: "target_audience", label: "Zielgruppe", icon: Users, color: "from-emerald-500/20 to-emerald-600/10", iconColor: "text-emerald-400" },
  { key: "usps", label: "USPs", icon: Trophy, color: "from-amber-500/20 to-amber-600/10", iconColor: "text-amber-400" },
  { key: "tonality", label: "Tonalität", icon: MessageSquare, color: "from-purple-500/20 to-purple-600/10", iconColor: "text-purple-400" },
  { key: "content_topics", label: "Content-Themen", icon: Lightbulb, color: "from-pink-500/20 to-pink-600/10", iconColor: "text-pink-400" },
] as const;

const TOTAL_STEPS = 5;

const STEP_TITLES: Record<number, string> = {
  1: "Quellen hinzufügen",
  2: "KI-Kundenprofil",
  3: "Basis & Branding",
  4: "Vertrag & Kontingent",
  5: "Strategie & Abschluss",
};

const STEP_DESCRIPTIONS: Record<number, string> = {
  1: "Lade PDFs, Links oder Notizen hoch – die KI analysiert den Kunden.",
  2: "Das KI-generierte Profil. Klicke auf ein Feld zum Bearbeiten.",
  3: "Kontaktdaten und Branding-Material des Kunden.",
  4: "Leistungen, Kontingente und Vertragsdetails festlegen.",
  5: "Strategie definieren, Freigabe-Benachrichtigungen und Status.",
};

const CreateClientDialog = () => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
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
  const [productInput, setProductInput] = useState("");

  // Step 5: Strategie & Abschluss
  const [strategyText, setStrategyText] = useState("");
  const [isAiStrategy, setIsAiStrategy] = useState(false);
  const [notifyEmails, setNotifyEmails] = useState<string[]>([]);
  const [notifyInput, setNotifyInput] = useState("");
  const [clientStatus, setClientStatus] = useState("active");

  const brandingFileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const resetAll = () => {
    setStep(1);
    setUrls([]); setCurrentUrl(""); setFreeText("");
    setPdfTexts([]); setPdfNames([]);
    setProfile(null); setEditingField(null); setIsAnalyzing(false);
    setContactName(""); setContactEmail(""); setContactPhone(""); setWebsiteUrl("");
    setDriveBrandingLink(""); setDriveLogoLink(""); setDriveStyleguideLink("");
    setBrandingFiles([]);
    setServices([]); setReels(0); setCarousels(0); setStories(0); setYoutubeLongform(0);
    setContractStart(""); setContractDuration(""); setMonthlyPrice("");
    setAdditionalProducts([]); setProductInput("");
    setStrategyText(""); setIsAiStrategy(false);
    setNotifyEmails([]); setNotifyInput(""); setClientStatus("active");
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
      if (file.type !== "application/pdf") { toast.error(`${file.name} ist keine PDF-Datei`); continue; }
      if (file.size > 20 * 1024 * 1024) { toast.error(`${file.name} ist zu groß (max. 20MB)`); continue; }
      const text = await file.text();
      const readable = text.replace(/[^\x20-\x7E\xC0-\xFF\u00C0-\u024F]/g, " ").replace(/\s+/g, " ").trim().slice(0, 10000);
      setPdfTexts((prev) => [...prev, readable]);
      setPdfNames((prev) => [...prev, file.name]);
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

      // Upload branding files if any
      if (brandingFiles.length > 0) {
        for (const file of brandingFiles) {
          const ext = file.name.split(".").pop() || "bin";
          const path = `${data.id}/ci-assets/${Date.now()}-${file.name}`;
          await supabase.storage.from("client-logos").upload(path, file, { contentType: file.type });
        }
      }

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

  const addProduct = () => {
    const v = productInput.trim();
    if (v) { setAdditionalProducts(prev => [...prev, v]); setProductInput(""); }
  };

  const addNotifyEmail = () => {
    const v = notifyInput.trim();
    if (v && v.includes("@")) { setNotifyEmails(prev => [...prev, v]); setNotifyInput(""); }
  };

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

            {/* ===== STEP 1: Sources ===== */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Globe className="h-3.5 w-3.5" /> Website-Links</Label>
                  <div className="flex gap-2">
                    <Input value={currentUrl} onChange={(e) => setCurrentUrl(e.target.value)} placeholder="https://beispiel.de"
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addUrl())} className="bg-background/50" />
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
                  {isAnalyzing ? <><Loader2 className="h-4 w-4 animate-spin" /> KI analysiert...</> : <><Sparkles className="h-4 w-4" /> Mit KI analysieren</>}
                </Button>
              </div>
            )}

            {/* ===== STEP 2: AI Profile ===== */}
            {step === 2 && profile && (
              <div className="space-y-4">
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/20 p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      {editingField === "name" ? (
                        <Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                          onBlur={() => setEditingField(null)} onKeyDown={(e) => e.key === "Enter" && setEditingField(null)}
                          autoFocus className="text-lg font-bold bg-background/50 h-9" />
                      ) : (
                        <h3 className="text-lg font-display font-bold cursor-pointer hover:text-primary transition-colors group flex items-center gap-2"
                          onClick={() => setEditingField("name")}>
                          {profile.name}
                          <PenLine className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                        </h3>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-0.5">KI-generiertes Kundenprofil</p>
                    </div>
                  </div>
                </motion.div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PROFILE_SECTIONS.map(({ key, label, icon: Icon, color, iconColor }, i) => (
                    <motion.div key={key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      className={`rounded-xl bg-gradient-to-br ${color} border border-border/30 p-3.5 group cursor-pointer hover:border-border/60 transition-all`}
                      onClick={() => editingField !== key && setEditingField(key)}>
                      <div className="flex items-start gap-2.5 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-background/40 flex items-center justify-center flex-shrink-0">
                          <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
                        </div>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
                          <PenLine className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0" />
                        </div>
                      </div>
                      {editingField === key ? (
                        <Input value={profile[key]} onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
                          onBlur={() => setEditingField(null)} onKeyDown={(e) => e.key === "Enter" && setEditingField(null)}
                          autoFocus className="text-sm bg-background/50 h-8" />
                      ) : (
                        <p className="text-sm leading-relaxed text-foreground/90">
                          {profile[key] || <span className="text-muted-foreground italic">Nicht erkannt</span>}
                        </p>
                      )}
                    </motion.div>
                  ))}
                </div>

                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                  className="rounded-xl bg-gradient-to-br from-muted/50 to-muted/20 border border-border/30 p-4 group cursor-pointer hover:border-border/60 transition-all"
                  onClick={() => editingField !== "summary" && setEditingField("summary")}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg bg-background/40 flex items-center justify-center">
                      <Target className="h-3.5 w-3.5 text-foreground/60" />
                    </div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Zusammenfassung</span>
                    <PenLine className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity" />
                  </div>
                  {editingField === "summary" ? (
                    <Textarea value={profile.summary} onChange={(e) => setProfile({ ...profile, summary: e.target.value })}
                      onBlur={() => setEditingField(null)} autoFocus rows={3} className="text-sm bg-background/50" />
                  ) : (
                    <p className="text-sm leading-relaxed text-foreground/80">
                      {profile.summary || <span className="text-muted-foreground italic">Keine Zusammenfassung</span>}
                    </p>
                  )}
                </motion.div>

                <NavButtons back={() => setStep(1)} next={() => setStep(3)} />
              </div>
            )}

            {/* ===== STEP 3: Basis & Branding ===== */}
            {step === 3 && (
              <div className="space-y-5">
                {/* Contact Info */}
                <div>
                  <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    <User className="h-3.5 w-3.5" /> Kontaktdaten
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Ansprechpartner</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Max Mustermann" className="pl-9 bg-background/50" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">E-Mail</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="max@firma.de" type="email" className="pl-9 bg-background/50" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Telefon</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+49 123 456789" className="pl-9 bg-background/50" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Website</Label>
                      <div className="relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://firma.de" className="pl-9 bg-background/50" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Branding Links */}
                <div>
                  <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    <Image className="h-3.5 w-3.5" /> Branding & CI
                  </Label>
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Branding-Ordner</Label>
                        <div className="relative">
                          <Folder className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input value={driveBrandingLink} onChange={(e) => setDriveBrandingLink(e.target.value)} placeholder="Drive-Link" className="pl-9 bg-background/50 text-xs" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Logo</Label>
                        <div className="relative">
                          <FileImage className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input value={driveLogoLink} onChange={(e) => setDriveLogoLink(e.target.value)} placeholder="Logo-Link" className="pl-9 bg-background/50 text-xs" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Style Guide</Label>
                        <div className="relative">
                          <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input value={driveStyleguideLink} onChange={(e) => setDriveStyleguideLink(e.target.value)} placeholder="Styleguide-Link" className="pl-9 bg-background/50 text-xs" />
                        </div>
                      </div>
                    </div>

                    {/* CI Asset Upload */}
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">CI-Assets hochladen (PDFs, SVGs, Bilder)</Label>
                      <div className="relative">
                        <input ref={brandingFileRef} type="file" accept=".pdf,.svg,.png,.jpg,.jpeg,.webp" multiple onChange={handleBrandingUpload}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                        <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 p-3 text-sm text-muted-foreground hover:bg-muted/30 transition-colors">
                          <Upload className="h-4 w-4" /> Dateien hochladen
                        </div>
                      </div>
                      {brandingFiles.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {brandingFiles.map((f, i) => (
                            <Badge key={i} variant="secondary" className="gap-1 text-xs">
                              <FileImage className="h-3 w-3" /> {f.name}
                              <X className="h-3 w-3 cursor-pointer" onClick={() => setBrandingFiles(prev => prev.filter((_, j) => j !== i))} />
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <NavButtons back={() => setStep(2)} next={() => setStep(4)} />
              </div>
            )}

            {/* ===== STEP 4: Vertrag & Kontingent ===== */}
            {step === 4 && (
              <div className="space-y-5">
                {/* Contract */}
                <div>
                  <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    <Calendar className="h-3.5 w-3.5" /> Vertragsdaten
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Vertragsbeginn</Label>
                      <Input type="date" value={contractStart} onChange={(e) => setContractStart(e.target.value)} className="bg-background/50" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Laufzeit</Label>
                      <Input value={contractDuration} onChange={(e) => setContractDuration(e.target.value)} placeholder="z.B. 12 Monate" className="bg-background/50" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Preis / Monat (€)</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input type="number" value={monthlyPrice} onChange={(e) => setMonthlyPrice(e.target.value ? Number(e.target.value) : "")} placeholder="0" className="pl-9 bg-background/50" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Additional Products */}
                <div>
                  <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    <Tag className="h-3.5 w-3.5" /> Zusatzprodukte
                  </Label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {additionalProducts.map((p, i) => (
                      <Badge key={i} variant="secondary" className="gap-1 text-xs cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors"
                        onClick={() => setAdditionalProducts(prev => prev.filter((_, j) => j !== i))}>
                        {p} <X className="h-3 w-3" />
                      </Badge>
                    ))}
                  </div>
                  <Input value={productInput} onChange={(e) => setProductInput(e.target.value)} placeholder="Neues Produkt + Enter"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addProduct(); } }} className="bg-background/50" />
                </div>

                {/* Services */}
                <div>
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 block">Leistungen</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { key: "shortform", label: "Shortform / Reels", emoji: "🎬" },
                      { key: "carousels", label: "Karussells", emoji: "🖼️" },
                      { key: "stories", label: "Story Ads", emoji: "📱" },
                      { key: "youtube_longform", label: "YouTube Longform", emoji: "🎥" },
                      { key: "website", label: "Website", emoji: "🌐" },
                    ].map(({ key, label, emoji }) => {
                      const active = services.includes(key);
                      return (
                        <button key={key} type="button"
                          onClick={() => setServices(prev => active ? prev.filter(s => s !== key) : [...prev, key])}
                          className={`flex items-center gap-2.5 rounded-xl border p-3 text-left text-sm transition-all ${
                            active ? "border-primary bg-primary/10 text-foreground shadow-sm shadow-primary/10"
                              : "border-border/40 bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:border-border"
                          }`}>
                          <span className="text-base">{emoji}</span>
                          <span className="font-medium">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Kontingent */}
                {services.length > 0 && (
                  <div>
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 block">Monatliches Kontingent</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {services.includes("shortform") && (
                        <div className="rounded-xl bg-gradient-to-br from-blue-500/15 to-blue-600/5 border border-border/30 p-3 space-y-2">
                          <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Reels / Monat</Label>
                          <Input type="number" min={0} value={reels} onChange={(e) => setReels(Number(e.target.value))} className="bg-background/50 text-center text-lg font-bold h-10" />
                        </div>
                      )}
                      {services.includes("carousels") && (
                        <div className="rounded-xl bg-gradient-to-br from-emerald-500/15 to-emerald-600/5 border border-border/30 p-3 space-y-2">
                          <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Karussells / Monat</Label>
                          <Input type="number" min={0} value={carousels} onChange={(e) => setCarousels(Number(e.target.value))} className="bg-background/50 text-center text-lg font-bold h-10" />
                        </div>
                      )}
                      {services.includes("stories") && (
                        <div className="rounded-xl bg-gradient-to-br from-purple-500/15 to-purple-600/5 border border-border/30 p-3 space-y-2">
                          <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Story Ads / Monat</Label>
                          <Input type="number" min={0} value={stories} onChange={(e) => setStories(Number(e.target.value))} className="bg-background/50 text-center text-lg font-bold h-10" />
                        </div>
                      )}
                      {services.includes("youtube_longform") && (
                        <div className="rounded-xl bg-gradient-to-br from-red-500/15 to-red-600/5 border border-border/30 p-3 space-y-2">
                          <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">YouTube Videos / Monat</Label>
                          <Input type="number" min={0} value={youtubeLongform} onChange={(e) => setYoutubeLongform(Number(e.target.value))} className="bg-background/50 text-center text-lg font-bold h-10" />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <NavButtons back={() => setStep(3)} next={() => setStep(5)} />
              </div>
            )}

            {/* ===== STEP 5: Strategie & Abschluss ===== */}
            {step === 5 && (
              <div className="space-y-5">
                {/* Strategy */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <Target className="h-3.5 w-3.5" /> Strategie & Ziel
                    </Label>
                    <Button variant="outline" size="sm" onClick={generateStrategy} disabled={isAiStrategy} className="gap-1.5 text-xs h-7">
                      {isAiStrategy ? <><Loader2 className="h-3 w-3 animate-spin" /> Generiert...</> : <><Sparkles className="h-3 w-3" /> Mit KI erstellen</>}
                    </Button>
                  </div>
                  <Textarea value={strategyText} onChange={(e) => setStrategyText(e.target.value)}
                    placeholder="Was machen wir für den Kunden? Was ist das Ziel? Oder klicke 'Mit KI erstellen'..." rows={5} className="bg-background/50" />
                </div>

                {/* Notify emails */}
                <div>
                  <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    <Bell className="h-3.5 w-3.5" /> Freigabe-Benachrichtigungen
                  </Label>
                  <p className="text-xs text-muted-foreground mb-2">E-Mail-Adressen, die bei Freigaben benachrichtigt werden.</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {notifyEmails.map((email, i) => (
                      <Badge key={i} variant="secondary" className="gap-1 text-xs cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors"
                        onClick={() => setNotifyEmails(prev => prev.filter((_, j) => j !== i))}>
                        {email} <X className="h-3 w-3" />
                      </Badge>
                    ))}
                  </div>
                  <Input value={notifyInput} onChange={(e) => setNotifyInput(e.target.value)} placeholder="email@kunde.de + Enter" type="email"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNotifyEmail(); } }} className="bg-background/50" />
                </div>

                {/* Status */}
                <div className="flex items-center justify-between rounded-xl border border-border/30 bg-muted/20 p-4">
                  <div>
                    <Label className="text-sm font-semibold">Kunde sofort aktiv?</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Kann später geändert werden</p>
                  </div>
                  <Switch checked={clientStatus === "active"} onCheckedChange={(v) => setClientStatus(v ? "active" : "paused")} />
                </div>

                {/* Final buttons */}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(4)} className="gap-1">
                    <ChevronLeft className="h-4 w-4" /> Zurück
                  </Button>
                  <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !profile} className="flex-1 gap-1">
                    {saveMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Wird gespeichert...</> : "Kunde anlegen"}
                  </Button>
                </div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

const NavButtons: React.FC<{ back: () => void; next: () => void; nextLabel?: string; nextDisabled?: boolean }> = ({ back, next, nextLabel, nextDisabled }) => (
  <div className="flex gap-2 pt-1">
    <Button variant="outline" onClick={back} className="gap-1">
      <ChevronLeft className="h-4 w-4" /> Zurück
    </Button>
    <Button onClick={next} disabled={nextDisabled} className="flex-1 gap-1">
      {nextLabel || "Weiter"} <ChevronRight className="h-4 w-4" />
    </Button>
  </div>
);

export default CreateClientDialog;
