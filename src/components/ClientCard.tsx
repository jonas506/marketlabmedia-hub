import { Link } from "react-router-dom";
import { ClientDashboardData } from "@/hooks/useClients";
import RunwayBadge from "./RunwayBadge";
import { Calendar } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface ClientCardProps {
  client: ClientDashboardData;
}

const KontingentBar: React.FC<{ label: string; posted: number; target: number }> = ({
  label,
  posted,
  target,
}) => {
  if (target === 0) return null;
  const pct = Math.min((posted / target) * 100, 100);
  return (
    <div className="flex items-center gap-2">
      <span className="w-6 font-mono text-xs text-muted-foreground">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-xs text-muted-foreground">
        {posted}/{target}
      </span>
    </div>
  );
};

const ClientCard: React.FC<ClientCardProps> = ({ client }) => {
  const totalPipeline =
    client.clipCounts.raw +
    client.clipCounts.editing +
    client.clipCounts.done +
    client.clipCounts.scheduled;

  return (
    <Link
      to={`/client/${client.id}`}
      className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {client.logo_url ? (
            <img
              src={client.logo_url}
              alt={client.name}
              className="h-8 w-8 rounded object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded bg-muted font-mono text-xs text-muted-foreground">
              {client.name.charAt(0)}
            </div>
          )}
          <div>
            <h3 className="font-mono text-sm font-semibold">{client.name}</h3>
            {client.status === "paused" && (
              <span className="font-mono text-xs text-muted-foreground">PAUSIERT</span>
            )}
          </div>
        </div>
        <RunwayBadge days={client.runway} />
      </div>

      {/* Kontingent */}
      <div className="space-y-1.5 mb-4">
        <KontingentBar label="R" posted={client.postedThisMonth.reels} target={client.monthly_reels} />
        <KontingentBar label="K" posted={client.postedThisMonth.carousels} target={client.monthly_carousels} />
        <KontingentBar label="S" posted={client.postedThisMonth.stories} target={client.monthly_stories} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border pt-3">
        <span className="font-mono text-xs text-muted-foreground">
          {totalPipeline} CLIPS IN PIPELINE
        </span>
        {client.nextShootDay && (
          <span className="flex items-center gap-1 font-body text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {format(new Date(client.nextShootDay), "dd.MM.", { locale: de })}
          </span>
        )}
      </div>
    </Link>
  );
};

export default ClientCard;
