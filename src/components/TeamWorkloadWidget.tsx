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
        const utilization = Math.round((editingCount / 3) * 100);

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
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="h-5 w-32 animate-pulse bg-muted/40 rounded mb-3" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-muted/30" />
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
      className="rounded-lg border border-border bg-card overflow-hidden"
    >
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <h3 className="text-sm font-semibold text-foreground">Team-Auslastung</h3>
        <Link to="/team" className="text-xs text-muted-foreground hover:text-primary transition-colors">
          Details →
        </Link>
      </div>

      <div className="px-5 pb-4">
        <div className="divide-y divide-border">
          {data.map((member, i) => {
            const isOverloaded = member.utilization > 100;
            const hasCapacity = member.utilization < 50;

            return (
              <Link
                key={member.userId}
                to="/team"
                className="flex items-center gap-4 py-3 hover:bg-surface-hover transition-colors -mx-5 px-5 first:pt-0"
              >
                <div className={cn("h-7 w-7 rounded-full bg-gradient-to-br flex items-center justify-center text-[10px] font-bold text-white shrink-0", AVATAR_GRADIENTS[member.gradientIdx])}>
                  {member.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>

                <div className="min-w-0 w-24">
                  <p className="text-xs font-medium truncate">{member.name}</p>
                  <span className="text-[10px] text-muted-foreground">{ROLE_LABELS[member.role] || member.role}</span>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="text-status-working">{member.editingCount} Schnitt</span>
                  <span>{member.taskCount} Tasks</span>
                </div>

                <div className="flex-1 flex items-center gap-2 ml-auto">
                  <div className="flex-1 h-2 rounded-full bg-muted/50 overflow-hidden">
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
                  <div className="flex items-center gap-1 w-12 justify-end">
                    {isOverloaded && <AlertTriangle className="h-3 w-3 text-destructive" />}
                    <span className={cn("text-[11px] tabular-nums", isOverloaded ? "text-destructive" : hasCapacity ? "text-status-done" : "text-muted-foreground")}>
                      {member.utilization}%
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export default TeamWorkloadWidget;
