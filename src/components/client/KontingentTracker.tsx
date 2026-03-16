import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import RunwayBadge from "@/components/RunwayBadge";
import { motion } from "framer-motion";
import { TrendingUp, Plus, Minus } from "lucide-react";
import { toast } from "sonner";

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

  const [opusCount, setOpusCount] = useState(0);
  const [overlayCount, setOverlayCount] = useState(0);

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
    const { error } = await supabase
      .from("contingent_extras")
      .upsert(
        { client_id: client.id, type, target_month: month, target_year: year, extra_count: count, updated_at: new Date().toISOString() },
        { onConflict: "client_id,type,target_month,target_year" }
      );
    if (!error) {
      qc.invalidateQueries({ queryKey: ["contingent-extras", client.id, month, year] });
    }
  }, [client.id, month, year, qc]);

  // Add reels by sub-type
  const addReelsByType = useMutation({
    mutationFn: async ({ opus, overlay }: { opus: number; overlay: number }) => {
      const rows: any[] = [];
      for (let i = 0; i < opus; i++) {
        rows.push({
          client_id: client.id,
          type: "reel",
          phase: "script",
          target_month: month,
          target_year: year,
          title: `Opus Pro Clip ${i + 1}`,
        });
      }
      for (let i = 0; i < overlay; i++) {
        rows.push({
          client_id: client.id,
          type: "reel",
          phase: "script",
          target_month: month,
          target_year: year,
          title: `Overlay Post ${i + 1}`,
        });
      }
      if (rows.length === 0) return 0;
      const { error } = await supabase.from("content_pieces").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => {
      if (count === 0) return;
      qc.invalidateQueries({ queryKey: ["content-pieces", client.id] });
      setOpusCount(0);
      setOverlayCount(0);
      toast.success(`🎬 ${count} Reels erstellt`, {
        description: `${opusCount > 0 ? `${opusCount} Opus Pro` : ""}${opusCount > 0 && overlayCount > 0 ? " + " : ""}${overlayCount > 0 ? `${overlayCount} Overlay` : ""}`,
      });
    },
    onError: (err: any) => {
      toast.error("Fehler beim Erstellen", { description: err.message });
    },
  });

  // "Ist" = pieces with phase "approved" or "handed_over"
  const countByType = (type: string) =>
    monthPieces.filter((c) => c.type === type && (c.phase === "approved" || c.phase === "handed_over")).length;

  const adsDone = countByType("ad");

  const ytTarget = client.monthly_youtube_longform ?? 0;
  const ytDone = countByType("youtube_longform");

  const types = [
    { label: "Reels", emoji: "🎬", type: "reel", target: client.monthly_reels, current: countByType("reel") },
    { label: "Karussells", emoji: "🖼️", type: "carousel", target: client.monthly_carousels, current: countByType("carousel") },
    { label: "Story Ads", emoji: "📱", type: "story", target: client.monthly_stories, current: countByType("story") },
    ...(ytTarget > 0 ? [{ label: "YouTube", emoji: "🎥", type: "youtube_longform", target: ytTarget, current: ytDone }] : []),
    ...(adsDone > 0 ? [{ label: "Ads", emoji: "📢", type: "ad", target: 0, current: adsDone }] : []),
  ];

  const reelStoryTarget = client.monthly_reels + client.monthly_stories;
  const dailyRate = reelStoryTarget / 30;

  const reelStoryPieces = monthPieces.filter((c) => c.type === "reel" || c.type === "story");

  const conservative = reelStoryPieces.filter((c) => c.phase === "approved" || c.phase === "handed_over").length
    + getExtra("reel") + getExtra("story");
  const conservativeDays = dailyRate > 0 ? Math.round(conservative / dailyRate) : 999;

  const prognose = reelStoryPieces.filter((c) => c.phase === "editing" || c.phase === "review" || c.phase === "approved" || c.phase === "handed_over").length
    + getExtra("reel") + getExtra("story");
  const prognoseDays = dailyRate > 0 ? Math.round(prognose / dailyRate) : 999;

  const totalTarget = client.monthly_reels + client.monthly_carousels + client.monthly_stories + (ytTarget > 0 ? ytTarget : 0);
  const totalDone = types.filter(t => t.type !== "ad").reduce((acc, t) => acc + t.current + getExtra(t.type), 0);
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
            const extra = getExtra(t.type);
            const totalCurrent = t.current + extra;
            const isAd = t.type === "ad";
            const pct = t.target > 0 ? Math.min((totalCurrent / t.target) * 100, 100) : isAd ? 100 : 0;
            const isComplete = t.target > 0 && totalCurrent >= t.target;
            return (
              <div key={t.type} className="flex items-center gap-3">
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
                  key={totalCurrent}
                  initial={{ scale: 1.3 }}
                  animate={{ scale: 1 }}
                  className={`font-mono text-sm font-bold w-14 text-right ${
                    isAd ? "text-violet-400" : isComplete ? "text-[hsl(var(--runway-green))]" : "text-foreground"
                  }`}
                >
                  {isAd ? totalCurrent : `${totalCurrent}/${t.target}`}
                </motion.span>
                {isComplete && <span className="text-sm">✅</span>}
                {/* Extra count input */}
                {canEdit && !isAd && (
                  <div className="flex items-center gap-1 ml-1" title="Extras (nicht in Pipeline)">
                    <Plus className="h-3 w-3 text-muted-foreground" />
                    <Input
                      type="number"
                      min={0}
                      value={extra}
                      onChange={(e) => updateExtra(t.type, parseInt(e.target.value) || 0)}
                      className="w-12 h-7 text-xs font-mono text-center px-1 bg-muted/50 border-border"
                      title="Zusätzliche Pieces außerhalb der Pipeline"
                    />
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

      {/* Opus Pro + Overlay Reel Creator */}
      {canEdit && (
        <div className="mt-5 pt-4 border-t border-border">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-[10px] text-muted-foreground tracking-wider uppercase">Reels erstellen</span>

            {/* Opus Pro Counter */}
            <div className="flex items-center rounded-lg border border-border bg-muted/20 overflow-hidden">
              <button
                onClick={() => setOpusCount(Math.max(0, opusCount - 1))}
                className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                <Minus className="h-3 w-3" />
              </button>
              <div className="flex items-center gap-1.5 px-2.5">
                <span className="text-sm font-bold font-mono tabular-nums text-foreground w-4 text-center">{opusCount}</span>
                <span className="text-[10px] text-muted-foreground font-medium whitespace-nowrap">Opus Pro</span>
              </div>
              <button
                onClick={() => setOpusCount(opusCount + 1)}
                className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>

            {/* Overlay Counter */}
            <div className="flex items-center rounded-lg border border-border bg-muted/20 overflow-hidden">
              <button
                onClick={() => setOverlayCount(Math.max(0, overlayCount - 1))}
                className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                <Minus className="h-3 w-3" />
              </button>
              <div className="flex items-center gap-1.5 px-2.5">
                <span className="text-sm font-bold font-mono tabular-nums text-foreground w-4 text-center">{overlayCount}</span>
                <span className="text-[10px] text-muted-foreground font-medium whitespace-nowrap">Overlay</span>
              </div>
              <button
                onClick={() => setOverlayCount(overlayCount + 1)}
                className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>

            {/* Create button */}
            <Button
              size="sm"
              className="gap-1.5 text-xs font-semibold ml-auto"
              disabled={addReelsByType.isPending || (opusCount === 0 && overlayCount === 0)}
              onClick={() => addReelsByType.mutate({ opus: opusCount, overlay: overlayCount })}
            >
              <Plus className="h-3.5 w-3.5" />
              {opusCount + overlayCount} Reels erstellen
            </Button>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default KontingentTracker;
