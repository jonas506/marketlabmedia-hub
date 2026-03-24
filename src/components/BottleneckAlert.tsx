import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { AlertTriangle, Clock, Flame, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Alert {
  severity: "critical" | "warning" | "info";
  icon: React.ReactNode;
  text: string;
  link?: string;
}

const SEVERITY_STYLES = {
  critical: "bg-destructive/10 border-destructive/20 text-destructive",
  warning: "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400",
  info: "bg-primary/10 border-primary/20 text-primary",
};

const BottleneckAlert = () => {
  const { data: alerts = [] } = useQuery({
    queryKey: ["bottleneck-alerts"],
    queryFn: async (): Promise<Alert[]> => {
      const todayStr = new Date().toISOString().split("T")[0];
      const now = new Date();
      const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();

      const [{ data: pieces }, { data: clients }, { data: profiles }] = await Promise.all([
        supabase.from("content_pieces").select("id, client_id, phase, deadline, assigned_to, updated_at"),
        supabase.from("clients").select("id, name, monthly_reels").eq("status", "active"),
        supabase.from("profiles").select("user_id, name"),
      ]);

      const allPieces = pieces ?? [];
      const activeClients = clients ?? [];
      const allProfiles = profiles ?? [];
      const result: Alert[] = [];

      // 1. Overdue pieces
      const overdue = allPieces.filter(
        (p) => p.deadline && p.deadline < todayStr && !["approved", "handed_over"].includes(p.phase)
      );
      if (overdue.length > 0) {
        result.push({
          severity: "critical",
          icon: <AlertTriangle className="h-4 w-4 shrink-0" />,
          text: `🚨 ${overdue.length} Piece${overdue.length > 1 ? "s" : ""} ${overdue.length > 1 ? "sind" : "ist"} überfällig`,
          link: "/tasks",
        });
      }

      // 2. Clients with runway < 3 days
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      activeClients.forEach((client) => {
        const reelTarget = client.monthly_reels;
        const dailyFreq = reelTarget / 30;
        if (dailyFreq <= 0) return;
        const readyPieces = allPieces.filter(
          (p) => p.client_id === client.id && (p.phase === "approved" || p.phase === "handed_over")
        ).length;
        const runway = Math.round(readyPieces / dailyFreq);
        if (runway < 3) {
          result.push({
            severity: "critical",
            icon: <AlertCircle className="h-4 w-4 shrink-0" />,
            text: `⚠️ ${client.name} hat nur noch ${runway} Tage Runway`,
            link: `/client/${client.id}`,
          });
        }
      });

      // 3. Pieces in review > 5 days
      const staleReview = allPieces.filter(
        (p) => p.phase === "review" && p.updated_at && p.updated_at < fiveDaysAgo
      );
      if (staleReview.length > 0) {
        result.push({
          severity: "warning",
          icon: <Clock className="h-4 w-4 shrink-0" />,
          text: `⏳ ${staleReview.length} Piece${staleReview.length > 1 ? "s warten" : " wartet"} seit über 5 Tagen auf Freigabe`,
        });
      }

      // 4. Cutter with > 8 pieces in editing
      const editingByUser: Record<string, number> = {};
      allPieces.filter((p) => p.phase === "editing" && p.assigned_to).forEach((p) => {
        editingByUser[p.assigned_to!] = (editingByUser[p.assigned_to!] || 0) + 1;
      });
      const profileMap = new Map(allProfiles.map((p) => [p.user_id, p.name]));
      Object.entries(editingByUser).forEach(([userId, count]) => {
        if (count > 8) {
          result.push({
            severity: "warning",
            icon: <Flame className="h-4 w-4 shrink-0" />,
            text: `🔥 ${profileMap.get(userId) || "Unbekannt"} hat ${count} Pieces im Schnitt — Überlastung?`,
            link: "/team",
          });
        }
      });

      // Sort by severity, take top 3
      const order = { critical: 0, warning: 1, info: 2 };
      return result.sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 3);
    },
  });

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2 mb-5">
      {alerts.map((alert, i) => {
        const content = (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={cn("rounded-lg border px-4 py-3 flex items-center gap-3 text-sm font-body", SEVERITY_STYLES[alert.severity])}
          >
            {alert.icon}
            <span className="flex-1">{alert.text}</span>
            {alert.link && (
              <span className="text-xs font-mono opacity-70">Anzeigen →</span>
            )}
          </motion.div>
        );
        return alert.link ? <Link key={i} to={alert.link}>{content}</Link> : content;
      })}
    </div>
  );
};

export default BottleneckAlert;
