import React from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { icons } from "lucide-react";
import { motion } from "framer-motion";
import { relativeTime } from "./constants";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import type { ContentPiece, TeamMember, PipelineConfig, MonthOption } from "./types";

interface PieceActionRowProps {
  piece: ContentPiece;
  activePhase: string;
  activeType: string;
  isLatePhase: boolean;
  config: PipelineConfig;
  nextPhase: string | undefined;
  team: TeamMember[];
  canEdit: boolean;
  monthOptions: MonthOption[];
  userRole?: string | null;
  onUpdatePiece: (pieceId: string, updates: Record<string, any>) => void;
  onMovePiece: (pieceId: string, nextPhase: string) => void;
}

const PieceActionRow: React.FC<PieceActionRowProps> = React.memo(({
  piece,
  activePhase,
  activeType,
  isLatePhase,
  config,
  nextPhase,
  team,
  canEdit,
  monthOptions,
  userRole,
  onUpdatePiece,
  onMovePiece,
}) => {
  return (
    <>
      {/* CTA Label — Story Ads only */}
      {activeType === "story" && (
        <Select
          value={piece.cta_label || ""}
          onValueChange={(v) => onUpdatePiece(piece.id, { cta_label: v === "_clear" ? null : v })}
          disabled={!canEdit}
        >
          <SelectTrigger className={`h-6 sm:h-7 w-24 sm:w-36 text-[10px] sm:text-xs font-mono border-0 px-2 rounded-md ${
            piece.cta_label
              ? "bg-secondary/15 text-secondary"
              : "bg-muted/60 text-muted-foreground"
          }`}>
            <SelectValue placeholder="📢 CTA" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_clear"><span className="text-muted-foreground">— Kein CTA</span></SelectItem>
            <SelectItem value="Community">🏠 Community</SelectItem>
            <SelectItem value="Kurs">📚 Kurs</SelectItem>
            <SelectItem value="Erstgespräch">📞 Erstgespräch</SelectItem>
            <SelectItem value="Webinar">🎙️ Webinar</SelectItem>
            <SelectItem value="Freebie">🎁 Freebie</SelectItem>
            <SelectItem value="Produkt">🛒 Produkt</SelectItem>
            <SelectItem value="Newsletter">📧 Newsletter</SelectItem>
            <SelectItem value="Coaching">🎯 Coaching</SelectItem>
            <SelectItem value="Workshop">🛠️ Workshop</SelectItem>
            <SelectItem value="App">📱 App</SelectItem>
          </SelectContent>
        </Select>
      )}

      {/* Assigned */}
      <Select value={piece.assigned_to || ""} onValueChange={(v) => onUpdatePiece(piece.id, { assigned_to: v })} disabled={!canEdit}>
        <SelectTrigger className="h-6 sm:h-7 w-24 sm:w-32 text-[10px] sm:text-xs font-mono border-0 bg-muted/60 px-2 rounded-md">
          <SelectValue placeholder="Zuweisen" />
        </SelectTrigger>
        <SelectContent>
          {team.map((t) => (
            <SelectItem key={t.user_id} value={t.user_id}>{t.name || t.email}</SelectItem>
          ))}
        </SelectContent>
      </Select>


      <div className="flex-1" />

      {/* Move to next phase */}
      {nextPhase && (
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            size="sm"
            variant={nextPhase === "handed_over" ? "default" : "outline"}
            className={`h-6 sm:h-7 px-2 sm:px-3 text-[10px] sm:text-xs gap-1 font-mono ${
              nextPhase === "handed_over"
                ? "bg-gradient-to-r from-primary to-[hsl(var(--runway-green))] shadow-sm shadow-primary/20 border-0"
                : ""
            }`}
            onClick={() => onMovePiece(piece.id, nextPhase)}
          >
            → {(() => { const NIcon = icons[config.phases.find((p) => p.key === nextPhase)?.emoji as keyof typeof icons]; return NIcon ? <NIcon size={12} /> : null; })()}
            <span className="hidden sm:inline"> {config.phases.find((p) => p.key === nextPhase)?.label}</span>
          </Button>
        </motion.div>
      )}

      {/* Admin: Direct approve from review */}
      {activePhase === "review" && (userRole === "admin" || userRole === "head_of_content") && (
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            size="sm"
            variant="default"
            className="h-6 sm:h-7 px-2 sm:px-3 text-[10px] sm:text-xs gap-1 font-mono bg-[hsl(var(--runway-green))] hover:bg-[hsl(var(--runway-green))]/90 text-white border-0"
            onClick={() => onMovePiece(piece.id, "approved")}
          >
            ✓ <span className="hidden sm:inline">Freigeben</span>
          </Button>
        </motion.div>
      )}
      {/* Timestamp */}
      {piece.updated_at && (
        <span className="text-[10px] text-muted-foreground/60 font-mono hidden sm:inline" title={`Seit ${format(new Date(piece.updated_at), "dd. MMM yyyy, HH:mm", { locale: de })} Uhr`}>
          {relativeTime(piece.updated_at)}
        </span>
      )}
    </>
  );
});

PieceActionRow.displayName = "PieceActionRow";

export default PieceActionRow;
