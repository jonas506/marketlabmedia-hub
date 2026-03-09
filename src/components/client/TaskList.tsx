import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Plus, CalendarIcon, Trash2, ClipboardList, Filter, Tag,
  MessageSquare, Archive, AlertTriangle, Circle,
  Clock, MessageCircle, CheckCircle2, Undo2,
  Flame, ArrowDown, Minus, ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  client_id: string;
  title: string;
  tag: string | null;
  assigned_to: string | null;
  deadline: string | null;
  is_completed: boolean;
  notes: string | null;
  priority: string | null;
  status: string | null;
  created_at: string;
}

interface TaskListProps {
  clientId: string;
  canEdit: boolean;
}

const TAG_COLORS: Record<string, string> = {
  skripte: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  "bild-ads": "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  technik: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  admin: "bg-slate-500/15 text-slate-700 dark:text-slate-400",
  feedback: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  briefing: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
};
const getTagColor = (tag: string) => TAG_COLORS[tag.toLowerCase()] || "bg-primary/10 text-primary";

const STATUS_CONFIG = [
  { value: "not_started", label: "Nicht begonnen", icon: Circle, color: "text-muted-foreground", bg: "bg-muted/40", ring: "ring-muted-foreground/20" },
  { value: "in_progress", label: "Begonnen", icon: Clock, color: "text-blue-500", bg: "bg-blue-500/10", ring: "ring-blue-500/30" },
  { value: "review", label: "Zu besprechen", icon: MessageCircle, color: "text-amber-500", bg: "bg-amber-500/10", ring: "ring-amber-500/30" },
  { value: "done", label: "Fertig", icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10", ring: "ring-emerald-500/30" },
];

const PRIORITY_CONFIG = [
  { value: "low", label: "Niedrig", icon: ArrowDown, color: "text-muted-foreground", bg: "bg-muted/40" },
  { value: "normal", label: "Normal", icon: Minus, color: "text-foreground/60", bg: "bg-muted/40" },
  { value: "high", label: "Hoch", icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-500/10" },
  { value: "urgent", label: "Dringend", icon: Flame, color: "text-destructive", bg: "bg-destructive/10" },
];

const PRIORITY_WEIGHT: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

const TaskList: React.FC<TaskListProps> = ({ clientId, canEdit }) => {
  const qc = useQueryClient();
  const [newTitle, setNewTitle] = useState("");
  const [newTag, setNewTag] = useState("");
  const [filterPerson, setFilterPerson] = useState("all");
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [showArchive, setShowArchive] = useState(false);

  const { data: team } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles").select("user_id, role")
        .in("role", ["cutter", "head_of_content", "admin"]);
      if (!roles?.length) return [];
      const { data: profiles } = await supabase
        .from("profiles").select("user_id, name, email")
        .in("user_id", roles.map((r) => r.user_id));
      return profiles ?? [];
    },
  });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks" as any).select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as any[]) as Task[];
    },
  });

  const activeTasks = useMemo(() => {
    let filtered = tasks.filter((t) => !t.is_completed);
    if (filterPerson !== "all") filtered = filtered.filter((t) => t.assigned_to === filterPerson);
    return filtered.sort((a, b) => {
      const pa = PRIORITY_WEIGHT[a.priority || "normal"] ?? 2;
      const pb = PRIORITY_WEIGHT[b.priority || "normal"] ?? 2;
      if (pa !== pb) return pa - pb;
      if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return 0;
    });
  }, [tasks, filterPerson]);

  const archivedTasks = useMemo(() => tasks.filter((t) => t.is_completed), [tasks]);

  const addTask = useMutation({
    mutationFn: async () => {
      if (!newTitle.trim()) return;
      const { error } = await supabase.from("tasks" as any).insert({
        client_id: clientId, title: newTitle.trim(), tag: newTag.trim() || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      setNewTitle(""); setNewTag("");
      qc.invalidateQueries({ queryKey: ["tasks", clientId] });
      toast.success("Aufgabe erstellt");
    },
  });

  const updateTask = useCallback(async (taskId: string, updates: Record<string, any>) => {
    await supabase.from("tasks" as any).update(updates as any).eq("id", taskId);
    qc.invalidateQueries({ queryKey: ["tasks", clientId] });
    qc.invalidateQueries({ queryKey: ["my-tasks"] });
  }, [qc, clientId]);

  const archiveTask = useCallback(async (taskId: string) => {
    await updateTask(taskId, { is_completed: true, status: "done" });
    toast.success("Aufgabe archiviert ✓");
  }, [updateTask]);

  const restoreTask = useCallback(async (taskId: string) => {
    await updateTask(taskId, { is_completed: false, status: "not_started" });
    toast("Aufgabe wiederhergestellt");
  }, [updateTask]);

  const deleteTask = useCallback(async (taskId: string) => {
    await supabase.from("tasks" as any).delete().eq("id", taskId);
    qc.invalidateQueries({ queryKey: ["tasks", clientId] });
    toast("Aufgabe gelöscht");
  }, [qc, clientId]);

  const getTeamName = (userId: string | null) => {
    if (!userId) return null;
    const m = team?.find((t) => t.user_id === userId);
    return m?.name || m?.email || null;
  };

  const getInitials = (userId: string | null) => {
    const name = getTeamName(userId);
    if (!name) return "?";
    return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  };

  const getSC = (s: string | null) => STATUS_CONFIG.find((c) => c.value === (s || "not_started")) || STATUS_CONFIG[0];
  const getPC = (p: string | null) => PRIORITY_CONFIG.find((c) => c.value === (p || "normal")) || PRIORITY_CONFIG[1];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card overflow-hidden shadow-xl"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-4">
        <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/20">
          <ClipboardList className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="font-display text-base font-semibold tracking-tight">Aufgaben</h3>
          <span className="font-mono text-[10px] text-muted-foreground">{activeTasks.length} offen</span>
        </div>
        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={filterPerson} onValueChange={setFilterPerson}>
            <SelectTrigger className="h-8 w-36 text-xs border-border/50 bg-background/50 backdrop-blur-sm">
              <SelectValue placeholder="Alle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              {team?.map((t) => (
                <SelectItem key={t.user_id} value={t.user_id}>{t.name || t.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {archivedTasks.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-8 gap-1.5 text-xs font-mono rounded-lg", showArchive && "text-primary bg-primary/5")}
            onClick={() => setShowArchive(!showArchive)}
          >
            <Archive className="h-3.5 w-3.5" />
            {archivedTasks.length}
          </Button>
        )}
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[40px_1fr_80px_100px_130px_90px_36px] items-center gap-2 px-5 py-2 border-y border-border/50 bg-muted/20">
        <span className="text-[9px] font-mono text-muted-foreground/60 uppercase text-center">P</span>
        <span className="text-[9px] font-mono text-muted-foreground/60 uppercase">Aufgabe</span>
        <span className="text-[9px] font-mono text-muted-foreground/60 uppercase text-center">Status</span>
        <span className="text-[9px] font-mono text-muted-foreground/60 uppercase text-center">Person</span>
        <span className="text-[9px] font-mono text-muted-foreground/60 uppercase text-center">Deadline</span>
        <span className="text-[9px] font-mono text-muted-foreground/60 uppercase text-center">Prio</span>
        <span />
      </div>

      {/* Add task */}
      {canEdit && (
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border/30 bg-muted/5">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Neue Aufgabe…"
            className="h-8 flex-1 text-sm bg-transparent border-0 border-b border-dashed border-muted-foreground/20 rounded-none px-1 focus-visible:border-primary focus-visible:ring-0"
            onKeyDown={(e) => { if (e.key === "Enter" && newTitle.trim()) addTask.mutate(); }}
          />
          <div className="relative">
            <Tag className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/40 pointer-events-none" />
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Tag"
              className="h-8 w-24 text-xs bg-transparent border-0 border-b border-dashed border-muted-foreground/20 rounded-none pl-6 focus-visible:border-primary focus-visible:ring-0"
              onKeyDown={(e) => { if (e.key === "Enter" && newTitle.trim()) addTask.mutate(); }}
            />
          </div>
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border-0 shadow-none"
            variant="outline"
            onClick={() => addTask.mutate()}
            disabled={!newTitle.trim() || addTask.isPending}
          >
            <Plus className="h-3.5 w-3.5" />
            Hinzufügen
          </Button>
        </div>
      )}

      {/* Task rows */}
      <div className="min-h-[60px]">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          </div>
        ) : activeTasks.length === 0 && !showArchive ? (
          <div className="py-10 text-center">
            <ClipboardList className="h-7 w-7 mx-auto mb-2 text-muted-foreground/20" />
            <p className="text-xs text-muted-foreground/50 font-mono">Keine offenen Aufgaben</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {activeTasks.map((task) => {
              const sc = getSC(task.status);
              const pc = getPC(task.priority);
              const StatusIcon = sc.icon;
              const PrioIcon = pc.icon;
              const isOverdue = task.deadline && new Date(task.deadline) < new Date();
              const isExpanded = expandedTask === task.id;

              return (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 30, transition: { duration: 0.15 } }}
                  className={cn(
                    "border-b border-border/30 transition-colors",
                    isExpanded ? "bg-primary/[0.03]" : "hover:bg-muted/10"
                  )}
                >
                  {/* Main grid row */}
                  <div
                    className="grid grid-cols-[40px_1fr_80px_100px_130px_90px_36px] items-center gap-2 px-5 py-2.5 cursor-pointer"
                    onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                  >
                    {/* Priority icon */}
                    <div className="flex justify-center">
                      <div className={cn("h-6 w-6 rounded-md flex items-center justify-center", pc.bg)}>
                        <PrioIcon className={cn("h-3 w-3", pc.color)} />
                      </div>
                    </div>

                    {/* Title + tag */}
                    <div className="flex items-center gap-2 min-w-0">
                      {task.tag && (
                        <Badge variant="secondary" className={cn("text-[9px] font-mono px-1.5 py-0 h-4 rounded border-0 shrink-0", getTagColor(task.tag))}>
                          {task.tag}
                        </Badge>
                      )}
                      <span className="text-sm font-body truncate">{task.title}</span>
                      {task.notes && <MessageSquare className="h-3 w-3 text-primary/50 shrink-0" />}
                    </div>

                    {/* Status */}
                    <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={task.status || "not_started"}
                        onValueChange={(v) => v === "done" ? archiveTask(task.id) : updateTask(task.id, { status: v })}
                        disabled={!canEdit}
                      >
                        <SelectTrigger className={cn("h-6 w-auto gap-1 border-0 px-2 rounded-md text-[10px] font-mono shadow-none", sc.bg, sc.color)}>
                          <StatusIcon className="h-3 w-3" />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_CONFIG.map((s) => {
                            const Icon = s.icon;
                            return (
                              <SelectItem key={s.value} value={s.value}>
                                <span className={cn("flex items-center gap-2 text-xs", s.color)}>
                                  <Icon className="h-3 w-3" />{s.label}
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Person avatar */}
                    <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                      {canEdit ? (
                        <Select
                          value={task.assigned_to || "unassigned"}
                          onValueChange={(v) => updateTask(task.id, { assigned_to: v === "unassigned" ? null : v })}
                        >
                          <SelectTrigger className="h-7 w-auto border-0 px-0 shadow-none bg-transparent">
                            {task.assigned_to ? (
                              <div className="h-6 w-6 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
                                <span className="text-[9px] font-mono font-bold text-primary">{getInitials(task.assigned_to)}</span>
                              </div>
                            ) : (
                              <div className="h-6 w-6 rounded-full bg-muted/40 ring-1 ring-border flex items-center justify-center">
                                <span className="text-[9px] text-muted-foreground/40">—</span>
                              </div>
                            )}
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">— Keine —</SelectItem>
                            {team?.map((t) => (
                              <SelectItem key={t.user_id} value={t.user_id}>{t.name || t.email}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : task.assigned_to ? (
                        <div className="h-6 w-6 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 ring-1 ring-primary/20 flex items-center justify-center" title={getTeamName(task.assigned_to) || ""}>
                          <span className="text-[9px] font-mono font-bold text-primary">{getInitials(task.assigned_to)}</span>
                        </div>
                      ) : null}
                    </div>

                    {/* Deadline */}
                    <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                      {canEdit ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              className={cn(
                                "h-6 px-2.5 rounded-md text-[11px] font-mono flex items-center gap-1.5 transition-colors",
                                isOverdue
                                  ? "bg-destructive/10 text-destructive font-semibold ring-1 ring-destructive/20"
                                  : task.deadline
                                    ? "bg-muted/40 text-muted-foreground hover:bg-muted/60"
                                    : "text-muted-foreground/30 hover:text-muted-foreground/50"
                              )}
                            >
                              <CalendarIcon className="h-3 w-3" />
                              {task.deadline ? format(new Date(task.deadline), "dd. MMM", { locale: de }) : "—"}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="center">
                            <Calendar
                              mode="single"
                              selected={task.deadline ? new Date(task.deadline) : undefined}
                              onSelect={(date) => updateTask(task.id, { deadline: date ? format(date, "yyyy-MM-dd") : null })}
                              initialFocus
                              locale={de}
                              className={cn("p-3 pointer-events-auto")}
                            />
                          </PopoverContent>
                        </Popover>
                      ) : task.deadline ? (
                        <span className={cn("text-[11px] font-mono", isOverdue ? "text-destructive" : "text-muted-foreground")}>
                          {format(new Date(task.deadline), "dd. MMM", { locale: de })}
                        </span>
                      ) : null}
                    </div>

                    {/* Priority select */}
                    <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={task.priority || "normal"}
                        onValueChange={(v) => updateTask(task.id, { priority: v })}
                        disabled={!canEdit}
                      >
                        <SelectTrigger className={cn("h-6 w-auto gap-1 border-0 px-2 rounded-md text-[10px] font-mono shadow-none", pc.bg, pc.color)}>
                          <span>{pc.label}</span>
                        </SelectTrigger>
                        <SelectContent>
                          {PRIORITY_CONFIG.map((p) => {
                            const Icon = p.icon;
                            return (
                              <SelectItem key={p.value} value={p.value}>
                                <span className={cn("flex items-center gap-2 text-xs", p.color)}>
                                  <Icon className="h-3 w-3" />{p.label}
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Expand chevron */}
                    <div className="flex justify-center">
                      <ChevronRight className={cn(
                        "h-3.5 w-3.5 text-muted-foreground/30 transition-transform duration-200",
                        isExpanded && "rotate-90 text-primary/50"
                      )} />
                    </div>
                  </div>

                  {/* Expanded notes */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-4 pt-1 ml-[40px]">
                          <Textarea
                            value={task.notes || ""}
                            placeholder="Notizen, Links, Kontext hinzufügen…"
                            className="min-h-[56px] text-xs font-body bg-background/50 border-border/50 resize-none rounded-lg focus-visible:ring-primary/30"
                            onChange={(e) => updateTask(task.id, { notes: e.target.value })}
                            disabled={!canEdit}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Archive */}
      <AnimatePresence>
        {showArchive && archivedTasks.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/50">
              <div className="flex items-center gap-2 px-5 py-3 bg-muted/10">
                <Archive className="h-3.5 w-3.5 text-muted-foreground/50" />
                <span className="text-[10px] font-mono font-semibold text-muted-foreground/50 uppercase tracking-widest">
                  Archiv · {archivedTasks.length}
                </span>
              </div>
              {archivedTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-3 px-5 py-2 border-b border-border/20 opacity-40 hover:opacity-60 transition-opacity">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  {task.tag && (
                    <Badge variant="secondary" className="text-[9px] font-mono px-1.5 py-0 h-4 rounded border-0 shrink-0 opacity-60">
                      {task.tag}
                    </Badge>
                  )}
                  <span className="flex-1 text-sm font-body line-through text-muted-foreground truncate">{task.title}</span>
                  {canEdit && (
                    <>
                      <Button size="sm" variant="ghost" className="h-6 gap-1 text-[10px] text-muted-foreground hover:text-foreground" onClick={() => restoreTask(task.id)}>
                        <Undo2 className="h-3 w-3" /> Zurück
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => deleteTask(task.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default TaskList;
