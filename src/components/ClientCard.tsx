import { Link } from "react-router-dom";
import { ClientDashboardData } from "@/hooks/useClients";
import RunwayBadge from "./RunwayBadge";
import { Calendar, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import DeleteClientDialog from "./DeleteClientDialog";

interface ClientCardProps {
  client: ClientDashboardData;
}

const KontingentBar: React.FC<{ label: string; posted: number; target: number; color: string }> = ({
  label, posted, target, color,
}) => {
  if (target === 0) return null;
  const pct = Math.min((posted / target) * 100, 100);
  const isComplete = posted >= target;
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 text-[11px] text-muted-foreground font-body">{label}</span>
      <div className="flex-1 h-[6px] rounded-full bg-muted/50 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${isComplete ? "bg-status-done" : color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }}
        />
      </div>
      <span className={`font-mono text-[11px] w-8 text-right ${isComplete ? "text-status-done font-semibold" : "text-muted-foreground"}`}>
        {posted}/{target}
      </span>
    </div>
  );
};

const ClientCard: React.FC<ClientCardProps> = ({ client }) => {
  const { role } = useAuth();
  const canDelete = role === "admin";
  return (
    <Link
      to={`/client/${client.id}`}
      className="group block rounded-lg border border-border bg-card hover:bg-surface-elevated transition-all duration-200 overflow-hidden"
    >
      {/* Colored top bar */}
      <div className="h-1 bg-gradient-to-r from-primary to-secondary" />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          {client.logo_url ? (
            <img src={client.logo_url} alt={client.name} className="h-9 w-9 rounded-lg object-cover ring-1 ring-border" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 font-display text-sm font-bold text-primary">
              {client.name.charAt(0)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-sm font-semibold truncate">{client.name}</h3>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/0 group-hover:text-primary transition-all shrink-0" />
            </div>
            <span className={`monday-status text-[9px] py-0.5 px-2 min-w-0 mt-1 ${
              client.status === "active" ? "monday-status-done" : "monday-status-default"
            }`}>
              {client.status === "active" ? "Aktiv" : "Pausiert"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <RunwayBadge days={client.runway} />
            {canDelete && <DeleteClientDialog clientId={client.id} clientName={client.name} />}
          </div>

        {/* Kontingent */}
        <div className="space-y-1.5 mb-4">
          <KontingentBar label="Reels" posted={client.handedOverThisMonth.reels} target={client.monthly_reels} color="bg-primary" />
          <KontingentBar label="Karussell" posted={client.handedOverThisMonth.carousels} target={client.monthly_carousels} color="bg-secondary" />
          <KontingentBar label="Stories" posted={client.handedOverThisMonth.stories} target={client.monthly_stories} color="bg-status-review" />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border/50">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-soft" />
            <span className="font-mono text-[10px] text-muted-foreground">{client.pipelineCounts.inPipeline} in Pipeline</span>
          </div>
          {client.nextShootDay && (
            <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {format(new Date(client.nextShootDay), "dd. MMM", { locale: de })}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
};

export default ClientCard;
