import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronRight, Filter, Plus, FileText, ExternalLink, Link as LinkIcon } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface ContentPiece {
  id: string;
  client_id: string;
  shoot_day_id: string | null;
  type: string;
  title: string | null;
  assigned_to: string | null;
  phase: string;
  target_month: number;
  target_year: number;
  has_script: boolean;
}

interface MonthlyPipelineProps {
  clientId: string;
  contentPieces: ContentPiece[];
  month: number;
  year: number;
  canEdit: boolean;
}

const PIPELINE_CONFIG: Record<string, { label: string; phases: { key: string; label: string }[]; addLabel: string }> = {
  reel: {
    label: "Reels",
    phases: [
      { key: "filmed", label: "Gedreht" },
      { key: "editing", label: "Im Schnitt" },
      { key: "done", label: "Fertig" },
      { key: "handed_over", label: "Übergeben" },
    ],
    addLabel: "+ Reel",
  },
  carousel: {
    label: "Karussells",
    phases: [
      { key: "script", label: "Skript" },
      { key: "approved", label: "Freigegeben" },
      { key: "handed_over", label: "Übergeben" },
    ],
    addLabel: "+ Karussell",
  },
  story: {
    label: "Stories",
    phases: [
      { key: "filmed", label: "Gedreht" },
      { key: "editing", label: "Im Schnitt" },
      { key: "done", label: "Fertig" },
      { key: "handed_over", label: "Übergeben" },
    ],
    addLabel: "+ Story",
  },
};

const MonthlyPipeline: React.FC<MonthlyPipelineProps> = ({ clientId, contentPieces, month, year, canEdit }) => {
  const qc = useQueryClient();
  const [activeType, setActiveType] = useState<string>("reel");
  const [activePhase, setActivePhase] = useState<string>("filmed");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterPerson, setFilterPerson] = useState<string>("all");

  const config = PIPELINE_CONFIG[activeType];

  // Reset phase when switching type
  const handleTypeChange = (type: string) => {
    setActiveType(type);
    setActivePhase(PIPELINE_CONFIG[type].phases[0].key);
    setSelected(new Set());
    setFilterPerson("all");
  };

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

  const monthPieces = useMemo(() =>
    contentPieces.filter((c) => c.type === activeType && c.target_month === month && c.target_year === year),
    [contentPieces, activeType, month, year]
  );

  const phasePieces = useMemo(() => {
    let filtered = monthPieces.filter((c) => c.phase === activePhase);
    if (filterPerson !== "all") filtered = filtered.filter((c) => c.assigned_to === filterPerson);
    return filtered;
  }, [monthPieces, activePhase, filterPerson]);

  // Next phase map
  const nextPhaseMap = useMemo(() => {
    const phases = config.phases;
    const map: Record<string, string> = {};
    for (let i = 0; i < phases.length - 1; i++) {
      map[phases[i].key] = phases[i + 1].key;
    }
    return map;
  }, [config]);

  // Bulk move
  const bulkMove = useMutation({
    mutationFn: async () => {
      const next = nextPhaseMap[activePhase];
      if (!next) return;
      const ids = [...selected];
      await supabase.from("content_pieces").update({ phase: next }).in("id", ids);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-pieces", clientId] });
      setSelected(new Set());
    },
  });

  // Add piece manually
  const addPiece = useMutation({
    mutationFn: async () => {
      const firstPhase = config.phases[0].key;
      await supabase.from("content_pieces").insert({
        client_id: clientId,
        type: activeType,
        phase: firstPhase,
        target_month: month,
        target_year: year,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-pieces", clientId] });
    },
  });

  const updatePiece = async (pieceId: string, updates: Record<string, any>) => {
    await supabase.from("content_pieces").update(updates).eq("id", pieceId);
    qc.invalidateQueries({ queryKey: ["content-pieces", clientId] });
  };

  const deletePiece = async (pieceId: string) => {
    await supabase.from("content_pieces").delete().eq("id", pieceId);
    qc.invalidateQueries({ queryKey: ["content-pieces", clientId] });
  };

  const toggleSelect = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const toggleAll = () => {
    if (selected.size === phasePieces.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(phasePieces.map((c) => c.id)));
    }
  };

  const monthOptions = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(year, month - 1 + i);
    return { month: d.getMonth() + 1, year: d.getFullYear(), label: format(d, "MM/yyyy", { locale: de }) };
  });

  // Phase summary counts
  const phaseSummary = config.phases.map((p) => ({
    ...p,
    count: monthPieces.filter((c) => c.phase === p.key).length,
  }));

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-mono text-xs font-semibold tracking-wider text-muted-foreground">MATERIAL-PIPELINE</h3>
        
        {/* Phase summary counts */}
        <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
          {phaseSummary.map((p, i) => (
            <span key={p.key}>
              {i > 0 && <span className="mx-1">|</span>}
              {p.count} {p.label}
            </span>
          ))}
        </div>
      </div>

      {/* Type tabs */}
      <Tabs value={activeType} onValueChange={handleTypeChange} className="mb-4">
        <TabsList className="h-8">
          {Object.entries(PIPELINE_CONFIG).map(([key, cfg]) => {
            const typeCount = contentPieces.filter((c) => c.type === key && c.target_month === month && c.target_year === year).length;
            return (
              <TabsTrigger key={key} value={key} className="text-xs gap-1.5 px-3">
                {cfg.label}
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{typeCount}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Phase tabs */}
      <div className="flex gap-1 mb-4">
        {config.phases.map((p) => {
          const count = monthPieces.filter((c) => c.phase === p.key).length;
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

      {/* Filter bar + actions */}
      <div className="flex items-center gap-3 mb-3">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
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

        {selected.size > 0 && nextPhaseMap[activePhase] && (
          <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={() => bulkMove.mutate()} disabled={bulkMove.isPending}>
            {selected.size} → {config.phases.find((p) => p.key === nextPhaseMap[activePhase])?.label}
            <ChevronRight className="h-3 w-3" />
          </Button>
        )}

        {canEdit && (
          <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={() => addPiece.mutate()} disabled={addPiece.isPending}>
            <Plus className="h-3 w-3" /> {config.addLabel}
          </Button>
        )}
      </div>

      {/* Piece list */}
      {phasePieces.length === 0 ? (
        <p className="text-xs text-muted-foreground font-body py-4 text-center">Keine Pieces in dieser Phase.</p>
      ) : (
        <div className="space-y-1">
          <div className="flex items-center gap-3 px-3 py-1">
            <Checkbox checked={selected.size === phasePieces.length && phasePieces.length > 0} onCheckedChange={toggleAll} />
            <span className="text-[10px] font-mono text-muted-foreground">{phasePieces.length} PIECES</span>
          </div>

          {phasePieces.map((piece) => (
            <div key={piece.id} className="flex items-center gap-3 rounded border border-border p-3 hover:border-primary/20 transition-colors">
              <Checkbox checked={selected.has(piece.id)} onCheckedChange={() => toggleSelect(piece.id)} />

              {/* Title */}
              <Input value={piece.title || ""} placeholder="Titel..." className="h-6 flex-1 border-0 bg-transparent text-sm px-1"
                onChange={(e) => updatePiece(piece.id, { title: e.target.value })} disabled={!canEdit} />

              {/* Script badge */}
              {piece.has_script && (
                <Badge variant="outline" className="text-[10px] gap-0.5 h-5">
                  <FileText className="h-2.5 w-2.5" /> Skript
                </Badge>
              )}
              <Checkbox checked={piece.has_script || false}
                onCheckedChange={(v) => updatePiece(piece.id, { has_script: !!v })}
                disabled={!canEdit} className="h-3.5 w-3.5" />

              {/* Assigned */}
              <Select value={piece.assigned_to || ""} onValueChange={(v) => updatePiece(piece.id, { assigned_to: v })} disabled={!canEdit}>
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
              <Select value={`${piece.target_month}-${piece.target_year}`}
                onValueChange={(v) => {
                  const [m, y] = v.split("-").map(Number);
                  updatePiece(piece.id, { target_month: m, target_year: y });
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
              {nextPhaseMap[activePhase] && (
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]"
                  onClick={() => updatePiece(piece.id, { phase: nextPhaseMap[activePhase] })}>
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
