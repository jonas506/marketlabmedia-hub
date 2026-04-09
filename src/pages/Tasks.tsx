import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, AlertTriangle, ChevronRight, CheckCheck } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Task, TeamMember, GroupKey, groupTasks, getInitials, sortByPriority } from "@/components/tasks/constants";
import { TaskCard } from "@/components/tasks";
import TaskGroupSection from "@/components/tasks/TaskGroupSection";
import MergedGroupCard from "@/components/tasks/MergedGroupCard";
import CompletedTasksView from "@/components/tasks/CompletedTasksView";
import TaskDetailSheet from "@/components/tasks/TaskDetailSheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from "react-router-dom";

interface ClientInfo {
  id: string;
  name: string;
  logo_url: string | null;
}

/** A single client row with logo, tasks grouped inline */
const ClientTaskRow: React.FC<{
  client: ClientInfo;
  tasks: Task[];
  groupParentTasks: Task[];
  todayStr: string;
  personNameMap: Record<string, string>;
  teamNameMap: Record<string, { name: string | null }>;
  onComplete: (task: Task) => void;
  onSelect: (task: Task) => void;
}> = React.memo(({ client, tasks, groupParentTasks, todayStr, personNameMap, teamNameMap, onComplete, onSelect }) => {
  const [expanded, setExpanded] = useState(true);
  const navigate = useNavigate();

  const overdueCount = tasks.filter(t => t.deadline && t.deadline < todayStr).length;
  const totalCount = tasks.length + groupParentTasks.length;

  // Sort: overdue first, then by priority
  const sortedTasks = useMemo(() => {
    const sorted = [...tasks];
    sorted.sort((a, b) => {
      const aOverdue = a.deadline && a.deadline < todayStr ? 0 : 1;
      const bOverdue = b.deadline && b.deadline < todayStr ? 0 : 1;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;
      const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
      return (priorityOrder[a.priority || "normal"] ?? 2) - (priorityOrder[b.priority || "normal"] ?? 2);
    });
    return sorted;
  }, [tasks, todayStr]);

  if (totalCount === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Client header */}
      <div
        className="flex items-center gap-3 px-4 py-3 bg-surface-elevated cursor-pointer hover:bg-surface-hover transition-colors border-b border-border"
        onClick={() => setExpanded(!expanded)}
      >
        <Avatar className="h-8 w-8 rounded-lg shrink-0">
          {client.logo_url ? (
            <AvatarImage src={client.logo_url} alt={client.name} className="object-contain" />
          ) : null}
          <AvatarFallback className="rounded-lg text-[10px] font-bold bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
            {client.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-display font-semibold truncate block">{client.name}</span>
        </div>
        {overdueCount > 0 && (
          <span className="flex items-center gap-1 text-[10px] font-mono text-destructive bg-destructive/10 px-2 py-0.5 rounded-full shrink-0">
            <AlertTriangle className="h-3 w-3" /> {overdueCount}
          </span>
        )}
        <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full shrink-0">
          {totalCount}
        </span>
        <ChevronRight className={cn(
          "h-4 w-4 text-muted-foreground transition-transform shrink-0",
          expanded && "rotate-90"
        )} />
      </div>

      {/* Tasks */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-2 space-y-1">
              {/* Merged group tasks */}
              {groupParentTasks.length > 0 && (
                <div className="mb-2">
                  <MergedGroupCard
                    clientId={client.id}
                    clientName={client.name}
                    parentTasks={groupParentTasks as any}
                    teamMap={teamNameMap}
                    todayStr={todayStr}
                    onSelect={onSelect}
                  />
                </div>
              )}
              {/* Regular tasks */}
              <AnimatePresence mode="popLayout">
                {sortedTasks.map(t => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    showClient={false}
                    showPerson
                    personName={t.assigned_to ? personNameMap[t.assigned_to] : null}
                    todayStr={todayStr}
                    onComplete={onComplete}
                    onSelect={onSelect}
                  />
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

ClientTaskRow.displayName = "ClientTaskRow";

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
    queryKey: ["clients-with-logos"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name, logo_url").eq("status", "active").order("name");
      return (data ?? []) as ClientInfo[];
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

  // === Team view: Group by client ===
  const clientTaskGroups = useMemo(() => {
    const regularByClient: Record<string, Task[]> = {};
    const groupByClient: Record<string, Task[]> = {};

    allTasks.forEach(t => {
      const cid = t.client_id || "no-client";
      if (isGroupTask(t)) {
        if (!groupByClient[cid]) groupByClient[cid] = [];
        groupByClient[cid].push(t);
      } else {
        if (!regularByClient[cid]) regularByClient[cid] = [];
        regularByClient[cid].push(t);
      }
    });

    // Build per-client groups, sorted by urgency (overdue count desc)
    const allClientIds = new Set([...Object.keys(regularByClient), ...Object.keys(groupByClient)]);
    const groups = Array.from(allClientIds).map(cid => {
      const regular = regularByClient[cid] || [];
      const group = groupByClient[cid] || [];
      const overdueCount = regular.filter(t => t.deadline && t.deadline < todayStr).length;
      return { clientId: cid, regular, group, overdueCount, total: regular.length + group.length };
    });

    // Sort: most overdue first, then most tasks
    groups.sort((a, b) => {
      if (a.overdueCount !== b.overdueCount) return b.overdueCount - a.overdueCount;
      return b.total - a.total;
    });

    return groups;
  }, [allTasks, todayStr, isGroupTask]);

  const clientInfoMap = useMemo(() => {
    const m: Record<string, ClientInfo> = {};
    clients.forEach(c => m[c.id] = c);
    return m;
  }, [clients]);

  // === My tasks ===
  const myTasks = useMemo(() => allTasks.filter(t => t.assigned_to === user?.id), [allTasks, user?.id]);
  const myRegular = useMemo(() => myTasks.filter(t => !isGroupTask(t)), [myTasks, isGroupTask]);
  const myGrouped = useMemo(() => groupTasks(myRegular, todayStr), [myRegular, todayStr]);
  const myGroupTasks = useMemo(() => myTasks.filter(t => isGroupTask(t)), [myTasks, isGroupTask]);
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
  const myMergedGroups = useMemo(() => mergeByClient(myGroupTasks), [myGroupTasks, mergeByClient]);

  // Summary stats
  const totalOpen = allTasks.length;
  const overdueCount = useMemo(() => allTasks.filter(t => !isGroupTask(t) && t.deadline && t.deadline < todayStr).length, [allTasks, todayStr, isGroupTask]);

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
          /* ====== TEAM VIEW: Client list ====== */
          <div className="space-y-3">
            {clientTaskGroups.map(({ clientId, regular, group }) => {
              const info = clientInfoMap[clientId] || { id: clientId, name: clientMap[clientId] || "Unbekannt", logo_url: null };
              return (
                <ClientTaskRow
                  key={clientId}
                  client={info}
                  tasks={regular}
                  groupParentTasks={group}
                  todayStr={todayStr}
                  personNameMap={personNameMap}
                  teamNameMap={teamNameMap}
                  onComplete={completeTask}
                  onSelect={selectTask}
                />
              );
            })}

            {totalOpen === 0 && (
              <div className="py-12 text-center text-xs text-muted-foreground/40 font-mono">
                Keine offenen Aufgaben ✓
              </div>
            )}
          </div>
        )}

        <TaskDetailSheet task={selectedTask} onClose={closeDetail} team={team} clients={clients as any} teamMap={teamMap} />
      </motion.div>
      </ErrorBoundary>
    </AppLayout>
  );
};

export default Tasks;
