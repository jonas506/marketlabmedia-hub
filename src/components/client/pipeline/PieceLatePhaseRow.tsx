import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, FileText, ExternalLink, Link as LinkIcon, Copy } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type { ContentPiece } from "./types";

interface PieceLatePhaseRowProps {
  piece: ContentPiece;
  activePhase: string;
  canEdit: boolean;
  localTitle: string | undefined;
  onUpdatePiece: (pieceId: string, updates: Record<string, any>) => void;
  onOpenScript: (piece: ContentPiece) => void;
  onOpenDetail: (piece: ContentPiece) => void;
  onPreviewLinkChange: (pieceId: string, allLinks: string, currentTitle: string | null) => void;
}

const PieceLatePhaseRow: React.FC<PieceLatePhaseRowProps> = React.memo(({
  piece,
  activePhase,
  canEdit,
  localTitle,
  onUpdatePiece,
  onOpenScript,
  onOpenDetail,
  onPreviewLinkChange,
}) => {
  const qc = useQueryClient();
  const links = (piece.preview_link || "").split("\n").filter((l: string) => l.trim());
  const linkCount = links.length;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className="flex items-center gap-2 pl-7 sm:pl-9 flex-wrap"
    >
      {/* Scheduled Post Date */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={!canEdit}
            className={cn(
              "h-6 sm:h-7 justify-start text-[10px] sm:text-xs font-mono border-0 px-2 sm:px-2.5 rounded-md gap-1.5",
              piece.scheduled_post_date
                ? "bg-[hsl(var(--runway-green))]/10 text-[hsl(var(--runway-green))] border-[hsl(var(--runway-green))]/20"
                : "bg-destructive/10 text-destructive animate-pulse"
            )}
          >
            <CalendarIcon className="h-3 w-3 shrink-0" />
            {piece.scheduled_post_date
              ? format(new Date(piece.scheduled_post_date), "dd. MMM", { locale: de })
              : "📅 Posting-Datum!"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={piece.scheduled_post_date ? new Date(piece.scheduled_post_date) : undefined}
            onSelect={(date) => {
              onUpdatePiece(piece.id, { scheduled_post_date: date ? format(date, "yyyy-MM-dd") : null });
              qc.invalidateQueries({ queryKey: ["posting-calendar"] });
            }}
            initialFocus
            locale={de}
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>

      {/* Script button in late phases */}
      <Button
        size="sm"
        variant="ghost"
        className={cn(
          "h-6 px-2 text-[10px] font-mono gap-1.5",
          piece.script_text
            ? "text-[hsl(var(--runway-green))] hover:bg-[hsl(var(--runway-green))]/10"
            : "text-muted-foreground hover:bg-muted/60"
        )}
        onClick={() => onOpenScript(piece)}
      >
        <FileText className="h-3 w-3" />
        {piece.script_text ? "Skript" : "Skript"}
      </Button>

      {/* Preview links */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className={cn(
              "h-6 px-2 text-[10px] font-mono gap-1.5",
              linkCount > 0
                ? "text-primary hover:bg-primary/10"
                : "text-muted-foreground hover:bg-muted/60"
            )}
          >
            <LinkIcon className="h-3 w-3 shrink-0" />
            {linkCount > 0 ? (
              <span>{linkCount} Link{linkCount > 1 ? "s" : ""}</span>
            ) : (
              <span>Links</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-3" align="start">
          <div className="space-y-3">
            <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Preview-Links (z.B. pro Hook ein Video)</label>
            {[...links, ""].map((link, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground font-mono w-4 shrink-0">{idx + 1}.</span>
                <Input
                  value={link}
                  placeholder="https://drive.google.com/..."
                  className="h-7 text-xs font-mono flex-1"
                  disabled={!canEdit}
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    const updated = [...links];
                    if (idx < links.length) {
                      if (val) updated[idx] = val;
                      else updated.splice(idx, 1);
                    } else if (val) {
                      updated.push(val);
                    }
                    const joined = updated.filter(Boolean).join("\n");
                    if (joined !== piece.preview_link) {
                      onUpdatePiece(piece.id, { preview_link: joined || null });
                      if (idx === 0 && val && val.includes("drive.google.com") && !piece.title) {
                        onPreviewLinkChange(piece.id, joined, localTitle ?? piece.title);
                      }
                    }
                  }}
                  onChange={(e) => {
                    const updated = [...links];
                    if (idx < links.length) updated[idx] = e.target.value;
                    else updated.push(e.target.value);
                    onUpdatePiece(piece.id, { preview_link: updated.filter(Boolean).join("\n") });
                  }}
                />
                {link && (
                  <a href={link} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80" onClick={(e) => e.stopPropagation()}>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {linkCount > 0 && (
        <a href={links[0]} target="_blank" rel="noopener noreferrer"
          className="text-muted-foreground hover:text-primary transition-colors">
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}

      {/* Caption/Transcript */}
      {(
        <>
          <span className="text-border">·</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10px] font-mono gap-1.5 hover:bg-primary/10"
            onClick={() => onOpenDetail(piece)}
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
  );
});

PieceLatePhaseRow.displayName = "PieceLatePhaseRow";

export default PieceLatePhaseRow;
