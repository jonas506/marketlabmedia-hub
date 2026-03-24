import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";
import type { Tracking } from "./constants";

interface SequenceTrackingProps {
  sequenceId: string;
  clientId: string;
  tracking: Tracking | null;
  canEdit: boolean;
  upsertField: (field: string, value: any) => Promise<void>;
}

const SequenceTracking: React.FC<SequenceTrackingProps> = React.memo(({
  sequenceId,
  clientId,
  tracking,
  canEdit,
  upsertField,
}) => {
  const [uploading, setUploading] = useState(false);
  const [screenshots, setScreenshots] = useState<string[]>(tracking?.screenshot_urls ?? []);

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      const newUrls: string[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const path = `${clientId}/${sequenceId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("story-screenshots").upload(path, file);
        if (error) throw error;
        const { data: urlData } = supabase.storage.from("story-screenshots").getPublicUrl(path);
        newUrls.push(urlData.publicUrl);
      }
      const updated = [...screenshots, ...newUrls];
      setScreenshots(updated);
      await upsertField("screenshot_urls", updated);
      toast.success(`${files.length} Screenshot(s) hochgeladen`);
    } catch {
      toast.error("Upload fehlgeschlagen");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeScreenshot = async (url: string) => {
    const updated = screenshots.filter((u) => u !== url);
    setScreenshots(updated);
    await upsertField("screenshot_urls", updated);
  };

  return (
    <div className="bg-muted/20 rounded-lg p-3 space-y-3">
      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Zusätzlich</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-muted-foreground mb-0.5 block">Profilbesuche</label>
          <Input type="number" defaultValue={tracking?.total_profile_visits ?? 0} onBlur={(e) => upsertField("total_profile_visits", parseInt(e.target.value) || 0)} disabled={!canEdit} className="h-7 text-xs font-mono bg-background border-border" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground mb-0.5 block">Keyword-Triggers</label>
          <Input type="number" defaultValue={tracking?.keyword_triggers ?? 0} onBlur={(e) => upsertField("keyword_triggers", parseInt(e.target.value) || 0)} disabled={!canEdit} className="h-7 text-xs font-mono bg-background border-border" />
        </div>
      </div>
      <div>
        <label className="text-[10px] text-muted-foreground mb-0.5 block">Notizen</label>
        <Textarea defaultValue={tracking?.notes ?? ""} onBlur={(e) => upsertField("notes", e.target.value || null)} disabled={!canEdit} placeholder="Learnings..." className="min-h-[40px] text-xs bg-background border-border resize-none" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {screenshots.map((url) => (
          <div key={url} className="relative group">
            <img src={url} alt="" className="h-16 w-16 object-cover rounded-md border border-border" />
            {canEdit && (
              <button onClick={() => removeScreenshot(url)} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full h-3.5 w-3.5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <X className="h-2 w-2" />
              </button>
            )}
          </div>
        ))}
        {canEdit && (
          <label className="h-16 w-16 rounded-md border border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors cursor-pointer">
            {uploading ? <div className="h-3 w-3 animate-spin rounded-full border border-primary/30 border-t-primary" /> : <><Upload className="h-3 w-3 mb-0.5" /><span className="text-[8px]">Upload</span></>}
            <input type="file" accept="image/*" multiple onChange={handleScreenshotUpload} className="hidden" />
          </label>
        )}
      </div>
    </div>
  );
});

SequenceTracking.displayName = "SequenceTracking";

export default SequenceTracking;
