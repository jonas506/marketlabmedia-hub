import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Scissors, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  client_id: string;
  title: string;
  tag: string | null;
  assigned_to: string | null;
  deadline: string | null;
  is_completed: boolean;
  priority: string | null;
  status: string | null;
  created_at: string;
}

interface EditingPiece {
  id: string;
  client_id: string;
  title: string | null;
  type: string;
  phase: string;
  deadline: string | null;
}

interface Client { id: string; name: string; }

type UnifiedItem = { kind: "task"; data: Task } | { kind: "editing"; data: EditingPiece };

const TAG_COLORS: Record<string, string> = {
  skripte: "bg-blue-500/15 text-blue-500",
  "bild-ads": "bg-purple-500/15 text-purple-400",
  technik: "bg-amber-500/15 text-amber-400",
  admin: "bg-slate-500/15 text-slate-400",
  feedback: "bg-emerald-500/15 text-emerald-400",
  briefing: "bg-rose-500/15 text-rose-400",
};
const getTagColor = (tag: string) => TAG_COLORS[tag.toLowerCase()] || "bg-primary/15 text-primary";

const TYPE_LABELS: Record<string, string> = { reel: "Reel", story: "Story", carousel: "Karussell" };

const STATUS_LABELS: Record<string, { label: string; css: string }> = {
  not_started: { label: "Offen", css: "monday-status-default" },
  in_progress: { label: "Begonnen", css: "monday-status-working" },
  review: { label: "Besprechen", css: "monday-status-review" },
};

const MyTasks = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: tasks = [] } = useQuery({
    queryKey: ["my-tasks", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks" as any).select("*").eq("assigned_to", user!.id).eq("is_completed", false);
      if (error) throw error;
      return (data as any[]) as Task[];
    },
    enabled: !!user?.id,
  });

  const { data: editingPieces = [] } = useQuery({
    queryKey: ["my-editing-pieces", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("content_pieces").select("id, client_id, title, type, phase, deadline").eq("assigned_to", user!.id).eq("phase", "editing");
      if (error) throw error;
      return (data ?? []) as EditingPiece[];
    },
    enabled: !!user?.id,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-names"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name");
      if (error) throw error;
      return data as Client[];
    },
  });

  const clientMap = useMemo(() => {
    const map: Record<string, string> = {};
    clients.forEach((c) => (map[c.id] = c.name));
    return map;
  }, [clients]);

  const grouped = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const editingItems: UnifiedItem[] = editingPieces.map((p) => ({ kind: "editing", data: p }));
    const taskItems: UnifiedItem[] = tasks.map((t) => ({ kind: "task", data: t }));
    taskItems.sort((a, b) => {
      const aT = a.data as Task, bT = b.data as Task;
      const aO = aT.deadline && aT.deadline < today ? 0 : 1;
      const bO = bT.deadline && bT.deadline < today ? 0 : 1;
      if (aO !== bO) return aO - bO;
      if (aT.deadline && bT.deadline) return aT.deadline.localeCompare(bT.deadline);
      if (aT.deadline) return -1;
      if (bT.deadline) return 1;
      return 0;
    });
    const allItems = [...editingItems, ...taskItems];
    const groups: Record<string, UnifiedItem[]> = {};
    allItems.forEach((item) => {
      const cid = item.data.client_id;
      if (!groups[cid]) groups[cid] = [];
      groups[cid].push(item);
    });
    Object.values(groups).forEach((items) => {
      items.sort((a, b) => (a.kind === "editing" && b.kind !== "editing") ? -1 : (a.kind !== "editing" && b.kind === "editing") ? 1 : 0);
    });
    return groups;
  }, [tasks, editingPieces]);

  const completeTask = async (taskId: string, clientId: string) => {
    await supabase.from("tasks" as any).update({ is_completed: true, status: "done" } as any).eq("id", taskId);
    qc.invalidateQueries({ queryKey: ["my-tasks"] });
    qc.invalidateQueries({ queryKey: ["tasks", clientId] });
  };

  const totalCount = tasks.length + editingPieces.length;
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-surface-elevated border-b border-border">
        <div className="w-1 h-5 rounded-full bg-secondary" />
        <h3 className="font-display text-sm font-semibold">Meine Aufgaben</h3>
        <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">{totalCount}</span>
      </div>

      {totalCount === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground/40 font-mono">Keine offenen Aufgaben ✓</div>
      ) : (
        <div>
          <AnimatePresence mode="popLayout">
            {Object.entries(grouped).map(([clientId, items]) => (
              <motion.div key={clientId} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {/* Client group header */}
                <Link
                  to={`/client/${clientId}`}
                  className="monday-group-header border-b border-border/30 hover:bg-surface-hover transition-colors"
                >
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-display font-semibold">{clientMap[clientId] || "—"}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">{items.length}</span>
                </Link>

                {/* Items */}
                {items.map((item) => {
                  if (item.kind === "editing") {
                    const piece = item.data as EditingPiece;
                    return (
                      <div key={`p-${piece.id}`} className="monday-row flex items-center gap-3 px-4 py-2 pl-10">
                        <Scissors className="h-3 w-3 text-status-working shrink-0" />
                        <span className="monday-status monday-status-working text-[9px] py-0.5 px-2 min-w-0">Schnitt</span>
                        <Badge variant="secondary" className="text-[9px] font-mono px-1.5 py-0 h-[18px] rounded border-0 bg-muted/50 text-muted-foreground">
                          {TYPE_LABELS[piece.type] || piece.type}
                        </Badge>
                        <span className="flex-1 text-sm font-body truncate">{piece.title || "Ohne Titel"}</span>
                        {piece.deadline && (
                          <span className={cn("flex items-center gap-1 text-[11px] font-mono", piece.deadline < today ? "text-destructive font-semibold" : "text-muted-foreground")}>
                            <CalendarIcon className="h-3 w-3" />
                            {format(new Date(piece.deadline), "dd MMM", { locale: de })}
                          </span>
                        )}
                      </div>
                    );
                  }

                  const task = item.data as Task;
                  const isOverdue = task.deadline && task.deadline < today;
                  const sc = STATUS_LABELS[task.status || "not_started"] || STATUS_LABELS.not_started;

                  return (
                    <div key={`t-${task.id}`} className="monday-row flex items-center gap-3 px-4 py-2 pl-10">
                      <Checkbox checked={false} onCheckedChange={() => completeTask(task.id, task.client_id)} className="shrink-0" />
                      {task.tag && (
                        <Badge variant="secondary" className={cn("text-[9px] font-mono px-1.5 py-0 h-[18px] rounded border-0 shrink-0", getTagColor(task.tag))}>
                          {task.tag}
                        </Badge>
                      )}
                      <span className="monday-status text-[9px] py-0.5 px-2 min-w-0 shrink-0" style={{ minWidth: "auto" }}>
                        <span className={sc.css.replace("monday-status-", "bg-status-").replace("monday-status-default", "bg-status-default")} />
                      </span>
                      <span className={cn("monday-status text-[9px] py-0.5 min-w-0 shrink-0", sc.css)}>{sc.label}</span>
                      <span className="flex-1 text-sm font-body truncate">{task.title}</span>
                      {task.deadline && (
                        <span className={cn("flex items-center gap-1 text-[11px] font-mono shrink-0", isOverdue ? "text-destructive font-semibold" : "text-muted-foreground")}>
                          <CalendarIcon className="h-3 w-3" />
                          {format(new Date(task.deadline), "dd MMM", { locale: de })}
                        </span>
                      )}
                    </div>
                  );
                })}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default MyTasks;
