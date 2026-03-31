import React from "react";
import { motion } from "framer-motion";
import { icons } from "lucide-react";
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
        const count = monthPieces.filter((c) => c.phase === p.key).length;
        const isActive = activePhase === p.key;
        const isHandedOver = p.key === "handed_over";
        const Icon = icons[p.emoji as keyof typeof icons];
        return (
          <motion.button
            key={p.key}
            onClick={() => onPhaseChange(p.key)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`flex items-center gap-1 sm:gap-2 rounded-lg px-2.5 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-mono transition-all whitespace-nowrap ${
              isActive
                ? isHandedOver
                  ? "bg-gradient-to-r from-primary to-[hsl(var(--runway-green))] text-primary-foreground shadow-md shadow-primary/20"
                  : "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}>
            {Icon && <Icon size={14} />}
            <span className="hidden sm:inline">{p.label}</span>
            <motion.span
              key={count}
              initial={{ scale: 1.3 }}
              animate={{ scale: 1 }}
              className={`rounded-full px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-bold ${
                isActive ? "bg-primary-foreground/20" : "bg-background/80"
              }`}>
              {count}
            </motion.span>
          </motion.button>
        );
      })}
    </div>
  );
});

PhasePills.displayName = "PhasePills";

export default PhasePills;
