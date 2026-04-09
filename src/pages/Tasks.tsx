import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, AlertTriangle, Clock, Calendar, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Task, TeamMember, GroupKey, groupTasks, getInitials } from "@/components/tasks/constants";
import { TaskCard } from "@/components/tasks";
import TaskGroupSection from "@/components/tasks/TaskGroupSection";
import MergedGroupCard from "@/components/tasks/MergedGroupCard";
import CompletedTasksView from "@/components/tasks/CompletedTasksView";
import TaskDetailSheet from "@/components/tasks/TaskDetailSheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

const PRIORITY_COLUMNS = [
  { key: "overdue" as GroupKey, label: "Überfällig", icon: AlertTriangle, color: "text-destructive", borderColor: "border-t-destructive", bgAccent: "bg-destructive/5" },
  { key: "today" as GroupKey, label: "Heute", icon: Clock, color: "text-[hsl(var(--status-working))]", borderColor: "border-t-[hsl(var(--status-working))]", bgAccent: "bg-[hsl(var(--status-working))]/5" },
  { key: "week" as GroupKey, label: "Diese Woche", icon: Calendar, color: "text-primary", borderColor: "border-t-primary", bgAccent: "bg-primary/5" },
  { key: "later" as GroupKey, label: "Später", icon: CalendarDays, color: "text-muted-foreground", borderColor: "border-t-muted", bgAccent: "bg-muted/5" },
];

const Tasks = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [viewMode, setViewMode] = useState<"team" | "mine" | "done">("team");
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

  const personNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    team.forEach(t => m[t.user_id] = t.name || t.email || "?");
    return m;
  }, [team]);

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

  // === Team view: Group all tasks by priority, then by client ===
  const regularTasks = useMemo(() => allTasks.filter(t => !isGroupTask(t)), [allTasks, isGroupTask]);
  const groupedByPriority = useMemo(() => groupTasks(regularTasks, todayStr), [regularTasks, todayStr]);

  // Group tasks within each priority column by client
  const groupByClient = useCallback((tasks: Task[]) => {
    const byClient: Record<string, Task[]> = {};
    tasks.forEach(t => {
      const key = t.client_id || "no-client";
      if (!byClient[key]) byClient[key] = [];
      byClient[key].push(t);
    });
    return Object.entries(byClient)
      .map(([cid, ts]) => ({ clientId: cid, clientName: clientMap[cid] || "Ohne Kunde", tasks: ts }))
      .sort((a, b) => b.tasks.length - a.tasks.length);
  }, [clientMap]);

  // Merged group tasks (Pieces schneiden etc.) grouped by priority
  const allGroupTasks = useMemo(() => allTasks.filter(t => isGroupTask(t)), [allTasks, isGroupTask]);
  const mergeByClient = useCallback((tasks: Task[]) => {
    const byClient: Record<string, Task[]> = {};
    tasks.forEach(t => {
      const key = t.client_id || "unknown";
      if (!byClient[key]) byClient[key] = [];
      byClient[key].push(t);
    });
    return Object.entries(byClient).map(([cid, ts]) => ({
      clientId: cid,
      clientName: clientMap[cid] || "Unbekannt",
      parentTasks: ts,
    }));
  }, [clientMap]);
  const mergedGroups = useMemo(() => mergeByClient(allGroupTasks), [allGroupTasks, mergeByClient]);

  // No-deadline tasks
  const noDeadlineTasks = groupedByPriority.no_deadline;
  const noDeadlineByClient = useMemo(() => groupByClient(noDeadlineTasks), [noDeadlineTasks, groupByClient]);

  // === My tasks ===
  const myTasks = useMemo(() => allTasks.filter(t => t.assigned_to === user?.id), [allTasks, user?.id]);
  const myRegular = useMemo(() => myTasks.filter(t => !isGroupTask(t)), [myTasks, isGroupTask]);
  const myGrouped = useMemo(() => groupTasks(myRegular, todayStr), [myRegular, todayStr]);
  const myGroupTasks = useMemo(() => myTasks.filter(t => isGroupTask(t)), [myTasks, isGroupTask]);
  const myMergedGroups = useMemo(() => mergeByClient(myGroupTasks), [myGroupTasks, mergeByClient]);

  // Summary stats
  const totalOpen = allTasks.length;
  const overdueCount = groupedByPriority.overdue.length;

  const VIEW_TABS = [
    { key: "team" as const, label: "Team", count: totalOpen },
    { key: "mine" as const, label: "Meine", count: myTasks.length },
    { key: "done" as const, label: "Erledigt" },
  ];

  return (
    <AppLayout>
      <ErrorBoundary level="section">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
        {/* Header */}
        <div className="mb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-display font-bold tracking-tight">Aufgaben</h1>
            {overdueCount > 0 && viewMode !== "done" && (
              <span className="flex items-center gap-1 text-[10px] font-mono text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                <AlertTriangle className="h-3 w-3" /> {overdueCount} überfällig
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 bg-surface-elevated rounded-lg p-0.5 border border-border">
            {VIEW_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setViewMode(tab.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono transition-all",
                  viewMode === tab.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className={cn(
                    "text-[10px] px-1.5 py-0 rounded-full",
                    viewMode === tab.key ? "bg-primary-foreground/20" : "bg-muted/60"
                  )}>
                    {tab.count}
                  </span>
                )}
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
            {myMergedGroups.length > 0 && (
              <div className="space-y-2">
                {myMergedGroups.map(mg => (
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
          /* ====== TEAM VIEW: Priority Kanban ====== */
          <div className="space-y-4">
            {/* Merged group tasks (Pieces schneiden) — compact summary */}
            {mergedGroups.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
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
              </div>
            )}

            {/* Priority columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {PRIORITY_COLUMNS.map(col => {
                const tasks = groupedByPriority[col.key];
                const clientGroups = groupByClient(tasks);
                const Icon = col.icon;

                return (
                  <div key={col.key} className={cn("rounded-xl border border-border bg-card overflow-hidden border-t-2", col.borderColor)}>
                    {/* Column header */}
                    <div className={cn("flex items-center gap-2 px-3 py-2.5 border-b border-border", col.bgAccent)}>
                      <Icon className={cn("h-4 w-4", col.color)} />
                      <span className={cn("text-xs font-display font-semibold", col.color)}>{col.label}</span>
                      <span className={cn("ml-auto text-[10px] font-mono font-bold rounded-full px-2 py-0.5", col.bgAccent, col.color)}>
                        {tasks.length}
                      </span>
                    </div>

                    {/* Tasks grouped by client */}
                    <div className="p-2 space-y-3 max-h-[55vh] overflow-y-auto">
                      {clientGroups.length === 0 && (
                        <div className="py-6 text-center text-[10px] text-muted-foreground/30 font-mono">
                          Keine Aufgaben
                        </div>
                      )}
                      {clientGroups.map(({ clientId, clientName, tasks: clientTasks }) => (
                        <div key={clientId}>
                          <p className="text-[10px] font-mono font-semibold text-muted-foreground px-1 mb-1 truncate">
                            {clientName}
                          </p>
                          <div className="space-y-1">
                            <AnimatePresence mode="popLayout">
                              {clientTasks.map(t => (
                                <TaskCard
                                  key={t.id}
                                  task={t}
                                  showClient={false}
                                  showPerson
                                  personName={t.assigned_to ? personNameMap[t.assigned_to] : null}
                                  todayStr={todayStr}
                                  onComplete={completeTask}
                                  onSelect={selectTask}
                                />
                              ))}
                            </AnimatePresence>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* No deadline section — collapsed */}
            {noDeadlineTasks.length > 0 && (
              <Collapsible defaultOpen={false}>
                <CollapsibleTrigger className="flex items-center gap-2 px-3 py-2 w-full text-left hover:bg-surface-hover rounded-lg transition-colors border border-border bg-card">
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform [[data-state=closed]_&]:-rotate-90" />
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground/50" />
                  <span className="text-xs font-display font-semibold text-muted-foreground">Ohne Deadline</span>
                  <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full">
                    {noDeadlineTasks.length}
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {noDeadlineByClient.map(({ clientId, clientName, tasks: clientTasks }) => (
                      <div key={clientId} className="rounded-lg border border-border/50 bg-card p-2">
                        <p className="text-[10px] font-mono font-semibold text-muted-foreground px-1 mb-1.5 truncate">
                          {clientName} <span className="text-muted-foreground/50">({clientTasks.length})</span>
                        </p>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          <AnimatePresence mode="popLayout">
                            {clientTasks.map(t => (
                              <TaskCard
                                key={t.id}
                                task={t}
                                showClient={false}
                                showPerson
                                personName={t.assigned_to ? personNameMap[t.assigned_to] : null}
                                todayStr={todayStr}
                                onComplete={completeTask}
                                onSelect={selectTask}
                              />
                            ))}
                          </AnimatePresence>
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {totalOpen === 0 && (
              <div className="py-12 text-center text-xs text-muted-foreground/40 font-mono">
                Keine offenen Aufgaben ✓
              </div>
            )}
          </div>
        )}

        <TaskDetailSheet task={selectedTask} onClose={closeDetail} team={team} clients={clients} teamMap={teamMap} />
      </motion.div>
      </ErrorBoundary>
    </AppLayout>
  );
};

export default Tasks;
