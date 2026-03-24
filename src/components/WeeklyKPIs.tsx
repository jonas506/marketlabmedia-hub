import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle, CheckCircle2, Eye, Clock, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const WeeklyKPIs = () => {
  const { role } = useAuth();
  if (role !== "admin" && role !== "head_of_content") return null;

  const { data: kpis } = useQuery({
    queryKey: ["weekly-kpis"],
    queryFn: async () => {
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      const { month, year } = { month: today.getMonth() + 1, year: today.getFullYear() };

      const [{ data: pieces }, { data: clients }] = await Promise.all([
        supabase.from("content_pieces").select("id, client_id, phase, type, deadline, target_month, target_year"),
        supabase.from("clients").select("id, name, monthly_reels, monthly_carousels, monthly_stories").eq("status", "active"),
      ]);

      const allPieces = pieces ?? [];
      const activeClients = clients ?? [];

      // Overdue pieces (have deadline, deadline < today, not handed_over/approved)
      const overdue = allPieces.filter(
        (p) => p.deadline && p.deadline < todayStr && !["approved", "handed_over"].includes(p.phase)
      );

      // Awaiting review
      const awaitingReview = allPieces.filter((p) => p.phase === "review");

      // Currently in editing
      const inEditing = allPieces.filter((p) => p.phase === "editing");

      // Handed over this month
      const handedOver = allPieces.filter(
        (p) => p.phase === "handed_over" && p.target_month === month && p.target_year === year
      );

      // Total target this month
      const totalTarget = activeClients.reduce(
        (sum, c) => sum + c.monthly_reels + c.monthly_carousels, 0
      );

      // Clients with low runway (< 7 days worth)
      const lowRunwayClients = activeClients.filter((client) => {
        const clientPieces = allPieces.filter((p) => p.client_id === client.id);
        const reelTarget = client.monthly_reels;
        const dailyFreq = reelTarget / 30;
        const readyPieces = clientPieces.filter(
          (p) => p.type === "reel" && (p.phase === "approved" || p.phase === "handed_over") &&
          p.target_month === month && p.target_year === year
        ).length;
        const runway = dailyFreq > 0 ? Math.round(readyPieces / dailyFreq) : 999;
        return runway < 7;
      });

      return {
        overdue: overdue.length,
        awaitingReview: awaitingReview.length,
        inEditing: inEditing.length,
        handedOver: handedOver.length,
        totalTarget,
        lowRunwayClients: lowRunwayClients.length,
        activeClients: activeClients.length,
      };
    },
  });

  if (!kpis) return null;

  const cards = [
    {
      label: "Überfällig",
      value: kpis.overdue,
      icon: AlertTriangle,
      color: kpis.overdue > 0 ? "text-destructive" : "text-muted-foreground",
      bg: kpis.overdue > 0 ? "bg-destructive/10 border-destructive/20" : "bg-muted/30 border-border",
    },
    {
      label: "Zur Freigabe",
      value: kpis.awaitingReview,
      icon: Eye,
      color: kpis.awaitingReview > 0 ? "text-status-review" : "text-muted-foreground",
      bg: kpis.awaitingReview > 0 ? "bg-status-review/10 border-status-review/20" : "bg-muted/30 border-border",
    },
    {
      label: "Im Schnitt",
      value: kpis.inEditing,
      icon: Clock,
      color: "text-status-working",
      bg: "bg-status-working/10 border-status-working/20",
    },
    {
      label: "Übergeben",
      value: `${kpis.handedOver}/${kpis.totalTarget}`,
      icon: CheckCircle2,
      color: "text-status-done",
      bg: "bg-status-done/10 border-status-done/20",
    },
    {
      label: "Niedriger Runway",
      value: `${kpis.lowRunwayClients}/${kpis.activeClients}`,
      icon: TrendingUp,
      color: kpis.lowRunwayClients > 0 ? "text-destructive" : "text-status-done",
      bg: kpis.lowRunwayClients > 0 ? "bg-destructive/10 border-destructive/20" : "bg-status-done/10 border-status-done/20",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-5">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          className={cn("rounded-lg border px-3 py-2.5 flex items-center gap-3", card.bg)}
        >
          <card.icon className={cn("h-4 w-4 shrink-0", card.color)} />
          <div>
            <span className={cn("font-mono text-lg font-bold block leading-tight", card.color)}>{card.value}</span>
            <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">{card.label}</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default WeeklyKPIs;
