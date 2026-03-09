import { Link } from "react-router-dom";
import { ClientDashboardData } from "@/hooks/useClients";
import RunwayBadge from "./RunwayBadge";
import { Badge } from "@/components/ui/badge";
import { Calendar, ArrowUpRight } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { motion } from "framer-motion";

interface ClientCardProps {
  client: ClientDashboardData;
}

const KontingentBar: React.FC<{ label: string; emoji: string; posted: number; target: number }> = ({
  label, emoji, posted, target,
}) => {
  if (target === 0) return null;
  const pct = Math.min((posted / target) * 100, 100);
  const isComplete = posted >= target;
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-sm w-5">{emoji}</span>
      <span className="w-16 text-xs text-muted-foreground font-body">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <motion.div
          className={`h-full rounded-full transition-all ${
            isComplete
              ? "bg-gradient-to-r from-runway-green to-runway-green/70"
              : "bg-gradient-to-r from-primary to-primary/60"
          }`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
        />
      </div>
      <span className={`font-mono text-xs w-10 text-right ${isComplete ? "text-runway-green font-semibold" : "text-muted-foreground"}`}>
        {posted}/{target}
      </span>
    </div>
  );
};

const ClientCard: React.FC<ClientCardProps> = ({ client }) => {
  return (
    <Link
      to={`/client/${client.id}`}
      className="group block rounded-xl border border-border bg-card p-5 transition-all duration-300 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/5 relative overflow-hidden"
    >
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            {client.logo_url ? (
              <img src={client.logo_url} alt={client.name} className="h-10 w-10 rounded-xl object-cover ring-1 ring-border" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 font-display text-sm font-bold text-primary">
                {client.name.charAt(0)}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-sm font-semibold tracking-tight">{client.name}</h3>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/0 group-hover:text-primary transition-all duration-300" />
              </div>
              {client.status === "paused" ? (
                <Badge variant="secondary" className="text-[9px] font-mono tracking-wider px-1.5 py-0 h-4 mt-0.5">
                  PAUSIERT
                </Badge>
              ) : (
                <Badge className="text-[9px] font-mono tracking-wider px-1.5 py-0 h-4 mt-0.5 bg-runway-green/10 text-runway-green border-runway-green/20 hover:bg-runway-green/20">
                  AKTIV
                </Badge>
              )}
            </div>
          </div>
          <RunwayBadge days={client.runway} />
        </div>

        {/* Kontingent bars */}
        <div className="space-y-2 mb-5">
          <KontingentBar emoji="🎬" label="Reels" posted={client.handedOverThisMonth.reels} target={client.monthly_reels} />
          <KontingentBar emoji="🖼️" label="Karussell" posted={client.handedOverThisMonth.carousels} target={client.monthly_carousels} />
          <KontingentBar emoji="📱" label="Stories" posted={client.handedOverThisMonth.stories} target={client.monthly_stories} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-soft" />
            <span className="font-mono text-[11px] text-muted-foreground tracking-wider">
              {client.pipelineCounts.inPipeline} IN PIPELINE
            </span>
          </div>
          {client.nextShootDay && (
            <span className="flex items-center gap-1.5 font-body text-xs text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-md">
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
