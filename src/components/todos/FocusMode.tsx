import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { format, addDays, subDays, isToday, isBefore, startOfDay } from "date-fns";
import { de } from "date-fns/locale";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { Task } from "@/components/tasks/constants";
import {
  TimeBlockData, BLOCK_TYPES, DURATION_PRESETS, BlockType, getBlockType,
  classifyTask, roundToHalfHour, playTimerBeep,
} from "./constants";
import TimeBlock from "./TimeBlock";
import FocusBacklog from "./FocusBacklog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter,
} from "@/components/ui/alert-dialog";

interface Props {
  tasks: Task[];
  clientMap: Record<string, string>;
  todayStr: string;
  onQuickAddedTask?: (taskId: string) => void;
  lastCreatedTaskId?: string | null;
}

export default function FocusMode({ tasks, clientMap, todayStr, onQuickAddedTask, lastCreatedTaskId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [blocks, setBlocks] = useState<TimeBlockData[]>([]);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [selectedType, setSelectedType] = useState<BlockType | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mobileBacklogOpen, setMobileBacklogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [dismissedSuggestion, setDismissedSuggestion] = useState(false);
  const [stopDialogBlock, setStopDialogBlock] = useState<string | null>(null);
  const blockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [allDoneShown, setAllDoneShown] = useState(false);

  const isReadonly = isBefore(startOfDay(new Date(selectedDate)), startOfDay(new Date(todayStr)));
  const isCurrentDay = selectedDate === todayStr;

  // Load plan for selected date
  const { data: plan, refetch: refetchPlan } = useQuery({
    queryKey: ["daily-plan", user?.id, selectedDate],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("daily_plans" as any)
        .select("*")
        .eq("user_id", user.id)
        .eq("date", selectedDate)
        .maybeSingle();
      return data as any;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (plan?.blocks) {
      const b = (typeof plan.blocks === "string" ? JSON.parse(plan.blocks) : plan.blocks) as TimeBlockData[];
      setBlocks(b);
      const active = b.find(bl => bl.started_at && !bl.completed_at);
      setActiveBlockId(active?.id ?? null);
    } else {
      setBlocks([]);
      setActiveBlockId(null);
    }
    setDismissedSuggestion(false);
    setAllDoneShown(false);
  }, [plan, selectedDate]);

  // Save plan (debounced)
  const savePlan = useCallback((newBlocks: TimeBlockData[]) => {
    if (!user) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await supabase.from("daily_plans" as any).upsert({
        user_id: user.id,
        date: selectedDate,
        blocks: newBlocks,
      } as any, { onConflict: "user_id,date" });
    }, 500);
  }, [user, selectedDate]);

  const updateBlocks = useCallback((newBlocks: TimeBlockData[]) => {
    setBlocks(newBlocks);
    savePlan(newBlocks);
  }, [savePlan]);

  // Create block
  const createBlock = useCallback((type: BlockType, duration: number, taskIds: string[] = []) => {
    const bt = getBlockType(type);
    const newBlock: TimeBlockData = {
      id: crypto.randomUUID(),
      type,
      label: bt.label,
      duration_minutes: duration,
      task_ids: taskIds,
      started_at: null,
      completed_at: null,
      sort_order: blocks.length,
    };
    const updated = [...blocks, newBlock];
    updateBlocks(updated);
    setShowAddBlock(false);
    setSelectedType(null);
    return newBlock.id;
  }, [blocks, updateBlocks]);

  // Start block
  const startBlock = (blockId: string) => {
    const newBlocks = blocks.map(b =>
      b.id === blockId ? { ...b, started_at: new Date().toISOString() } : b
    );
    setActiveBlockId(blockId);
    updateBlocks(newBlocks);

    const block = blocks.find(b => b.id === blockId)!;
    if (blockTimerRef.current) clearTimeout(blockTimerRef.current);
    blockTimerRef.current = setTimeout(() => {
      setBlocks(prev => {
        const updated = prev.map(b =>
          b.id === blockId && b.started_at && !b.completed_at
            ? { ...b, completed_at: new Date().toISOString() }
            : b
        );
        savePlan(updated);
        return updated;
      });
      setActiveBlockId(prev => prev === blockId ? null : prev);
      playTimerBeep();
      toast("⏰ Block beendet!", { description: `${block.label} ist abgelaufen` });
    }, block.duration_minutes * 60 * 1000);
  };

  // Stop block (with dialog for open tasks)
  const requestStopBlock = (blockId: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    const openTasks = block.task_ids.filter(id => {
      const t = tasks.find(tk => tk.id === id);
      return t && !t.is_completed;
    });
    if (openTasks.length > 0) {
      setStopDialogBlock(blockId);
    } else {
      doStopBlock(blockId);
    }
  };

  const doStopBlock = (blockId: string) => {
    if (blockTimerRef.current) clearTimeout(blockTimerRef.current);
    const newBlocks = blocks.map(b =>
      b.id === blockId ? { ...b, completed_at: new Date().toISOString() } : b
    );
    setActiveBlockId(null);
    updateBlocks(newBlocks);
    setStopDialogBlock(null);
  };

  const stopAndMoveToBacklog = (blockId: string) => {
    if (blockTimerRef.current) clearTimeout(blockTimerRef.current);
    const block = blocks.find(b => b.id === blockId)!;
    const openTaskIds = block.task_ids.filter(id => {
      const t = tasks.find(tk => tk.id === id);
      return t && !t.is_completed;
    });
    const newBlocks = blocks.map(b => {
      if (b.id !== blockId) return b;
      return { ...b, completed_at: new Date().toISOString(), task_ids: b.task_ids.filter(id => !openTaskIds.includes(id)) };
    });
    setActiveBlockId(null);
    updateBlocks(newBlocks);
    setStopDialogBlock(null);
  };

  const stopAndMoveToNext = (blockId: string) => {
    if (blockTimerRef.current) clearTimeout(blockTimerRef.current);
    const blockIdx = blocks.findIndex(b => b.id === blockId);
    const block = blocks[blockIdx];
    const openTaskIds = block.task_ids.filter(id => {
      const t = tasks.find(tk => tk.id === id);
      return t && !t.is_completed;
    });
    const nextBlock = blocks.slice(blockIdx + 1).find(b => !b.completed_at);
    const newBlocks = blocks.map(b => {
      if (b.id === blockId) {
        return { ...b, completed_at: new Date().toISOString(), task_ids: b.task_ids.filter(id => !openTaskIds.includes(id)) };
      }
      if (nextBlock && b.id === nextBlock.id) {
        return { ...b, task_ids: [...b.task_ids, ...openTaskIds] };
      }
      return b;
    });
    setActiveBlockId(null);
    updateBlocks(newBlocks);
    setStopDialogBlock(null);
    if (nextBlock) toast.success(`${openTaskIds.length} Aufgabe${openTaskIds.length > 1 ? "n" : ""} in nächsten Block verschoben`);
  };

  const deleteBlock = (blockId: string) => {
    updateBlocks(blocks.filter(b => b.id !== blockId));
  };

  const completeTask = async (task: Task) => {
    await supabase.from("tasks" as any).update({
      is_completed: true,
      status: "done",
      completed_at: new Date().toISOString(),
      completed_by: user?.id,
    } as any).eq("id", task.id);
    qc.invalidateQueries({ queryKey: ["my-todos-page"] });
    qc.invalidateQueries({ queryKey: ["my-tasks"] });
    toast.success("✓ Erledigt");
  };

  const assignToBlock = useCallback((taskId: string, blockId: string) => {
    const newBlocks = blocks.map(b => {
      const filtered = b.task_ids.filter(id => id !== taskId);
      if (b.id === blockId) return { ...b, task_ids: [...filtered, taskId] };
      return { ...b, task_ids: filtered };
    });
    updateBlocks(newBlocks);
  }, [blocks, updateBlocks]);

  const removeFromBlock = (blockId: string, taskId: string) => {
    const newBlocks = blocks.map(b =>
      b.id === blockId ? { ...b, task_ids: b.task_ids.filter(id => id !== taskId) } : b
    );
    updateBlocks(newBlocks);
  };

  const reorderInBlock = (blockId: string, fromIdx: number, toIdx: number) => {
    const newBlocks = blocks.map(b => {
      if (b.id !== blockId) return b;
      const ids = [...b.task_ids];
      const [moved] = ids.splice(fromIdx, 1);
      ids.splice(toIdx, 0, moved);
      return { ...b, task_ids: ids };
    });
    updateBlocks(newBlocks);
  };

  // Block reorder via drag
  const handleBlockDragStart = (e: React.DragEvent, blockId: string) => {
    e.dataTransfer.setData("text/plain", `block:${blockId}`);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleBlockDrop = (e: React.DragEvent, targetBlockId: string) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("text/plain");
    if (data.startsWith("block:")) {
      const sourceId = data.split(":")[1];
      if (sourceId === targetBlockId) return;
      const sourceIdx = blocks.findIndex(b => b.id === sourceId);
      const targetIdx = blocks.findIndex(b => b.id === targetBlockId);
      const newBlocks = [...blocks];
      const [moved] = newBlocks.splice(sourceIdx, 1);
      newBlocks.splice(targetIdx, 0, moved);
      updateBlocks(newBlocks.map((b, i) => ({ ...b, sort_order: i })));
    } else if (data.startsWith("task:")) {
      const taskId = data.split(":")[1];
      assignToBlock(taskId, targetBlockId);
    }
  };

  // Quick-add toast with block assignment
  useEffect(() => {
    if (!lastCreatedTaskId || blocks.length === 0) return;
    const activeBlocks = blocks.filter(b => !b.completed_at);
    if (activeBlocks.length === 0) return;

    const timeoutId = setTimeout(() => {
      // auto-assign nothing, just goes to backlog
    }, 3000);

    toast("Aufgabe erstellt", {
      duration: 3000,
      action: activeBlocks.length <= 3 ? undefined : undefined,
      description: (
        <div className="flex gap-1 mt-1 flex-wrap">
          {activeBlocks.map(b => {
            const bt = getBlockType(b.type);
            return (
              <button
                key={b.id}
                onClick={() => {
                  assignToBlock(lastCreatedTaskId, b.id);
                  toast.dismiss();
                  clearTimeout(timeoutId);
                }}
                className="text-xs px-2 py-0.5 rounded bg-muted hover:bg-muted-foreground/20 transition-colors"
              >
                {bt.icon} {bt.label}
              </button>
            );
          })}
        </div>
      ) as any,
    });

    return () => clearTimeout(timeoutId);
  }, [lastCreatedTaskId]);

  // Smart suggestions
  const suggestion = useMemo(() => {
    if (blocks.length > 0 || dismissedSuggestion || !isCurrentDay) return null;
    const openTasks = tasks.filter(t => !t.is_completed);
    if (openTasks.length === 0) return null;

    const grouped: Record<BlockType, Task[]> = { fokus: [], admin: [], content: [] };
    openTasks.forEach(t => {
      const type = classifyTask(t);
      grouped[type].push(t);
    });

    const suggestions = BLOCK_TYPES.map(bt => {
      const typeTasks = grouped[bt.value as BlockType];
      if (typeTasks.length === 0) return null;
      const duration = roundToHalfHour(typeTasks.length * 25);
      return { type: bt.value as BlockType, tasks: typeTasks, duration, bt };
    }).filter(Boolean) as { type: BlockType; tasks: Task[]; duration: number; bt: typeof BLOCK_TYPES[number] }[];

    if (suggestions.length === 0) return null;
    return { suggestions, totalTasks: openTasks.length };
  }, [blocks.length, dismissedSuggestion, tasks, isCurrentDay]);

  const applySuggestion = () => {
    if (!suggestion) return;
    let newBlocks: TimeBlockData[] = [];
    suggestion.suggestions.forEach((s, i) => {
      newBlocks.push({
        id: crypto.randomUUID(),
        type: s.type,
        label: s.bt.label,
        duration_minutes: s.duration,
        task_ids: s.tasks.map(t => t.id),
        started_at: null,
        completed_at: null,
        sort_order: i,
      });
    });
    updateBlocks(newBlocks);
  };

  // Check if all blocks done → confetti
  useEffect(() => {
    if (blocks.length > 0 && blocks.every(b => b.completed_at) && !allDoneShown && isCurrentDay) {
      setAllDoneShown(true);
      confetti({ particleCount: 100, spread: 120, origin: { y: 0.5 } });
    }
  }, [blocks, allDoneShown, isCurrentDay]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isCurrentDay) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      if (e.code === "Space" && activeBlockId) {
        e.preventDefault();
        const block = blocks.find(b => b.id === activeBlockId);
        if (!block) return;
        const blockTasks = block.task_ids.map(id => tasks.find(t => t.id === id)).filter(Boolean) as Task[];
        const firstUncompleted = blockTasks.find(t => !t.is_completed);
        if (firstUncompleted) {
          completeTask(firstUncompleted);
          confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 } });
        }
      }

      if (e.code === "Enter" && !activeBlockId) {
        e.preventDefault();
        const nextBlock = blocks.find(b => !b.started_at && !b.completed_at);
        if (nextBlock) startBlock(nextBlock.id);
      }

      if (e.code === "Escape" && activeBlockId) {
        e.preventDefault();
        requestStopBlock(activeBlockId);
      }

      if ((e.key === "1" || e.key === "2" || e.key === "3") && !activeBlockId) {
        const types: BlockType[] = ["fokus", "admin", "content"];
        const type = types[parseInt(e.key) - 1];
        const defaultDurations = [120, 60, 90];
        createBlock(type, defaultDurations[parseInt(e.key) - 1]);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeBlockId, blocks, tasks, isCurrentDay]);

  // Summary stats
  const completedBlocks = blocks.filter(b => b.completed_at);
  const allBlockTaskIds = blocks.flatMap(b => b.task_ids);
  const completedTaskCount = tasks.filter(t => allBlockTaskIds.includes(t.id) && t.is_completed).length;
  const totalPlannedTasks = allBlockTaskIds.length;
  const totalMinutesPlanned = blocks.reduce((sum, b) => sum + b.duration_minutes, 0);
  const minutesByType = BLOCK_TYPES.map(bt => ({
    ...bt,
    minutes: blocks.filter(b => b.type === bt.value && b.completed_at).reduce((s, b) => s + b.duration_minutes, 0),
  }));

  // Date navigation
  const dateFormatted = format(new Date(selectedDate), "EEE, d. MMM yyyy", { locale: de });
  const goYesterday = () => setSelectedDate(format(subDays(new Date(selectedDate), 1), "yyyy-MM-dd"));
  const goTomorrow = () => setSelectedDate(format(addDays(new Date(selectedDate), 1), "yyyy-MM-dd"));
  const goToday = () => setSelectedDate(todayStr);

  const stopDialogOpenTasks = useMemo(() => {
    if (!stopDialogBlock) return 0;
    const b = blocks.find(bl => bl.id === stopDialogBlock);
    if (!b) return 0;
    return b.task_ids.filter(id => { const t = tasks.find(tk => tk.id === id); return t && !t.is_completed; }).length;
  }, [stopDialogBlock, blocks, tasks]);

  const hasNextBlock = useMemo(() => {
    if (!stopDialogBlock) return false;
    const idx = blocks.findIndex(b => b.id === stopDialogBlock);
    return blocks.slice(idx + 1).some(b => !b.completed_at);
  }, [stopDialogBlock, blocks]);

  return (
    <div className="space-y-4">
      {/* Date navigation */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 sm:gap-2 min-w-0">
          <button onClick={goYesterday} className="text-muted-foreground hover:text-foreground transition-colors p-2 -ml-2 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <ChevronLeft className="h-5 w-5 sm:h-4 sm:w-4" />
          </button>
          <button
            onClick={goToday}
            className={`text-sm font-medium transition-colors truncate ${isCurrentDay ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {isCurrentDay ? "Heute" : isToday(addDays(new Date(selectedDate), 1)) ? "Gestern" : ""}: <span className="capitalize">{dateFormatted}</span>
          </button>
          <button onClick={goTomorrow} className="text-muted-foreground hover:text-foreground transition-colors p-2 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <ChevronRight className="h-5 w-5 sm:h-4 sm:w-4" />
          </button>
          {!isCurrentDay && (
            <button onClick={goToday} className="text-xs text-primary hover:underline ml-1 sm:ml-2 shrink-0">
              Heute
            </button>
          )}
        </div>
        {!isReadonly && (
          <Button size="sm" variant="outline" className="h-9 sm:h-7 text-xs px-3 shrink-0" onClick={() => setShowAddBlock(true)}>
            <Plus className="h-4 w-4 sm:h-3 sm:w-3 mr-1" /> Block
          </Button>
        )}
      </div>

      {isReadonly && (
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 text-center">
          Vergangener Tag — nur Ansicht
        </div>
      )}

      {/* All done banner */}
      {allDoneShown && isCurrentDay && (
        <div className="p-4 rounded-xl border-2 border-primary/30 bg-primary/5 text-center space-y-1">
          <p className="text-lg font-bold">Tag geschafft! 🎉</p>
          <p className="text-sm text-muted-foreground">Alle Blöcke erledigt</p>
        </div>
      )}

      {/* Smart suggestion */}
      {suggestion && !isReadonly && (
        <div className="p-4 rounded-xl border border-dashed bg-card/50 space-y-3">
          <p className="text-sm font-semibold">💡 Vorgeschlagener Tagesplan</p>
          <p className="text-xs text-muted-foreground">
            Basierend auf deinen {suggestion.totalTasks} offenen To-Dos:
          </p>
          <div className="space-y-1.5">
            {suggestion.suggestions.map(s => (
              <div key={s.type} className="flex items-center gap-2 text-sm">
                <span>{s.bt.icon}</span>
                <span className="font-medium">{s.bt.label}</span>
                <span className="text-xs text-muted-foreground font-mono">
                  ({s.duration >= 60 ? `${s.duration / 60}h` : `${s.duration}min`})
                </span>
                <span className="text-xs text-muted-foreground">— {s.tasks.length} Aufgabe{s.tasks.length !== 1 ? "n" : ""}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={applySuggestion}>
              Vorschlag übernehmen
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setDismissedSuggestion(true)}>
              Selbst planen
            </Button>
          </div>
        </div>
      )}

      {/* Quick add block */}
      {!isReadonly && showAddBlock && (
        <div className="p-3 rounded-xl border bg-card space-y-3">
          {!selectedType ? (
            <div className="flex gap-2 flex-wrap">
              {BLOCK_TYPES.map(bt => (
                <button
                  key={bt.value}
                  onClick={() => setSelectedType(bt.value)}
                  className="flex items-center gap-2 px-4 py-3 sm:px-3 sm:py-2 rounded-lg border hover:bg-muted/50 transition-colors text-sm min-h-[44px]"
                  style={{ borderColor: bt.color + "40" }}
                >
                  <span>{bt.icon}</span>
                  <span className="font-medium">{bt.label}</span>
                </button>
              ))}
              <button onClick={() => setShowAddBlock(false)} className="text-xs text-muted-foreground px-3 py-2 min-h-[44px]">
                Abbrechen
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {getBlockType(selectedType).icon} {getBlockType(selectedType).label} — Dauer wählen:
              </p>
              <div className="flex gap-2 flex-wrap">
                {DURATION_PRESETS.map(dp => (
                  <button
                    key={dp.value}
                    onClick={() => createBlock(selectedType, dp.value)}
                    className="px-4 py-2.5 sm:px-3 sm:py-1.5 rounded-lg border hover:bg-primary hover:text-primary-foreground transition-colors text-sm font-mono min-h-[44px]"
                  >
                    {dp.label}
                  </button>
                ))}
                <button onClick={() => setSelectedType(null)} className="text-xs text-muted-foreground px-3 py-2 min-h-[44px]">
                  Zurück
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick templates when empty and no suggestion */}
      {blocks.length === 0 && !showAddBlock && !suggestion && !isReadonly && (
        <div className="p-4 rounded-xl border border-dashed bg-card/50 text-center space-y-3">
          <p className="text-sm text-muted-foreground">Plane deinen Tag mit Zeitblöcken</p>
          <div className="flex gap-2 justify-center flex-wrap">
            {[
              { type: "fokus" as BlockType, dur: 120, label: "🎯 Fokus 2h", cls: "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20" },
              { type: "admin" as BlockType, dur: 60, label: "📋 Admin 1h", cls: "bg-muted text-muted-foreground hover:bg-muted/80" },
              { type: "content" as BlockType, dur: 90, label: "✏️ Content 1.5h", cls: "bg-green-500/10 text-green-400 hover:bg-green-500/20" },
            ].map(q => (
              <button key={q.type} onClick={() => createBlock(q.type, q.dur)} className={`px-4 py-2.5 sm:px-3 sm:py-1.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${q.cls}`}>
                {q.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground/40">Tastatur: 1 = Fokus · 2 = Admin · 3 = Content</p>
        </div>
      )}

      {/* Main layout */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Blocks column */}
        <div className="flex-1 md:w-[60%] space-y-3">
          {blocks.map(block => (
            <TimeBlock
              key={block.id}
              block={block}
              tasks={tasks}
              clientMap={clientMap}
              isActive={activeBlockId === block.id}
              hasActiveBlock={!!activeBlockId}
              readonly={isReadonly}
              onStart={() => startBlock(block.id)}
              onStop={() => requestStopBlock(block.id)}
              onDelete={() => deleteBlock(block.id)}
              onCompleteTask={completeTask}
              onRemoveTask={taskId => removeFromBlock(block.id, taskId)}
              onDragOver={e => { e.preventDefault(); }}
              onDrop={e => handleBlockDrop(e, block.id)}
              onReorder={(from, to) => reorderInBlock(block.id, from, to)}
              dragHandleProps={isReadonly ? undefined : {
                draggable: true,
                onDragStart: e => handleBlockDragStart(e, block.id),
              }}
            />
          ))}

          {/* Summary */}
          {completedBlocks.length > 0 && (
            <div className="p-4 rounded-xl border bg-card/50 space-y-1.5">
              <p className="text-sm font-semibold flex items-center gap-2">
                📊 {isCurrentDay ? "Heute geschafft" : "Zusammenfassung"}
              </p>
              <p className="text-xs text-muted-foreground">
                ✅ {completedTaskCount} von {totalPlannedTasks} Aufgaben erledigt
              </p>
              <p className="text-xs text-muted-foreground">
                ⏱ {Math.floor(totalMinutesPlanned / 60)}h{totalMinutesPlanned % 60 > 0 ? ` ${totalMinutesPlanned % 60}min` : ""} geplante Zeit
              </p>
              {minutesByType.some(m => m.minutes > 0) && (
                <p className="text-xs text-muted-foreground">
                  {minutesByType
                    .filter(m => m.minutes > 0)
                    .map(m => `${m.icon} ${m.label}: ${m.minutes >= 60 ? `${Math.floor(m.minutes / 60)}h` : ""}${m.minutes % 60 > 0 ? `${m.minutes % 60}min` : ""}`)
                    .join(" | ")}
                </p>
              )}
            </div>
          )}

          {blocks.length === 0 && isReadonly && (
            <p className="text-xs text-muted-foreground/50 text-center py-8">Kein Plan für diesen Tag</p>
          )}
        </div>

        {/* Backlog column */}
        {!isReadonly && (
          <div className="md:w-[40%]">
            <div className="md:hidden">
              <button
                onClick={() => setMobileBacklogOpen(!mobileBacklogOpen)}
                className="w-full text-sm text-muted-foreground font-medium py-3 flex items-center justify-center gap-1 min-h-[44px] rounded-lg border border-dashed"
              >
                Backlog {mobileBacklogOpen ? "▲" : "▼"}
              </button>
            </div>
            <div className={`${mobileBacklogOpen ? "block" : "hidden"} md:block rounded-xl border bg-card/50 p-3`}>
              <FocusBacklog
                tasks={tasks}
                blocks={blocks}
                clientMap={clientMap}
                todayStr={todayStr}
                onAssignToBlock={assignToBlock}
              />
            </div>
          </div>
        )}
      </div>

      {/* Stop block dialog */}
      <AlertDialog open={!!stopDialogBlock} onOpenChange={open => { if (!open) setStopDialogBlock(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{stopDialogOpenTasks} Aufgabe{stopDialogOpenTasks !== 1 ? "n" : ""} noch offen</AlertDialogTitle>
            <AlertDialogDescription>Was soll mit den offenen Aufgaben passieren?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" size="sm" onClick={() => stopDialogBlock && stopAndMoveToBacklog(stopDialogBlock)}>
              Zurück ins Backlog
            </Button>
            {hasNextBlock && (
              <Button variant="outline" size="sm" onClick={() => stopDialogBlock && stopAndMoveToNext(stopDialogBlock)}>
                In nächsten Block
              </Button>
            )}
            <Button variant="default" size="sm" onClick={() => stopDialogBlock && doStopBlock(stopDialogBlock)}>
              Trotzdem abschließen
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
