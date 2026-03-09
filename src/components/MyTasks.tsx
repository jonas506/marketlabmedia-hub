import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, ClipboardCheck } from "lucide-react";
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
  created_at: string;
}

interface Client {
  id: string;
  name: string;
}

const TAG_COLORS: Record<string, string> = {
  skripte: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  "bild-ads": "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  technik: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  admin: "bg-slate-500/15 text-slate-700 dark:text-slate-400",
  feedback: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  briefing: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
};

const getTagColor = (tag: string) => {
  const key = tag.toLowerCase();
  return TAG_COLORS[key] || "bg-primary/10 text-primary";
};

const MyTasks = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: tasks = [] } = useQuery({
    queryKey: ["my-tasks", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks" as any)
        .select("*")
        .eq("assigned_to", user!.id)
        .eq("is_completed", false)
        .order("deadline", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data as any[]) as Task[];
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
    const sorted = [...tasks].sort((a, b) => {
      // Overdue first
      const aOverdue = a.deadline && a.deadline < today ? 0 : 1;
      const bOverdue = b.deadline && b.deadline < today ? 0 : 1;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;
      // Then by deadline
      if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return 0;
    });

    const groups: Record<string, Task[]> = {};
    sorted.forEach((t) => {
      if (!groups[t.client_id]) groups[t.client_id] = [];
      groups[t.client_id].push(t);
    });
    return groups;
  }, [tasks]);

  const completeTask = async (taskId: string, clientId: string) => {
    await supabase.from("tasks" as any).update({ is_completed: true } as any).eq("id", taskId);
    qc.invalidateQueries({ queryKey: ["my-tasks"] });
    qc.invalidateQueries({ queryKey: ["tasks", clientId] });
  };

  const totalCount = tasks.length;

  if (totalCount === 0) return null;

  const today = new Date().toISOString().split("T")[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card p-5 shadow-lg"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10">
          <ClipboardCheck className="h-4 w-4 text-primary" />
        </div>
        <h3 className="font-display text-lg font-semibold tracking-tight">Meine Aufgaben</h3>
        <span className="font-mono text-xs text-muted-foreground">{totalCount} offen</span>
      </div>

      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {Object.entries(grouped).map(([clientId, clientTasks]) => (
            <motion.div
              key={clientId}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Link
                to={`/client/${clientId}`}
                className="text-xs font-mono font-semibold text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider mb-2 block"
              >
                {clientMap[clientId] || "Unbekannt"} →
              </Link>
              <div className="space-y-1">
                {clientTasks.map((task) => {
                  const isOverdue = task.deadline && task.deadline < today;
                  return (
                    <motion.div
                      key={task.id}
                      layout
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 16, transition: { duration: 0.15 } }}
                      className="flex items-center gap-3 rounded-lg border border-border p-2.5 hover:border-primary/20 hover:bg-card/80 transition-all"
                    >
                      <Checkbox
                        checked={false}
                        onCheckedChange={() => completeTask(task.id, task.client_id)}
                      />

                      {task.tag && (
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[10px] font-mono px-2 py-0.5 rounded-md border-0 shrink-0",
                            getTagColor(task.tag)
                          )}
                        >
                          {task.tag}
                        </Badge>
                      )}

                      <span className="flex-1 text-sm font-body">{task.title}</span>

                      {task.deadline && (
                        <span
                          className={cn(
                            "flex items-center gap-1 text-xs font-mono shrink-0",
                            isOverdue
                              ? "text-destructive font-semibold"
                              : "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="h-3 w-3" />
                          {format(new Date(task.deadline), "dd.MM.", { locale: de })}
                        </span>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default MyTasks;
