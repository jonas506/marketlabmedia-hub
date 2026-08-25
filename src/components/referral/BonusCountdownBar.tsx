import { useEffect, useState } from "react";
import { Gift, ArrowRight } from "lucide-react";

/** Ende der Aktion: 31. August, 23:59 (Berlin, UTC+2) */
export const BONUS_DEADLINE = new Date("2026-08-31T23:59:59+02:00");

export const isBonusActive = () => Date.now() < BONUS_DEADLINE.getTime();

function useCountdown(target: Date) {
  const [left, setLeft] = useState(() => target.getTime() - Date.now());
  useEffect(() => {
    const id = setInterval(() => setLeft(target.getTime() - Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);
  const clamped = Math.max(0, left);
  return {
    expired: left <= 0,
    days: Math.floor(clamped / 86400000),
    hours: Math.floor((clamped % 86400000) / 3600000),
    minutes: Math.floor((clamped % 3600000) / 60000),
    seconds: Math.floor((clamped % 60000) / 1000),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function BonusCountdownBar({ onClick }: { onClick?: () => void }) {
  const { expired, days, hours, minutes, seconds } = useCountdown(BONUS_DEADLINE);
  if (expired) return null;

  return (
    <button
      onClick={onClick}
      className="group relative w-full overflow-hidden text-left"
      style={{ background: "linear-gradient(90deg, #b45309 0%, #f59e0b 50%, #b45309 100%)" }}
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-center gap-2 sm:gap-3 text-[#1a1208]">
        <Gift className="h-3.5 w-3.5 shrink-0" />
        <span className="text-[11px] sm:text-xs font-bold tracking-tight">
          +50 % Empfehlungsprämie
        </span>
        <span className="hidden sm:inline text-[11px] font-medium opacity-70">
          nur bis 31. August
        </span>
        <span className="flex items-center gap-1 font-mono text-[11px] sm:text-xs font-bold tabular-nums">
          {days > 0 && <span>{days}T</span>}
          <span>{pad(hours)}:{pad(minutes)}:{pad(seconds)}</span>
        </span>
        <ArrowRight className="h-3 w-3 opacity-70 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </button>
  );
}
