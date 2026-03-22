import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, ArrowLeft, BarChart3, ArrowUp, ArrowDown, X, Upload, Image, Settings, Tag, Eye, MousePointerClick, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { motion } from "framer-motion";

interface Props {
  clientId: string;
  canEdit: boolean;
}

interface Category {
  id: string;
  client_id: string;
  name: string;
  color: string;
  scope: string;
}

interface Sequence {
  id: string;
  client_id: string;
  title: string;
  status: string;
  posted_at: string | null;
  notes: string | null;
  created_at: string;
  category_id: string | null;
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
  slide_replies: number;
  category_id: string | null;
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

const CATEGORY_COLORS = ["blue", "emerald", "amber", "purple", "pink", "orange", "red", "cyan", "teal"];
const COLOR_CLASSES: Record<string, string> = {
  blue: "bg-blue-500/20 text-blue-400",
  emerald: "bg-emerald-500/20 text-emerald-400",
  amber: "bg-amber-500/20 text-amber-400",
  purple: "bg-purple-500/20 text-purple-400",
  pink: "bg-pink-500/20 text-pink-400",
  orange: "bg-orange-500/20 text-orange-400",
  red: "bg-red-500/20 text-red-400",
  cyan: "bg-cyan-500/20 text-cyan-400",
  teal: "bg-teal-500/20 text-teal-400",
};

// ════════════════════════════════════
// Hook: Categories
// ════════════════════════════════════
function useCategories(clientId: string) {
  return useQuery({
    queryKey: ["story-categories", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("story_categories" as any)
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as unknown as Category[];
    },
  });
}

export default function StorySequences({ clientId, canEdit }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("sequences");

  if (selectedId) {
    return <SequenceDetail sequenceId={selectedId} clientId={clientId} canEdit={canEdit} onBack={() => setSelectedId(null)} />;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between mb-4">
          <TabsList className="bg-muted/50 h-8">
            <TabsTrigger value="sequences" className="text-xs h-7 px-3 gap-1.5">
              <Tag className="h-3 w-3" /> Sequenzen
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="text-xs h-7 px-3 gap-1.5">
              <BarChart3 className="h-3 w-3" /> Dashboard
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            {canEdit && <CategoryManager clientId={clientId} />}
          </div>
        </div>
        <TabsContent value="sequences" className="mt-0">
          <SequenceList clientId={clientId} canEdit={canEdit} onSelect={setSelectedId} />
        </TabsContent>
        <TabsContent value="dashboard" className="mt-0">
          <StoryDashboard clientId={clientId} />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}

// ════════════════════════════════════
// LIST VIEW
// ════════════════════════════════════

function SequenceList({ clientId, canEdit, onSelect }: { clientId: string; canEdit: boolean; onSelect: (id: string) => void }) {
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

  const seqCategories = categories.filter(c => c.scope === "sequence");

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-display text-sm font-semibold">Story Sequences</h3>
          {seqCategories.length > 0 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setFilterCat(null)}
                className={cn("text-[10px] px-2 py-0.5 rounded-full transition-colors", !filterCat ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground hover:text-foreground")}
              >
                Alle
              </button>
              {seqCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setFilterCat(filterCat === cat.id ? null : cat.id)}
                  className={cn("text-[10px] px-2 py-0.5 rounded-full transition-colors", filterCat === cat.id ? COLOR_CLASSES[cat.color] || "bg-primary/20 text-primary" : "bg-muted text-muted-foreground hover:text-foreground")}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>
        {canEdit && (
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => createSequence.mutate()}>
            <Plus className="h-3.5 w-3.5" /> Neue Sequenz
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          <p className="mb-3">{filterCat ? "Keine Sequenzen in dieser Kategorie." : "Noch keine Story Sequences erstellt."}</p>
          {canEdit && !filterCat && (
            <Button variant="outline" onClick={() => createSequence.mutate()} className="gap-1.5">
              <Plus className="h-4 w-4" /> Erste Sequenz erstellen
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((seq) => {
            const cat = categories.find(c => c.id === seq.category_id);
            return (
              <button
                key={seq.id}
                onClick={() => onSelect(seq.id)}
                className="bg-card border border-border rounded-lg p-4 text-left hover:border-primary/30 transition-colors w-full"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-display font-semibold text-sm">{seq.title}</p>
                      {cat && (
                        <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-medium", COLOR_CLASSES[cat.color] || "bg-muted text-muted-foreground")}>
                          {cat.name}
                        </span>
                      )}
                    </div>
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
            );
          })}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════
// DETAIL VIEW
// ════════════════════════════════════

function SequenceDetail({ sequenceId, clientId, canEdit, onBack }: { sequenceId: string; clientId: string; canEdit: boolean; onBack: () => void }) {
  const qc = useQueryClient();
  const { data: categories = [] } = useCategories(clientId);

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
            {canEdit && categories.filter(c => c.scope === "sequence").length > 0 && (
              <Select
                value={sequence.category_id || "none"}
                onValueChange={(v) => updateSequence.mutate({ category_id: v === "none" ? null : v } as any)}
              >
                <SelectTrigger className="h-7 text-[10px] w-[110px] bg-transparent border-border">
                  <SelectValue placeholder="Kategorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keine</SelectItem>
                  {categories.filter(c => c.scope === "sequence").map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
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
                  <div className="flex items-center gap-3 pt-1 border-t border-border/50 mt-2 flex-wrap">
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
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground">💬 Replies:</span>
                      <Input
                        type="number"
                        defaultValue={slide.slide_replies || 0}
                        onBlur={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          if (val !== slide.slide_replies) updateSlide.mutate({ id: slide.id, slide_replies: val });
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
        const totalSlideReplies = slides.reduce((s, sl) => s + (sl.slide_replies || 0), 0);
        const ctaSlides = slides.filter(s => s.slide_type === "cta");
        const firstSlideViews = slides[0]?.slide_views || 0;
        const lastSlideViews = slides[slides.length - 1]?.slide_views || 0;
        const retentionRate = firstSlideViews > 0 ? ((lastSlideViews / firstSlideViews) * 100).toFixed(1) : null;
        const ctaClickRate = ctaSlides.length > 0 && totalSlideClicks > 0 && ctaSlides[0]?.slide_views > 0
          ? ((totalSlideClicks / ctaSlides[0].slide_views) * 100).toFixed(1) : null;
        const engagementRate = totalSlideViews > 0 ? ((totalSlideReplies / totalSlideViews) * 100).toFixed(1) : null;

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
            {engagementRate && (
              <span className="text-xs bg-purple-500/10 text-purple-400 px-2.5 py-1 rounded-full font-mono">
                Engagement: {engagementRate}%
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

      {/* Tracking Section – sequence-level extras */}
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

// ════════════════════════════════════
// CATEGORY MANAGER
// ════════════════════════════════════

function CategoryManager({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { data: categories = [] } = useCategories(clientId);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("blue");
  const [newScope, setNewScope] = useState("sequence");

  const addCat = useMutation({
    mutationFn: async () => {
      if (!newName.trim()) return;
      const { error } = await supabase.from("story_categories" as any).insert({
        client_id: clientId,
        name: newName.trim(),
        color: newColor,
        scope: newScope,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      setNewName("");
      qc.invalidateQueries({ queryKey: ["story-categories", clientId] });
      toast.success("Kategorie erstellt");
    },
  });

  const deleteCat = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("story_categories" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["story-categories", clientId] }),
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-xs gap-1.5 text-muted-foreground">
          <Settings className="h-3 w-3" /> Kategorien
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-sm">Kategorien verwalten</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Existing */}
          <div className="space-y-2">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", COLOR_CLASSES[cat.color] || "bg-muted text-muted-foreground")}>
                    {cat.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {cat.scope === "sequence" ? "Sequenz" : "Slide"}
                  </span>
                </div>
                <button onClick={() => deleteCat.mutate(cat.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {categories.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Noch keine Kategorien erstellt.</p>
            )}
          </div>

          {/* Add new */}
          <div className="space-y-2 border-t border-border pt-3">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Kategorie-Name..."
              className="h-8 text-sm"
              onKeyDown={(e) => e.key === "Enter" && addCat.mutate()}
            />
            <div className="flex items-center gap-2">
              <Select value={newScope} onValueChange={setNewScope}>
                <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sequence">Für Sequenzen</SelectItem>
                  <SelectItem value="slide">Für Slides</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-1">
                {CATEGORY_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className={cn("h-5 w-5 rounded-full transition-all", COLOR_CLASSES[c]?.split(" ")[0], newColor === c ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "")}
                  />
                ))}
              </div>
            </div>
            <Button size="sm" className="w-full text-xs gap-1.5" onClick={() => addCat.mutate()} disabled={!newName.trim()}>
              <Plus className="h-3 w-3" /> Hinzufügen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ════════════════════════════════════
// STORY DASHBOARD
// ════════════════════════════════════

function StoryDashboard({ clientId }: { clientId: string }) {
  const { data: categories = [] } = useCategories(clientId);
  const [filterCat, setFilterCat] = useState<string | null>(null);

  const { data: sequences = [] } = useQuery({
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

  const trackedSeqs = sequences.filter(s => s.status === "tracked" || s.status === "posted");
  const filteredSeqs = filterCat ? trackedSeqs.filter(s => s.category_id === filterCat) : trackedSeqs;

  const { data: allSlides = [] } = useQuery({
    queryKey: ["story-all-slides", clientId],
    queryFn: async () => {
      const seqIds = trackedSeqs.map(s => s.id);
      if (!seqIds.length) return [];
      const { data, error } = await supabase
        .from("story_slides" as any)
        .select("*")
        .in("sequence_id", seqIds);
      if (error) throw error;
      return data as unknown as Slide[];
    },
    enabled: trackedSeqs.length > 0,
  });

  const { data: allTracking = [] } = useQuery({
    queryKey: ["story-all-tracking", clientId],
    queryFn: async () => {
      const seqIds = trackedSeqs.map(s => s.id);
      if (!seqIds.length) return [];
      const { data, error } = await supabase
        .from("story_sequence_tracking" as any)
        .select("*")
        .in("sequence_id", seqIds);
      if (error) throw error;
      return data as unknown as Tracking[];
    },
    enabled: trackedSeqs.length > 0,
  });

  const stats = useMemo(() => {
    const relevantSeqIds = new Set(filteredSeqs.map(s => s.id));
    const slides = allSlides.filter(sl => relevantSeqIds.has(sl.sequence_id));
    const tracking = allTracking.filter(t => relevantSeqIds.has(t.sequence_id));

    const totalSlideViews = slides.reduce((s, sl) => s + (sl.slide_views || 0), 0);
    const totalSlideClicks = slides.filter(sl => sl.slide_type === "cta").reduce((s, sl) => s + (sl.slide_clicks || 0), 0);
    const totalReplies = tracking.reduce((s, t) => s + (t.total_replies || 0), 0);
    const totalProfileVisits = tracking.reduce((s, t) => s + (t.total_profile_visits || 0), 0);
    const totalTriggers = tracking.reduce((s, t) => s + (t.keyword_triggers || 0), 0);
    const totalLinkClicks = tracking.reduce((s, t) => s + (t.total_link_clicks || 0), 0);

    // Retention: avg of (last slide views / first slide views) per sequence
    let retentionSum = 0, retentionCount = 0;
    for (const seq of filteredSeqs) {
      const seqSlides = slides.filter(sl => sl.sequence_id === seq.id).sort((a, b) => a.sort_order - b.sort_order);
      if (seqSlides.length >= 2 && seqSlides[0].slide_views > 0) {
        retentionSum += (seqSlides[seqSlides.length - 1].slide_views / seqSlides[0].slide_views) * 100;
        retentionCount++;
      }
    }

    const ctaSlidesWithViews = slides.filter(sl => sl.slide_type === "cta" && sl.slide_views > 0);
    const avgCTR = ctaSlidesWithViews.length > 0
      ? ctaSlidesWithViews.reduce((s, sl) => s + (sl.slide_clicks / sl.slide_views) * 100, 0) / ctaSlidesWithViews.length
      : 0;

    return {
      sequenceCount: filteredSeqs.length,
      totalSlideViews,
      totalSlideClicks,
      totalReplies,
      totalProfileVisits,
      totalTriggers,
      totalLinkClicks,
      avgRetention: retentionCount > 0 ? (retentionSum / retentionCount).toFixed(1) : null,
      avgCTR: avgCTR > 0 ? avgCTR.toFixed(1) : null,
      avgViewsPerSlide: slides.length > 0 ? Math.round(totalSlideViews / slides.length) : 0,
    };
  }, [filteredSeqs, allSlides, allTracking]);

  const seqCategories = categories.filter(c => c.scope === "sequence");

  // Per-sequence breakdown
  const seqBreakdown = useMemo(() => {
    return filteredSeqs.map(seq => {
      const slides = allSlides.filter(sl => sl.sequence_id === seq.id).sort((a, b) => a.sort_order - b.sort_order);
      const tracking = allTracking.find(t => t.sequence_id === seq.id);
      const totalViews = slides.reduce((s, sl) => s + (sl.slide_views || 0), 0);
      const ctaClicks = slides.filter(sl => sl.slide_type === "cta").reduce((s, sl) => s + (sl.slide_clicks || 0), 0);
      const firstViews = slides[0]?.slide_views || 0;
      const lastViews = slides[slides.length - 1]?.slide_views || 0;
      const retention = firstViews > 0 ? ((lastViews / firstViews) * 100).toFixed(1) : null;
      const cat = categories.find(c => c.id === seq.category_id);
      return { seq, slides: slides.length, totalViews, ctaClicks, retention, replies: tracking?.total_replies || 0, profileVisits: tracking?.total_profile_visits || 0, cat };
    });
  }, [filteredSeqs, allSlides, allTracking, categories]);

  return (
    <div className="space-y-6">
      {/* Category filter */}
      {seqCategories.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setFilterCat(null)}
            className={cn("text-[10px] px-2 py-0.5 rounded-full transition-colors", !filterCat ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground hover:text-foreground")}
          >
            Alle
          </button>
          {seqCategories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setFilterCat(filterCat === cat.id ? null : cat.id)}
              className={cn("text-[10px] px-2 py-0.5 rounded-full transition-colors", filterCat === cat.id ? COLOR_CLASSES[cat.color] || "bg-primary/20 text-primary" : "bg-muted text-muted-foreground hover:text-foreground")}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard icon={<Eye className="h-4 w-4" />} label="Ø Views / Slide" value={stats.avgViewsPerSlide.toLocaleString("de-DE")} />
        <KPICard icon={<TrendingUp className="h-4 w-4" />} label="Ø Retention" value={stats.avgRetention ? `${stats.avgRetention}%` : "–"} />
        <KPICard icon={<MousePointerClick className="h-4 w-4" />} label="Ø CTA Click Rate" value={stats.avgCTR ? `${stats.avgCTR}%` : "–"} />
        <KPICard icon={<Users className="h-4 w-4" />} label="Profilbesuche" value={stats.totalProfileVisits.toLocaleString("de-DE")} />
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <MiniStat label="Sequenzen" value={stats.sequenceCount} />
        <MiniStat label="Gesamt Views" value={stats.totalSlideViews} />
        <MiniStat label="CTA Klicks" value={stats.totalSlideClicks} />
        <MiniStat label="Replies" value={stats.totalReplies} />
        <MiniStat label="Triggers" value={stats.totalTriggers} />
        <MiniStat label="Link Klicks" value={stats.totalLinkClicks} />
      </div>

      {/* Per-sequence breakdown */}
      <div>
        <h4 className="font-display text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Sequenz-Übersicht</h4>
        {seqBreakdown.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">Keine getrackten Sequenzen vorhanden.</p>
        ) : (
          <div className="space-y-2">
            {seqBreakdown.map(({ seq, slides, totalViews, ctaClicks, retention, replies, profileVisits, cat }) => (
              <div key={seq.id} className="bg-card border border-border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <p className="font-display font-semibold text-xs">{seq.title}</p>
                    {cat && (
                      <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-medium", COLOR_CLASSES[cat.color])}>
                        {cat.name}
                      </span>
                    )}
                    <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-medium", STATUS_BADGES[seq.status])}>
                      {STATUS_LABELS[seq.status]}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {seq.posted_at && format(new Date(seq.posted_at), "dd.MM.yyyy", { locale: de })}
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  <MiniStat label="Slides" value={slides} />
                  <MiniStat label="Views" value={totalViews} />
                  <MiniStat label="CTA Klicks" value={ctaClicks} />
                  <MiniStat label="Retention" value={retention ? `${retention}%` : "–"} isText />
                  <MiniStat label="Replies" value={replies} />
                  <MiniStat label="Profilbesuche" value={profileVisits} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KPICard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-[10px]">{label}</span>
      </div>
      <p className="font-mono font-bold text-lg">{value}</p>
    </div>
  );
}

function MiniStat({ label, value, isText }: { label: string; value: number | string; isText?: boolean }) {
  return (
    <div className="text-center">
      <p className="font-mono font-bold text-sm">{isText ? value : typeof value === "number" ? value.toLocaleString("de-DE") : value}</p>
      <p className="text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}
