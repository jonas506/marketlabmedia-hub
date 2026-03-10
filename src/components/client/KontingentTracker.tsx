import { Progress } from "@/components/ui/progress";
import RunwayBadge from "@/components/RunwayBadge";
import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";

interface ContentPiece {
  phase: string;
  type: string;
  target_month: number;
  target_year: number;
}

interface KontingentTrackerProps {
  client: any;
  contentPieces: ContentPiece[];
  month: number;
  year: number;
}

const KontingentTracker: React.FC<KontingentTrackerProps> = ({ client, contentPieces = [], month, year }) => {
  const monthPieces = (contentPieces ?? []).filter((c) => c.target_month === month && c.target_year === year);

  // "Ist" = pieces with phase "approved" or "handed_over" (ab Freigegeben zählt es)
  const countByType = (type: string) =>
    monthPieces.filter((c) => c.type === type && (c.phase === "approved" || c.phase === "handed_over")).length;

  const adsDone = countByType("ad");

  const types = [
    { label: "Reels", emoji: "🎬", type: "reel", target: client.monthly_reels, current: countByType("reel") },
    { label: "Karussells", emoji: "🖼️", type: "carousel", target: client.monthly_carousels, current: countByType("carousel") },
    { label: "Stories", emoji: "📱", type: "story", target: client.monthly_stories, current: countByType("story") },
    ...(adsDone > 0 ? [{ label: "Ads", emoji: "📢", type: "ad", target: 0, current: adsDone }] : []),
  ];

  const reelStoryTarget = client.monthly_reels + client.monthly_stories;
  const dailyRate = reelStoryTarget / 30;

  const reelStoryPieces = monthPieces.filter((c) => c.type === "reel" || c.type === "story");

  const conservative = reelStoryPieces.filter((c) => c.phase === "approved" || c.phase === "handed_over").length;
  const conservativeDays = dailyRate > 0 ? Math.round(conservative / dailyRate) : 999;

  const prognose = reelStoryPieces.filter((c) => c.phase === "editing" || c.phase === "review" || c.phase === "approved" || c.phase === "handed_over").length;
  const prognoseDays = dailyRate > 0 ? Math.round(prognose / dailyRate) : 999;

  const totalTarget = client.monthly_reels + client.monthly_carousels + client.monthly_stories;
  const totalDone = types.reduce((acc, t) => acc + t.current, 0);
  const overallPct = totalTarget > 0 ? Math.round((totalDone / totalTarget) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card p-5 shadow-lg"
    >
      <div className="flex items-center gap-2 mb-5">
        <TrendingUp className="h-4 w-4 text-primary" />
        <h3 className="font-mono text-xs font-semibold tracking-wider text-muted-foreground">KONTINGENT</h3>
        <div className="flex-1" />
        <motion.span
          key={overallPct}
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
          className={`font-mono text-sm font-bold ${overallPct >= 100 ? "text-[hsl(var(--runway-green))]" : "text-foreground"}`}
        >
          {overallPct}%
        </motion.span>
      </div>

      <div className="flex gap-6">
        <div className="flex-1 space-y-4">
          {types.map((t) => {
            const pct = t.target > 0 ? Math.min((t.current / t.target) * 100, 100) : 0;
            const isComplete = t.current >= t.target && t.target > 0;
            return (
              <div key={t.type} className="flex items-center gap-3">
                <span className="text-base w-6">{t.emoji}</span>
                <span className="w-20 font-mono text-xs text-muted-foreground">{t.label}</span>
                <div className="flex-1 relative">
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${
                        isComplete
                          ? "bg-gradient-to-r from-[hsl(var(--runway-green))] to-[hsl(145,63%,50%)]"
                          : "bg-gradient-to-r from-primary to-primary/70"
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                    />
                  </div>
                </div>
                <motion.span
                  key={t.current}
                  initial={{ scale: 1.3 }}
                  animate={{ scale: 1 }}
                  className={`font-mono text-sm font-bold w-14 text-right ${
                    isComplete ? "text-[hsl(var(--runway-green))]" : "text-foreground"
                  }`}
                >
                  {t.current}/{t.target}
                </motion.span>
                {isComplete && <span className="text-sm">✅</span>}
              </div>
            );
          })}
        </div>

        <div className="flex gap-5 border-l border-border pl-5">
          <div className="text-center">
            <span className="font-mono text-[10px] text-muted-foreground block mb-1.5 tracking-wider">GESICHERT</span>
            <RunwayBadge days={conservativeDays} />
          </div>
          <div className="text-center">
            <span className="font-mono text-[10px] text-muted-foreground block mb-1.5 tracking-wider">PROGNOSE</span>
            <RunwayBadge days={prognoseDays} />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default KontingentTracker;
