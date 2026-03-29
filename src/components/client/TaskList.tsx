import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, CalendarIcon, Trash2, Archive, Undo2,
  ChevronDown, ChevronRight, Check,
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import MobileDatePicker from "@/components/MobileDatePicker";

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

interface TaskGroup {
  tag: string;
  tasks: Task[];
  deadline: string | null; // earliest deadline in group
}

interface TaskListProps {
  clientId: string;
  canEdit: boolean;
}

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-destructive",
  high: "bg-[hsl(var(--runway-yellow))]",
  normal: "bg-primary/40",
  low: "bg-muted-foreground/20",
};

const PRIORITY_WEIGHT: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

const TAG_LABELS: Record<string, string> = {
  reel: "🎬 Reels",
  carousel: "🖼️ Karussells",
  ad: "📢 Ads",
  youtube_longform: "🎥 YouTube",
};

const MIN_GROUP_SIZE = 3;

const TaskList: React.FC<TaskListProps> = ({ clientId, canEdit }) => {
  const qc = useQueryClient();
  const [newTitle, setNewTitle] = useState("");
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [showArchive, setShowArchive] = useState(false);
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const notesTimerRef = useRef<Record<string, NodeJS.Timeout>>({});

  const { data: team } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id, role").in("role", ["cutter", "head_of_content", "admin"]);
      if (!roles?.length) return [];
      const { data: profiles } = await supabase.from("profiles").select("user_id, name, email").in("user_id", roles.map((r) => r.user_id));
      return profiles ?? [];
    },
  });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks" as any).select("*").eq("client_id", clientId).is("parent_id", null).order("created_at", { ascending: true });
      if (error) throw error;
      return (data as any[]) as Task[];
    },
  });

  const activeTasks = useMemo(() => {
    return tasks.filter((t) => !t.is_completed).sort((a, b) => {
      const pa = PRIORITY_WEIGHT[a.priority || "normal"] ?? 2;
      const pb = PRIORITY_WEIGHT[b.priority || "normal"] ?? 2;
      if (pa !== pb) return pa - pb;
      if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return 0;
    });
  }, [tasks]);

  // Group tasks by tag if ≥ MIN_GROUP_SIZE with same tag
  const { groups, ungrouped } = useMemo(() => {
    const tagCounts: Record<string, Task[]> = {};
    activeTasks.forEach(t => {
      if (t.tag) {
        if (!tagCounts[t.tag]) tagCounts[t.tag] = [];
        tagCounts[t.tag].push(t);
      }
    });

    const groupedTags = new Set<string>();
    const groups: TaskGroup[] = [];
    Object.entries(tagCounts).forEach(([tag, tasks]) => {
      if (tasks.length >= MIN_GROUP_SIZE) {
        groupedTags.add(tag);
        const earliestDeadline = tasks.reduce<string | null>((earliest, t) => {
          if (!t.deadline) return earliest;
          if (!earliest) return t.deadline;
          return t.deadline < earliest ? t.deadline : earliest;
        }, null);
        groups.push({ tag, tasks, deadline: earliestDeadline });
      }
    });

    const ungrouped = activeTasks.filter(t => !t.tag || !groupedTags.has(t.tag));
    return { groups, ungrouped };
  }, [activeTasks]);

  const archivedTasks = useMemo(() => tasks.filter((t) => t.is_completed), [tasks]);

  const addTask = useMutation({
    mutationFn: async () => {
      if (!newTitle.trim()) return;
      const { error } = await supabase.from("tasks" as any).insert({ client_id: clientId, title: newTitle.trim() } as any);
      if (error) throw error;
    },
    onSuccess: () => { setNewTitle(""); qc.invalidateQueries({ queryKey: ["tasks", clientId] }); toast.success("Aufgabe erstellt"); },
  });

  const updateTask = useCallback(async (taskId: string, updates: Record<string, any>) => {
    await supabase.from("tasks" as any).update(updates as any).eq("id", taskId);
    qc.invalidateQueries({ queryKey: ["tasks", clientId] });
    qc.invalidateQueries({ queryKey: ["my-tasks"] });
  }, [qc, clientId]);

  const setGroupDeadline = useCallback(async (group: TaskGroup, date: Date | undefined) => {
    const deadline = date ? format(date, "yyyy-MM-dd") : null;
    await Promise.all(group.tasks.map(t =>
      supabase.from("tasks" as any).update({ deadline } as any).eq("id", t.id)
    ));
    qc.invalidateQueries({ queryKey: ["tasks", clientId] });
    toast.success(deadline ? `Deadline für ${group.tasks.length} Aufgaben gesetzt` : "Deadline entfernt");
  }, [qc, clientId]);

  const completeTask = useCallback(async (taskId: string) => {
    setCompletingIds(prev => new Set(prev).add(taskId));
    setTimeout(async () => {
      await updateTask(taskId, { is_completed: true, status: "done" });
      setCompletingIds(prev => { const next = new Set(prev); next.delete(taskId); return next; });
      toast.success("✓ Erledigt!");
    }, 400);
  }, [updateTask]);

  const restoreTask = useCallback(async (taskId: string) => {
    await updateTask(taskId, { is_completed: false, status: "not_started" });
    toast("Wiederhergestellt");
  }, [updateTask]);

  const deleteTask = useCallback(async (taskId: string) => {
    await supabase.from("tasks" as any).delete().eq("id", taskId);
    qc.invalidateQueries({ queryKey: ["tasks", clientId] });
    toast("Gelöscht");
  }, [qc, clientId]);

  const saveNotesQuietly = useCallback(async (taskId: string, value: string) => {
    await supabase.from("tasks" as any).update({ notes: value } as any).eq("id", taskId);
  }, []);

  const handleNotesChange = useCallback((taskId: string, value: string) => {
    setLocalNotes(prev => ({ ...prev, [taskId]: value }));
    if (notesTimerRef.current[taskId]) clearTimeout(notesTimerRef.current[taskId]);
    notesTimerRef.current[taskId] = setTimeout(() => saveNotesQuietly(taskId, value), 600);
  }, [saveNotesQuietly]);

  const getInitials = (userId: string | null) => {
    if (!userId) return "";
    const m = team?.find((t) => t.user_id === userId);
    const name = m?.name || m?.email || "?";
    return name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
  };

  const getTeamName = (userId: string | null) => {
    if (!userId) return null;
    const m = team?.find((t) => t.user_id === userId);
    return m?.name || m?.email || null;
  };

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const toggleGroup = (tag: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag); else next.add(tag);
      return next;
    });
  };

  const renderTaskRow = (task: Task) => {
    const isCompleting = completingIds.has(task.id);
    const isExpanded = expandedTask === task.id;
    const isOverdue = task.deadline && task.deadline < todayStr;
    const priorityDot = PRIORITY_DOT[task.priority || "normal"] || PRIORITY_DOT.normal;

    return (
      <motion.div
        key={task.id}
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: isCompleting ? 0.4 : 1, y: 0, scale: isCompleting ? 0.98 : 1 }}
        exit={{ opacity: 0, x: -30, scale: 0.95, transition: { duration: 0.2 } }}
        className="group"
      >
        <div
          className={cn(
            "flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer transition-colors",
            isExpanded ? "bg-muted/40" : "hover:bg-muted/20"
          )}
          onClick={() => setExpandedTask(isExpanded ? null : task.id)}
        >
          {canEdit && (
            <button
              onClick={e => { e.stopPropagation(); completeTask(task.id); }}
              className={cn(
                "h-[18px] w-[18px] rounded-[5px] border-[1.5px] flex items-center justify-center shrink-0 transition-all",
                isCompleting
                  ? "border-[hsl(var(--runway-green))] bg-[hsl(var(--runway-green))]"
                  : "border-muted-foreground/25 hover:border-primary/60 hover:bg-primary/5"
              )}
            >
              {isCompleting && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 20 }}>
                  <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                </motion.div>
              )}
            </button>
          )}

          <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", priorityDot)} />

          <span className={cn(
            "text-sm font-body truncate flex-1",
            isCompleting && "line-through text-muted-foreground"
          )}>
            {task.title}
          </span>

          {task.deadline && (
            <span className={cn(
              "text-[10px] font-mono shrink-0",
              isOverdue ? "text-destructive font-semibold" : "text-muted-foreground/50"
            )}>
              {format(new Date(task.deadline), "dd. MMM", { locale: de })}
            </span>
          )}

          {task.assigned_to && (
            <div
              className="h-5 w-5 rounded-full bg-gradient-to-br from-primary/80 to-secondary/80 flex items-center justify-center shrink-0"
              title={getTeamName(task.assigned_to) || ""}
            >
              <span className="text-[7px] font-bold text-primary-foreground">{getInitials(task.assigned_to)}</span>
            </div>
          )}
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div className="px-2 pb-2 pt-1 ml-7 space-y-2">
                <div className="flex items-center gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
                  <Select value={task.assigned_to || "unassigned"} onValueChange={v => updateTask(task.id, { assigned_to: v === "unassigned" ? null : v })} disabled={!canEdit}>
                    <SelectTrigger className="h-7 text-[11px] border-border/40 bg-background/50 w-auto min-w-[100px] rounded-md">
                      <SelectValue placeholder="Zuweisen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">— Keine —</SelectItem>
                      {team?.map(t => <SelectItem key={t.user_id} value={t.user_id}>{t.name || t.email}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  <Select value={task.priority || "normal"} onValueChange={v => updateTask(task.id, { priority: v })} disabled={!canEdit}>
                    <SelectTrigger className="h-7 text-[11px] border-border/40 bg-background/50 w-auto min-w-[80px] rounded-md">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Niedrig</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">Hoch</SelectItem>
                      <SelectItem value="urgent">Dringend</SelectItem>
                    </SelectContent>
                  </Select>

                  <MobileDatePicker
                    selected={task.deadline ? new Date(task.deadline) : undefined}
                    onSelect={date => updateTask(task.id, { deadline: date ? format(date, "yyyy-MM-dd") : null })}
                    disabled={!canEdit}
                  >
                    <button className={cn(
                      "text-[11px] font-mono flex items-center gap-1 px-2 py-1 rounded-md h-7 border border-border/40 bg-background/50 transition-colors",
                      isOverdue ? "text-destructive" : task.deadline ? "text-foreground/70" : "text-muted-foreground/40"
                    )}>
                      <CalendarIcon className="h-3 w-3" />
                      {task.deadline ? format(new Date(task.deadline), "dd MMM", { locale: de }) : "Deadline"}
                    </button>
                  </MobileDatePicker>

                  <div className="flex-1" />

                  {canEdit && (
                    <button
                      className="text-muted-foreground/30 hover:text-destructive transition-colors p-1"
                      onClick={() => deleteTask(task.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>

                <Textarea
                  value={localNotes[task.id] ?? task.notes ?? ""}
                  placeholder="Notizen..."
                  className="min-h-[40px] text-xs bg-background/30 border-border/30 resize-none rounded-md"
                  onChange={e => handleNotesChange(task.id, e.target.value)}
                  disabled={!canEdit}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  const totalActive = activeTasks.length;

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="flex items-center gap-2 px-1 mb-2">
        <h3 className="font-display text-sm font-semibold text-foreground">Aufgaben</h3>
        {totalActive > 0 && (
          <span className="text-[10px] font-mono text-muted-foreground/60 bg-muted/40 px-1.5 py-0.5 rounded-md">
            {totalActive}
          </span>
        )}
        <div className="flex-1" />
        {archivedTasks.length > 0 && (
          <button
            className={cn(
              "flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded-md transition-colors",
              showArchive ? "text-primary bg-primary/10" : "text-muted-foreground/40 hover:text-muted-foreground"
            )}
            onClick={() => setShowArchive(!showArchive)}
          >
            <Archive className="h-3 w-3" />
            {archivedTasks.length}
          </button>
        )}
      </div>

      {/* Add task */}
      {canEdit && (
        <div className="flex items-center gap-2 px-1">
          <div className="h-[18px] w-[18px] rounded-[5px] border border-dashed border-muted-foreground/20 flex items-center justify-center shrink-0">
            <Plus className="h-2.5 w-2.5 text-muted-foreground/30" />
          </div>
          <Input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="Neue Aufgabe..."
            className="h-8 flex-1 text-sm bg-transparent border-0 shadow-none px-0 placeholder:text-muted-foreground/30 focus-visible:ring-0"
            onKeyDown={e => { if (e.key === "Enter" && newTitle.trim()) addTask.mutate(); }}
          />
          {newTitle.trim() && (
            <Button size="sm" className="h-7 px-3 text-xs" onClick={() => addTask.mutate()} disabled={addTask.isPending}>
              Hinzufügen
            </Button>
          )}
        </div>
      )}

      {/* Task list */}
      <div className="space-y-0.5">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
          </div>
        ) : totalActive === 0 && !showArchive ? (
          <div className="py-6 text-center text-xs text-muted-foreground/30 font-mono">Alles erledigt 🎉</div>
        ) : (
          <>
            {/* Grouped tasks */}
            {groups.map(group => {
              const isCollapsed = !collapsedGroups.has(group.tag); // collapsed by default
              const doneCount = group.tasks.filter(t => completingIds.has(t.id)).length;
              const isGroupOverdue = group.deadline && group.deadline < todayStr;

              return (
                <div key={`group-${group.tag}`} className="mb-1">
                  {/* Group header */}
                  <div
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => toggleGroup(group.tag)}
                  >
                    {isCollapsed
                      ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                      : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                    }
                    <span className="text-xs font-semibold text-foreground/80">
                      {TAG_LABELS[group.tag] || group.tag}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground/50">
                      {group.tasks.length - doneCount} offen
                    </span>

                    <div className="flex-1" />

                    {/* Group deadline */}
                    <div onClick={e => e.stopPropagation()}>
                      <MobileDatePicker
                        selected={group.deadline ? new Date(group.deadline) : undefined}
                        onSelect={date => setGroupDeadline(group, date)}
                        disabled={!canEdit}
                      >
                        <button className={cn(
                          "text-[10px] font-mono flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors",
                          isGroupOverdue ? "text-destructive font-semibold" : group.deadline ? "text-muted-foreground/60" : "text-muted-foreground/30 hover:text-muted-foreground/50"
                        )}>
                          <CalendarIcon className="h-2.5 w-2.5" />
                          {group.deadline ? format(new Date(group.deadline), "dd. MMM", { locale: de }) : "Deadline"}
                        </button>
                      </MobileDatePicker>
                    </div>
                  </div>

                  {/* Group tasks */}
                  <AnimatePresence>
                    {!isCollapsed && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden ml-2 border-l border-border/20 pl-1"
                      >
                        <AnimatePresence mode="popLayout">
                          {group.tasks.map(renderTaskRow)}
                        </AnimatePresence>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}

            {/* Ungrouped tasks */}
            <AnimatePresence mode="popLayout">
              {ungrouped.map(renderTaskRow)}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* Archive */}
      <AnimatePresence>
        {showArchive && archivedTasks.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 pt-2 border-t border-border/30 space-y-0.5">
              <span className="text-[9px] font-mono text-muted-foreground/30 uppercase tracking-wider px-2">Erledigt</span>
              {archivedTasks.map(task => (
                <div key={task.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg opacity-35 hover:opacity-60 transition-opacity">
                  <div className="h-[18px] w-[18px] rounded-[5px] bg-[hsl(var(--runway-green))]/20 flex items-center justify-center shrink-0">
                    <Check className="h-2.5 w-2.5 text-[hsl(var(--runway-green))]" strokeWidth={3} />
                  </div>
                  <span className="flex-1 text-sm font-body line-through text-muted-foreground truncate">{task.title}</span>
                  {canEdit && (
                    <>
                      <button className="text-muted-foreground hover:text-foreground p-1" onClick={() => restoreTask(task.id)}>
                        <Undo2 className="h-3 w-3" />
                      </button>
                      <button className="text-muted-foreground hover:text-destructive p-1" onClick={() => deleteTask(task.id)}>
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TaskList;
