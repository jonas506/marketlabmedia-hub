import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Plus, CheckCircle2, List, Target } from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Task, TeamMember, groupTasks } from "@/components/tasks/constants";
import { TaskCard } from "@/components/tasks";
import TaskGroupSection from "@/components/tasks/TaskGroupSection";
import TaskGroupCard from "@/components/tasks/TaskGroupCard";
import TaskDetailSheet from "@/components/tasks/TaskDetailSheet";
import FocusMode from "@/components/todos/FocusMode";

const MyTodos = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [quickTitle, setQuickTitle] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "focus">("list");
  const [lastCreatedTaskId, setLastCreatedTaskId] = useState<string | null>(null);
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const { data: myTasks = [] } = useQuery({
    queryKey: ["my-todos-page", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("tasks" as any)
        .select("*")
        .eq("assigned_to", user.id)
        .eq("is_completed", false)
        .is("parent_id", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as any[]) as Task[];
    },
    enabled: !!user,
  });

  const { data: team = [] } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      if (!roles?.length) return [];
      const { data: profiles } = await supabase
        .from("profiles").select("user_id, name, email")
        .in("user_id", roles.map(r => r.user_id));
      return (profiles ?? []) as TeamMember[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-names"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name");
      return data ?? [];
    },
  });

  const clientMap = useMemo(() => {
    const m: Record<string, string> = {};
    clients.forEach(c => m[c.id] = c.name);
    return m;
  }, [clients]);

  const teamMap = useMemo(() => {
    const m: Record<string, TeamMember> = {};
    team.forEach(t => m[t.user_id] = t);
    return m;
  }, [team]);

  const teamNameMap = useMemo(() => {
    const m: Record<string, { name: string | null }> = {};
    team.forEach(t => m[t.user_id] = { name: t.name });
    return m;
  }, [team]);

  const isGroupTask = useCallback((task: any) => {
    return task.group_source && !task.content_piece_id;
  }, []);

  const regularTasks = useMemo(() => myTasks.filter(t => !isGroupTask(t)), [myTasks, isGroupTask]);
  const groupTasks_ = useMemo(() => myTasks.filter(t => isGroupTask(t)), [myTasks, isGroupTask]);
  const grouped = useMemo(() => groupTasks(regularTasks, todayStr), [regularTasks, todayStr]);

  const completeTask = useCallback(async (task: Task) => {
    await supabase.from("tasks" as any).update({
      is_completed: true,
      status: "done",
      completed_at: new Date().toISOString(),
      completed_by: user?.id,
    } as any).eq("id", task.id);
    qc.invalidateQueries({ queryKey: ["my-todos-page"] });
    qc.invalidateQueries({ queryKey: ["my-tasks"] });
    qc.invalidateQueries({ queryKey: ["all-tasks-page"] });
    toast.success("✓ Erledigt");
    confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 } });
  }, [qc, user?.id]);

  const selectTask = useCallback((task: Task) => setSelectedTask(task), []);
  const closeDetail = useCallback(() => setSelectedTask(null), []);

  const quickAdd = async () => {
    if (!quickTitle.trim() || !user) return;
    const { data } = await supabase.from("tasks" as any).insert({
      title: quickTitle.trim(),
      client_id: clients[0]?.id || "",
      assigned_to: user.id,
      created_by: user.id,
      status: "not_started",
    } as any).select("id").single();
    setQuickTitle("");
    qc.invalidateQueries({ queryKey: ["my-todos-page"] });
    qc.invalidateQueries({ queryKey: ["my-tasks"] });
    if (viewMode === "focus" && data) {
      setLastCreatedTaskId((data as any).id);
    } else {
      toast.success("Aufgabe erstellt");
    }
  };

  const totalCount = myTasks.length;

  return (
    <AppLayout>
      <ErrorBoundary level="section">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }} className="max-w-2xl mx-auto px-1 sm:px-0">
          {/* Header */}
          <div className="mb-4 sm:mb-6 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-display font-bold tracking-tight">Meine To-Dos</h1>
              <p className="font-body text-xs text-muted-foreground mt-0.5">
                {totalCount === 0 ? "Alles erledigt 🎉" : `${totalCount} offene Aufgabe${totalCount !== 1 ? "n" : ""}`}
              </p>
            </div>
            <div className="flex gap-1 bg-muted rounded-lg p-0.5 shrink-0">
              <button
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-md text-xs font-medium transition-colors min-h-[36px] sm:min-h-0 ${
                  viewMode === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <List className="h-4 w-4 sm:h-3.5 sm:w-3.5" /> Liste
              </button>
              <button
                onClick={() => setViewMode("focus")}
                className={`flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-md text-xs font-medium transition-colors min-h-[36px] sm:min-h-0 ${
                  viewMode === "focus" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Target className="h-4 w-4 sm:h-3.5 sm:w-3.5" /> Fokus
              </button>
            </div>
          </div>

          {/* Quick Add */}
          <div className="flex items-center gap-2 p-3 sm:p-3 rounded-xl bg-card border border-border mb-4 sm:mb-5 shadow-sm">
            <Plus className="h-5 w-5 sm:h-4 sm:w-4 text-primary shrink-0" />
            <Input
              value={quickTitle}
              onChange={e => setQuickTitle(e.target.value)}
              placeholder="Neue Aufgabe… (Enter)"
              className="h-10 sm:h-8 flex-1 text-base sm:text-sm bg-transparent border-0 shadow-none focus-visible:ring-0 px-0"
              onKeyDown={e => { if (e.key === "Enter" && quickTitle.trim()) quickAdd(); }}
            />
          </div>

          {viewMode === "list" ? (
            <div className="space-y-4">
              {/* Group tasks */}
              {groupTasks_.length > 0 && (
                <div className="space-y-2">
                  {groupTasks_.map(t => (
                    <TaskGroupCard
                      key={t.id}
                      task={t as any}
                      clientMap={clientMap}
                      teamMap={teamNameMap}
                      todayStr={todayStr}
                      onSelect={selectTask}
                    />
                  ))}
                </div>
              )}

              <TaskGroupSection groupKey="overdue" tasks={grouped.overdue} clientMap={clientMap} todayStr={todayStr} onComplete={completeTask} onSelect={selectTask} />
              <TaskGroupSection groupKey="today" tasks={grouped.today} clientMap={clientMap} todayStr={todayStr} onComplete={completeTask} onSelect={selectTask} />
              <TaskGroupSection groupKey="week" tasks={grouped.week} clientMap={clientMap} todayStr={todayStr} onComplete={completeTask} onSelect={selectTask} />
              <TaskGroupSection groupKey="later" tasks={grouped.later} clientMap={clientMap} todayStr={todayStr} onComplete={completeTask} onSelect={selectTask} />
              <TaskGroupSection groupKey="no_deadline" tasks={grouped.no_deadline} defaultOpen={false} clientMap={clientMap} todayStr={todayStr} onComplete={completeTask} onSelect={selectTask} />

              {totalCount === 0 && (
                <div className="py-16 text-center">
                  <CheckCircle2 className="h-10 w-10 text-primary/20 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground/50 font-mono">Keine offenen Aufgaben</p>
                </div>
              )}
            </div>
          ) : (
            <FocusMode tasks={myTasks} clientMap={clientMap} todayStr={todayStr} lastCreatedTaskId={lastCreatedTaskId} />
          )}

          <TaskDetailSheet task={selectedTask} onClose={closeDetail} team={team} clients={clients} teamMap={teamMap} />
        </motion.div>
      </ErrorBoundary>
    </AppLayout>
  );
};

export default MyTodos;
