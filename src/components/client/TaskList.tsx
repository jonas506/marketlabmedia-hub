import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Plus, CalendarIcon, Trash2, ClipboardList, Filter, Tag,
  MessageSquare, Archive, ChevronDown, AlertTriangle, Circle,
  Clock, MessageCircle, CheckCircle2,
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
  { value: "not_started", label: "Nicht begonnen", icon: Circle, color: "text-muted-foreground", bg: "bg-muted/60" },
  { value: "in_progress", label: "Begonnen", icon: Clock, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" },
  { value: "review", label: "Zu besprechen", icon: MessageCircle, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
  { value: "done", label: "Fertig", icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
];

const PRIORITY_CONFIG = [
  { value: "low", label: "Niedrig", color: "text-muted-foreground" },
  { value: "normal", label: "Normal", color: "text-foreground" },
  { value: "high", label: "Hoch", color: "text-orange-600 dark:text-orange-400" },
  { value: "urgent", label: "Dringend", color: "text-destructive" },
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
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["cutter", "head_of_content", "admin"]);
      if (!roles?.length) return [];
      const userIds = roles.map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name, email")
        .in("user_id", userIds);
      return profiles ?? [];
    },
  });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks" as any)
        .select("*")
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
        client_id: clientId,
        title: newTitle.trim(),
        tag: newTag.trim() || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      setNewTitle("");
      setNewTag("");
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
    const member = team?.find((t) => t.user_id === userId);
    return member?.name || member?.email || null;
  };

  const getStatusConfig = (status: string | null) =>
    STATUS_CONFIG.find((s) => s.value === (status || "not_started")) || STATUS_CONFIG[0];

  const getPriorityConfig = (priority: string | null) =>
    PRIORITY_CONFIG.find((p) => p.value === (priority || "normal")) || PRIORITY_CONFIG[1];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card p-5 shadow-lg"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10">
          <ClipboardList className="h-4 w-4 text-primary" />
        </div>
        <h3 className="font-display text-lg font-semibold tracking-tight">Aufgaben</h3>
        <span className="font-mono text-xs text-muted-foreground">
          {activeTasks.length} offen
        </span>
        <div className="flex-1" />

        {/* Person filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={filterPerson} onValueChange={setFilterPerson}>
            <SelectTrigger className="h-8 w-36 text-xs border-border bg-muted/30">
              <SelectValue placeholder="Alle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              {team?.map((t) => (
                <SelectItem key={t.user_id} value={t.user_id}>
                  {t.name || t.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Archive toggle */}
        {archivedTasks.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-8 gap-1.5 text-xs font-mono", showArchive && "text-primary")}
            onClick={() => setShowArchive(!showArchive)}
          >
            <Archive className="h-3.5 w-3.5" />
            Archiv ({archivedTasks.length})
          </Button>
        )}
      </div>

      {/* Add task */}
      {canEdit && (
        <div className="flex items-center gap-2 mb-4">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Neue Aufgabe…"
            className="h-9 flex-1 text-sm bg-muted/30 border-border"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newTitle.trim()) addTask.mutate();
            }}
          />
          <div className="relative">
            <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Tag…"
              className="h-9 w-28 text-xs bg-muted/30 border-border pl-7"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTitle.trim()) addTask.mutate();
              }}
            />
          </div>
          <Button
            size="sm"
            className="h-9 gap-1.5 text-sm"
            onClick={() => addTask.mutate()}
            disabled={!newTitle.trim() || addTask.isPending}
          >
            <Plus className="h-4 w-4" />
            Aufgabe
          </Button>
        </div>
      )}

      {/* Active tasks */}
      <div className="space-y-1.5 min-h-[80px]">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          </div>
        ) : activeTasks.length === 0 && !showArchive ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <ClipboardList className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
            Keine offenen Aufgaben
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {activeTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                canEdit={canEdit}
                expanded={expandedTask === task.id}
                onToggleExpand={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                onUpdate={updateTask}
                onArchive={archiveTask}
                team={team ?? []}
                getTeamName={getTeamName}
                getStatusConfig={getStatusConfig}
                getPriorityConfig={getPriorityConfig}
              />
            ))}
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
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2 mb-3">
                <Archive className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">
                  Archiv
                </span>
              </div>
              <div className="space-y-1">
                {archivedTasks.map((task) => (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/10 p-2.5 opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    {task.tag && (
                      <Badge variant="secondary" className="text-[10px] font-mono px-2 py-0.5 rounded-md border-0 shrink-0 opacity-60">
                        {task.tag}
                      </Badge>
                    )}
                    <span className="flex-1 text-sm font-body line-through text-muted-foreground">
                      {task.title}
                    </span>
                    {canEdit && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => restoreTask(task.id)}
                        >
                          Wiederherstellen
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteTask(task.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// --- Task Row Component ---
interface TaskRowProps {
  task: Task;
  canEdit: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (id: string, updates: Record<string, any>) => void;
  onArchive: (id: string) => void;
  team: { user_id: string; name: string | null; email: string | null }[];
  getTeamName: (userId: string | null) => string | null;
  getStatusConfig: (status: string | null) => typeof STATUS_CONFIG[number];
  getPriorityConfig: (priority: string | null) => typeof PRIORITY_CONFIG[number];
}

const TaskRow: React.FC<TaskRowProps> = ({
  task, canEdit, expanded, onToggleExpand, onUpdate, onArchive, team,
  getTeamName, getStatusConfig, getPriorityConfig,
}) => {
  const statusCfg = getStatusConfig(task.status);
  const priorityCfg = getPriorityConfig(task.priority);
  const StatusIcon = statusCfg.icon;
  const isOverdue = task.deadline && new Date(task.deadline) < new Date();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20, transition: { duration: 0.15 } }}
      className={cn(
        "rounded-lg border transition-all",
        expanded ? "border-primary/30 bg-primary/[0.02]" : "border-border hover:border-primary/20"
      )}
    >
      {/* Main row */}
      <div className="flex items-center gap-2.5 p-3">
        {/* Status selector */}
        <Select
          value={task.status || "not_started"}
          onValueChange={(v) => {
            if (v === "done") {
              onArchive(task.id);
            } else {
              onUpdate(task.id, { status: v });
            }
          }}
          disabled={!canEdit}
        >
          <SelectTrigger className={cn("h-7 w-7 p-0 border-0 justify-center shrink-0", statusCfg.bg)}>
            <StatusIcon className={cn("h-4 w-4", statusCfg.color)} />
          </SelectTrigger>
          <SelectContent>
            {STATUS_CONFIG.map((s) => {
              const Icon = s.icon;
              return (
                <SelectItem key={s.value} value={s.value}>
                  <span className="flex items-center gap-2">
                    <Icon className={cn("h-3.5 w-3.5", s.color)} />
                    <span className={s.color}>{s.label}</span>
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {/* Priority indicator */}
        {(task.priority === "high" || task.priority === "urgent") && (
          <AlertTriangle className={cn("h-3.5 w-3.5 shrink-0", priorityCfg.color)} />
        )}

        {/* Tag */}
        {task.tag && (
          <Badge
            variant="secondary"
            className={cn("text-[10px] font-mono px-2 py-0.5 rounded-md border-0 shrink-0", getTagColor(task.tag))}
          >
            {task.tag}
          </Badge>
        )}

        {/* Title */}
        <span
          className="flex-1 text-sm font-body cursor-pointer hover:text-primary/80 transition-colors"
          onClick={onToggleExpand}
        >
          {task.title}
        </span>

        {/* Notes indicator */}
        <button
          className={cn(
            "shrink-0 p-1 rounded",
            task.notes ? "text-primary" : "text-muted-foreground/30 hover:text-muted-foreground"
          )}
          onClick={onToggleExpand}
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </button>

        {/* Assigned */}
        {canEdit ? (
          <Select
            value={task.assigned_to || "unassigned"}
            onValueChange={(v) => onUpdate(task.id, { assigned_to: v === "unassigned" ? null : v })}
          >
            <SelectTrigger className="h-7 w-32 text-xs font-mono border-0 bg-muted/60 px-2.5 rounded-md">
              <SelectValue placeholder="Zuweisen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">— Keine —</SelectItem>
              {team.map((t) => (
                <SelectItem key={t.user_id} value={t.user_id}>{t.name || t.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : task.assigned_to ? (
          <span className="text-xs font-mono text-muted-foreground">{getTeamName(task.assigned_to)}</span>
        ) : null}

        {/* Deadline */}
        {canEdit ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "h-7 px-2.5 text-xs font-mono gap-1.5 rounded-md",
                  !task.deadline && "text-muted-foreground/50",
                  isOverdue && "text-destructive bg-destructive/10"
                )}
              >
                <CalendarIcon className="h-3 w-3" />
                {task.deadline ? format(new Date(task.deadline), "dd.MM.", { locale: de }) : "Deadline"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={task.deadline ? new Date(task.deadline) : undefined}
                onSelect={(date) => onUpdate(task.id, { deadline: date ? format(date, "yyyy-MM-dd") : null })}
                initialFocus
                locale={de}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        ) : task.deadline ? (
          <span className={cn("text-xs font-mono", isOverdue ? "text-destructive" : "text-muted-foreground")}>
            {format(new Date(task.deadline), "dd.MM.", { locale: de })}
          </span>
        ) : null}
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-0 space-y-3">
              {/* Priority + Status selects */}
              <div className="flex items-center gap-3 pl-9">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">Priorität</span>
                  <Select
                    value={task.priority || "normal"}
                    onValueChange={(v) => onUpdate(task.id, { priority: v })}
                    disabled={!canEdit}
                  >
                    <SelectTrigger className={cn("h-7 w-28 text-xs font-mono border-0 px-2.5 rounded-md bg-muted/60", priorityCfg.color)}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_CONFIG.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          <span className={p.color}>{p.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">Status</span>
                  <Select
                    value={task.status || "not_started"}
                    onValueChange={(v) => {
                      if (v === "done") onArchive(task.id);
                      else onUpdate(task.id, { status: v });
                    }}
                    disabled={!canEdit}
                  >
                    <SelectTrigger className={cn("h-7 w-36 text-xs font-mono border-0 px-2.5 rounded-md", statusCfg.bg, statusCfg.color)}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_CONFIG.map((s) => {
                        const Icon = s.icon;
                        return (
                          <SelectItem key={s.value} value={s.value}>
                            <span className={cn("flex items-center gap-2", s.color)}>
                              <Icon className="h-3.5 w-3.5" />
                              {s.label}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Notes */}
              <div className="pl-9">
                <Textarea
                  value={task.notes || ""}
                  placeholder="Notizen, Links, Kontext…"
                  className="min-h-[60px] text-xs font-body bg-muted/30 border-border resize-none"
                  onChange={(e) => onUpdate(task.id, { notes: e.target.value })}
                  disabled={!canEdit}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default TaskList;
