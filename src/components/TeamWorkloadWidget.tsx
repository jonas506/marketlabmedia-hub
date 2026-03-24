import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  head_of_content: "HoC",
  cutter: "Cutter",
};

const AVATAR_GRADIENTS = [
  "from-primary to-secondary",
  "from-violet-500 to-pink-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-red-500",
];

const TeamWorkloadWidget = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["team-workload-widget"],
    queryFn: async () => {
      const [{ data: roles }, { data: profiles }, { data: pieces }, { data: tasks }] = await Promise.all([
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("profiles").select("user_id, name"),
        supabase.from("content_pieces").select("assigned_to, phase").in("phase", ["editing", "review"]),
        supabase.from("tasks").select("assigned_to, is_completed").eq("is_completed", false),
      ]);

      const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p.name]));

      return (roles ?? []).map((r, i) => {
        const editingCount = (pieces ?? []).filter((p) => p.assigned_to === r.user_id && p.phase === "editing").length;
        const reviewCount = (pieces ?? []).filter((p) => p.assigned_to === r.user_id && p.phase === "review").length;
        const taskCount = (tasks ?? []).filter((t) => t.assigned_to === r.user_id).length;
        const utilization = Math.round((editingCount / 3) * 100); // 3 = daily capacity estimate

        return {
          userId: r.user_id,
          name: profileMap.get(r.user_id) || "—",
          role: r.role as string,
          editingCount,
          reviewCount,
          taskCount,
          utilization,
          gradientIdx: i % AVATAR_GRADIENTS.length,
        };
      });
    },
  });

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 mb-5">
        <div className="h-5 w-32 animate-pulse bg-muted/40 rounded mb-3" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted/30" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-border bg-card overflow-hidden mb-5"
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-surface-elevated">
        <div className="w-1 h-5 rounded-full bg-primary" />
        <h3 className="text-sm font-display font-semibold">Team-Auslastung</h3>
        <Link to="/team" className="ml-auto text-[10px] font-mono text-primary hover:text-primary/80 transition-colors">
          Details →
        </Link>
      </div>

      <div className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 overflow-x-auto">
        {data.map((member, i) => {
          const isOverloaded = member.utilization > 100;
          const hasCapacity = member.utilization < 50;

          return (
            <motion.div
              key={member.userId}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Link
                to="/team"
                className="block rounded-lg border border-border p-3 hover:bg-surface-hover transition-colors min-w-[140px]"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn("h-7 w-7 rounded-full bg-gradient-to-br flex items-center justify-center text-[10px] font-bold text-white shrink-0", AVATAR_GRADIENTS[member.gradientIdx])}>
                    {member.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-body font-medium truncate">{member.name}</p>
                    <span className="text-[9px] font-mono text-muted-foreground">{ROLE_LABELS[member.role] || member.role}</span>
                  </div>
                </div>

                <div className="space-y-1 mb-2">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-status-working font-mono">{member.editingCount} im Schnitt</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground font-mono">{member.taskCount} Tasks</span>
                  </div>
                </div>

                {/* Utilization bar */}
                <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                  <motion.div
                    className={cn(
                      "h-full rounded-full",
                      isOverloaded ? "bg-destructive" : hasCapacity ? "bg-status-done" : "bg-status-working"
                    )}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(member.utilization, 100)}%` }}
                    transition={{ duration: 0.6, delay: 0.1 + i * 0.04 }}
                  />
                </div>
                <div className="flex items-center gap-1 mt-1">
                  {isOverloaded && <AlertTriangle className="h-3 w-3 text-destructive" />}
                  <span className={cn("text-[9px] font-mono", isOverloaded ? "text-destructive" : hasCapacity ? "text-status-done" : "text-muted-foreground")}>
                    {member.utilization}%
                  </span>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default TeamWorkloadWidget;
