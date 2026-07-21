import React, { useMemo } from "react";
import { DndContext } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Flag, User, Users, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Task, TeamMember, getInitials, PRIORITY_ORDER } from "./constants";
import TaskKanbanCard from "./TaskKanbanCard";

interface ClientInfo { id: string; name: string; logo_url: string | null }

type GroupBy = "assignee" | "client" | "priority";

interface Props {
  groupBy: GroupBy;
  tasks: Task[];
  clientMap: Record<string, ClientInfo>;
  teamMap: Record<string, TeamMember>;
  todayStr: string;
  onSelect: (t: Task) => void;
}

const PRIO_META: Record<string, { label: string; color: string }> = {
  urgent: { label: "Dringend", color: "text-red-400" },
  high: { label: "Hoch", color: "text-orange-400" },
  normal: { label: "Normal", color: "text-blue-400" },
  low: { label: "Niedrig", color: "text-muted-foreground" },
};

const TaskGroupedView: React.FC<Props> = ({ groupBy, tasks, clientMap, teamMap, todayStr, onSelect }) => {
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; label: string; sort: number; icon?: React.ReactNode; tasks: Task[] }>();

    const ensure = (key: string, label: string, sort: number, icon?: React.ReactNode) => {
      if (!map.has(key)) map.set(key, { key, label, sort, icon, tasks: [] });
      return map.get(key)!;
    };

    tasks.forEach(t => {
      if (groupBy === "assignee") {
        const id = t.assigned_to || "__none";
        const member = t.assigned_to ? teamMap[t.assigned_to] : null;
        const label = member?.name || member?.email || "Ohne Zuweisung";
        ensure(id, label, member ? 0 : 99, (
          <Avatar className="h-5 w-5">
            <AvatarFallback className="text-[9px] font-mono bg-primary/20 text-primary">
              {member ? getInitials(member.name || member.email) : "?"}
            </AvatarFallback>
          </Avatar>
        )).tasks.push(t);
      } else if (groupBy === "client") {
        const id = t.client_id || "__none";
        const client = t.client_id ? clientMap[t.client_id] : null;
        const label = client?.name || "Ohne Kunde";
        ensure(id, label, client ? 0 : 99, <Building2 className="h-3.5 w-3.5 text-muted-foreground" />).tasks.push(t);
      } else {
        const p = t.priority || "normal";
        const meta = PRIO_META[p] || PRIO_META.normal;
        ensure(p, meta.label, PRIORITY_ORDER[p] ?? 2, <Flag className={cn("h-3.5 w-3.5", meta.color)} fill="currentColor" />).tasks.push(t);
      }
    });

    // Sort tasks in each group: overdue first, then priority
    for (const g of map.values()) {
      g.tasks.sort((a, b) => {
        const ao = a.deadline && a.deadline < todayStr ? 0 : 1;
        const bo = b.deadline && b.deadline < todayStr ? 0 : 1;
        if (ao !== bo) return ao - bo;
        return (PRIORITY_ORDER[a.priority || "normal"] ?? 2) - (PRIORITY_ORDER[b.priority || "normal"] ?? 2);
      });
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.sort !== b.sort) return a.sort - b.sort;
      return a.label.localeCompare(b.label);
    });
  }, [tasks, groupBy, clientMap, teamMap, todayStr]);

  return (
    <DndContext>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {groups.map(g => (
          <div key={g.key} className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 px-2 py-2 mb-2">
              {g.icon}
              <span className="text-xs font-display font-semibold truncate">{g.label}</span>
              <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full ml-auto">
                {g.tasks.length}
              </span>
            </div>
            <div className="flex-1 rounded-xl border border-border/50 bg-surface-elevated/40 p-2 min-h-[200px]">
              <SortableContext items={g.tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {g.tasks.map(t => (
                    <TaskKanbanCard
                      key={t.id}
                      task={t}
                      client={t.client_id ? clientMap[t.client_id] : undefined}
                      assignee={t.assigned_to ? teamMap[t.assigned_to] : undefined}
                      todayStr={todayStr}
                      onSelect={onSelect}
                    />
                  ))}
                </div>
              </SortableContext>
            </div>
          </div>
        ))}
        {groups.length === 0 && (
          <div className="col-span-full py-12 text-center text-sm text-muted-foreground/60 font-mono">
            Keine Aufgaben
          </div>
        )}
      </div>
    </DndContext>
  );
};

export default TaskGroupedView;
