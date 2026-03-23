import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { ImagePlus, X, Loader2, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface CarouselSlideUploadProps {
  pieceId: string;
  clientId: string;
  slideImages: string[];
  canEdit: boolean;
  onUpdate: (pieceId: string, images: string[]) => void;
}

const CarouselSlideUpload: React.FC<CarouselSlideUploadProps> = ({
  pieceId,
  clientId,
  slideImages,
  canEdit,
  onUpdate,
}) => {
  const [uploading, setUploading] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);

    try {
      const newUrls: string[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${clientId}/${pieceId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from("carousel-slides").upload(path, file);
        if (error) throw error;
        const { data: urlData } = supabase.storage.from("carousel-slides").getPublicUrl(path);
        newUrls.push(urlData.publicUrl);
      }
      const updated = [...slideImages, ...newUrls];
      onUpdate(pieceId, updated);
      toast.success(`${newUrls.length} Slide${newUrls.length > 1 ? "s" : ""} hochgeladen`);
    } catch (err: any) {
      toast.error("Upload fehlgeschlagen", { description: err.message });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }, [pieceId, clientId, slideImages, onUpdate]);

  const removeSlide = useCallback((index: number) => {
    const updated = slideImages.filter((_, i) => i !== index);
    onUpdate(pieceId, updated);
  }, [pieceId, slideImages, onUpdate]);

  const downloadSingle = (url: string, idx: number) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `slide-${idx + 1}.jpg`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadAll = async () => {
    for (let i = 0; i < slideImages.length; i++) {
      downloadSingle(slideImages[i], i);
      // Small delay to avoid browser blocking multiple downloads
      await new Promise((r) => setTimeout(r, 300));
    }
    toast.success(`${slideImages.length} Slides heruntergeladen`);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Slide-Bilder ({slideImages.length}/10)
        </span>
        {canEdit && (
          <label className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono cursor-pointer transition-colors",
            "bg-primary/10 text-primary hover:bg-primary/20"
          )}>
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}
            {uploading ? "Lade..." : "Hochladen"}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
        )}
        {slideImages.length > 1 && (
          <button
            onClick={downloadAll}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Download className="h-3 w-3" />
            Alle laden
          </button>
        )}
      </div>

      {slideImages.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {slideImages.map((url, idx) => (
            <div
              key={idx}
              className="relative shrink-0 group rounded-lg overflow-hidden border border-border bg-muted/30 cursor-pointer"
              style={{ width: 80, height: 100 }}
              onClick={() => setLightboxIdx(idx)}
            >
              <img
                src={url}
                alt={`Slide ${idx + 1}`}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-0.5 left-0.5 bg-black/60 text-white text-[9px] font-mono px-1 rounded">
                {idx + 1}
              </div>
              {canEdit && (
                <button
                  onClick={(e) => { e.stopPropagation(); removeSlide(idx); }}
                  className="absolute top-0.5 right-0.5 p-0.5 bg-black/60 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      <Dialog open={lightboxIdx !== null} onOpenChange={() => setLightboxIdx(null)}>
        <DialogContent className="max-w-4xl p-0 bg-black/95 border-border/20 overflow-hidden [&>button]:text-white">
          {lightboxIdx !== null && (
            <div className="relative flex flex-col items-center">
              <img
                src={slideImages[lightboxIdx]}
                alt={`Slide ${lightboxIdx + 1}`}
                className="max-h-[80vh] w-auto object-contain"
              />

              {/* Navigation */}
              {slideImages.length > 1 && (
                <>
                  {lightboxIdx > 0 && (
                    <button
                      onClick={() => setLightboxIdx(lightboxIdx - 1)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                  )}
                  {lightboxIdx < slideImages.length - 1 && (
                    <button
                      onClick={() => setLightboxIdx(lightboxIdx + 1)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  )}
                </>
              )}

              {/* Bottom bar */}
              <div className="flex items-center justify-between w-full px-4 py-3 bg-black/60">
                <span className="text-white/50 text-xs font-mono">
                  {lightboxIdx + 1} / {slideImages.length}
                </span>
                <button
                  onClick={() => downloadSingle(slideImages[lightboxIdx], lightboxIdx)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono text-white/70 hover:text-white bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CarouselSlideUpload;
