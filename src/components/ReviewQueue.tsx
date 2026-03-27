import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ChevronRight, CheckCircle2, Mail, AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatDistanceToNow, differenceInDays } from "date-fns";
import { de } from "date-fns/locale";

const TYPE_EMOJI: Record<string, string> = { reel: "🎬", carousel: "🖼️", ad: "📢", youtube_longform: "🎥" };

const ReviewQueue = () => {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["review-queue-widget"],
    queryFn: async () => {
      const { data: pieces, error } = await supabase
        .from("content_pieces")
        .select("id, client_id, title, type, phase, updated_at, assigned_to")
        .eq("phase", "review");
      if (error) throw error;
      if (!pieces || pieces.length === 0) return { groups: [], total: 0, profiles: {} as Record<string, string> };

      const clientIds = [...new Set(pieces.map((p) => p.client_id))];
      const assignedIds = [...new Set(pieces.map((p) => p.assigned_to).filter(Boolean))];

      const [{ data: clients }, { data: profiles }] = await Promise.all([
        supabase.from("clients").select("id, name").in("id", clientIds),
        assignedIds.length > 0
          ? supabase.from("profiles").select("user_id, name").in("user_id", assignedIds)
          : { data: [] },
      ]);

      const clientMap = new Map((clients ?? []).map((c) => [c.id, c.name]));
      const profileMap: Record<string, string> = {};
      (profiles ?? []).forEach((p) => { profileMap[p.user_id] = p.name || "—"; });

      const grouped: Record<string, { clientName: string; clientId: string; pieces: typeof pieces }> = {};
      pieces.forEach((p) => {
        if (!grouped[p.client_id]) {
          grouped[p.client_id] = { clientName: clientMap.get(p.client_id) || "—", clientId: p.client_id, pieces: [] };
        }
        grouped[p.client_id].pieces.push(p);
      });

      return { groups: Object.values(grouped), total: pieces.length, profiles: profileMap };
    },
  });

  const sendReviewMail = async (clientId: string) => {
    try {
      const { error } = await supabase.functions.invoke("send-review-digest", {
        body: { clientId },
      });
      if (error) throw error;
      toast.success("Freigabe-Mail wurde gesendet");
      qc.invalidateQueries({ queryKey: ["review-queue-widget"] });
    } catch {
      toast.error("Fehler beim Senden der Mail");
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 mb-5">
        <div className="h-5 w-32 animate-pulse bg-muted/40 rounded mb-3" />
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-8 animate-pulse rounded bg-muted/30" />)}
        </div>
      </div>
    );
  }

  if (!data || data.total === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-border bg-card overflow-hidden mb-5">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-surface-elevated">
          <div className="w-2 h-2 rounded-full bg-status-done" />
          <h3 className="text-sm font-display font-semibold">Zur Freigabe</h3>
        </div>
        <div className="py-6 text-center text-xs text-muted-foreground/50 font-mono">✅ Keine offenen Freigaben</div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-border bg-card overflow-hidden mb-5">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-surface-elevated">
        <div className="w-2 h-2 rounded-full bg-status-review" />
        <h3 className="text-sm font-display font-semibold">Zur Freigabe</h3>
        <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">{data.total}</span>
      </div>

      <div className="divide-y divide-border">
        {data.groups.map((group) => (
          <div key={group.clientId}>
            <div className="monday-group-header border-b border-border/30">
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs font-display font-semibold">{group.clientName}</span>
              <span className="text-[10px] font-mono text-muted-foreground">{group.pieces.length}</span>
            </div>

            {group.pieces.map((piece) => (
              <Link
                key={piece.id}
                to={`/client/${piece.client_id}`}
                className="flex items-center gap-2 px-4 py-2 pl-8 hover:bg-surface-hover transition-colors"
              >
                <span className="text-sm">{TYPE_EMOJI[piece.type] || "📄"}</span>
                <span className="flex-1 text-sm font-body truncate">{piece.title || "Ohne Titel"}</span>
                {piece.assigned_to && data.profiles[piece.assigned_to] && (
                  <span className="text-[9px] font-mono text-muted-foreground hidden sm:inline">
                    {data.profiles[piece.assigned_to]}
                  </span>
                )}
                <span className="text-[10px] font-mono text-status-review">
                  seit {formatDistanceToNow(new Date(piece.updated_at!), { locale: de })}
                </span>
              </Link>
            ))}

            <div className="px-4 py-2 pl-8">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[10px] font-mono text-muted-foreground hover:text-primary"
                onClick={(e) => {
                  e.preventDefault();
                  sendReviewMail(group.clientId);
                }}
              >
                <Mail className="h-3 w-3 mr-1" />
                Freigabe-Mail senden
              </Button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default ReviewQueue;
