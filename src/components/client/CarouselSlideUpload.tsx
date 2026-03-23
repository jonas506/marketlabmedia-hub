import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { ImagePlus, X, Loader2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
      </div>

      {slideImages.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {slideImages.map((url, idx) => (
            <div
              key={idx}
              className="relative shrink-0 group rounded-lg overflow-hidden border border-border bg-muted/30"
              style={{ width: 80, height: 100 }}
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
                  onClick={() => removeSlide(idx)}
                  className="absolute top-0.5 right-0.5 p-0.5 bg-black/60 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CarouselSlideUpload;
