import { useState, useMemo, useCallback, useRef } from "react";
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
  Plus, CalendarIcon, Trash2, Filter, Tag,
  Archive, Undo2, ChevronRight, ChevronDown,
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
  skripte: "bg-blue-500/15 text-blue-500",
  "bild-ads": "bg-purple-500/15 text-purple-400",
  technik: "bg-amber-500/15 text-amber-400",
  admin: "bg-slate-500/15 text-slate-400",
  feedback: "bg-emerald-500/15 text-emerald-400",
  briefing: "bg-rose-500/15 text-rose-400",
};
const getTagColor = (tag: string) => TAG_COLORS[tag.toLowerCase()] || "bg-primary/15 text-primary";

const STATUS_CONFIG = [
  { value: "not_started", label: "Nicht begonnen", cssClass: "monday-status-default" },
  { value: "in_progress", label: "Begonnen", cssClass: "monday-status-working" },
  { value: "review", label: "Zu besprechen", cssClass: "monday-status-review" },
  { value: "done", label: "Fertig", cssClass: "monday-status-done" },
];

const PRIORITY_CONFIG = [
  { value: "low", label: "Niedrig", cssClass: "bg-status-default" },
  { value: "normal", label: "Normal", cssClass: "bg-status-working" },
  { value: "high", label: "Hoch", cssClass: "bg-status-review" },
  { value: "urgent", label: "Dringend", cssClass: "bg-status-stuck" },
];

const PRIORITY_WEIGHT: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

const TaskList: React.FC<TaskListProps> = ({ clientId, canEdit }) => {
  const qc = useQueryClient();
  const [newTitle, setNewTitle] = useState("");
  const [newTag, setNewTag] = useState("");
  const [filterPerson, setFilterPerson] = useState("all");
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
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
      const { data, error } = await supabase.from("tasks" as any).select("*").eq("client_id", clientId).order("created_at", { ascending: true });
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
      const { error } = await supabase.from("tasks" as any).insert({ client_id: clientId, title: newTitle.trim(), tag: newTag.trim() || null } as any);
      if (error) throw error;
    },
    onSuccess: () => { setNewTitle(""); setNewTag(""); qc.invalidateQueries({ queryKey: ["tasks", clientId] }); toast.success("Aufgabe erstellt"); },
  });

  const updateTask = useCallback(async (taskId: string, updates: Record<string, any>) => {
    await supabase.from("tasks" as any).update(updates as any).eq("id", taskId);
    qc.invalidateQueries({ queryKey: ["tasks", clientId] });
    qc.invalidateQueries({ queryKey: ["my-tasks"] });
  }, [qc, clientId]);

  const saveNotesQuietly = useCallback(async (taskId: string, value: string) => {
    await supabase.from("tasks" as any).update({ notes: value } as any).eq("id", taskId);
  }, []);

  const handleNotesChange = useCallback((taskId: string, value: string) => {
    setLocalNotes(prev => ({ ...prev, [taskId]: value }));
    if (notesTimerRef.current[taskId]) clearTimeout(notesTimerRef.current[taskId]);
    notesTimerRef.current[taskId] = setTimeout(() => {
      saveNotesQuietly(taskId, value);
    }, 600);
  }, [saveNotesQuietly]);

  const archiveTask = useCallback(async (taskId: string) => {
    await updateTask(taskId, { is_completed: true, status: "done" });
    toast.success("✓ Archiviert");
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

  const getInitials = (userId: string | null) => {
    if (!userId) return "?";
    const m = team?.find((t) => t.user_id === userId);
    const name = m?.name || m?.email || "?";
    return name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
  };

  const getTeamName = (userId: string | null) => {
    if (!userId) return null;
    const m = team?.find((t) => t.user_id === userId);
    return m?.name || m?.email || null;
  };

  const getSC = (s: string | null) => STATUS_CONFIG.find((c) => c.value === (s || "not_started")) || STATUS_CONFIG[0];
  const getPC = (p: string | null) => PRIORITY_CONFIG.find((c) => c.value === (p || "normal")) || PRIORITY_CONFIG[1];

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Group header - Monday style with colored left accent */}
      <div className="flex items-center gap-3 px-4 py-3 bg-surface-elevated border-b border-border">
        <div className="w-1 h-5 rounded-full bg-primary" />
        <h3 className="font-display text-sm font-semibold">Aufgaben</h3>
        <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">{activeTasks.length}</span>
        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <Filter className="h-3 w-3 text-muted-foreground" />
          <Select value={filterPerson} onValueChange={setFilterPerson}>
            <SelectTrigger className="h-7 w-32 text-[11px] border-border/50 bg-background/50">
              <SelectValue placeholder="Alle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              {team?.map((t) => (<SelectItem key={t.user_id} value={t.user_id}>{t.name || t.email}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>

        {archivedTasks.length > 0 && (
          <button
            className={cn("flex items-center gap-1 text-[11px] font-mono px-2 py-1 rounded transition-colors", showArchive ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground")}
            onClick={() => setShowArchive(!showArchive)}
          >
            <Archive className="h-3 w-3" /> {archivedTasks.length}
          </button>
        )}
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_100px_100px_90px_100px] items-center gap-0 border-b border-border/50 bg-card text-[9px] font-mono text-muted-foreground/60 uppercase tracking-wider">
        <span className="px-4 py-2">Aufgabe</span>
        <span className="px-2 py-2 text-center border-l border-border/30">Person</span>
        <span className="px-2 py-2 text-center border-l border-border/30">Status</span>
        <span className="px-2 py-2 text-center border-l border-border/30">Deadline</span>
        <span className="px-2 py-2 text-center border-l border-border/30">Priorität</span>
      </div>

      {/* Add row */}
      {canEdit && (
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/30 bg-card/50">
          <Plus className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Neue Aufgabe…"
            className="h-8 flex-1 text-sm bg-background border-border/50 px-3 rounded-md"
            onKeyDown={(e) => { if (e.key === "Enter" && newTitle.trim()) addTask.mutate(); }}
          />
          <div className="relative shrink-0">
            <Tag className="absolute left-2 top-1/2 -translate-y-1/2 h-2.5 w-2.5 text-muted-foreground/40 pointer-events-none" />
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Tag"
              className="h-8 w-20 text-[11px] bg-background border-border/50 pl-6 pr-2 rounded-md"
              onKeyDown={(e) => { if (e.key === "Enter" && newTitle.trim()) addTask.mutate(); }}
            />
          </div>
          <Button
            size="sm"
            className="h-8 px-3 text-xs shrink-0"
            disabled={!newTitle.trim() || addTask.isPending}
            onClick={() => addTask.mutate()}
          >
            Hinzufügen
          </Button>
        </div>
      )}

      {/* Task rows */}
      <div className="min-h-[40px]">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          </div>
        ) : activeTasks.length === 0 && !showArchive ? (
          <div className="py-8 text-center text-xs text-muted-foreground/40 font-mono">Keine offenen Aufgaben</div>
        ) : (
          <AnimatePresence mode="popLayout">
            {activeTasks.map((task) => {
              const sc = getSC(task.status);
              const pc = getPC(task.priority);
              const isOverdue = task.deadline && new Date(task.deadline) < new Date();
              const isExpanded = expandedTask === task.id;

              return (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, x: 20, transition: { duration: 0.12 } }}
                  className="monday-row"
                >
                  <div className="grid grid-cols-[1fr_100px_100px_90px_100px] items-center gap-0">
                    {/* Title cell */}
                    <div
                      className="flex items-center gap-2.5 px-4 py-2.5 cursor-pointer group"
                      onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                    >
                      <ChevronRight className={cn("h-3 w-3 text-muted-foreground/30 transition-transform shrink-0", isExpanded && "rotate-90 text-primary")} />
                      {task.tag && (
                        <Badge variant="secondary" className={cn("text-[9px] font-mono px-1.5 py-0 h-[18px] rounded border-0 shrink-0", getTagColor(task.tag))}>
                          {task.tag}
                        </Badge>
                      )}
                      <span className="text-sm font-body truncate group-hover:text-primary transition-colors">{task.title}</span>
                    </div>

                    {/* Person cell */}
                    <div className="flex justify-center border-l border-border/30 py-2" onClick={(e) => e.stopPropagation()}>
                      {canEdit ? (
                        <Select value={task.assigned_to || "unassigned"} onValueChange={(v) => updateTask(task.id, { assigned_to: v === "unassigned" ? null : v })}>
                          <SelectTrigger className="h-auto w-auto border-0 p-0 shadow-none bg-transparent">
                            {task.assigned_to ? (
                              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center" title={getTeamName(task.assigned_to) || ""}>
                                <span className="text-[9px] font-bold text-white">{getInitials(task.assigned_to)}</span>
                              </div>
                            ) : (
                              <div className="h-7 w-7 rounded-full border border-dashed border-muted-foreground/30 flex items-center justify-center">
                                <span className="text-[9px] text-muted-foreground/30">+</span>
                              </div>
                            )}
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">— Keine —</SelectItem>
                            {team?.map((t) => (<SelectItem key={t.user_id} value={t.user_id}>{t.name || t.email}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      ) : task.assigned_to ? (
                        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center" title={getTeamName(task.assigned_to) || ""}>
                          <span className="text-[9px] font-bold text-white">{getInitials(task.assigned_to)}</span>
                        </div>
                      ) : null}
                    </div>

                    {/* Status cell - Monday pill */}
                    <div className="flex justify-center border-l border-border/30 py-2" onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={task.status || "not_started"}
                        onValueChange={(v) => v === "done" ? archiveTask(task.id) : updateTask(task.id, { status: v })}
                        disabled={!canEdit}
                      >
                        <SelectTrigger className={cn("monday-status border-0 shadow-none h-auto cursor-pointer", sc.cssClass)}>
                          <span>{sc.label}</span>
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_CONFIG.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              <span className="flex items-center gap-2">
                                <span className={cn("w-2 h-2 rounded-full", s.cssClass)} />
                                {s.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Deadline cell */}
                    <div className="flex justify-center border-l border-border/30 py-2" onClick={(e) => e.stopPropagation()}>
                      {canEdit ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className={cn(
                              "text-[11px] font-mono flex items-center gap-1 px-2 py-1 rounded transition-colors",
                              isOverdue ? "text-destructive font-semibold bg-destructive/10" : task.deadline ? "text-foreground/70 hover:bg-muted/50" : "text-muted-foreground/30 hover:text-muted-foreground"
                            )}>
                              <CalendarIcon className="h-3 w-3" />
                              {task.deadline ? format(new Date(task.deadline), "dd MMM", { locale: de }) : "—"}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="center">
                            <Calendar
                              mode="single"
                              selected={task.deadline ? new Date(task.deadline) : undefined}
                              onSelect={(date) => updateTask(task.id, { deadline: date ? format(date, "yyyy-MM-dd") : null })}
                              initialFocus locale={de}
                              className={cn("p-3 pointer-events-auto")}
                            />
                          </PopoverContent>
                        </Popover>
                      ) : task.deadline ? (
                        <span className={cn("text-[11px] font-mono", isOverdue ? "text-destructive" : "text-muted-foreground")}>
                          {format(new Date(task.deadline), "dd MMM", { locale: de })}
                        </span>
                      ) : null}
                    </div>

                    {/* Priority cell - Monday pill */}
                    <div className="flex justify-center border-l border-border/30 py-2" onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={task.priority || "normal"}
                        onValueChange={(v) => updateTask(task.id, { priority: v })}
                        disabled={!canEdit}
                      >
                        <SelectTrigger className={cn("monday-priority border-0 shadow-none h-auto cursor-pointer", pc.cssClass)}>
                          <span>{pc.label}</span>
                        </SelectTrigger>
                        <SelectContent>
                          {PRIORITY_CONFIG.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              <span className="flex items-center gap-2">
                                <span className={cn("w-2 h-2 rounded-full", p.cssClass)} />
                                {p.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Expanded notes */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-3 pt-0 ml-6">
                          <Textarea
                            value={localNotes[task.id] ?? task.notes ?? ""}
                            placeholder="Notizen, Links, Kontext…"
                            className="min-h-[50px] text-xs font-body bg-background/50 border-border/50 resize-none rounded"
                            onChange={(e) => handleNotesChange(task.id, e.target.value)}
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
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="border-t border-border">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-elevated">
                <div className="w-1 h-4 rounded-full bg-status-default" />
                <span className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">Archiv</span>
                <span className="text-[10px] font-mono text-muted-foreground/50">{archivedTasks.length}</span>
              </div>
              {archivedTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-3 px-4 py-2 border-b border-border/20 opacity-40 hover:opacity-60 transition-opacity">
                  <span className="monday-status monday-status-done text-[9px] py-0.5 px-2 min-w-0">✓</span>
                  {task.tag && <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 rounded border-0 opacity-60">{task.tag}</Badge>}
                  <span className="flex-1 text-sm font-body line-through text-muted-foreground truncate">{task.title}</span>
                  {canEdit && (
                    <>
                      <button className="text-[10px] font-mono text-muted-foreground hover:text-foreground flex items-center gap-1" onClick={() => restoreTask(task.id)}>
                        <Undo2 className="h-3 w-3" /> Zurück
                      </button>
                      <button className="text-muted-foreground hover:text-destructive" onClick={() => deleteTask(task.id)}>
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
