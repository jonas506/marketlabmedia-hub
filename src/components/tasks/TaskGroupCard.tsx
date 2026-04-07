import React, { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronRight, Plus, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import confetti from "canvas-confetti";
import SubtaskItem from "./SubtaskItem";
import { Task, getInitials } from "./constants";

interface TaskGroupCardProps {
  task: Task & { content_piece_id?: string | null; group_source?: string | null };
  clientMap: Record<string, string>;
  teamMap: Record<string, { name: string | null }>;
  todayStr: string;
  onSelect: (task: Task) => void;
}

const TaskGroupCard: React.FC<TaskGroupCardProps> = ({ task, clientMap, teamMap, todayStr, onSelect }) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");

  const { data: subtasks = [] } = useQuery({
    queryKey: ["subtasks", task.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks" as any)
        .select("*")
        .eq("parent_id", task.id)
        .order("is_completed", { ascending: true })
        .order("created_at", { ascending: true });
      return (data as any[] ?? []) as (Task & { content_piece_id: string | null })[];
    },
    enabled: expanded,
  });

  const completedCount = subtasks.filter(s => s.is_completed).length;
  const totalCount = subtasks.length;
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const allDone = totalCount > 0 && completedCount === totalCount;

  const completeSubtask = useCallback(async (subtaskId: string) => {
    await supabase.from("tasks" as any).update({
      is_completed: true,
      status: "done",
      completed_at: new Date().toISOString(),
      completed_by: user?.id,
    } as any).eq("id", subtaskId);

    // Check if all subtasks are now done
    const { data: remaining } = await supabase
      .from("tasks" as any)
      .select("id")
      .eq("parent_id", task.id)
      .eq("is_completed", false);

    if (!remaining || remaining.length <= 1) {
      // Complete parent too
      await supabase.from("tasks" as any).update({
        is_completed: true,
        status: "done",
        completed_at: new Date().toISOString(),
        completed_by: user?.id,
      } as any).eq("id", task.id);

      toast.success("🎉 Alle Aufgaben der Gruppe erledigt!");
      confetti({
        particleCount: 60,
        spread: 50,
        origin: { y: 0.7 },
        colors: ["#0083F7", "#21089B", "#10B981"],
      });
    }

    qc.invalidateQueries({ queryKey: ["all-tasks-page"] });
    qc.invalidateQueries({ queryKey: ["my-tasks"] });
    qc.invalidateQueries({ queryKey: ["subtasks", task.id] });
  }, [task.id, user?.id, qc]);

  const completeAllSubtasks = useCallback(async () => {
    const openIds = subtasks.filter(s => !s.is_completed).map(s => s.id);
    if (openIds.length === 0) return;

    for (const id of openIds) {
      await supabase.from("tasks" as any).update({
        is_completed: true,
        status: "done",
        completed_at: new Date().toISOString(),
        completed_by: user?.id,
      } as any).eq("id", id);
    }

    await supabase.from("tasks" as any).update({
      is_completed: true,
      status: "done",
      completed_at: new Date().toISOString(),
      completed_by: user?.id,
    } as any).eq("id", task.id);

    toast.success("🎉 Alle Aufgaben der Gruppe erledigt!");
    confetti({ particleCount: 60, spread: 50, origin: { y: 0.7 }, colors: ["#0083F7", "#21089B", "#10B981"] });

    qc.invalidateQueries({ queryKey: ["all-tasks-page"] });
    qc.invalidateQueries({ queryKey: ["my-tasks"] });
    qc.invalidateQueries({ queryKey: ["subtasks", task.id] });
  }, [subtasks, task.id, user?.id, qc]);

  const addSubtask = async () => {
    if (!quickTitle.trim()) return;
    await supabase.from("tasks" as any).insert({
      title: quickTitle.trim(),
      client_id: task.client_id,
      assigned_to: task.assigned_to,
      parent_id: task.id,
      status: "not_started",
      created_by: user?.id,
      group_source: "manual",
    } as any);
    setQuickTitle("");
    qc.invalidateQueries({ queryKey: ["subtasks", task.id] });
    qc.invalidateQueries({ queryKey: ["all-tasks-page"] });
  };

  // Sort: open first, completed last
  const sortedSubtasks = [...subtasks].sort((a, b) => {
    if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
    return 0;
  });

  const assigneeName = task.assigned_to ? teamMap[task.assigned_to]?.name : null;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden border-l-2 border-l-primary">
      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-3 py-2.5 bg-surface-elevated cursor-pointer hover:bg-surface-hover transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <ChevronRight className={cn(
          "h-4 w-4 text-muted-foreground transition-transform shrink-0",
          expanded && "rotate-90"
        )} />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-display font-semibold truncate block">{task.title}</span>
          {expanded && totalCount > 0 && (
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex-1 max-w-32">
                <Progress
                  value={progressPct}
                  className={cn("h-1.5", allDone ? "[&>div]:bg-emerald-500" : "[&>div]:bg-primary")}
                />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">
                {completedCount}/{totalCount}
              </span>
            </div>
          )}
        </div>
        {!expanded && totalCount > 0 && (
          <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full shrink-0">
            {completedCount}/{totalCount}
          </span>
        )}
        {expanded && totalCount > 0 && completedCount < totalCount && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px] px-2 text-primary hover:text-primary shrink-0"
            onClick={(e) => { e.stopPropagation(); completeAllSubtasks(); }}
          >
            <CheckCheck className="h-3 w-3 mr-1" />
            Alle erledigen
          </Button>
        )}
        {assigneeName && (
          <span className="text-[10px] font-mono text-muted-foreground shrink-0 hidden sm:inline">
            {assigneeName}
          </span>
        )}
        {task.deadline && (
          <span className={cn(
            "text-[10px] font-mono shrink-0",
            task.deadline < todayStr ? "text-destructive" : "text-muted-foreground"
          )}>
            bis {format(new Date(task.deadline), "EEE dd.", { locale: de })}
          </span>
        )}
      </div>

      {/* Subtasks */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="divide-y divide-border/20 px-3">
              {sortedSubtasks.map(sub => (
                <SubtaskItem
                  key={sub.id}
                  id={sub.id}
                  title={sub.title}
                  isCompleted={sub.is_completed}
                  clientId={sub.client_id}
                  contentPieceId={(sub as any).content_piece_id}
                  onComplete={completeSubtask}
                />
              ))}
            </div>
            {/* Quick add subtask */}
            <div className="flex items-center gap-2 px-3 py-2 border-t border-border/20">
              <Plus className="h-3 w-3 text-muted-foreground/40 shrink-0 ml-6" />
              <Input
                value={quickTitle}
                onChange={e => setQuickTitle(e.target.value)}
                placeholder="Unteraufgabe hinzufügen…"
                className="h-7 text-xs bg-transparent border-0 shadow-none focus-visible:ring-0 px-0"
                onKeyDown={e => { if (e.key === "Enter") addSubtask(); }}
                onClick={e => e.stopPropagation()}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default React.memo(TaskGroupCard);
