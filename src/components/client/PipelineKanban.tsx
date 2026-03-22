import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ExternalLink, FileText, MessageSquare, GripVertical, User, Tag, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";

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
  onMovePiece: (pieceId: string, targetPhase: string) => void;
  onOpenDetail: (piece: ContentPiece) => void;
  onOpenScript: (piece: ContentPiece) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-destructive",
  high: "bg-orange-500",
  normal: "bg-primary",
  low: "bg-muted-foreground/40",
};

const PipelineKanban: React.FC<PipelineKanbanProps> = ({
  pieces,
  phases,
  team,
  canEdit,
  onMovePiece,
  onOpenDetail,
  onOpenScript,
}) => {
  const [dragOverPhase, setDragOverPhase] = useState<string | null>(null);
  const dragItemRef = useRef<string | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, pieceId: string) => {
    dragItemRef.current = pieceId;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", pieceId);
    // Make ghost slightly transparent
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
    <div className="flex gap-3 overflow-x-auto pb-4 min-h-[400px]">
      {phases.map((phase) => {
        const phasePieces = pieces.filter((p) => p.phase === phase.key);
        const isOver = dragOverPhase === phase.key;

        return (
          <div
            key={phase.key}
            className={cn(
              "flex flex-col min-w-[220px] w-[220px] rounded-xl border transition-all duration-200",
              isOver
                ? "border-primary/50 bg-primary/5 shadow-lg shadow-primary/10"
                : "border-border bg-card/50"
            )}
            onDragOver={(e) => handleDragOver(e, phase.key)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, phase.key)}
          >
            {/* Column header */}
            <div className="flex items-center gap-2 px-3 py-3 border-b border-border">
              <span className="text-base">{phase.emoji}</span>
              <span className="text-xs font-semibold font-mono truncate">{phase.label}</span>
              <span className="ml-auto text-[10px] font-mono text-muted-foreground bg-muted/60 rounded-full px-2 py-0.5">
                {phasePieces.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[600px]">
              <AnimatePresence mode="popLayout">
                {phasePieces.map((piece) => {
                  const assigneeName = getTeamName(piece.assigned_to);
                  const priority = piece.priority || "normal";
                  return (
                    <motion.div
                      key={piece.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      draggable={canEdit}
                      onDragStart={(e: any) => handleDragStart(e, piece.id)}
                      onDragEnd={(e: any) => handleDragEnd(e)}
                      className={cn(
                        "group relative rounded-lg border bg-card p-3 cursor-grab active:cursor-grabbing transition-all",
                        "hover:border-primary/30 hover:shadow-md hover:shadow-primary/5",
                        "border-border"
                      )}
                    >
                      {/* Priority indicator */}
                      <div className={cn(
                        "absolute left-0 top-3 bottom-3 w-[3px] rounded-full",
                        PRIORITY_COLORS[priority]
                      )} />

                      <div className="pl-2.5">
                        {/* Grip + Title */}
                        <div className="flex items-start gap-1.5">
                          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <p
                            className="text-sm font-body leading-snug flex-1 cursor-pointer hover:text-primary transition-colors"
                            onClick={() => onOpenDetail(piece)}
                          >
                            {piece.title || (
                              <span className="text-muted-foreground/50 italic">Ohne Titel</span>
                            )}
                          </p>
                        </div>

                        {/* Meta row */}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {piece.tag && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-accent-foreground bg-accent/15 rounded-md px-1.5 py-0.5">
                              <Tag className="h-2.5 w-2.5" />
                              {piece.tag}
                            </span>
                          )}
                          {piece.cta_label && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-secondary bg-secondary/15 rounded-md px-1.5 py-0.5">
                              📢 {piece.cta_label}
                            </span>
                          )}
                          {assigneeName && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground bg-muted/60 rounded-md px-1.5 py-0.5">
                              <User className="h-2.5 w-2.5" />
                              {assigneeName.split(" ")[0]}
                            </span>
                          )}

                          {piece.script_text && (
                            <button
                              onClick={() => onOpenScript(piece)}
                              className="text-[10px] text-[hsl(var(--runway-green))] hover:underline font-mono flex items-center gap-0.5"
                            >
                              <FileText className="h-2.5 w-2.5" />
                              Skript
                            </button>
                          )}

                          {piece.preview_link && (() => {
                            const links = piece.preview_link.split("\n").filter(l => l.trim());
                            return links.length > 0 ? (
                              <span className="flex items-center gap-0.5">
                                <a href={links[0]} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 transition-colors" onClick={(e) => e.stopPropagation()}>
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                                {links.length > 1 && <span className="text-[9px] text-primary font-mono">+{links.length - 1}</span>}
                              </span>
                            ) : null;
                          })()}

                          {piece.client_comment && (
                            <span className="text-[10px] text-[hsl(var(--runway-yellow))] flex items-center gap-0.5">
                              <MessageSquare className="h-2.5 w-2.5" />
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {phasePieces.length === 0 && (
                <div className="py-8 text-center">
                  <span className="text-2xl block mb-1 opacity-30">{phase.emoji}</span>
                  <p className="text-[10px] text-muted-foreground/40 font-mono">Leer</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PipelineKanban;
