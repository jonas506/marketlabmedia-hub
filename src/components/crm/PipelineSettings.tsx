import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, Plus, Trash2, GripVertical, Trophy, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CrmStageConfig } from "@/hooks/useCrmStages";

const PRESET_COLORS = [
  "#6B7280", "#8B5CF6", "#3B82F6", "#06B6D4", "#14B8A6",
  "#22C55E", "#84CC16", "#F59E0B", "#F97316", "#EF4444",
  "#EC4899", "#6366F1",
];

interface Props {
  stages: CrmStageConfig[];
}

export default function PipelineSettings({ stages: initialStages }: Props) {
  const [open, setOpen] = useState(false);
  const [stages, setStages] = useState<CrmStageConfig[]>([]);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setStages(initialStages.map(s => ({ ...s })));
    }
    setOpen(isOpen);
  };

  const updateStage = (index: number, updates: Partial<CrmStageConfig>) => {
    setStages(prev => prev.map((s, i) => i === index ? { ...s, ...updates } : s));
  };

  const addStage = () => {
    const maxOrder = Math.max(...stages.map(s => s.sort_order), -1);
    const closedStages = stages.filter(s => s.is_win || s.is_loss);
    const pipelineStages = stages.filter(s => !s.is_win && !s.is_loss);
    
    const newStage: CrmStageConfig = {
      id: crypto.randomUUID(),
      value: `stage_${Date.now()}`,
      label: "Neue Stufe",
      color: PRESET_COLORS[pipelineStages.length % PRESET_COLORS.length],
      sort_order: pipelineStages.length,
      is_win: false,
      is_loss: false,
    };
    
    // Insert before closed stages
    const reordered = [...pipelineStages, newStage, ...closedStages].map((s, i) => ({ ...s, sort_order: i }));
    setStages(reordered);
  };

  const removeStage = (index: number) => {
    const stage = stages[index];
    if (stage.is_win || stage.is_loss) {
      toast.error("Gewonnen/Verloren kann nicht gelöscht werden");
      return;
    }
    setStages(prev => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, sort_order: i })));
  };

  const moveStage = (index: number, direction: -1 | 1) => {
    const stage = stages[index];
    if (stage.is_win || stage.is_loss) return;
    const targetIndex = index + direction;
    const target = stages[targetIndex];
    if (!target || target.is_win || target.is_loss) return;
    
    const newStages = [...stages];
    [newStages[index], newStages[targetIndex]] = [newStages[targetIndex], newStages[index]];
    setStages(newStages.map((s, i) => ({ ...s, sort_order: i })));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete all existing, then insert fresh
      await supabase.from("crm_stage_config").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      
      const { error } = await supabase.from("crm_stage_config").insert(
        stages.map(s => ({
          id: s.id,
          value: s.value,
          label: s.label,
          color: s.color,
          sort_order: s.sort_order,
          is_win: s.is_win,
          is_loss: s.is_loss,
        }))
      );
      
      if (error) throw error;
      
      await queryClient.invalidateQueries({ queryKey: ["crm-stage-config"] });
      toast.success("Pipeline gespeichert");
      setOpen(false);
    } catch (err: any) {
      toast.error("Fehler: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const pipelineStages = stages.filter(s => !s.is_win && !s.is_loss);
  const closedStages = stages.filter(s => s.is_win || s.is_loss);

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Pipeline-Stufen verwalten</DialogTitle>
        </DialogHeader>

        <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Pipeline-Stufen</p>
          {pipelineStages.map((stage, i) => {
            const realIndex = stages.indexOf(stage);
            return (
              <StageRow
                key={stage.id}
                stage={stage}
                onUpdate={(u) => updateStage(realIndex, u)}
                onRemove={() => removeStage(realIndex)}
                onMoveUp={i > 0 ? () => moveStage(realIndex, -1) : undefined}
                onMoveDown={i < pipelineStages.length - 1 ? () => moveStage(realIndex, 1) : undefined}
              />
            );
          })}
          
          <Button variant="ghost" size="sm" className="w-full mt-1 text-xs" onClick={addStage}>
            <Plus className="h-3 w-3 mr-1" /> Stufe hinzufügen
          </Button>

          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-4 mb-2">Abschluss-Stufen</p>
          {closedStages.map(stage => {
            const realIndex = stages.indexOf(stage);
            return (
              <StageRow
                key={stage.id}
                stage={stage}
                onUpdate={(u) => updateStage(realIndex, u)}
                locked
                icon={stage.is_win ? <Trophy className="h-3.5 w-3.5 text-emerald-400" /> : <XCircle className="h-3.5 w-3.5 text-red-400" />}
              />
            );
          })}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Speichern…" : "Speichern"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StageRow({ stage, onUpdate, onRemove, onMoveUp, onMoveDown, locked, icon }: {
  stage: CrmStageConfig;
  onUpdate: (u: Partial<CrmStageConfig>) => void;
  onRemove?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  locked?: boolean;
  icon?: React.ReactNode;
}) {
  const [colorOpen, setColorOpen] = useState(false);

  return (
    <div className="flex items-center gap-2 bg-muted/30 rounded-md px-2 py-1.5 group">
      {!locked && (
        <div className="flex flex-col -space-y-1">
          <button
            onClick={onMoveUp}
            disabled={!onMoveUp}
            className="text-muted-foreground hover:text-foreground disabled:opacity-20 text-[10px] leading-none p-0.5"
          >▲</button>
          <button
            onClick={onMoveDown}
            disabled={!onMoveDown}
            className="text-muted-foreground hover:text-foreground disabled:opacity-20 text-[10px] leading-none p-0.5"
          >▼</button>
        </div>
      )}
      {icon && <span className="flex-shrink-0">{icon}</span>}
      
      <div className="relative">
        <button
          className="h-6 w-6 rounded-md border border-border flex-shrink-0 cursor-pointer"
          style={{ background: stage.color }}
          onClick={() => setColorOpen(!colorOpen)}
        />
        {colorOpen && (
          <div className="absolute top-8 left-0 z-50 bg-popover border border-border rounded-lg p-2 grid grid-cols-6 gap-1 shadow-lg">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                className={cn("h-6 w-6 rounded-md border-2 transition-all", stage.color === c ? "border-foreground scale-110" : "border-transparent hover:scale-105")}
                style={{ background: c }}
                onClick={() => { onUpdate({ color: c }); setColorOpen(false); }}
              />
            ))}
            <div className="col-span-6 mt-1">
              <Input
                type="color"
                value={stage.color}
                onChange={e => onUpdate({ color: e.target.value })}
                className="h-7 w-full p-0.5 cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      <Input
        value={stage.label}
        onChange={e => onUpdate({ label: e.target.value })}
        className="h-7 text-sm flex-1 bg-transparent border-none focus-visible:ring-1"
      />

      {!locked && onRemove && (
        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
