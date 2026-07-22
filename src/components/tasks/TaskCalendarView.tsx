import React, { useMemo } from "react";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Task, TeamMember, getInitials, PRIORITY_ORDER } from "./constants";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Flag } from "lucide-react";

interface ClientInfo { id: string; name: string; logo_url: string | null }

interface Props {
  tasks: Task[];
  clientMap: Record<string, ClientInfo>;
  teamMap: Record<string, TeamMember>;
  todayStr: string;
  onSelect: (t: Task) => void;
}

function clientHue(id: string): number {
  let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

const PRIO_DOT: Record<string, string> = {
  urgent: "bg-red-500", high: "bg-orange-500", normal: "bg-blue-500", low: "bg-muted-foreground",
};

const TaskCalendarView: React.FC<Props> = ({ tasks, clientMap, teamMap, todayStr, onSelect }) => {
  const [weekOffset, setWeekOffset] = React.useState(0);
  const today = new Date(todayStr);
  const monday = useMemo(() => addDays(startOfWeek(today, { weekStartsOn: 1 }), weekOffset * 7), [today, weekOffset]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(monday, i)), [monday]);

  const tasksByDay = useMemo(() => {
    const map: Record<string, Task[]> = {};
    tasks.forEach(t => {
      if (!t.deadline) return;
      const key = t.deadline;
      (map[key] ||= []).push(t);
    });
    Object.values(map).forEach(arr => arr.sort((a, b) =>
      (PRIORITY_ORDER[a.priority || "normal"] ?? 2) - (PRIORITY_ORDER[b.priority || "normal"] ?? 2)
    ));
    return map;
  }, [tasks]);

  const noDeadline = tasks.filter(t => !t.deadline);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset(o => o - 1)}
            className="h-7 px-2 rounded-md border border-border text-xs hover:bg-muted">←</button>
          <button onClick={() => setWeekOffset(0)}
            className="h-7 px-3 rounded-md border border-border text-xs hover:bg-muted">Diese Woche</button>
          <button onClick={() => setWeekOffset(o => o + 1)}
            className="h-7 px-2 rounded-md border border-border text-xs hover:bg-muted">→</button>
        </div>
        <span className="text-xs font-mono text-muted-foreground">
          {format(monday, "dd. MMM", { locale: de })} – {format(addDays(monday, 6), "dd. MMM yyyy", { locale: de })}
        </span>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map(day => {
          const key = format(day, "yyyy-MM-dd");
          const dayTasks = tasksByDay[key] || [];
          const isToday = isSameDay(day, today);
          const isWeekend = [0, 6].includes(day.getDay());
          return (
            <div key={key} className={cn(
              "rounded-lg border p-2 min-h-[220px] flex flex-col gap-1.5",
              isToday ? "border-primary/50 bg-primary/5" : "border-border/50 bg-surface-elevated/30",
              isWeekend && "opacity-60"
            )}>
              <div className="flex items-center justify-between mb-1">
                <div>
                  <div className="text-[10px] font-mono uppercase text-muted-foreground">
                    {format(day, "EEE", { locale: de })}
                  </div>
                  <div className={cn("text-sm font-bold", isToday && "text-primary")}>
                    {format(day, "dd.MM")}
                  </div>
                </div>
                {dayTasks.length > 0 && (
                  <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 rounded-full px-1.5">
                    {dayTasks.length}
                  </span>
                )}
              </div>
              {dayTasks.map(t => {
                const client = t.client_id ? clientMap[t.client_id] : null;
                const assignee = t.assigned_to ? teamMap[t.assigned_to] : null;
                const hue = client ? clientHue(client.id) : 220;
                return (
                  <button key={t.id} onClick={() => onSelect(t)}
                    className={cn(
                      "text-left w-full rounded-md border p-1.5 hover:border-primary/50 transition-colors bg-background/50",
                      t.is_completed && "opacity-40 line-through"
                    )}
                    style={{ borderLeftColor: `hsl(${hue} 70% 55%)`, borderLeftWidth: 2 }}
                  >
                    <div className="flex items-start gap-1">
                      <span className={cn("w-1.5 h-1.5 rounded-full mt-1 shrink-0", PRIO_DOT[t.priority || "normal"])} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-medium line-clamp-2">{t.title}</div>
                        {client && (
                          <div className="text-[9px] font-mono text-muted-foreground truncate">
                            {client.name}
                          </div>
                        )}
                      </div>
                      {assignee && (
                        <Avatar className="h-4 w-4 shrink-0">
                          <AvatarFallback className="text-[8px] bg-primary/20 text-primary font-mono">
                            {getInitials(assignee.name || assignee.email)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {noDeadline.length > 0 && (
        <div className="rounded-lg border border-border/50 bg-surface-elevated/30 p-3">
          <div className="text-[10px] font-mono uppercase text-muted-foreground mb-2">
            Ohne Deadline ({noDeadline.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {noDeadline.map(t => (
              <button key={t.id} onClick={() => onSelect(t)}
                className="text-xs px-2 py-1 rounded-md bg-background/60 border border-border hover:border-primary/50">
                {t.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskCalendarView;
