import React, { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDroppable, closestCorners, DragEndEvent, DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Task, TeamMember, STATUS_CONFIG } from "./constants";
import TaskKanbanCard from "./TaskKanbanCard";
import { Circle, Loader2, MessageSquare, CheckCircle2, PauseCircle, ChevronDown, ChevronRight } from "lucide-react";

interface ClientInfo { id: string; name: string; logo_url: string | null }

const COLUMN_META: Record<string, { label: string; icon: any; accent: string }> = {
  not_started: { label: "Offen", icon: Circle, accent: "text-muted-foreground" },
  in_progress: { label: "In Arbeit", icon: Loader2, accent: "text-blue-400" },
  review: { label: "Review", icon: MessageSquare, accent: "text-amber-400" },
  on_hold: { label: "On Hold", icon: PauseCircle, accent: "text-zinc-400" },
  done: { label: "Erledigt", icon: CheckCircle2, accent: "text-emerald-400" },
};

const COLUMNS = ["not_started", "in_progress", "review", "on_hold", "done"] as const;

interface Props {
  tasks: Task[];
  clientMap: Record<string, ClientInfo>;
  teamMap: Record<string, TeamMember>;
  todayStr: string;
  onSelect: (t: Task) => void;
}

const Column: React.FC<{
  status: string;
  tasks: Task[];
  clientMap: Record<string, ClientInfo>;
  teamMap: Record<string, TeamMember>;
  todayStr: string;
  onSelect: (t: Task) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}> = ({ status, tasks, clientMap, teamMap, todayStr, onSelect, collapsed, onToggleCollapse }) => {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const meta = COLUMN_META[status];
  const Icon = meta.icon;

  if (collapsed) {
    return (
      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-col rounded-xl border border-border/50 bg-surface-elevated/40 transition-colors cursor-pointer hover:bg-surface-elevated/70",
          isOver && "border-primary/60 bg-primary/10"
        )}
        onClick={onToggleCollapse}
        style={{ width: 44 }}
      >
        <div className="flex flex-col items-center gap-2 py-3">
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          <Icon className={cn("h-3.5 w-3.5", meta.accent)} />
          <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full">
            {tasks.length}
          </span>
          <span
            className="text-xs font-display font-semibold uppercase tracking-wide text-muted-foreground"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            {meta.label}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-w-0">
      <div className="flex items-center justify-between px-2 py-2 mb-2">
        <div className="flex items-center gap-1.5">
          <Icon className={cn("h-3.5 w-3.5", meta.accent)} />
          <span className="text-xs font-display font-semibold uppercase tracking-wide">{meta.label}</span>
          <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="text-muted-foreground/60 hover:text-foreground transition-colors"
            aria-label="Spalte einklappen"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 rounded-xl border border-border/50 bg-surface-elevated/40 p-2 min-h-[300px] transition-colors",
          isOver && "border-primary/60 bg-primary/5"
        )}
      >
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {tasks.map(t => (
              <TaskKanbanCard
                key={t.id}
                task={t}
                client={t.client_id ? clientMap[t.client_id] : undefined}
                assignee={t.assigned_to ? teamMap[t.assigned_to] : undefined}
                todayStr={todayStr}
                onSelect={onSelect}
              />
            ))}
            {tasks.length === 0 && (
              <div className="py-8 text-center text-[11px] font-mono text-muted-foreground/40">
                leer
              </div>
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
};

const COLLAPSE_KEY = "task-kanban-collapsed-v1";

const TaskKanbanBoard: React.FC<Props> = ({ tasks, clientMap, teamMap, todayStr, onSelect }) => {
  const qc = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(COLLAPSE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { done: true };
  });

  const toggleCollapsed = (s: string) => {
    setCollapsed(prev => {
      const next = { ...prev, [s]: !prev[s] };
      try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const columns = useMemo(() => {
    const m: Record<string, Task[]> = { not_started: [], in_progress: [], review: [], on_hold: [], done: [] };
    tasks.forEach(t => {
      const s = t.status && m[t.status] ? t.status : "not_started";
      m[s].push(t);
    });
    // Sort each: overdue first, then priority
    const prio: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
    for (const k of Object.keys(m)) {
      m[k].sort((a, b) => {
        const ao = a.deadline && a.deadline < todayStr ? 0 : 1;
        const bo = b.deadline && b.deadline < todayStr ? 0 : 1;
        if (ao !== bo) return ao - bo;
        return (prio[a.priority || "normal"] ?? 2) - (prio[b.priority || "normal"] ?? 2);
      });
    }
    return m;
  }, [tasks, todayStr]);

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const task = tasks.find(t => t.id === active.id);
    if (!task) return;

    // over.id might be a column id OR a task id (same column reorder)
    let newStatus = String(over.id);
    if (!COLUMNS.includes(newStatus as any)) {
      const overTask = tasks.find(t => t.id === over.id);
      if (!overTask) return;
      newStatus = overTask.status || "not_started";
    }

    if (newStatus === task.status) return;

    const updates: any = { status: newStatus };
    if (newStatus === "done") {
      updates.is_completed = true;
      updates.completed_at = new Date().toISOString();
    } else if (task.is_completed) {
      updates.is_completed = false;
      updates.completed_at = null;
    }

    await supabase.from("tasks" as any).update(updates).eq("id", task.id);
    qc.invalidateQueries({ queryKey: ["kanban-tasks"] });
    if (newStatus === "done") toast.success("✓ Erledigt");
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {COLUMNS.map(s => (
          <Column
            key={s}
            status={s}
            tasks={columns[s]}
            clientMap={clientMap}
            teamMap={teamMap}
            todayStr={todayStr}
            onSelect={onSelect}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask && (
          <TaskKanbanCard
            task={activeTask}
            client={activeTask.client_id ? clientMap[activeTask.client_id] : undefined}
            assignee={activeTask.assigned_to ? teamMap[activeTask.assigned_to] : undefined}
            todayStr={todayStr}
            onSelect={() => {}}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
};

export default TaskKanbanBoard;
