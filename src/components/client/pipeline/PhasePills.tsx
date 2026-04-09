import React from "react";
import { motion } from "framer-motion";
import { icons } from "lucide-react";
import { cn } from "@/lib/utils";
import { isUpcomingHandedOver } from "@/lib/pipeline-utils";
import type { ContentPiece } from "./types";

interface PhasePillsProps {
  phases: { key: string; label: string; emoji: string }[];
  activePhase: string;
  onPhaseChange: (phase: string) => void;
  monthPieces: ContentPiece[];
}

const PhasePills: React.FC<PhasePillsProps> = React.memo(({
  phases,
  activePhase,
  onPhaseChange,
  monthPieces,
}) => {
  return (
    <div className="flex flex-wrap gap-1.5 mb-5 overflow-x-auto scrollbar-none">
      {phases.map((p) => {
        const count = monthPieces.filter((c) => {
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
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs transition-all whitespace-nowrap",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            {Icon && <Icon size={14} />}
            <span className="hidden sm:inline">{p.label}</span>
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
  );
});

PhasePills.displayName = "PhasePills";

export default PhasePills;
