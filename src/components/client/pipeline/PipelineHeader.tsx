import React from "react";
import { Button } from "@/components/ui/button";
import { Printer, FileText, LayoutList, Columns3, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { PipelineConfig } from "./types";

interface PipelineHeaderProps {
  config: PipelineConfig;
  totalPieces: number;
  progress: number;
  phaseSummary: { key: string; label: string; emoji: string; count: number }[];
  viewMode: "list" | "kanban";
  onViewModeChange: (mode: "list" | "kanban") => void;
  onOpenPrintScripts: () => void;
  onOpenCaptionStudio: () => void;
  canEdit: boolean;
  hasPieces: boolean;
  noDeadlineCount?: number;
}

const PipelineHeader: React.FC<PipelineHeaderProps> = React.memo(({
  totalPieces,
  progress,
  phaseSummary,
  viewMode,
  onViewModeChange,
  onOpenPrintScripts,
  onOpenCaptionStudio,
  canEdit,
  hasPieces,
  noDeadlineCount = 0,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-4 py-3 border-b border-border">
      <h3 className="text-sm font-semibold">Material-Pipeline</h3>
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
          <span className="text-[11px] text-muted-foreground tabular-nums">{progress}%</span>
        </div>
      )}
      {noDeadlineCount > 0 && (
        <span className="flex items-center gap-1.5 text-[11px] text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-md">
          <AlertTriangle className="h-3 w-3" />
          {noDeadlineCount} ohne Deadline
        </span>
      )}
      <div className="flex-1" />
      <div className="flex items-center gap-1.5 flex-wrap">
        {hasPieces && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5"
            onClick={onOpenPrintScripts}
          >
            <Printer className="h-3 w-3" />
            <span className="hidden sm:inline">Drucken</span>
          </Button>
        )}
        {canEdit && hasPieces && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5"
            onClick={onOpenCaptionStudio}
          >
            <FileText className="h-3 w-3" />
            <span className="hidden sm:inline">Caption Studio</span>
          </Button>
        )}
        <div className="flex items-center bg-muted/50 rounded-lg p-0.5">
          <button
            onClick={() => onViewModeChange("list")}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-all",
              viewMode === "list"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutList className="h-3 w-3" />
            <span className="hidden sm:inline">Liste</span>
          </button>
          <button
            onClick={() => onViewModeChange("kanban")}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-all",
              viewMode === "kanban"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Columns3 className="h-3 w-3" />
            <span className="hidden sm:inline">Kanban</span>
          </button>
        </div>
      </div>
      <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground w-full sm:w-auto mt-1 sm:mt-0">
        {phaseSummary.map((p, i) => (
          <span key={p.key} className="flex items-center gap-1">
            {i > 0 && <span className="text-border mx-0.5">·</span>}
            <span className={p.count > 0 ? "text-foreground font-semibold tabular-nums" : "tabular-nums"}>{p.count}</span>
            <span>{p.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
});

PipelineHeader.displayName = "PipelineHeader";

export default PipelineHeader;
