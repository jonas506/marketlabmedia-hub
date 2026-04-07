import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { Task } from "@/components/tasks/constants";
import { TimeBlockData, BLOCK_TYPES, DURATION_PRESETS, BlockType, getBlockType } from "./constants";
import TimeBlock from "./TimeBlock";
import FocusBacklog from "./FocusBacklog";

interface Props {
  tasks: Task[];
  clientMap: Record<string, string>;
  todayStr: string;
}

export default function FocusMode({ tasks, clientMap, todayStr }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [blocks, setBlocks] = useState<TimeBlockData[]>([]);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [selectedType, setSelectedType] = useState<BlockType | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mobileBacklogOpen, setMobileBacklogOpen] = useState(false);

  // Load plan
  const { data: plan } = useQuery({
    queryKey: ["daily-plan", user?.id, todayStr],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("daily_plans" as any)
        .select("*")
        .eq("user_id", user.id)
        .eq("date", todayStr)
        .maybeSingle();
      return data as any;
    },
    enabled: !!user,
  });

  // Initialize blocks from plan
  useEffect(() => {
    if (plan?.blocks) {
      const b = (typeof plan.blocks === "string" ? JSON.parse(plan.blocks) : plan.blocks) as TimeBlockData[];
      setBlocks(b);
      const active = b.find(bl => bl.started_at && !bl.completed_at);
      setActiveBlockId(active?.id ?? null);
    }
  }, [plan]);

  // Save plan (debounced)
  const savePlan = useCallback((newBlocks: TimeBlockData[]) => {
    if (!user) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await supabase.from("daily_plans" as any).upsert({
        user_id: user.id,
        date: todayStr,
        blocks: newBlocks,
      } as any, { onConflict: "user_id,date" });
    }, 500);
  }, [user, todayStr]);

  const updateBlocks = useCallback((newBlocks: TimeBlockData[]) => {
    setBlocks(newBlocks);
    savePlan(newBlocks);
  }, [savePlan]);

  // Create block
  const createBlock = (type: BlockType, duration: number) => {
    const bt = getBlockType(type);
    const newBlock: TimeBlockData = {
      id: crypto.randomUUID(),
      type,
      label: bt.label,
      duration_minutes: duration,
      task_ids: [],
      started_at: null,
      completed_at: null,
      sort_order: blocks.length,
    };
    updateBlocks([...blocks, newBlock]);
    setShowAddBlock(false);
    setSelectedType(null);
  };

  // Start block
  const startBlock = (blockId: string) => {
    const newBlocks = blocks.map(b =>
      b.id === blockId ? { ...b, started_at: new Date().toISOString() } : b
    );
    setActiveBlockId(blockId);
    updateBlocks(newBlocks);

    // Set timer for block end
    const block = blocks.find(b => b.id === blockId)!;
    setTimeout(() => {
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
      toast("⏰ Block beendet!", { description: `${block.label} ist abgelaufen` });
    }, block.duration_minutes * 60 * 1000);
  };

  // Stop block
  const stopBlock = (blockId: string) => {
    const newBlocks = blocks.map(b =>
      b.id === blockId ? { ...b, completed_at: new Date().toISOString() } : b
    );
    setActiveBlockId(null);
    updateBlocks(newBlocks);
  };

  // Delete block
  const deleteBlock = (blockId: string) => {
    updateBlocks(blocks.filter(b => b.id !== blockId));
  };

  // Complete task
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

  // Assign task to block
  const assignToBlock = (taskId: string, blockId: string) => {
    const newBlocks = blocks.map(b => {
      // Remove from any other block first
      const filtered = b.task_ids.filter(id => id !== taskId);
      if (b.id === blockId) return { ...b, task_ids: [...filtered, taskId] };
      return { ...b, task_ids: filtered };
    });
    updateBlocks(newBlocks);
  };

  // Remove task from block
  const removeFromBlock = (blockId: string, taskId: string) => {
    const newBlocks = blocks.map(b =>
      b.id === blockId ? { ...b, task_ids: b.task_ids.filter(id => id !== taskId) } : b
    );
    updateBlocks(newBlocks);
  };

  // Reorder tasks within block
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

  // Reorder blocks
  const blockDragRef = useRef<string | null>(null);

  const handleBlockDragStart = (e: React.DragEvent, blockId: string) => {
    blockDragRef.current = blockId;
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

  const dateFormatted = format(new Date(todayStr), "EEEE, d. MMMM yyyy", { locale: de });

  return (
    <div className="space-y-4">
      {/* Date header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground capitalize">Heute: {dateFormatted}</p>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowAddBlock(true)}>
          <Plus className="h-3 w-3 mr-1" /> Block
        </Button>
      </div>

      {/* Quick add block */}
      {showAddBlock && (
        <div className="p-3 rounded-xl border bg-card space-y-3">
          {!selectedType ? (
            <div className="flex gap-2 flex-wrap">
              {BLOCK_TYPES.map(bt => (
                <button
                  key={bt.value}
                  onClick={() => setSelectedType(bt.value)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-muted/50 transition-colors text-sm"
                  style={{ borderColor: bt.color + "40" }}
                >
                  <span>{bt.icon}</span>
                  <span className="font-medium">{bt.label}</span>
                </button>
              ))}
              <button onClick={() => setShowAddBlock(false)} className="text-xs text-muted-foreground px-2">
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
                    className="px-3 py-1.5 rounded-lg border hover:bg-primary hover:text-primary-foreground transition-colors text-sm font-mono"
                  >
                    {dp.label}
                  </button>
                ))}
                <button onClick={() => { setSelectedType(null); }} className="text-xs text-muted-foreground px-2">
                  Zurück
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick templates */}
      {blocks.length === 0 && !showAddBlock && (
        <div className="p-4 rounded-xl border border-dashed bg-card/50 text-center space-y-3">
          <p className="text-sm text-muted-foreground">Plane deinen Tag mit Zeitblöcken</p>
          <div className="flex gap-2 justify-center flex-wrap">
            <button
              onClick={() => createBlock("fokus", 120)}
              className="px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-500 text-sm font-medium hover:bg-blue-500/20 transition-colors"
            >
              🎯 Fokus 2h
            </button>
            <button
              onClick={() => createBlock("admin", 60)}
              className="px-3 py-1.5 rounded-lg bg-gray-500/10 text-gray-400 text-sm font-medium hover:bg-gray-500/20 transition-colors"
            >
              📋 Admin 1h
            </button>
            <button
              onClick={() => createBlock("content", 90)}
              className="px-3 py-1.5 rounded-lg bg-green-500/10 text-green-500 text-sm font-medium hover:bg-green-500/20 transition-colors"
            >
              ✏️ Content 1.5h
            </button>
          </div>
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
              onStart={() => startBlock(block.id)}
              onStop={() => stopBlock(block.id)}
              onDelete={() => deleteBlock(block.id)}
              onCompleteTask={completeTask}
              onRemoveTask={taskId => removeFromBlock(block.id, taskId)}
              onDragOver={e => { e.preventDefault(); }}
              onDrop={e => handleBlockDrop(e, block.id)}
              onReorder={(from, to) => reorderInBlock(block.id, from, to)}
              dragHandleProps={{
                draggable: true,
                onDragStart: e => handleBlockDragStart(e, block.id),
              }}
            />
          ))}

          {/* Summary */}
          {completedBlocks.length > 0 && (
            <div className="p-4 rounded-xl border bg-card/50 space-y-1.5">
              <p className="text-sm font-semibold flex items-center gap-2">📊 Heute geschafft</p>
              <p className="text-xs text-muted-foreground">
                ✅ {completedTaskCount} von {totalPlannedTasks} Aufgaben erledigt
              </p>
              <p className="text-xs text-muted-foreground">
                ⏱ {Math.floor(totalMinutesPlanned / 60)}h {totalMinutesPlanned % 60 > 0 ? `${totalMinutesPlanned % 60}min ` : ""}geplante Zeit
              </p>
              <p className="text-xs text-muted-foreground">
                {minutesByType
                  .filter(m => m.minutes > 0)
                  .map(m => `${m.icon} ${m.label}: ${m.minutes >= 60 ? `${Math.floor(m.minutes / 60)}h` : ""}${m.minutes % 60 > 0 ? `${m.minutes % 60}min` : ""}`)
                  .join(" | ")}
              </p>
            </div>
          )}
        </div>

        {/* Backlog column */}
        <div className="md:w-[40%]">
          {/* Mobile toggle */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileBacklogOpen(!mobileBacklogOpen)}
              className="w-full text-sm text-muted-foreground font-medium py-2 flex items-center justify-center gap-1"
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
      </div>
    </div>
  );
}
