import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ExternalLink, FileText, MessageSquare, GripVertical, User, Tag, CalendarIcon, ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";

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
  cta_label?: string | null;
  tag?: string | null;
  scheduled_post_date?: string | null;
  slide_images?: string[] | null;
  internal_note?: string | null;
  phase_changed_at?: string | null;
}

interface PhaseConfig {
  key: string;
  label: string;
  emoji: string;
}

interface PipelineKanbanProps {
  pieces: ContentPiece[];
  phases: PhaseConfig[];
  team?: { user_id: string; name: string | null; email?: string | null }[];
  canEdit: boolean;
  userRole?: string | null;
  onMovePiece: (pieceId: string, targetPhase: string) => void;
  onOpenDetail: (piece: ContentPiece) => void;
  onOpenScript: (piece: ContentPiece) => void;
}

const getNextPhaseMap = (phases: PhaseConfig[]) => {
  const map: Record<string, string> = {};
  for (let i = 0; i < phases.length - 1; i++) map[phases[i].key] = phases[i + 1].key;
  map["feedback"] = "review";
  return map;
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-destructive",
  high: "bg-orange-500",
  normal: "bg-primary",
  low: "bg-muted-foreground/40",
};

const formatShortDate = (value?: string | null) => {
  if (!value) return null;
  return format(new Date(value), "dd.MM., HH:mm", { locale: de });
};

const PipelineKanban: React.FC<PipelineKanbanProps> = ({
  pieces,
  phases,
  team,
  canEdit,
  userRole,
  onMovePiece,
  onOpenDetail,
  onOpenScript,
}) => {
  const [dragOverPhase, setDragOverPhase] = useState<string | null>(null);
  const dragItemRef = useRef<string | null>(null);
  const isMobile = useIsMobile();
  const isTouchDevice = typeof window !== "undefined" && "ontouchstart" in window;
  const nextPhaseMap = getNextPhaseMap(phases);

  const handleDragStart = useCallback((e: React.DragEvent, pieceId: string) => {
    dragItemRef.current = pieceId;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", pieceId);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
    dragItemRef.current = null;
    setDragOverPhase(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, phaseKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverPhase(phaseKey);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverPhase(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetPhase: string) => {
    e.preventDefault();
    setDragOverPhase(null);
    const pieceId = e.dataTransfer.getData("text/plain") || dragItemRef.current;
    if (!pieceId) return;

    const piece = pieces.find((p) => p.id === pieceId);
    if (piece && piece.phase !== targetPhase) {
      onMovePiece(pieceId, targetPhase);
    }
  }, [pieces, onMovePiece]);

  const getTeamName = useCallback((userId: string | null) => {
    if (!userId || !team) return null;
    const member = team.find((t) => t.user_id === userId);
    return member?.name || member?.email || null;
  }, [team]);

  return (
    <div>
      {/* Mobile scroll hint */}
      {isMobile && phases.length > 2 && (
        <div className="flex items-center justify-center gap-1 py-1.5 text-[10px] font-mono text-muted-foreground/50 md:hidden">
          ← Wischen für mehr →
        </div>
      )}

      <div className={cn(
        "flex gap-4 overflow-x-auto pb-4 min-h-[400px]",
        isMobile && "snap-x snap-mandatory -mx-3 px-3"
      )}>
        {phases.map((phase) => {
          let phasePieces = pieces.filter((p) => p.phase === phase.key);
          if (phase.key === "handed_over") {
            const today = new Date().toISOString().split("T")[0];
            phasePieces = phasePieces.filter((p) => !p.scheduled_post_date || p.scheduled_post_date >= today);
          }
          const isOver = dragOverPhase === phase.key;

          return (
            <div
              key={phase.key}
              className={cn(
                "flex flex-col rounded-2xl border transition-all duration-200 shrink-0 snap-start bg-gradient-to-b from-card to-card/40 backdrop-blur-sm",
                isMobile ? "min-w-[240px] w-[240px]" : "min-w-[260px] w-[260px]",
                isOver
                  ? "border-primary/60 shadow-lg shadow-primary/20 ring-1 ring-primary/30"
                  : "border-border/60"
              )}
              onDragOver={(e) => handleDragOver(e, phase.key)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, phase.key)}
            >
              {/* Column header */}
              <div className="flex items-center gap-2 px-3.5 py-3 border-b border-border/50">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary text-xs">
                  {phase.emoji}
                </div>
                <span className="text-[13px] font-semibold truncate flex-1">{phase.label}</span>
                <span className="text-[11px] font-medium tabular-nums text-muted-foreground bg-muted/70 rounded-full px-2 py-0.5 min-w-[24px] text-center">
                  {phasePieces.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[640px]">
                <AnimatePresence mode="popLayout">
                  {phasePieces.map((piece) => {
                    const assigneeName = getTeamName(piece.assigned_to);
                    const priority = piece.priority || "normal";
                    const showPriority = priority !== "normal";
                    const internalFeedback = piece.internal_note?.trim();
                    return (
                      <motion.div
                        key={piece.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        draggable={canEdit && !isTouchDevice}
                        onDragStart={(e: any) => handleDragStart(e, piece.id)}
                        onDragEnd={(e: any) => handleDragEnd(e)}
                        className={cn(
                          "group relative rounded-xl border border-border/60 bg-card p-3 transition-all overflow-hidden",
                          !isTouchDevice && "cursor-grab active:cursor-grabbing hover:border-primary/40 hover:shadow-md hover:shadow-primary/10 hover:-translate-y-0.5"
                        )}
                      >
                        {showPriority && (
                          <div className={cn("absolute left-0 top-0 bottom-0 w-[3px]", PRIORITY_COLORS[priority])} />
                        )}

                        {/* Title */}
                        <div className="flex items-start gap-1.5">
                          {!isTouchDevice && (
                            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/25 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                          <p
                            className="text-[13px] font-medium leading-snug flex-1 cursor-pointer hover:text-primary transition-colors line-clamp-2"
                            onClick={() => onOpenDetail(piece)}
                          >
                            {piece.title || (
                              <span className="text-muted-foreground/50 italic font-normal">Ohne Titel</span>
                            )}
                          </p>
                        </div>

                        {/* Chips row */}
                        {(piece.tag || piece.cta_label || assigneeName) && (
                          <div className="flex items-center gap-1 mt-2.5 flex-wrap">
                            {piece.tag && (() => {
                              const TAG_COLORS = [
                                "bg-primary/15 text-primary",
                                "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                                "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                                "bg-violet-500/15 text-violet-600 dark:text-violet-400",
                                "bg-rose-500/15 text-rose-600 dark:text-rose-400",
                                "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
                                "bg-orange-500/15 text-orange-600 dark:text-orange-400",
                                "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400",
                              ];
                              const hashTag = (s: string) => {
                                let h = 0x811c9dc5;
                                for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
                                return (h >>> 0) % TAG_COLORS.length;
                              };
                              return piece.tag.split(",").map(t => t.trim()).filter(Boolean).slice(0, 2).map((t) => (
                                <span key={t} className={cn("inline-flex items-center gap-1 text-[10px] rounded-md px-1.5 py-0.5 font-medium", TAG_COLORS[hashTag(t.toLowerCase())])}>
                                  <Tag className="h-2.5 w-2.5" />
                                  {t}
                                </span>
                              ));
                            })()}
                            {piece.cta_label && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-secondary bg-secondary/15 rounded-md px-1.5 py-0.5 font-medium">
                                {piece.cta_label}
                              </span>
                            )}
                          </div>
                        )}

                        {internalFeedback && (
                          <div className="mt-2.5 rounded-lg border border-primary/20 bg-primary/5 p-2">
                            <div className="mb-1 flex items-center gap-1.5 text-[9.5px] font-mono uppercase tracking-wider text-primary/80">
                              <MessageSquare className="h-2.5 w-2.5" />
                              Internes Feedback
                              {piece.phase_changed_at && (
                                <span className="normal-case tracking-normal text-muted-foreground/70">
                                  · {formatShortDate(piece.phase_changed_at)}
                                </span>
                              )}
                            </div>
                            <p className="whitespace-pre-wrap text-[11px] leading-snug text-foreground/90 line-clamp-4">
                              {internalFeedback}
                            </p>
                          </div>
                        )}

                        {/* Footer row: assignee + icons */}
                        <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-border/40">
                          {assigneeName ? (
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div className="h-5 w-5 rounded-full bg-primary/15 flex items-center justify-center text-[9px] font-semibold text-primary shrink-0">
                                {assigneeName.trim().charAt(0).toUpperCase()}
                              </div>
                              <span className="text-[10.5px] text-muted-foreground truncate">{assigneeName.split(" ")[0]}</span>
                            </div>
                          ) : (
                            <span className="text-[10.5px] text-muted-foreground/50 italic">nicht zugewiesen</span>
                          )}

                          <div className="ml-auto flex items-center gap-1.5 text-muted-foreground/70">
                            {piece.script_text && (
                              <button onClick={(e) => { e.stopPropagation(); onOpenScript(piece); }} className="hover:text-primary transition-colors" title="Skript">
                                <FileText className="h-3 w-3" />
                              </button>
                            )}
                            {piece.preview_link && (() => {
                              const links = piece.preview_link.split("\n").filter(l => l.trim());
                              return links.length > 0 ? (
                                <a href={links[0]} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 hover:text-primary transition-colors" onClick={(e) => e.stopPropagation()} title="Vorschau">
                                  <ExternalLink className="h-3 w-3" />
                                  {links.length > 1 && <span className="text-[9px]">{links.length}</span>}
                                </a>
                              ) : null;
                            })()}
                            {(piece.client_comment || internalFeedback) && (
                              <MessageSquare className="h-3 w-3 text-[hsl(var(--runway-yellow))]" />
                            )}
                            {piece.scheduled_post_date && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-[hsl(var(--runway-green))] font-medium">
                                <CalendarIcon className="h-2.5 w-2.5" />
                                {format(new Date(piece.scheduled_post_date), "dd.MM.", { locale: de })}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Move buttons */}
                        {canEdit && nextPhaseMap[piece.phase] && (() => {
                          const isAdminLike = userRole === "admin" || userRole === "head_of_content";
                          const next = nextPhaseMap[piece.phase];
                          const blocked = piece.phase === "internal_review" && next === "review" && !isAdminLike;
                          if (blocked) {
                            return (
                              <div className="mt-2 h-7 flex items-center justify-center text-[10px] text-muted-foreground/60 italic rounded-md bg-muted/40">
                                Wartet auf Jonas
                              </div>
                            );
                          }
                          return (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="w-full mt-2 h-7 text-[10.5px] gap-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md"
                              onClick={(e) => { e.stopPropagation(); onMovePiece(piece.id, next); }}
                            >
                              <ArrowRight className="h-3 w-3" />
                              {phases.find(p => p.key === next)?.label}
                            </Button>
                          );
                        })()}

                        {(piece.phase === "review" || piece.phase === "internal_review") && (userRole === "admin" || userRole === "head_of_content") && (
                          <Button
                            size="sm"
                            className="w-full mt-1 h-7 text-[10.5px] gap-1.5 bg-[hsl(var(--runway-green))] hover:bg-[hsl(var(--runway-green))]/90 text-white border-0 rounded-md"
                            onClick={(e) => { e.stopPropagation(); onMovePiece(piece.id, "approved"); }}
                          >
                            <Check className="h-3 w-3" />
                            Freigeben
                          </Button>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {phasePieces.length === 0 && (
                  <div className="py-10 text-center">
                    <div className="mx-auto h-10 w-10 rounded-full bg-muted/40 flex items-center justify-center text-lg opacity-40 mb-2">
                      {phase.emoji}
                    </div>
                    <p className="text-[10.5px] text-muted-foreground/50">Leer</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PipelineKanban;
