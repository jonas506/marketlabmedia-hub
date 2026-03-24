import React from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Task, GroupKey, GROUP_META } from "./constants";
import TaskCard from "./TaskCard";

interface TaskGroupSectionProps {
  groupKey: GroupKey;
  tasks: Task[];
  defaultOpen?: boolean;
  clientMap: Record<string, string>;
  todayStr: string;
  onComplete: (task: Task) => void;
  onSelect: (task: Task) => void;
}

const TaskGroupSection: React.FC<TaskGroupSectionProps> = ({ groupKey, tasks, defaultOpen = true, clientMap, todayStr, onComplete, onSelect }) => {
  if (tasks.length === 0) return null;
  const meta = GROUP_META[groupKey];
  const Icon = meta.icon;
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 px-2 py-1.5 w-full text-left hover:bg-surface-hover rounded-md transition-colors">
        <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform [[data-state=closed]_&]:-rotate-90" />
        <Icon className={cn("h-3 w-3", meta.color)} />
        <span className={cn("text-xs font-display font-semibold", meta.color)}>{meta.label}</span>
        <span className="text-[10px] font-mono text-muted-foreground">{tasks.length}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1 mt-1">
        <AnimatePresence mode="popLayout">
          {tasks.map(t => (
            <TaskCard key={t.id} task={t} clientMap={clientMap} todayStr={todayStr} onComplete={onComplete} onSelect={onSelect} />
          ))}
        </AnimatePresence>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default React.memo(TaskGroupSection);
