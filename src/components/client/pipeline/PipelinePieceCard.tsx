import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Trash2, FileText, MessageSquare, LayoutGrid, Send, Check, ShieldCheck, CalendarIcon, AlertTriangle, icons } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { relativeTime, PRIORITY_OPTIONS } from "./constants";
import PieceTagsRow from "./PieceTagsRow";
import FunnelStageSelector from "./FunnelStageSelector";
import RawFootageLink from "./RawFootageLink";
import PieceLatePhaseRow from "./PieceLatePhaseRow";
import CarouselSlideUpload from "../CarouselSlideUpload";
import PieceInternalComments from "./PieceInternalComments";
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

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold mb-1 block ml-0.5">
    {children}
  </span>
);

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
  userRole?: string | null;
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
  userRole,
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
  const isLatePhase = activePhase === "editing" || activePhase === "internal_review" || activePhase === "review" || activePhase === "feedback" || activePhase === "approved" || activePhase === "handed_over";
  const isInternalReview = activePhase === "internal_review";
  const isAdminLike = userRole === "admin" || userRole === "head_of_content";
  const showDeadlinePriority = ["script", "filmed", "review", "editing"].includes(activePhase);
  const internalFeedback = piece.internal_note?.trim();

  const priorityOption = PRIORITY_OPTIONS.find(p => p.value === (piece.priority || "normal"));
  const NextIcon = nextPhase ? icons[config.phases.find((p) => p.key === nextPhase)?.emoji as keyof typeof icons] : null;
  const moveBlocked = activePhase === "internal_review" && nextPhase === "review" && !isAdminLike;

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
      className={`flex flex-col gap-4 rounded-xl border p-3 sm:p-4 transition-all ${
        isSelected
          ? "border-primary/40 bg-primary/5 shadow-sm shadow-primary/10"
          : "border-border hover:border-primary/20 hover:bg-card/80"
      }`}
    >
      {/* Zone 1 — Header: Checkbox + Title + Delete */}
      <div className="flex items-center gap-2 sm:gap-3">
        <Checkbox checked={isSelected} onCheckedChange={() => onToggleSelect(piece.id)} />
        <Input
          value={localTitle ?? piece.title ?? ""}
          placeholder="Titel eingeben..."
          className="h-8 flex-1 min-w-0 border-0 bg-transparent text-base font-medium px-1.5 placeholder:text-muted-foreground/40 focus-visible:bg-muted/30 rounded"
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

      {/* Zone 2 — Metadata pills (Tag, Funnel, Footage, optional CTA) */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap pl-7 sm:pl-9">
        <PieceTagsRow
          pieceId={piece.id}
          tag={piece.tag}
          clientId={clientId}
          canEdit={canEdit}
          onUpdatePiece={onUpdatePiece}
        />
        <FunnelStageSelector
          value={piece.funnel_stage}
          canEdit={canEdit}
          onChange={(v) => onUpdatePiece(piece.id, { funnel_stage: v })}
        />
        <RawFootageLink
          value={piece.raw_footage_link}
          canEdit={canEdit}
          onChange={(v) => onUpdatePiece(piece.id, { raw_footage_link: v })}
        />
        {(() => {
          const isComment = (piece.cta_label || "").startsWith("Kommentiere");
          const currentKeyword = isComment ? ((piece.cta_label || "").split(":")[1]?.trim() ?? "") : "";
          const lsKey = `cta_kw_${clientId}`;
          return (
            <>
              <Select
                value={isComment ? "Kommentiere" : (piece.cta_label || "")}
                onValueChange={(v) => {
                  if (v === "_clear") {
                    onUpdatePiece(piece.id, { cta_label: null });
                  } else if (v === "Kommentiere") {
                    const remembered = typeof window !== "undefined" ? localStorage.getItem(lsKey) || "" : "";
                    onUpdatePiece(piece.id, { cta_label: remembered ? `Kommentiere:${remembered}` : "Kommentiere" });
                  }
                }}
                disabled={!canEdit}
              >
                <SelectTrigger className={cn(
                  "h-7 w-auto min-w-[7rem] text-xs font-mono border-0 px-2.5 rounded-full gap-1.5 transition-colors",
                  isComment
                    ? "bg-[hsl(var(--runway-green))]/15 text-[hsl(var(--runway-green))] ring-1 ring-[hsl(var(--runway-green))]/30"
                    : "bg-muted/60 text-muted-foreground"
                )}>
                  <SelectValue placeholder="💬 CTA?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_clear"><span className="text-muted-foreground">— Kein CTA</span></SelectItem>
                  <SelectItem value="Kommentiere">💬 Kommentiere</SelectItem>
                </SelectContent>
              </Select>
              {isComment && (
                <div className="flex items-center h-7 rounded-full bg-[hsl(var(--runway-green))]/5 border border-[hsl(var(--runway-green))]/30 overflow-hidden">
                  <span className="px-2.5 text-[11px] font-mono text-[hsl(var(--runway-green))] bg-[hsl(var(--runway-green))]/10 h-full flex items-center border-r border-[hsl(var(--runway-green))]/20">
                    Kommentiere „
                  </span>
                  <Input
                    key={piece.id + ":" + currentKeyword}
                    defaultValue={currentKeyword}
                    placeholder="Wort…"
                    disabled={!canEdit}
                    className="h-7 w-28 text-xs font-mono font-semibold bg-transparent border-0 rounded-none px-2 text-[hsl(var(--runway-green))] placeholder:text-[hsl(var(--runway-green))]/40 focus-visible:ring-0"
                    onBlur={(e) => {
                      const word = e.target.value.trim();
                      const next = word ? `Kommentiere:${word}` : "Kommentiere";
                      if (next !== piece.cta_label) {
                        onUpdatePiece(piece.id, { cta_label: next });
                      }
                      if (word && typeof window !== "undefined") {
                        localStorage.setItem(lsKey, word);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                  />
                  <span className="pr-2.5 text-[11px] font-mono text-[hsl(var(--runway-green))]">"</span>
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* Zone 3 — Assignee */}
      <div className="pl-7 sm:pl-9 max-w-xs">
        <FieldLabel>Zuständig</FieldLabel>
        <Select value={piece.assigned_to || ""} onValueChange={(v) => onUpdatePiece(piece.id, { assigned_to: v })} disabled={!canEdit}>
          <SelectTrigger className="h-9 text-xs font-mono bg-muted/30 border border-border/60 hover:bg-muted/50 rounded-lg">
            <SelectValue placeholder="Zuweisen" />
          </SelectTrigger>
          <SelectContent>
            {team.map((t) => (
              <SelectItem key={t.user_id} value={t.user_id}>{t.name || t.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Carousel slide images (full-width content) */}
      {activeType === "carousel" && (activePhase === "internal_review" || activePhase === "review" || activePhase === "approved" || activePhase === "handed_over" || activePhase === "script" || activePhase === "feedback") && (
        <div className="pl-7 sm:pl-9">
          <CarouselSlideUpload
            pieceId={piece.id}
            clientId={clientId}
            slideImages={piece.slide_images || []}
            canEdit={canEdit}
            onUpdate={(id, images) => onUpdatePiece(id, { slide_images: images })}
          />
        </div>
      )}

      {/* Late-phase row (link + caption + posting date) */}
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

      {/* Internal note */}
      {isInternalReview && (
        <div className="pl-7 sm:pl-9">
          <div className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 p-2">
            <ShieldCheck className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-1" />
            <div className="flex-1 space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-wider text-amber-500/80">
                Interne Notiz {isAdminLike ? "(nur Team — nie an Kunde)" : "(geht an Jonas)"}
              </div>
              <textarea
                defaultValue={piece.internal_note || ""}
                placeholder="Hinweis für Jonas / interne Bemerkungen…"
                disabled={!canEdit}
                className="w-full text-xs font-body bg-transparent border-0 focus:outline-none resize-none placeholder:text-muted-foreground/40"
                rows={2}
                onBlur={(e) => {
                  const val = e.target.value.trim();
                  if ((val || null) !== (piece.internal_note || null)) {
                    onUpdatePiece(piece.id, { internal_note: val || null });
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {internalFeedback && !isInternalReview && (
        <div className="pl-7 sm:pl-9">
          <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 p-2.5">
            <MessageSquare className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-wider text-primary/80">
                Internes Feedback aus Review
                {piece.phase_changed_at && (
                  <span className="ml-1 normal-case tracking-normal text-muted-foreground/70">
                    · {relativeTime(piece.phase_changed_at)}
                  </span>
                )}
              </div>
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">
                {internalFeedback}
              </p>
            </div>
            {canEdit && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[10px] text-muted-foreground shrink-0"
                onClick={() => onUpdatePiece(piece.id, { internal_note: null })}
              >
                ✕
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Client comment + Team reply */}
      {piece.client_comment && (
        <div className="space-y-2 pl-7 sm:pl-9">
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
        </div>
      )}

      {/* Internal comments with @mentions */}
      <PieceInternalComments pieceId={piece.id} clientId={clientId} team={team} />

      {/* Zone 4 — Action footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/60">
        {/* Left: primary contextual action */}
        <div className="flex items-center gap-2 flex-wrap">
          {activePhase === "script" && (
            <Button
              size="sm"
              variant="outline"
              className={cn(
                "h-8 text-xs font-mono gap-1.5 rounded-lg",
                piece.script_text
                  ? "text-[hsl(var(--runway-green))] border-[hsl(var(--runway-green))]/30 bg-[hsl(var(--runway-green))]/5 hover:bg-[hsl(var(--runway-green))]/10"
                  : "text-muted-foreground"
              )}
              onClick={() => onOpenScript(piece)}
            >
              <FileText className="h-3.5 w-3.5" />
              {piece.script_text ? "Skript bearbeiten" : "Skript schreiben"}
            </Button>
          )}
          {activeType === "carousel" && activePhase === "script" && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs font-mono gap-1.5 text-primary border-primary/30 bg-primary/5 hover:bg-primary/10 rounded-lg"
              onClick={() => onOpenCarouselBuilder(piece)}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Carousel Builder
            </Button>
          )}
          {(activePhase === "filmed" || activePhase === "editing") && (
            <Button
              size="sm"
              variant="outline"
              className={cn(
                "h-8 text-xs font-mono gap-1.5 rounded-lg",
                piece.script_text
                  ? "text-[hsl(var(--runway-green))] border-[hsl(var(--runway-green))]/30 bg-[hsl(var(--runway-green))]/5"
                  : "text-muted-foreground"
              )}
              onClick={() => onOpenScript(piece)}
            >
              <FileText className="h-3.5 w-3.5" />
              {piece.script_text ? "Skript ansehen" : "Skript hinzufügen"}
            </Button>
          )}
        </div>

        {/* Right: timestamp + admin approve + move next */}
        <div className="flex items-center gap-3 ml-auto">
          {piece.updated_at && (
            <span
              className="text-[11px] text-muted-foreground/60 italic font-light hidden sm:inline"
              title={`Seit ${format(new Date(piece.updated_at), "dd. MMM yyyy, HH:mm", { locale: de })} Uhr`}
            >
              {relativeTime(piece.updated_at)}
            </span>
          )}
          {activePhase === "review" && isAdminLike && (
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                size="sm"
                variant="default"
                className="h-8 px-3 text-xs gap-1.5 font-mono bg-[hsl(var(--runway-green))] hover:bg-[hsl(var(--runway-green))]/90 text-white border-0 rounded-lg"
                onClick={() => onMovePiece(piece.id, "approved")}
              >
                <Check className="h-3.5 w-3.5" /> Freigeben
              </Button>
            </motion.div>
          )}
          {nextPhase && (
            moveBlocked ? (
              <span className="text-[10px] font-mono text-muted-foreground/70 italic px-2">
                Wartet auf Jonas
              </span>
            ) : (
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button
                  size="sm"
                  variant={nextPhase === "handed_over" ? "default" : "secondary"}
                  className={cn(
                    "h-8 px-3 text-xs gap-1.5 font-mono rounded-lg",
                    nextPhase === "handed_over"
                      ? "bg-gradient-to-r from-primary to-[hsl(var(--runway-green))] shadow-sm shadow-primary/20 border-0 text-primary-foreground"
                      : "bg-foreground text-background hover:bg-foreground/90"
                  )}
                  onClick={() => onMovePiece(piece.id, nextPhase)}
                >
                  <span className="opacity-70">→</span>
                  {NextIcon ? <NextIcon size={13} /> : null}
                  <span>{config.phases.find((p) => p.key === nextPhase)?.label}</span>
                </Button>
              </motion.div>
            )
          )}
        </div>
      </div>
    </motion.div>
  );
});

PipelinePieceCard.displayName = "PipelinePieceCard";

export default PipelinePieceCard;
