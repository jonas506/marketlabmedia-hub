import React from "react";
import { Button } from "@/components/ui/button";
import { Printer, FileText, LayoutList, Columns3, AlertTriangle, Film, LayoutGrid, Megaphone, Youtube, ExternalLink, FolderDown } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PipelineConfig } from "./types";

interface DriveLinks {
  drive_folder_id?: string | null;
  drive_reels_link?: string | null;
  drive_carousels_link?: string | null;
  drive_ads_link?: string | null;
  drive_youtube_link?: string | null;
}

interface PipelineHeaderProps {
  config: PipelineConfig;
  totalPieces: number;
  progress: number;
  phaseSummary: { key: string; label: string; emoji: string; count: number }[];
  viewMode: "list" | "kanban";
  onViewModeChange: (mode: "list" | "kanban") => void;
  onOpenPrintScripts: () => void;
  onOpenCaptionStudio: () => void;
  onOpenDriveImport?: () => void;
  canEdit: boolean;
  hasPieces: boolean;
  noDeadlineCount?: number;
  driveLinks?: DriveLinks;
}

const DRIVE_LINK_ITEMS = [
  { key: "drive_reels_link" as const, label: "Reels", icon: Film, color: "text-rose-500" },
  { key: "drive_carousels_link" as const, label: "Karussells", icon: LayoutGrid, color: "text-blue-500" },
  { key: "drive_ads_link" as const, label: "Ads", icon: Megaphone, color: "text-amber-500" },
  { key: "drive_youtube_link" as const, label: "YouTube", icon: Youtube, color: "text-red-500" },
];

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
  driveLinks,
}) => {
  const activeDriveLinks = DRIVE_LINK_ITEMS.filter(item => driveLinks?.[item.key]);
  const mainDriveLink = driveLinks?.drive_folder_id
    ? `https://drive.google.com/drive/folders/${driveLinks.drive_folder_id}`
    : null;

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
        {/* Drive Links */}
        {(activeDriveLinks.length > 0 || mainDriveLink) && (
          <div className="flex items-center gap-0.5 bg-muted/50 rounded-lg px-1 py-0.5">
            {activeDriveLinks.map(item => (
              <Tooltip key={item.key}>
                <TooltipTrigger asChild>
                  <a
                    href={driveLinks![item.key]!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-all hover:bg-background/80",
                      item.color
                    )}
                  >
                    <item.icon className="h-3 w-3" />
                    <span className="hidden lg:inline">{item.label}</span>
                  </a>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {item.label}-Ordner in Drive öffnen
                </TooltipContent>
              </Tooltip>
            ))}
            {mainDriveLink && activeDriveLinks.length === 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href={mainDriveLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-muted-foreground hover:text-foreground transition-all hover:bg-background/80"
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span className="hidden lg:inline">Drive</span>
                  </a>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Kunden-Ordner in Drive öffnen
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        )}

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
