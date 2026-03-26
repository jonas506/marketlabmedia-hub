import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { format, startOfDay, subDays } from "date-fns";
import { de } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Task, TeamMember } from "./constants";

interface CompletedTasksViewProps {
  team: TeamMember[];
}

const CompletedTasksView: React.FC<CompletedTasksViewProps> = ({ team }) => {
  const [dateFilter, setDateFilter] = useState("week");
  const [personFilter, setPersonFilter] = useState("all");

  const { data: completedTasks = [] } = useQuery({
    queryKey: ["completed-tasks", dateFilter, personFilter],
    queryFn: async () => {
      let q = supabase
        .from("tasks" as any)
        .select("*")
        .eq("is_completed", true)
        .is("parent_id", null)
        .order("completed_at", { ascending: false })
        .limit(100);

      const today = new Date().toISOString().split("T")[0];

      if (dateFilter === "today") {
        q = q.gte("completed_at", today);
      } else if (dateFilter === "yesterday") {
        const y = subDays(new Date(), 1).toISOString().split("T")[0];
        q = q.gte("completed_at", y).lt("completed_at", today);
      } else if (dateFilter === "week") {
        const w = subDays(new Date(), 7).toISOString().split("T")[0];
        q = q.gte("completed_at", w);
      } else if (dateFilter === "month") {
        const m = subDays(new Date(), 30).toISOString().split("T")[0];
        q = q.gte("completed_at", m);
      }

      if (personFilter !== "all") {
        q = q.eq("completed_by", personFilter);
      }

      const { data } = await q;
      return (data as any[] ?? []) as (Task & { completed_at: string | null; completed_by: string | null; group_source: string | null })[];
    },
  });

  // Count subtasks for group tasks
  const { data: subtaskCounts = {} } = useQuery({
    queryKey: ["completed-subtask-counts", completedTasks.map(t => t.id).join(",")],
    queryFn: async () => {
      const parentIds = completedTasks.filter(t => t.group_source).map(t => t.id);
      if (parentIds.length === 0) return {};
      const { data } = await supabase
        .from("tasks" as any)
        .select("parent_id")
        .in("parent_id", parentIds);
      const counts: Record<string, number> = {};
      (data as any[] ?? []).forEach((r: any) => {
        counts[r.parent_id] = (counts[r.parent_id] || 0) + 1;
      });
      return counts;
    },
    enabled: completedTasks.length > 0,
  });

  const teamMap = useMemo(() => {
    const m: Record<string, string> = {};
    team.forEach(t => { m[t.user_id] = t.name || t.email || "?"; });
    return m;
  }, [team]);

  // Group by day
  const dayGroups = useMemo(() => {
    const groups: Record<string, typeof completedTasks> = {};
    completedTasks.forEach(task => {
      const day = task.completed_at
        ? format(new Date(task.completed_at), "yyyy-MM-dd")
        : "unknown";
      if (!groups[day]) groups[day] = [];
      groups[day].push(task);
    });
    return groups;
  }, [completedTasks]);

  // Summary per person
  const completedByPerson = useMemo(() => {
    const counts: Record<string, number> = {};
    completedTasks.forEach(t => {
      const key = t.completed_by || "unknown";
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).map(([userId, count]) => ({
      name: teamMap[userId] || "?",
      count,
    }));
  }, [completedTasks, teamMap]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2">
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Heute</SelectItem>
            <SelectItem value="yesterday">Gestern</SelectItem>
            <SelectItem value="week">Diese Woche</SelectItem>
            <SelectItem value="month">Dieser Monat</SelectItem>
            <SelectItem value="all">Alles</SelectItem>
          </SelectContent>
        </Select>
        <Select value={personFilter} onValueChange={setPersonFilter}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            {team.map(t => (
              <SelectItem key={t.user_id} value={t.user_id}>{t.name || t.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary bar */}
      {completedTasks.length > 0 && (
        <div className="flex items-center gap-4 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
          <div className="text-center">
            <span className="font-mono text-2xl font-bold text-emerald-500">{completedTasks.length}</span>
            <p className="text-[9px] font-mono text-muted-foreground">Erledigt</p>
          </div>
          <div className="h-8 w-px bg-border" />
          {completedByPerson.map(({ name, count }) => (
            <div key={name} className="text-center">
              <span className="font-mono text-lg font-bold">{count}</span>
              <p className="text-[9px] font-mono text-muted-foreground">{name}</p>
            </div>
          ))}
        </div>
      )}

      {/* Day groups */}
      <AnimatePresence mode="popLayout">
        {Object.entries(dayGroups).map(([day, tasks]) => {
          const dayDate = day !== "unknown" ? new Date(day) : null;
          return (
            <motion.div
              key={day}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-1"
            >
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-xs font-display font-semibold text-muted-foreground">
                  {dayDate ? format(dayDate, "EEEE, dd. MMMM yyyy", { locale: de }) : "Unbekannt"}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {tasks.length} ✓
                </span>
              </div>
              {tasks.map(task => {
                const subCount = subtaskCounts[task.id];
                return (
                  <div
                    key={task.id}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-border/50 bg-card",
                      task.group_source && "border-l-2 border-l-emerald-500"
                    )}
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span className="text-sm font-body flex-1 truncate">{task.title}</span>
                    {subCount && (
                      <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full">
                        {subCount}/{subCount}
                      </span>
                    )}
                    {task.completed_by && (
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0 hidden sm:inline">
                        {teamMap[task.completed_by] || "?"}
                      </span>
                    )}
                    {task.completed_at && (
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                        {format(new Date(task.completed_at), "HH:mm")}
                      </span>
                    )}
                  </div>
                );
              })}
            </motion.div>
          );
        })}
      </AnimatePresence>

      {completedTasks.length === 0 && (
        <div className="py-12 text-center text-xs text-muted-foreground/40 font-mono">
          Keine erledigten Aufgaben im gewählten Zeitraum
        </div>
      )}
    </div>
  );
};

export default React.memo(CompletedTasksView);
