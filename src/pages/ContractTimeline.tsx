import { useClients } from "@/hooks/useClients";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { differenceInDays, format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import ErrorBoundary from "@/components/ErrorBoundary";

const ContractTimeline = () => {
  const { data: clients, isLoading } = useClients();
  const { role } = useAuth();

  if (role !== "admin") return <Navigate to="/" replace />;

  const now = new Date();

  // Filter clients with contract data and sort by remaining days
  const contractClients = (clients ?? [])
    .filter((c) => c.contract_start)
    .map((c) => {
      const start = parseISO(c.contract_start!);
      // Use contract_end if available, otherwise calculate from duration
      let end: Date;
      if ((c as any).contract_end) {
        end = parseISO((c as any).contract_end);
      } else if (c.contract_duration) {
        const months = parseInt(c.contract_duration) || 0;
        end = new Date(start);
        end.setMonth(end.getMonth() + months);
      } else {
        end = new Date(start);
        end.setMonth(end.getMonth() + 12); // default 12 months
      }

      const totalDays = differenceInDays(end, start);
      const elapsedDays = differenceInDays(now, start);
      const remainingDays = differenceInDays(end, now);
      const progress = totalDays > 0 ? Math.min(Math.max(elapsedDays / totalDays, 0), 1) : 0;

      return { ...c, start, end, totalDays, elapsedDays, remainingDays, progress };
    })
    .sort((a, b) => a.remainingDays - b.remainingDays);

  const getBarColor = (remainingDays: number) => {
    if (remainingDays <= 0) return "bg-destructive";
    if (remainingDays <= 30) return "bg-orange-500";
    if (remainingDays <= 90) return "bg-yellow-500";
    return "bg-primary";
  };

  const getStatusBadge = (remainingDays: number) => {
    if (remainingDays <= 0) return <Badge variant="destructive" className="text-[10px]">Abgelaufen</Badge>;
    if (remainingDays <= 30) return <Badge className="bg-orange-500/15 text-orange-500 border-orange-500/30 text-[10px]">Endet bald</Badge>;
    if (remainingDays <= 90) return <Badge className="bg-yellow-500/15 text-yellow-600 border-yellow-500/30 text-[10px]">≤ 3 Monate</Badge>;
    return null;
  };

  return (
    <AppLayout>
      <ErrorBoundary level="section">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
        <div className="mb-6">
          <h1 className="text-xl font-display font-bold tracking-tight">Vertragslaufzeiten</h1>
          <p className="font-body text-xs text-muted-foreground mt-0.5">
            Übersicht aller Kundenverträge — sortiert nach verbleibender Laufzeit
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-card border border-border" />
            ))}
          </div>
        ) : contractClients.length === 0 ? (
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border bg-card">
            <p className="text-sm text-muted-foreground font-body">Keine Vertragsdaten vorhanden</p>
          </div>
        ) : (
          <div className="space-y-2">
            {contractClients.map((client, i) => (
              <motion.div
                key={client.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-center gap-3 mb-2">
                  {client.logo_url ? (
                    <img
                      src={client.logo_url}
                      alt={client.name}
                      className="h-7 w-7 rounded-md object-contain bg-white p-0.5 ring-1 ring-border"
                    />
                  ) : (
                    <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                      {client.name.charAt(0)}
                    </div>
                  )}
                  <span className="font-medium text-sm flex-1 truncate">{client.name}</span>
                  {getStatusBadge(client.remainingDays)}
                  <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                    {client.remainingDays > 0
                      ? `${client.remainingDays} Tage übrig`
                      : `${Math.abs(client.remainingDays)} Tage abgelaufen`}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="relative h-5 rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all ${getBarColor(client.remainingDays)}`}
                    style={{ width: `${Math.max(client.progress * 100, 2)}%`, opacity: 0.8 }}
                  />
                  <div className="absolute inset-0 flex items-center justify-between px-2.5 text-[10px] font-medium">
                    <span className="text-foreground/70">{format(client.start, "dd.MM.yy", { locale: de })}</span>
                    <span className="text-foreground/70">{format(client.end, "dd.MM.yy", { locale: de })}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </AppLayout>
  </ErrorBoundary>
    </AppLayout>
  );
};

export default ContractTimeline;
