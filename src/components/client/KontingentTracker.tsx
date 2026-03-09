import { Progress } from "@/components/ui/progress";
import RunwayBadge from "@/components/RunwayBadge";

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

  // "Ist" = pieces with phase "handed_over"
  const countByType = (type: string) =>
    monthPieces.filter((c) => c.type === type && c.phase === "handed_over").length;

  const types = [
    { label: "Reels", type: "reel", target: client.monthly_reels, current: countByType("reel") },
    { label: "Karussells", type: "carousel", target: client.monthly_carousels, current: countByType("carousel") },
    { label: "Stories", type: "story", target: client.monthly_stories, current: countByType("story") },
  ];

  // Runway only for reels + stories (no carousel dependency on shoot days)
  const reelStoryTarget = client.monthly_reels + client.monthly_stories;
  const dailyRate = reelStoryTarget / 30;

  const reelStoryPieces = monthPieces.filter((c) => c.type === "reel" || c.type === "story");

  // Gesichert: done + handed_over
  const conservative = reelStoryPieces.filter((c) => c.phase === "done" || c.phase === "handed_over").length;
  const conservativeDays = dailyRate > 0 ? Math.round(conservative / dailyRate) : 999;

  // Prognose: editing + done + handed_over
  const prognose = reelStoryPieces.filter((c) => c.phase === "editing" || c.phase === "done" || c.phase === "handed_over").length;
  const prognoseDays = dailyRate > 0 ? Math.round(prognose / dailyRate) : 999;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="font-mono text-xs font-semibold tracking-wider text-muted-foreground mb-4">KONTINGENT</h3>

      <div className="flex gap-6">
        <div className="flex-1 space-y-3">
          {types.map((t) => {
            const pct = t.target > 0 ? Math.min((t.current / t.target) * 100, 100) : 0;
            return (
              <div key={t.type} className="flex items-center gap-3">
                <span className="w-20 font-mono text-xs text-muted-foreground">{t.label}</span>
                <div className="flex-1">
                  <Progress value={pct} className="h-2" />
                </div>
                <span className="font-mono text-xs text-muted-foreground w-12 text-right">
                  {t.current}/{t.target}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex gap-4 border-l border-border pl-4">
          <div className="text-center">
            <span className="font-mono text-[10px] text-muted-foreground block mb-1">GESICHERT</span>
            <RunwayBadge days={conservativeDays} />
          </div>
          <div className="text-center">
            <span className="font-mono text-[10px] text-muted-foreground block mb-1">PROGNOSE</span>
            <RunwayBadge days={prognoseDays} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default KontingentTracker;
