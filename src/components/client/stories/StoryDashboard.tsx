import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Eye, MousePointerClick, TrendingUp, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useCategories } from "./useCategories";
import { COLOR_CLASSES } from "./constants";
import type { Sequence, Slide, Tracking } from "./constants";

interface StoryDashboardProps {
  clientId: string;
}

function KPICard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-muted/30 rounded-lg p-2.5">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">{icon}<span className="text-[9px]">{label}</span></div>
      <p className="font-mono font-bold text-sm">{value}</p>
    </div>
  );
}

function MiniStat({ label, value, isText }: { label: string; value: number | string; isText?: boolean }) {
  return (
    <div className="text-center">
      <p className="font-mono font-bold text-xs">{isText ? value : typeof value === "number" ? value.toLocaleString("de-DE") : value}</p>
      <p className="text-[8px] text-muted-foreground">{label}</p>
    </div>
  );
}

const StoryDashboard: React.FC<StoryDashboardProps> = React.memo(({ clientId }) => {
  const { data: categories = [] } = useCategories(clientId);
  const [filterCat, setFilterCat] = useState<string | null>(null);

  const { data: sequences = [] } = useQuery({
    queryKey: ["story-sequences", clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from("story_sequences" as any).select("*").eq("client_id", clientId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Sequence[];
    },
  });

  const postedSeqs = sequences.filter(s => s.status === "posted" || s.status === "tracked");
  const filteredSeqs = filterCat ? postedSeqs.filter(s => s.category_id === filterCat) : postedSeqs;

  const { data: allSlides = [] } = useQuery({
    queryKey: ["story-all-slides", clientId],
    queryFn: async () => {
      const seqIds = postedSeqs.map(s => s.id);
      if (!seqIds.length) return [];
      const { data, error } = await supabase.from("story_slides" as any).select("*").in("sequence_id", seqIds);
      if (error) throw error;
      return data as unknown as Slide[];
    },
    enabled: postedSeqs.length > 0,
  });

  const { data: allTracking = [] } = useQuery({
    queryKey: ["story-all-tracking", clientId],
    queryFn: async () => {
      const seqIds = postedSeqs.map(s => s.id);
      if (!seqIds.length) return [];
      const { data, error } = await supabase.from("story_sequence_tracking" as any).select("*").in("sequence_id", seqIds);
      if (error) throw error;
      return data as unknown as Tracking[];
    },
    enabled: postedSeqs.length > 0,
  });

  const stats = useMemo(() => {
    const relevantSeqIds = new Set(filteredSeqs.map(s => s.id));
    const slides = allSlides.filter(sl => relevantSeqIds.has(sl.sequence_id));
    const tracking = allTracking.filter(t => relevantSeqIds.has(t.sequence_id));
    const totalSlideViews = slides.reduce((s, sl) => s + (sl.slide_views || 0), 0);
    const totalReplies = slides.reduce((s, sl) => s + (sl.slide_replies || 0), 0);
    let retentionSum = 0, retentionCount = 0;
    for (const seq of filteredSeqs) {
      const seqSlides = slides.filter(sl => sl.sequence_id === seq.id).sort((a, b) => a.sort_order - b.sort_order);
      if (seqSlides.length >= 2 && seqSlides[0].slide_views > 0) { retentionSum += (seqSlides[seqSlides.length - 1].slide_views / seqSlides[0].slide_views) * 100; retentionCount++; }
    }
    const ctaSlidesWithViews = slides.filter(sl => sl.slide_type === "cta" && sl.slide_views > 0);
    const avgCTR = ctaSlidesWithViews.length > 0 ? ctaSlidesWithViews.reduce((s, sl) => s + (sl.slide_clicks / sl.slide_views) * 100, 0) / ctaSlidesWithViews.length : 0;
    const engagementRate = totalSlideViews > 0 ? ((totalReplies / totalSlideViews) * 100).toFixed(1) : null;
    return {
      sequenceCount: filteredSeqs.length, totalSlideViews, totalReplies,
      totalProfileVisits: tracking.reduce((s, t) => s + (t.total_profile_visits || 0), 0),
      totalTriggers: tracking.reduce((s, t) => s + (t.keyword_triggers || 0), 0),
      engagementRate,
      avgRetention: retentionCount > 0 ? (retentionSum / retentionCount).toFixed(1) : null,
      avgCTR: avgCTR > 0 ? avgCTR.toFixed(1) : null,
      avgViewsPerSlide: slides.length > 0 ? Math.round(totalSlideViews / slides.length) : 0,
    };
  }, [filteredSeqs, allSlides, allTracking]);

  const seqBreakdown = useMemo(() => {
    return filteredSeqs.map(seq => {
      const slides = allSlides.filter(sl => sl.sequence_id === seq.id).sort((a, b) => a.sort_order - b.sort_order);
      const totalViews = slides.reduce((s, sl) => s + (sl.slide_views || 0), 0);
      const totalReplies = slides.reduce((s, sl) => s + (sl.slide_replies || 0), 0);
      const ctaClicks = slides.filter(sl => sl.slide_type === "cta").reduce((s, sl) => s + (sl.slide_clicks || 0), 0);
      const firstViews = slides[0]?.slide_views || 0;
      const lastViews = slides[slides.length - 1]?.slide_views || 0;
      const retention = firstViews > 0 ? ((lastViews / firstViews) * 100).toFixed(1) : null;
      const cat = categories.find(c => c.id === seq.category_id);
      return { seq, slides: slides.length, totalViews, ctaClicks, retention, replies: totalReplies, cat };
    });
  }, [filteredSeqs, allSlides, categories]);

  return (
    <div className="space-y-5">
      {categories.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          <button onClick={() => setFilterCat(null)} className={cn("text-[10px] px-2 py-0.5 rounded-full transition-colors", !filterCat ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground hover:text-foreground")}>Alle</button>
          {categories.map(cat => (
            <button key={cat.id} onClick={() => setFilterCat(filterCat === cat.id ? null : cat.id)} className={cn("text-[10px] px-2 py-0.5 rounded-full transition-colors", filterCat === cat.id ? COLOR_CLASSES[cat.color] || "bg-primary/20 text-primary" : "bg-muted text-muted-foreground hover:text-foreground")}>{cat.name}</button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <KPICard icon={<Eye className="h-3.5 w-3.5" />} label="Ø Views/Slide" value={stats.avgViewsPerSlide.toLocaleString("de-DE")} />
        <KPICard icon={<TrendingUp className="h-3.5 w-3.5" />} label="Ø Retention" value={stats.avgRetention ? `${stats.avgRetention}%` : "–"} />
        <KPICard icon={<MousePointerClick className="h-3.5 w-3.5" />} label="Ø CTR" value={stats.avgCTR ? `${stats.avgCTR}%` : "–"} />
        <KPICard icon={<Users className="h-3.5 w-3.5" />} label="Engagement" value={stats.engagementRate ? `${stats.engagementRate}%` : "–"} />
      </div>
      {seqBreakdown.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">Keine geposteten Sequenzen.</p>
      ) : (
        <div className="space-y-1.5">
          {seqBreakdown.map(({ seq, slides, totalViews, ctaClicks, retention, replies, cat }) => (
            <div key={seq.id} className="bg-muted/30 rounded-lg px-3 py-2">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className="font-display font-medium text-[11px] truncate">{seq.title}</p>
                  {cat && <span className={cn("text-[8px] px-1.5 py-0.5 rounded-full font-medium shrink-0", COLOR_CLASSES[cat.color])}>{cat.name}</span>}
                </div>
                <span className="text-[9px] text-muted-foreground shrink-0">{seq.posted_at && format(new Date(seq.posted_at), "dd.MM.yy", { locale: de })}</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                <MiniStat label="Slides" value={slides} />
                <MiniStat label="Views" value={totalViews} />
                <MiniStat label="CTR" value={ctaClicks > 0 && totalViews > 0 ? `${((ctaClicks / totalViews) * 100).toFixed(1)}%` : "–"} isText />
                <MiniStat label="Retention" value={retention ? `${retention}%` : "–"} isText />
                <MiniStat label="Replies" value={replies} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

StoryDashboard.displayName = "StoryDashboard";

export default StoryDashboard;
