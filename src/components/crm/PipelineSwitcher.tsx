import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { CrmPipeline } from "@/hooks/useCrmStages";

const DEFAULT_STAGES = [
  { value: "interessiert", label: "Interessiert", color: "#6B7280", is_win: false, is_loss: false },
  { value: "kontaktiert", label: "Kontaktiert", color: "#3B82F6", is_win: false, is_loss: false },
  { value: "termin", label: "Termin", color: "#8B5CF6", is_win: false, is_loss: false },
  { value: "angebot", label: "Angebot", color: "#F59E0B", is_win: false, is_loss: false },
  { value: "gewonnen", label: "Gewonnen", color: "#22C55E", is_win: true, is_loss: false },
  { value: "verloren", label: "Verloren", color: "#EF4444", is_win: false, is_loss: true },
];

interface Props {
  pipelines: CrmPipeline[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

export default function PipelineSwitcher({ pipelines, activeId, onSelect }: Props) {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<null | "create" | "rename">(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const active = pipelines.find(p => p.id === activeId) ?? null;

  const createPipeline = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.from("crm_pipelines").insert({ name: name.trim() }).select().single();
    if (error || !data) {
      toast.error("Pipeline konnte nicht angelegt werden");
      setBusy(false);
      return;
    }
    const { error: stageErr } = await supabase.from("crm_stage_config").insert(
      DEFAULT_STAGES.map((s, i) => ({
        ...s,
        value: `${s.value}_${data.id.slice(0, 6)}`,
        sort_order: i,
        pipeline_id: data.id,
      }))
    );
    if (stageErr) toast.error("Stufen konnten nicht angelegt werden");
    await qc.invalidateQueries({ queryKey: ["crm-pipelines"] });
    await qc.invalidateQueries({ queryKey: ["crm-stage-config"] });
    onSelect(data.id);
    setBusy(false);
    setDialog(null);
    setName("");
    toast.success("Pipeline erstellt");
  };

  const renamePipeline = async () => {
    if (!active || !name.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("crm_pipelines").update({ name: name.trim() }).eq("id", active.id);
    setBusy(false);
    if (error) return toast.error("Umbenennen fehlgeschlagen");
    await qc.invalidateQueries({ queryKey: ["crm-pipelines"] });
    setDialog(null);
    toast.success("Umbenannt");
  };

  const deletePipeline = async () => {
    if (!active) return;
    if (pipelines.length <= 1) return toast.error("Die letzte Pipeline kann nicht gelöscht werden");
    if (!confirm(`Pipeline "${active.name}" wirklich löschen? Leads bleiben erhalten.`)) return;
    const { error } = await supabase.from("crm_pipelines").delete().eq("id", active.id);
    if (error) return toast.error("Löschen fehlgeschlagen");
    await qc.invalidateQueries({ queryKey: ["crm-pipelines"] });
    await qc.invalidateQueries({ queryKey: ["crm-stage-config"] });
    const next = pipelines.find(p => p.id !== active.id);
    if (next) onSelect(next.id);
    toast.success("Pipeline gelöscht");
  };

  return (
    <>
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {pipelines.map(p => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
              p.id === activeId ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:text-foreground"
            )}
          >
            {p.name}
          </button>
        ))}
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => { setName(""); setDialog("create"); }}>
          <Plus className="h-4 w-4" />
        </Button>
        {active && (
          <>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => { setName(active.name); setDialog("rename"); }}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={deletePipeline}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>

      <Dialog open={dialog !== null} onOpenChange={o => !o && setDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{dialog === "create" ? "Neue Pipeline" : "Pipeline umbenennen"}</DialogTitle>
          </DialogHeader>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Name der Pipeline" autoFocus />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>Abbrechen</Button>
            <Button disabled={busy || !name.trim()} onClick={dialog === "create" ? createPipeline : renamePipeline}>
              {busy ? "Speichern…" : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
