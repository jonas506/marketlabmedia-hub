import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CrmStageConfig = {
  id: string;
  value: string;
  label: string;
  color: string;
  sort_order: number;
  is_win: boolean;
  is_loss: boolean;
  pipeline_id?: string | null;
};

export type CrmPipeline = {
  id: string;
  name: string;
  created_at: string;
};

export function useCrmPipelines() {
  return useQuery({
    queryKey: ["crm-pipelines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_pipelines")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as CrmPipeline[];
    },
    staleTime: 60_000,
  });
}

export function useCrmStages(pipelineId?: string | null) {
  return useQuery({
    queryKey: ["crm-stage-config", pipelineId ?? "all"],
    queryFn: async () => {
      let query = supabase.from("crm_stage_config").select("*").order("sort_order");
      if (pipelineId) query = query.eq("pipeline_id", pipelineId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as CrmStageConfig[];
    },
    staleTime: 60_000,
  });
}

export function getStageLabel(stages: CrmStageConfig[], value: string) {
  return stages.find(s => s.value === value)?.label ?? value;
}

export function getStageColor(stages: CrmStageConfig[], value: string) {
  return stages.find(s => s.value === value)?.color ?? "#6B7280";
}

export function getPipelineStages(stages: CrmStageConfig[]) {
  return stages.filter(s => !s.is_win && !s.is_loss);
}

export function getClosedStages(stages: CrmStageConfig[]) {
  return stages.filter(s => s.is_win || s.is_loss);
}
