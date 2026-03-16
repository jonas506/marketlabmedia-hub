import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import RunwayBadge from "@/components/RunwayBadge";
import { motion } from "framer-motion";
import { TrendingUp, Plus, Minus } from "lucide-react";

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
  canEdit?: boolean;
}

const KontingentTracker: React.FC<KontingentTrackerProps> = ({ client, contentPieces = [], month, year, canEdit = false }) => {
  const qc = useQueryClient();
  const monthPieces = (contentPieces ?? []).filter((c) => c.target_month === month && c.target_year === year);

  // Fetch extra counts
  const { data: extras } = useQuery({
    queryKey: ["contingent-extras", client.id, month, year],
    queryFn: async () => {
      const { data } = await supabase
        .from("contingent_extras")
        .select("type, extra_count")
        .eq("client_id", client.id)
        .eq("target_month", month)
        .eq("target_year", year);
      return data ?? [];
    },
  });

  const getExtra = (type: string) => extras?.find((e) => e.type === type)?.extra_count ?? 0;

  const updateExtra = useCallback(async (type: string, value: number) => {
    const count = Math.max(0, value);
    const queryKey = ["contingent-extras", client.id, month, year];

    // Optimistic update – instant UI
    qc.setQueryData(queryKey, (old: any[] | undefined) => {
      const arr = old ?? [];
      const existing = arr.find((e: any) => e.type === type);
      if (existing) {
        return arr.map((e: any) => e.type === type ? { ...e, extra_count: count } : e);
      }
      return [...arr, { type, extra_count: count }];
    });

    // Fire-and-forget DB save
    supabase
      .from("contingent_extras")
      .upsert(
        { client_id: client.id, type, target_month: month, target_year: year, extra_count: count, updated_at: new Date().toISOString() },
        { onConflict: "client_id,type,target_month,target_year" }
      )
      .then(({ error }) => {
        if (error) qc.invalidateQueries({ queryKey });
      });
  }, [client.id, month, year, qc]);

  // "Ist" = pieces with phase "approved" or "handed_over"
  const countByType = (type: string) =>
    monthPieces.filter((c) => c.type === type && (c.phase === "approved" || c.phase === "handed_over")).length;

  const adsDone = countByType("ad");
  const ytTarget = client.monthly_youtube_longform ?? 0;
  const ytDone = countByType("youtube_longform");

  // Reel extras: pipeline pieces + generic extra + opus_pro + overlay
  const reelPipelineDone = countByType("reel");
  const reelGenericExtra = getExtra("reel");
  const opusProCount = getExtra("opus_pro");
  const overlayCount = getExtra("overlay");
  const bereitsGeplantCount = getExtra("bereits_geplant");
  const reelTotalCurrent = reelPipelineDone + reelGenericExtra + opusProCount + overlayCount + bereitsGeplantCount;

  const types = [
    { label: "Reels", emoji: "🎬", type: "reel", target: client.monthly_reels, current: reelTotalCurrent },
    { label: "Karussells", emoji: "🖼️", type: "carousel", target: client.monthly_carousels, current: countByType("carousel") + getExtra("carousel") },
    { label: "Story Ads", emoji: "📱", type: "story", target: client.monthly_stories, current: countByType("story") + getExtra("story") },
    ...(ytTarget > 0 ? [{ label: "YouTube", emoji: "🎥", type: "youtube_longform", target: ytTarget, current: ytDone + getExtra("youtube_longform") }] : []),
    ...(adsDone > 0 ? [{ label: "Ads", emoji: "📢", type: "ad", target: 0, current: adsDone }] : []),
  ];

  const reelStoryTarget = client.monthly_reels + client.monthly_stories;
  const dailyRate = reelStoryTarget / 30;

  const reelStoryPieces = monthPieces.filter((c) => c.type === "reel" || c.type === "story");

  const conservative = reelStoryPieces.filter((c) => c.phase === "approved" || c.phase === "handed_over").length
    + getExtra("reel") + getExtra("story") + opusProCount + overlayCount + bereitsGeplantCount;
  const conservativeDays = dailyRate > 0 ? Math.round(conservative / dailyRate) : 999;

  const prognose = reelStoryPieces.filter((c) => c.phase === "editing" || c.phase === "review" || c.phase === "approved" || c.phase === "handed_over").length
    + getExtra("reel") + getExtra("story") + opusProCount + overlayCount + bereitsGeplantCount;
  const prognoseDays = dailyRate > 0 ? Math.round(prognose / dailyRate) : 999;

  const totalTarget = client.monthly_reels + client.monthly_carousels + client.monthly_stories + (ytTarget > 0 ? ytTarget : 0);
  const totalDone = types.filter(t => t.type !== "ad").reduce((acc, t) => acc + t.current, 0);
  const overallPct = totalTarget > 0 ? Math.round((totalDone / totalTarget) * 100) : 0;

  // Stepper component for opus/overlay
  const Stepper = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => (
    <div className="flex items-center rounded-lg border border-border bg-muted/20 overflow-hidden">
      <button
        onClick={() => onChange(Math.max(0, value - 1))}
        className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
      >
        <Minus className="h-3 w-3" />
      </button>
      <div className="flex items-center gap-1.5 px-2.5">
        <motion.span
          key={value}
          initial={{ scale: 1.3 }}
          animate={{ scale: 1 }}
          className="text-sm font-bold font-mono tabular-nums text-foreground w-4 text-center"
        >
          {value}
        </motion.span>
        <span className="text-[10px] text-muted-foreground font-medium whitespace-nowrap">{label}</span>
      </div>
      <button
        onClick={() => onChange(value + 1)}
        className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );

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
            const isAd = t.type === "ad";
            const isReel = t.type === "reel";
            const pct = t.target > 0 ? Math.min((t.current / t.target) * 100, 100) : isAd ? 100 : 0;
            const isComplete = t.target > 0 && t.current >= t.target;
            return (
              <div key={t.type} className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-base w-6">{t.emoji}</span>
                  <span className="w-20 font-mono text-xs text-muted-foreground">{t.label}</span>
                  <div className="flex-1 relative">
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${
                          isAd
                            ? "bg-gradient-to-r from-violet-500 to-violet-400"
                            : isComplete
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
                      isAd ? "text-violet-400" : isComplete ? "text-[hsl(var(--runway-green))]" : "text-foreground"
                    }`}
                  >
                    {isAd ? t.current : `${t.current}/${t.target}`}
                  </motion.span>
                  {isComplete && <span className="text-sm">✅</span>}
                  {/* Generic extra count input (non-reel, non-ad types) */}
                  {canEdit && !isAd && !isReel && (
                    <div className="flex items-center gap-1 ml-1" title="Extras (nicht in Pipeline)">
                      <Plus className="h-3 w-3 text-muted-foreground" />
                      <Input
                        type="number"
                        min={0}
                        value={getExtra(t.type)}
                        onChange={(e) => updateExtra(t.type, parseInt(e.target.value) || 0)}
                        className="w-12 h-7 text-xs font-mono text-center px-1 bg-muted/50 border-border"
                        title="Zusätzliche Pieces außerhalb der Pipeline"
                      />
                    </div>
                  )}
                </div>

                {/* Opus Pro + Overlay steppers for Reels */}
                {isReel && canEdit && (
                  <div className="flex items-center gap-2 ml-9 pl-20">
                    <Stepper label="Opus Pro" value={opusProCount} onChange={(v) => updateExtra("opus_pro", v)} />
                    <Stepper label="Overlay" value={overlayCount} onChange={(v) => updateExtra("overlay", v)} />
                    <Stepper label="Bereits geplant" value={bereitsGeplantCount} onChange={(v) => updateExtra("bereits_geplant", v)} />
                    {reelGenericExtra > 0 && (
                      <div className="flex items-center gap-1 ml-1" title="Sonstige Reel-Extras">
                        <Plus className="h-3 w-3 text-muted-foreground" />
                        <Input
                          type="number"
                          min={0}
                          value={reelGenericExtra}
                          onChange={(e) => updateExtra("reel", parseInt(e.target.value) || 0)}
                          className="w-12 h-7 text-xs font-mono text-center px-1 bg-muted/50 border-border"
                          title="Sonstige Reel-Extras"
                        />
                      </div>
                    )}
                  </div>
                )}
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
