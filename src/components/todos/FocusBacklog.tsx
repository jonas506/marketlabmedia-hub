import { useMemo } from "react";
import { Task, groupTasks, GroupKey, GROUP_META } from "@/components/tasks/constants";
import { TimeBlockData, BLOCK_TYPES } from "./constants";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  tasks: Task[];
  blocks: TimeBlockData[];
  clientMap: Record<string, string>;
  todayStr: string;
  onAssignToBlock: (taskId: string, blockId: string) => void;
}

export default function FocusBacklog({ tasks, blocks, clientMap, todayStr, onAssignToBlock }: Props) {
  const assignedIds = useMemo(() => {
    const s = new Set<string>();
    blocks.forEach(b => b.task_ids.forEach(id => s.add(id)));
    return s;
  }, [blocks]);

  const backlogTasks = useMemo(() => tasks.filter(t => !assignedIds.has(t.id) && !t.is_completed), [tasks, assignedIds]);
  const grouped = useMemo(() => groupTasks(backlogTasks, todayStr), [backlogTasks, todayStr]);

  const activeBlocks = blocks.filter(b => !b.completed_at);
  const groupKeys: GroupKey[] = ["overdue", "today", "week", "later", "no_deadline"];

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("text/plain", `task:${taskId}`);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground">Backlog</h3>
      {groupKeys.map(key => {
        const items = grouped[key];
        if (!items.length && key !== "no_deadline") return null;
        const meta = GROUP_META[key];
        return (
          <div key={key}>
            <p className={`text-xs font-medium mb-1 ${meta.color}`}>{meta.label} ({items.length})</p>
            <div className="space-y-0.5">
              {items.map(task => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={e => handleDragStart(e, task.id)}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/50 cursor-grab group"
                >
                  <span className="flex-1 truncate">{task.title}</span>
                  {task.client_id && clientMap[task.client_id] && (
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                      {clientMap[task.client_id]}
                    </span>
                  )}
                  {activeBlocks.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="opacity-0 group-hover:opacity-100 text-xs text-muted-foreground hover:text-primary transition-opacity shrink-0 px-1">
                          →
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[140px]">
                        {activeBlocks.map(b => {
                          const bt = BLOCK_TYPES.find(t => t.value === b.type) || BLOCK_TYPES[0];
                          return (
                            <DropdownMenuItem key={b.id} onClick={() => onAssignToBlock(task.id, b.id)}>
                              {bt.icon} {bt.label}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {backlogTasks.length === 0 && (
        <p className="text-xs text-muted-foreground/50 text-center py-6">Alle Aufgaben sind eingeplant 🎉</p>
      )}
    </div>
  );
}
