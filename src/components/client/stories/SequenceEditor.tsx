import React, { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, Trash2, Plus, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useCategories } from "./useCategories";
import { STATUS_BADGES, STATUS_LABELS, SLIDE_TYPES } from "./constants";
import SlideCard from "./SlideCard";
import SequenceTracking from "./SequenceTracking";
import type { Sequence, Slide, Tracking } from "./constants";

interface SequenceEditorProps {
  sequenceId: string;
  clientId: string;
  canEdit: boolean;
  onBack: () => void;
}

const SequenceEditor: React.FC<SequenceEditorProps> = React.memo(({ sequenceId, clientId, canEdit, onBack }) => {
  const qc = useQueryClient();
  const { data: categories = [] } = useCategories(clientId);
  const [showComparison, setShowComparison] = useState(false);

  const { data: sequence } = useQuery({
    queryKey: ["story-sequence", sequenceId],
    queryFn: async () => {
      const { data, error } = await supabase.from("story_sequences" as any).select("*").eq("id", sequenceId).single();
      if (error) throw error;
      return data as unknown as Sequence;
    },
  });

  const { data: slides = [] } = useQuery({
    queryKey: ["story-slides", sequenceId],
    queryFn: async () => {
      const { data, error } = await supabase.from("story_slides" as any).select("*").eq("sequence_id", sequenceId).order("sort_order", { ascending: true });
      if (error) throw error;
      return data as unknown as Slide[];
    },
  });

  const { data: tracking } = useQuery({
    queryKey: ["story-tracking", sequenceId],
    queryFn: async () => {
      const { data, error } = await supabase.from("story_sequence_tracking" as any).select("*").eq("sequence_id", sequenceId).maybeSingle();
      if (error) throw error;
      return data as unknown as Tracking | null;
    },
  });

  // Load sibling versions for comparison
  const parentId = sequence?.parent_sequence_id || sequence?.id;
  const { data: siblingVersions = [] } = useQuery({
    queryKey: ["story-sequence-versions", parentId],
    queryFn: async () => {
      if (!parentId) return [];
      const { data, error } = await supabase
        .from("story_sequences" as any)
        .select("*")
        .or(`id.eq.${parentId},parent_sequence_id.eq.${parentId}`)
        .order("version", { ascending: true });
      if (error) throw error;
      return data as unknown as Sequence[];
    },
    enabled: !!parentId,
  });

  // Load slides for all sibling versions (for comparison)
  const { data: allVersionSlides = {} } = useQuery({
    queryKey: ["story-version-slides", parentId],
    queryFn: async () => {
      const ids = siblingVersions.map(s => s.id);
      if (!ids.length) return {};
      const { data, error } = await supabase
        .from("story_slides" as any)
        .select("*")
        .in("sequence_id", ids)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      const grouped: Record<string, Slide[]> = {};
      (data as unknown as Slide[]).forEach(s => {
        if (!grouped[s.sequence_id]) grouped[s.sequence_id] = [];
        grouped[s.sequence_id].push(s);
      });
      return grouped;
    },
    enabled: showComparison && siblingVersions.length > 1,
  });

  const invalidateAll = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["story-sequence", sequenceId] });
    qc.invalidateQueries({ queryKey: ["story-slides", sequenceId] });
    qc.invalidateQueries({ queryKey: ["story-tracking", sequenceId] });
    qc.invalidateQueries({ queryKey: ["story-sequences", clientId] });
  }, [qc, sequenceId, clientId]);

  const updateSequence = useMutation({
    mutationFn: async (updates: Partial<Sequence>) => {
      const { error } = await supabase.from("story_sequences" as any).update(updates as any).eq("id", sequenceId);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
    onError: () => toast.error("Fehler beim Speichern"),
  });

  const deleteSequence = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("story_sequences" as any).delete().eq("id", sequenceId);
      if (error) throw error;
    },
    onSuccess: () => { onBack(); qc.invalidateQueries({ queryKey: ["story-sequences", clientId] }); toast.success("Gelöscht"); },
  });

  const markPosted = useCallback(() => {
    updateSequence.mutate({ status: "posted", posted_at: new Date().toISOString() } as any);
    toast.success("Als gepostet markiert");
  }, [updateSequence]);

  const addSlide = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("story_slides" as any).insert({ sequence_id: sequenceId, sort_order: slides.length, content_text: "", slide_type: "text" } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["story-slides", sequenceId] }),
  });

  const updateSlide = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Slide> & { id: string }) => {
      const { error } = await supabase.from("story_slides" as any).update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["story-slides", sequenceId] }),
  });

  const deleteSlide = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("story_slides" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["story-slides", sequenceId] }),
  });

  const moveSlide = useCallback((idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= slides.length) return;
    const a = slides[idx];
    const b = slides[target];
    Promise.all([
      supabase.from("story_slides" as any).update({ sort_order: b.sort_order } as any).eq("id", a.id),
      supabase.from("story_slides" as any).update({ sort_order: a.sort_order } as any).eq("id", b.id),
    ]).then(() => qc.invalidateQueries({ queryKey: ["story-slides", sequenceId] }));
  }, [slides, sequenceId, qc]);

  const upsertTracking = useCallback(async (field: string, value: any) => {
    const payload = { sequence_id: sequenceId, [field]: value };
    if (tracking) {
      await supabase.from("story_sequence_tracking" as any).update({ [field]: value } as any).eq("id", tracking.id);
    } else {
      await supabase.from("story_sequence_tracking" as any).insert(payload as any);
    }
    qc.invalidateQueries({ queryKey: ["story-tracking", sequenceId] });
  }, [tracking, sequenceId, qc]);

  if (!sequence) return <div className="flex justify-center py-12"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" /></div>;

  const isPosted = sequence.status === "posted" || sequence.status === "tracked";
  const hasMultipleVersions = siblingVersions.length > 1;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      {/* Header */}
      <div>
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 group transition-colors">
          <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" /> Alle Sequenzen
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">V{sequence.version}</span>
            {canEdit ? (
              <Input defaultValue={sequence.title} onBlur={(e) => { if (e.target.value !== sequence.title) updateSequence.mutate({ title: e.target.value } as any); }} className="font-display font-semibold text-sm h-8 bg-transparent border-border max-w-xs" />
            ) : (
              <h3 className="font-display font-semibold text-sm truncate">{sequence.title}</h3>
            )}
            <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0", STATUS_BADGES[sequence.status] || STATUS_BADGES.draft)}>{STATUS_LABELS[sequence.status] || sequence.status}</span>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2 shrink-0">
              {hasMultipleVersions && (
                <Button variant={showComparison ? "default" : "outline"} size="sm" className="text-xs gap-1.5 h-7" onClick={() => setShowComparison(!showComparison)}>
                  <BarChart3 className="h-3 w-3" /> Vergleich
                </Button>
              )}
              {sequence.status === "draft" && <Button variant="outline" size="sm" className="text-xs gap-1.5 h-7" onClick={markPosted}>✓ Gepostet</Button>}
              <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Version löschen?</AlertDialogTitle><AlertDialogDescription>Diese Aktion kann nicht rückgängig gemacht werden.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Abbrechen</AlertDialogCancel><AlertDialogAction onClick={() => deleteSequence.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Löschen</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </div>

      {/* Version Comparison */}
      {showComparison && hasMultipleVersions && (
        <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-3">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Versionsvergleich</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-1.5 pr-3 text-muted-foreground font-medium">Version</th>
                  <th className="text-left py-1.5 pr-3 text-muted-foreground font-medium">Status</th>
                  <th className="text-right py-1.5 pr-3 text-muted-foreground font-medium">Stories</th>
                  <th className="text-right py-1.5 pr-3 text-muted-foreground font-medium">Ø Views</th>
                  <th className="text-right py-1.5 pr-3 text-muted-foreground font-medium">Retention</th>
                  <th className="text-right py-1.5 text-muted-foreground font-medium">Replies</th>
                </tr>
              </thead>
              <tbody>
                {siblingVersions.map(v => {
                  const vSlides = allVersionSlides[v.id] || [];
                  const totalViews = vSlides.reduce((s, sl) => s + (sl.slide_views || 0), 0);
                  const avgViews = vSlides.length > 0 ? Math.round(totalViews / vSlides.length) : 0;
                  const firstViews = vSlides[0]?.slide_views || 0;
                  const lastViews = vSlides[vSlides.length - 1]?.slide_views || 0;
                  const retention = firstViews > 0 ? ((lastViews / firstViews) * 100).toFixed(1) : "–";
                  const totalReplies = vSlides.reduce((s, sl) => s + (sl.slide_replies || 0), 0);
                  const isCurrent = v.id === sequenceId;
                  return (
                    <tr key={v.id} className={cn("border-b border-border/20", isCurrent && "bg-primary/5")}>
                      <td className="py-1.5 pr-3">
                        <span className={cn("font-mono font-semibold", isCurrent ? "text-primary" : "text-foreground")}>V{v.version}</span>
                        {v.posted_at && <span className="text-[10px] text-muted-foreground ml-1.5">{new Date(v.posted_at).toLocaleDateString("de")}</span>}
                      </td>
                      <td className="py-1.5 pr-3"><span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-medium", STATUS_BADGES[v.status] || STATUS_BADGES.draft)}>{STATUS_LABELS[v.status] || v.status}</span></td>
                      <td className="py-1.5 pr-3 text-right font-mono">{vSlides.length}</td>
                      <td className="py-1.5 pr-3 text-right font-mono">{avgViews || "–"}</td>
                      <td className="py-1.5 pr-3 text-right font-mono">{retention}%</td>
                      <td className="py-1.5 text-right font-mono">{totalReplies || "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Notes for this version */}
      <div className="space-y-1">
        <label className="text-[10px] text-muted-foreground font-medium">Notizen für V{sequence.version}</label>
        <Textarea
          defaultValue={sequence.notes ?? ""}
          onBlur={(e) => { if (e.target.value !== (sequence.notes ?? "")) updateSequence.mutate({ notes: e.target.value || null } as any); }}
          disabled={!canEdit}
          placeholder="Was hat sich geändert? Was soll in der nächsten Version anders sein?"
          className="min-h-[60px] text-xs bg-background border-border resize-none"
        />
      </div>

      {/* Slides */}
      <div className="space-y-2">
        {slides.map((slide, idx) => (
          <SlideCard
            key={slide.id}
            slide={slide}
            index={idx}
            totalSlides={slides.length}
            isPosted={isPosted}
            canEdit={canEdit}
            clientId={clientId}
            sequenceId={sequenceId}
            onUpdateSlide={(updates) => updateSlide.mutate({ id: slide.id, ...updates })}
            onDeleteSlide={() => deleteSlide.mutate(slide.id)}
            onMoveSlide={(dir) => moveSlide(idx, dir)}
          />
        ))}
        {canEdit && (
          <button onClick={() => addSlide.mutate()} className="w-full rounded-lg border border-dashed border-border hover:border-primary/40 text-muted-foreground hover:text-primary transition-colors py-2 text-xs flex items-center justify-center gap-1.5">
            <Plus className="h-3 w-3" /> Story hinzufügen
          </button>
        )}
      </div>

      {/* KPI Summary */}
      {isPosted && slides.length > 0 && (() => {
        const totalSlideViews = slides.reduce((s, sl) => s + (sl.slide_views || 0), 0);
        const totalSlideClicks = slides.filter(s => s.slide_type === "cta").reduce((s, sl) => s + (sl.slide_clicks || 0), 0);
        const totalSlideReplies = slides.reduce((s, sl) => s + (sl.slide_replies || 0), 0);
        const firstViews = slides[0]?.slide_views || 0;
        const lastViews = slides[slides.length - 1]?.slide_views || 0;
        const retention = firstViews > 0 ? ((lastViews / firstViews) * 100).toFixed(1) : null;
        const ctaSlides = slides.filter(s => s.slide_type === "cta");
        const ctaClickRate = ctaSlides.length > 0 && totalSlideClicks > 0 && ctaSlides[0]?.slide_views > 0 ? ((totalSlideClicks / ctaSlides[0].slide_views) * 100).toFixed(1) : null;
        const engagementRate = totalSlideViews > 0 ? ((totalSlideReplies / totalSlideViews) * 100).toFixed(1) : null;
        return totalSlideViews > 0 ? (
          <div className="flex gap-2 flex-wrap">
            <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full font-mono">Ø {Math.round(totalSlideViews / slides.length)} Views</span>
            {retention && <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full font-mono">{retention}% Retention</span>}
            {engagementRate && <span className="text-[10px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full font-mono">{engagementRate}% Engagement</span>}
            {ctaClickRate && <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-mono">{ctaClickRate}% CTR</span>}
          </div>
        ) : null;
      })()}

      {isPosted && (
        <SequenceTracking sequenceId={sequenceId} clientId={clientId} tracking={tracking ?? null} canEdit={canEdit} upsertField={upsertTracking} />
      )}
    </motion.div>
  );
});

SequenceEditor.displayName = "SequenceEditor";

export default SequenceEditor;
