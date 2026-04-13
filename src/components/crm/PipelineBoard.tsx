import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, TrendingUp, Users, DollarSign, Target } from "lucide-react";
import { CRM_STAGES, PIPELINE_STAGES, getStageColor, getStageLabel, getSourceInfo } from "@/lib/crm-constants";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

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

function LeadCard({ lead, onDragStart }: { lead: Lead; onDragStart: (e: React.DragEvent, id: string) => void }) {
  const sourceInfo = getSourceInfo(lead.source);
  const stageColor = getStageColor(lead.stage);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead.id)}
      className="bg-card border border-border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-primary/40 transition-colors"
      style={{ borderLeftWidth: 3, borderLeftColor: stageColor }}
    >
      <Link to={`/crm/lead/${lead.id}`} className="font-semibold text-sm hover:text-primary transition-colors">
        {lead.name}
      </Link>
      {lead.contact_name && (
        <p className="text-xs text-muted-foreground mt-0.5">{lead.contact_name}</p>
      )}
      
      {/* Contact details */}
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
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${sourceInfo.color}`}>
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

export default function PipelineBoard({ leads, onRefresh }: PipelineBoardProps) {
  const { user } = useAuth();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [wonCollapsed, setWonCollapsed] = useState(false);
  const [lostCollapsed, setLostCollapsed] = useState(true);

  const byStage = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    CRM_STAGES.forEach(s => { map[s.value] = []; });
    leads.forEach(l => {
      if (map[l.stage]) map[l.stage].push(l);
      else map['erstkontakt'].push(l);
    });
    return map;
  }, [leads]);

  // Stats
  const pipelineLeads = leads.filter(l => !['gewonnen', 'verloren'].includes(l.stage));
  const openDeals = pipelineLeads.reduce((s, l) => s + Number(l.deal_value || 0), 0);
  const now = new Date();
  const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const wonThisQ = leads
    .filter(l => l.stage === 'gewonnen' && new Date(l.last_activity_at || l.created_at) >= qStart)
    .reduce((s, l) => s + Number(l.deal_value || 0), 0);
  const totalLeads = leads.filter(l => l.stage !== 'verloren').length;
  const wonCount = byStage['gewonnen'].length;
  const conversion = totalLeads > 0 ? Math.round((wonCount / totalLeads) * 100) : 0;

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = async (e: React.DragEvent, newStage: string) => {
    e.preventDefault();
    if (!draggedId) return;
    const lead = leads.find(l => l.id === draggedId);
    if (!lead || lead.stage === newStage) { setDraggedId(null); return; }

    const oldStage = lead.stage;
    // Optimistic: update via supabase
    const { error } = await supabase
      .from("crm_leads")
      .update({ stage: newStage, last_activity_at: new Date().toISOString() })
      .eq("id", draggedId);

    if (error) {
      toast.error("Fehler beim Verschieben");
    } else {
      // Log activity
      await supabase.from("crm_activities").insert({
        lead_id: draggedId,
        type: "status_change" as any,
        title: `Status geändert: ${getStageLabel(oldStage)} → ${getStageLabel(newStage)}`,
        created_by: user!.id,
      });
      toast.success(`→ ${getStageLabel(newStage)}`);
      onRefresh();
    }
    setDraggedId(null);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };

  return (
    <div>
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 min-h-[400px]">
        {/* Pipeline columns */}
        {PIPELINE_STAGES.map(stage => (
          <div
            key={stage.value}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, stage.value)}
            className="bg-muted/30 rounded-lg p-2 min-h-[200px]"
          >
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: stage.color }} />
              <span className="text-xs font-semibold uppercase tracking-wider">{stage.label}</span>
              <span className="text-xs text-muted-foreground ml-auto">{byStage[stage.value].length}</span>
            </div>
            <div className="space-y-2">
              {byStage[stage.value].map(lead => (
                <LeadCard key={lead.id} lead={lead} onDragStart={handleDragStart} />
              ))}
            </div>
          </div>
        ))}

        {/* Won + Lost column */}
        <div className="space-y-3">
          {/* Gewonnen */}
          <div
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'gewonnen')}
            className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-2"
          >
            <button
              onClick={() => setWonCollapsed(!wonCollapsed)}
              className="flex items-center gap-2 w-full px-1 mb-2"
            >
              {wonCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Gewonnen</span>
              <span className="text-xs text-muted-foreground ml-auto">{byStage['gewonnen'].length}</span>
            </button>
            {!wonCollapsed && (
              <div className="space-y-2">
                {byStage['gewonnen'].map(lead => (
                  <LeadCard key={lead.id} lead={lead} onDragStart={handleDragStart} />
                ))}
              </div>
            )}
          </div>

          {/* Verloren */}
          <div
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'verloren')}
            className="bg-red-500/5 border border-red-500/20 rounded-lg p-2"
          >
            <button
              onClick={() => setLostCollapsed(!lostCollapsed)}
              className="flex items-center gap-2 w-full px-1 mb-2"
            >
              {lostCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-red-400">Verloren</span>
              <span className="text-xs text-muted-foreground ml-auto">{byStage['verloren'].length}</span>
            </button>
            {!lostCollapsed && (
              <div className="space-y-2">
                {byStage['verloren'].map(lead => (
                  <LeadCard key={lead.id} lead={lead} onDragStart={handleDragStart} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
