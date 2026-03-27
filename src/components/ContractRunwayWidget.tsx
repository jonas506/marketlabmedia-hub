import { useClients } from "@/hooks/useClients";
import { differenceInDays, parseISO } from "date-fns";
import { Link } from "react-router-dom";
import { CalendarRange, AlertTriangle, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

export default function ContractRunwayWidget() {
  const { data: clients } = useClients();
  const now = new Date();

  const urgent = (clients ?? [])
    .filter((c) => c.contract_start)
    .map((c) => {
      let end: Date;
      if ((c as any).contract_end) {
        end = parseISO((c as any).contract_end);
      } else if (c.contract_duration) {
        const months = parseInt(c.contract_duration) || 12;
        end = new Date(parseISO(c.contract_start!));
        end.setMonth(end.getMonth() + months);
      } else {
        end = new Date(parseISO(c.contract_start!));
        end.setMonth(end.getMonth() + 12);
      }
      const remainingDays = differenceInDays(end, now);
      const start = parseISO(c.contract_start!);
      const totalDays = differenceInDays(end, start);
      const progress = totalDays > 0 ? Math.min(Math.max(differenceInDays(now, start) / totalDays, 0), 1) : 0;
      return { ...c, remainingDays, progress };
    })
    .filter((c) => c.remainingDays <= 90)
    .sort((a, b) => a.remainingDays - b.remainingDays);

  if (urgent.length === 0) return null;

  const getColor = (d: number) => {
    if (d <= 0) return "bg-destructive";
    if (d <= 30) return "bg-orange-500";
    return "bg-yellow-500";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 rounded-xl border border-border bg-card p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-display font-semibold">Vertragslaufzeiten</h3>
          {urgent.some((c) => c.remainingDays <= 30) && (
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
          )}
        </div>
        <Link
          to="/contracts"
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
        >
          Alle anzeigen <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="space-y-2">
        {urgent.slice(0, 5).map((client) => (
          <div key={client.id} className="flex items-center gap-3">
            <div className="w-24 truncate text-xs font-medium">{client.name}</div>
            <div className="flex-1 h-2 rounded-full bg-muted/50 overflow-hidden">
              <div
                className={`h-full rounded-full ${getColor(client.remainingDays)} transition-all`}
                style={{ width: `${Math.max(client.progress * 100, 4)}%`, opacity: 0.8 }}
              />
            </div>
            <span className={`text-[10px] font-mono tabular-nums w-16 text-right ${
              client.remainingDays <= 0 ? "text-destructive font-semibold" :
              client.remainingDays <= 30 ? "text-orange-500" : "text-muted-foreground"
            }`}>
              {client.remainingDays <= 0
                ? `${Math.abs(client.remainingDays)}d über`
                : `${client.remainingDays}d übrig`}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
