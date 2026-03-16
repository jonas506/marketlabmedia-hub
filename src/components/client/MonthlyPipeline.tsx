import { useState, useMemo, useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { ChevronRight, Filter, Plus, ExternalLink, Link as LinkIcon, Trash2, Sparkles, CalendarIcon, AlertTriangle, MessageSquare, ListPlus, FileText, Copy, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import CaptionStudio from "./CaptionStudio";
import PieceDetailDialog from "./PieceDetailDialog";

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
  preview_link?: string | null;
  deadline?: string | null;
  priority?: string | null;
  client_comment?: string | null;
  script_text?: string | null;
  transcript?: string | null;
  caption?: string | null;
  video_path?: string | null;
}

const PRIORITY_OPTIONS = [
  { value: "low", label: "Niedrig", color: "text-muted-foreground", bg: "bg-muted/60" },
  { value: "normal", label: "Normal", color: "text-foreground", bg: "bg-muted/60" },
  { value: "high", label: "Hoch", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/10" },
  { value: "urgent", label: "Dringend", color: "text-destructive", bg: "bg-destructive/10" },
];

interface MonthlyPipelineProps {
  clientId: string;
  contentPieces: ContentPiece[];
  month: number;
  year: number;
  canEdit: boolean;
}

const PIPELINE_CONFIG: Record<string, { label: string; emoji: string; phases: { key: string; label: string; emoji: string }[]; addLabel: string }> = {
  reel: {
    label: "Reels",
    emoji: "🎬",
    phases: [
      { key: "script", label: "Skript", emoji: "📝" },
      { key: "filmed", label: "Gedreht", emoji: "📹" },
      { key: "editing", label: "Im Schnitt", emoji: "✂️" },
      { key: "review", label: "Zur Freigabe", emoji: "👁️" },
      { key: "approved", label: "Freigegeben", emoji: "✅" },
      { key: "handed_over", label: "Übergeben", emoji: "🚀" },
    ],
    addLabel: "+ Reel",
  },
  carousel: {
    label: "Karussells",
    emoji: "🖼️",
    phases: [
      { key: "script", label: "Skript", emoji: "📝" },
      { key: "review", label: "Zur Freigabe", emoji: "👁️" },
      { key: "approved", label: "Freigegeben", emoji: "✅" },
      { key: "handed_over", label: "Übergeben", emoji: "🚀" },
    ],
    addLabel: "+ Karussell",
  },
  story: {
    label: "Story Ads",
    emoji: "📱",
    phases: [
      { key: "filmed", label: "Gedreht", emoji: "📹" },
      { key: "editing", label: "Im Schnitt", emoji: "✂️" },
      { key: "review", label: "Zur Freigabe", emoji: "👁️" },
      { key: "approved", label: "Freigegeben", emoji: "✅" },
      { key: "handed_over", label: "Übergeben", emoji: "🚀" },
    ],
    addLabel: "+ Story Ad",
  },
  ad: {
    label: "Ads",
    emoji: "📢",
    phases: [
      { key: "filmed", label: "Gedreht", emoji: "📹" },
      { key: "editing", label: "Im Schnitt", emoji: "✂️" },
      { key: "review", label: "Zur Freigabe", emoji: "👁️" },
      { key: "approved", label: "Freigegeben", emoji: "✅" },
      { key: "handed_over", label: "Übergeben", emoji: "🚀" },
    ],
    addLabel: "+ Ad",
  },
  youtube_longform: {
    label: "YouTube",
    emoji: "🎥",
    phases: [
      { key: "filmed", label: "Gedreht", emoji: "📹" },
      { key: "editing", label: "Im Schnitt", emoji: "✂️" },
      { key: "review", label: "Zur Freigabe", emoji: "👁️" },
      { key: "approved", label: "Freigegeben", emoji: "✅" },
      { key: "handed_over", label: "Übergeben", emoji: "🚀" },
    ],
    addLabel: "+ YouTube Video",
  },
};

const fireConfetti = () => {
  confetti({
    particleCount: 80,
    spread: 60,
    origin: { y: 0.7 },
    colors: ["#0083F7", "#21089B", "#FAFBFF", "#10B981"],
  });
};

const fireSmallCelebration = () => {
  confetti({
    particleCount: 30,
    spread: 40,
    origin: { y: 0.8, x: 0.7 },
    colors: ["#0083F7", "#21089B"],
    gravity: 1.2,
  });
};

const MonthlyPipeline: React.FC<MonthlyPipelineProps> = ({ clientId, contentPieces, month, year, canEdit }) => {
  const qc = useQueryClient();
  const [activeType, setActiveType] = useState<string>("reel");
  const [activePhase, setActivePhase] = useState<string>(PIPELINE_CONFIG["reel"].phases[0].key);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterPerson, setFilterPerson] = useState<string>("all");
  const [recentlyMoved, setRecentlyMoved] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkTitles, setBulkTitles] = useState("");
  const [captionStudioOpen, setCaptionStudioOpen] = useState(false);
  const [detailPiece, setDetailPiece] = useState<ContentPiece | null>(null);
  const [localTitles, setLocalTitles] = useState<Record<string, string>>({});
  const titleTimerRef = useRef<Record<string, NodeJS.Timeout>>({});

  const config = PIPELINE_CONFIG[activeType];

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

  const PRIORITY_WEIGHT: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

  const phasePieces = useMemo(() => {
    let filtered = monthPieces.filter((c) => c.phase === activePhase);
    if (filterPerson !== "all") filtered = filtered.filter((c) => c.assigned_to === filterPerson);
    return [...filtered].sort((a, b) => {
      const pa = PRIORITY_WEIGHT[a.priority || "normal"] ?? 2;
      const pb = PRIORITY_WEIGHT[b.priority || "normal"] ?? 2;
      if (pa !== pb) return pa - pb;
      if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return 0;
    });
  }, [monthPieces, activePhase, filterPerson]);

  const nextPhaseMap = useMemo(() => {
    const phases = config.phases;
    const map: Record<string, string> = {};
    for (let i = 0; i < phases.length - 1; i++) {
      map[phases[i].key] = phases[i + 1].key;
    }
    return map;
  }, [config]);

  const getPhaseLabel = useCallback((key: string) => config.phases.find(p => p.key === key)?.label ?? key, [config]);

  // Trigger transcription for a piece
  const triggerTranscription = useCallback(async (pieceId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("transcribe-caption", {
        body: { piece_id: pieceId },
      });
      if (error) throw error;
      if (data?.success) {
        qc.invalidateQueries({ queryKey: ["content-pieces", clientId] });
        toast.success("🎙️ Transkript & Caption erstellt!", { description: "Wurde automatisch generiert" });
      }
    } catch (err: any) {
      console.error("Transcription error:", err);
      toast.error("Transkription fehlgeschlagen", { description: err.message || "Bitte manuell versuchen" });
    }
  }, [qc, clientId]);

  // Move single piece
  const movePiece = useCallback(async (pieceId: string, nextPhase: string) => {
    await supabase.from("content_pieces").update({ phase: nextPhase }).eq("id", pieceId);
    
    setRecentlyMoved(prev => new Set(prev).add(pieceId));
    setTimeout(() => setRecentlyMoved(prev => { const s = new Set(prev); s.delete(pieceId); return s; }), 600);
    
    if (nextPhase === "handed_over") {
      fireConfetti();
      toast.success(`${config.emoji} ${config.label.slice(0, -1)} übergeben!`, { description: "Zählt jetzt ins Kontingent 🎯" });
    } else if (nextPhase === "approved") {
      fireSmallCelebration();
      toast.success(`✅ Freigegeben!`, { description: "Kunde hat freigegeben" });
      // Auto-trigger transcription for video types with preview link
      const piece = monthPieces.find(p => p.id === pieceId);
      if (piece?.preview_link && piece.type !== "carousel") {
        toast.info("🎙️ Transkription wird gestartet...", { description: "Caption wird automatisch generiert" });
        triggerTranscription(pieceId);
      }
    } else if (nextPhase === "review") {
      toast.success(`👁️ Zur Freigabe`, { description: "Warte auf Kunden-Freigabe" });
    } else {
      toast.success(`→ ${getPhaseLabel(nextPhase)}`);
    }
    
    qc.invalidateQueries({ queryKey: ["content-pieces", clientId] });
  }, [qc, clientId, config, getPhaseLabel, monthPieces, triggerTranscription]);

  // Bulk move
  const bulkMove = useMutation({
    mutationFn: async () => {
      const next = nextPhaseMap[activePhase];
      if (!next) return;
      const ids = [...selected];
      await supabase.from("content_pieces").update({ phase: next }).in("id", ids);
      return { next, count: ids.length };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["content-pieces", clientId] });
      setSelected(new Set());
      if (result) {
        if (result.next === "handed_over") {
          fireConfetti();
          toast.success(`🚀 ${result.count} Pieces übergeben!`, { description: "Alles zählt jetzt ins Kontingent" });
        } else if (result.next === "approved") {
          fireSmallCelebration();
          toast.success(`✅ ${result.count} Pieces freigegeben!`);
        } else {
          toast.success(`${result.count} Pieces → ${getPhaseLabel(result.next)}`);
        }
      }
    },
  });

  // Add piece
  const addPiece = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("content_pieces").insert({
        client_id: clientId,
        type: activeType,
        phase: activePhase,
        target_month: month,
        target_year: year,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-pieces", clientId] });
      toast.success(`${config.emoji} Neues Piece erstellt`, { description: `In "${getPhaseLabel(activePhase)}"` });
    },
    onError: (err: any) => {
      console.error("Add piece error:", err);
      toast.error("Fehler beim Erstellen", { description: err.message });
    },
  });

  // Bulk add pieces
  const bulkAddPieces = useMutation({
    mutationFn: async (titles: string[]) => {
      const rows = titles.map((title) => ({
        client_id: clientId,
        type: activeType,
        phase: config.phases[0].key,
        target_month: month,
        target_year: year,
        title: title.trim() || null,
      }));
      await supabase.from("content_pieces").insert(rows);
      return rows.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["content-pieces", clientId] });
      setBulkOpen(false);
      setBulkTitles("");
      setActivePhase(config.phases[0].key);
      toast.success(`${config.emoji} ${count} Pieces erstellt`, { description: `In "${getPhaseLabel(config.phases[0].key)}"` });
    },
  });

  const handleBulkCreate = () => {
    const lines = bulkTitles.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      toast.error("Bitte mindestens einen Titel eingeben");
      return;
    }
    bulkAddPieces.mutate(lines);
  };

  const updatePiece = async (pieceId: string, updates: Record<string, any>) => {
    await supabase.from("content_pieces").update(updates).eq("id", pieceId);
    qc.invalidateQueries({ queryKey: ["content-pieces", clientId] });
  };

  const deletePiece = async (pieceId: string) => {
    await supabase.from("content_pieces").delete().eq("id", pieceId);
    qc.invalidateQueries({ queryKey: ["content-pieces", clientId] });
    toast("Piece gelöscht", { description: "Wurde aus der Pipeline entfernt" });
  };

  const toggleSelect = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const toggleAll = () => {
    if (selected.size === phasePieces.length) setSelected(new Set());
    else setSelected(new Set(phasePieces.map((c) => c.id)));
  };

  const monthOptions = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(year, month - 1 + i);
    return { month: d.getMonth() + 1, year: d.getFullYear(), label: format(d, "MM/yyyy", { locale: de }) };
  });

  const phaseSummary = config.phases.map((p) => ({
    ...p,
    count: monthPieces.filter((c) => c.phase === p.key).length,
  }));

  const totalPieces = monthPieces.length;
  const handedOver = monthPieces.filter(c => c.phase === "handed_over" || c.phase === "approved").length;
  const progress = totalPieces > 0 ? Math.round((handedOver / totalPieces) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-border bg-card overflow-hidden"
    >
      {/* Header - Monday group style */}
      <div className="flex items-center gap-3 px-4 py-3 bg-surface-elevated border-b border-border">
        <div className="w-1 h-5 rounded-full bg-primary" />
        <h3 className="font-display text-sm font-semibold">Material-Pipeline</h3>
        {totalPieces > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-20 h-[5px] rounded-full bg-muted/50 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-status-done"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">{progress}%</span>
          </div>
        )}
        <div className="flex-1" />
        {canEdit && monthPieces.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs font-mono gap-1.5 mr-2"
            onClick={() => setCaptionStudioOpen(true)}
          >
            <FileText className="h-3 w-3" />
            Caption Studio
          </Button>
        )}
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
          {phaseSummary.map((p, i) => (
            <span key={p.key} className="flex items-center gap-1">
              {i > 0 && <span className="text-border mx-0.5">·</span>}
              <span className={p.count > 0 ? "text-foreground font-semibold" : ""}>{p.count}</span>
              <span>{p.label}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="p-4">

      {/* Type tabs */}
      <Tabs value={activeType} onValueChange={handleTypeChange} className="mb-4">
        <TabsList className="h-10 bg-muted/50">
          {Object.entries(PIPELINE_CONFIG).map(([key, cfg]) => {
            const typeCount = contentPieces.filter((c) => c.type === key && c.target_month === month && c.target_year === year).length;
            return (
              <TabsTrigger key={key} value={key} className="text-sm gap-2 px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <span>{cfg.emoji}</span>
                {cfg.label}
                <span className="rounded-full bg-background/50 px-2 py-0.5 text-[11px] font-mono">{typeCount}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Phase pills */}
      <div className="flex gap-1.5 mb-5">
        {config.phases.map((p) => {
          const count = monthPieces.filter((c) => c.phase === p.key).length;
          const isActive = activePhase === p.key;
          const isHandedOver = p.key === "handed_over";
          return (
            <motion.button
              key={p.key}
              onClick={() => { setActivePhase(p.key); setSelected(new Set()); }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-mono transition-all ${
                isActive
                  ? isHandedOver
                    ? "bg-gradient-to-r from-primary to-[hsl(var(--runway-green))] text-primary-foreground shadow-md shadow-primary/20"
                    : "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}>
              <span className="text-base">{p.emoji}</span>
              {p.label}
              <motion.span
                key={count}
                initial={{ scale: 1.3 }}
                animate={{ scale: 1 }}
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  isActive ? "bg-primary-foreground/20" : "bg-background/80"
                }`}>
                {count}
              </motion.span>
            </motion.button>
          );
        })}
      </div>

      {/* Filter bar + actions */}
      <div className="flex items-center gap-3 mb-4">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filterPerson} onValueChange={setFilterPerson}>
          <SelectTrigger className="h-9 w-40 text-sm"><SelectValue placeholder="Person" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            {team?.map((t) => (
              <SelectItem key={t.user_id} value={t.user_id}>{t.name || t.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <AnimatePresence>
          {selected.size > 0 && nextPhaseMap[activePhase] && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
              <Button
                variant="default"
                className="gap-2 text-sm font-semibold shadow-lg shadow-primary/20"
                onClick={() => bulkMove.mutate()}
                disabled={bulkMove.isPending}
              >
                <Sparkles className="h-4 w-4" />
                {selected.size} → {config.phases.find((p) => p.key === nextPhaseMap[activePhase])?.emoji}{" "}
                {config.phases.find((p) => p.key === nextPhaseMap[activePhase])?.label}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {canEdit && (
          <div className="flex items-center gap-1.5">
            <Button variant="outline" className="gap-2 text-sm" onClick={() => addPiece.mutate()} disabled={addPiece.isPending}>
              <Plus className="h-4 w-4" /> {config.addLabel}
            </Button>
            <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9" title="Mehrere auf einmal erstellen">
                  <ListPlus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <span>{config.emoji}</span> Mehrere {config.label} erstellen
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Ein Titel pro Zeile. Kopiere z.B. die Titel aus deinem Google Sheet.
                  </p>
                  <Textarea
                    placeholder={"Karussell 1: Thema A\nKarussell 2: Thema B\nKarussell 3: Thema C\n..."}
                    value={bulkTitles}
                    onChange={(e) => setBulkTitles(e.target.value)}
                    rows={8}
                    className="font-mono text-sm"
                  />
                  {bulkTitles.trim() && (
                    <p className="text-xs text-muted-foreground font-mono">
                      {bulkTitles.split("\n").filter(l => l.trim()).length} Pieces werden erstellt → Phase „{getPhaseLabel(config.phases[0].key)}"
                    </p>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setBulkOpen(false)}>Abbrechen</Button>
                  <Button onClick={handleBulkCreate} disabled={bulkAddPieces.isPending} className="gap-2">
                    <ListPlus className="h-4 w-4" />
                    {bulkAddPieces.isPending ? "Erstelle..." : "Alle erstellen"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Piece list */}
      <div className="min-h-[280px]">
      {phasePieces.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-12 text-center">
          <span className="text-4xl block mb-3">{config.phases.find(p => p.key === activePhase)?.emoji}</span>
          <p className="text-sm text-muted-foreground font-body">Keine Pieces in „{getPhaseLabel(activePhase)}"</p>
          {canEdit && (
            <Button variant="ghost" className="mt-3 text-primary gap-1.5" onClick={() => addPiece.mutate()}>
              <Plus className="h-4 w-4" /> Erstes Piece erstellen
            </Button>
          )}
        </motion.div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center gap-3 px-3 py-1.5">
            <Checkbox checked={selected.size === phasePieces.length && phasePieces.length > 0} onCheckedChange={toggleAll} />
            <span className="text-[11px] font-mono text-muted-foreground">{phasePieces.length} PIECES</span>
          </div>

          <AnimatePresence mode="popLayout">
            {phasePieces.map((piece, index) => {
              const isLatePhase = activePhase === "review" || activePhase === "approved" || activePhase === "handed_over";
              const isSelected = selected.has(piece.id);
              const wasRecentlyMoved = recentlyMoved.has(piece.id);
              return (
                <motion.div
                  key={piece.id}
                  layout
                  initial={{ opacity: 0, x: -20, scale: 0.95 }}
                  animate={{
                    opacity: 1,
                    x: 0,
                    scale: wasRecentlyMoved ? [1, 1.02, 1] : 1,
                    transition: { delay: index * 0.03 },
                  }}
                  exit={{ opacity: 0, x: 30, scale: 0.9, transition: { duration: 0.2 } }}
                  className={`flex flex-col gap-2 rounded-lg border p-3.5 transition-all ${
                    isSelected
                      ? "border-primary/40 bg-primary/5 shadow-sm shadow-primary/10"
                      : "border-border hover:border-primary/20 hover:bg-card/80"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(piece.id)} />

                    {/* Title */}
                    <Input
                      value={piece.title || ""}
                      placeholder="Titel eingeben..."
                      className="h-7 flex-1 border-0 bg-transparent text-sm px-1.5 placeholder:text-muted-foreground/40 focus-visible:bg-muted/30 rounded"
                      onChange={(e) => updatePiece(piece.id, { title: e.target.value })}
                      disabled={!canEdit}
                    />

                    {/* Assigned */}
                    <Select value={piece.assigned_to || ""} onValueChange={(v) => updatePiece(piece.id, { assigned_to: v })} disabled={!canEdit}>
                      <SelectTrigger className="h-7 w-32 text-xs font-mono border-0 bg-muted/60 px-2.5 rounded-md">
                        <SelectValue placeholder="Zuweisen" />
                      </SelectTrigger>
                      <SelectContent>
                        {team?.map((t) => (
                          <SelectItem key={t.user_id} value={t.user_id}>{t.name || t.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Target month — from done/approved onwards */}
                    {isLatePhase && (
                      <Select
                        value={`${piece.target_month}-${piece.target_year}`}
                        onValueChange={(v) => {
                          const [m, y] = v.split("-").map(Number);
                          updatePiece(piece.id, { target_month: m, target_year: y });
                        }}
                        disabled={!canEdit}
                      >
                        <SelectTrigger className="h-7 w-24 text-xs font-mono border-0 bg-muted/60 px-2.5 rounded-md">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {monthOptions.map((o) => (
                            <SelectItem key={`${o.month}-${o.year}`} value={`${o.month}-${o.year}`}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {/* Move to next phase */}
                    {nextPhaseMap[activePhase] && (
                      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <Button
                          size="sm"
                          variant={nextPhaseMap[activePhase] === "handed_over" ? "default" : "outline"}
                          className={`h-7 px-3 text-xs gap-1 font-mono ${
                            nextPhaseMap[activePhase] === "handed_over"
                              ? "bg-gradient-to-r from-primary to-[hsl(var(--runway-green))] shadow-sm shadow-primary/20 border-0"
                              : ""
                          }`}
                          onClick={() => movePiece(piece.id, nextPhaseMap[activePhase])}
                        >
                          → {config.phases.find((p) => p.key === nextPhaseMap[activePhase])?.emoji}{" "}
                          {config.phases.find((p) => p.key === nextPhaseMap[activePhase])?.label}
                        </Button>
                      </motion.div>
                    )}

                    {/* Delete */}
                    {canEdit && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => deletePiece(piece.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  {/* Script text — shown in script phase for carousels */}
                  {activePhase === "script" && activeType === "carousel" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="pl-9"
                    >
                      <Textarea
                        value={piece.script_text || ""}
                        placeholder="Skript hier reinschreiben..."
                        className="text-sm border-0 bg-muted/30 rounded-md resize-y min-h-[60px]"
                        rows={3}
                        onChange={(e) => updatePiece(piece.id, { script_text: e.target.value })}
                        disabled={!canEdit}
                      />
                    </motion.div>
                  )}

                  {activePhase === "editing" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="flex items-center gap-3 pl-9"
                    >
                      {/* Deadline */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            disabled={!canEdit}
                            className={cn(
                              "h-7 w-40 justify-start text-xs font-mono border-0 bg-muted/60 px-2.5 rounded-md gap-1.5",
                              !piece.deadline && "text-muted-foreground/50",
                              piece.deadline && new Date(piece.deadline) < new Date() && "text-destructive bg-destructive/10"
                            )}
                          >
                            <CalendarIcon className="h-3 w-3 shrink-0" />
                            {piece.deadline
                              ? format(new Date(piece.deadline), "dd. MMM yyyy", { locale: de })
                              : "Deadline setzen"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={piece.deadline ? new Date(piece.deadline) : undefined}
                            onSelect={(date) => updatePiece(piece.id, { deadline: date ? format(date, "yyyy-MM-dd") : null })}
                            initialFocus
                            locale={de}
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>

                      {/* Priority */}
                      <Select
                        value={piece.priority || "normal"}
                        onValueChange={(v) => updatePiece(piece.id, { priority: v })}
                        disabled={!canEdit}
                      >
                        <SelectTrigger className={cn(
                          "h-7 w-32 text-xs font-mono border-0 px-2.5 rounded-md gap-1.5",
                          PRIORITY_OPTIONS.find(p => p.value === (piece.priority || "normal"))?.bg,
                          PRIORITY_OPTIONS.find(p => p.value === (piece.priority || "normal"))?.color,
                        )}>
                          {(piece.priority === "high" || piece.priority === "urgent") && (
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                          )}
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRIORITY_OPTIONS.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              <span className={p.color}>{p.label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </motion.div>
                  )}
                  {/* Bottom action row — link + caption compact */}
                  {isLatePhase && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="flex items-center gap-2 pl-9 flex-wrap"
                    >
                      {/* Preview link — compact chip with popover edit */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className={cn(
                              "h-6 px-2 text-[10px] font-mono gap-1.5",
                              piece.preview_link
                                ? "text-primary hover:bg-primary/10"
                                : "text-muted-foreground hover:bg-muted/60"
                            )}
                          >
                            <LinkIcon className="h-3 w-3 shrink-0" />
                            {piece.preview_link ? (
                              <span className="max-w-[160px] truncate">
                                {(() => {
                                  try {
                                    const u = new URL(piece.preview_link);
                                    const host = u.hostname.replace("www.", "");
                                    const path = u.pathname.length > 15 ? u.pathname.slice(0, 13) + "…" : u.pathname;
                                    return host + (path !== "/" ? path : "");
                                  } catch {
                                    return piece.preview_link!.slice(0, 25) + (piece.preview_link!.length > 25 ? "…" : "");
                                  }
                                })()}
                              </span>
                            ) : (
                              <span>Link</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-3" align="start">
                          <div className="space-y-2">
                            <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Preview-Link</label>
                            <Input
                              value={piece.preview_link || ""}
                              placeholder="https://drive.google.com/..."
                              className="h-8 text-xs font-mono"
                              onChange={(e) => updatePiece(piece.id, { preview_link: e.target.value })}
                              disabled={!canEdit}
                            />
                            {piece.preview_link && (
                              <a href={piece.preview_link} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                                <ExternalLink className="h-3 w-3" /> Öffnen
                              </a>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>

                      {piece.preview_link && (
                        <a href={piece.preview_link} target="_blank" rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary transition-colors">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}

                      {/* Caption/Transcript — same row */}
                      {(activePhase === "approved" || activePhase === "handed_over") && (
                        <>
                          <span className="text-border">·</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-[10px] font-mono gap-1.5 hover:bg-primary/10"
                            onClick={() => setDetailPiece(piece)}
                          >
                            <FileText className="h-3 w-3" />
                            {piece.caption ? (
                              <span className="text-[hsl(var(--runway-green))]">Caption & Transkript</span>
                            ) : (
                              <span className="text-muted-foreground">Caption & Transkript</span>
                            )}
                          </Button>
                          {piece.caption && (
                            <Button size="sm" variant="ghost"
                              className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                              onClick={() => { navigator.clipboard.writeText(piece.caption || ""); toast.success("Caption kopiert!"); }}>
                              <Copy className="h-3 w-3" />
                            </Button>
                          )}
                        </>
                      )}
                    </motion.div>
                  )}
                  {/* Client comment — shown when piece was rejected */}
                  {piece.client_comment && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="flex items-start gap-2 pl-9"
                    >
                      <MessageSquare className="h-3.5 w-3.5 text-[hsl(var(--runway-yellow))] shrink-0 mt-0.5" />
                      <span className="text-xs text-[hsl(var(--runway-yellow))] font-body bg-[hsl(var(--runway-yellow))]/10 rounded px-2 py-1">
                        Kundenfeedback: {piece.client_comment}
                      </span>
                      {canEdit && (
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-muted-foreground"
                          onClick={() => updatePiece(piece.id, { client_comment: null })}>✕</Button>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
      </div>
      </div>

      {/* Caption Studio Dialog */}
      <CaptionStudio
        open={captionStudioOpen}
        onOpenChange={setCaptionStudioOpen}
        pieces={monthPieces}
        clientId={clientId}
      />

      {/* Piece Detail Dialog */}
      <PieceDetailDialog
        open={!!detailPiece}
        onOpenChange={(open) => !open && setDetailPiece(null)}
        piece={detailPiece ? { ...detailPiece, client_id: clientId } : null}
        clientId={clientId}
      />
    </motion.div>
  );
};

export default MonthlyPipeline;
