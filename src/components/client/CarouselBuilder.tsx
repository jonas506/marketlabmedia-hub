import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ChevronLeft, ChevronRight, Download, Loader2, Sparkles, Plus, Trash2,
  Copy, Check, FileDown, ImageIcon, Upload, Save, Palette, Archive,
  ArrowUp, ArrowDown, AlignLeft, AlignCenter, AlignRight,
  Bold, Underline, Highlighter, Type,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import html2canvas from "html2canvas";
import JSZip from "jszip";
import { renderThemedSlide, type ThemeId as CarouselThemeId, type BrandColors as ThemeBrandColors } from "./carousel-themes";

const ensureFontsLoaded = async () => {
  const fontFamilies = ['Inter', 'Playfair Display', 'Outfit', 'Source Sans 3', 'Poppins'];
  try {
    await Promise.race([
      Promise.all(fontFamilies.map(font => document.fonts.load(`400 16px "${font}"`))).then(() => document.fonts.ready),
      new Promise(resolve => setTimeout(resolve, 3000)),
    ]);
  } catch {
    // Fallback to system fonts if loading fails
  }
};

interface Slide {
  id: string;
  text: string;
  body?: string;
  isCta?: boolean;
  headingSize?: number;
  bodySize?: number;
  textAlign?: "left" | "center" | "right";
}

interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
  textLight: string;
  textDark: string;
}

type FontStyle = "modern" | "editorial" | "bold" | "poppins";
type SlideFormat = "1:1" | "4:5";
type ThemeId = "numbered" | "steps" | "minimal" | "dark" | "gradient" | "card" | "creator";

interface CarouselBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  piece: { id: string; title: string | null; client_id: string; caption?: string | null } | null;
  clientId: string;
  onSaved?: () => void;
}

const genSlideId = () => `s${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

/** Wrap selected text in a textarea with an HTML tag */
const wrapSelection = (
  textarea: HTMLTextAreaElement,
  tag: string,
  onChange: (newValue: string) => void,
  attrs?: string,
) => {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  if (start === end) return; // nothing selected
  const text = textarea.value;
  const selected = text.substring(start, end);
  const openTag = attrs ? `<${tag} ${attrs}>` : `<${tag}>`;
  const closeTag = `</${tag}>`;
  const newText = text.substring(0, start) + openTag + selected + closeTag + text.substring(end);
  onChange(newText);
  // Restore cursor after React re-render
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(start + openTag.length, end + openTag.length);
  });
};

/** Auto-resize a textarea to fit its content */
const autoResize = (el: HTMLTextAreaElement) => {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
};

const DEFAULT_SLIDES: Slide[] = [
  { id: genSlideId(), text: "Slide 1 — Überschrift hier" },
  { id: genSlideId(), text: "Slide 2 — Dein Punkt" },
  { id: genSlideId(), text: "Slide 3 — Weiterer Punkt" },
  { id: genSlideId(), text: "Slide 4 — Zusammenfassung" },
  { id: genSlideId(), text: "Slide 5 — CTA: Speichern & Teilen!", isCta: true },
];

const DEFAULT_BRAND: BrandColors = {
  primary: "#1a1a2e",
  secondary: "#16213e",
  accent: "#0f3460",
  textLight: "#ffffff",
  textDark: "#1a1a2e",
};

const FONT_FAMILIES: Record<FontStyle, { heading: string; body: string }> = {
  modern: { heading: "'Inter', 'Helvetica Neue', sans-serif", body: "'Inter', 'Helvetica Neue', sans-serif" },
  editorial: { heading: "'Playfair Display', 'Georgia', serif", body: "'Source Sans 3', 'Source Sans Pro', sans-serif" },
  bold: { heading: "'Outfit', 'Inter', sans-serif", body: "'Inter', sans-serif" },
  poppins: { heading: "'Poppins', sans-serif", body: "'Poppins', sans-serif" },
};

const THEMES: { id: ThemeId; label: string; preview: (c: BrandColors) => { bg: string; accent: string; text: string } }[] = [
  {
    id: "numbered", label: "Nummeriert",
    preview: (c) => ({ bg: "#f8f6f3", accent: c.accent, text: c.textDark }),
  },
  {
    id: "steps", label: "Steps",
    preview: (c) => ({ bg: c.accent, accent: c.primary, text: c.textLight }),
  },
  {
    id: "minimal", label: "Minimal",
    preview: (c) => ({ bg: "#ffffff", accent: c.accent, text: c.textDark }),
  },
  {
    id: "dark", label: "Dark",
    preview: (c) => ({ bg: c.primary, accent: c.accent, text: c.textLight }),
  },
  {
    id: "gradient", label: "Gradient",
    preview: (c) => ({ bg: c.primary, accent: c.secondary, text: c.textLight }),
  },
  {
    id: "card", label: "Card",
    preview: (c) => ({ bg: c.accent, accent: "#ffffff", text: c.textDark }),
  },
  {
    id: "creator", label: "Creator",
    preview: () => ({ bg: "#ffffff", accent: "#1DA1F2", text: "#1a1a1a" }),
  },
];

// (Theme rendering moved to carousel-themes.tsx)


const CarouselBuilder: React.FC<CarouselBuilderProps> = ({ open, onOpenChange, piece, clientId, onSaved }) => {
  const qc = useQueryClient();
  const [slides, setSlides] = useState<Slide[]>(DEFAULT_SLIDES);
  const [current, setCurrent] = useState(0);
  const [topic, setTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingBrand, setSavingBrand] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [lastPieceId, setLastPieceId] = useState<string | null>(null);
  const [customHeading, setCustomHeading] = useState("");
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);

  // Branding state
  const [brandColors, setBrandColors] = useState<BrandColors>(DEFAULT_BRAND);
  const [fontStyle, setFontStyle] = useState<FontStyle>("modern");
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>("dark");
  const [selectedFormat, setSelectedFormat] = useState<SlideFormat>("4:5");

  // Fetch client info for branding
  const { data: client } = useQuery({
    queryKey: ["client-info-brand", clientId],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select(
        "name, logo_url, instagram_handle, brand_primary, brand_secondary, brand_accent, brand_text_light, brand_text_dark, brand_font_style"
      ).eq("id", clientId).single();
      return data;
    },
    enabled: !!clientId,
  });

  // Sync branding from client data
  useEffect(() => {
    if (!client) return;
    setBrandColors({
      primary: client.brand_primary || DEFAULT_BRAND.primary,
      secondary: client.brand_secondary || DEFAULT_BRAND.secondary,
      accent: client.brand_accent || DEFAULT_BRAND.accent,
      textLight: client.brand_text_light || DEFAULT_BRAND.textLight,
      textDark: client.brand_text_dark || DEFAULT_BRAND.textDark,
    });
    setFontStyle((client.brand_font_style as FontStyle) || "modern");
  }, [client]);

  const cacheKey = piece ? `carousel-draft-${piece.id}` : null;

  // Restore from cache when piece changes
  if (piece && piece.id !== lastPieceId) {
    setLastPieceId(piece.id);
    const cached = localStorage.getItem(`carousel-draft-${piece.id}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setSlides(parsed.slides || DEFAULT_SLIDES.map(s => ({ ...s, id: genSlideId() })));
        setTopic(parsed.topic || piece.title || "");
        if (parsed.theme) setSelectedTheme(parsed.theme);
        if (parsed.format) setSelectedFormat(parsed.format);
        setCurrent(0);
      } catch {
        setSlides(DEFAULT_SLIDES.map(s => ({ ...s, id: genSlideId() })));
        setTopic(piece.title || "");
        setCurrent(0);
      }
    } else {
      setSlides(DEFAULT_SLIDES.map(s => ({ ...s, id: genSlideId() })));
      setCurrent(0);
      setTopic(piece.title || "");
    }
    setCustomHeading(client?.instagram_handle || "");
    setCustomAvatar(null);
  }

  // Auto-save draft to localStorage
  useEffect(() => {
    if (!cacheKey || !lastPieceId) return;
    const timeout = setTimeout(() => {
      localStorage.setItem(cacheKey, JSON.stringify({ slides, topic, theme: selectedTheme, format: selectedFormat }));
    }, 500);
    return () => clearTimeout(timeout);
  }, [slides, topic, cacheKey, lastPieceId, selectedTheme, selectedFormat]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCustomAvatar(reader.result as string);
    reader.readAsDataURL(file);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${clientId}/logo.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("client-logos").upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from("client-logos").getPublicUrl(path);
      const publicUrl = urlData.publicUrl + "?t=" + Date.now();
      await supabase.from("clients").update({ logo_url: publicUrl }).eq("id", clientId);
      toast.success("Profilbild gespeichert");
    } catch (err: any) {
      console.error(err);
      toast.error("Fehler beim Speichern des Profilbilds");
    }
  };

  const handleHeadingBlur = async () => {
    if (!customHeading.trim()) return;
    try {
      await supabase.from("clients").update({ instagram_handle: customHeading.trim() }).eq("id", clientId);
      toast.success("Name gespeichert");
    } catch {
      toast.error("Fehler beim Speichern");
    }
  };

  const saveBrandColors = async () => {
    setSavingBrand(true);
    try {
      await supabase.from("clients").update({
        brand_primary: brandColors.primary,
        brand_secondary: brandColors.secondary,
        brand_accent: brandColors.accent,
        brand_text_light: brandColors.textLight,
        brand_text_dark: brandColors.textDark,
        brand_font_style: fontStyle,
      }).eq("id", clientId);
      qc.invalidateQueries({ queryKey: ["client-info-brand", clientId] });
      toast.success("Branding gespeichert!");
    } catch {
      toast.error("Fehler beim Speichern");
    } finally {
      setSavingBrand(false);
    }
  };

  const updateSlide = (idx: number, text: string) => {
    setSlides(prev => prev.map((s, i) => i === idx ? { ...s, text } : s));
  };

  const updateSlideBody = (idx: number, body: string) => {
    setSlides(prev => prev.map((s, i) => i === idx ? { ...s, body } : s));
  };

  const updateSlideProp = (idx: number, prop: Partial<Slide>) => {
    setSlides(prev => prev.map((s, i) => i === idx ? { ...s, ...prop } : s));
  };

  const moveSlide = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= slides.length) return;
    setSlides(prev => {
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
    setCurrent(target);
  };

  const addSlide = () => {
    if (slides.length >= 10) return;
    setSlides(prev => [...prev, { id: genSlideId(), text: `Slide ${prev.length + 1}` }]);
  };

  const removeSlide = (idx: number) => {
    if (slides.length <= 2) return;
    setSlides(prev => prev.filter((_, i) => i !== idx));
    if (current >= slides.length - 1) setCurrent(Math.max(0, slides.length - 2));
  };

  const goTo = (idx: number) => setCurrent(Math.max(0, Math.min(slides.length - 1, idx)));

  // AI generation
  const generateSlides = useCallback(async () => {
    if (!topic.trim()) { toast.error("Bitte ein Thema eingeben"); return; }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("cb-generate", {
        body: {
          action: "carousel_slides",
          topic: topic.trim(),
          slideCount: slides.length,
          clientName: client?.name || "",
          handle: client?.instagram_handle || "",
        },
      });
      if (error) throw error;
      if (data?.slides && Array.isArray(data.slides)) {
        setSlides(data.slides.map((text: string, i: number) => ({
          id: genSlideId(), text, isCta: i === data.slides.length - 1,
        })));
        setCurrent(0);
        toast.success(`${data.slides.length} Slides generiert!`);
      }
    } catch (err: any) {
      toast.error("Generierung fehlgeschlagen", { description: err.message });
    } finally { setGenerating(false); }
  }, [topic, slides.length, client]);

  // Slide dimensions
  const slideW = 500;
  const slideH = selectedFormat === "4:5" ? 625 : 500;

  // Auto-scale preview to fit container
  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container) return;
    const calcScale = () => {
      const rect = container.getBoundingClientRect();
      const availW = rect.width - 32;
      const availH = rect.height - 140; // space for nav + buttons
      const s = Math.min(availW / slideW, availH / slideH, 1);
      setPreviewScale(Math.max(0.3, s));
    };
    calcScale();
    const ro = new ResizeObserver(calcScale);
    ro.observe(container);
    return () => ro.disconnect();
  }, [slideW, slideH, open]);
  const exportScale = 1080 / 500; // ~2.16

  // Helper: make all slide wrappers visible for export, restore after
  const withAllSlidesVisible = async <T,>(fn: () => Promise<T>): Promise<T> => {
    const wrappers = slides.map((_, i) => {
      const el = document.getElementById(`carousel-slide-${i}`);
      return el?.parentElement as HTMLElement | null;
    });
    wrappers.forEach(w => { if (w) { w.style.opacity = "1"; w.style.pointerEvents = "auto"; } });
    try {
      return await fn();
    } finally {
      wrappers.forEach((w, i) => {
        if (w) { w.style.opacity = i === current ? "1" : "0"; w.style.pointerEvents = i === current ? "auto" : "none"; }
      });
    }
  };

  const downloadAllJpgs = async () => {
    setExporting(true);
    try {
      await ensureFontsLoaded();
      await withAllSlidesVisible(async () => {
        for (let i = 0; i < slides.length; i++) {
          const el = document.getElementById(`carousel-slide-${i}`);
          if (!el) continue;
          const canvas = await html2canvas(el, { scale: exportScale, backgroundColor: null, width: slideW, height: slideH, logging: false, useCORS: true });
          const link = document.createElement("a");
          link.download = `${(piece?.title || "carousel").replace(/\s+/g, "-")}-slide-${i + 1}.jpg`;
          link.href = canvas.toDataURL("image/jpeg", 0.95);
          link.click();
          await new Promise(r => setTimeout(r, 400));
        }
      });
      toast.success(`${slides.length} Slides exportiert!`);
    } catch {
      toast.error("Export fehlgeschlagen — bitte Seite neu laden");
    } finally { setExporting(false); }
  };

  const downloadAsZip = async () => {
    setExporting(true);
    try {
      await ensureFontsLoaded();
      await withAllSlidesVisible(async () => {
        const zip = new JSZip();
        const folder = zip.folder("carousel") || zip;
        for (let i = 0; i < slides.length; i++) {
          const el = document.getElementById(`carousel-slide-${i}`);
          if (!el) continue;
          const canvas = await html2canvas(el, { scale: exportScale, backgroundColor: null, width: slideW, height: slideH, logging: false, useCORS: true });
          const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
          const base64 = dataUrl.split(",")[1];
          folder.file(`slide-${i + 1}.jpg`, base64, { base64: true });
        }
        const blob = await zip.generateAsync({ type: "blob" });
        const link = document.createElement("a");
        link.download = `${(piece?.title || "carousel").replace(/\s+/g, "-")}.zip`;
        link.href = URL.createObjectURL(blob);
        link.click();
        URL.revokeObjectURL(link.href);
      });
      toast.success(`ZIP mit ${slides.length} Slides heruntergeladen!`);
    } catch {
      toast.error("Export fehlgeschlagen — bitte Seite neu laden");
    } finally { setExporting(false); }
  };

  const downloadCurrentJpg = async () => {
    const el = document.getElementById(`carousel-slide-${current}`);
    if (!el) return;
    setExporting(true);
    try {
      await ensureFontsLoaded();
      const canvas = await html2canvas(el, { scale: exportScale, backgroundColor: null, width: slideW, height: slideH, logging: false, useCORS: true });
      const link = document.createElement("a");
      link.download = `slide-${current + 1}.jpg`;
      link.href = canvas.toDataURL("image/jpeg", 0.95);
      link.click();
    } catch { toast.error("Export fehlgeschlagen — bitte Seite neu laden"); }
    finally { setExporting(false); }
  };

  const saveAndUploadSlides = async () => {
    if (!piece) return;
    setSaving(true);
    try {
      await ensureFontsLoaded();
      const urls: string[] = [];
      await withAllSlidesVisible(async () => {
        for (let i = 0; i < slides.length; i++) {
          const el = document.getElementById(`carousel-slide-${i}`);
          if (!el) continue;
          const canvas = await html2canvas(el, { scale: exportScale, backgroundColor: null, width: slideW, height: slideH, logging: false, useCORS: true });
          const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.95));
          const path = `${clientId}/${piece.id}/slide-${i + 1}.jpg`;
          const { error: uploadErr } = await supabase.storage.from("carousel-slides").upload(path, blob, { upsert: true, contentType: "image/jpeg" });
          if (uploadErr) throw uploadErr;
          const { data: urlData } = supabase.storage.from("carousel-slides").getPublicUrl(path);
          urls.push(urlData.publicUrl + "?t=" + Date.now());
        }
      });
      const { error: updateErr } = await supabase.from("content_pieces").update({ slide_images: urls }).eq("id", piece.id);
      if (updateErr) throw updateErr;
      toast.success(`${urls.length} Slides gespeichert & bereit zur Freigabe!`);
      onSaved?.();
    } catch (err: any) {
      console.error(err);
      toast.error("Fehler beim Hochladen", { description: err.message });
    } finally { setSaving(false); }
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "s") {
        e.preventDefault();
        saveBrandColors();
      } else if (mod && e.key === "e") {
        e.preventDefault();
        downloadAllJpgs();
      } else if (e.key === "ArrowLeft" && !mod && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setCurrent(prev => Math.max(0, prev - 1));
      } else if (e.key === "ArrowRight" && !mod && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setCurrent(prev => Math.min(slides.length - 1, prev + 1));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, slides.length]);

  const copySlideText = (idx: number) => {
    navigator.clipboard.writeText(slides[idx].text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  if (!piece) return null;

  const handle = client?.instagram_handle ? `@${client.instagram_handle.replace("@", "")}` : "";
  const displayName = customHeading.trim() || handle || client?.name || "";
  const avatarSrc = customAvatar || client?.logo_url || null;

  // Render a single themed slide using the theme system
  const fonts = FONT_FAMILIES[fontStyle];
  const renderSlide = (slide: Slide, idx: number, isVisible: boolean) => {
    return renderThemedSlide(selectedTheme, {
      slide,
      index: idx,
      totalSlides: slides.length,
      brandColors,
      fonts,
      avatarSrc,
      displayName,
      format: selectedFormat,
      slideW,
      slideH,
      isVisible,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col p-0 gap-0" aria-describedby={undefined}>
        <DialogHeader className="px-5 pt-4 pb-3 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2 text-sm font-display">
            <ImageIcon className="h-4 w-4 text-primary" />
            Carousel Builder — {piece.title || "Ohne Titel"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left: Preview */}
          <div ref={previewContainerRef} className="flex-1 flex flex-col items-center bg-[#111] p-4 min-w-0 overflow-hidden">
            <div className="relative shrink-0" style={{ width: slideW * previewScale, height: slideH * previewScale }}>
              {slides.map((slide, idx) => (
                <div key={slide.id} style={{ position: 'absolute', top: 0, left: 0, width: slideW, height: slideH, transition: 'opacity 200ms ease', opacity: idx === current ? 1 : 0, pointerEvents: idx === current ? 'auto' : 'none', transform: `scale(${previewScale})`, transformOrigin: 'top left' }}>
                  {renderSlide(slide, idx, true)}
                </div>
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-4" style={{ width: slideW }}>
              <div className="flex gap-1.5 items-center">
                {slides.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => goTo(idx)}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      idx === current ? "w-8 bg-white" : "w-5 bg-white/20 hover:bg-white/40"
                    )}
                  />
                ))}
              </div>
              <span className="text-[11px] font-mono tracking-wider text-white/30 uppercase">
                Slide {current + 1} / {slides.length}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => goTo(current - 1)} disabled={current === 0}
                  className="w-8 h-8 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white/70 hover:bg-white/20 disabled:opacity-20 transition"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => goTo(current + 1)} disabled={current === slides.length - 1}
                  className="w-8 h-8 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white/70 hover:bg-white/20 disabled:opacity-20 transition"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Export buttons */}
            <div className="flex gap-2 mt-4 flex-wrap justify-center">
              <Button size="sm" variant="secondary" className="h-8 text-xs gap-1.5" onClick={downloadCurrentJpg} disabled={exporting || saving}>
                {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                Slide als JPG
              </Button>
              <Button size="sm" variant="secondary" className="h-8 text-xs gap-1.5" onClick={downloadAllJpgs} disabled={exporting || saving}>
                {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileDown className="h-3 w-3" />}
                Alle als JPGs
              </Button>
              <Button size="sm" variant="secondary" className="h-8 text-xs gap-1.5" onClick={downloadAsZip} disabled={exporting || saving}>
                {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Archive className="h-3 w-3" />}
                Alle als ZIP
              </Button>
              <Button size="sm" className="h-8 text-xs gap-1.5" onClick={saveAndUploadSlides} disabled={saving || exporting}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                Speichern & Freigabe
              </Button>
            </div>
          </div>

          {/* Right: Editor */}
          <ScrollArea className="w-[340px] border-l border-border bg-background">
            {/* Profile settings */}
            <div className="p-4 border-b border-border space-y-3">
              <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Profil & Überschrift</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  className="w-10 h-10 rounded-full overflow-hidden bg-muted border border-border hover:border-primary/40 transition shrink-0 flex items-center justify-center"
                >
                  {avatarSrc ? (
                    <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                <Input
                  value={customHeading}
                  onChange={e => setCustomHeading(e.target.value)}
                  onBlur={handleHeadingBlur}
                  placeholder={handle || client?.name || "Name / Handle"}
                  className="h-8 text-xs flex-1"
                />
                {(customAvatar || customHeading) && (
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0" onClick={() => { setCustomAvatar(null); setCustomHeading(""); }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>

            {/* Stil & Branding */}
            <div className="p-4 border-b border-border space-y-3">
              <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Palette className="h-3 w-3" /> Stil & Branding
              </label>

              {/* Format picker */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Format</span>
                <div className="flex gap-2">
                  {(["4:5", "1:1"] as SlideFormat[]).map(fmt => (
                    <button
                      key={fmt}
                      onClick={() => setSelectedFormat(fmt)}
                      className={cn(
                        "flex-1 h-8 rounded-md border text-xs font-medium transition-all",
                        selectedFormat === fmt
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/30"
                      )}
                    >
                      {fmt === "1:1" ? "1:1 Quadratisch" : "4:5 Hochformat"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Theme picker */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Theme</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {THEMES.map(theme => {
                    const p = theme.preview(brandColors);
                    return (
                      <button
                        key={theme.id}
                        onClick={() => setSelectedTheme(theme.id)}
                        className={cn(
                          "aspect-[3/4] rounded-lg border p-2 flex flex-col items-start justify-end transition-all relative overflow-hidden",
                          selectedTheme === theme.id
                            ? "border-primary ring-1 ring-primary/30"
                            : "border-border hover:border-primary/20"
                        )}
                        style={{ background: p.bg.includes("gradient") ? undefined : p.bg, ...(p.bg.includes("gradient") ? {} : {}) }}
                      >
                        <div className="absolute inset-0" style={{
                          background: p.bg.includes("#") && !p.bg.includes("gradient") ? p.bg : `linear-gradient(135deg, ${brandColors.primary}, ${brandColors.secondary})`,
                        }} />
                        <div className="relative z-10 w-full space-y-1">
                          <div style={{ height: 2, width: "60%", borderRadius: 1, background: p.accent, opacity: 0.7 }} />
                          <div style={{ height: 2, width: "40%", borderRadius: 1, background: p.text, opacity: 0.3 }} />
                        </div>
                        <span className="relative z-10 text-[8px] font-bold mt-1" style={{ color: p.text, opacity: 0.8 }}>
                          {theme.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Color pickers */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Farben</span>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { key: "primary" as const, label: "Primär" },
                    { key: "secondary" as const, label: "Sekundär" },
                    { key: "accent" as const, label: "Akzent" },
                    { key: "textLight" as const, label: "Text" },
                  ]).map(({ key, label }) => (
                    <div key={key} className="space-y-1">
                      <span className="text-[9px] text-muted-foreground block truncate">{label}</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="color"
                          value={brandColors[key]}
                          onChange={e => setBrandColors(prev => ({ ...prev, [key]: e.target.value }))}
                          className="w-7 h-7 rounded border border-border cursor-pointer shrink-0"
                        />
                        <Input
                          value={brandColors[key]}
                          onChange={e => {
                            let v = e.target.value;
                            if (!v.startsWith("#")) v = "#" + v;
                            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) {
                              setBrandColors(prev => ({ ...prev, [key]: v }));
                            }
                          }}
                          className="h-7 text-[10px] font-mono px-1.5 flex-1"
                          maxLength={7}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Font style */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Schriftart</span>
                <Select value={fontStyle} onValueChange={(v) => setFontStyle(v as FontStyle)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="modern">Modern (Sans-Serif)</SelectItem>
                    <SelectItem value="editorial">Editorial (Serif)</SelectItem>
                    <SelectItem value="bold">Bold (Display)</SelectItem>
                    <SelectItem value="poppins">Poppins</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Save branding */}
              <Button size="sm" variant="outline" className="w-full h-7 text-[10px] gap-1.5" onClick={saveBrandColors} disabled={savingBrand}>
                {savingBrand ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Farben für Kunde speichern
              </Button>
            </div>

            {/* AI Generate */}
            <div className="p-4 border-b border-border space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">KI-Generierung</label>
              <div className="flex gap-2">
                <Input
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  placeholder="Thema eingeben..."
                  className="h-8 text-xs flex-1"
                  onKeyDown={e => e.key === "Enter" && generateSlides()}
                />
                <Button size="sm" className="h-8 text-xs gap-1" onClick={generateSlides} disabled={generating || !topic.trim()}>
                  {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Go
                </Button>
              </div>
            </div>

            {/* Slide list */}
            <div>
              <div className="p-3 space-y-2">
                {slides.map((slide, idx) => (
                  <div
                    key={slide.id}
                    onClick={() => goTo(idx)}
                    className={cn(
                      "rounded-lg border p-3 cursor-pointer transition-all",
                      idx === current
                        ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                        : "border-border hover:border-primary/20"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-mono font-bold text-muted-foreground">
                        {idx + 1}{slide.isCta ? " — CTA" : ""}
                      </span>
                      <div className="flex gap-1">
                        <button onClick={e => { e.stopPropagation(); moveSlide(idx, -1); }} disabled={idx === 0} className="p-0.5 rounded text-muted-foreground hover:text-foreground transition disabled:opacity-20">
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button onClick={e => { e.stopPropagation(); moveSlide(idx, 1); }} disabled={idx === slides.length - 1} className="p-0.5 rounded text-muted-foreground hover:text-foreground transition disabled:opacity-20">
                          <ArrowDown className="h-3 w-3" />
                        </button>
                        <button onClick={e => { e.stopPropagation(); copySlideText(idx); }} className="p-0.5 rounded text-muted-foreground hover:text-foreground transition">
                          {copiedIdx === idx ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </button>
                        {slides.length > 2 && (
                          <button onClick={e => { e.stopPropagation(); removeSlide(idx); }} className="p-0.5 rounded text-muted-foreground hover:text-destructive transition">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <Textarea
                      ref={el => { if (el) { (el as any).__slideField = 'heading'; autoResize(el); } }}
                      id={`slide-heading-${idx}`}
                      value={slide.text}
                      onChange={e => { updateSlide(idx, e.target.value); autoResize(e.target); }}
                      onClick={e => e.stopPropagation()}
                      placeholder="Überschrift…"
                      className="text-xs bg-transparent border-0 p-0 min-h-[28px] resize-none focus-visible:ring-0 font-semibold overflow-hidden"
                      rows={1}
                    />
                    <Textarea
                      ref={el => { if (el) { (el as any).__slideField = 'body'; autoResize(el); } }}
                      id={`slide-body-${idx}`}
                      value={slide.body || ""}
                      onChange={e => { updateSlideBody(idx, e.target.value); autoResize(e.target); }}
                      onClick={e => e.stopPropagation()}
                      placeholder="Fließtext (optional)…"
                      className="text-[11px] bg-transparent border-0 p-0 min-h-[28px] resize-none focus-visible:ring-0 text-muted-foreground overflow-hidden"
                      rows={1}
                    />
                    {/* Formatting toolbar */}
                    <div className="flex items-center gap-1 mt-1.5" onClick={e => e.stopPropagation()}>
                      <span className="text-[9px] text-muted-foreground mr-1">Format:</span>
                      {([
                        { icon: Bold, tag: "b", label: "Fett" },
                        { icon: Underline, tag: "u", label: "Unterstrichen" },
                      ] as const).map(({ icon: Icon, tag, label }) => (
                        <button
                          key={tag}
                          title={label}
                          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition"
                          onMouseDown={e => {
                            e.preventDefault();
                            // Find the focused textarea within this slide card
                            const headingEl = document.getElementById(`slide-heading-${idx}`) as HTMLTextAreaElement | null;
                            const bodyEl = document.getElementById(`slide-body-${idx}`) as HTMLTextAreaElement | null;
                            const active = document.activeElement;
                            const target = active === bodyEl ? bodyEl : headingEl;
                            if (target) {
                              const setter = target === bodyEl ? (v: string) => updateSlideBody(idx, v) : (v: string) => updateSlide(idx, v);
                              wrapSelection(target, tag, setter);
                            }
                          }}
                        >
                          <Icon className="h-3 w-3" />
                        </button>
                      ))}
                      <button
                        title="Farblich hervorheben"
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition"
                        onMouseDown={e => {
                          e.preventDefault();
                          const headingEl = document.getElementById(`slide-heading-${idx}`) as HTMLTextAreaElement | null;
                          const bodyEl = document.getElementById(`slide-body-${idx}`) as HTMLTextAreaElement | null;
                          const active = document.activeElement;
                          const target = active === bodyEl ? bodyEl : headingEl;
                          if (target) {
                            const setter = target === bodyEl ? (v: string) => updateSlideBody(idx, v) : (v: string) => updateSlide(idx, v);
                            wrapSelection(target, "mark", setter);
                          }
                        }}
                      >
                        <Highlighter className="h-3 w-3" />
                      </button>
                      {/* Inline font-size */}
                      <Select
                        value=""
                        onValueChange={(size) => {
                          const headingEl = document.getElementById(`slide-heading-${idx}`) as HTMLTextAreaElement | null;
                          const bodyEl = document.getElementById(`slide-body-${idx}`) as HTMLTextAreaElement | null;
                          const active = document.activeElement;
                          const target = active === bodyEl ? bodyEl : headingEl;
                          if (target) {
                            const setter = target === bodyEl ? (v: string) => updateSlideBody(idx, v) : (v: string) => updateSlide(idx, v);
                            wrapSelection(target, "span", setter, `style="font-size:${size}px"`);
                          }
                        }}
                      >
                        <SelectTrigger className="h-6 w-16 text-[9px] px-1.5 gap-0.5 border-border/50" title="Schriftgröße für Auswahl">
                          <Type className="h-3 w-3 shrink-0" />
                          <span>Größe</span>
                        </SelectTrigger>
                        <SelectContent>
                          {[12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48].map(s => (
                            <SelectItem key={s} value={String(s)} className="text-xs">{s}px</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                          }
                        }}
                      >
                        <Highlighter className="h-3 w-3" />
                      </button>
                    </div>
                    {/* Font size & alignment controls */}
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1 flex-1">
                        <span className="text-[9px] text-muted-foreground shrink-0">H:</span>
                        <Input
                          type="number"
                          value={slide.headingSize || ""}
                          onChange={e => updateSlideProp(idx, { headingSize: e.target.value ? Number(e.target.value) : undefined })}
                          placeholder="auto"
                          className="h-6 text-[10px] w-14 px-1"
                          min={12}
                          max={72}
                        />
                        <span className="text-[9px] text-muted-foreground shrink-0 ml-1">B:</span>
                        <Input
                          type="number"
                          value={slide.bodySize || ""}
                          onChange={e => updateSlideProp(idx, { bodySize: e.target.value ? Number(e.target.value) : undefined })}
                          placeholder="auto"
                          className="h-6 text-[10px] w-14 px-1"
                          min={10}
                          max={48}
                        />
                      </div>
                      <div className="flex gap-0.5">
                        {(["left", "center", "right"] as const).map(align => (
                          <button
                            key={align}
                            onClick={() => updateSlideProp(idx, { textAlign: align })}
                            className={cn(
                              "p-1 rounded transition",
                              (slide.textAlign || "left") === align
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {align === "left" && <AlignLeft className="h-3 w-3" />}
                            {align === "center" && <AlignCenter className="h-3 w-3" />}
                            {align === "right" && <AlignRight className="h-3 w-3" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}

                {slides.length < 10 && (
                  <button
                    onClick={addSlide}
                    className="w-full py-2 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-primary/30 hover:text-primary transition flex items-center justify-center gap-1.5"
                  >
                    <Plus className="h-3 w-3" /> Slide hinzufügen
                  </button>
                )}
              </div>
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CarouselBuilder;
