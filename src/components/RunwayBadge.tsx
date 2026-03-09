import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface RunwayBadgeProps {
  days: number;
  size?: "sm" | "lg";
}

const RunwayBadge: React.FC<RunwayBadgeProps> = ({ days, size = "sm" }) => {
  const color = days > 14 ? "text-runway-green" : days >= 7 ? "text-runway-yellow" : "text-runway-red";
  const bgColor = days > 14 ? "bg-runway-green" : days >= 7 ? "bg-runway-yellow" : "bg-runway-red";
  const glowClass = days > 14 ? "shadow-[0_0_12px_hsl(var(--runway-green)/0.3)]" : days >= 7 ? "shadow-[0_0_12px_hsl(var(--runway-yellow)/0.3)]" : "shadow-[0_0_12px_hsl(var(--runway-red)/0.3)]";

  if (size === "lg") {
    return (
      <div className="flex items-center gap-3">
        <motion.span
          key={days}
          initial={{ scale: 1.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={cn("font-mono text-5xl font-bold", color)}
        >
          {days}
        </motion.span>
        <div className="flex flex-col">
          <span className="font-mono text-xs uppercase text-muted-foreground tracking-wider">Tage</span>
          <span className="font-mono text-xs uppercase text-muted-foreground tracking-wider">Runway</span>
        </div>
        <div className={cn("h-3 w-3 rounded-full", bgColor, glowClass)} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5">
      <div className={cn("h-2.5 w-2.5 rounded-full", bgColor, glowClass)} />
      <motion.span
        key={days}
        initial={{ scale: 1.2, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={cn("font-mono text-xl font-bold", color)}
      >
        {days}
      </motion.span>
      <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Tage</span>
    </div>
  );
};

export default RunwayBadge;
