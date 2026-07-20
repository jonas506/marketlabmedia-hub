import React from "react";
import { Button } from "@/components/ui/button";
import { Printer, FileText, LayoutList, Columns3, AlertTriangle, Film, LayoutGrid, Megaphone, Youtube, ExternalLink, FolderDown, Info } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { PipelineConfig } from "./types";
import { FUNNEL_STAGES } from "./FunnelStageSelector";

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
  funnelSummary?: { tofu: number; mofu: number; bofu: number; none: number };
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
  onOpenDriveImport,
  canEdit,
  hasPieces,
  noDeadlineCount = 0,
  funnelSummary,
  driveLinks,
}) => {
  const activeDriveLinks = DRIVE_LINK_ITEMS.filter(item => driveLinks?.[item.key]);
  const mainDriveLink = driveLinks?.drive_folder_id
    ? `https://drive.google.com/drive/folders/${driveLinks.drive_folder_id}`
    : null;

  const funnelTotal = funnelSummary
    ? funnelSummary.tofu + funnelSummary.mofu + funnelSummary.bofu + funnelSummary.none
    : 0;
  const hasInsights = noDeadlineCount > 0 || funnelTotal > 0 || phaseSummary.some(p => p.count > 0);

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-border">
      <h3 className="text-sm font-semibold">Material-Pipeline</h3>

      {totalPieces > 0 && (
        <div className="flex items-center gap-2">
          <div className="w-16 h-[5px] rounded-full bg-muted/50 overflow-hidden">
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

      {/* Insights popover: warnings + funnel + phase breakdown */}
      {hasInsights && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "inline-flex items-center gap-1.5 text-[11px] rounded-md px-2 py-1 transition-colors border",
                noDeadlineCount > 0
                  ? "text-amber-500 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15"
                  : "text-muted-foreground border-border hover:bg-muted/60"
              )}
            >
              {noDeadlineCount > 0 ? (
                <>
                  <AlertTriangle className="h-3 w-3" />
                  <span className="tabular-nums">{noDeadlineCount}</span>
                  <span className="hidden md:inline">ohne Deadline</span>
                </>
              ) : (
                <>
                  <Info className="h-3 w-3" />
                  <span className="hidden md:inline">Insights</span>
                </>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 space-y-3">
            {noDeadlineCount > 0 && (
              <div className="flex items-start gap-2 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                <span>
                  <strong className="text-foreground tabular-nums">{noDeadlineCount}</strong> Pieces ohne Deadline
                </span>
              </div>
            )}

            {funnelSummary && funnelTotal > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono">Funnel</p>
                <div className="flex flex-wrap items-center gap-1">
                  {FUNNEL_STAGES.map((s) => {
                    const count = funnelSummary[s.value as "tofu" | "mofu" | "bofu"];
                    return (
                      <span key={s.value} className={cn(
                        "inline-flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded-md border tabular-nums",
                        s.className,
                        count === 0 && "opacity-40"
                      )}>
                        {s.label} <span className="font-semibold">{count}</span>
                      </span>
                    );
                  })}
                  {funnelSummary.none > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded-md border border-dashed border-border text-muted-foreground tabular-nums">
                      ? <span className="font-semibold">{funnelSummary.none}</span>
                    </span>
                  )}
                </div>
              </div>
            )}

            {phaseSummary.some(p => p.count > 0) && (
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono">Phasen</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                  {phaseSummary.map((p) => (
                    <div key={p.key} className="flex items-center justify-between">
                      <span className="text-muted-foreground truncate">{p.label}</span>
                      <span className={cn("tabular-nums", p.count > 0 ? "text-foreground font-semibold" : "text-muted-foreground/50")}>{p.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </PopoverContent>
        </Popover>
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-1.5 flex-wrap">
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
                    <span className="hidden xl:inline">{item.label}</span>
                  </a>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">{item.label}-Ordner in Drive öffnen</TooltipContent>
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
                    <span className="hidden xl:inline">Drive</span>
                  </a>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">Kunden-Ordner in Drive öffnen</TooltipContent>
              </Tooltip>
            )}
          </div>
        )}

        {canEdit && onOpenDriveImport && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={onOpenDriveImport}>
                <FolderDown className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Drive Import</TooltipContent>
          </Tooltip>
        )}
        {hasPieces && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={onOpenPrintScripts}>
                <Printer className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Drucken</TooltipContent>
          </Tooltip>
        )}
        {canEdit && hasPieces && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={onOpenCaptionStudio}>
                <FileText className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Caption Studio</TooltipContent>
          </Tooltip>
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
    </div>
  );
});

PipelineHeader.displayName = "PipelineHeader";

export default PipelineHeader;
