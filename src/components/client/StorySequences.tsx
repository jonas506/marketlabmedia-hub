import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Trash2, ArrowLeft, BarChart3, ArrowUp, ArrowDown, X, Upload, Image } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { motion } from "framer-motion";

interface Props {
  clientId: string;
  canEdit: boolean;
}

interface Sequence {
  id: string;
  client_id: string;
  title: string;
  status: string;
  posted_at: string | null;
  notes: string | null;
  created_at: string;
}

interface Slide {
  id: string;
  sequence_id: string;
  sort_order: number;
  content_text: string;
  slide_type: string;
  image_url: string | null;
  slide_views: number;
  slide_clicks: number;
}

interface Tracking {
  id: string;
  sequence_id: string;
  total_views: number;
  total_replies: number;
  total_link_clicks: number;
  total_profile_visits: number;
  keyword_triggers: number;
  screenshot_urls: string[];
  notes: string | null;
}

const STATUS_BADGES: Record<string, string> = {
  draft: "bg-slate-500/20 text-slate-400",
  posted: "bg-blue-500/20 text-blue-400",
  tracked: "bg-emerald-500/20 text-emerald-400",
};
const STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf",
  posted: "Gepostet",
  tracked: "Getrackt",
};

const SLIDE_TYPES = [
  { value: "text", label: "Text", icon: "📝" },
  { value: "poll", label: "Poll", icon: "📊" },
  { value: "cta", label: "CTA", icon: "🔗" },
  { value: "video", label: "Video", icon: "🎬" },
  { value: "image", label: "Bild", icon: "🖼️" },
];

export default function StorySequences({ clientId, canEdit }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (selectedId) {
    return <SequenceDetail sequenceId={selectedId} clientId={clientId} canEdit={canEdit} onBack={() => setSelectedId(null)} />;
  }

  return <SequenceList clientId={clientId} canEdit={canEdit} onSelect={setSelectedId} />;
}

// ════════════════════════════════════
// LIST VIEW
// ════════════════════════════════════

function SequenceList({ clientId, canEdit, onSelect }: { clientId: string; canEdit: boolean; onSelect: (id: string) => void }) {
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
      (data as any[]).forEach((d) => {
        counts[d.sequence_id] = (counts[d.sequence_id] || 0) + 1;
      });
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
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["story-sequences", clientId] });
      onSelect(data.id);
      toast.success("Sequenz erstellt");
    },
    onError: () => toast.error("Fehler beim Erstellen"),
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-sm font-semibold">Story Sequences</h3>
        {canEdit && (
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => createSequence.mutate()}>
            <Plus className="h-3.5 w-3.5" /> Neue Sequenz
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" /></div>
      ) : sequences.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          <p className="mb-3">Noch keine Story Sequences erstellt.</p>
          {canEdit && (
            <Button variant="outline" onClick={() => createSequence.mutate()} className="gap-1.5">
              <Plus className="h-4 w-4" /> Erste Sequenz erstellen
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {sequences.map((seq) => (
            <button
              key={seq.id}
              onClick={() => onSelect(seq.id)}
              className="bg-card border border-border rounded-lg p-4 text-left hover:border-primary/30 transition-colors w-full"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display font-semibold text-sm">{seq.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {slideCounts[seq.id] ?? 0} Stories
                    {seq.posted_at && ` · Gepostet ${format(new Date(seq.posted_at), "dd.MM.yyyy", { locale: de })}`}
                  </p>
                </div>
                <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", STATUS_BADGES[seq.status])}>
                  {STATUS_LABELS[seq.status]}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ════════════════════════════════════
// DETAIL VIEW
// ════════════════════════════════════

function SequenceDetail({ sequenceId, clientId, canEdit, onBack }: { sequenceId: string; clientId: string; canEdit: boolean; onBack: () => void }) {
  const qc = useQueryClient();

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
      const { data, error } = await supabase
        .from("story_slides" as any)
        .select("*")
        .eq("sequence_id", sequenceId)
        .order("sort_order", { ascending: true });
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

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["story-sequence", sequenceId] });
    qc.invalidateQueries({ queryKey: ["story-slides", sequenceId] });
    qc.invalidateQueries({ queryKey: ["story-tracking", sequenceId] });
    qc.invalidateQueries({ queryKey: ["story-sequences", clientId] });
  };

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

  // ── Slide mutations ──
  const addSlide = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("story_slides" as any).insert({
        sequence_id: sequenceId,
        sort_order: slides.length,
        content_text: "",
        slide_type: "text",
      } as any);
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

  if (!sequence) return <div className="flex justify-center py-12"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <div>
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 group transition-colors">
          <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" /> Alle Sequenzen
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            {canEdit ? (
              <Input
                defaultValue={sequence.title}
                onBlur={(e) => {
                  if (e.target.value !== sequence.title) updateSequence.mutate({ title: e.target.value } as any);
                }}
                className="font-display font-semibold text-sm h-9 bg-transparent border-border max-w-xs"
              />
            ) : (
              <h3 className="font-display font-semibold text-sm">{sequence.title}</h3>
            )}
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0", STATUS_BADGES[sequence.status])}>
              {STATUS_LABELS[sequence.status]}
            </span>
          </div>

          {canEdit && (
            <div className="flex items-center gap-2">
              {sequence.status === "draft" && (
                <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={markPosted}>
                  ✓ Als gepostet markieren
                </Button>
              )}
              {sequence.status === "posted" && (
                <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => document.getElementById("tracking-section")?.scrollIntoView({ behavior: "smooth" })}>
                  <BarChart3 className="h-3 w-3" /> Tracking eintragen
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Sequenz löschen?</AlertDialogTitle>
                    <AlertDialogDescription>Diese Aktion kann nicht rückgängig gemacht werden.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteSequence.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Löschen</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </div>

      {/* Slides */}
      <div>
        <h4 className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider mb-3">Skript</h4>
        <div className="space-y-3">
          {slides.map((slide, idx) => {
            const isTracking = sequence.status === "posted" || sequence.status === "tracked";
            return (
            <div key={slide.id} className="bg-card border border-border rounded-lg p-3 flex gap-3">
              {/* Number + Move */}
              <div className="flex flex-col items-center gap-1 shrink-0">
                <span className="bg-primary/10 text-primary rounded-full h-6 w-6 flex items-center justify-center font-mono text-xs font-bold">
                  {idx + 1}
                </span>
                {canEdit && (
                  <>
                    <button onClick={() => moveSlide(idx, -1)} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors">
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button onClick={() => moveSlide(idx, 1)} disabled={idx === slides.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors">
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  {canEdit ? (
                    <Select value={slide.slide_type} onValueChange={(v) => updateSlide.mutate({ id: slide.id, slide_type: v })}>
                      <SelectTrigger className="h-7 text-xs w-[90px] bg-transparent border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SLIDE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-xs text-muted-foreground">{SLIDE_TYPES.find((t) => t.value === slide.slide_type)?.icon} {SLIDE_TYPES.find((t) => t.value === slide.slide_type)?.label}</span>
                  )}
                  {canEdit && (
                    <button onClick={() => deleteSlide.mutate(slide.id)} className="ml-auto text-muted-foreground hover:text-destructive transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Image upload – available for ALL slide types */}
                <div className="flex items-start gap-3">
                  {slide.image_url ? (
                    <div className="relative group shrink-0">
                      <img src={slide.image_url} alt="" className="h-24 w-24 object-cover rounded-md border border-border" />
                      {canEdit && (
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center">
                          <SlideImageUpload
                            clientId={clientId}
                            sequenceId={sequenceId}
                            slideId={slide.id}
                            currentUrl={slide.image_url}
                            onUploaded={(url) => updateSlide.mutate({ id: slide.id, image_url: url })}
                          />
                        </div>
                      )}
                    </div>
                  ) : canEdit ? (
                    <SlideImageUploadBox
                      clientId={clientId}
                      sequenceId={sequenceId}
                      slideId={slide.id}
                      onUploaded={(url) => updateSlide.mutate({ id: slide.id, image_url: url })}
                    />
                  ) : null}

                  <div className="flex-1 space-y-2">
                    {canEdit ? (
                      <Textarea
                        defaultValue={slide.content_text}
                        onBlur={(e) => {
                          if (e.target.value !== slide.content_text) updateSlide.mutate({ id: slide.id, content_text: e.target.value });
                        }}
                        placeholder="Story-Text eingeben..."
                        className="min-h-[60px] text-sm bg-background border-border resize-none"
                      />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{slide.content_text || <span className="text-muted-foreground italic">Kein Text</span>}</p>
                    )}
                  </div>
                </div>

                {/* Per-slide tracking (only when posted/tracked) */}
                {isTracking && (
                  <div className="flex items-center gap-3 pt-1 border-t border-border/50 mt-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground">👁 Views:</span>
                      <Input
                        type="number"
                        defaultValue={slide.slide_views || 0}
                        onBlur={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          if (val !== slide.slide_views) updateSlide.mutate({ id: slide.id, slide_views: val });
                        }}
                        disabled={!canEdit}
                        className="h-6 w-16 text-xs font-mono bg-background border-border px-1.5"
                      />
                    </div>
                    {slide.slide_type === "cta" && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground">🔗 Klicks:</span>
                        <Input
                          type="number"
                          defaultValue={slide.slide_clicks || 0}
                          onBlur={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            if (val !== slide.slide_clicks) updateSlide.mutate({ id: slide.id, slide_clicks: val });
                          }}
                          disabled={!canEdit}
                          className="h-6 w-16 text-xs font-mono bg-background border-border px-1.5"
                        />
                      </div>
                    )}
                    {slide.slide_views > 0 && slide.slide_type === "cta" && slide.slide_clicks > 0 && (
                      <span className="text-[10px] font-mono text-emerald-400">
                        CTR: {((slide.slide_clicks / slide.slide_views) * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )})}
        </div>

        {canEdit && (
          <Button variant="outline" size="sm" className="mt-3 text-xs gap-1.5" onClick={() => addSlide.mutate()}>
            <Plus className="h-3 w-3" /> Story hinzufügen
          </Button>
        )}
      </div>

      {/* Per-Slide KPI Summary */}
      {(sequence.status === "posted" || sequence.status === "tracked") && slides.length > 0 && (() => {
        const totalSlideViews = slides.reduce((s, sl) => s + (sl.slide_views || 0), 0);
        const totalSlideClicks = slides.filter(s => s.slide_type === "cta").reduce((s, sl) => s + (sl.slide_clicks || 0), 0);
        const ctaSlides = slides.filter(s => s.slide_type === "cta");
        const firstSlideViews = slides[0]?.slide_views || 0;
        const lastSlideViews = slides[slides.length - 1]?.slide_views || 0;
        const retentionRate = firstSlideViews > 0 ? ((lastSlideViews / firstSlideViews) * 100).toFixed(1) : null;
        const ctaClickRate = ctaSlides.length > 0 && totalSlideClicks > 0 && ctaSlides[0]?.slide_views > 0
          ? ((totalSlideClicks / ctaSlides[0].slide_views) * 100).toFixed(1) : null;

        return totalSlideViews > 0 ? (
          <div className="flex gap-3 flex-wrap">
            <span className="text-xs bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-full font-mono">
              Ø Views: {Math.round(totalSlideViews / slides.length)}
            </span>
            {retentionRate && (
              <span className="text-xs bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-full font-mono">
                Retention: {retentionRate}%
              </span>
            )}
            {ctaClickRate && (
              <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full font-mono">
                CTA Click Rate: {ctaClickRate}%
              </span>
            )}
          </div>
        ) : null;
      })()}

      {/* Tracking Section */}
      {(sequence.status === "posted" || sequence.status === "tracked") && (
        <TrackingSection
          id="tracking-section"
          sequenceId={sequenceId}
          clientId={clientId}
          tracking={tracking ?? null}
          canEdit={canEdit}
          onSaved={() => {
            updateSequence.mutate({ status: "tracked" } as any);
            invalidateAll();
          }}
        />
      )}
    </motion.div>
  );
}

// ════════════════════════════════════
// TRACKING SECTION
// ════════════════════════════════════

function TrackingSection({
  id,
  sequenceId,
  clientId,
  tracking,
  canEdit,
  onSaved,
}: {
  id?: string;
  sequenceId: string;
  clientId: string;
  tracking: Tracking | null;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [views, setViews] = useState(tracking?.total_views ?? 0);
  const [replies, setReplies] = useState(tracking?.total_replies ?? 0);
  const [clicks, setClicks] = useState(tracking?.total_link_clicks ?? 0);
  const [profileVisits, setProfileVisits] = useState(tracking?.total_profile_visits ?? 0);
  const [triggers, setTriggers] = useState(tracking?.keyword_triggers ?? 0);
  const [notes, setNotes] = useState(tracking?.notes ?? "");
  const [screenshots, setScreenshots] = useState<string[]>(tracking?.screenshot_urls ?? []);
  const [uploading, setUploading] = useState(false);

  // Sync from tracking prop when it changes
  const trackingId = tracking?.id;

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        sequence_id: sequenceId,
        total_views: views,
        total_replies: replies,
        total_link_clicks: clicks,
        total_profile_visits: profileVisits,
        keyword_triggers: triggers,
        screenshot_urls: screenshots,
        notes: notes || null,
      };
      if (tracking) {
        const { error } = await supabase.from("story_sequence_tracking" as any).update(payload as any).eq("id", tracking.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("story_sequence_tracking" as any).insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      onSaved();
      toast.success("Performance gespeichert");
    },
    onError: () => toast.error("Fehler beim Speichern"),
  });

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      const newUrls: string[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const path = `${clientId}/${sequenceId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("story-screenshots").upload(path, file);
        if (error) throw error;
        const { data: urlData } = supabase.storage.from("story-screenshots").getPublicUrl(path);
        newUrls.push(urlData.publicUrl);
      }
      setScreenshots((prev) => [...prev, ...newUrls]);
      toast.success(`${files.length} Screenshot(s) hochgeladen`);
    } catch {
      toast.error("Upload fehlgeschlagen");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeScreenshot = (url: string) => {
    setScreenshots((prev) => prev.filter((u) => u !== url));
  };

  const engagementRate = views > 0 ? ((replies / views) * 100).toFixed(1) : null;
  const clickRate = views > 0 ? ((clicks / views) * 100).toFixed(1) : null;

  return (
    <div id={id} className="bg-card border border-border rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary" />
        <h4 className="font-display font-semibold text-sm">Performance</h4>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <NumberField label="Views gesamt" value={views} onChange={setViews} disabled={!canEdit} />
        <NumberField label="Replies gesamt" value={replies} onChange={setReplies} disabled={!canEdit} />
        <NumberField label="Link-Klicks" value={clicks} onChange={setClicks} disabled={!canEdit} />
        <NumberField label="Profilbesuche" value={profileVisits} onChange={setProfileVisits} disabled={!canEdit} />
        <NumberField label="Keyword-Triggers" value={triggers} onChange={setTriggers} disabled={!canEdit} />
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Notizen</label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={!canEdit}
          placeholder="Beobachtungen, Learnings..."
          className="min-h-[60px] text-sm bg-background border-border resize-none"
        />
      </div>

      {/* Screenshots */}
      <div>
        <label className="text-xs text-muted-foreground mb-2 block">Screenshots</label>
        <div className="flex flex-wrap gap-2">
          {screenshots.map((url) => (
            <div key={url} className="relative group">
              <img src={url} alt="" className="h-20 w-20 object-cover rounded-md border border-border" />
              {canEdit && (
                <button
                  onClick={() => removeScreenshot(url)}
                  className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full h-4 w-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          ))}
          {canEdit && (
            <label className="h-20 w-20 rounded-md border border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors cursor-pointer">
              {uploading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
              ) : (
                <>
                  <Upload className="h-4 w-4 mb-1" />
                  <span className="text-[9px]">Upload</span>
                </>
              )}
              <input type="file" accept="image/*" multiple onChange={handleScreenshotUpload} className="hidden" />
            </label>
          )}
        </div>
      </div>

      {/* KPIs */}
      {views > 0 && (
        <div className="flex gap-3 flex-wrap">
          {engagementRate && (
            <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full font-mono">
              Engagement: {engagementRate}%
            </span>
          )}
          {clickRate && (
            <span className="text-xs bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-full font-mono">
              Click Rate: {clickRate}%
            </span>
          )}
        </div>
      )}

      {canEdit && (
        <Button size="sm" className="gap-1.5" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Speichert..." : "Performance speichern"}
        </Button>
      )}
    </div>
  );
}

// ════════════════════════════════════
// HELPERS
// ════════════════════════════════════

function NumberField({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled: boolean }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        disabled={disabled}
        className="h-8 text-sm font-mono bg-background border-border"
      />
    </div>
  );
}

function SlideImageUpload({ clientId, sequenceId, slideId, currentUrl, onUploaded }: { clientId: string; sequenceId: string; slideId: string; currentUrl: string | null; onUploaded: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${clientId}/${sequenceId}/slides/${slideId}.${ext}`;
      const { error } = await supabase.storage.from("story-screenshots").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("story-screenshots").getPublicUrl(path);
      onUploaded(data.publicUrl);
      toast.success("Bild hochgeladen");
    } catch {
      toast.error("Upload fehlgeschlagen");
    } finally {
      setUploading(false);
    }
  };

  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary cursor-pointer transition-colors">
      {uploading ? <div className="h-3 w-3 animate-spin rounded-full border border-primary/30 border-t-primary" /> : <Image className="h-3 w-3" />}
      {currentUrl ? "Bild ersetzen" : "Bild hochladen"}
      <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
    </label>
  );
}

function SlideImageUploadBox({ clientId, sequenceId, slideId, onUploaded }: { clientId: string; sequenceId: string; slideId: string; onUploaded: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${clientId}/${sequenceId}/slides/${slideId}.${ext}`;
      const { error } = await supabase.storage.from("story-screenshots").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("story-screenshots").getPublicUrl(path);
      onUploaded(data.publicUrl);
      toast.success("Bild hochgeladen");
    } catch {
      toast.error("Upload fehlgeschlagen");
    } finally {
      setUploading(false);
    }
  };

  return (
    <label className="h-24 w-24 shrink-0 rounded-md border border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors cursor-pointer">
      {uploading ? (
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      ) : (
        <>
          <Image className="h-5 w-5 mb-1" />
          <span className="text-[9px]">Bild</span>
        </>
      )}
      <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
    </label>
  );
}
