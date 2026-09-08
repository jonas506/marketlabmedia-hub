import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type LeadPipelineMembership = {
  id: string;
  lead_id: string;
  pipeline_id: string;
  stage: string;
};

/** All lead ↔ pipeline memberships (a lead can live in several pipelines with its own stage each). */
export function useLeadPipelines() {
  return useQuery({
    queryKey: ["crm-lead-pipelines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_lead_pipelines")
        .select("id, lead_id, pipeline_id, stage");
      if (error) throw error;
      return (data ?? []) as LeadPipelineMembership[];
    },
    staleTime: 30_000,
  });
}

export async function setLeadPipelineStage(leadId: string, pipelineId: string, stage: string) {
  return supabase
    .from("crm_lead_pipelines")
    .upsert({ lead_id: leadId, pipeline_id: pipelineId, stage }, { onConflict: "lead_id,pipeline_id" });
}

export async function removeLeadFromPipeline(leadId: string, pipelineId: string) {
  return supabase
    .from("crm_lead_pipelines")
    .delete()
    .eq("lead_id", leadId)
    .eq("pipeline_id", pipelineId);
}
