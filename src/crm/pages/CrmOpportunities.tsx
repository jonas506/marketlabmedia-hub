import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { ChevronDown, GripVertical } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { toast } from "sonner";

export default function CrmOpportunities() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: pipelines = [] } = useQuery({
    queryKey: ["crm-pipelines"],
    queryFn: async () => {
      const { data } = await supabase.from("crm_pipelines").select("*").order("name");
      return data || [];
    },
  });

  const [selectedPipeline, setSelectedPipeline] = useState<string>("");

  const activePipeline = selectedPipeline || pipelines[0]?.id || "";

  const { data: stages = [] } = useQuery({
    queryKey: ["crm-pipeline-stages", activePipeline],
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_pipeline_stages")
        .select("*")
        .eq("pipeline_id", activePipeline)
        .order("sort_order");
      return data || [];
    },
    enabled: !!activePipeline,
  });

  const { data: opportunities = [] } = useQuery({
    queryKey: ["crm-opportunities-board", activePipeline],
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_opportunities")
        .select("*, crm_leads(id, name), crm_contacts(first_name, last_name)")
        .eq("pipeline_id", activePipeline)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!activePipeline,
  });

  const moveOpp = useMutation({
    mutationFn: async ({ oppId, stageId }: { oppId: string; stageId: string }) => {
      const opp = opportunities.find((o: any) => o.id === oppId);
      const oldStage = stages.find((s: any) => s.id === opp?.stage_id);
      const newStage = stages.find((s: any) => s.id === stageId);

      await supabase.from("crm_opportunities").update({ stage_id: stageId }).eq("id", oppId);

      if (opp?.lead_id) {
        await supabase.from("crm_activities").insert({
          lead_id: (opp as any).lead_id,
          type: "opportunity_change" as any,
          title: `Opportunity: ${oldStage?.name} → ${newStage?.name}`,
          metadata: { old_stage: oldStage?.name, new_stage: newStage?.name, value: opp?.value },
          created_by: user!.id,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-opportunities-board"] });
      toast.success("Opportunity verschoben");
    },
  });

  const handleDragStart = (e: React.DragEvent, oppId: string) => {
    e.dataTransfer.setData("oppId", oppId);
  };

  const handleDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    const oppId = e.dataTransfer.getData("oppId");
    if (oppId) moveOpp.mutate({ oppId, stageId });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-crm-border">
        <h1 className="text-xl font-bold">Opportunities</h1>
        <div className="w-56">
          <Select value={activePipeline} onValueChange={setSelectedPipeline}>
            <SelectTrigger className="bg-crm-bg border-crm-border text-crm-text">
              <SelectValue placeholder="Pipeline wählen" />
            </SelectTrigger>
            <SelectContent className="bg-crm-surface border-crm-border">
              {pipelines.map((p: any) => (
                <SelectItem key={p.id} value={p.id} className="text-crm-text">{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-3 h-full min-w-max">
          {stages.map((stage: any) => {
            const stageOpps = opportunities.filter((o: any) => o.stage_id === stage.id);
            const totalValue = stageOpps.reduce((s: number, o: any) => s + Number(o.value || 0), 0);
            return (
              <div
                key={stage.id}
                className="w-72 flex flex-col bg-crm-bg/30 rounded-xl border border-crm-border/50"
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleDrop(e, stage.id)}
              >
                {/* Stage header */}
                <div className="px-4 py-3 border-b border-crm-border/50">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                    <h3 className="text-sm font-semibold">{stage.name}</h3>
                    <span className="text-xs text-crm-muted ml-auto">{stageOpps.length}</span>
                  </div>
                  {totalValue > 0 && (
                    <p className="text-xs text-crm-muted">{totalValue.toLocaleString("de-DE")} €</p>
                  )}
                </div>

                {/* Cards */}
                <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                  {stageOpps.map((opp: any) => (
                    <div
                      key={opp.id}
                      draggable
                      onDragStart={e => handleDragStart(e, opp.id)}
                      className="p-3 rounded-lg bg-crm-surface border border-crm-border hover:border-crm-primary/30 cursor-grab active:cursor-grabbing transition-colors"
                    >
                      <Link to={`/crm/leads/${opp.crm_leads?.id}`} className="block">
                        <p className="text-sm font-medium hover:text-crm-primary transition-colors">
                          {opp.crm_leads?.name || "—"}
                        </p>
                        <p className="text-lg font-bold mt-1">
                          {Number(opp.value).toLocaleString("de-DE")} €
                        </p>
                        {opp.crm_contacts && (
                          <p className="text-xs text-crm-muted mt-1">
                            {opp.crm_contacts.first_name} {opp.crm_contacts.last_name}
                          </p>
                        )}
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
