import { cn } from "@/lib/utils";
import { formatHoursMinutes } from "@/lib/time-tracking-constants";

interface SollIstBarProps {
  actual: number;
  target: number;
  label?: string;
  className?: string;
}

/** Kompakte Soll/Ist-Anzeige mit Fortschrittsbalken und Differenz. */
export default function SollIstBar({ actual, target, label, className }: SollIstBarProps) {
  const pct = target > 0 ? Math.min((actual / target) * 100, 100) : 0;
  const diff = actual - target;
  const isOver = diff >= 0;

  return (
    <div className={cn("rounded-lg border bg-card px-4 py-3", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2">
          {label && <span className="text-xs font-medium text-muted-foreground">{label}</span>}
          <span className="text-sm font-semibold">{formatHoursMinutes(actual)}</span>
          <span className="text-xs text-muted-foreground">
            / {target > 0 ? formatHoursMinutes(target) : "—"} Soll
          </span>
        </div>
        {target > 0 && (
          <span className={cn("text-xs font-medium tabular-nums", isOver ? "text-emerald-500" : "text-amber-500")}>
            {isOver ? "+" : "−"}{formatHoursMinutes(Math.abs(diff))}
          </span>
        )}
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", isOver ? "bg-emerald-500" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
