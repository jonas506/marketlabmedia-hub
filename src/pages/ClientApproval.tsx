import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Check, MessageSquare, X, Play, ExternalLink, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Toaster as Sonner } from "@/components/ui/sonner";
import confetti from "canvas-confetti";

interface Piece {
  id: string;
  title: string | null;
  type: string;
  phase: string;
  preview_link: string | null;
  client_comment: string | null;
}

interface ClientInfo {
  id: string;
  name: string;
  logo_url: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  reel: "Reel",
  story: "Story",
  carousel: "Karussell",
};

const TYPE_EMOJI: Record<string, string> = {
  reel: "🎬",
  story: "📱",
  carousel: "🖼️",
};

const getGoogleDriveEmbedUrl = (url: string): string | null => {
  if (!url) return null;
  const match1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match1) return `https://drive.google.com/file/d/${match1[1]}/preview`;
  const match2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match2) return `https://drive.google.com/file/d/${match2[1]}/preview`;
  return null;
};

const ClientApproval = () => {
  const { token } = useParams<{ token: string }>();
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentingId, setCommentingId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!token || token === ":token") {
      setError("Kein gültiger Token");
      setLoading(false);
      return;
    }
    try {
      const res = await supabase.functions.invoke("client-approval", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        body: null,
      });
      
      // Since functions.invoke doesn't support query params for GET well,
      // use direct fetch instead
      const projectUrl = import.meta.env.VITE_SUPABASE_URL;
      const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const response = await fetch(
        `${projectUrl}/functions/v1/client-approval?token=${encodeURIComponent(token)}`,
        { headers: { "apikey": apiKey } }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Fehler beim Laden");
      setClient(data.client);
      setPieces(data.pieces);
    } catch (err: any) {
      setError(err.message || "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAction = async (pieceId: string, action: "approve" | "reject", commentText?: string) => {
    setActionLoading(pieceId);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/client-approval`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ token, piece_id: pieceId, action, comment: commentText }),
        }
      );
      if (!res.ok) throw new Error("Aktion fehlgeschlagen");

      setPieces((prev) => prev.filter((p) => p.id !== pieceId));
      setCommentingId(null);
      setComment("");

      if (action === "approve") {
        confetti({ particleCount: 60, spread: 50, origin: { y: 0.7 } });
        toast.success("Freigegeben! ✅");
      } else {
        toast("Feedback gesendet", { description: "Wird überarbeitet" });
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-display font-bold mb-2">Link ungültig</h1>
          <p className="text-muted-foreground">Dieser Freigabe-Link ist nicht gültig oder abgelaufen.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sonner />
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-6 py-6 flex items-center gap-4">
          {client.logo_url ? (
            <img src={client.logo_url} alt={client.name} className="h-10 w-10 rounded-xl object-cover ring-1 ring-border" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 font-display text-lg font-bold text-primary">
              {client.name.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="font-display text-xl font-bold">{client.name}</h1>
            <p className="text-sm text-muted-foreground font-body">Content zur Freigabe</p>
          </div>
          <div className="flex-1" />
          <Badge variant="outline" className="font-mono text-xs">
            {pieces.length} offen
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {pieces.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <span className="text-5xl block mb-4">✅</span>
            <h2 className="text-xl font-display font-bold mb-2">Alles freigegeben!</h2>
            <p className="text-muted-foreground font-body">Es gibt aktuell keinen Content zur Freigabe.</p>
          </motion.div>
        ) : (
          <div className="space-y-6">
            <AnimatePresence mode="popLayout">
              {pieces.map((piece, i) => {
                const embedUrl = piece.preview_link ? getGoogleDriveEmbedUrl(piece.preview_link) : null;
                const isCommenting = commentingId === piece.id;
                const isLoading = actionLoading === piece.id;

                return (
                  <motion.div
                    key={piece.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: i * 0.1 } }}
                    exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                    className="rounded-xl border border-border bg-card overflow-hidden"
                  >
                    {/* Video preview */}
                    {embedUrl ? (
                      <div className="aspect-[9/16] max-h-[500px] bg-black relative">
                        <iframe
                          src={embedUrl}
                          className="w-full h-full"
                          allow="autoplay; encrypted-media"
                          allowFullScreen
                          title={piece.title || "Preview"}
                        />
                      </div>
                    ) : piece.preview_link ? (
                      <a
                        href={piece.preview_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-3 py-16 bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <Play className="h-8 w-8 text-primary" />
                        <span className="text-sm font-body text-muted-foreground">Preview öffnen</span>
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </a>
                    ) : (
                      <div className="flex items-center justify-center py-16 bg-muted/20">
                        <span className="text-sm text-muted-foreground font-body">Kein Preview verfügbar</span>
                      </div>
                    )}

                    {/* Info + actions */}
                    <div className="p-5">
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-lg">{TYPE_EMOJI[piece.type] || "📄"}</span>
                        <Badge variant="secondary" className="font-mono text-xs">
                          {TYPE_LABELS[piece.type] || piece.type}
                        </Badge>
                        <h3 className="font-display font-semibold text-lg flex-1">
                          {piece.title || "Ohne Titel"}
                        </h3>
                      </div>

                      <AnimatePresence mode="wait">
                        {isCommenting ? (
                          <motion.div
                            key="comment"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-3"
                          >
                            <Textarea
                              value={comment}
                              onChange={(e) => setComment(e.target.value)}
                              placeholder="Was soll geändert werden?"
                              className="min-h-[80px] text-sm"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <Button
                                variant="destructive"
                                className="gap-2 flex-1"
                                onClick={() => handleAction(piece.id, "reject", comment)}
                                disabled={isLoading || !comment.trim()}
                              >
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                                Änderung anfragen
                              </Button>
                              <Button
                                variant="outline"
                                className="gap-2"
                                onClick={() => { setCommentingId(null); setComment(""); }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </motion.div>
                        ) : (
                          <motion.div key="actions" className="flex gap-3">
                            <Button
                              className="gap-2 flex-1 bg-[hsl(var(--runway-green))] hover:bg-[hsl(var(--runway-green))]/90 text-white font-semibold shadow-lg"
                              onClick={() => handleAction(piece.id, "approve")}
                              disabled={isLoading}
                            >
                              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                              Freigeben
                            </Button>
                            <Button
                              variant="outline"
                              className="gap-2"
                              onClick={() => setCommentingId(piece.id)}
                            >
                              <MessageSquare className="h-4 w-4" />
                              Feedback
                            </Button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientApproval;
