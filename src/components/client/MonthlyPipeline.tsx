import { useState, useMemo, useCallback, useRef, useEffect, useContext } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Plus, icons, CalendarCheck, Package, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { isUpcomingHandedOver, isArchivedHandedOver } from "@/lib/pipeline-utils";
import CaptionStudio from "./CaptionStudio";
import PieceDetailDialog from "./PieceDetailDialog";
import ScriptEditorDialog from "./ScriptEditorDialog";
import PipelineKanban from "./PipelineKanban";
import PrintScriptsDialog from "./PrintScriptsDialog";
import CarouselBuilder from "./CarouselBuilder";
import DriveImportDialog from "./pipeline/DriveImportDialog";
import {
  PipelineHeader,
  PipelineTypeTabs,
  PhasePills,
  ReviewMailBanner,
  PipelineFilterBar,
  PipelinePieceCard,
  PIPELINE_CONFIG,
  PRIORITY_WEIGHT,
  fireConfetti,
  fireSmallCelebration,
} from "./pipeline";
import type { ContentPiece } from "./pipeline/types";

interface MonthlyPipelineProps {
  clientId: string;
  contentPieces: ContentPiece[];
  canEdit: boolean;
  focusPieceId?: string | null;
  onFocusPieceHandled?: () => void;
}

const MonthlyPipeline: React.FC<MonthlyPipelineProps> = ({ clientId, contentPieces, canEdit, focusPieceId, onFocusPieceHandled }) => {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const qc = useQueryClient();
  const { role: userRole } = useAuth();
  const [activeType, setActiveType] = useState<string>("reel");
  const [activePhase, setActivePhase] = useState<string>(PIPELINE_CONFIG["reel"].phases[0].key);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterPerson, setFilterPerson] = useState<string>("all");
  const [recentlyMoved, setRecentlyMoved] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkTitles, setBulkTitles] = useState("");
  const [captionStudioOpen, setCaptionStudioOpen] = useState(false);
  const [detailPiece, setDetailPiece] = useState<ContentPiece | null>(null);
  const [scriptPiece, setScriptPiece] = useState<ContentPiece | null>(null);
  const [localTitles, setLocalTitles] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [printScriptsOpen, setPrintScriptsOpen] = useState(false);
  const [driveImportOpen, setDriveImportOpen] = useState(false);
  const [carouselBuilderPiece, setCarouselBuilderPiece] = useState<ContentPiece | null>(null);
  const titleTimerRef = useRef<Record<string, NodeJS.Timeout>>({});

  const { data: driveLinks } = useQuery({
    queryKey: ["client-drive-links", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("drive_folder_id, drive_reels_link, drive_carousels_link, drive_ads_link, drive_youtube_link")
        .eq("id", clientId)
        .single();
      return data;
    },
  });

  const config = PIPELINE_CONFIG[activeType];

  const handleTypeChange = useCallback((type: string) => {
    setActiveType(type);
    setActivePhase(PIPELINE_CONFIG[type].phases[0].key);
    setSelected(new Set());
    setFilterPerson("all");
  }, []);

  const { data: team = [] } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      if (!roles?.length) return [];
      const userIds = roles.map((r) => r.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, name, email").in("user_id", userIds);
      return profiles ?? [];
    },
  });

  const monthPieces = useMemo(() =>
    contentPieces.filter((c) => c.type === activeType),
    [contentPieces, activeType]
  );

  useEffect(() => {
    if (!focusPieceId) return;
    const targetPiece = contentPieces.find((piece) => piece.id === focusPieceId);
    if (!targetPiece) return;

    setActiveType(targetPiece.type);
    setActivePhase(targetPiece.phase);
    setDetailPiece(targetPiece);
    onFocusPieceHandled?.();
  }, [focusPieceId, contentPieces, onFocusPieceHandled]);

  const phasePieces = useMemo(() => {
    let filtered = monthPieces.filter((c) => c.phase === activePhase);
    // In "Geplant" only show upcoming pieces (next 30 days or no date)
    if (activePhase === "handed_over") {
      filtered = filtered.filter((c) => isUpcomingHandedOver(c.scheduled_post_date));
    }
    if (filterPerson !== "all") filtered = filtered.filter((c) => c.assigned_to === filterPerson);
    return [...filtered].sort((a, b) => {
      // For handed_over: sort by scheduled_post_date ascending, no-date at end
      if (activePhase === "handed_over") {
        if (a.scheduled_post_date && b.scheduled_post_date) return a.scheduled_post_date.localeCompare(b.scheduled_post_date);
        if (a.scheduled_post_date) return -1;
        if (b.scheduled_post_date) return 1;
        return 0;
      }
      const pa = PRIORITY_WEIGHT[a.priority || "normal"] ?? 2;
      const pb = PRIORITY_WEIGHT[b.priority || "normal"] ?? 2;
      if (pa !== pb) return pa - pb;
      if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return 0;
    });
  }, [monthPieces, activePhase, filterPerson]);

  // Archive pieces for handed_over phase
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveLimit, setArchiveLimit] = useState(50);

  const archivedPieces = useMemo(() => {
    if (activePhase !== "handed_over") return [];
    return monthPieces
      .filter((c) => c.phase === "handed_over" && isArchivedHandedOver(c.scheduled_post_date))
      .sort((a, b) => new Date(b.scheduled_post_date!).getTime() - new Date(a.scheduled_post_date!).getTime())
      .slice(0, archiveLimit);
  }, [monthPieces, activePhase, archiveLimit]);

  const totalArchivedCount = useMemo(() => {
    if (activePhase !== "handed_over") return 0;
    return monthPieces.filter((c) => c.phase === "handed_over" && isArchivedHandedOver(c.scheduled_post_date)).length;
  }, [monthPieces, activePhase]);

  // Geplant summary for header
  const geplantSummary = useMemo(() => {
    if (activePhase !== "handed_over") return null;
    const allHandedOver = monthPieces.filter(c => c.phase === "handed_over");
    const upcoming = allHandedOver.filter(c => isUpcomingHandedOver(c.scheduled_post_date));
    const withDate = upcoming.filter(c => c.scheduled_post_date);
    const nextPiece = withDate.sort((a, b) => a.scheduled_post_date!.localeCompare(b.scheduled_post_date!))[0];
    return {
      upcomingCount: upcoming.length,
      totalPlanned: allHandedOver.length,
      nextPiece,
    };
  }, [monthPieces, activePhase]);

  const nextPhaseMap = useMemo(() => {
    const phases = config.phases;
    const map: Record<string, string> = {};
    for (let i = 0; i < phases.length - 1; i++) map[phases[i].key] = phases[i + 1].key;
    map["feedback"] = "review";
    return map;
  }, [config]);

  const getPhaseLabel = useCallback((key: string) => config.phases.find(p => p.key === key)?.label ?? key, [config]);

  const triggerTranscription = useCallback(async (pieceId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("transcribe-caption", { body: { piece_id: pieceId } });
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

  const movePiece = useCallback(async (pieceId: string, nextPhase: string) => {
    if (nextPhase === "handed_over") {
      const piece = monthPieces.find(p => p.id === pieceId);
      if (!piece?.scheduled_post_date) {
        toast.error("📅 Posting-Datum fehlt", { description: "Bitte zuerst ein Posting-Datum setzen, bevor das Piece geplant wird." });
        return;
      }
    }
    if (nextPhase === "editing") {
      const piece = monthPieces.find(p => p.id === pieceId);
      if (!piece?.deadline) {
        toast.warning("⏰ Keine Deadline gesetzt", {
          description: "Dieses Piece hat keine Deadline. Bitte setze eine, damit das Team priorisieren kann.",
          duration: 5000,
        });
      }
    }
    const { error } = await supabase.from("content_pieces").update({ phase: nextPhase }).eq("id", pieceId);
    if (error) {
      console.error("Move piece error:", error);
      toast.error("Fehler beim Verschieben", { description: error.message });
      return;
    }
    setRecentlyMoved(prev => new Set(prev).add(pieceId));
    setTimeout(() => setRecentlyMoved(prev => { const s = new Set(prev); s.delete(pieceId); return s; }), 600);
    if (nextPhase === "handed_over") {
      fireConfetti();
      toast.success(`${config.emoji} ${config.label.slice(0, -1)} geplant!`, { description: "Zählt jetzt ins Kontingent 🎯" });
      toast("✓ Verknüpfte Aufgaben erledigt", { description: "Aufgaben wurden automatisch abgehakt", position: "bottom-right", duration: 3000 });
    } else if (nextPhase === "approved") {
      fireSmallCelebration();
      toast.success(`✅ Freigegeben!`, { description: "Kunde hat freigegeben" });
      const piece = monthPieces.find(p => p.id === pieceId);
      if (piece?.preview_link && piece.type !== "carousel") {
        toast.info("🎙️ Transkription wird gestartet...", { description: "Caption wird automatisch generiert" });
        triggerTranscription(pieceId);
      }
    } else if (nextPhase === "review") {
      toast.success(`👁️ Zur Freigabe`, { description: "Warte auf Kunden-Freigabe" });
      const piece = monthPieces.find(p => p.id === pieceId);
      if (piece?.phase === "feedback") {
        toast("✓ Feedback-Aufgaben erledigt", { description: "Verknüpfte Aufgaben wurden abgehakt", position: "bottom-right", duration: 3000 });
      }
    } else {
      toast.success(`→ ${getPhaseLabel(nextPhase)}`);
    }
    qc.invalidateQueries({ queryKey: ["content-pieces", clientId] });
    qc.invalidateQueries({ queryKey: ["posting-calendar"] });
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["clients-dashboard"] });
  }, [qc, clientId, config, getPhaseLabel, monthPieces, triggerTranscription]);

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
      qc.invalidateQueries({ queryKey: ["clients-dashboard"] });
      setSelected(new Set());
      if (result) {
        if (result.next === "handed_over") { fireConfetti(); toast.success(`🚀 ${result.count} Pieces geplant!`, { description: "Alles zählt jetzt ins Kontingent" }); }
        else if (result.next === "approved") { fireSmallCelebration(); toast.success(`✅ ${result.count} Pieces freigegeben!`); }
        else { toast.success(`${result.count} Pieces → ${getPhaseLabel(result.next)}`); }
      }
    },
  });

  const addPiece = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("content_pieces").insert({ client_id: clientId, type: activeType, phase: activePhase, target_month: currentMonth, target_year: currentYear });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["content-pieces", clientId] }); toast.success(`${config.emoji} Neues Piece erstellt`, { description: `In "${getPhaseLabel(activePhase)}"` }); },
    onError: (err: any) => { console.error("Add piece error:", err); toast.error("Fehler beim Erstellen", { description: err.message }); },
  });

  const bulkAddPieces = useMutation({
    mutationFn: async (titles: string[]) => {
      const rows = titles.map((title) => ({ client_id: clientId, type: activeType, phase: config.phases[0].key, target_month: currentMonth, target_year: currentYear, title: title.trim() || null }));
      await supabase.from("content_pieces").insert(rows);
      return rows.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["content-pieces", clientId] });
      setBulkOpen(false); setBulkTitles(""); setActivePhase(config.phases[0].key);
      toast.success(`${config.emoji} ${count} Pieces erstellt`, { description: `In "${getPhaseLabel(config.phases[0].key)}"` });
    },
  });

  const handleBulkCreate = useCallback(() => {
    const lines = bulkTitles.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) { toast.error("Bitte mindestens einen Titel eingeben"); return; }
    bulkAddPieces.mutate(lines);
  }, [bulkTitles, bulkAddPieces]);

  const updatePiece = useCallback(async (pieceId: string, updates: Record<string, any>) => {
    await supabase.from("content_pieces").update(updates as any).eq("id", pieceId);
    qc.invalidateQueries({ queryKey: ["content-pieces", clientId] });
  }, [qc, clientId]);

  const handlePreviewLinkChange = useCallback(async (pieceId: string, allLinks: string, currentTitle: string | null) => {
    updatePiece(pieceId, { preview_link: allLinks });
    const url = allLinks.split("\n").filter(l => l.trim())[0] || "";
    if (currentTitle || !url.includes("drive.google.com")) return;
    try {
      const { data, error } = await supabase.functions.invoke("transcribe-caption", { body: { action: "get_file_info", url } });
      if (error || !data?.name) return;
      setLocalTitles(prev => ({ ...prev, [pieceId]: data.name }));
      await supabase.from("content_pieces").update({ title: data.name }).eq("id", pieceId);
      qc.invalidateQueries({ queryKey: ["content-pieces", clientId] });
      toast.success("📎 Titel aus Dateiname übernommen", { description: data.name });
    } catch { /* Silently fail */ }
  }, [qc, clientId, updatePiece]);

  const saveTitleQuietly = useCallback(async (pieceId: string, title: string) => {
    await supabase.from("content_pieces").update({ title }).eq("id", pieceId);
  }, []);

  const handleTitleChange = useCallback((pieceId: string, value: string) => {
    setLocalTitles((prev) => ({ ...prev, [pieceId]: value }));
    if (titleTimerRef.current[pieceId]) clearTimeout(titleTimerRef.current[pieceId]);
    titleTimerRef.current[pieceId] = setTimeout(() => { saveTitleQuietly(pieceId, value); }, 600);
  }, [saveTitleQuietly]);

  const deletePiece = useCallback(async (pieceId: string) => {
    await supabase.from("content_pieces").delete().eq("id", pieceId);
    qc.invalidateQueries({ queryKey: ["content-pieces", clientId] });
    toast("Piece gelöscht", { description: "Wurde aus der Pipeline entfernt" });
  }, [qc, clientId]);

  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }, []);

  const toggleAll = useCallback(() => {
    if (selected.size === phasePieces.length) setSelected(new Set());
    else setSelected(new Set(phasePieces.map((c) => c.id)));
  }, [selected.size, phasePieces]);

  const monthOptions = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const d = new Date(currentYear, currentMonth - 1 + i);
    return { month: d.getMonth() + 1, year: d.getFullYear(), label: format(d, "MM/yyyy", { locale: de }) };
  }), [currentYear, currentMonth]);

  const phaseSummary = useMemo(() => config.phases.map((p) => ({
    ...p, count: monthPieces.filter((c) => c.phase === p.key).length,
  })), [config.phases, monthPieces]);

  const totalPieces = monthPieces.length;
  const plannedCount = monthPieces.filter(c => (c.phase === "handed_over" && isUpcomingHandedOver(c.scheduled_post_date)) || c.phase === "approved").length;
  const progress = totalPieces > 0 ? Math.round((plannedCount / totalPieces) * 100) : 0;

  const handlePhaseChange = useCallback((phase: string) => { setActivePhase(phase); setSelected(new Set()); }, []);
  const handleOpenPrintScripts = useCallback(() => setPrintScriptsOpen(true), []);
  const handleOpenCaptionStudio = useCallback(() => setCaptionStudioOpen(true), []);
  const handleOpenDriveImport = useCallback(() => setDriveImportOpen(true), []);
  const handleViewModeChange = useCallback((mode: "list" | "kanban") => setViewMode(mode), []);
  const handleAddPiece = useCallback(() => addPiece.mutate(), [addPiece]);
  const handleBulkMove = useCallback(() => bulkMove.mutate(), [bulkMove]);

  const nextPhaseInfo = useMemo(() => {
    const nextKey = nextPhaseMap[activePhase];
    const nextP = nextKey ? config.phases.find(p => p.key === nextKey) : undefined;
    return { emoji: nextP?.emoji || "", label: nextP?.label || "" };
  }, [nextPhaseMap, activePhase, config.phases]);

  const noDeadlineCount = useMemo(() =>
    monthPieces.filter(p => !p.deadline && !["approved", "handed_over"].includes(p.phase)).length,
    [monthPieces]
  );

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-border bg-card overflow-hidden">
       <PipelineHeader
        config={config}
        totalPieces={totalPieces}
        progress={progress}
        phaseSummary={phaseSummary}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onOpenPrintScripts={handleOpenPrintScripts}
        onOpenCaptionStudio={handleOpenCaptionStudio}
        onOpenDriveImport={handleOpenDriveImport}
        canEdit={canEdit}
        hasPieces={monthPieces.length > 0}
        noDeadlineCount={noDeadlineCount}
        driveLinks={driveLinks ?? undefined}
      />

      <div className="p-4">
        <PipelineTypeTabs activeType={activeType} onTypeChange={handleTypeChange} contentPieces={contentPieces} />

        {viewMode === "kanban" ? (
          <PipelineKanban
            pieces={monthPieces}
            phases={config.phases}
            team={team}
            canEdit={canEdit}
            userRole={userRole}
            onMovePiece={(pieceId, targetPhase) => movePiece(pieceId, targetPhase)}
            onOpenDetail={(piece) => setDetailPiece(piece)}
            onOpenScript={(piece) => setScriptPiece(piece)}
          />
        ) : (
          <>
            <PhasePills phases={config.phases} activePhase={activePhase} onPhaseChange={handlePhaseChange} monthPieces={monthPieces} />
            {activePhase === "review" && <ReviewMailBanner clientId={clientId} phasePieces={phasePieces} canEdit={canEdit} />}
            <PipelineFilterBar
              filterPerson={filterPerson}
              onFilterChange={setFilterPerson}
              team={team}
              selectedCount={selected.size}
              canBulkMove={!!nextPhaseMap[activePhase]}
              onBulkMove={handleBulkMove}
              bulkMovePending={bulkMove.isPending}
              nextPhaseEmoji={nextPhaseInfo.emoji}
              nextPhaseLabel={nextPhaseInfo.label}
              canEdit={canEdit}
              onAddPiece={handleAddPiece}
              addPiecePending={addPiece.isPending}
              config={config}
              bulkOpen={bulkOpen}
              onBulkOpenChange={setBulkOpen}
              bulkTitles={bulkTitles}
              onBulkTitlesChange={setBulkTitles}
              onBulkCreate={handleBulkCreate}
              bulkCreatePending={bulkAddPieces.isPending}
              firstPhaseLabel={getPhaseLabel(config.phases[0].key)}
            />

            <div className="min-h-[280px]">
              {/* Geplant summary banner */}
              {activePhase === "handed_over" && geplantSummary && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 mb-3">
                  <CalendarCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>
                    <strong className="text-foreground">{geplantSummary.upcomingCount}</strong> von {geplantSummary.totalPlanned} Content-Pieces
                    {geplantSummary.nextPiece?.scheduled_post_date && (
                      <> · Nächstes Posting: <strong className="text-foreground">{format(new Date(geplantSummary.nextPiece.scheduled_post_date), "dd. MMM", { locale: de })}</strong> ({geplantSummary.nextPiece.title || "Ohne Titel"})</>
                    )}
                  </span>
                </div>
              )}

              {phasePieces.length === 0 && activePhase !== "handed_over" ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-12 text-center">
                  {(() => {
                    const phaseEmoji = config.phases.find(p => p.key === activePhase)?.emoji;
                    const EmptyIcon = phaseEmoji ? icons[phaseEmoji as keyof typeof icons] : null;
                    return EmptyIcon ? <EmptyIcon className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" /> : null;
                  })()}
                  <p className="text-sm text-muted-foreground font-body">Keine Pieces in „{getPhaseLabel(activePhase)}"</p>
                  {canEdit && (
                    <Button variant="ghost" className="mt-3 text-primary gap-1.5" onClick={handleAddPiece}>
                      <Plus className="h-4 w-4" /> Erstes Piece erstellen
                    </Button>
                  )}
                </motion.div>
              ) : phasePieces.length === 0 && activePhase === "handed_over" ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-8 text-center">
                  <CalendarCheck className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground font-body">Keine geplanten Pieces in den nächsten 30 Tagen</p>
                </motion.div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3 px-3 py-1.5">
                    <Checkbox checked={selected.size === phasePieces.length && phasePieces.length > 0} onCheckedChange={toggleAll} />
                    <span className="text-[11px] text-muted-foreground font-medium">{phasePieces.length} Pieces</span>
                  </div>
                  <AnimatePresence mode="popLayout">
                    {phasePieces.map((piece, index) => (
                      <PipelinePieceCard
                        key={piece.id}
                        piece={piece}
                        isSelected={selected.has(piece.id)}
                        wasRecentlyMoved={recentlyMoved.has(piece.id)}
                        activePhase={activePhase}
                        activeType={activeType}
                        config={config}
                        nextPhase={nextPhaseMap[activePhase]}
                        team={team}
                        canEdit={canEdit}
                        index={index}
                        clientId={clientId}
                        userRole={userRole}
                        monthOptions={monthOptions}
                        onToggleSelect={toggleSelect}
                        onMovePiece={movePiece}
                        onUpdatePiece={updatePiece}
                        onDeletePiece={deletePiece}
                        onOpenDetail={setDetailPiece}
                        onOpenScript={setScriptPiece}
                        onOpenCarouselBuilder={setCarouselBuilderPiece}
                        onTitleChange={handleTitleChange}
                        onPreviewLinkChange={handlePreviewLinkChange}
                        localTitle={localTitles[piece.id]}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {/* Archive section for Geplant phase */}
              {activePhase === "handed_over" && totalArchivedCount > 0 && (
                <Collapsible open={archiveOpen} onOpenChange={setArchiveOpen} className="mt-4">
                  <CollapsibleTrigger className="flex items-center gap-2 w-full text-left rounded-lg border border-border bg-muted/30 px-4 py-2.5 hover:bg-muted/50 transition-colors">
                    <Package className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">Archiv ({totalArchivedCount} Pieces)</span>
                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground ml-auto transition-transform ${archiveOpen ? "rotate-180" : ""}`} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
                      {archivedPieces.map((piece) => (
                        <button
                          key={piece.id}
                          onClick={() => setDetailPiece(piece)}
                          className="flex items-center gap-3 px-4 py-2 text-xs w-full text-left hover:bg-muted/30 transition-colors"
                        >
                          <span className="text-muted-foreground tabular-nums shrink-0 w-20">
                            {piece.scheduled_post_date ? format(new Date(piece.scheduled_post_date), "dd.MM.yyyy") : "—"}
                          </span>
                          <span className="text-muted-foreground shrink-0 w-16 capitalize">
                            {piece.type === "youtube_longform" ? "YouTube" : piece.type === "carousel" ? "Karussell" : piece.type === "ad" ? "Ad" : "Reel"}
                          </span>
                          <span className="truncate flex-1 text-foreground">{piece.title || "Ohne Titel"}</span>
                          <span className="text-emerald-500 shrink-0">✅</span>
                        </button>
                      ))}
                    </div>
                    {archiveLimit < totalArchivedCount && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full mt-2 text-xs text-muted-foreground"
                        onClick={() => setArchiveLimit(prev => prev + 50)}
                      >
                        Mehr laden ({totalArchivedCount - archiveLimit} weitere)
                      </Button>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          </>
        )}
      </div>

      <CaptionStudio open={captionStudioOpen} onOpenChange={setCaptionStudioOpen} pieces={monthPieces} clientId={clientId} />
      <PieceDetailDialog open={!!detailPiece} onOpenChange={(open) => !open && setDetailPiece(null)} piece={detailPiece ? { ...detailPiece, client_id: clientId } : null} clientId={clientId} />
      <ScriptEditorDialog open={!!scriptPiece} onOpenChange={(open) => !open && setScriptPiece(null)} piece={scriptPiece} clientId={clientId} canEdit={canEdit} />
      <PrintScriptsDialog open={printScriptsOpen} onOpenChange={setPrintScriptsOpen} pieces={monthPieces} />
      <CarouselBuilder open={!!carouselBuilderPiece} onOpenChange={(open) => !open && setCarouselBuilderPiece(null)} piece={carouselBuilderPiece} clientId={clientId} onSaved={() => qc.invalidateQueries({ queryKey: ["content-pieces", clientId] })} />
      <DriveImportDialog open={driveImportOpen} onOpenChange={setDriveImportOpen} clientId={clientId} activeType={activeType} onImportComplete={() => qc.invalidateQueries({ queryKey: ["content-pieces", clientId] })} />
    </motion.div>
  );
};

export default MonthlyPipeline;
