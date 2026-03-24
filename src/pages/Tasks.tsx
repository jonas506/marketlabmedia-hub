import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ChevronLeft, ChevronRight, ChevronDown, CalendarIcon, Plus, Send,
  Clock, AlertTriangle, Calendar as CalendarIconAlt,
} from "lucide-react";
import { format, isToday, isBefore, startOfDay, endOfWeek, startOfWeek, addDays, subDays } from "date-fns";
import { de } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ErrorBoundary from "@/components/ErrorBoundary";

interface Task {
  id: string;
  client_id: string;
  title: string;
  tag: string | null;
  assigned_to: string | null;
  deadline: string | null;
  due_time: string | null;
  is_completed: boolean;
  notes: string | null;
  description: string | null;
  priority: string | null;
  status: string | null;
  created_at: string;
  created_by: string | null;
  sort_order: number | null;
}

interface TeamMember {
  user_id: string;
  name: string | null;
  email: string | null;
}

interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

const STATUS_CONFIG = [
  { value: "not_started", label: "Offen", cssClass: "monday-status-default" },
  { value: "in_progress", label: "Begonnen", cssClass: "monday-status-working" },
  { value: "review", label: "Besprechen", cssClass: "monday-status-review" },
  { value: "done", label: "Fertig", cssClass: "monday-status-done" },
];

const PRIORITY_CONFIG = [
  { value: "low", label: "Niedrig", dot: "bg-[hsl(var(--status-default))]" },
  { value: "normal", label: "Normal", dot: "bg-[hsl(var(--status-working))]" },
  { value: "high", label: "Hoch", dot: "bg-[hsl(var(--status-review))]" },
  { value: "urgent", label: "Dringend", dot: "bg-[hsl(var(--status-stuck))]" },
];

const getInitials = (name: string | null | undefined) => {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
};

const getSC = (s: string | null) => STATUS_CONFIG.find(c => c.value === (s || "not_started")) || STATUS_CONFIG[0];
const getPC = (p: string | null) => PRIORITY_CONFIG.find(c => c.value === (p || "normal")) || PRIORITY_CONFIG[1];

type GroupKey = "overdue" | "today" | "week" | "later" | "no_deadline";
const GROUP_META: Record<GroupKey, { label: string; color: string; icon: any }> = {
  overdue: { label: "Überfällig", color: "text-destructive", icon: AlertTriangle },
  today: { label: "Heute", color: "text-[hsl(var(--status-working))]", icon: Clock },
  week: { label: "Diese Woche", color: "text-muted-foreground", icon: CalendarIconAlt },
  later: { label: "Später", color: "text-muted-foreground", icon: CalendarIcon },
  no_deadline: { label: "Ohne Deadline", color: "text-muted-foreground/50", icon: CalendarIcon },
};

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

function sortByPriority(tasks: Task[]): Task[] {
  return tasks.sort((a, b) => (PRIORITY_ORDER[a.priority || "normal"] ?? 2) - (PRIORITY_ORDER[b.priority || "normal"] ?? 2));
}

function groupTasks(tasks: Task[], todayStr: string): Record<GroupKey, Task[]> {
  const today = startOfDay(new Date(todayStr));
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const groups: Record<GroupKey, Task[]> = { overdue: [], today: [], week: [], later: [], no_deadline: [] };
  tasks.forEach(t => {
    if (!t.deadline) { groups.no_deadline.push(t); return; }
    const d = startOfDay(new Date(t.deadline));
    if (isBefore(d, today)) groups.overdue.push(t);
    else if (isToday(d)) groups.today.push(t);
    else if (isBefore(d, weekEnd) || d.getTime() === weekEnd.getTime()) groups.week.push(t);
    else groups.later.push(t);
  });
  // Sort each group by priority (urgent first)
  for (const key of Object.keys(groups) as GroupKey[]) {
    sortByPriority(groups[key]);
  }
  return groups;
}

const Tasks = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [viewMode, setViewMode] = useState<"team" | "mine">("team");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [quickTitle, setQuickTitle] = useState("");
  const todayStr = format(new Date(), "yyyy-MM-dd");

  // Fetch all open tasks
  const { data: allTasks = [] } = useQuery({
    queryKey: ["all-tasks-page"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks" as any)
        .select("*")
        .eq("is_completed", false)
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

  // Task detail
  const { data: comments = [], refetch: refetchComments } = useQuery({
    queryKey: ["task-comments", selectedTask?.id],
    queryFn: async () => {
      if (!selectedTask) return [];
      const { data } = await supabase
        .from("task_comments" as any)
        .select("*")
        .eq("task_id", selectedTask.id)
        .order("created_at", { ascending: true });
      return (data as any[] ?? []) as TaskComment[];
    },
    enabled: !!selectedTask,
  });

  const [commentText, setCommentText] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editNotes, setEditNotes] = useState("");

  useEffect(() => {
    if (selectedTask) {
      setEditTitle(selectedTask.title);
      setEditDesc(selectedTask.description || "");
      setEditNotes(selectedTask.notes || "");
      setCommentText("");
    }
  }, [selectedTask?.id]);

  const updateTask = useCallback(async (taskId: string, updates: Record<string, any>) => {
    await supabase.from("tasks" as any).update(updates as any).eq("id", taskId);
    qc.invalidateQueries({ queryKey: ["all-tasks-page"] });
    qc.invalidateQueries({ queryKey: ["my-tasks"] });
    qc.invalidateQueries({ queryKey: ["tasks"] });
    if (selectedTask?.id === taskId) {
      setSelectedTask(prev => prev ? { ...prev, ...updates } : null);
    }
  }, [qc, selectedTask]);

  const addComment = async () => {
    if (!commentText.trim() || !selectedTask || !user) return;
    await supabase.from("task_comments" as any).insert({
      task_id: selectedTask.id,
      user_id: user.id,
      content: commentText.trim(),
    } as any);
    setCommentText("");
    refetchComments();
  };

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

  const completeTask = async (task: Task) => {
    await supabase.from("tasks" as any).update({ is_completed: true, status: "done" } as any).eq("id", task.id);
    qc.invalidateQueries({ queryKey: ["all-tasks-page"] });
    qc.invalidateQueries({ queryKey: ["my-tasks"] });
    qc.invalidateQueries({ queryKey: ["tasks", task.client_id] });
    toast.success("✓ Erledigt");
  };

  // My tasks view
  const myTasks = useMemo(() => {
    return allTasks.filter(t => t.assigned_to === user?.id);
  }, [allTasks, user?.id]);

  const myGrouped = useMemo(() => groupTasks(myTasks, todayStr), [myTasks, todayStr]);

  // Team view - group by person
  const teamColumns = useMemo(() => {
    return team.map(member => {
      const tasks = allTasks.filter(t => t.assigned_to === member.user_id);
      const grouped = groupTasks(tasks, todayStr);
      return { member, tasks, grouped };
    });
  }, [team, allTasks, todayStr]);

  const unassignedTasks = useMemo(() => allTasks.filter(t => !t.assigned_to), [allTasks]);

  const renderTaskCard = (task: Task, showClient = true) => {
    const sc = getSC(task.status);
    const pc = getPC(task.priority);
    const isOverdue = task.deadline && task.deadline < todayStr;

    return (
      <motion.div
        key={task.id}
        layout
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="flex items-start gap-2 px-3 py-2 rounded-lg bg-card border border-border/50 hover:border-border cursor-pointer group transition-all"
        onClick={() => setSelectedTask(task)}
      >
        <Checkbox
          checked={false}
          onCheckedChange={() => completeTask(task)}
          onClick={e => e.stopPropagation()}
          className="mt-0.5 shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", pc.dot)} />
            <span className="text-sm font-body truncate">{task.title}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {showClient && task.client_id && (
              <span className="text-[10px] font-mono text-muted-foreground truncate max-w-24">
                {clientMap[task.client_id] || ""}
              </span>
            )}
            <span className={cn("monday-status text-[8px] py-0 px-1.5", sc.cssClass)}>{sc.label}</span>
            {task.deadline && (
              <span className={cn("text-[10px] font-mono shrink-0", isOverdue ? "text-destructive" : "text-muted-foreground")}>
                {format(new Date(task.deadline), "dd.MM", { locale: de })}
                {task.due_time && ` ${(task.due_time as string).slice(0, 5)}`}
              </span>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  const renderGroupSection = (key: GroupKey, tasks: Task[], defaultOpen = true) => {
    if (tasks.length === 0) return null;
    const meta = GROUP_META[key];
    const Icon = meta.icon;
    return (
      <Collapsible key={key} defaultOpen={defaultOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 px-2 py-1.5 w-full text-left hover:bg-surface-hover rounded-md transition-colors">
          <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform [[data-state=closed]_&]:-rotate-90" />
          <Icon className={cn("h-3 w-3", meta.color)} />
          <span className={cn("text-xs font-display font-semibold", meta.color)}>{meta.label}</span>
          <span className="text-[10px] font-mono text-muted-foreground">{tasks.length}</span>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-1 mt-1">
          <AnimatePresence mode="popLayout">
            {tasks.map(t => renderTaskCard(t))}
          </AnimatePresence>
        </CollapsibleContent>
      </Collapsible>
    );
  };

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
          {/* View toggle */}
          <div className="flex items-center gap-1 bg-surface-elevated rounded-lg p-0.5 border border-border">
            <button
              onClick={() => setViewMode("team")}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-mono transition-all",
                viewMode === "team" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Team
            </button>
            <button
              onClick={() => setViewMode("mine")}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-mono transition-all",
                viewMode === "mine" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Meine
            </button>
          </div>
        </div>

        {viewMode === "mine" ? (
          /* ── MEINE AUFGABEN ── */
          <div className="space-y-4">
            {/* Quick add */}
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

            <div className="space-y-3">
              {renderGroupSection("overdue", myGrouped.overdue)}
              {renderGroupSection("today", myGrouped.today)}
              {renderGroupSection("week", myGrouped.week)}
              {renderGroupSection("later", myGrouped.later)}
              {renderGroupSection("no_deadline", myGrouped.no_deadline, false)}
              {myTasks.length === 0 && (
                <div className="py-12 text-center text-xs text-muted-foreground/40 font-mono">
                  Keine offenen Aufgaben ✓
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── TEAM TAGESANSICHT ── */
          <div className="space-y-4">
            {/* Date navigation */}
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
              {!isToday(selectedDate) && (
                <Button variant="outline" size="sm" className="h-8 text-xs font-mono" onClick={() => setSelectedDate(new Date())}>
                  Heute
                </Button>
              )}
            </div>

            {/* Team columns - horizontal on desktop, vertical on mobile */}
            <div className="flex gap-4 overflow-x-auto pb-2 snap-x md:snap-none">
              {teamColumns.map(({ member, grouped }) => {
                const totalTasks = Object.values(grouped).flat().length;
                return (
                  <div key={member.user_id} className="min-w-[280px] md:min-w-0 md:flex-1 snap-start">
                    <div className="rounded-xl border border-border bg-card overflow-hidden">
                      {/* Person header */}
                      <div className="flex items-center gap-2.5 px-3 py-2.5 bg-surface-elevated border-b border-border">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-[10px] font-bold bg-gradient-to-br from-primary to-secondary text-white">
                            {getInitials(member.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-display font-semibold truncate">{member.name || member.email}</p>
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full">
                          {totalTasks}
                        </span>
                      </div>

                      {/* Task groups */}
                      <div className="p-2 space-y-2 max-h-[60vh] overflow-y-auto">
                        {grouped.overdue.length > 0 && (
                          <div>
                            <p className="text-[10px] font-mono text-destructive font-semibold px-1 mb-1">Überfällig</p>
                            <div className="space-y-1">
                              <AnimatePresence mode="popLayout">
                                {grouped.overdue.map(t => renderTaskCard(t))}
                              </AnimatePresence>
                            </div>
                          </div>
                        )}
                        {grouped.today.length > 0 && (
                          <div>
                            <p className="text-[10px] font-mono text-[hsl(var(--status-working))] font-semibold px-1 mb-1">Heute</p>
                            <div className="space-y-1">
                              <AnimatePresence mode="popLayout">
                                {grouped.today.map(t => renderTaskCard(t))}
                              </AnimatePresence>
                            </div>
                          </div>
                        )}
                        {grouped.week.length > 0 && (
                          <div>
                            <p className="text-[10px] font-mono text-muted-foreground font-semibold px-1 mb-1">Diese Woche</p>
                            <div className="space-y-1">
                              <AnimatePresence mode="popLayout">
                                {grouped.week.map(t => renderTaskCard(t))}
                              </AnimatePresence>
                            </div>
                          </div>
                        )}
                        {grouped.no_deadline.length > 0 && (
                          <Collapsible defaultOpen={false}>
                            <CollapsibleTrigger className="flex items-center gap-1 px-1 py-0.5 w-full text-left">
                              <ChevronDown className="h-2.5 w-2.5 text-muted-foreground/40 transition-transform [[data-state=closed]_&]:-rotate-90" />
                              <span className="text-[10px] font-mono text-muted-foreground/40">Ohne Deadline ({grouped.no_deadline.length})</span>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="space-y-1 mt-1">
                              <AnimatePresence mode="popLayout">
                                {grouped.no_deadline.map(t => renderTaskCard(t))}
                              </AnimatePresence>
                            </CollapsibleContent>
                          </Collapsible>
                        )}
                        {totalTasks === 0 && (
                          <div className="py-6 text-center text-[10px] text-muted-foreground/30 font-mono">Keine Aufgaben</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Unassigned column */}
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
                        {unassignedTasks.map(t => renderTaskCard(t))}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TASK DETAIL SHEET ── */}
        <Sheet open={!!selectedTask} onOpenChange={o => !o && setSelectedTask(null)}>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="sr-only">Aufgabe bearbeiten</SheetTitle>
            </SheetHeader>
            {selectedTask && (
              <div className="space-y-5 pt-2">
                {/* Title */}
                <Input
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  onBlur={() => editTitle !== selectedTask.title && updateTask(selectedTask.id, { title: editTitle })}
                  className="text-lg font-display font-bold border-0 shadow-none px-0 focus-visible:ring-0 h-auto"
                />

                {/* Meta grid */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Status */}
                  <div>
                    <label className="text-[10px] font-mono text-muted-foreground uppercase mb-1 block">Status</label>
                    <Select
                      value={selectedTask.status || "not_started"}
                      onValueChange={v => {
                        if (v === "done") {
                          completeTask(selectedTask);
                          setSelectedTask(null);
                        } else {
                          updateTask(selectedTask.id, { status: v });
                        }
                      }}
                    >
                      <SelectTrigger className={cn("h-8 text-xs", getSC(selectedTask.status).cssClass)}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_CONFIG.map(s => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Priority */}
                  <div>
                    <label className="text-[10px] font-mono text-muted-foreground uppercase mb-1 block">Priorität</label>
                    <Select
                      value={selectedTask.priority || "normal"}
                      onValueChange={v => updateTask(selectedTask.id, { priority: v })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY_CONFIG.map(p => (
                          <SelectItem key={p.value} value={p.value}>
                            <div className="flex items-center gap-2">
                              <div className={cn("w-2 h-2 rounded-full", p.dot)} />
                              {p.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Assigned */}
                  <div>
                    <label className="text-[10px] font-mono text-muted-foreground uppercase mb-1 block">Zugewiesen an</label>
                    <Select
                      value={selectedTask.assigned_to || "unassigned"}
                      onValueChange={v => updateTask(selectedTask.id, { assigned_to: v === "unassigned" ? null : v })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">— Keine —</SelectItem>
                        {team.map(t => (
                          <SelectItem key={t.user_id} value={t.user_id}>{t.name || t.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Client */}
                  <div>
                    <label className="text-[10px] font-mono text-muted-foreground uppercase mb-1 block">Kunde</label>
                    <Select
                      value={selectedTask.client_id || ""}
                      onValueChange={v => updateTask(selectedTask.id, { client_id: v })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Deadline */}
                  <div>
                    <label className="text-[10px] font-mono text-muted-foreground uppercase mb-1 block">Deadline</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="h-8 w-full text-xs justify-start gap-2">
                          <CalendarIcon className="h-3 w-3" />
                          {selectedTask.deadline
                            ? format(new Date(selectedTask.deadline), "dd. MMM yyyy", { locale: de })
                            : "Keine"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={selectedTask.deadline ? new Date(selectedTask.deadline) : undefined}
                          onSelect={date => updateTask(selectedTask.id, { deadline: date ? format(date, "yyyy-MM-dd") : null })}
                          locale={de}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Due time */}
                  <div>
                    <label className="text-[10px] font-mono text-muted-foreground uppercase mb-1 block">Uhrzeit</label>
                    <Input
                      type="time"
                      value={(selectedTask.due_time as string) || ""}
                      onChange={e => updateTask(selectedTask.id, { due_time: e.target.value || null })}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="text-[10px] font-mono text-muted-foreground uppercase mb-1 block">Beschreibung</label>
                  <Textarea
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    onBlur={() => editDesc !== (selectedTask.description || "") && updateTask(selectedTask.id, { description: editDesc || null })}
                    placeholder="Beschreibung hinzufügen…"
                    className="min-h-[80px] text-sm font-body"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="text-[10px] font-mono text-muted-foreground uppercase mb-1 block">Notizen</label>
                  <Textarea
                    value={editNotes}
                    onChange={e => setEditNotes(e.target.value)}
                    onBlur={() => editNotes !== (selectedTask.notes || "") && updateTask(selectedTask.id, { notes: editNotes || null })}
                    placeholder="Notizen…"
                    className="min-h-[60px] text-sm font-body"
                  />
                </div>

                {/* Activity / Comments */}
                <div>
                  <label className="text-[10px] font-mono text-muted-foreground uppercase mb-2 block">Aktivität</label>
                  <div className="space-y-2 mb-3">
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60 font-mono">
                      <Clock className="h-3 w-3" />
                      Erstellt {format(new Date(selectedTask.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                      {selectedTask.created_by && teamMap[selectedTask.created_by] && (
                        <span>von {teamMap[selectedTask.created_by].name}</span>
                      )}
                    </div>
                    {comments.map(c => (
                      <div key={c.id} className="flex gap-2 p-2 rounded-md bg-surface-elevated">
                        <Avatar className="h-5 w-5 shrink-0">
                          <AvatarFallback className="text-[8px] font-bold">
                            {getInitials(teamMap[c.user_id]?.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold">{teamMap[c.user_id]?.name || "?"}</span>
                            <span className="text-[9px] text-muted-foreground font-mono">
                              {format(new Date(c.created_at), "dd.MM. HH:mm", { locale: de })}
                            </span>
                          </div>
                          <p className="text-xs font-body mt-0.5">{c.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      placeholder="Kommentar schreiben…"
                      className="text-xs h-8 flex-1"
                      onKeyDown={e => { if (e.key === "Enter") addComment(); }}
                    />
                    <Button size="icon" className="h-8 w-8 shrink-0" onClick={addComment} disabled={!commentText.trim()}>
                      <Send className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </motion.div>
    </AppLayout>
  </ErrorBoundary>
    </AppLayout>
  );
};

export default Tasks;
