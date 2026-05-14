import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { detectSourceType, type FormatReference } from "./constants";
import { SourceIcon, SOURCE_LABEL } from "./SourceIcon";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  formatId: string;
  reference?: FormatReference | null;
}

const MAX_BYTES = 512 * 1024;

const AddReferenceDialog: React.FC<Props> = ({ open, onOpenChange, formatId, reference }) => {
  const qc = useQueryClient();
  const isEdit = !!reference;
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [isOwn, setIsOwn] = useState(false);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [existingThumb, setExistingThumb] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setUrl(reference?.url || "");
      setTitle(reference?.title || "");
      setIsOwn(reference?.is_own || false);
      setThumbFile(null);
      setExistingThumb(reference?.thumbnail_url || null);
    }
  }, [open, reference]);

  const sourceType = url ? detectSourceType(url) : "other";

  const onFile = (f: File | null) => {
    if (!f) return setThumbFile(null);
    if (f.size > MAX_BYTES) {
      toast.error("Bild zu groß", { description: "Max. 512 KB" });
      return;
    }
    setThumbFile(f);
  };

  const save = async () => {
    if (!url.trim()) { toast.error("URL ist Pflichtfeld"); return; }
    setSaving(true);
    try {
      let thumbnailUrl = existingThumb;
      const stype = detectSourceType(url);

      let refId = reference?.id;
      if (!refId) {
        // get next sort_order
        const { count } = await supabase.from("format_references").select("*", { count: "exact", head: true }).eq("format_id", formatId);
        const { data, error } = await supabase
          .from("format_references")
          .insert({
            format_id: formatId,
            url: url.trim(),
            title: title.trim() || null,
            source_type: stype,
            is_own: isOwn,
            sort_order: count ?? 0,
          })
          .select("id")
          .single();
        if (error) throw error;
        refId = data.id;
      }

      if (thumbFile && refId) {
        const ext = thumbFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${formatId}/${refId}.${ext}`;
        const { error: upErr } = await supabase.storage.from("reference-thumbnails").upload(path, thumbFile, {
          cacheControl: "3600",
          upsert: true,
          contentType: thumbFile.type,
        });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("reference-thumbnails").getPublicUrl(path);
        thumbnailUrl = `${pub.publicUrl}?v=${Date.now()}`;
      }

      const { error: updErr } = await supabase
        .from("format_references")
        .update({
          url: url.trim(),
          title: title.trim() || null,
          source_type: stype,
          is_own: isOwn,
          thumbnail_url: thumbnailUrl,
        })
        .eq("id", refId!);
      if (updErr) throw updErr;

      toast.success(isEdit ? "Referenz aktualisiert" : "Referenz hinzugefügt");
      qc.invalidateQueries({ queryKey: ["format_references", formatId] });
      qc.invalidateQueries({ queryKey: ["format_reference_counts"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Fehler", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Referenz bearbeiten" : "Referenz hinzufügen"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs">URL</Label>
            <div className="relative mt-1">
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://instagram.com/reel/..." className="pl-9" />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                <SourceIcon type={sourceType} className="h-4 w-4" />
              </span>
            </div>
            {url && <p className="text-[10px] text-muted-foreground mt-1">Erkannt als {SOURCE_LABEL[sourceType]}</p>}
          </div>
          <div>
            <Label className="text-xs">Titel (optional)</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="@immoboss — Rating Hafencity" className="mt-1" />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Eigene Produktion</p>
              <p className="text-[11px] text-muted-foreground">Markiert das Video als von uns erstellt</p>
            </div>
            <Switch checked={isOwn} onCheckedChange={setIsOwn} />
          </div>
          <div>
            <Label className="text-xs mb-1.5 block">Vorschaubild (optional, max 512 KB)</Label>
            {thumbFile ? (
              <div className="flex items-center justify-between rounded-lg border border-border p-2 text-xs">
                <span className="truncate">{thumbFile.name}</span>
                <button onClick={() => setThumbFile(null)} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
              </div>
            ) : existingThumb ? (
              <div className="flex items-center gap-3">
                <img src={existingThumb} alt="" className="h-14 w-14 object-cover rounded-md border border-border" />
                <Button type="button" variant="outline" size="sm" onClick={() => setExistingThumb(null)}>Entfernen</Button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 h-20 rounded-lg border-2 border-dashed border-border hover:border-primary/40 cursor-pointer text-xs text-muted-foreground transition-colors">
                <Upload className="h-4 w-4" />
                Bild auswählen
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] || null)} />
              </label>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Abbrechen</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Speichert…" : "Speichern"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddReferenceDialog;
