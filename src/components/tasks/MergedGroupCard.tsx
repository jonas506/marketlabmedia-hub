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
import confetti from "canvas-confetti";
import SubtaskItem from "./SubtaskItem";
import { Task } from "./constants";

interface MergedGroupCardProps {
  clientId: string;
  clientName: string;
  parentTasks: (Task & { group_source?: string | null })[];
  teamMap: Record<string, { name: string | null }>;
  todayStr: string;
  onSelect: (task: Task) => void;
}

const MergedGroupCard: React.FC<MergedGroupCardProps> = ({
  clientId, clientName, parentTasks, teamMap, todayStr, onSelect,
}) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");

  const parentIds = parentTasks.map(t => t.id);

  // Always fetch count; fetch full data when expanded
  const { data: subtaskCount } = useQuery({
    queryKey: ["merged-subtask-count", ...parentIds],
    queryFn: async () => {
      const { count: total } = await supabase
        .from("tasks" as any)
        .select("id", { count: "exact", head: true })
        .in("parent_id", parentIds);
      const { count: done } = await supabase
        .from("tasks" as any)
        .select("id", { count: "exact", head: true })
        .in("parent_id", parentIds)
        .eq("is_completed", true);
      return { total: total ?? 0, done: done ?? 0 };
    },
  });

  const { data: allSubtasks = [] } = useQuery({
    queryKey: ["merged-subtasks", ...parentIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks" as any)
        .select("*")
        .in("parent_id", parentIds)
        .order("is_completed", { ascending: true })
        .order("created_at", { ascending: true });
      return (data as any[] ?? []) as (Task & { content_piece_id: string | null })[];
    },
    enabled: expanded,
  });

  const completedCount = expanded ? allSubtasks.filter(s => s.is_completed).length : (subtaskCount?.done ?? 0);
  const totalCount = expanded ? allSubtasks.length : (subtaskCount?.total ?? 0);
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const allDone = totalCount > 0 && completedCount === totalCount;

  const assigneeName = parentTasks[0]?.assigned_to
    ? teamMap[parentTasks[0].assigned_to]?.name
    : null;

  const completeSubtask = useCallback(async (subtaskId: string) => {
    const sub = allSubtasks.find(s => s.id === subtaskId);
    await supabase.from("tasks" as any).update({
      is_completed: true, status: "done",
      completed_at: new Date().toISOString(), completed_by: user?.id,
    } as any).eq("id", subtaskId);

    // Check if parent of this subtask is now fully done
    if (sub) {
      const parentId = (sub as any).parent_id;
      const { data: remaining } = await supabase
        .from("tasks" as any).select("id")
        .eq("parent_id", parentId).eq("is_completed", false);
      if (!remaining || remaining.length === 0) {
        await supabase.from("tasks" as any).update({
          is_completed: true, status: "done",
          completed_at: new Date().toISOString(), completed_by: user?.id,
        } as any).eq("id", parentId);
      }
    }

    qc.invalidateQueries({ queryKey: ["all-tasks-page"] });
    qc.invalidateQueries({ queryKey: ["my-tasks"] });
    parentIds.forEach(pid => qc.invalidateQueries({ queryKey: ["subtasks", pid] }));
    qc.invalidateQueries({ queryKey: ["merged-subtasks", ...parentIds] });
  }, [allSubtasks, user?.id, qc, parentIds]);

  const completeAll = useCallback(async () => {
    const openSubs = allSubtasks.filter(s => !s.is_completed);
    for (const sub of openSubs) {
      await supabase.from("tasks" as any).update({
        is_completed: true, status: "done",
        completed_at: new Date().toISOString(), completed_by: user?.id,
      } as any).eq("id", sub.id);
    }
    for (const pt of parentTasks) {
      await supabase.from("tasks" as any).update({
        is_completed: true, status: "done",
        completed_at: new Date().toISOString(), completed_by: user?.id,
      } as any).eq("id", pt.id);
    }
    toast.success("🎉 Alle Aufgaben erledigt!");
    confetti({ particleCount: 60, spread: 50, origin: { y: 0.7 }, colors: ["#0083F7", "#21089B", "#10B981"] });
    qc.invalidateQueries({ queryKey: ["all-tasks-page"] });
    qc.invalidateQueries({ queryKey: ["my-tasks"] });
    qc.invalidateQueries({ queryKey: ["merged-subtasks", ...parentIds] });
  }, [allSubtasks, parentTasks, user?.id, qc, parentIds]);

  const addSubtask = async () => {
    if (!quickTitle.trim()) return;
    const firstParent = parentTasks[0];
    await supabase.from("tasks" as any).insert({
      title: quickTitle.trim(),
      client_id: clientId,
      assigned_to: firstParent.assigned_to,
      parent_id: firstParent.id,
      status: "not_started",
      created_by: user?.id,
      group_source: "manual",
    } as any);
    setQuickTitle("");
    qc.invalidateQueries({ queryKey: ["merged-subtasks", ...parentIds] });
    qc.invalidateQueries({ queryKey: ["all-tasks-page"] });
  };

  const sortedSubtasks = [...allSubtasks].sort((a, b) => {
    if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
    return 0;
  });

  // Build title like "Pieces schneiden — Hpy&Immo"
  const label = `Pieces schneiden — ${clientName}`;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden border-l-2 border-l-primary">
      <div
        className="flex items-center gap-2.5 px-3 py-2.5 bg-surface-elevated cursor-pointer hover:bg-surface-hover transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <ChevronRight className={cn(
          "h-4 w-4 text-muted-foreground transition-transform shrink-0",
          expanded && "rotate-90"
        )} />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-display font-semibold truncate block">{label}</span>
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
            size="sm" variant="ghost"
            className="h-6 text-[10px] px-2 text-primary hover:text-primary shrink-0"
            onClick={(e) => { e.stopPropagation(); completeAll(); }}
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
      </div>

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

export default React.memo(MergedGroupCard);
