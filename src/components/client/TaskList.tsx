import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Plus, CalendarIcon, Trash2, ClipboardList, Filter, Tag, MessageSquare, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

interface Task {
  id: string;
  client_id: string;
  title: string;
  tag: string | null;
  assigned_to: string | null;
  deadline: string | null;
  is_completed: boolean;
  notes: string | null;
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

const getTagColor = (tag: string) => {
  const key = tag.toLowerCase();
  return TAG_COLORS[key] || "bg-primary/10 text-primary";
};

const TaskList: React.FC<TaskListProps> = ({ clientId, canEdit }) => {
  const qc = useQueryClient();
  const [newTitle, setNewTitle] = useState("");
  const [newTag, setNewTag] = useState("");
  const [filterPerson, setFilterPerson] = useState("all");
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

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

  const sortedTasks = useMemo(() => {
    let filtered = tasks;
    if (filterPerson !== "all") {
      filtered = filtered.filter((t) => t.assigned_to === filterPerson);
    }
    const open = filtered.filter((t) => !t.is_completed).sort((a, b) => {
      if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return 0;
    });
    const done = filtered.filter((t) => t.is_completed);
    return [...open, ...done];
  }, [tasks, filterPerson]);

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

  const updateTask = async (taskId: string, updates: Record<string, any>) => {
    await supabase.from("tasks" as any).update(updates as any).eq("id", taskId);
    qc.invalidateQueries({ queryKey: ["tasks", clientId] });
  };

  const deleteTask = async (taskId: string) => {
    await supabase.from("tasks" as any).delete().eq("id", taskId);
    qc.invalidateQueries({ queryKey: ["tasks", clientId] });
    toast("Aufgabe gelöscht");
  };

  const getTeamName = (userId: string | null) => {
    if (!userId) return null;
    const member = team?.find((t) => t.user_id === userId);
    return member?.name || member?.email || null;
  };

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
          {tasks.filter((t) => !t.is_completed).length} offen
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

      {/* Task list */}
      <div className="space-y-1.5 min-h-[80px]">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          </div>
        ) : sortedTasks.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <ClipboardList className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
            Keine Aufgaben vorhanden
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {sortedTasks.map((task) => (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20, transition: { duration: 0.15 } }}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 transition-all",
                  task.is_completed
                    ? "border-border/50 bg-muted/20 opacity-60"
                    : "border-border hover:border-primary/20 hover:bg-card/80"
                )}
              >
                <Checkbox
                  checked={task.is_completed}
                  onCheckedChange={(checked) =>
                    updateTask(task.id, { is_completed: !!checked })
                  }
                  disabled={!canEdit}
                />

                {/* Tag badge */}
                {task.tag && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-[10px] font-mono px-2 py-0.5 rounded-md border-0 shrink-0",
                      getTagColor(task.tag),
                      task.is_completed && "opacity-50"
                    )}
                  >
                    {task.tag}
                  </Badge>
                )}

                {/* Title */}
                <span
                  className={cn(
                    "flex-1 text-sm font-body",
                    task.is_completed && "line-through text-muted-foreground"
                  )}
                >
                  {task.title}
                </span>

                {/* Assigned */}
                {!task.is_completed && canEdit ? (
                  <Select
                    value={task.assigned_to || "unassigned"}
                    onValueChange={(v) =>
                      updateTask(task.id, {
                        assigned_to: v === "unassigned" ? null : v,
                      })
                    }
                  >
                    <SelectTrigger className="h-7 w-32 text-xs font-mono border-0 bg-muted/60 px-2.5 rounded-md">
                      <SelectValue placeholder="Zuweisen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">— Keine —</SelectItem>
                      {team?.map((t) => (
                        <SelectItem key={t.user_id} value={t.user_id}>
                          {t.name || t.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : task.assigned_to && !task.is_completed ? (
                  <span className="text-xs font-mono text-muted-foreground">
                    {getTeamName(task.assigned_to)}
                  </span>
                ) : null}

                {/* Deadline */}
                {!task.is_completed && canEdit ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        className={cn(
                          "h-7 px-2.5 text-xs font-mono gap-1.5 rounded-md",
                          !task.deadline && "text-muted-foreground/50",
                          task.deadline &&
                            new Date(task.deadline) < new Date() &&
                            "text-destructive bg-destructive/10"
                        )}
                      >
                        <CalendarIcon className="h-3 w-3" />
                        {task.deadline
                          ? format(new Date(task.deadline), "dd.MM.", { locale: de })
                          : "Deadline"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        mode="single"
                        selected={task.deadline ? new Date(task.deadline) : undefined}
                        onSelect={(date) =>
                          updateTask(task.id, {
                            deadline: date ? format(date, "yyyy-MM-dd") : null,
                          })
                        }
                        initialFocus
                        locale={de}
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                ) : task.deadline && !task.is_completed ? (
                  <span
                    className={cn(
                      "text-xs font-mono",
                      new Date(task.deadline) < new Date()
                        ? "text-destructive"
                        : "text-muted-foreground"
                    )}
                  >
                    {format(new Date(task.deadline), "dd.MM.", { locale: de })}
                  </span>
                ) : null}

                {/* Delete (only completed tasks) */}
                {task.is_completed && canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteTask(task.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
};

export default TaskList;
