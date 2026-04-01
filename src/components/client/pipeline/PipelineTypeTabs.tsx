import React from "react";
import { icons } from "lucide-react";
import { PIPELINE_CONFIG } from "./constants";
import type { ContentPiece } from "./types";
import { cn } from "@/lib/utils";

interface PipelineTypeTabsProps {
  activeType: string;
  onTypeChange: (type: string) => void;
  contentPieces: ContentPiece[];
}

const PipelineTypeTabs: React.FC<PipelineTypeTabsProps> = React.memo(({
  activeType,
  onTypeChange,
  contentPieces,
}) => {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {Object.entries(PIPELINE_CONFIG).map(([key, cfg]) => {
        const typeCount = contentPieces.filter((c) => c.type === key).length;
        const Icon = icons[cfg.emoji as keyof typeof icons];
        const isActive = activeType === key;
        return (
          <button
            key={key}
            onClick={() => onTypeChange(key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {Icon && <Icon size={14} />}
            <span>{cfg.label}</span>
            <span className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
              isActive ? "bg-primary-foreground/20" : "bg-background/60"
            )}>
              {typeCount}
            </span>
          </button>
        );
      })}
    </div>
  );
});

PipelineTypeTabs.displayName = "PipelineTypeTabs";

export default PipelineTypeTabs;
