import React, { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import MobileDatePicker from "@/components/MobileDatePicker";
import { CalendarIcon, Clock, Send } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Task, TeamMember, TaskComment, STATUS_CONFIG, PRIORITY_CONFIG, getSC, getInitials } from "./constants";

interface TaskDetailSheetProps {
  task: Task | null;
  onClose: () => void;
  team: TeamMember[];
  clients: { id: string; name: string }[];
  teamMap: Record<string, TeamMember>;
}

const TaskDetailSheet: React.FC<TaskDetailSheetProps> = ({ task, onClose, team, clients, teamMap }) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [commentText, setCommentText] = useState("");

  useEffect(() => {
    if (task) {
      setEditTitle(task.title);
      setEditDesc(task.description || "");
      setEditNotes(task.notes || "");
      setCommentText("");
    }
  }, [task?.id]);

  const { data: comments = [], refetch: refetchComments } = useQuery({
    queryKey: ["task-comments", task?.id],
    queryFn: async () => {
      if (!task) return [];
      const { data } = await supabase
        .from("task_comments" as any)
        .select("*")
        .eq("task_id", task.id)
        .order("created_at", { ascending: true });
      return (data as any[] ?? []) as TaskComment[];
    },
    enabled: !!task,
  });

  const updateTask = useCallback(async (taskId: string, updates: Record<string, any>) => {
    await supabase.from("tasks" as any).update(updates as any).eq("id", taskId);
    qc.invalidateQueries({ queryKey: ["all-tasks-page"] });
    qc.invalidateQueries({ queryKey: ["my-tasks"] });
    qc.invalidateQueries({ queryKey: ["tasks"] });
  }, [qc]);

  const completeTask = useCallback(async (t: Task) => {
    await supabase.from("tasks" as any).update({ is_completed: true, status: "done", completed_at: new Date().toISOString(), completed_by: user?.id } as any).eq("id", t.id);
    qc.invalidateQueries({ queryKey: ["all-tasks-page"] });
    qc.invalidateQueries({ queryKey: ["my-tasks"] });
    qc.invalidateQueries({ queryKey: ["tasks", t.client_id] });
    toast.success("✓ Erledigt");
    onClose();
  }, [qc, onClose]);

  const addComment = async () => {
    if (!commentText.trim() || !task || !user) return;
    await supabase.from("task_comments" as any).insert({
      task_id: task.id,
      user_id: user.id,
      content: commentText.trim(),
    } as any);
    setCommentText("");
    refetchComments();
  };

  const [localTask, setLocalTask] = useState<Task | null>(null);
  useEffect(() => { setLocalTask(task); }, [task]);

  const handleUpdate = useCallback(async (taskId: string, updates: Record<string, any>) => {
    setLocalTask(prev => prev ? { ...prev, ...updates } : null);
    await updateTask(taskId, updates);
  }, [updateTask]);

  const selectedTask = localTask;

  return (
    <Sheet open={!!task} onOpenChange={o => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="sr-only">Aufgabe bearbeiten</SheetTitle>
        </SheetHeader>
        {selectedTask && (
          <div className="space-y-5 pt-2">
            <Input
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onBlur={() => editTitle !== selectedTask.title && handleUpdate(selectedTask.id, { title: editTitle })}
              className="text-lg font-display font-bold border-0 shadow-none px-0 focus-visible:ring-0 h-auto"
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase mb-1 block">Status</label>
                <Select
                  value={selectedTask.status || "not_started"}
                  onValueChange={v => {
                    if (v === "done") {
                      completeTask(selectedTask);
                    } else {
                      handleUpdate(selectedTask.id, { status: v });
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

              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase mb-1 block">Priorität</label>
                <Select
                  value={selectedTask.priority || "normal"}
                  onValueChange={v => handleUpdate(selectedTask.id, { priority: v })}
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

              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase mb-1 block">Zugewiesen an</label>
                <Select
                  value={selectedTask.assigned_to || "unassigned"}
                  onValueChange={v => handleUpdate(selectedTask.id, { assigned_to: v === "unassigned" ? null : v })}
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

              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase mb-1 block">Kunde</label>
                <Select
                  value={selectedTask.client_id || ""}
                  onValueChange={v => handleUpdate(selectedTask.id, { client_id: v })}
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

              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase mb-1 block">Deadline</label>
                <MobileDatePicker
                  selected={selectedTask.deadline ? new Date(selectedTask.deadline) : undefined}
                  onSelect={date => handleUpdate(selectedTask.id, { deadline: date ? format(date, "yyyy-MM-dd") : null })}
                >
                  <Button variant="outline" className="h-8 w-full text-xs justify-start gap-2">
                    <CalendarIcon className="h-3 w-3" />
                    {selectedTask.deadline
                      ? format(new Date(selectedTask.deadline), "dd. MMM yyyy", { locale: de })
                      : "Keine"}
                  </Button>
                </MobileDatePicker>
              </div>

              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase mb-1 block">Uhrzeit</label>
                <Input
                  type="time"
                  value={(selectedTask.due_time as string) || ""}
                  onChange={e => handleUpdate(selectedTask.id, { due_time: e.target.value || null })}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-mono text-muted-foreground uppercase mb-1 block">Beschreibung</label>
              <Textarea
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                onBlur={() => editDesc !== (selectedTask.description || "") && handleUpdate(selectedTask.id, { description: editDesc || null })}
                placeholder="Beschreibung hinzufügen…"
                className="min-h-[80px] text-sm font-body"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono text-muted-foreground uppercase mb-1 block">Notizen</label>
              <Textarea
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                onBlur={() => editNotes !== (selectedTask.notes || "") && handleUpdate(selectedTask.id, { notes: editNotes || null })}
                placeholder="Notizen…"
                className="min-h-[60px] text-sm font-body"
              />
            </div>

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
  );
};

export default React.memo(TaskDetailSheet);
