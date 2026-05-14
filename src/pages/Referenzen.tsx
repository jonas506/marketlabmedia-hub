import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Library } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import FormatCard from "@/components/referenzen/FormatCard";
import AddFormatDialog from "@/components/referenzen/AddFormatDialog";
import FormatDetail from "@/components/referenzen/FormatDetail";
import { FUNNEL_STAGES, type ContentFormat, type FunnelStage } from "@/components/referenzen/constants";
import { cn } from "@/lib/utils";

const Referenzen: React.FC = () => {
  const { formatId } = useParams<{ formatId?: string }>();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [filter, setFilter] = useState<"all" | FunnelStage>("all");
  const [addOpen, setAddOpen] = useState(false);

  const { data: formats = [] } = useQuery({
    queryKey: ["content_formats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_formats")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ContentFormat[];
    },
  });

  const { data: counts = {} } = useQuery({
    queryKey: ["format_reference_counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("format_references").select("format_id");
      if (error) throw error;
      const map: Record<string, number> = {};
      (data || []).forEach((r: any) => { map[r.format_id] = (map[r.format_id] || 0) + 1; });
      return map;
    },
  });

  const grouped = useMemo(() => {
    const g: Record<FunnelStage, ContentFormat[]> = { tofu: [], mofu: [], bofu: [] };
    formats.forEach((f) => {
      if (filter === "all" || filter === f.funnel_stage) g[f.funnel_stage].push(f);
    });
    return g;
  }, [formats, filter]);

  if (formatId) {
    return (
      <AppLayout>
        <FormatDetail formatId={formatId} isAdmin={isAdmin} />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
              <Library className="h-6 w-6 text-primary" /> Referenz-Datenbank
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Unsere Content-Formate und Referenz-Videos.</p>
          </div>
          {isAdmin && (
            <Button onClick={() => setAddOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Format anlegen
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterPill active={filter === "all"} onClick={() => setFilter("all")} label="Alle" />
          {FUNNEL_STAGES.map((s) => (
            <FilterPill
              key={s.key}
              active={filter === s.key}
              onClick={() => setFilter(s.key)}
              label={s.label}
              dotClass={s.dotClass}
            />
          ))}
        </div>

        <div className="space-y-8">
          {FUNNEL_STAGES.map((s) => {
            const items = grouped[s.key];
            if (items.length === 0 && filter !== "all" && filter !== s.key) return null;
            if (items.length === 0) return null;
            return (
              <section key={s.key}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={cn("h-2.5 w-2.5 rounded-full", s.dotClass)} />
                  <h2 className="font-display font-semibold text-sm">
                    {s.label} <span className="text-muted-foreground font-normal">— {s.subtitle}</span>
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {items.map((f) => (
                    <FormatCard key={f.id} format={f} referenceCount={counts[f.id] || 0} />
                  ))}
                </div>
              </section>
            );
          })}
          {formats.length === 0 && (
            <div className="text-center py-12 rounded-xl border border-dashed border-border">
              <Library className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Noch keine Formate angelegt.</p>
              {isAdmin && (
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setAddOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Erstes Format anlegen
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {isAdmin && <AddFormatDialog open={addOpen} onOpenChange={setAddOpen} />}
    </AppLayout>
  );
};

const FilterPill: React.FC<{ active: boolean; onClick: () => void; label: string; dotClass?: string }> = ({ active, onClick, label, dotClass }) => (
  <button
    onClick={onClick}
    className={cn(
      "inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-medium border transition-all",
      active ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground/70 border-border hover:border-primary/40",
    )}
  >
    {dotClass && <span className={cn("h-2 w-2 rounded-full", active ? "bg-primary-foreground" : dotClass)} />}
    {label}
  </button>
);

export default Referenzen;
