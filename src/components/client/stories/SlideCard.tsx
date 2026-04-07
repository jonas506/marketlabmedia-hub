import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUp, ArrowDown, X, Image, Check, Copy, Download, icons } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { SLIDE_TYPES } from "./constants";
import type { Slide } from "./constants";

interface SlideCardProps {
  slide: Slide;
  index: number;
  totalSlides: number;
  isPosted: boolean;
  canEdit: boolean;
  clientId: string;
  sequenceId: string;
  onUpdateSlide: (updates: Partial<Slide>) => void;
  onDeleteSlide: () => void;
  onMoveSlide: (dir: -1 | 1) => void;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="absolute top-1 right-1 opacity-0 group-hover/text:opacity-100 transition-opacity p-1 rounded-md bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground"
      title="Kopieren"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function SlideImageUpload({ clientId, sequenceId, slideId, onUploaded }: { clientId: string; sequenceId: string; slideId: string; onUploaded: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${clientId}/${sequenceId}/slides/${slideId}.${ext}`;
      const { error } = await supabase.storage.from("story-screenshots").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("story-screenshots").getPublicUrl(path);
      onUploaded(data.publicUrl);
    } catch { toast.error("Upload fehlgeschlagen"); }
    finally { setUploading(false); }
  };
  return (
    <label className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary cursor-pointer transition-colors">
      {uploading ? <div className="h-3 w-3 animate-spin rounded-full border border-primary/30 border-t-primary" /> : <Image className="h-3 w-3" />}
      Ersetzen
      <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
    </label>
  );
}

function SlideImageUploadBox({ clientId, sequenceId, slideId, onUploaded }: { clientId: string; sequenceId: string; slideId: string; onUploaded: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${clientId}/${sequenceId}/slides/${slideId}.${ext}`;
      const { error } = await supabase.storage.from("story-screenshots").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("story-screenshots").getPublicUrl(path);
      onUploaded(data.publicUrl);
    } catch { toast.error("Upload fehlgeschlagen"); }
    finally { setUploading(false); }
  };
  return (
    <label className="h-20 w-20 shrink-0 rounded-md border border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors cursor-pointer">
      {uploading ? <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary/30 border-t-primary" /> : <><Image className="h-4 w-4 mb-0.5" /><span className="text-[8px]">Bild</span></>}
      <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
    </label>
  );
}

const SlideCard: React.FC<SlideCardProps> = React.memo(({
  slide,
  index,
  totalSlides,
  isPosted,
  canEdit,
  clientId,
  sequenceId,
  onUpdateSlide,
  onDeleteSlide,
  onMoveSlide,
}) => {
  return (
    <div className="bg-muted/30 rounded-lg p-3 flex gap-3">
      <div className="flex flex-col items-center gap-0.5 shrink-0 pt-0.5">
        <span className="bg-primary/10 text-primary rounded-full h-5 w-5 flex items-center justify-center font-mono text-[10px] font-bold">{index + 1}</span>
        {canEdit && (
          <>
            <button onClick={() => onMoveSlide(-1)} disabled={index === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors p-0.5"><ArrowUp className="h-2.5 w-2.5" /></button>
            <button onClick={() => onMoveSlide(1)} disabled={index === totalSlides - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors p-0.5"><ArrowDown className="h-2.5 w-2.5" /></button>
          </>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          {canEdit ? (
            <Select value={slide.slide_type} onValueChange={(v) => onUpdateSlide({ slide_type: v })}>
              <SelectTrigger className="h-6 text-[10px] w-[80px] bg-transparent border-border"><SelectValue /></SelectTrigger>
              <SelectContent>{SLIDE_TYPES.map((t) => { const I = icons[t.icon as keyof typeof icons]; return <SelectItem key={t.value} value={t.value}><span className="inline-flex items-center gap-1">{I && <I size={11} />} {t.label}</span></SelectItem>; })}</SelectContent>
            </Select>
          ) : (
            <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">{(() => { const found = SLIDE_TYPES.find((t) => t.value === slide.slide_type); if (!found) return null; const I = icons[found.icon as keyof typeof icons]; return <>{I && <I size={11} />} {found.label}</>; })()}</span>
          )}
          {canEdit && <button onClick={onDeleteSlide} className="ml-auto text-muted-foreground hover:text-destructive transition-colors"><X className="h-3 w-3" /></button>}
        </div>
        <div className="flex items-start gap-2.5">
          {slide.image_url ? (
            <div className="relative group shrink-0">
              <img src={slide.image_url} alt="" className="h-20 w-20 object-cover rounded-md border border-border" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center gap-1">
                {canEdit && (
                  <SlideImageUpload clientId={clientId} sequenceId={sequenceId} slideId={slide.id} onUploaded={(url) => onUpdateSlide({ image_url: url })} />
                )}
                <a href={slide.image_url} download target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-white hover:text-primary transition-colors">
                  <Download className="h-3 w-3" />
                </a>
              </div>
            </div>
          ) : canEdit ? (
            <SlideImageUploadBox clientId={clientId} sequenceId={sequenceId} slideId={slide.id} onUploaded={(url) => onUpdateSlide({ image_url: url })} />
          ) : null}
          <div className="flex-1 min-w-0">
            <div className="relative group/text">
              {canEdit ? (
                <Textarea
                  defaultValue={slide.content_text}
                  onBlur={(e) => { if (e.target.value !== slide.content_text) onUpdateSlide({ content_text: e.target.value }); }}
                  onInput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }}
                  ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                  placeholder="Story-Text..."
                  className="min-h-[48px] text-xs bg-background border-border resize-none pr-8 overflow-hidden"
                />
              ) : (
                <p className="text-xs whitespace-pre-wrap select-all cursor-text">{slide.content_text || <span className="text-muted-foreground italic select-none">Kein Text</span>}</p>
              )}
              {slide.content_text && <CopyButton text={slide.content_text} />}
            </div>
          </div>
        </div>
        {isPosted && (
          <div className="flex items-center gap-2.5 pt-1.5 mt-1.5 border-t border-border/30 flex-wrap">
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-muted-foreground">👁</span>
              <Input type="number" defaultValue={slide.slide_views || 0} onBlur={(e) => { const val = parseInt(e.target.value) || 0; if (val !== slide.slide_views) onUpdateSlide({ slide_views: val }); }} disabled={!canEdit} className="h-5 w-14 text-[10px] font-mono bg-background border-border px-1" />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-muted-foreground">💬</span>
              <Input type="number" defaultValue={slide.slide_replies || 0} onBlur={(e) => { const val = parseInt(e.target.value) || 0; if (val !== slide.slide_replies) onUpdateSlide({ slide_replies: val }); }} disabled={!canEdit} className="h-5 w-14 text-[10px] font-mono bg-background border-border px-1" />
            </div>
            {slide.slide_type === "cta" && (
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-muted-foreground">🔗</span>
                <Input type="number" defaultValue={slide.slide_clicks || 0} onBlur={(e) => { const val = parseInt(e.target.value) || 0; if (val !== slide.slide_clicks) onUpdateSlide({ slide_clicks: val }); }} disabled={!canEdit} className="h-5 w-14 text-[10px] font-mono bg-background border-border px-1" />
              </div>
            )}
            {slide.slide_views > 0 && slide.slide_type === "cta" && slide.slide_clicks > 0 && (
              <span className="text-[9px] font-mono text-emerald-400">CTR {((slide.slide_clicks / slide.slide_views) * 100).toFixed(1)}%</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

SlideCard.displayName = "SlideCard";

export default SlideCard;
