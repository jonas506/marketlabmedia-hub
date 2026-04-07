import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { format, isToday as isTodayFn, addDays, subDays } from "date-fns";
import { de } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Task, TeamMember, GroupKey, groupTasks, getInitials } from "@/components/tasks/constants";
import { TaskCard } from "@/components/tasks";
import TaskGroupSection from "@/components/tasks/TaskGroupSection";
import TeamTaskColumn from "@/components/tasks/TeamTaskColumn";
import TaskDetailSheet from "@/components/tasks/TaskDetailSheet";
import TaskGroupCard from "@/components/tasks/TaskGroupCard";
import MergedGroupCard from "@/components/tasks/MergedGroupCard";
import CompletedTasksView from "@/components/tasks/CompletedTasksView";

const Tasks = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [viewMode, setViewMode] = useState<"team" | "mine" | "done">("team");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [quickTitle, setQuickTitle] = useState("");
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const { data: allTasks = [] } = useQuery({
    queryKey: ["all-tasks-page"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks" as any)
        .select("*")
        .eq("is_completed", false)
        .is("parent_id", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as any[]) as Task[];
    },
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

  // Detect group tasks (those with group_source and no content_piece_id = parent tasks)
  const isGroupTask = useCallback((task: any) => {
    return task.group_source && !task.content_piece_id;
  }, []);

  const completeTask = useCallback(async (task: Task) => {
    await supabase.from("tasks" as any).update({
      is_completed: true,
      status: "done",
      completed_at: new Date().toISOString(),
      completed_by: user?.id,
    } as any).eq("id", task.id);
    qc.invalidateQueries({ queryKey: ["all-tasks-page"] });
    qc.invalidateQueries({ queryKey: ["my-tasks"] });
    qc.invalidateQueries({ queryKey: ["tasks", task.client_id] });
    toast.success("✓ Erledigt");
  }, [qc, user?.id]);

  const selectTask = useCallback((task: Task) => setSelectedTask(task), []);
  const closeDetail = useCallback(() => setSelectedTask(null), []);

  const quickAdd = async () => {
    if (!quickTitle.trim() || !user) return;
    await supabase.from("tasks" as any).insert({
      title: quickTitle.trim(),
      client_id: clients[0]?.id || "",
      assigned_to: user.id,
      created_by: user.id,
      status: "not_started",
    } as any);
    setQuickTitle("");
    qc.invalidateQueries({ queryKey: ["all-tasks-page"] });
    qc.invalidateQueries({ queryKey: ["my-tasks"] });
    toast.success("Aufgabe erstellt");
  };

  const myTasks = useMemo(() => allTasks.filter(t => t.assigned_to === user?.id), [allTasks, user?.id]);
  const myGroupTasks = useMemo(() => myTasks.filter(t => isGroupTask(t)), [myTasks, isGroupTask]);
  const myMergedGroups = useMemo(() => mergeByClient(myGroupTasks), [myGroupTasks, mergeByClient]);

  // Merge group tasks by client per team member
  const mergeByClient = useCallback((groupTasks: Task[]) => {
    const byClient: Record<string, Task[]> = {};
    groupTasks.forEach(t => {
      const key = t.client_id || "unknown";
      if (!byClient[key]) byClient[key] = [];
      byClient[key].push(t);
    });
    return Object.entries(byClient).map(([cid, tasks]) => ({
      clientId: cid,
      clientName: clientMap[cid] || "Unbekannt",
      parentTasks: tasks,
    }));
  }, [clientMap]);

  const teamColumns = useMemo(() => {
    return team.map(member => {
      const tasks = allTasks.filter(t => t.assigned_to === member.user_id);
      const regularTasks = tasks.filter(t => !isGroupTask(t));
      const groupedTasks = tasks.filter(t => isGroupTask(t));
      const grouped = groupTasks(regularTasks, todayStr);
      const mergedGroups = mergeByClient(groupedTasks);
      return { member, grouped, mergedGroups };
    });
  }, [team, allTasks, todayStr, isGroupTask, mergeByClient]);

  const unassignedTasks = useMemo(() => allTasks.filter(t => !t.assigned_to), [allTasks]);
  const unassignedGrouped = useMemo(() => groupTasks(unassignedTasks, todayStr), [unassignedTasks, todayStr]);

  const VIEW_TABS = [
    { key: "team" as const, label: "Team" },
    { key: "mine" as const, label: "Meine" },
    { key: "done" as const, label: "Erledigt" },
  ];

  return (
    <AppLayout>
      <ErrorBoundary level="section">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-display font-bold tracking-tight">Aufgaben</h1>
            <p className="font-body text-xs text-muted-foreground mt-0.5">
              Aufgaben im Team verwalten und priorisieren
            </p>
          </div>
          <div className="flex items-center gap-1 bg-surface-elevated rounded-lg p-0.5 border border-border">
            {VIEW_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setViewMode(tab.key)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-mono transition-all",
                  viewMode === tab.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {viewMode === "done" ? (
          <CompletedTasksView team={team} />
        ) : viewMode === "mine" ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-card border border-border">
              <Plus className="h-4 w-4 text-muted-foreground/40 shrink-0" />
              <Input
                value={quickTitle}
                onChange={e => setQuickTitle(e.target.value)}
                placeholder="Neue Aufgabe hinzufügen… (Enter)"
                className="h-8 flex-1 text-sm bg-transparent border-0 shadow-none focus-visible:ring-0 px-0"
                onKeyDown={e => { if (e.key === "Enter" && quickTitle.trim()) quickAdd(); }}
              />
            </div>

            {/* Group tasks */}
            {myGroupTasks.length > 0 && (
              <div className="space-y-2">
                {myGroupTasks.map(t => (
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

            <div className="space-y-3">
              <TaskGroupSection groupKey="overdue" tasks={myGrouped.overdue} clientMap={clientMap} todayStr={todayStr} onComplete={completeTask} onSelect={selectTask} />
              <TaskGroupSection groupKey="today" tasks={myGrouped.today} clientMap={clientMap} todayStr={todayStr} onComplete={completeTask} onSelect={selectTask} />
              <TaskGroupSection groupKey="week" tasks={myGrouped.week} clientMap={clientMap} todayStr={todayStr} onComplete={completeTask} onSelect={selectTask} />
              <TaskGroupSection groupKey="later" tasks={myGrouped.later} clientMap={clientMap} todayStr={todayStr} onComplete={completeTask} onSelect={selectTask} />
              <TaskGroupSection groupKey="no_deadline" tasks={myGrouped.no_deadline} defaultOpen={false} clientMap={clientMap} todayStr={todayStr} onComplete={completeTask} onSelect={selectTask} />
              {myTasks.length === 0 && (
                <div className="py-12 text-center text-xs text-muted-foreground/40 font-mono">
                  Keine offenen Aufgaben ✓
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedDate(prev => subDays(prev, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-display text-sm font-semibold min-w-36 text-center">
                {format(selectedDate, "EEEE, dd. MMMM yyyy", { locale: de })}
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedDate(prev => addDays(prev, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              {!isTodayFn(selectedDate) && (
                <Button variant="outline" size="sm" className="h-8 text-xs font-mono" onClick={() => setSelectedDate(new Date())}>
                  Heute
                </Button>
              )}
            </div>

            <div className="flex gap-4 overflow-x-auto pb-2 snap-x md:snap-none">
              {teamColumns.map(({ member, grouped, mergedGroups }) => (
                <div key={member.user_id} className="min-w-[280px] md:min-w-0 md:flex-1 snap-start space-y-2">
                  {/* Merged group tasks by client */}
                  {mergedGroups.map(mg => (
                    <MergedGroupCard
                      key={mg.clientId}
                      clientId={mg.clientId}
                      clientName={mg.clientName}
                      parentTasks={mg.parentTasks as any}
                      teamMap={teamNameMap}
                      todayStr={todayStr}
                      onSelect={selectTask}
                    />
                  ))}
                  <TeamTaskColumn member={member} grouped={grouped} clientMap={clientMap} todayStr={todayStr} onComplete={completeTask} onSelect={selectTask} />
                </div>
              ))}

              {unassignedTasks.length > 0 && (
                <div className="min-w-[280px] md:min-w-0 md:flex-1 snap-start">
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="flex items-center gap-2.5 px-3 py-2.5 bg-surface-elevated border-b border-border">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-[10px] font-bold bg-muted text-muted-foreground">?</AvatarFallback>
                      </Avatar>
                      <p className="text-xs font-display font-semibold text-muted-foreground">Nicht zugewiesen</p>
                      <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full ml-auto">
                        {unassignedTasks.length}
                      </span>
                    </div>
                    <div className="p-2 space-y-1 max-h-[60vh] overflow-y-auto">
                      <AnimatePresence mode="popLayout">
                        {unassignedTasks.map(t => (
                          <TaskCard key={t.id} task={t} clientMap={clientMap} todayStr={todayStr} onComplete={completeTask} onSelect={selectTask} />
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <TaskDetailSheet task={selectedTask} onClose={closeDetail} team={team} clients={clients} teamMap={teamMap} />
      </motion.div>
      </ErrorBoundary>
    </AppLayout>
  );
};

export default Tasks;
