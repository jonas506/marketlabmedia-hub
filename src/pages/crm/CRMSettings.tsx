import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import CRMLayout from "../CRM";
import ErrorBoundary from "@/components/ErrorBoundary";

interface Pipeline { id: string; name: string; }
interface Stage { id: string; pipeline_id: string; name: string; color: string; sort_order: number; }
interface Status { id: string; name: string; color: string; sort_order: number; is_default: boolean; }

export default function CRMSettings() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [newPipelineName, setNewPipelineName] = useState("");
  const [newStageName, setNewStageName] = useState<Record<string, string>>({});
  const [newStageColor, setNewStageColor] = useState<Record<string, string>>({});

  const fetchData = async () => {
    const [{ data: pData }, { data: sData }, { data: stData }] = await Promise.all([
      supabase.from("crm_pipelines").select("*").order("created_at"),
      supabase.from("crm_pipeline_stages").select("*").order("sort_order"),
      supabase.from("crm_lead_statuses").select("*").order("sort_order"),
    ]);
    setPipelines(pData || []);
    setStages(sData || []);
    setStatuses(stData || []);
  };

  useEffect(() => { fetchData(); }, []);

  const addPipeline = async () => {
    if (!newPipelineName.trim()) return;
    const { data, error } = await supabase.from("crm_pipelines").insert({ name: newPipelineName }).select().single();
    if (error) { toast.error(error.message); return; }
    // Add default Won/Lost stages
    if (data) {
      await supabase.from("crm_pipeline_stages").insert([
        { pipeline_id: data.id, name: "Gewonnen", color: "#22C55E", sort_order: 98 },
        { pipeline_id: data.id, name: "Verloren", color: "#EF4444", sort_order: 99 },
      ]);
    }
    setNewPipelineName("");
    toast.success("Pipeline erstellt");
    fetchData();
  };

  const addStage = async (pipelineId: string) => {
    const name = newStageName[pipelineId]?.trim();
    if (!name) return;
    const pipelineStages = stages.filter(s => s.pipeline_id === pipelineId);
    const maxOrder = Math.max(...pipelineStages.filter(s => s.sort_order < 98).map(s => s.sort_order), -1);
    const { error } = await supabase.from("crm_pipeline_stages").insert({
      pipeline_id: pipelineId,
      name,
      color: newStageColor[pipelineId] || "#6B7280",
      sort_order: maxOrder + 1,
    });
    if (error) { toast.error(error.message); return; }
    setNewStageName(p => ({ ...p, [pipelineId]: "" }));
    fetchData();
  };

  const deleteStage = async (stageId: string) => {
    await supabase.from("crm_pipeline_stages").delete().eq("id", stageId);
    fetchData();
  };

  const deletePipeline = async (id: string) => {
    await supabase.from("crm_pipeline_stages").delete().eq("pipeline_id", id);
    await supabase.from("crm_pipelines").delete().eq("id", id);
    toast.success("Pipeline gelöscht");
    fetchData();
  };

  return (
    <CRMLayout>
      <ErrorBoundary level="section">
      <div className="space-y-8 max-w-3xl">
        <h1 className="text-xl font-bold text-[#FAFBFF] font-[Manrope]">Einstellungen</h1>

        {/* Lead Statuses */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[#FAFBFF]/70 uppercase tracking-wider">Lead-Status</h2>
          <div className="space-y-1.5">
            {statuses.map(s => (
              <div key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#2A2A32] border border-[#3A3A44]">
                <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                <span className="text-sm text-[#FAFBFF]">{s.name}</span>
                {s.is_default && <span className="text-[10px] text-muted-foreground ml-auto">Standard</span>}
              </div>
            ))}
          </div>
        </section>

        {/* Pipelines */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[#FAFBFF]/70 uppercase tracking-wider">Pipelines & Stages</h2>
          <div className="space-y-4">
            {pipelines.map(p => {
              const pStages = stages.filter(s => s.pipeline_id === p.id).sort((a, b) => a.sort_order - b.sort_order);
              return (
                <div key={p.id} className="rounded-lg border border-[#3A3A44] bg-[#2A2A32] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-[#FAFBFF]">{p.name}</h3>
                    <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 h-7" onClick={() => deletePipeline(p.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="space-y-1">
                    {pStages.map(s => (
                      <div key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-[#1E1E24]">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                        <span className="text-sm text-[#FAFBFF]/80 flex-1">{s.name}</span>
                        {s.sort_order < 98 && (
                          <button onClick={() => deleteStage(s.id)} className="text-muted-foreground hover:text-red-400 transition-colors">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Neue Stage"
                      value={newStageName[p.id] || ""}
                      onChange={e => setNewStageName(prev => ({ ...prev, [p.id]: e.target.value }))}
                      className="bg-[#1E1E24] border-[#3A3A44] flex-1"
                      onKeyDown={e => e.key === "Enter" && addStage(p.id)}
                    />
                    <input
                      type="color"
                      value={newStageColor[p.id] || "#6B7280"}
                      onChange={e => setNewStageColor(prev => ({ ...prev, [p.id]: e.target.value }))}
                      className="h-10 w-10 rounded border border-[#3A3A44] bg-[#1E1E24] cursor-pointer"
                    />
                    <Button variant="outline" size="sm" onClick={() => addStage(p.id)} className="border-[#3A3A44]">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Neue Pipeline"
              value={newPipelineName}
              onChange={e => setNewPipelineName(e.target.value)}
              className="bg-[#2A2A32] border-[#3A3A44]"
              onKeyDown={e => e.key === "Enter" && addPipeline()}
            />
            <Button onClick={addPipeline} size="sm" className="gap-1.5 shrink-0">
              <Plus className="h-4 w-4" /> Pipeline
            </Button>
          </div>
        </section>
      </div>
    </CRMLayout>
  );
}
