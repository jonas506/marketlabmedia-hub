import { useState, useMemo, useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import CaptionStudio from "./CaptionStudio";
import PieceDetailDialog from "./PieceDetailDialog";
import ScriptEditorDialog from "./ScriptEditorDialog";
import PipelineKanban from "./PipelineKanban";
import PrintScriptsDialog from "./PrintScriptsDialog";
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
  month: number;
  year: number;
  canEdit: boolean;
}

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
  const [scriptPiece, setScriptPiece] = useState<ContentPiece | null>(null);
  const [localTitles, setLocalTitles] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [printScriptsOpen, setPrintScriptsOpen] = useState(false);
  const titleTimerRef = useRef<Record<string, NodeJS.Timeout>>({});

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
        toast.error("📅 Posting-Datum fehlt", { description: "Bitte zuerst ein Posting-Datum setzen, bevor das Piece übergeben wird." });
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
    await supabase.from("content_pieces").update({ phase: nextPhase }).eq("id", pieceId);
    setRecentlyMoved(prev => new Set(prev).add(pieceId));
    setTimeout(() => setRecentlyMoved(prev => { const s = new Set(prev); s.delete(pieceId); return s; }), 600);
    if (nextPhase === "handed_over") {
      fireConfetti();
      toast.success(`${config.emoji} ${config.label.slice(0, -1)} übergeben!`, { description: "Zählt jetzt ins Kontingent 🎯" });
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
    } else {
      toast.success(`→ ${getPhaseLabel(nextPhase)}`);
    }
    qc.invalidateQueries({ queryKey: ["content-pieces", clientId] });
    qc.invalidateQueries({ queryKey: ["posting-calendar"] });
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
      setSelected(new Set());
      if (result) {
        if (result.next === "handed_over") { fireConfetti(); toast.success(`🚀 ${result.count} Pieces übergeben!`, { description: "Alles zählt jetzt ins Kontingent" }); }
        else if (result.next === "approved") { fireSmallCelebration(); toast.success(`✅ ${result.count} Pieces freigegeben!`); }
        else { toast.success(`${result.count} Pieces → ${getPhaseLabel(result.next)}`); }
      }
    },
  });

  const addPiece = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("content_pieces").insert({ client_id: clientId, type: activeType, phase: activePhase, target_month: month, target_year: year });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["content-pieces", clientId] }); toast.success(`${config.emoji} Neues Piece erstellt`, { description: `In "${getPhaseLabel(activePhase)}"` }); },
    onError: (err: any) => { console.error("Add piece error:", err); toast.error("Fehler beim Erstellen", { description: err.message }); },
  });

  const bulkAddPieces = useMutation({
    mutationFn: async (titles: string[]) => {
      const rows = titles.map((title) => ({ client_id: clientId, type: activeType, phase: config.phases[0].key, target_month: month, target_year: year, title: title.trim() || null }));
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
    await supabase.from("content_pieces").update(updates).eq("id", pieceId);
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
    const d = new Date(year, month - 1 + i);
    return { month: d.getMonth() + 1, year: d.getFullYear(), label: format(d, "MM/yyyy", { locale: de }) };
  }), [year, month]);

  const phaseSummary = useMemo(() => config.phases.map((p) => ({
    ...p, count: monthPieces.filter((c) => c.phase === p.key).length,
  })), [config.phases, monthPieces]);

  const totalPieces = monthPieces.length;
  const handedOver = monthPieces.filter(c => c.phase === "handed_over" || c.phase === "approved").length;
  const progress = totalPieces > 0 ? Math.round((handedOver / totalPieces) * 100) : 0;

  const handlePhaseChange = useCallback((phase: string) => { setActivePhase(phase); setSelected(new Set()); }, []);
  const handleOpenPrintScripts = useCallback(() => setPrintScriptsOpen(true), []);
  const handleOpenCaptionStudio = useCallback(() => setCaptionStudioOpen(true), []);
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
        canEdit={canEdit}
        hasPieces={monthPieces.length > 0}
        noDeadlineCount={noDeadlineCount}
      />

      <div className="p-4">
        <PipelineTypeTabs activeType={activeType} onTypeChange={handleTypeChange} contentPieces={contentPieces} month={month} year={year} />

        {viewMode === "kanban" ? (
          <PipelineKanban
            pieces={monthPieces}
            phases={config.phases}
            team={team}
            canEdit={canEdit}
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
              {phasePieces.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-12 text-center">
                  <span className="text-4xl block mb-3">{config.phases.find(p => p.key === activePhase)?.emoji}</span>
                  <p className="text-sm text-muted-foreground font-body">Keine Pieces in „{getPhaseLabel(activePhase)}"</p>
                  {canEdit && (
                    <Button variant="ghost" className="mt-3 text-primary gap-1.5" onClick={handleAddPiece}>
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
                        monthOptions={monthOptions}
                        onToggleSelect={toggleSelect}
                        onMovePiece={movePiece}
                        onUpdatePiece={updatePiece}
                        onDeletePiece={deletePiece}
                        onOpenDetail={setDetailPiece}
                        onOpenScript={setScriptPiece}
                        onTitleChange={handleTitleChange}
                        onPreviewLinkChange={handlePreviewLinkChange}
                        localTitle={localTitles[piece.id]}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <CaptionStudio open={captionStudioOpen} onOpenChange={setCaptionStudioOpen} pieces={monthPieces} clientId={clientId} />
      <PieceDetailDialog open={!!detailPiece} onOpenChange={(open) => !open && setDetailPiece(null)} piece={detailPiece ? { ...detailPiece, client_id: clientId } : null} clientId={clientId} />
      <ScriptEditorDialog open={!!scriptPiece} onOpenChange={(open) => !open && setScriptPiece(null)} piece={scriptPiece} clientId={clientId} canEdit={canEdit} />
      <PrintScriptsDialog open={printScriptsOpen} onOpenChange={setPrintScriptsOpen} pieces={monthPieces} />
    </motion.div>
  );
};

export default MonthlyPipeline;
