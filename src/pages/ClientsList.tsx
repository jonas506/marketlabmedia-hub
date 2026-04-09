import { useClients } from "@/hooks/useClients";
import AppLayout from "@/components/AppLayout";
import CreateClientDialog from "@/components/CreateClientDialog";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Calendar, ChevronRight, Rocket, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import RunwayBadge from "@/components/RunwayBadge";
import DeleteClientDialog from "@/components/DeleteClientDialog";
import type { ClientDashboardData, LifecyclePhase } from "@/hooks/useClients";

const lifecycleConfig: Record<LifecyclePhase, { label: string; className: string; icon?: React.ReactNode }> = {
  onboarding: { label: "Onboarding", className: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: <Rocket className="h-3 w-3" /> },
  active: { label: "Aktiv", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  contract_ending: { label: "Vertrag endet", className: "bg-red-500/10 text-red-400 border-red-500/20", icon: <AlertTriangle className="h-3 w-3" /> },
};

const KontingentBar: React.FC<{ label: string; posted: number; target: number; color: string }> = ({
  label, posted, target, color,
}) => {
  if (target === 0) return null;
  const pct = Math.min((posted / target) * 100, 100);
  const isComplete = posted >= target;
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 text-xs text-muted-foreground">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-muted/50 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${isComplete ? "bg-status-done" : color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }}
        />
      </div>
      <span className={`text-xs w-10 text-right tabular-nums ${isComplete ? "text-status-done font-semibold" : "text-muted-foreground"}`}>
        {posted}/{target}
      </span>
    </div>
  );
};

const ClientListRow: React.FC<{ client: ClientDashboardData; index: number }> = ({ client, index }) => {
  const { role } = useAuth();
  const canDelete = role === "admin";
  const lc = lifecycleConfig[client.lifecyclePhase];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
      className="group relative rounded-lg border border-border bg-card hover:bg-surface-elevated transition-all duration-200"
    >
      {canDelete && (
        <div className="absolute top-3 right-3 z-10">
          <DeleteClientDialog clientId={client.id} clientName={client.name} />
        </div>
      )}

      <Link to={`/client/${client.id}`} className="block p-3 sm:p-4">
        {/* Mobile layout */}
        <div className="sm:hidden">
          <div className="flex items-start gap-3">
            {client.logo_url ? (
              <img src={client.logo_url} alt={client.name} className="h-10 w-10 rounded-lg object-contain bg-white p-1 ring-1 ring-border shrink-0" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-sm font-bold text-primary shrink-0">
                {client.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold truncate pr-8">{client.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center gap-1 text-[10px] py-0.5 px-2 rounded-full border font-semibold ${lc.className}`}>
                  {lc.icon}
                  {lc.label}
                </span>
                <RunwayBadge days={client.runway} />
              </div>
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <KontingentBar label="Reels" posted={client.handedOverThisMonth.reels} target={client.monthly_reels} color="bg-primary" />
            <KontingentBar label="Karussell" posted={client.handedOverThisMonth.carousels} target={client.monthly_carousels} color="bg-secondary" />
            {client.monthly_stories > 0 && (
              <KontingentBar label="Stories" posted={client.handedOverThisMonth.stories} target={client.monthly_stories} color="bg-accent" />
            )}
          </div>
        </div>

        {/* Desktop layout */}
        <div className="hidden sm:flex items-center gap-4">
          {client.logo_url ? (
            <img src={client.logo_url} alt={client.name} className="h-10 w-10 rounded-lg object-contain bg-white p-1 ring-1 ring-border shrink-0" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-sm font-bold text-primary shrink-0">
              {client.name.charAt(0)}
            </div>
          )}
          <div className="min-w-0 w-40 shrink-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold truncate">{client.name}</h3>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/0 group-hover:text-primary transition-all shrink-0" />
            </div>
            <span className={`inline-flex items-center gap-1 text-[10px] py-0.5 px-2 rounded-full border font-semibold mt-1 ${lc.className}`}>
              {lc.icon}
              {lc.label}
            </span>
          </div>
          <div className="flex-1 space-y-1 min-w-0 hidden md:block">
            <KontingentBar label="Reels" posted={client.handedOverThisMonth.reels} target={client.monthly_reels} color="bg-primary" />
            <KontingentBar label="Karussell" posted={client.handedOverThisMonth.carousels} target={client.monthly_carousels} color="bg-secondary" />
            {client.monthly_stories > 0 && (
              <KontingentBar label="Stories" posted={client.handedOverThisMonth.stories} target={client.monthly_stories} color="bg-accent" />
            )}
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <div className="text-right hidden sm:block">
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span className="text-xs text-muted-foreground">{client.pipelineCounts.inPipeline} Pipeline</span>
              </div>
              {client.nextShootDay && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(client.nextShootDay), "dd. MMM", { locale: de })}
                </span>
              )}
            </div>
            <RunwayBadge days={client.runway} />
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

const ClientsList = () => {
  const { data: clients, isLoading } = useClients();
  const { role } = useAuth();
  const canCreate = role === "admin" || role === "head_of_content";

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }} className="space-y-4">
        <div className="flex items-start sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold">Kunden</h1>
            <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Sortiert nach Content-Runway — dringendste zuerst</p>
          </div>
          {canCreate && <CreateClientDialog />}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-card border border-border" />
            ))}
          </div>
        ) : clients?.length === 0 ? (
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border bg-card">
            <p className="text-sm text-muted-foreground">Noch keine Kunden angelegt</p>
          </div>
        ) : (
          <div className="space-y-2">
            {clients?.map((client, i) => (
              <ClientListRow key={client.id} client={client} index={i} />
            ))}
          </div>
        )}
      </motion.div>
    </AppLayout>
  );
};

export default ClientsList;
