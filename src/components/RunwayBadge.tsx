import { cn } from "@/lib/utils";

interface RunwayBadgeProps {
  days: number;
  size?: "sm" | "lg";
}

const RunwayBadge: React.FC<RunwayBadgeProps> = ({ days, size = "sm" }) => {
  const color = days > 14 ? "runway-green" : days >= 7 ? "runway-yellow" : "runway-red";
  const bgColor = days > 14 ? "bg-runway-green" : days >= 7 ? "bg-runway-yellow" : "bg-runway-red";

  if (size === "lg") {
    return (
      <div className="flex items-center gap-3">
        <span className={cn("font-mono text-5xl font-bold", color)}>
          {days}
        </span>
        <div className="flex flex-col">
          <span className="font-mono text-xs uppercase text-muted-foreground">Tage</span>
          <span className="font-mono text-xs uppercase text-muted-foreground">Runway</span>
        </div>
        <div className={cn("h-3 w-3 rounded-full", bgColor)} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className={cn("h-2.5 w-2.5 rounded-full", bgColor)} />
      <span className={cn("font-mono text-lg font-bold", color)}>{days}</span>
      <span className="font-mono text-xs text-muted-foreground">TAGE</span>
    </div>
  );
};

export default RunwayBadge;
