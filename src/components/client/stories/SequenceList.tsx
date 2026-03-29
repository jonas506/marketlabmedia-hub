import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useCategories } from "./useCategories";
import { STATUS_BADGES, STATUS_LABELS, COLOR_CLASSES } from "./constants";
import type { Sequence } from "./constants";

interface SequenceListProps {
  clientId: string;
  canEdit: boolean;
  onSelect: (id: string) => void;
}

const SequenceList: React.FC<SequenceListProps> = React.memo(({ clientId, canEdit, onSelect }) => {
  const qc = useQueryClient();
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const { data: categories = [] } = useCategories(clientId);

  const { data: sequences = [], isLoading } = useQuery({
    queryKey: ["story-sequences", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("story_sequences" as any)
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Sequence[];
    },
  });

  const filtered = filterCat ? sequences.filter(s => s.category_id === filterCat) : sequences;

  const { data: slideCounts = {} } = useQuery({
    queryKey: ["story-slide-counts", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("story_slides" as any)
        .select("sequence_id")
        .in("sequence_id", sequences.map((s) => s.id));
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data as any[]).forEach((d) => { counts[d.sequence_id] = (counts[d.sequence_id] || 0) + 1; });
      return counts;
    },
    enabled: sequences.length > 0,
  });

  const createSequence = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("story_sequences" as any)
        .insert({ client_id: clientId, title: "Neue Sequenz" } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Sequence;
    },
    onSuccess: (data) => { qc.invalidateQueries({ queryKey: ["story-sequences", clientId] }); onSelect(data.id); toast.success("Sequenz erstellt"); },
    onError: () => toast.error("Fehler beim Erstellen"),
  });

  const convertToStoryAd = useMutation({
    mutationFn: async (seq: Sequence) => {
      // Get slide images for this sequence
      const { data: slides } = await supabase
        .from("story_slides" as any)
        .select("image_url")
        .eq("sequence_id", seq.id)
        .order("sort_order", { ascending: true });
      
      const slideImages = (slides as any[] || [])
        .map((s: any) => s.image_url)
        .filter(Boolean);

      const now = new Date();
      const { error } = await supabase
        .from("content_pieces")
        .insert({
          client_id: clientId,
          type: "story",
          title: seq.title,
          phase: "script",
          target_month: now.getMonth() + 1,
          target_year: now.getFullYear(),
          slide_images: slideImages.length > 0 ? slideImages : undefined,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-pieces"] });
      toast.success("Story Ad in Pipeline erstellt");
    },
    onError: () => toast.error("Fehler beim Konvertieren"),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {categories.length > 0 && (
            <>
              <button onClick={() => setFilterCat(null)} className={cn("text-[10px] px-2 py-0.5 rounded-full transition-colors", !filterCat ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground hover:text-foreground")}>Alle</button>
              {categories.map(cat => (
                <button key={cat.id} onClick={() => setFilterCat(filterCat === cat.id ? null : cat.id)} className={cn("text-[10px] px-2 py-0.5 rounded-full transition-colors", filterCat === cat.id ? COLOR_CLASSES[cat.color] || "bg-primary/20 text-primary" : "bg-muted text-muted-foreground hover:text-foreground")}>{cat.name}</button>
              ))}
            </>
          )}
        </div>
        {canEdit && (
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={() => createSequence.mutate()}>
            <Plus className="h-3 w-3" /> Sequenz
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-xs">
          <p className="mb-2">{filterCat ? "Keine Sequenzen in dieser Kategorie." : "Noch keine Sequenzen."}</p>
          {canEdit && !filterCat && (
            <Button variant="outline" size="sm" onClick={() => createSequence.mutate()} className="gap-1.5 text-xs"><Plus className="h-3 w-3" /> Erste Sequenz</Button>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((seq) => {
            const cat = categories.find(c => c.id === seq.category_id);
            return (
              <div key={seq.id} className="flex items-center gap-1.5">
                <button onClick={() => onSelect(seq.id)} className="flex-1 flex items-center justify-between bg-muted/30 hover:bg-muted/60 rounded-lg px-3 py-2.5 text-left transition-colors group">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="font-display font-medium text-xs truncate">{seq.title}</p>
                    {cat && <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0", COLOR_CLASSES[cat.color] || "bg-muted text-muted-foreground")}>{cat.name}</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-muted-foreground font-mono">{slideCounts[seq.id] ?? 0} Stories</span>
                    {seq.posted_at && <span className="text-[10px] text-muted-foreground hidden sm:inline">{format(new Date(seq.posted_at), "dd.MM.", { locale: de })}</span>}
                    <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-medium", STATUS_BADGES[seq.status] || STATUS_BADGES.draft)}>{STATUS_LABELS[seq.status] || seq.status}</span>
                  </div>
                </button>
                {canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-primary"
                    title="Als Story Ad in Pipeline"
                    onClick={(e) => { e.stopPropagation(); convertToStoryAd.mutate(seq); }}
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

SequenceList.displayName = "SequenceList";

export default SequenceList;
