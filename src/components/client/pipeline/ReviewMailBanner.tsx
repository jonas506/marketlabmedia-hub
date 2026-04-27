import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import type { ContentPiece } from "./types";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

interface ReviewMailBannerProps {
  clientId: string;
  phasePieces: ContentPiece[];
  canEdit: boolean;
}

interface ReviewNotificationState {
  content_piece_id: string;
  sent_at: string | null;
}

const ReviewMailBanner: React.FC<ReviewMailBannerProps> = React.memo(({
  clientId,
  phasePieces,
  canEdit,
}) => {
  const [notifications, setNotifications] = useState<ReviewNotificationState[]>([]);

  const loadNotifications = async () => {
    if (phasePieces.length === 0) {
      setNotifications([]);
      return;
    }

    const { data, error } = await supabase
      .from("review_notification_queue")
      .select("content_piece_id, sent_at")
      .eq("client_id", clientId)
      .in("content_piece_id", phasePieces.map((piece) => piece.id));

    if (error) {
      console.error("Failed to load review notification state", error);
      return;
    }

    setNotifications(data || []);
  };

  useEffect(() => {
    loadNotifications();
  }, [clientId, phasePieces.map((piece) => piece.id).join(",")]);

  const notificationByPieceId = useMemo(
    () => new Map(notifications.map((notification) => [notification.content_piece_id, notification])),
    [notifications]
  );

  const unsentPieces = phasePieces.filter((piece) => !notificationByPieceId.get(piece.id)?.sent_at);

  if (phasePieces.length === 0 || !canEdit) return null;

  return (
    <div className="flex items-center gap-2 mb-4 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
      <Mail className="h-4 w-4 text-amber-500 shrink-0" />
      <div className="min-w-0 flex-1 space-y-1">
        <span className="block text-xs text-amber-600 dark:text-amber-400 font-mono">{phasePieces.length} Piece{phasePieces.length > 1 ? "s" : ""} zur Freigabe</span>
        <div className="flex flex-wrap gap-1.5">
          {phasePieces.map((piece) => {
            const notification = notificationByPieceId.get(piece.id);
            const sentAt = notification?.sent_at;
            return (
              <span
                key={piece.id}
                className={`inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-mono ${sentAt ? "border-border bg-muted text-muted-foreground opacity-60" : "border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-300"}`}
                title={piece.title || "Ohne Titel"}
              >
                {sentAt && <CheckCircle2 className="h-3 w-3 shrink-0" />}
                <span className="truncate">{piece.title || "Ohne Titel"}</span>
                {sentAt && (
                  <span className="shrink-0">· geschickt vor {formatDistanceToNow(new Date(sentAt), { locale: de })}</span>
                )}
              </span>
            );
          })}
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 text-xs border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
        disabled={unsentPieces.length === 0}
        onClick={async () => {
          try {
            if (unsentPieces.length === 0) {
              toast.info("Alle Freigabe-Mails wurden bereits versendet.");
              return;
            }
            toast.info("📧 Mail wird gesendet...");
            const { data: existing } = await supabase
              .from("review_notification_queue")
              .select("content_piece_id, sent_at")
              .eq("client_id", clientId)
              .in("content_piece_id", unsentPieces.map((piece) => piece.id));
            const existingIds = new Set((existing || []).map(e => e.content_piece_id));
            const alreadySentIds = new Set((existing || []).filter(e => e.sent_at).map(e => e.content_piece_id));
            const newPieces = unsentPieces.filter(p => !existingIds.has(p.id) && !alreadySentIds.has(p.id));
            if (newPieces.length > 0) {
              await supabase.from("review_notification_queue").insert(
                newPieces.map((p) => ({
                  client_id: clientId,
                  content_piece_id: p.id,
                  piece_title: p.title,
                  piece_type: p.type,
                }))
              );
            }
            const { error } = await supabase.functions.invoke("send-review-digest", { body: {} });
            if (error) throw error;
            await loadNotifications();
            toast.success("✅ Freigabe-Mail wurde versendet!");
          } catch (e: any) {
            toast.error("Fehler beim Mail-Versand", { description: e?.message });
          }
        }}
      >
        <Mail className="h-3.5 w-3.5" />
        {unsentPieces.length === 0 ? "Bereits versendet" : "Freigabe-Mail senden"}
      </Button>
    </div>
  );
});

ReviewMailBanner.displayName = "ReviewMailBanner";

export default ReviewMailBanner;
