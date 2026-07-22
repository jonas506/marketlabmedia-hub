import React, { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import MobileDatePicker from "@/components/MobileDatePicker";
import { CalendarIcon, Clock, Trash2, Repeat } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Task, TeamMember, STATUS_CONFIG, PRIORITY_CONFIG, getSC, getInitials } from "./constants";
import TaskComments from "./TaskComments";

const RECURRENCE_OPTIONS = [
  { value: "none", label: "Einmalig" },
  { value: "daily", label: "Täglich" },
  { value: "weekdays", label: "Mo–Fr" },
  { value: "weekly", label: "Wöchentlich" },
  { value: "monthly", label: "Monatlich" },
];

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

  useEffect(() => {
    if (task) {
      setEditTitle(task.title);
      setEditDesc(task.description || "");
      setEditNotes(task.notes || "");
    }
  }, [task?.id]);

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

  const deleteTask = useCallback(async (t: Task) => {
    if (!confirm(`Aufgabe „${t.title}" wirklich löschen?`)) return;
    const { error } = await supabase.from("tasks" as any).delete().eq("id", t.id);
    if (error) { toast.error("Löschen fehlgeschlagen"); return; }
    qc.invalidateQueries({ queryKey: ["all-tasks-page"] });
    qc.invalidateQueries({ queryKey: ["my-tasks"] });
    qc.invalidateQueries({ queryKey: ["kanban-tasks"] });
    qc.invalidateQueries({ queryKey: ["tasks"] });
    toast.success("Aufgabe gelöscht");
    onClose();
  }, [qc, onClose]);

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
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60 font-mono">
                <Clock className="h-3 w-3" />
                Erstellt {format(new Date(selectedTask.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                {selectedTask.created_by && teamMap[selectedTask.created_by] && (
                  <span>von {teamMap[selectedTask.created_by].name}</span>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-border/50">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteTask(selectedTask)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-2"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Aufgabe löschen
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default React.memo(TaskDetailSheet);
