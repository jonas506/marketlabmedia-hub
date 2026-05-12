import React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Target } from "lucide-react";
import { cn } from "@/lib/utils";

export const FUNNEL_STAGES = [
  { value: "tofu", label: "TOFU", description: "Top of Funnel · Reichweite", className: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30" },
  { value: "mofu", label: "MOFU", description: "Middle · Vertrauen / Nurture", className: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30" },
  { value: "bofu", label: "BOFU", description: "Bottom · Conversion", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
] as const;

export const getFunnelStage = (value: string | null | undefined) =>
  FUNNEL_STAGES.find((s) => s.value === value);

interface Props {
  value: string | null | undefined;
  canEdit: boolean;
  onChange: (value: string | null) => void;
}

const FunnelStageSelector: React.FC<Props> = ({ value, canEdit, onChange }) => {
  const current = getFunnelStage(value);

  const trigger = (
    <button
      type="button"
      disabled={!canEdit}
      className={cn(
        "inline-flex items-center gap-1 h-6 sm:h-7 text-[10px] sm:text-xs font-mono px-2 sm:px-2.5 rounded-md border transition-colors",
        current
          ? current.className
          : "border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
        !canEdit && "cursor-default opacity-90"
      )}
      title="Funnel-Stage"
    >
      <Target className="h-3 w-3 shrink-0" />
      {current?.label ?? "Funnel"}
    </button>
  );

  if (!canEdit) return trigger;

  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        <div className="text-[10px] font-mono uppercase text-muted-foreground px-2 pt-1.5 pb-1">Funnel-Stage</div>
        {FUNNEL_STAGES.map((s) => (
          <button
            key={s.value}
            onClick={() => onChange(value === s.value ? null : s.value)}
            className={cn(
              "w-full flex items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted/60 transition-colors",
              value === s.value && "bg-muted/60"
            )}
          >
            <span className={cn("inline-flex items-center h-5 px-1.5 rounded font-mono text-[10px] border", s.className)}>
              {s.label}
            </span>
            <span className="text-[11px] text-muted-foreground leading-tight pt-0.5">{s.description}</span>
          </button>
        ))}
        {value && (
          <button
            onClick={() => onChange(null)}
            className="w-full text-left text-[11px] text-muted-foreground hover:text-destructive px-2 py-1.5 rounded-md hover:bg-muted/60"
          >
            ✕ Entfernen
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default FunnelStageSelector;
