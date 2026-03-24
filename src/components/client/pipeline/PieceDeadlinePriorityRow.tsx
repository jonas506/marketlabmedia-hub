import React from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { PRIORITY_OPTIONS } from "./constants";
import type { ContentPiece } from "./types";

interface PieceDeadlinePriorityRowProps {
  piece: ContentPiece;
  canEdit: boolean;
  onUpdatePiece: (pieceId: string, updates: Record<string, any>) => void;
}

const PieceDeadlinePriorityRow: React.FC<PieceDeadlinePriorityRowProps> = React.memo(({
  piece,
  canEdit,
  onUpdatePiece,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className="flex items-center gap-3 pl-9 flex-wrap"
    >
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
            onSelect={(date) => onUpdatePiece(piece.id, { deadline: date ? format(date, "yyyy-MM-dd") : null })}
            initialFocus
            locale={de}
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>

      <Select
        value={piece.priority || "normal"}
        onValueChange={(v) => onUpdatePiece(piece.id, { priority: v })}
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
  );
});

PieceDeadlinePriorityRow.displayName = "PieceDeadlinePriorityRow";

export default PieceDeadlinePriorityRow;
