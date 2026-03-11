import { useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save, Loader2 } from "lucide-react";

interface SaveTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  htmlContent: string;
}

const SaveTemplateDialog = ({ open, onOpenChange, htmlContent }: SaveTemplateDialogProps) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("allgemein");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Bitte gib einen Namen ein");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("landing_page_templates" as any).insert({
        name: name.trim(),
        description: description.trim() || null,
        category: category.trim() || "allgemein",
        html_content: htmlContent,
      } as any);
      if (error) throw error;
      toast.success("Vorlage gespeichert!");
      onOpenChange(false);
      setName("");
      setDescription("");
      setCategory("allgemein");
    } catch (e: any) {
      toast.error("Fehler: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5 text-primary" />
            Als Vorlage speichern
          </DialogTitle>
          <DialogDescription>
            Diese Landing Page als wiederverwendbare Vorlage speichern.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs">Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Immobilien Lead-Gen"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Beschreibung</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Wofür eignet sich diese Vorlage?"
              className="mt-1 min-h-[60px]"
            />
          </div>
          <div>
            <Label className="text-xs">Kategorie</Label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="z.B. Immobilien, Lead-Gen, Event"
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SaveTemplateDialog;
