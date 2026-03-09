import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronRight, FileText, Filter } from "lucide-react";

interface Clip {
  id: string;
  client_id: string;
  shoot_day_id: string | null;
  type: string | null;
  title: string | null;
  assigned_to: string | null;
  phase: string;
  target_month: number | null;
  target_year: number | null;
  has_script: boolean;
}

interface MonthlyPipelineProps {
  clientId: string;
  clips: Clip[];
  month: number;
  year: number;
  canEdit: boolean;
}

const PHASES = [
  { key: "filmed", label: "Gedreht" },
  { key: "editing", label: "Im Schnitt" },
  { key: "approved", label: "Freigegeben" },
  { key: "scheduled_posted", label: "Geplant/Gepostet" },
];

const NEXT_PHASE: Record<string, string> = {
  filmed: "editing",
  editing: "approved",
  approved: "scheduled_posted",
};

const TYPE_LABELS: Record<string, string> = {
  reel: "Reel",
  carousel: "Karussell",
  story: "Story",
};

const MonthlyPipeline: React.FC<MonthlyPipelineProps> = ({ clientId, clips, month, year, canEdit }) => {
  const qc = useQueryClient();
  const [activePhase, setActivePhase] = useState("filmed");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<string>("all");
  const [filterPerson, setFilterPerson] = useState<string>("all");

  // Fetch team members
  const { data: team } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id, role").in("role", ["cutter", "head_of_content"]);
      if (!roles?.length) return [];
      const userIds = roles.map((r) => r.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, name, email").in("user_id", userIds);
      return profiles ?? [];
    },
  });

  // Filter clips for this month
  const monthClips = useMemo(() =>
    clips.filter((c) => c.target_month === month && c.target_year === year),
    [clips, month, year]
  );

  const phaseClips = useMemo(() => {
    let filtered = monthClips.filter((c) => c.phase === activePhase);
    if (filterType !== "all") filtered = filtered.filter((c) => c.type === filterType);
    if (filterPerson !== "all") filtered = filtered.filter((c) => c.assigned_to === filterPerson);
    return filtered;
  }, [monthClips, activePhase, filterType, filterPerson]);

  // Bulk move mutation
  const bulkMove = useMutation({
    mutationFn: async () => {
      const next = NEXT_PHASE[activePhase];
      if (!next) return;
      const ids = [...selected];
      await supabase.from("clips").update({ phase: next }).in("id", ids);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clips", clientId] });
      setSelected(new Set());
    },
  });

  // Single clip update
  const updateClip = async (clipId: string, updates: Partial<Clip>) => {
    await supabase.from("clips").update(updates).eq("id", clipId);
    qc.invalidateQueries({ queryKey: ["clips", clientId] });
  };

  const toggleSelect = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const toggleAll = () => {
    if (selected.size === phaseClips.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(phaseClips.map((c) => c.id)));
    }
  };

  // Month options for target change
  const monthOptions = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(year, month - 1 + i);
    return { month: d.getMonth() + 1, year: d.getFullYear(), label: `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}` };
  });

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="font-mono text-xs font-semibold tracking-wider text-muted-foreground mb-4">MATERIAL-PIPELINE</h3>

      {/* Phase tabs */}
      <div className="flex gap-1 mb-4">
        {PHASES.map((p) => {
          const count = monthClips.filter((c) => c.phase === p.key).length;
          return (
            <button key={p.key} onClick={() => { setActivePhase(p.key); setSelected(new Set()); }}
              className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-mono transition-colors ${
                activePhase === p.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}>
              {p.label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                activePhase === p.key ? "bg-primary-foreground/20" : "bg-background"
              }`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Filter bar + bulk actions */}
      <div className="flex items-center gap-3 mb-3">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-7 w-28 text-xs"><SelectValue placeholder="Typ" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Typen</SelectItem>
            <SelectItem value="reel">Reel</SelectItem>
            <SelectItem value="carousel">Karussell</SelectItem>
            <SelectItem value="story">Story</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPerson} onValueChange={setFilterPerson}>
          <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="Person" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            {team?.map((t) => (
              <SelectItem key={t.user_id} value={t.user_id}>{t.name || t.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        {selected.size > 0 && NEXT_PHASE[activePhase] && (
          <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={() => bulkMove.mutate()} disabled={bulkMove.isPending}>
            {selected.size} → {PHASES.find((p) => p.key === NEXT_PHASE[activePhase])?.label}
            <ChevronRight className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Clip list */}
      {phaseClips.length === 0 ? (
        <p className="text-xs text-muted-foreground font-body py-4 text-center">Keine Clips in dieser Phase.</p>
      ) : (
        <div className="space-y-1">
          {/* Select all */}
          <div className="flex items-center gap-3 px-3 py-1">
            <Checkbox checked={selected.size === phaseClips.length && phaseClips.length > 0} onCheckedChange={toggleAll} />
            <span className="text-[10px] font-mono text-muted-foreground">{phaseClips.length} CLIPS</span>
          </div>

          {phaseClips.map((clip) => (
            <div key={clip.id} className="flex items-center gap-3 rounded border border-border p-3 hover:border-primary/20 transition-colors">
              <Checkbox checked={selected.has(clip.id)} onCheckedChange={() => toggleSelect(clip.id)} />

              {/* Type badge */}
              <Select value={clip.type || ""} onValueChange={(v) => updateClip(clip.id, { type: v })} disabled={!canEdit}>
                <SelectTrigger className="h-6 w-24 text-[10px] font-mono border-0 bg-muted px-2">
                  <SelectValue placeholder="Typ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reel">Reel</SelectItem>
                  <SelectItem value="carousel">Karussell</SelectItem>
                  <SelectItem value="story">Story</SelectItem>
                </SelectContent>
              </Select>

              {/* Title */}
              <Input value={clip.title || ""} placeholder="Titel..." className="h-6 flex-1 border-0 bg-transparent text-sm px-1"
                onChange={(e) => updateClip(clip.id, { title: e.target.value })} disabled={!canEdit} />

              {/* Script badge */}
              {clip.has_script && (
                <Badge variant="outline" className="text-[10px] gap-0.5 h-5">
                  <FileText className="h-2.5 w-2.5" /> Skript
                </Badge>
              )}
              <Checkbox checked={clip.has_script || false}
                onCheckedChange={(v) => updateClip(clip.id, { has_script: !!v })}
                disabled={!canEdit} className="h-3.5 w-3.5" />

              {/* Assigned */}
              <Select value={clip.assigned_to || ""} onValueChange={(v) => updateClip(clip.id, { assigned_to: v })} disabled={!canEdit}>
                <SelectTrigger className="h-6 w-28 text-[10px] font-mono border-0 bg-muted px-2">
                  <SelectValue placeholder="Person" />
                </SelectTrigger>
                <SelectContent>
                  {team?.map((t) => (
                    <SelectItem key={t.user_id} value={t.user_id}>{t.name || t.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Target month */}
              <Select value={`${clip.target_month}-${clip.target_year}`}
                onValueChange={(v) => {
                  const [m, y] = v.split("-").map(Number);
                  updateClip(clip.id, { target_month: m, target_year: y });
                }} disabled={!canEdit}>
                <SelectTrigger className="h-6 w-20 text-[10px] font-mono border-0 bg-muted px-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((o) => (
                    <SelectItem key={`${o.month}-${o.year}`} value={`${o.month}-${o.year}`}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Move to next phase */}
              {NEXT_PHASE[activePhase] && (
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]"
                  onClick={() => updateClip(clip.id, { phase: NEXT_PHASE[activePhase] })}>
                  <ChevronRight className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MonthlyPipeline;
