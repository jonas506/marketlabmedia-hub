import React from "react";
import { icons } from "lucide-react";
import { cn } from "@/lib/utils";
import { PIPELINE_CONFIG } from "./constants";
import { isArchivedHandedOver, isUpcomingHandedOver } from "@/lib/pipeline-utils";
import type { ContentPiece } from "./types";

interface PipelineSubNavProps {
  activeType: string;
  onTypeChange: (type: string) => void;
  contentPieces: ContentPiece[];
  phases?: { key: string; label: string; emoji: string }[];
  activePhase?: string;
  onPhaseChange?: (phase: string) => void;
  monthPieces?: ContentPiece[];
  showPhases: boolean;
}

const PipelineSubNav: React.FC<PipelineSubNavProps> = React.memo(({
  activeType,
  onTypeChange,
  contentPieces,
  phases,
  activePhase,
  onPhaseChange,
  monthPieces,
  showPhases,
}) => {
  return (
    <div className="flex items-center gap-2 mb-4 -mx-1 px-1 overflow-x-auto scrollbar-none">
      {/* Format tabs — compact icon+count */}
      <div className="flex items-center gap-1 shrink-0">
        {Object.entries(PIPELINE_CONFIG).map(([key, cfg]) => {
          const typeCount = contentPieces.filter(
            (c) => c.type === key && !(c.phase === "handed_over" && isArchivedHandedOver(c.scheduled_post_date))
          ).length;
          const Icon = icons[cfg.emoji as keyof typeof icons];
          const isActive = activeType === key;
          return (
            <button
              key={key}
              onClick={() => onTypeChange(key)}
              title={cfg.label}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-all whitespace-nowrap",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              {Icon && <Icon size={14} />}
              <span className="hidden md:inline">{cfg.label}</span>
              <span className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                isActive ? "bg-primary-foreground/20" : "bg-muted/80"
              )}>
                {typeCount}
              </span>
            </button>
          );
        })}
      </div>

      {showPhases && phases && phases.length > 0 && onPhaseChange && (
        <>
          <div className="h-6 w-px bg-border shrink-0 mx-1" />
          <div className="flex items-center gap-1 shrink-0">
            {phases.map((p) => {
              const count = (monthPieces ?? []).filter((c) => {
                if (c.phase !== p.key) return false;
                if (p.key !== "handed_over") return true;
                return isUpcomingHandedOver(c.scheduled_post_date);
              }).length;
              const isActive = activePhase === p.key;
              const Icon = icons[p.emoji as keyof typeof icons];
              return (
                <button
                  key={p.key}
                  onClick={() => onPhaseChange(p.key)}
                  title={p.label}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-all whitespace-nowrap",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  {Icon && <Icon size={14} />}
                  <span className="hidden lg:inline">{p.label}</span>
                  <span className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                    isActive ? "bg-primary-foreground/20" : "bg-muted/80"
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
});

PipelineSubNav.displayName = "PipelineSubNav";

export default PipelineSubNav;
