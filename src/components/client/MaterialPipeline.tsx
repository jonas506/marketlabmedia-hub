import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronRight } from "lucide-react";

interface Clip {
  id: string;
  client_id: string;
  shoot_day_id: string | null;
  type: string | null;
  title: string | null;
  assigned_to: string | null;
  phase: string;
  created_at: string;
}

interface MaterialPipelineProps {
  clientId: string;
  clips: Clip[];
  canEdit: boolean;
}

const PHASES = [
  { key: "raw", label: "ROH" },
  { key: "editing", label: "IM SCHNITT" },
  { key: "done", label: "FERTIG" },
  { key: "scheduled", label: "GEPLANT" },
  { key: "posted", label: "GEPOSTET" },
];

const NEXT_PHASE: Record<string, string> = {
  raw: "editing",
  editing: "done",
  done: "scheduled",
  scheduled: "posted",
};

const MaterialPipeline: React.FC<MaterialPipelineProps> = ({ clientId, clips, canEdit }) => {
  const [activePhase, setActivePhase] = useState("raw");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const qc = useQueryClient();

  // Fetch team members (cutters)
  const { data: teamMembers } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["cutter", "head_of_content"]);
      if (!data) return [];
      const userIds = data.map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name")
        .in("user_id", userIds);
      return profiles ?? [];
    },
  });

  const phaseCounts = PHASES.map((p) => ({
    ...p,
    count: clips.filter((c) => c.phase === p.key).length,
  }));

  const filteredClips = clips.filter((c) => c.phase === activePhase);

  const bulkMoveMutation = useMutation({
    mutationFn: async () => {
      const nextPhase = NEXT_PHASE[activePhase];
      if (!nextPhase || selected.size === 0) return;
      const ids = Array.from(selected);
      await supabase.from("clips").update({ phase: nextPhase }).in("id", ids);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clips", clientId] });
      setSelected(new Set());
    },
  });

  const updateClip = async (clipId: string, updates: Partial<Clip>) => {
    await supabase.from("clips").update(updates).eq("id", clipId);
    qc.invalidateQueries({ queryKey: ["clips", clientId] });
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === filteredClips.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredClips.map((c) => c.id)));
    }
  };

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <h2 className="text-sm font-bold tracking-widest text-muted-foreground mb-4">
        MATERIAL-PIPELINE
      </h2>

      {/* Phase tabs */}
      <div className="flex gap-1 mb-4">
        {phaseCounts.map((p) => (
          <button
            key={p.key}
            onClick={() => { setActivePhase(p.key); setSelected(new Set()); }}
            className={`px-3 py-1.5 rounded-md font-mono text-xs transition-colors ${
              activePhase === p.key
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {p.count} {p.label}
          </button>
        ))}
      </div>

      {/* Bulk actions */}
      {canEdit && selected.size > 0 && NEXT_PHASE[activePhase] && (
        <div className="flex items-center gap-3 mb-4 p-3 rounded-md bg-background border border-border">
          <span className="font-mono text-xs text-muted-foreground">
            {selected.size} AUSGEWÄHLT
          </span>
          <Button
            size="sm"
            onClick={() => bulkMoveMutation.mutate()}
            className="gap-1 font-mono text-xs"
          >
            <ChevronRight className="h-3 w-3" />
            → {PHASES.find((p) => p.key === NEXT_PHASE[activePhase])?.label}
          </Button>
        </div>
      )}

      {/* Clip list */}
      {filteredClips.length === 0 ? (
        <p className="py-8 text-center font-mono text-xs text-muted-foreground">
          0 CLIPS {PHASES.find((p) => p.key === activePhase)?.label}
        </p>
      ) : (
        <div className="space-y-1">
          {/* Header */}
          <div className="flex items-center gap-3 px-3 py-2 text-xs font-mono text-muted-foreground">
            {canEdit && NEXT_PHASE[activePhase] && (
              <Checkbox
                checked={selected.size === filteredClips.length && filteredClips.length > 0}
                onCheckedChange={toggleAll}
              />
            )}
            <span className="flex-1">CLIP</span>
            <span className="w-24">TYP</span>
            <span className="w-32">ZUGEWIESEN</span>
          </div>

          {filteredClips.map((clip, idx) => (
            <div
              key={clip.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-md border border-border bg-background"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              {canEdit && NEXT_PHASE[activePhase] && (
                <Checkbox
                  checked={selected.has(clip.id)}
                  onCheckedChange={() => toggleSelect(clip.id)}
                />
              )}
              <div className="flex-1">
                {activePhase !== "raw" ? (
                  <Input
                    value={clip.title ?? ""}
                    onChange={(e) => updateClip(clip.id, { title: e.target.value })}
                    placeholder="Clip-Titel..."
                    className="h-7 border-0 bg-transparent px-0 font-body text-sm focus-visible:ring-0"
                    disabled={!canEdit}
                  />
                ) : (
                  <span className="font-mono text-xs text-muted-foreground">
                    Clip #{idx + 1}
                  </span>
                )}
              </div>
              <div className="w-24">
                {activePhase !== "raw" ? (
                  <Select
                    value={clip.type ?? ""}
                    onValueChange={(v) => updateClip(clip.id, { type: v })}
                    disabled={!canEdit}
                  >
                    <SelectTrigger className="h-7 border-0 bg-transparent font-mono text-xs">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reel">Reel</SelectItem>
                      <SelectItem value="carousel">Karussell</SelectItem>
                      <SelectItem value="story">Story Ad</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="font-mono text-xs text-muted-foreground">—</span>
                )}
              </div>
              <div className="w-32">
                {activePhase !== "raw" ? (
                  <Select
                    value={clip.assigned_to ?? ""}
                    onValueChange={(v) => updateClip(clip.id, { assigned_to: v })}
                    disabled={!canEdit}
                  >
                    <SelectTrigger className="h-7 border-0 bg-transparent font-body text-xs">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {teamMembers?.map((m) => (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="font-mono text-xs text-muted-foreground">—</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default MaterialPipeline;
