import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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
  content_piece_id: string | null;
}

interface LinkedPiece {
  id: string;
  preview_link: string | null;
  video_path: string | null;
}

interface TaskGroup {
  key: string;
  label: string;
  tasks: Task[];
  deadline: string | null;
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
  veröffentlichen: "📤 Veröffentlichen",
  schnitt: "✂️ Schnitt",
  skript: "📝 Skript",
};

const TITLE_PATTERNS: { regex: RegExp; label: string; key: string }[] = [
  { regex: /veröffentlichen$/i, label: "📤 Veröffentlichen", key: "action:publish" },
  { regex: /schneiden$/i, label: "✂️ Schneiden", key: "action:schneiden" },
];

const MIN_GROUP_SIZE = 2;

const getGroupSignature = (task: Task) => {
  const normalizedTag = task.tag?.trim().toLowerCase();
  if (normalizedTag && TAG_LABELS[normalizedTag]) {
    return {
      key: `tag:${normalizedTag}`,
      label: TAG_LABELS[normalizedTag],
    };
  }

  // Match by title pattern (e.g. all tasks ending in "posten")
  const title = task.title.trim();
  for (const pattern of TITLE_PATTERNS) {
    if (pattern.regex.test(title)) {
      return { key: pattern.key, label: pattern.label };
    }
  }

  // Fall back to exact tag or title
  if (normalizedTag) {
    return { key: `tag:${normalizedTag}`, label: task.tag || "Gruppe" };
  }

  return { key: `title:${title.toLowerCase()}`, label: title };
};

const TaskList: React.FC<TaskListProps> = ({ clientId, canEdit }) => {
  const qc = useQueryClient();
  const navigate = useNavigate();
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

  const { groups, ungrouped } = useMemo(() => {
    const buckets: Record<string, { label: string; tasks: Task[] }> = {};

    activeTasks.forEach((task) => {
      const { key, label } = getGroupSignature(task);
      if (!buckets[key]) {
        buckets[key] = { label, tasks: [] };
      }
      buckets[key].tasks.push(task);
    });

    const groupedKeys = new Set<string>();
    const groupedResults: TaskGroup[] = [];

    Object.entries(buckets).forEach(([key, bucket]) => {
      if (bucket.tasks.length >= MIN_GROUP_SIZE) {
        groupedKeys.add(key);
        const earliestDeadline = bucket.tasks.reduce<string | null>((earliest, task) => {
          if (!task.deadline) return earliest;
          if (!earliest) return task.deadline;
          return task.deadline < earliest ? task.deadline : earliest;
        }, null);

        groupedResults.push({
          key,
          label: bucket.label,
          tasks: bucket.tasks,
          deadline: earliestDeadline,
        });
      }
    });

    const ungroupedTasks = activeTasks.filter((task) => !groupedKeys.has(getGroupSignature(task).key));
    return { groups: groupedResults, ungrouped: ungroupedTasks };
  }, [activeTasks]);

  const archivedTasks = useMemo(() => tasks.filter((t) => t.is_completed), [tasks]);

  const addTask = useMutation({
    mutationFn: async () => {
      if (!newTitle.trim()) return;
      const { error } = await supabase.from("tasks" as any).insert({ client_id: clientId, title: newTitle.trim() } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      setNewTitle("");
      qc.invalidateQueries({ queryKey: ["tasks", clientId] });
      toast.success("Aufgabe erstellt");
    },
  });

  const notifyTaskAssignment = useCallback(async (assignedTo: string, taskTitle: string, tag?: string | null, taskCount?: number) => {
    try {
      const { data: client } = await supabase.from("clients").select("name").eq("id", clientId).single();
      await supabase.functions.invoke("notify-task-assignment", {
        body: {
          assigned_to: assignedTo,
          task_title: taskTitle,
          task_count: taskCount || 1,
          client_name: client?.name || null,
          tag: tag || null,
        },
      });
    } catch (e) {
      console.error("Slack task notification failed:", e);
    }
  }, [clientId]);

  const updateTask = useCallback(async (taskId: string, updates: Record<string, any>, task?: Task) => {
    const isNewAssignment = updates.assigned_to && updates.assigned_to !== "unassigned" && task && updates.assigned_to !== task.assigned_to;

    await supabase.from("tasks" as any).update(updates as any).eq("id", taskId);
    qc.invalidateQueries({ queryKey: ["tasks", clientId] });
    qc.invalidateQueries({ queryKey: ["my-tasks"] });

    if (isNewAssignment && task) {
      notifyTaskAssignment(updates.assigned_to, task.title, task.tag);
    }
  }, [qc, clientId, notifyTaskAssignment]);

  const setGroupDeadline = useCallback(async (group: TaskGroup, date: Date | undefined) => {
    const deadline = date ? format(date, "yyyy-MM-dd") : null;
    await Promise.all(group.tasks.map((task) =>
      supabase.from("tasks" as any).update({ deadline } as any).eq("id", task.id)
    ));
    qc.invalidateQueries({ queryKey: ["tasks", clientId] });
    toast.success(deadline ? `Deadline für ${group.tasks.length} Aufgaben gesetzt` : "Deadline entfernt");
  }, [qc, clientId]);

  const completeTask = useCallback(async (taskId: string) => {
    setCompletingIds((prev) => new Set(prev).add(taskId));
    setTimeout(async () => {
      await updateTask(taskId, { is_completed: true, status: "done" });
      setCompletingIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
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
    setLocalNotes((prev) => ({ ...prev, [taskId]: value }));
    if (notesTimerRef.current[taskId]) clearTimeout(notesTimerRef.current[taskId]);
    notesTimerRef.current[taskId] = setTimeout(() => saveNotesQuietly(taskId, value), 600);
  }, [saveNotesQuietly]);

  const getInitials = (userId: string | null) => {
    if (!userId) return "";
    const member = team?.find((t) => t.user_id === userId);
    const name = member?.name || member?.email || "?";
    return name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
  };

  const getTeamName = (userId: string | null) => {
    if (!userId) return null;
    const member = team?.find((t) => t.user_id === userId);
    return member?.name || member?.email || null;
  };

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  const openTaskDestination = (task: Task, isExpanded: boolean) => {
    if (task.content_piece_id) {
      navigate(`/client/${task.client_id}?piece=${task.content_piece_id}`);
      return;
    }
    setExpandedTask(isExpanded ? null : task.id);
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
            "flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors",
            task.content_piece_id ? "cursor-pointer hover:bg-muted/20" : "cursor-pointer",
            isExpanded ? "bg-muted/40" : "hover:bg-muted/20"
          )}
          onClick={() => openTaskDestination(task, isExpanded)}
        >
          {canEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                completeTask(task.id);
              }}
              className={cn(
                "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] transition-all",
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

          <div className={cn("h-1.5 w-1.5 shrink-0 rounded-full", priorityDot)} />

          <span className={cn("flex-1 truncate text-sm font-body", isCompleting && "text-muted-foreground line-through")}>
            {task.title}
          </span>

          {task.deadline && (
            <span className={cn("shrink-0 text-[10px] font-mono", isOverdue ? "font-semibold text-destructive" : "text-muted-foreground/50")}>
              {format(new Date(task.deadline), "dd. MMM", { locale: de })}
            </span>
          )}

          {task.assigned_to && (
            <div
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-secondary/80"
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
              <div className="ml-7 space-y-2 px-2 pb-2 pt-1">
                <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Select value={task.assigned_to || "unassigned"} onValueChange={(value) => updateTask(task.id, { assigned_to: value === "unassigned" ? null : value }, task)} disabled={!canEdit}>
                    <SelectTrigger className="h-7 min-w-[100px] w-auto rounded-md border-border/40 bg-background/50 text-[11px]">
                      <SelectValue placeholder="Zuweisen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">— Keine —</SelectItem>
                      {team?.map((member) => (
                        <SelectItem key={member.user_id} value={member.user_id}>{member.name || member.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={task.priority || "normal"} onValueChange={(value) => updateTask(task.id, { priority: value })} disabled={!canEdit}>
                    <SelectTrigger className="h-7 min-w-[80px] w-auto rounded-md border-border/40 bg-background/50 text-[11px]">
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
                    onSelect={(date) => updateTask(task.id, { deadline: date ? format(date, "yyyy-MM-dd") : null })}
                    disabled={!canEdit}
                  >
                    <button className={cn(
                      "flex h-7 items-center gap-1 rounded-md border border-border/40 bg-background/50 px-2 py-1 text-[11px] font-mono transition-colors",
                      isOverdue ? "text-destructive" : task.deadline ? "text-foreground/70" : "text-muted-foreground/40"
                    )}>
                      <CalendarIcon className="h-3 w-3" />
                      {task.deadline ? format(new Date(task.deadline), "dd MMM", { locale: de }) : "Deadline"}
                    </button>
                  </MobileDatePicker>

                  <div className="flex-1" />

                  {canEdit && (
                    <button
                      className="p-1 text-muted-foreground/30 transition-colors hover:text-destructive"
                      onClick={() => deleteTask(task.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>

                <Textarea
                  value={localNotes[task.id] ?? task.notes ?? ""}
                  placeholder="Notizen..."
                  className="min-h-[40px] resize-none rounded-md border-border/30 bg-background/30 text-xs"
                  onChange={(e) => handleNotesChange(task.id, e.target.value)}
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
      <div className="mb-2 flex items-center gap-2 px-1">
        <h3 className="font-display text-sm font-semibold text-foreground">Aufgaben</h3>
        {totalActive > 0 && (
          <span className="rounded-md bg-muted/40 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground/60">
            {totalActive}
          </span>
        )}
        <div className="flex-1" />
        {archivedTasks.length > 0 && (
          <button
            className={cn(
              "flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-mono transition-colors",
              showArchive ? "bg-primary/10 text-primary" : "text-muted-foreground/40 hover:text-muted-foreground"
            )}
            onClick={() => setShowArchive(!showArchive)}
          >
            <Archive className="h-3 w-3" />
            {archivedTasks.length}
          </button>
        )}
      </div>

      {canEdit && (
        <div className="flex items-center gap-2 px-1">
          <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border border-dashed border-muted-foreground/20">
            <Plus className="h-2.5 w-2.5 text-muted-foreground/30" />
          </div>
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Neue Aufgabe..."
            className="h-8 flex-1 border-0 bg-transparent px-0 text-sm shadow-none placeholder:text-muted-foreground/30 focus-visible:ring-0"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newTitle.trim()) addTask.mutate();
            }}
          />
          {newTitle.trim() && (
            <Button size="sm" className="h-7 px-3 text-xs" onClick={() => addTask.mutate()} disabled={addTask.isPending}>
              Hinzufügen
            </Button>
          )}
        </div>
      )}

      <div className="space-y-0.5">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
          </div>
        ) : totalActive === 0 && !showArchive ? (
          <div className="py-6 text-center font-mono text-xs text-muted-foreground/30">Alles erledigt 🎉</div>
        ) : (
          <>
            {groups.map((group) => {
              const isCollapsed = collapsedGroups.has(group.key);
              const doneCount = group.tasks.filter((task) => completingIds.has(task.id)).length;
              const isGroupOverdue = group.deadline && group.deadline < todayStr;

              return (
                <div key={group.key} className="mb-1">
                  <div
                    className="flex cursor-pointer items-center gap-2 rounded-lg bg-muted/30 px-2 py-1.5 transition-colors hover:bg-muted/50"
                    onClick={() => toggleGroup(group.key)}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                    )}
                    <span className="flex-1 truncate text-xs font-semibold text-foreground/80">{group.label}</span>
                    <span className="text-[10px] font-mono text-muted-foreground/50">
                      {group.tasks.length - doneCount} offen
                    </span>

                    <div onClick={(e) => e.stopPropagation()}>
                      <MobileDatePicker
                        selected={group.deadline ? new Date(group.deadline) : undefined}
                        onSelect={(date) => setGroupDeadline(group, date)}
                        disabled={!canEdit}
                      >
                        <button className={cn(
                          "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono transition-colors",
                          isGroupOverdue ? "font-semibold text-destructive" : group.deadline ? "text-muted-foreground/60" : "text-muted-foreground/30 hover:text-muted-foreground/50"
                        )}>
                          <CalendarIcon className="h-2.5 w-2.5" />
                          {group.deadline ? format(new Date(group.deadline), "dd. MMM", { locale: de }) : "Deadline"}
                        </button>
                      </MobileDatePicker>
                    </div>
                  </div>

                  <AnimatePresence>
                    {!isCollapsed && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden border-l border-border/20 pl-1 ml-2"
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

            <AnimatePresence mode="popLayout">
              {ungrouped.map(renderTaskRow)}
            </AnimatePresence>
          </>
        )}
      </div>

      <AnimatePresence>
        {showArchive && archivedTasks.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-0.5 border-t border-border/30 pt-2">
              <span className="px-2 text-[9px] font-mono uppercase tracking-wider text-muted-foreground/30">Erledigt</span>
              {archivedTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 opacity-35 transition-opacity hover:opacity-60">
                  <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] bg-[hsl(var(--runway-green))]/20">
                    <Check className="h-2.5 w-2.5 text-[hsl(var(--runway-green))]" strokeWidth={3} />
                  </div>
                  <span className="flex-1 truncate text-sm font-body text-muted-foreground line-through">{task.title}</span>
                  {canEdit && (
                    <>
                      <button className="p-1 text-muted-foreground hover:text-foreground" onClick={() => restoreTask(task.id)}>
                        <Undo2 className="h-3 w-3" />
                      </button>
                      <button className="p-1 text-muted-foreground hover:text-destructive" onClick={() => deleteTask(task.id)}>
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
