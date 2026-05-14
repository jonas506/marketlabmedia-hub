import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FUNNEL_STAGES, slugifyTag, stageMeta, type ContentFormat, type FunnelStage } from "./constants";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  format?: ContentFormat | null;
}

const AddFormatDialog: React.FC<Props> = ({ open, onOpenChange, format }) => {
  const qc = useQueryClient();
  const isEdit = !!format;
  const [emoji, setEmoji] = useState(format?.emoji || "🎬");
  const [name, setName] = useState(format?.name || "");
  const [tag, setTag] = useState(format?.tag || "");
  const [tagTouched, setTagTouched] = useState(!!format);
  const [stage, setStage] = useState<FunnelStage>(format?.funnel_stage || "tofu");
  const [description, setDescription] = useState(format?.description || "");
  const [isActive, setIsActive] = useState(format?.is_active ?? true);
  const [saving, setSaving] = useState(false);

  // sync state when opening with different format
  const [lastId, setLastId] = useState<string | null>(format?.id ?? null);
  if (open && (format?.id ?? null) !== lastId) {
    setLastId(format?.id ?? null);
    setEmoji(format?.emoji || "🎬");
    setName(format?.name || "");
    setTag(format?.tag || "");
    setTagTouched(!!format);
    setStage(format?.funnel_stage || "tofu");
    setDescription(format?.description || "");
    setIsActive(format?.is_active ?? true);
  }

  const onNameChange = (v: string) => {
    setName(v);
    if (!tagTouched) setTag(slugifyTag(v));
  };

  const save = async () => {
    if (!name.trim() || !tag.trim()) {
      toast.error("Name und Tag sind Pflichtfelder");
      return;
    }
    setSaving(true);
    try {
      if (isEdit && format) {
        const { error } = await supabase
          .from("content_formats")
          .update({ emoji, name: name.trim(), tag: slugifyTag(tag), funnel_stage: stage, description: description.trim() || null, is_active: isActive })
          .eq("id", format.id);
        if (error) throw error;
        toast.success("Format aktualisiert");
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { error } = await supabase.from("content_formats").insert({
          emoji,
          name: name.trim(),
          tag: slugifyTag(tag),
          funnel_stage: stage,
          description: description.trim() || null,
          is_active: isActive,
          created_by: u.user?.id,
        });
        if (error) throw error;
        toast.success("Format angelegt");
      }
      qc.invalidateQueries({ queryKey: ["content_formats"] });
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
          <DialogTitle>{isEdit ? "Format bearbeiten" : "Neues Format"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-[80px_1fr] gap-3">
            <div>
              <Label className="text-xs">Emoji</Label>
              <Input value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} className="text-center text-xl mt-1" />
            </div>
            <div>
              <Label className="text-xs">Name</Label>
              <Input value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="Ratings" className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Tag</Label>
            <Input
              value={tag}
              onChange={(e) => { setTag(e.target.value); setTagTouched(true); }}
              placeholder="ratings"
              className="mt-1 font-mono text-xs"
            />
          </div>
          <div>
            <Label className="text-xs mb-1.5 block">Funnel-Stufe</Label>
            <div className="grid grid-cols-3 gap-2">
              {FUNNEL_STAGES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setStage(s.key)}
                  className={`rounded-lg border-2 px-3 py-2 text-xs font-semibold transition-all ${
                    stage === s.key ? `${s.chipClass} border-current` : "bg-muted/40 border-transparent text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <div>{s.label}</div>
                  <div className="text-[10px] font-normal opacity-80">{s.subtitle}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Beschreibung</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 text-sm" rows={3} placeholder="Wie funktioniert dieses Format?" />
          </div>
          {isEdit && (
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Aktiv</p>
                <p className="text-[11px] text-muted-foreground">Inaktive Formate erscheinen nicht in der Übersicht</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Abbrechen</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Speichert…" : "Speichern"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddFormatDialog;
