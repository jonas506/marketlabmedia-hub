import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, TrendingUp, Users, DollarSign, Target } from "lucide-react";
import { getSourceInfo } from "@/lib/crm-constants";
import { useCrmStages, getStageColor as dynGetStageColor, getStageLabel as dynGetStageLabel, getPipelineStages, getClosedStages, type CrmStageConfig } from "@/hooks/useCrmStages";
import PipelineSettings from "@/components/crm/PipelineSettings";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";

type Lead = {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  stage: string;
  source: string | null;
  deal_value: number;
  next_step: string | null;
  next_step_date: string | null;
  last_activity_at: string | null;
  created_at: string;
};

interface PipelineBoardProps {
  leads: Lead[];
  onRefresh: () => void;
}

function LeadCard({ lead, isDragging, onDragStart, onDragEnd }: { 
  lead: Lead; 
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
}) {
  const sourceInfo = getSourceInfo(lead.source);
  const stageColor = dynGetStageColor([], lead.stage);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead.id)}
      onDragEnd={onDragEnd}
      className={cn(
        "bg-card border border-border rounded-lg p-3 cursor-grab active:cursor-grabbing transition-all duration-200",
        isDragging 
          ? "opacity-40 scale-95 rotate-1 shadow-none" 
          : "hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5"
      )}
      style={{ borderLeftWidth: 3, borderLeftColor: stageColor }}
    >
      <Link to={`/crm/lead/${lead.id}`} onClick={e => isDragging && e.preventDefault()} className="font-semibold text-sm hover:text-primary transition-colors">
        {lead.name}
      </Link>
      {lead.contact_name && (
        <p className="text-xs text-muted-foreground mt-0.5">{lead.contact_name}</p>
      )}
      
      {(lead.contact_email || lead.contact_phone) && (
        <div className="mt-1.5 space-y-0.5">
          {lead.contact_email && (
            <p className="text-[11px] text-muted-foreground/70 truncate">✉ {lead.contact_email}</p>
          )}
          {lead.contact_phone && (
            <p className="text-[11px] text-muted-foreground/70">📞 {lead.contact_phone}</p>
          )}
        </div>
      )}
      
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        {sourceInfo && (
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${sourceInfo.color}`}
            style={sourceInfo.style}
          >
            {sourceInfo.label}
          </span>
        )}
        {lead.deal_value > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium">
            {Number(lead.deal_value).toLocaleString("de-DE")} €
          </span>
        )}
      </div>
      {lead.next_step && (
        <p className="text-[11px] text-muted-foreground mt-2 leading-tight">
          → {lead.next_step}
          {lead.next_step_date && (
            <span className="text-muted-foreground/60 ml-1">
              ({new Date(lead.next_step_date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })})
            </span>
          )}
        </p>
      )}
      {lead.last_activity_at && (
        <p className="text-[10px] text-muted-foreground/50 mt-1.5">
          {formatDistanceToNow(new Date(lead.last_activity_at), { addSuffix: true, locale: de })}
        </p>
      )}
    </div>
  );
}

function DropZone({ stage, isOver, children, onDragOver, onDragEnter, onDragLeave, onDrop, className }: {
  stage: string;
  isOver: boolean;
  children: React.ReactNode;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnter: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, stage: string) => void;
  className?: string;
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, stage)}
      className={cn(
        "rounded-lg p-2 transition-all duration-200 flex flex-col h-full",
        isOver && "ring-2 ring-primary/50 bg-primary/5 scale-[1.01]",
        className
      )}
    >
      {children}
    </div>
  );
}

export default function PipelineBoard({ leads, onRefresh }: PipelineBoardProps) {
  const { user } = useAuth();
  const { data: stages = [] } = useCrmStages();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [wonCollapsed, setWonCollapsed] = useState(false);
  const [lostCollapsed, setLostCollapsed] = useState(true);

  const pipelineStageConfigs = useMemo(() => getPipelineStages(stages), [stages]);
  const closedStageConfigs = useMemo(() => {
    const closed = getClosedStages(stages);
    return closed.sort((a, b) => (a.is_loss === b.is_loss ? 0 : a.is_loss ? -1 : 1));
  }, [stages]);
  const winStages = useMemo(() => stages.filter(s => s.is_win).map(s => s.value), [stages]);
  const lossStages = useMemo(() => stages.filter(s => s.is_loss).map(s => s.value), [stages]);
  const firstStageValue = pipelineStageConfigs[0]?.value ?? 'interessiert';

  const byStage = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    stages.forEach(s => { map[s.value] = []; });
    leads.forEach(l => {
      if (map[l.stage]) map[l.stage].push(l);
      else if (map[firstStageValue]) map[firstStageValue].push(l);
    });
    return map;
  }, [leads, stages, firstStageValue]);

  const pipelineLeads = leads.filter(l => !winStages.includes(l.stage) && !lossStages.includes(l.stage));
  const openDeals = pipelineLeads.reduce((s, l) => s + Number(l.deal_value || 0), 0);
  const now = new Date();
  const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const wonThisQ = leads
    .filter(l => winStages.includes(l.stage) && new Date(l.last_activity_at || l.created_at) >= qStart)
    .reduce((s, l) => s + Number(l.deal_value || 0), 0);
  const totalLeads = leads.filter(l => !lossStages.includes(l.stage)).length;
  const wonCount = leads.filter(l => winStages.includes(l.stage)).length;
  const conversion = totalLeads > 0 ? Math.round((wonCount / totalLeads) * 100) : 0;

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
    // Create a ghost image with slight rotation
    const el = e.currentTarget as HTMLElement;
    const ghost = el.cloneNode(true) as HTMLElement;
    ghost.style.transform = "rotate(3deg) scale(1.05)";
    ghost.style.opacity = "0.9";
    ghost.style.position = "absolute";
    ghost.style.top = "-9999px";
    ghost.style.width = `${el.offsetWidth}px`;
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, el.offsetWidth / 2, 20);
    requestAnimationFrame(() => document.body.removeChild(ghost));
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setOverStage(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragEnter = (e: React.DragEvent, stage: string) => {
    e.preventDefault();
    setOverStage(stage);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const { clientX, clientY } = e;
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      setOverStage(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, newStage: string) => {
    e.preventDefault();
    setOverStage(null);
    if (!draggedId) return;
    const lead = leads.find(l => l.id === draggedId);
    if (!lead || lead.stage === newStage) { setDraggedId(null); return; }

    const oldStage = lead.stage;
    const { error } = await supabase
      .from("crm_leads")
      .update({ stage: newStage, last_activity_at: new Date().toISOString() })
      .eq("id", draggedId);

    if (error) {
      toast.error("Fehler beim Verschieben");
    } else {
      await supabase.from("crm_activities").insert({
        lead_id: draggedId,
        type: "status_change" as any,
        title: `Status geändert: ${dynGetStageLabel(stages, oldStage)} → ${dynGetStageLabel(stages, newStage)}`,
        created_by: user!.id,
      });
      toast.success(`→ ${dynGetStageLabel(stages, newStage)}`);
      onRefresh();
    }
    setDraggedId(null);
  };

  return (
    <div className="min-w-0 overflow-hidden">
      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { icon: Users, label: "In Pipeline", value: pipelineLeads.length },
          { icon: DollarSign, label: "Offene Deals", value: `${openDeals.toLocaleString("de-DE")} €` },
          { icon: TrendingUp, label: "Gewonnen (Quartal)", value: `${wonThisQ.toLocaleString("de-DE")} €` },
          { icon: Target, label: "Conversion", value: `${conversion}%` },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-sm font-bold">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Kanban board */}
      <div className="flex items-center justify-end mb-2">
        <PipelineSettings stages={stages} />
      </div>
      <div className="max-w-full overflow-x-auto pb-2">
        <div
          className="grid min-w-full w-max gap-3"
          style={{ gridTemplateColumns: `repeat(${pipelineStageConfigs.length}, minmax(240px, 240px)) repeat(${closedStageConfigs.length}, 180px)` }}
        >
          {pipelineStageConfigs.map(stage => (
            <DropZone
              key={stage.value}
              stage={stage.value}
              isOver={overStage === stage.value && draggedId !== null}
              onDragOver={handleDragOver}
              onDragEnter={(e) => handleDragEnter(e, stage.value)}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className="bg-muted/30"
            >
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="h-2.5 w-2.5 rounded-full" style={{ background: stage.color }} />
                <span className="text-xs font-semibold uppercase tracking-wider">{stage.label}</span>
                <span className="text-xs text-muted-foreground ml-auto">{byStage[stage.value]?.length ?? 0}</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                {(byStage[stage.value] ?? []).map(lead => (
                  <LeadCard key={lead.id} lead={lead} isDragging={draggedId === lead.id} onDragStart={handleDragStart} onDragEnd={handleDragEnd} />
                ))}
                {overStage === stage.value && draggedId && !(byStage[stage.value] ?? []).find(l => l.id === draggedId) && (
                  <div className="border-2 border-dashed border-primary/30 rounded-lg h-16 flex items-center justify-center animate-fade-in">
                    <span className="text-xs text-primary/50">Hier ablegen</span>
                  </div>
                )}
              </div>
            </DropZone>
          ))}

          <>
            {closedStageConfigs.map(closedStage => {
              const isCollapsed = closedStage.is_win ? wonCollapsed : lostCollapsed;
              const toggleCollapsed = closedStage.is_win
                ? () => setWonCollapsed(!wonCollapsed)
                : () => setLostCollapsed(!lostCollapsed);
              const count = (byStage[closedStage.value] ?? []).length;
              return (
                <DropZone
                  key={closedStage.value}
                  stage={closedStage.value}
                  isOver={overStage === closedStage.value && draggedId !== null}
                  onDragOver={handleDragOver}
                  onDragEnter={(e) => handleDragEnter(e, closedStage.value)}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className="border border-border/50 bg-muted/10"
                >
                  <button
                    onClick={toggleCollapsed}
                    className="flex items-center gap-1.5 w-full px-1 py-0.5"
                  >
                    {isCollapsed ? <ChevronRight className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                    <div className="h-2 w-2 rounded-full" style={{ background: closedStage.color }} />
                    <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: closedStage.color }}>{closedStage.label}</span>
                    <span className="text-[11px] text-muted-foreground ml-auto">{count}</span>
                  </button>
                  {!isCollapsed && count > 0 && (
                    <div className="mt-1.5 space-y-1.5 max-h-48 overflow-y-auto">
                      {(byStage[closedStage.value] ?? []).map(lead => (
                        <Link
                          key={lead.id}
                          to={`/crm/lead/${lead.id}`}
                          draggable
                          onDragStart={(e) => { e.dataTransfer.setData("text/plain", lead.id); handleDragStart(e as any, lead.id); }}
                          onDragEnd={handleDragEnd}
                          className={cn(
                            "block px-2 py-1.5 rounded-md bg-card/50 border border-border/40 hover:border-border transition-colors cursor-grab active:cursor-grabbing",
                            draggedId === lead.id && "opacity-40"
                          )}
                          onClick={(e) => { if (draggedId) e.preventDefault(); }}
                        >
                          <p className="text-xs font-medium truncate">{lead.name}</p>
                          {lead.deal_value > 0 && (
                            <p className="text-[10px] text-muted-foreground">{Number(lead.deal_value).toLocaleString("de-DE")} €</p>
                          )}
                        </Link>
                      ))}
                    </div>
                  )}
                </DropZone>
              );
            })}
          </>
        </div>
      </div>
    </div>
  );
}
