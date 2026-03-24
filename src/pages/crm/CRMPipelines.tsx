import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, ExternalLink, GripVertical } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import CRMLayout from "../CRM";
import ErrorBoundary from "@/components/ErrorBoundary";

interface Pipeline { id: string; name: string; }
interface Stage { id: string; pipeline_id: string; name: string; color: string; sort_order: number; }
interface Opportunity {
  id: string; lead_id: string; pipeline_id: string; stage_id: string;
  value: number; note: string | null; lead_name?: string;
}

export default function CRMPipelines() {
  const { user } = useAuth();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);
  const [leads, setLeads] = useState<{ id: string; name: string }[]>([]);
  const [newOpp, setNewOpp] = useState({ lead_id: "", value: "", note: "" });
  const [dragItem, setDragItem] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const [{ data: pData }, { data: sData }, { data: oData }, { data: lData }] = await Promise.all([
      supabase.from("crm_pipelines").select("*").order("created_at"),
      supabase.from("crm_pipeline_stages").select("*").order("sort_order"),
      supabase.from("crm_opportunities").select("*, crm_leads(name)"),
      supabase.from("crm_leads").select("id, name").order("name"),
    ]);
    setPipelines(pData || []);
    setStages(sData || []);
    setOpportunities((oData || []).map((o: any) => ({ ...o, lead_name: o.crm_leads?.name })));
    setLeads(lData || []);
    if (!selectedPipeline && pData?.length) setSelectedPipeline(pData[0].id);
  }, [selectedPipeline]);

  useEffect(() => { fetchData(); }, []);

  const pipelineStages = stages.filter(s => s.pipeline_id === selectedPipeline).sort((a, b) => a.sort_order - b.sort_order);

  const handleDrop = async (stageId: string) => {
    if (!dragItem) return;
    setDragOverStage(null);
    const { error } = await supabase.from("crm_opportunities").update({ stage_id: stageId }).eq("id", dragItem);
    if (error) toast.error(error.message);
    else {
      setOpportunities(prev => prev.map(o => o.id === dragItem ? { ...o, stage_id: stageId } : o));
    }
    setDragItem(null);
  };

  const createOpp = async () => {
    if (!newOpp.lead_id || !selectedPipeline) return;
    const firstStage = pipelineStages[0];
    if (!firstStage) { toast.error("Keine Stages vorhanden"); return; }
    const { error } = await supabase.from("crm_opportunities").insert({
      lead_id: newOpp.lead_id,
      pipeline_id: selectedPipeline,
      stage_id: firstStage.id,
      value: parseFloat(newOpp.value) || 0,
      note: newOpp.note || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Opportunity erstellt");
    setShowCreate(false);
    setNewOpp({ lead_id: "", value: "", note: "" });
    fetchData();
  };

  return (
    <CRMLayout>
      <ErrorBoundary level="section">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#FAFBFF] font-[Manrope]">Pipelines</h1>
            <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
              <SelectTrigger className="w-[200px] bg-[#2A2A32] border-[#3A3A44]">
                <SelectValue placeholder="Pipeline wählen" />
              </SelectTrigger>
              <SelectContent>
                {pipelines.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setShowCreate(true)} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Neue Opportunity
          </Button>
        </div>

        {/* Kanban Board */}
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: "60vh" }}>
          {pipelineStages.map(stage => {
            const stageOpps = opportunities.filter(o => o.stage_id === stage.id && o.pipeline_id === selectedPipeline);
            const isWonLost = stage.name === "Won" || stage.name === "Lost" || stage.name === "Gewonnen" || stage.name === "Verloren";
            return (
              <div
                key={stage.id}
                className={`shrink-0 w-[260px] rounded-lg border transition-colors ${
                  dragOverStage === stage.id ? "border-primary bg-primary/5" : "border-[#3A3A44] bg-[#2A2A32]/50"
                }`}
                onDragOver={e => { e.preventDefault(); setDragOverStage(stage.id); }}
                onDragLeave={() => setDragOverStage(null)}
                onDrop={e => { e.preventDefault(); handleDrop(stage.id); }}
              >
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#3A3A44]">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                  <span className="text-sm font-semibold text-[#FAFBFF] truncate">{stage.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{stageOpps.length}</span>
                </div>
                <div className="p-2 space-y-2 min-h-[100px]">
                  {stageOpps.map(opp => (
                    <div
                      key={opp.id}
                      draggable
                      onDragStart={() => setDragItem(opp.id)}
                      onDragEnd={() => { setDragItem(null); setDragOverStage(null); }}
                      className={`rounded-lg border border-[#3A3A44] bg-[#2A2A32] p-3 cursor-grab active:cursor-grabbing transition-all hover:border-[#4A4A54] ${
                        dragItem === opp.id ? "opacity-40" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="w-1 h-8 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: stage.color }} />
                        <div className="flex-1 min-w-0">
                          <Link to={`/crm/lead/${opp.lead_id}`} className="text-sm font-medium text-[#FAFBFF] hover:text-primary transition-colors block truncate">
                            {opp.lead_name || "–"}
                          </Link>
                          <p className="text-xs text-primary font-semibold mt-0.5">
                            {opp.value.toLocaleString("de-DE")} €
                          </p>
                          {opp.note && <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{opp.note}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-[#2A2A32] border-[#3A3A44] text-[#FAFBFF]">
          <DialogHeader><DialogTitle>Neue Opportunity</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={newOpp.lead_id} onValueChange={v => setNewOpp(p => ({ ...p, lead_id: v }))}>
              <SelectTrigger className="bg-[#1E1E24] border-[#3A3A44]"><SelectValue placeholder="Kunde wählen *" /></SelectTrigger>
              <SelectContent>
                {leads.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Wert in € *" type="number" value={newOpp.value} onChange={e => setNewOpp(p => ({ ...p, value: e.target.value }))} className="bg-[#1E1E24] border-[#3A3A44]" />
            <Textarea placeholder="Notiz (optional)" value={newOpp.note} onChange={e => setNewOpp(p => ({ ...p, note: e.target.value }))} rows={2} className="bg-[#1E1E24] border-[#3A3A44]" />
            <Button onClick={createOpp} className="w-full">Erstellen</Button>
          </div>
        </DialogContent>
      </Dialog>
    </CRMLayout>
  );
}
