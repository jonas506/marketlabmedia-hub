import React from "react";
import { useNavigate } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Task, getPC } from "./constants";

interface TaskCardProps {
  task: Task;
  clientMap?: Record<string, string>;
  showClient?: boolean;
  showPerson?: boolean;
  personName?: string | null;
  todayStr: string;
  onComplete: (task: Task) => void;
  onSelect: (task: Task) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, clientMap, showClient = true, showPerson = false, personName, todayStr, onComplete, onSelect }) => {
  const navigate = useNavigate();
  const pc = getPC(task.priority);
  const isOverdue = task.deadline && task.deadline < todayStr;

  const handleClick = () => {
    if (task.content_piece_id) {
      navigate(`/client/${task.client_id}?piece=${task.content_piece_id}`);
      return;
    }
    onSelect(task);
  };

  return (
    <motion.div
      key={task.id}
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="group flex cursor-pointer items-start gap-2 rounded-lg border border-border/50 bg-card px-3 py-2 transition-all hover:border-border hover:shadow-sm"
      onClick={handleClick}
    >
      <Checkbox
        checked={false}
        onCheckedChange={() => onComplete(task)}
        onClick={(e) => e.stopPropagation()}
        className="mt-0.5 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <div className={cn("h-1.5 w-1.5 shrink-0 rounded-full", pc.dot)} />
          <span className="truncate text-sm font-body">{task.title}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 flex-wrap">
          {showClient && task.client_id && clientMap && (
            <span className="max-w-28 truncate text-[10px] font-mono text-muted-foreground">
              {clientMap[task.client_id] || ""}
            </span>
          )}
          {task.deadline && (
            <span className={cn("shrink-0 text-[10px] font-mono", isOverdue ? "text-destructive" : "text-muted-foreground")}>
              {format(new Date(task.deadline), "dd.MM", { locale: de })}
              {task.due_time && ` ${(task.due_time as string).slice(0, 5)}`}
            </span>
          )}
          {showPerson && personName && (
            <span className="text-[10px] font-mono text-primary/70 bg-primary/5 px-1.5 py-0 rounded">
              {personName}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default React.memo(TaskCard);
