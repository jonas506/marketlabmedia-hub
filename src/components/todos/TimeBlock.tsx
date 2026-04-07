import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Play, Square, Trash2, GripVertical, ChevronDown, ChevronRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Task } from "@/components/tasks/constants";
import { TimeBlockData, getBlockType } from "./constants";
import confetti from "canvas-confetti";

interface Props {
  block: TimeBlockData;
  tasks: Task[];
  clientMap: Record<string, string>;
  isActive: boolean;
  hasActiveBlock: boolean;
  readonly?: boolean;
  onStart: () => void;
  onStop: () => void;
  onDelete: () => void;
  onCompleteTask: (task: Task) => void;
  onRemoveTask: (taskId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onReorder: (fromIdx: number, toIdx: number) => void;
  dragHandleProps?: {
    onDragStart: (e: React.DragEvent) => void;
    draggable: boolean;
  };
}

export default function TimeBlock({
  block, tasks, clientMap, isActive, hasActiveBlock, readonly,
  onStart, onStop, onDelete, onCompleteTask, onRemoveTask,
  onDragOver, onDrop, onReorder, dragHandleProps,
}: Props) {
  const bt = getBlockType(block.type);
  const blockTasks = block.task_ids
    .map(id => tasks.find(t => t.id === id))
    .filter(Boolean) as Task[];
  const completedCount = blockTasks.filter(t => t.is_completed).length;
  const totalCount = blockTasks.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const isCompleted = !!block.completed_at;
  const [expanded, setExpanded] = useState(true);
  const [remaining, setRemaining] = useState("");
  const [remainingMs, setRemainingMs] = useState<number>(Infinity);
  const [earlyFinish, setEarlyFinish] = useState<number | null>(null);

  useEffect(() => {
    if (!isActive || !block.started_at) return;
    const update = () => {
      const start = new Date(block.started_at!).getTime();
      const end = start + block.duration_minutes * 60 * 1000;
      const now = Date.now();
      const diff = Math.max(0, end - now);
      setRemainingMs(diff);
      if (diff <= 0) { setRemaining("00:00:00"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [isActive, block.started_at, block.duration_minutes]);

  useEffect(() => {
    if (isActive && totalCount > 0 && completedCount === totalCount && !isCompleted) {
      const start = new Date(block.started_at!).getTime();
      const end = start + block.duration_minutes * 60 * 1000;
      const minutesLeft = Math.round((end - Date.now()) / 60000);
      if (minutesLeft > 0) setEarlyFinish(minutesLeft);
      onStop();
    }
  }, [completedCount, totalCount, isActive]);

  const dimmed = hasActiveBlock && !isActive && !isCompleted;

  // Timer color
  const timerColor = isActive
    ? remainingMs < 120000 ? "text-destructive" : remainingMs < 600000 ? "text-orange-500" : "text-primary"
    : "text-primary";

  const handleInternalDragStart = (e: React.DragEvent, idx: number) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", `reorder:${idx}`);
  };

  const handleInternalDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    const data = e.dataTransfer.getData("text/plain");
    if (data.startsWith("reorder:")) {
      const fromIdx = parseInt(data.split(":")[1]);
      if (fromIdx !== targetIdx) onReorder(fromIdx, targetIdx);
    }
  };

  // Active glow style
  const activeStyle = isActive ? {
    borderLeftWidth: 6,
    borderLeftColor: bt.color,
    boxShadow: `0 0 20px ${bt.color}30`,
  } : {
    borderLeftWidth: 4,
    borderLeftColor: bt.color,
  };

  return (
    <motion.div
      layout
      className={`rounded-xl border bg-card shadow-sm transition-all ${
        isActive ? "ring-2 ring-primary shadow-lg" : ""
      } ${isCompleted ? "opacity-60" : ""} ${dimmed ? "opacity-40" : ""}`}
      style={activeStyle}
      onDragOver={readonly ? undefined : onDragOver}
      onDrop={readonly ? undefined : onDrop}
    >
      {/* Header */}
      <div className="flex items-center gap-2 p-3">
        {!readonly && dragHandleProps && (
          <div {...dragHandleProps} className="cursor-grab text-muted-foreground/40 hover:text-muted-foreground">
            <GripVertical className="h-4 w-4" />
          </div>
        )}
        <button onClick={() => setExpanded(!expanded)} className="shrink-0">
          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </button>
        {isCompleted && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
        <span className="text-base mr-1">{bt.icon}</span>
        <span className="font-semibold text-sm flex-1">{bt.label}</span>
        <span className="text-xs text-muted-foreground font-mono">
          {block.duration_minutes >= 60
            ? `${block.duration_minutes / 60}h`
            : `${block.duration_minutes}min`}
        </span>
        {totalCount > 0 && (
          <Badge variant="secondary" className="text-xs font-mono">
            {completedCount}/{totalCount}
          </Badge>
        )}
        {isActive && (
          <span className={`text-xs font-mono font-bold animate-pulse ${timerColor}`}>{remaining}</span>
        )}
        {!readonly && !isActive && !isCompleted && (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onStart} disabled={hasActiveBlock}>
            <Play className="h-3 w-3 mr-1" /> Starten
          </Button>
        )}
        {!readonly && isActive && (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive" onClick={onStop}>
            <Square className="h-3 w-3 mr-1" /> Stop
          </Button>
        )}
        {!readonly && !isActive && !isCompleted && (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      {totalCount > 0 && <Progress value={progress} className="h-1 mx-3 mb-1" />}

      {earlyFinish && isCompleted && (
        <div className="mx-3 mb-2 text-xs text-center text-primary font-medium">
          Block erledigt! {earlyFinish} Minuten früher fertig 🎉
        </div>
      )}

      {expanded && (
        <div className="px-3 pb-3 space-y-1">
          {blockTasks.length === 0 && !readonly && (
            <p className="text-xs text-muted-foreground/50 py-3 text-center">
              Aufgaben hierher ziehen oder [→] im Backlog nutzen
            </p>
          )}
          {blockTasks.map((task, idx) => {
            const isFirstUncompleted = isActive && !task.is_completed && blockTasks.slice(0, idx).every(t => t.is_completed);
            return (
              <div
                key={task.id}
                draggable={!readonly}
                onDragStart={readonly ? undefined : e => handleInternalDragStart(e, idx)}
                onDragOver={readonly ? undefined : e => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={readonly ? undefined : e => handleInternalDrop(e, idx)}
                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-all ${
                  isFirstUncompleted ? "bg-primary/10 ring-1 ring-primary/30" : ""
                } ${task.is_completed ? "opacity-40 line-through" : ""}`}
              >
                <button
                  onClick={() => {
                    if (readonly) return;
                    onCompleteTask(task);
                    confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 } });
                  }}
                  disabled={task.is_completed || readonly}
                  className={`h-4 w-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
                    task.is_completed ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30 hover:border-primary"
                  }`}
                >
                  {task.is_completed && <span className="text-[10px]">✓</span>}
                </button>
                <span className="flex-1 truncate">{task.title}</span>
                {task.client_id && clientMap[task.client_id] && (
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                    {clientMap[task.client_id]}
                  </span>
                )}
                {!readonly && !task.is_completed && !isCompleted && (
                  <button onClick={() => onRemoveTask(task.id)} className="text-muted-foreground/30 hover:text-destructive text-xs shrink-0">
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isCompleted && !earlyFinish && (
        <div className="px-3 pb-2 text-xs text-muted-foreground text-center">✅ Erledigt</div>
      )}
    </motion.div>
  );
}
