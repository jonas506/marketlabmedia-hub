import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Task, getSC, getPC } from "./constants";

interface TaskCardProps {
  task: Task;
  clientMap: Record<string, string>;
  showClient?: boolean;
  todayStr: string;
  onComplete: (task: Task) => void;
  onSelect: (task: Task) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, clientMap, showClient = true, todayStr, onComplete, onSelect }) => {
  const sc = getSC(task.status);
  const pc = getPC(task.priority);
  const isOverdue = task.deadline && task.deadline < todayStr;

  return (
    <motion.div
      key={task.id}
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex items-start gap-2 px-3 py-2 rounded-lg bg-card border border-border/50 hover:border-border cursor-pointer group transition-all"
      onClick={() => onSelect(task)}
    >
      <Checkbox
        checked={false}
        onCheckedChange={() => onComplete(task)}
        onClick={e => e.stopPropagation()}
        className="mt-0.5 shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", pc.dot)} />
          <span className="text-sm font-body truncate">{task.title}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {showClient && task.client_id && (
            <span className="text-[10px] font-mono text-muted-foreground truncate max-w-24">
              {clientMap[task.client_id] || ""}
            </span>
          )}
          <span className={cn("monday-status text-[8px] py-0 px-1.5", sc.cssClass)}>{sc.label}</span>
          {task.deadline && (
            <span className={cn("text-[10px] font-mono shrink-0", isOverdue ? "text-destructive" : "text-muted-foreground")}>
              {format(new Date(task.deadline), "dd.MM", { locale: de })}
              {task.due_time && ` ${(task.due_time as string).slice(0, 5)}`}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default React.memo(TaskCard);
