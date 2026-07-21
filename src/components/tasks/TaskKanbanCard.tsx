import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CalendarIcon, Flag } from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Task, TeamMember, getInitials, getPC } from "./constants";

interface ClientInfo { id: string; name: string; logo_url: string | null }

interface Props {
  task: Task;
  client?: ClientInfo;
  assignee?: TeamMember;
  todayStr: string;
  onSelect: (t: Task) => void;
}

// Deterministic color per client id
function clientHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

const TaskKanbanCard: React.FC<Props> = ({ task, client, assignee, todayStr, onSelect }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const pc = getPC(task.priority);
  const showFlag = task.priority === "high" || task.priority === "urgent";

  let deadlineTone: "overdue" | "soon" | "ok" | null = null;
  let deadlineLabel = "";
  if (task.deadline) {
    const days = differenceInCalendarDays(new Date(task.deadline), new Date(todayStr));
    if (days < 0) { deadlineTone = "overdue"; deadlineLabel = `${Math.abs(days)}d spät`; }
    else if (days === 0) { deadlineTone = "soon"; deadlineLabel = "Heute"; }
    else if (days === 1) { deadlineTone = "soon"; deadlineLabel = "Morgen"; }
    else { deadlineTone = "ok"; deadlineLabel = format(new Date(task.deadline), "dd. MMM", { locale: de }); }
  }

  const hue = client ? clientHue(client.id) : 220;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onSelect(task)}
      className={cn(
        "group relative rounded-lg border border-border bg-card p-2.5 shadow-sm cursor-pointer",
        "hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 transition-all",
        isDragging && "shadow-lg ring-2 ring-primary/40"
      )}
    >
      {/* Client color bar */}
      {client && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
          style={{ background: `hsl(${hue} 70% 55%)` }}
        />
      )}

      <div className="pl-1.5 space-y-2">
        {/* Client chip + priority flag */}
        <div className="flex items-center justify-between gap-2">
          {client ? (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-full max-w-full truncate"
              style={{ background: `hsl(${hue} 70% 55% / 0.15)`, color: `hsl(${hue} 70% 75%)` }}
            >
              <span className="truncate">{client.name}</span>
            </span>
          ) : <span className="text-[10px] font-mono text-muted-foreground/40">—</span>}
          {showFlag && (
            <Flag className={cn("h-3 w-3 shrink-0", pc.dot.includes("stuck") ? "text-red-400" : "text-orange-400")} fill="currentColor" />
          )}
        </div>

        {/* Title */}
        <div className="text-sm font-medium leading-snug line-clamp-2 text-foreground">
          {task.title}
        </div>

        {/* Footer: assignee + deadline */}
        <div className="flex items-center justify-between gap-2">
          <Avatar className="h-5 w-5 shrink-0">
            <AvatarFallback className="text-[9px] font-mono bg-primary/20 text-primary">
              {getInitials(assignee?.name || assignee?.email)}
            </AvatarFallback>
          </Avatar>
          {deadlineTone && (
            <span className={cn(
              "inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-full",
              deadlineTone === "overdue" && "bg-destructive/15 text-destructive",
              deadlineTone === "soon" && "bg-orange-500/15 text-orange-400",
              deadlineTone === "ok" && "bg-muted/50 text-muted-foreground",
            )}>
              <CalendarIcon className="h-2.5 w-2.5" />
              {deadlineLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(TaskKanbanCard);
