import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ReelIdea {
  title: string;
  hook: string;
  concept: string;
  format_tip: string;
  virality_score: number;
}

interface ReelIdeaRow {
  id: string;
  ideas: ReelIdea[];
  niche: string;
  created_at: string;
}

interface Props {
  userId: string;
}

export default function ReelIdeas({ userId }: Props) {
  const [rows, setRows] = useState<ReelIdeaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [niche, setNiche] = useState("Social Media Marketing");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("cb_reel_ideas").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(7);
    setRows((data || []).map((r: any) => ({ id: r.id, ideas: (r.ideas as ReelIdea[]) || [], niche: r.niche || "", created_at: r.created_at })));
    setLoading(false);
  };

  useEffect(() => { load(); }, [userId]);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await supabase.functions.invoke("cb-reel-agent", { body: { user_id: userId, niche } });
      if (res.error) throw res.error;
      await load();
    } catch (err) { console.error("Generate error:", err); }
    setGenerating(false);
  };

  const viralityColor = (score: number) => { if (score >= 8) return "text-green-400"; if (score >= 5) return "text-yellow-400"; return "text-orange-400"; };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" });

  const todayRow = rows[0];
  const olderRows = rows.slice(1);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">Reel-Ideen</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Täglich 3 frische Ideen basierend auf aktuellen Trends</p>
        </div>
        <button onClick={generate} disabled={generating} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold cursor-pointer border-none transition-opacity hover:opacity-85 disabled:opacity-50">
          {generating ? "Analysiere Trends…" : "Jetzt generieren"}
        </button>
      </div>
      <div className="flex gap-2">
        <input type="text" value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Nische / Thema…" className="flex-1 px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12"><span className="text-muted-foreground text-sm">Laden…</span></div>
      ) : !todayRow ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 bg-card border border-border rounded-xl">
          <span className="text-muted-foreground">—</span>
          <p className="text-muted-foreground text-sm">Noch keine Reel-Ideen vorhanden</p>
        </div>
      ) : (
        <>
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-primary">{formatDate(todayRow.created_at)}</span>
              <span className="text-[10px] text-muted-foreground bg-muted/20 px-2 py-0.5 rounded-full">{todayRow.niche}</span>
            </div>
            <div className="space-y-3">
              {todayRow.ideas.map((idea, i) => (
                <div key={i} className="border border-border/60 rounded-lg p-4 hover:border-primary/40 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-1.5">
                      <h3 className="text-sm font-semibold text-foreground">{idea.title}</h3>
                      <p className="text-xs text-primary font-medium italic">„{idea.hook}"</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{idea.concept}</p>
                      <p className="text-[11px] text-muted-foreground"><span className="text-foreground/70">{idea.format_tip}</span></p>
                    </div>
                    <div className="flex flex-col items-center shrink-0">
                      <span className={`text-lg font-bold ${viralityColor(idea.virality_score)}`}>{idea.virality_score}</span>
                      <span className="text-[9px] text-muted-foreground">Viral</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {olderRows.length > 0 && (
            <details className="group">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground list-none flex items-center gap-1">
                <span className="group-open:rotate-90 transition-transform">▶</span> Ältere Ideen ({olderRows.length} Tage)
              </summary>
              <div className="mt-3 space-y-3">
                {olderRows.map((row) => (
                  <div key={row.id} className="bg-card/50 border border-border/50 rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{formatDate(row.created_at)}</span>
                      <span className="text-[10px] text-muted-foreground">{row.niche}</span>
                    </div>
                    {row.ideas.map((idea, i) => (
                      <div key={i} className="text-xs text-foreground/80"><span className="font-medium">{idea.title}</span><span className="text-muted-foreground"> — {idea.hook}</span></div>
                    ))}
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
