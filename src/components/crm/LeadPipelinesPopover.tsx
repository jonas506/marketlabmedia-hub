import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { toast } from "sonner";
import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCrmPipelines, useCrmStages } from "@/hooks/useCrmStages";
import { useLeadPipelines, setLeadPipelineStage, removeLeadFromPipeline } from "@/hooks/useLeadPipelines";

function PipelineRow({ leadId, pipelineId, name, stage, onBeforeAdd, onChanged }: {
  leadId: string;
  pipelineId: string;
  name: string;
  stage: string | null;
  onBeforeAdd: () => Promise<void>;
  onChanged: () => void;
}) {
  const { data: stages = [] } = useCrmStages(pipelineId);
  const active = stage !== null;

  const toggle = async (checked: boolean) => {
    if (checked) {
      const first = stages[0]?.value;
      if (!first) return toast.error("Diese Pipeline hat noch keine Stufen");
      await onBeforeAdd();
      const { error } = await setLeadPipelineStage(leadId, pipelineId, first);
      if (error) return toast.error("Konnte nicht hinzugefügt werden");
    } else {
      const { error } = await removeLeadFromPipeline(leadId, pipelineId);
      if (error) return toast.error("Konnte nicht entfernt werden");
    }
    onChanged();
  };


  const changeStage = async (v: string) => {
    const { error } = await setLeadPipelineStage(leadId, pipelineId, v);
    if (error) return toast.error("Speichern fehlgeschlagen");
    onChanged();
  };

  return (
    <div className="flex items-center gap-2 py-1.5">
      <Checkbox checked={active} onCheckedChange={c => toggle(!!c)} />
      <span className="text-sm flex-1 truncate">{name}</span>
      {active && (
        <Select value={stage ?? undefined} onValueChange={changeStage}>
          <SelectTrigger className="h-7 w-[130px] text-xs">
            <SelectValue placeholder="Stufe" />
          </SelectTrigger>
          <SelectContent>
            {stages.map(s => (
              <SelectItem key={s.value} value={s.value} className="text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

export default function LeadPipelinesPopover({ leadId }: { leadId: string }) {
  const qc = useQueryClient();
  const { data: pipelines = [] } = useCrmPipelines();
  const { data: memberships = [] } = useLeadPipelines();
  const mine = memberships.filter(m => m.lead_id === leadId);
  const refresh = () => qc.invalidateQueries({ queryKey: ["crm-lead-pipelines"] });

  // Leads without any explicit assignment implicitly live in their current pipeline —
  // persist that before adding a second one, so they don't vanish from the first board.
  const seedCurrent = async () => {
    if (mine.length > 0) return;
    const { data } = await supabase
      .from("crm_leads")
      .select("stage, pipeline_id")
      .eq("id", leadId)
      .maybeSingle();
    const target = data?.pipeline_id ?? pipelines[0]?.id;
    if (data && target) await setLeadPipelineStage(leadId, target, data.stage);
  };


  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1.5 px-2.5 text-xs border-border bg-transparent">
          <Layers className="h-3.5 w-3.5" />
          Pipelines
          {mine.length > 0 && (
            <span className="text-[10px] px-1.5 rounded-full bg-primary/15 text-primary">{mine.length}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <p className="text-xs text-muted-foreground mb-2">
          Der Lead kann in mehreren Pipelines liegen – mit eigener Stufe je Pipeline.
        </p>
        <div className="divide-y divide-border">
          {pipelines.map(p => (
            <PipelineRow
              key={p.id}
              leadId={leadId}
              pipelineId={p.id}
              name={p.name}
              stage={mine.find(m => m.pipeline_id === p.id)?.stage ?? null}
              onBeforeAdd={seedCurrent}
              onChanged={refresh}

            />
          ))}
          {pipelines.length === 0 && <p className="text-sm text-muted-foreground py-2">Keine Pipelines vorhanden</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
