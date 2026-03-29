import { useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronLeft, ChevronRight, Download, Loader2, Sparkles, Plus, Trash2,
  Copy, Check, FileDown, ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import html2canvas from "html2canvas";

interface Slide {
  id: string;
  text: string;
  isCta?: boolean;
}

interface CarouselBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  piece: { id: string; title: string | null; client_id: string; caption?: string | null } | null;
  clientId: string;
}

const genSlideId = () => `s${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

const DEFAULT_SLIDES: Slide[] = [
  { id: genSlideId(), text: "Slide 1 — Überschrift hier" },
  { id: genSlideId(), text: "Slide 2 — Dein Punkt" },
  { id: genSlideId(), text: "Slide 3 — Weiterer Punkt" },
  { id: genSlideId(), text: "Slide 4 — Zusammenfassung" },
  { id: genSlideId(), text: "Slide 5 — CTA: Speichern & Teilen!", isCta: true },
];

const CarouselBuilder: React.FC<CarouselBuilderProps> = ({ open, onOpenChange, piece, clientId }) => {
  const [slides, setSlides] = useState<Slide[]>(DEFAULT_SLIDES);
  const [current, setCurrent] = useState(0);
  const [topic, setTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [lastPieceId, setLastPieceId] = useState<string | null>(null);
  const [customHeading, setCustomHeading] = useState("");
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Fetch client info for branding
  const { data: client } = useQuery({
    queryKey: ["client-info", clientId],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("name, logo_url, instagram_handle").eq("id", clientId).single();
      return data;
    },
    enabled: !!clientId,
  });

  // Reset when piece changes
  if (piece && piece.id !== lastPieceId) {
    setLastPieceId(piece.id);
    setSlides(DEFAULT_SLIDES.map(s => ({ ...s, id: genSlideId() })));
    setCurrent(0);
    setTopic(piece.title || "");
    setCustomHeading(client?.instagram_handle || "");
    setCustomAvatar(null);
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Show preview immediately
    const reader = new FileReader();
    reader.onload = () => setCustomAvatar(reader.result as string);
    reader.readAsDataURL(file);

    // Upload to storage and save on client
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

  const saveCustomHeading = async (value: string) => {
    setCustomHeading(value);
    // Debounced save handled on blur
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

  const updateSlide = (idx: number, text: string) => {
    setSlides(prev => prev.map((s, i) => i === idx ? { ...s, text } : s));
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
    if (!topic.trim()) {
      toast.error("Bitte ein Thema eingeben");
      return;
    }
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
          id: genSlideId(),
          text,
          isCta: i === data.slides.length - 1,
        })));
        setCurrent(0);
        toast.success(`${data.slides.length} Slides generiert!`);
      }
    } catch (err: any) {
      toast.error("Generierung fehlgeschlagen", { description: err.message });
    } finally {
      setGenerating(false);
    }
  }, [topic, slides.length, client]);

  // Export single slide as JPG
  const captureSlide = async (idx: number): Promise<HTMLCanvasElement | null> => {
    const el = slideRefs.current[idx];
    if (!el) return null;
    // Make sure element is visible
    el.style.position = "fixed";
    el.style.left = "-9999px";
    el.style.top = "0";
    el.style.display = "flex";

    const canvas = await html2canvas(el, {
      scale: 2,
      backgroundColor: "#ffffff",
      width: 500,
      height: 500,
      logging: false,
    });

    el.style.position = "";
    el.style.left = "";
    el.style.top = "";
    el.style.display = "";

    return canvas;
  };

  const downloadAllJpgs = async () => {
    setExporting(true);
    try {
      for (let i = 0; i < slides.length; i++) {
        const el = document.getElementById(`carousel-slide-${i}`);
        if (!el) continue;
        const canvas = await html2canvas(el, {
          scale: 2,
          backgroundColor: "#ffffff",
          width: 500,
          height: 500,
          logging: false,
        });
        const link = document.createElement("a");
        link.download = `${(piece?.title || "carousel").replace(/\s+/g, "-")}-slide-${i + 1}.jpg`;
        link.href = canvas.toDataURL("image/jpeg", 0.92);
        link.click();
        await new Promise(r => setTimeout(r, 400));
      }
      toast.success(`${slides.length} Slides exportiert!`);
    } catch (err: any) {
      toast.error("Export fehlgeschlagen");
    } finally {
      setExporting(false);
    }
  };

  const downloadCurrentJpg = async () => {
    const el = document.getElementById(`carousel-slide-${current}`);
    if (!el) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: "#ffffff",
        width: 500,
        height: 500,
        logging: false,
      });
      const link = document.createElement("a");
      link.download = `slide-${current + 1}.jpg`;
      link.href = canvas.toDataURL("image/jpeg", 0.92);
      link.click();
    } catch {
      toast.error("Export fehlgeschlagen");
    } finally {
      setExporting(false);
    }
  };

  const copySlideText = (idx: number) => {
    navigator.clipboard.writeText(slides[idx].text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  if (!piece) return null;

  const handle = client?.instagram_handle ? `@${client.instagram_handle.replace("@", "")}` : "";
  const displayName = customHeading.trim() || handle || client?.name || "";
  const avatarSrc = customAvatar || client?.logo_url || null;

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
          <div className="flex-1 flex flex-col items-center justify-center bg-[#111] p-6 min-w-0">
            {/* Slide Preview */}
            <div className="relative">
              {slides.map((slide, idx) => (
                <div
                  key={slide.id}
                  id={`carousel-slide-${idx}`}
                  className={cn(
                    "bg-white flex flex-col justify-center items-stretch p-10 shadow-2xl",
                    idx === current ? "block" : "hidden"
                  )}
                  style={{ width: 420, height: 420 }}
                >
                  {/* Profile row */}
                  {(avatarSrc || displayName) && (
                    <div className="flex items-center gap-3 mb-3">
                      {avatarSrc && (
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 shrink-0">
                          <img src={avatarSrc} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" />
                        </div>
                      )}
                      {displayName && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-black">{displayName}</span>
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="#0095f6">
                            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                          </svg>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 flex flex-col justify-center">
                    <p
                      className="text-black leading-relaxed whitespace-pre-wrap"
                      style={{ fontSize: slide.text.length > 200 ? 16 : slide.text.length > 100 ? 19 : 22, fontWeight: slide.isCta ? 700 : 400 }}
                    >
                      {slide.text}
                    </p>
                  </div>

                  {/* Slide number */}
                  <div className="absolute bottom-3 right-4 text-[11px] font-semibold tracking-wider text-gray-300">
                    {idx + 1} / {slides.length}
                  </div>
                </div>
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-4" style={{ width: 420 }}>
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
                  onClick={() => goTo(current - 1)}
                  disabled={current === 0}
                  className="w-8 h-8 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white/70 hover:bg-white/20 disabled:opacity-20 transition"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => goTo(current + 1)}
                  disabled={current === slides.length - 1}
                  className="w-8 h-8 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white/70 hover:bg-white/20 disabled:opacity-20 transition"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Export buttons */}
            <div className="flex gap-2 mt-4">
              <Button
                size="sm"
                variant="secondary"
                className="h-8 text-xs gap-1.5"
                onClick={downloadCurrentJpg}
                disabled={exporting}
              >
                {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                Slide als JPG
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={downloadAllJpgs}
                disabled={exporting}
              >
                {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileDown className="h-3 w-3" />}
                Alle als JPGs ({slides.length})
              </Button>
            </div>
          </div>

          {/* Right: Editor */}
          <div className="w-[340px] border-l border-border flex flex-col bg-background">
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
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1"
                  onClick={generateSlides}
                  disabled={generating || !topic.trim()}
                >
                  {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Go
                </Button>
              </div>
            </div>

            {/* Slide list */}
            <ScrollArea className="flex-1 min-h-0">
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
                        <button
                          onClick={e => { e.stopPropagation(); copySlideText(idx); }}
                          className="p-0.5 rounded text-muted-foreground hover:text-foreground transition"
                        >
                          {copiedIdx === idx ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </button>
                        {slides.length > 2 && (
                          <button
                            onClick={e => { e.stopPropagation(); removeSlide(idx); }}
                            className="p-0.5 rounded text-muted-foreground hover:text-destructive transition"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <Textarea
                      value={slide.text}
                      onChange={e => updateSlide(idx, e.target.value)}
                      onClick={e => e.stopPropagation()}
                      className="text-xs bg-transparent border-0 p-0 min-h-[48px] resize-none focus-visible:ring-0"
                      rows={2}
                    />
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
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CarouselBuilder;
