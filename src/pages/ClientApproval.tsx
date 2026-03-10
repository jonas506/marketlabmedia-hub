import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Check, MessageSquare, X, Play, ExternalLink, Loader2, Clock, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Toaster as Sonner } from "@/components/ui/sonner";
import confetti from "canvas-confetti";
import logoDark from "@/assets/logo-dark.png";

interface TimestampComment {
  id: string;
  content_piece_id: string;
  timestamp_seconds: number | null;
  comment_text: string;
  created_at: string;
}

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

const TYPE_COLORS: Record<string, string> = {
  reel: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  story: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  carousel: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

const formatTimestamp = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
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
  const [comments, setComments] = useState<TimestampComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentTimestamp, setCommentTimestamp] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [addingComment, setAddingComment] = useState(false);
  const [approvedCount, setApprovedCount] = useState(0);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  const projectUrl = import.meta.env.VITE_SUPABASE_URL;
  const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const fetchData = useCallback(async () => {
    if (!token || token === ":token") {
      setError("Kein gültiger Token");
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(
        `${projectUrl}/functions/v1/client-approval?token=${encodeURIComponent(token)}`,
        { headers: { apikey: apiKey } }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Fehler beim Laden");
      setClient(data.client);
      setPieces(data.pieces);
      setComments(data.comments || []);
    } catch (err: any) {
      setError(err.message || "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, [token, projectUrl, apiKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const pieceComments = (pieceId: string) =>
    comments.filter((c) => c.content_piece_id === pieceId).sort((a, b) => {
      if (a.timestamp_seconds == null && b.timestamp_seconds == null) return 0;
      if (a.timestamp_seconds == null) return 1;
      if (b.timestamp_seconds == null) return -1;
      return a.timestamp_seconds - b.timestamp_seconds;
    });

  const handleAddComment = async (pieceId: string) => {
    if (!commentText.trim()) return;
    setAddingComment(true);
    try {
      const res = await fetch(`${projectUrl}/functions/v1/client-approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify({
          token,
          piece_id: pieceId,
          action: "add_comment",
          comment: commentText.trim(),
          timestamp_seconds: commentTimestamp,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setComments((prev) => [...prev, data.comment]);
      setCommentText("");
      setCommentTimestamp(null);
      toast.success(
        commentTimestamp != null
          ? `Kommentar bei ${formatTimestamp(commentTimestamp)} hinzugefügt`
          : "Kommentar hinzugefügt"
      );
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAddingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await fetch(`${projectUrl}/functions/v1/client-approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify({ token, action: "delete_comment", comment_id: commentId }),
      });
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch {
      toast.error("Fehler beim Löschen");
    }
  };

  const handleCaptureTimestamp = (pieceId: string) => {
    // Try to get timestamp from the video element if using HTML5 video
    const video = videoRefs.current[pieceId];
    if (video) {
      setCommentTimestamp(Math.floor(video.currentTime));
    } else {
      // For iframe embeds, prompt manual entry
      const input = prompt("Bei welcher Sekunde? (z.B. 20)");
      if (input !== null) {
        const secs = parseInt(input, 10);
        if (!isNaN(secs) && secs >= 0) setCommentTimestamp(secs);
      }
    }
  };

  const handleAction = async (pieceId: string, action: "approve" | "reject") => {
    setActionLoading(pieceId);
    try {
      const pc = pieceComments(pieceId);
      const res = await fetch(`${projectUrl}/functions/v1/client-approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify({
          token,
          piece_id: pieceId,
          action,
          comments: action === "reject" ? pc : undefined,
        }),
      });
      if (!res.ok) throw new Error("Aktion fehlgeschlagen");

      setPieces((prev) => prev.filter((p) => p.id !== pieceId));
      setComments((prev) => prev.filter((c) => c.content_piece_id !== pieceId));
      if (expandedId === pieceId) setExpandedId(null);

      if (action === "approve") {
        setApprovedCount((c) => c + 1);
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 }, colors: ["#0083F7", "#21089B", "#FAFBFF"] });
        toast.success("Freigegeben! ✅");
      } else {
        toast("Feedback gesendet 📝", { description: `${pc.length} Kommentar(e) übermittelt` });
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#1E1E24] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <img src={logoDark} alt="Marketlab Media" className="h-8 opacity-80" />
          <Loader2 className="h-6 w-6 animate-spin text-[#0083F7]" />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !client) {
    return (
      <div className="min-h-screen bg-[#1E1E24] flex items-center justify-center px-6">
        <div className="text-center">
          <img src={logoDark} alt="Marketlab Media" className="h-8 mx-auto mb-8 opacity-80" />
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <X className="h-8 w-8 text-red-400" />
          </div>
          <h1 className="text-xl font-semibold text-[#FAFBFF] mb-2" style={{ fontFamily: "Poppins, sans-serif" }}>
            Link ungültig
          </h1>
          <p className="text-[#FAFBFF]/50 text-sm">
            Dieser Freigabe-Link ist nicht gültig oder abgelaufen.
          </p>
        </div>
      </div>
    );
  }

  const totalPieces = pieces.length + approvedCount;

  return (
    <div className="min-h-screen bg-[#1E1E24] text-[#FAFBFF]" style={{ fontFamily: "Poppins, sans-serif" }}>
      <Sonner />

      {/* Sticky Header */}
      <div className="sticky top-0 z-50 border-b border-white/5 bg-[#1E1E24]/95 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center gap-4">
          <img src={logoDark} alt="Marketlab Media" className="h-6 opacity-70" />
          <div className="w-px h-6 bg-white/10" />
          {client.logo_url ? (
            <img src={client.logo_url} alt={client.name} className="h-8 w-8 rounded-lg object-cover" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0083F7]/20 text-sm font-bold text-[#0083F7]">
              {client.name.charAt(0)}
            </div>
          )}
          <span className="font-semibold text-sm truncate flex-1">{client.name}</span>

          {/* Progress indicator */}
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-20 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-[#0083F7] to-[#21089B] rounded-full"
                initial={{ width: 0 }}
                animate={{ width: totalPieces > 0 ? `${(approvedCount / totalPieces) * 100}%` : "0%" }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <span className="text-xs text-white/40 font-mono whitespace-nowrap">
              {approvedCount}/{totalPieces}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-5 py-6">
        {/* Title section */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1">Content-Freigabe</h1>
          <p className="text-white/40 text-sm">
            {pieces.length > 0
              ? `${pieces.length} ${pieces.length === 1 ? "Piece" : "Pieces"} warten auf deine Freigabe`
              : ""}
          </p>
        </div>

        {pieces.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-24"
          >
            <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-5">
              <Check className="h-10 w-10 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold mb-2">Alles freigegeben! 🎉</h2>
            <p className="text-white/40 text-sm">Es gibt aktuell keinen Content zur Freigabe.</p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {pieces.map((piece, i) => {
                const embedUrl = piece.preview_link ? getGoogleDriveEmbedUrl(piece.preview_link) : null;
                const isExpanded = expandedId === piece.id;
                const isLoading = actionLoading === piece.id;
                const pc = pieceComments(piece.id);

                return (
                  <motion.div
                    key={piece.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: i * 0.06 } }}
                    exit={{ opacity: 0, x: -100, transition: { duration: 0.3 } }}
                    className="rounded-2xl border border-white/5 bg-[#26262E] overflow-hidden group"
                  >
                    {/* Compact header - always visible */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : piece.id)}
                      className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/[0.02] transition-colors"
                    >
                      <div className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${TYPE_COLORS[piece.type] || "bg-white/10 text-white/60 border-white/10"}`}>
                        {TYPE_LABELS[piece.type] || piece.type}
                      </div>
                      <span className="font-medium text-sm flex-1 truncate">
                        {piece.title || "Ohne Titel"}
                      </span>
                      {pc.length > 0 && (
                        <span className="flex items-center gap-1 text-xs text-amber-400/80">
                          <MessageSquare className="h-3 w-3" />
                          {pc.length}
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-white/30" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-white/30" />
                      )}
                    </button>

                    {/* Expanded content */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="overflow-hidden"
                        >
                          {/* Video preview */}
                          {embedUrl ? (
                            <div className="aspect-[9/16] max-h-[70vh] bg-black relative mx-4 rounded-xl overflow-hidden">
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
                              className="flex items-center justify-center gap-3 py-12 mx-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-[#0083F7]/30 transition-all"
                            >
                              <Play className="h-6 w-6 text-[#0083F7]" />
                              <span className="text-sm text-white/50">Preview öffnen</span>
                              <ExternalLink className="h-3.5 w-3.5 text-white/30" />
                            </a>
                          ) : (
                            <div className="flex items-center justify-center py-12 mx-4 rounded-xl bg-white/[0.02]">
                              <span className="text-sm text-white/30">Kein Preview verfügbar</span>
                            </div>
                          )}

                          {/* Timestamp comments section */}
                          <div className="px-4 pt-4 pb-2">
                            {/* Existing comments */}
                            {pc.length > 0 && (
                              <div className="mb-3 space-y-2">
                                <span className="text-xs font-semibold text-white/30 uppercase tracking-wider">
                                  Feedback ({pc.length})
                                </span>
                                {pc.map((c) => (
                                  <div
                                    key={c.id}
                                    className="flex items-start gap-2 p-2.5 rounded-lg bg-white/[0.03] border border-white/5 group/comment"
                                  >
                                    {c.timestamp_seconds != null && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#0083F7]/15 text-[#0083F7] text-xs font-mono font-semibold shrink-0 mt-0.5">
                                        <Clock className="h-3 w-3" />
                                        {formatTimestamp(c.timestamp_seconds)}
                                      </span>
                                    )}
                                    <span className="text-sm text-white/70 flex-1">{c.comment_text}</span>
                                    <button
                                      onClick={() => handleDeleteComment(c.id)}
                                      className="opacity-0 group-hover/comment:opacity-100 p-1 rounded hover:bg-red-500/10 text-red-400/60 hover:text-red-400 transition-all shrink-0"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Add comment */}
                            <div className="flex items-start gap-2">
                              {commentTimestamp != null && expandedId === piece.id ? (
                                <button
                                  onClick={() => setCommentTimestamp(null)}
                                  className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md bg-[#0083F7]/15 text-[#0083F7] text-xs font-mono font-semibold shrink-0 hover:bg-[#0083F7]/25 transition-colors mt-1"
                                >
                                  <Clock className="h-3 w-3" />
                                  {formatTimestamp(commentTimestamp)}
                                  <X className="h-3 w-3 ml-0.5" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleCaptureTimestamp(piece.id)}
                                  className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md bg-white/5 text-white/30 text-xs font-mono shrink-0 hover:bg-white/10 hover:text-white/50 transition-colors mt-1"
                                  title="Zeitstempel hinzufügen"
                                >
                                  <Clock className="h-3 w-3" />
                                  0:00
                                </button>
                              )}
                              <Textarea
                                value={expandedId === piece.id ? commentText : ""}
                                onChange={(e) => setCommentText(e.target.value)}
                                placeholder="Feedback eingeben..."
                                className="min-h-[40px] max-h-[100px] text-sm bg-white/[0.03] border-white/5 text-white/80 placeholder:text-white/20 resize-none rounded-lg focus:border-[#0083F7]/30"
                                rows={1}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleAddComment(piece.id);
                                  }
                                }}
                              />
                              <Button
                                size="sm"
                                onClick={() => handleAddComment(piece.id)}
                                disabled={addingComment || !commentText.trim()}
                                className="shrink-0 mt-1 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 border-0 h-8 px-3"
                              >
                                {addingComment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
                              </Button>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="p-4 flex gap-2">
                            <Button
                              className="flex-1 gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold h-11 rounded-xl shadow-lg shadow-emerald-500/20"
                              onClick={() => handleAction(piece.id, "approve")}
                              disabled={isLoading}
                            >
                              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                              Freigeben
                            </Button>
                            {pc.length > 0 && (
                              <Button
                                variant="outline"
                                className="gap-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 h-11 rounded-xl"
                                onClick={() => handleAction(piece.id, "reject")}
                                disabled={isLoading}
                              >
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                                Überarbeiten ({pc.length})
                              </Button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="py-8 text-center">
        <span className="text-xs text-white/15">Powered by Marketlab Media</span>
      </div>
    </div>
  );
};

export default ClientApproval;
