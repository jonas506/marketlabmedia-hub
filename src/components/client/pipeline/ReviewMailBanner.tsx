import React from "react";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import type { ContentPiece } from "./types";

interface ReviewMailBannerProps {
  clientId: string;
  phasePieces: ContentPiece[];
  canEdit: boolean;
}

const ReviewMailBanner: React.FC<ReviewMailBannerProps> = React.memo(({
  clientId,
  phasePieces,
  canEdit,
}) => {
  if (phasePieces.length === 0 || !canEdit) return null;

  return (
    <div className="flex items-center gap-2 mb-4 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
      <Mail className="h-4 w-4 text-amber-500 shrink-0" />
      <span className="text-xs text-amber-600 dark:text-amber-400 font-mono">{phasePieces.length} Piece{phasePieces.length > 1 ? "s" : ""} zur Freigabe</span>
      <div className="flex-1" />
      <Button
        variant="outline"
        size="sm"
        className="gap-2 text-xs border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
        onClick={async () => {
          try {
            toast.info("📧 Mail wird gesendet...");
            const { data: existing } = await supabase
              .from("review_notification_queue")
              .select("content_piece_id")
              .eq("client_id", clientId)
              .is("sent_at", null);
            const existingIds = new Set((existing || []).map(e => e.content_piece_id));
            const newPieces = phasePieces.filter(p => !existingIds.has(p.id));
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
            toast.success("✅ Freigabe-Mail wurde versendet!");
          } catch (e: any) {
            toast.error("Fehler beim Mail-Versand", { description: e?.message });
          }
        }}
      >
        <Mail className="h-3.5 w-3.5" />
        Freigabe-Mail senden
      </Button>
    </div>
  );
});

ReviewMailBanner.displayName = "ReviewMailBanner";

export default ReviewMailBanner;
