import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Send, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { STATUS_BADGES, STATUS_LABELS } from "./constants";
import type { Sequence } from "./constants";

interface SequenceListProps {
  clientId: string;
  canEdit: boolean;
  onSelect: (id: string) => void;
}

const SequenceList: React.FC<SequenceListProps> = React.memo(({ clientId, canEdit, onSelect }) => {
  const qc = useQueryClient();

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

  // Group sequences: top-level (no parent) with their versions
  const grouped = useMemo(() => {
    const topLevel = sequences.filter(s => !s.parent_sequence_id);
    return topLevel.map(parent => {
      const versions = sequences
        .filter(s => s.parent_sequence_id === parent.id || s.id === parent.id)
        .sort((a, b) => a.version - b.version);
      return { parent, versions };
    });
  }, [sequences]);

  const createSequence = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("story_sequences" as any)
        .insert({ client_id: clientId, title: "Neue Sequenz", version: 1 } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Sequence;
    },
    onSuccess: (data) => { qc.invalidateQueries({ queryKey: ["story-sequences", clientId] }); onSelect(data.id); toast.success("Sequenz erstellt"); },
    onError: () => toast.error("Fehler beim Erstellen"),
  });

  const createVersion = useMutation({
    mutationFn: async (parentSeq: Sequence) => {
      const parentId = parentSeq.parent_sequence_id || parentSeq.id;
      // Find max version for this group
      const siblings = sequences.filter(s => s.id === parentId || s.parent_sequence_id === parentId);
      const maxVersion = Math.max(...siblings.map(s => s.version), 0);
      const { data, error } = await supabase
        .from("story_sequences" as any)
        .insert({
          client_id: clientId,
          title: parentSeq.title,
          version: maxVersion + 1,
          parent_sequence_id: parentId,
          category_id: parentSeq.category_id,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Sequence;
    },
    onSuccess: (data) => { qc.invalidateQueries({ queryKey: ["story-sequences", clientId] }); onSelect(data.id); toast.success(`Version ${data.version} erstellt`); },
    onError: () => toast.error("Fehler beim Erstellen"),
  });

  const deleteVersion = useMutation({
    mutationFn: async (seqId: string) => {
      // Delete slides first, then the sequence
      await supabase.from("story_slides" as any).delete().eq("sequence_id", seqId);
      const { error } = await supabase.from("story_sequences" as any).delete().eq("id", seqId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["story-sequences", clientId] }); toast.success("Version gelöscht"); },
    onError: () => toast.error("Fehler beim Löschen"),
  });

  const convertToStoryAd = useMutation({
    mutationFn: async (seq: Sequence) => {
      const { data: slides } = await supabase
        .from("story_slides" as any)
        .select("image_url")
        .eq("sequence_id", seq.id)
        .order("sort_order", { ascending: true });
      const slideImages = (slides as any[] || []).map((s: any) => s.image_url).filter(Boolean);
      const now = new Date();
      const { error } = await supabase.from("content_pieces").insert({
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["content-pieces"] }); toast.success("Story Ad in Pipeline erstellt"); },
    onError: () => toast.error("Fehler beim Konvertieren"),
  });

  return (
    <div>
      <div className="flex items-center justify-end mb-3">
        {canEdit && (
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={() => createSequence.mutate()}>
            <Plus className="h-3 w-3" /> Sequenz
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" /></div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-xs">
          <p className="mb-2">Noch keine Sequenzen.</p>
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => createSequence.mutate()} className="gap-1.5 text-xs"><Plus className="h-3 w-3" /> Erste Sequenz</Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(({ parent, versions }) => (
            <div key={parent.id} className="rounded-lg border border-border/50 overflow-hidden">
              {/* Group header */}
              <div className="bg-muted/20 px-3 py-2 flex items-center justify-between">
                <span className="font-medium text-xs">{parent.title}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground">{versions.length} Version{versions.length !== 1 ? "en" : ""}</span>
                  {canEdit && (
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-primary" title="Neue Version" onClick={() => createVersion.mutate(parent)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
              {/* Version rows */}
              <div className="divide-y divide-border/30">
                {versions.map((seq) => (
                  <div key={seq.id} className="flex items-center gap-1.5">
                    <button onClick={() => onSelect(seq.id)} className="flex-1 flex items-center justify-between hover:bg-muted/40 px-3 py-2 text-left transition-colors group">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-mono font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">V{seq.version}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{slideCounts[seq.id] ?? 0} Stories</span>
                        {seq.posted_at && <span className="text-[10px] text-muted-foreground hidden sm:inline">{format(new Date(seq.posted_at), "dd.MM.yy", { locale: de })}</span>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
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
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

SequenceList.displayName = "SequenceList";

export default SequenceList;
