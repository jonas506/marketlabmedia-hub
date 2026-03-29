import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, FileText, MessageSquare, LayoutGrid, Send, Check } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { relativeTime } from "./constants";
import PieceTagsRow from "./PieceTagsRow";
import PieceActionRow from "./PieceActionRow";
import PieceEditingControls from "./PieceEditingControls";
import PieceDeadlinePriorityRow from "./PieceDeadlinePriorityRow";
import PieceLatePhaseRow from "./PieceLatePhaseRow";
import CarouselSlideUpload from "../CarouselSlideUpload";
import type { ContentPiece, TeamMember, PipelineConfig, MonthOption } from "./types";

const TeamReplyInput: React.FC<{ pieceId: string; currentReply: string; onSave: (reply: string) => void }> = ({ pieceId, currentReply, onSave }) => {
  const [reply, setReply] = useState(currentReply);
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(() => {
    onSave(reply);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, [reply, onSave]);

  return (
    <div className="flex items-center gap-1.5 ml-5">
      <span className="text-[10px] text-primary shrink-0">↳</span>
      <Input
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        placeholder="Auf Feedback antworten..."
        className="h-7 text-xs flex-1 bg-primary/5 border-primary/20 placeholder:text-muted-foreground/40"
        onKeyDown={(e) => e.key === "Enter" && handleSave()}
      />
      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-primary" onClick={handleSave}>
        {saved ? <Check className="h-3 w-3" /> : <Send className="h-3 w-3" />}
      </Button>
    </div>
  );
};

interface PipelinePieceCardProps {
  piece: ContentPiece;
  isSelected: boolean;
  wasRecentlyMoved: boolean;
  activePhase: string;
  activeType: string;
  config: PipelineConfig;
  nextPhase: string | undefined;
  team: TeamMember[];
  canEdit: boolean;
  index: number;
  clientId: string;
  monthOptions: MonthOption[];
  onToggleSelect: (id: string) => void;
  onMovePiece: (pieceId: string, nextPhase: string) => void;
  onUpdatePiece: (pieceId: string, updates: Record<string, any>) => void;
  onDeletePiece: (pieceId: string) => void;
  onOpenDetail: (piece: ContentPiece) => void;
  onOpenScript: (piece: ContentPiece) => void;
  onOpenCarouselBuilder: (piece: ContentPiece) => void;
  onTitleChange: (pieceId: string, title: string) => void;
  onPreviewLinkChange: (pieceId: string, allLinks: string, currentTitle: string | null) => void;
  localTitle: string | undefined;
}

const PipelinePieceCard: React.FC<PipelinePieceCardProps> = React.memo(({
  piece,
  isSelected,
  wasRecentlyMoved,
  activePhase,
  activeType,
  config,
  nextPhase,
  team,
  canEdit,
  index,
  clientId,
  monthOptions,
  onToggleSelect,
  onMovePiece,
  onUpdatePiece,
  onDeletePiece,
  onOpenDetail,
  onOpenScript,
  onOpenCarouselBuilder,
  onTitleChange,
  onPreviewLinkChange,
  localTitle,
}) => {
  const isLatePhase = activePhase === "review" || activePhase === "feedback" || activePhase === "approved" || activePhase === "handed_over";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20, scale: 0.95 }}
      animate={{
        opacity: 1,
        x: 0,
        scale: wasRecentlyMoved ? [1, 1.02, 1] : 1,
        transition: { delay: index * 0.03 },
      }}
      exit={{ opacity: 0, x: 30, scale: 0.9, transition: { duration: 0.2 } }}
      className={`flex flex-col gap-2 rounded-lg border p-2.5 sm:p-3.5 transition-all ${
        isSelected
          ? "border-primary/40 bg-primary/5 shadow-sm shadow-primary/10"
          : "border-border hover:border-primary/20 hover:bg-card/80"
      }`}
    >
      {/* Row 1: Checkbox + Title + Delete */}
      <div className="flex items-center gap-2 sm:gap-3">
        <Checkbox checked={isSelected} onCheckedChange={() => onToggleSelect(piece.id)} />
        <Input
          value={localTitle ?? piece.title ?? ""}
          placeholder="Titel eingeben..."
          className="h-7 flex-1 min-w-0 border-0 bg-transparent text-sm px-1.5 placeholder:text-muted-foreground/40 focus-visible:bg-muted/30 rounded"
          onChange={(e) => onTitleChange(piece.id, e.target.value)}
          disabled={!canEdit}
        />
        {canEdit && (
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
            onClick={() => onDeletePiece(piece.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Row 2: Tag, CTA, Assign, Target month, Move button */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap pl-7 sm:pl-9">
        <PieceTagsRow
          pieceId={piece.id}
          tag={piece.tag}
          clientId={clientId}
          canEdit={canEdit}
          onUpdatePiece={onUpdatePiece}
        />
        <PieceActionRow
          piece={piece}
          activePhase={activePhase}
          activeType={activeType}
          isLatePhase={isLatePhase}
          config={config}
          nextPhase={nextPhase}
          team={team}
          canEdit={canEdit}
          monthOptions={monthOptions}
          onUpdatePiece={onUpdatePiece}
          onMovePiece={onMovePiece}
        />
      </div>

      {/* Script button — shown in script phase */}
      {activePhase === "script" && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="pl-9"
        >
          <Button
            size="sm"
            variant="outline"
            className={cn(
              "h-7 text-xs font-mono gap-1.5",
              piece.script_text
                ? "text-[hsl(var(--runway-green))] border-[hsl(var(--runway-green))]/30 bg-[hsl(var(--runway-green))]/5"
                : "text-muted-foreground"
            )}
            onClick={() => onOpenScript(piece)}
          >
            <FileText className="h-3 w-3" />
            {piece.script_text ? "Skript bearbeiten" : "Skript schreiben"}
          </Button>
        </motion.div>
      )}

      {/* Carousel Builder button */}
      {activeType === "carousel" && activePhase === "script" && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="pl-9"
        >
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs font-mono gap-1.5 text-primary border-primary/30 bg-primary/5"
            onClick={() => onOpenCarouselBuilder(piece)}
          >
            <LayoutGrid className="h-3 w-3" />
            Carousel Builder
          </Button>
        </motion.div>
      )}

      {/* Carousel slide images */}
      {activeType === "carousel" && (activePhase === "review" || activePhase === "approved" || activePhase === "handed_over" || activePhase === "script" || activePhase === "feedback") && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="pl-7 sm:pl-9"
        >
          <CarouselSlideUpload
            pieceId={piece.id}
            clientId={clientId}
            slideImages={piece.slide_images || []}
            canEdit={canEdit}
            onUpdate={(id, images) => onUpdatePiece(id, { slide_images: images })}
          />
        </motion.div>
      )}

      {activePhase === "filmed" && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="pl-9"
        >
          <Button
            size="sm"
            variant="ghost"
            className={cn(
              "h-7 text-xs font-mono gap-1.5",
              piece.script_text
                ? "text-[hsl(var(--runway-green))] hover:text-[hsl(var(--runway-green))]"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => onOpenScript(piece)}
          >
            <FileText className="h-3 w-3" />
            {piece.script_text ? "Skript ansehen" : "Skript hinzufügen"}
          </Button>
        </motion.div>
      )}

      {activePhase === "editing" && (
        <PieceEditingControls
          piece={piece}
          canEdit={canEdit}
          onOpenScript={onOpenScript}
          onUpdatePiece={onUpdatePiece}
        />
      )}

      {/* Deadline + Priority controls for non-editing active phases */}
      {["script", "filmed", "review"].includes(activePhase) && (
        <PieceDeadlinePriorityRow
          piece={piece}
          canEdit={canEdit}
          onUpdatePiece={onUpdatePiece}
        />
      )}

      {/* Bottom action row — link + caption + posting date */}
      {isLatePhase && (
        <PieceLatePhaseRow
          piece={piece}
          activePhase={activePhase}
          canEdit={canEdit}
          localTitle={localTitle}
          onUpdatePiece={onUpdatePiece}
          onOpenScript={onOpenScript}
          onOpenDetail={onOpenDetail}
          onPreviewLinkChange={onPreviewLinkChange}
        />
      )}

      {/* Client comment + Team reply */}
      {piece.client_comment && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="space-y-2 pl-7 sm:pl-9"
        >
          <div className="flex items-start gap-2">
            <MessageSquare className="h-3.5 w-3.5 text-[hsl(var(--runway-yellow))] shrink-0 mt-0.5" />
            <span className="text-xs text-[hsl(var(--runway-yellow))] font-body bg-[hsl(var(--runway-yellow))]/10 rounded px-2 py-1 flex-1">
              Kundenfeedback: {piece.client_comment}
              {piece.updated_at && (
                <span className="ml-2 text-[10px] opacity-60">({relativeTime(piece.updated_at)})</span>
              )}
            </span>
            {canEdit && (
              <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-muted-foreground shrink-0"
                onClick={() => onUpdatePiece(piece.id, { client_comment: null })}>✕</Button>
            )}
          </div>
          {/* Team reply */}
          {canEdit && (
            <TeamReplyInput
              pieceId={piece.id}
              currentReply={piece.team_reply ?? ""}
              onSave={(reply) => onUpdatePiece(piece.id, { team_reply: reply || null })}
            />
          )}
          {!canEdit && piece.team_reply && (
            <div className="flex items-start gap-2 ml-5">
              <span className="text-xs text-primary font-body bg-primary/10 rounded px-2 py-1">
                ↳ Antwort: {piece.team_reply}
              </span>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
});

PipelinePieceCard.displayName = "PipelinePieceCard";

export default PipelinePieceCard;
