import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { differenceInDays, parseISO, format } from "date-fns";
import { de } from "date-fns/locale";
import { Clapperboard, LayoutGrid, Youtube, Megaphone, CheckCircle, AlertTriangle, Clock, ListChecks, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import KontingentTracker from "./KontingentTracker";

interface ClientDashboardProps {
  client: any;
  contentPieces: any[];
  canEdit: boolean;
  onNavigate: (module: string) => void;
}

const PHASE_LABELS: Record<string, string> = {
  script: "Skript",
  filmed: "Gedreht",
  editing: "Schnitt",
  review: "Freigabe",
  feedback: "Feedback",
  approved: "Freigegeben",
  handed_over: "Geplant",
};

const ClientDashboard: React.FC<ClientDashboardProps> = ({ client, contentPieces, canEdit, onNavigate }) => {
  const now = new Date();

  // Pipeline summary
  const pipelineStats = useMemo(() => {
    const total = contentPieces.length;
    const done = contentPieces.filter(p => p.phase === "handed_over").length;
    const inReview = contentPieces.filter(p => p.phase === "review").length;
    const inEditing = contentPieces.filter(p => p.phase === "editing").length;
    const inFeedback = contentPieces.filter(p => p.phase === "feedback").length;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, inReview, inEditing, inFeedback, progress };
  }, [contentPieces]);

  // Tasks
  const { data: tasks = [] } = useQuery({
    queryKey: ["client-tasks-summary", client.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks" as any)
        .select("id, title, is_completed, priority, deadline")
        .eq("client_id", client.id)
        .eq("is_completed", false)
        .is("parent_id", null)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data as any[];
    },
  });

  // Activities
  const { data: activities = [] } = useQuery({
    queryKey: ["client-activities-summary", client.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("id, summary, created_at, action")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  // Contract info
  const contractInfo = useMemo(() => {
    if (!client.contract_start) return null;
    const start = parseISO(client.contract_start);
    let end: Date;
    if (client.contract_end) {
      end = parseISO(client.contract_end);
    } else if (client.contract_duration) {
      const months = parseInt(client.contract_duration) || 12;
      end = new Date(start);
      end.setMonth(end.getMonth() + months);
    } else {
      end = new Date(start);
      end.setMonth(end.getMonth() + 12);
    }
    const remainingDays = differenceInDays(end, now);
    const totalDays = differenceInDays(end, start);
    const progress = totalDays > 0 ? Math.min(Math.max(differenceInDays(now, start) / totalDays, 0), 1) : 0;
    return { start, end, remainingDays, progress };
  }, [client, now]);

  const relativeTime = (dateStr: string) => {
    const diff = differenceInDays(now, new Date(dateStr));
    if (diff === 0) return "Heute";
    if (diff === 1) return "Gestern";
    if (diff < 7) return `vor ${diff} Tagen`;
    return format(new Date(dateStr), "dd. MMM", { locale: de });
  };

  return (
    <div className="space-y-6">
      {/* Kontingent */}
      <KontingentTracker
        client={client}
        contentPieces={contentPieces}
        month={now.getMonth() + 1}
        year={now.getFullYear()}
        canEdit={canEdit}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Pipeline Progress */}
        <button
          onClick={() => onNavigate("pipeline")}
          className="rounded-lg border border-border bg-card p-4 text-left hover:border-primary/30 transition-colors group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Pipeline</span>
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <div className="text-2xl font-semibold tabular-nums">{pipelineStats.progress}%</div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {pipelineStats.done}/{pipelineStats.total} übergeben
          </div>
          {/* Mini progress bar */}
          <div className="h-1 rounded-full bg-muted/50 mt-2 overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pipelineStats.progress}%` }} />
          </div>
        </button>

        {/* Open Tasks */}
        <button
          onClick={() => onNavigate("tasks")}
          className="rounded-lg border border-border bg-card p-4 text-left hover:border-primary/30 transition-colors group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Aufgaben</span>
            <ListChecks className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <div className="text-2xl font-semibold tabular-nums">{tasks.length}</div>
          <div className="text-[11px] text-muted-foreground mt-1">offen</div>
        </button>

        {/* Review */}
        <button
          onClick={() => onNavigate("pipeline")}
          className="rounded-lg border border-border bg-card p-4 text-left hover:border-primary/30 transition-colors group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Zur Freigabe</span>
            <CheckCircle className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <div className="text-2xl font-semibold tabular-nums">{pipelineStats.inReview}</div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {pipelineStats.inFeedback > 0 && `${pipelineStats.inFeedback} Feedback`}
          </div>
        </button>

        {/* Contract */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Vertrag</span>
            {contractInfo && contractInfo.remainingDays <= 30 && (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            )}
          </div>
          {contractInfo ? (
            <>
              <div className={cn(
                "text-2xl font-semibold tabular-nums",
                contractInfo.remainingDays <= 0 && "text-destructive",
                contractInfo.remainingDays > 0 && contractInfo.remainingDays <= 30 && "text-amber-500",
              )}>
                {contractInfo.remainingDays > 0 ? contractInfo.remainingDays : 0}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                Tage verbleibend · bis {format(contractInfo.end, "dd.MM.yy")}
              </div>
              <div className="h-1 rounded-full bg-muted/50 mt-2 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    contractInfo.remainingDays <= 0 ? "bg-destructive" :
                    contractInfo.remainingDays <= 30 ? "bg-amber-500" :
                    contractInfo.remainingDays <= 90 ? "bg-yellow-500" : "bg-primary"
                  )}
                  style={{ width: `${Math.round(contractInfo.progress * 100)}%` }}
                />
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">Kein Vertrag</div>
          )}
        </div>
      </div>

      {/* Bottom: Tasks + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Open Tasks */}
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-xs font-semibold">Offene Aufgaben</span>
            <button onClick={() => onNavigate("tasks")} className="text-[11px] text-primary hover:underline">Alle →</button>
          </div>
          <div className="divide-y divide-border">
            {tasks.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">Keine offenen Aufgaben</div>
            ) : (
              tasks.slice(0, 5).map((t: any) => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className={cn(
                    "h-1.5 w-1.5 rounded-full shrink-0",
                    t.priority === "urgent" ? "bg-destructive" :
                    t.priority === "high" ? "bg-amber-500" : "bg-muted-foreground/30"
                  )} />
                  <span className="text-xs truncate flex-1">{t.title}</span>
                  {t.deadline && (
                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                      {format(new Date(t.deadline), "dd.MM.")}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-xs font-semibold">Letzte Aktivitäten</span>
            <button onClick={() => onNavigate("activity")} className="text-[11px] text-primary hover:underline">Alle →</button>
          </div>
          <div className="divide-y divide-border">
            {activities.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">Keine Aktivitäten</div>
            ) : (
              activities.slice(0, 5).map((a) => (
                <div key={a.id} className="flex items-start gap-3 px-4 py-2.5">
                  <Clock className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate">{a.summary}</p>
                    <span className="text-[10px] text-muted-foreground">{relativeTime(a.created_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientDashboard;