import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, CheckCheck, MessageSquare, X, Play, ExternalLink, Loader2, Clock, Trash2, ChevronLeft, ChevronRight, Send } from "lucide-react";
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
  story: "Story Ad",
  carousel: "Karussell",
  ad: "Ad",
};

const TYPE_COLORS: Record<string, string> = {
  reel: "from-blue-500/20 to-blue-600/10 text-blue-400 border-blue-500/20",
  story: "from-purple-500/20 to-purple-600/10 text-purple-400 border-purple-500/20",
  carousel: "from-amber-500/20 to-amber-600/10 text-amber-400 border-amber-500/20",
  ad: "from-violet-500/20 to-violet-600/10 text-violet-400 border-violet-500/20",
};

const TYPE_DOT: Record<string, string> = {
  reel: "bg-blue-400",
  story: "bg-purple-400",
  carousel: "bg-amber-400",
  ad: "bg-violet-400",
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [commentTimestamp, setCommentTimestamp] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [addingComment, setAddingComment] = useState(false);
  const [approvedCount, setApprovedCount] = useState(0);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  const projectUrl = import.meta.env.VITE_SUPABASE_URL;
  const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const fetchData = useCallback(async () => {
    if (!token || token === ":token") {
      setError("Kein gültiger Token");
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase.rpc("get_client_approval_data", {
        _token: token,
      });
      if (error) throw error;
      setClient(data.client);
      setPieces(data.pieces || []);
      setComments(data.comments || []);
    } catch (err: any) {
      setError(err.message || "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, [token]);

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
      const { data, error } = await supabase.rpc("add_client_piece_comment", {
        _token: token,
        _piece_id: pieceId,
        _comment: commentText.trim(),
        _timestamp_seconds: commentTimestamp,
      });
      if (error) throw error;
      setComments((prev) => [...prev, data]);
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
      const { error } = await supabase.rpc("delete_client_piece_comment", {
        _token: token,
        _comment_id: commentId,
      });
      if (error) throw error;
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch {
      toast.error("Fehler beim Löschen");
    }
  };

  const handleCaptureTimestamp = (pieceId: string) => {
    const video = videoRefs.current[pieceId];
    if (video) {
      setCommentTimestamp(Math.floor(video.currentTime));
    } else {
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
      const { error } = await supabase.rpc("submit_client_piece_review", {
        _token: token,
        _piece_id: pieceId,
        _action: action,
        _comments: action === "reject" ? pc : [],
      });
      if (error) throw error;

      const newPieces = pieces.filter((p) => p.id !== pieceId);
      setPieces(newPieces);
      setComments((prev) => prev.filter((c) => c.content_piece_id !== pieceId));
      setShowFeedback(false);
      setCommentText("");
      setCommentTimestamp(null);

      if (action === "approve") {
        setApprovedCount((c) => c + 1);
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ["#0083F7", "#21089B", "#10B981", "#FAFBFF"] });
        toast.success("Freigegeben! ✅");
      } else {
        toast("Feedback gesendet 📝", { description: `${pc.length} Kommentar(e) übermittelt` });
      }

      if (currentIndex >= newPieces.length && newPieces.length > 0) {
        setCurrentIndex(newPieces.length - 1);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkApprove = async () => {
    setBulkApproving(true);
    try {
      for (const piece of [...pieces]) {
        const { error } = await supabase.rpc("submit_client_piece_review", {
          _token: token,
          _piece_id: piece.id,
          _action: "approve",
          _comments: [],
        });
        if (error) throw error;
      }
      setApprovedCount((c) => c + pieces.length);
      setPieces([]);
      setComments([]);
      confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 }, colors: ["#0083F7", "#21089B", "#10B981", "#FAFBFF"] });
      toast.success(`Alle ${pieces.length} Pieces freigegeben! 🎉`);
    } catch {
      toast.error("Fehler bei der Freigabe");
    } finally {
      setBulkApproving(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#111115] flex items-center justify-center">
        <Sonner />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-6"
        >
          <img src={logoDark} alt="Marketlab Media" className="h-10 opacity-90" />
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-[#0083F7]"
                animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  // Error state
  if (error || !client) {
    return (
      <div className="min-h-screen bg-[#111115] flex items-center justify-center px-6">
        <Sonner />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-sm">
          <img src={logoDark} alt="Marketlab Media" className="h-8 mx-auto mb-10 opacity-70" />
          <div className="w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/10 flex items-center justify-center mx-auto mb-6">
            <X className="h-9 w-9 text-red-400" />
          </div>
          <h1 className="text-xl font-semibold text-white mb-2" style={{ fontFamily: "Poppins, sans-serif" }}>
            Link ungültig
          </h1>
          <p className="text-white/40 text-sm leading-relaxed">
            Dieser Freigabe-Link ist nicht gültig oder abgelaufen. Bitte kontaktiere dein Marketlab-Team.
          </p>
        </motion.div>
      </div>
    );
  }

  const totalPieces = pieces.length + approvedCount;
  const currentPiece = pieces[currentIndex];
  const currentComments = currentPiece ? pieceComments(currentPiece.id) : [];
  const currentEmbed = currentPiece?.preview_link ? getGoogleDriveEmbedUrl(currentPiece.preview_link) : null;
  const isCurrentLoading = currentPiece ? actionLoading === currentPiece.id : false;

  return (
    <div className="min-h-screen bg-[#111115] text-white flex flex-col" style={{ fontFamily: "Poppins, sans-serif" }}>
      <Sonner />

      {/* Header - slim & clean */}
      <div className="sticky top-0 z-50 bg-[#111115]/90 backdrop-blur-2xl border-b border-white/[0.04]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <img src={logoDark} alt="Marketlab Media" className="h-5 opacity-60 hidden sm:block" />
          <div className="w-px h-5 bg-white/10 hidden sm:block" />
          {client.logo_url ? (
            <img src={client.logo_url} alt={client.name} className="h-7 w-7 rounded-lg object-cover ring-1 ring-white/10" />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#0083F7] to-[#21089B] text-[11px] font-bold">
              {client.name.charAt(0)}
            </div>
          )}
          <span className="font-medium text-sm truncate">{client.name}</span>
          <div className="flex-1" />

          {/* Progress pill */}
          <div className="flex items-center gap-2.5 bg-white/[0.04] rounded-full px-3 py-1.5">
            <div className="h-1.5 w-16 sm:w-24 bg-white/[0.06] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-[#0083F7] to-emerald-400 rounded-full"
                animate={{ width: totalPieces > 0 ? `${(approvedCount / totalPieces) * 100}%` : "0%" }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
            <span className="text-[11px] text-white/40 font-mono tabular-nums">
              {approvedCount}/{totalPieces}
            </span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col" ref={scrollRef}>
        {pieces.length === 0 ? (
          /* All done state */
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex items-center justify-center px-6"
          >
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="w-24 h-24 rounded-[28px] bg-gradient-to-br from-emerald-500/20 to-emerald-600/5 border border-emerald-500/10 flex items-center justify-center mx-auto mb-6"
              >
                <Check className="h-12 w-12 text-emerald-400" />
              </motion.div>
              <h2 className="text-2xl font-bold mb-2">Alles erledigt! 🎉</h2>
              <p className="text-white/35 text-sm max-w-xs mx-auto">
                Du hast allen Content freigegeben. Dein Team wird benachrichtigt.
              </p>
            </div>
          </motion.div>
        ) : (
          <>
            {/* Card-based swipe view */}
            <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 pt-5 pb-3 flex-1 flex flex-col">
              {/* Title bar with navigation */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className={`w-2 h-2 rounded-full ${TYPE_DOT[currentPiece.type] || "bg-white/30"}`} />
                  <span className={`text-xs font-semibold uppercase tracking-wider ${
                    currentPiece.type === "reel" ? "text-blue-400" : currentPiece.type === "story" ? "text-purple-400" : currentPiece.type === "ad" ? "text-violet-400" : "text-amber-400"
                  }`}>
                    {TYPE_LABELS[currentPiece.type] || currentPiece.type}
                  </span>
                  <span className="text-white/15 text-xs">•</span>
                  <span className="text-white/40 text-xs font-mono">
                    {currentIndex + 1} von {pieces.length}
                  </span>
                </div>

                {/* Nav arrows */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setCurrentIndex(Math.max(0, currentIndex - 1)); setShowFeedback(false); setCommentText(""); setCommentTimestamp(null); }}
                    disabled={currentIndex === 0}
                    className="p-2 rounded-xl hover:bg-white/5 disabled:opacity-20 transition-all active:scale-90"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => { setCurrentIndex(Math.min(pieces.length - 1, currentIndex + 1)); setShowFeedback(false); setCommentText(""); setCommentTimestamp(null); }}
                    disabled={currentIndex === pieces.length - 1}
                    className="p-2 rounded-xl hover:bg-white/5 disabled:opacity-20 transition-all active:scale-90"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Piece title */}
              <AnimatePresence mode="wait">
                <motion.h2
                  key={currentPiece.id + "-title"}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="text-lg sm:text-xl font-bold mb-4 truncate"
                >
                  {currentPiece.title || "Ohne Titel"}
                </motion.h2>
              </AnimatePresence>

              {/* Video / Preview card */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentPiece.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25 }}
                  className="rounded-2xl sm:rounded-3xl overflow-hidden bg-[#1A1A20] border border-white/[0.04] shadow-2xl shadow-black/40"
                >
                  {currentEmbed ? (
                    <div className="aspect-[9/16] max-h-[55vh] sm:max-h-[60vh] bg-black">
                      <iframe
                        src={currentEmbed}
                        className="w-full h-full"
                        allow="autoplay; encrypted-media"
                        allowFullScreen
                        title={currentPiece.title || "Preview"}
                      />
                    </div>
                  ) : currentPiece.preview_link ? (
                    <a
                      href={currentPiece.preview_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center justify-center gap-4 py-20 sm:py-24 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-[#0083F7]/10 border border-[#0083F7]/20 flex items-center justify-center">
                        <Play className="h-6 w-6 text-[#0083F7] ml-0.5" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white/40">Preview öffnen</span>
                        <ExternalLink className="h-3.5 w-3.5 text-white/20" />
                      </div>
                    </a>
                  ) : (
                    <div className="flex items-center justify-center py-20 sm:py-24">
                      <span className="text-sm text-white/20">Kein Preview verfügbar</span>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Dot navigation for pieces */}
              {pieces.length > 1 && (
                <div className="flex justify-center gap-1.5 mt-4">
                  {pieces.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => { setCurrentIndex(i); setShowFeedback(false); setCommentText(""); setCommentTimestamp(null); }}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === currentIndex ? "w-6 bg-[#0083F7]" : "w-1.5 bg-white/10 hover:bg-white/20"
                      }`}
                    />
                  ))}
                </div>
              )}

              {/* Comments section - expandable */}
              {currentPiece && (
                <div className="mt-4">
                  {/* Existing comments */}
                  {currentComments.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mb-3 space-y-1.5"
                    >
                      <span className="text-[11px] font-semibold text-white/25 uppercase tracking-widest px-1">
                        Dein Feedback
                      </span>
                      {currentComments.map((c) => (
                        <motion.div
                          key={c.id}
                          layout
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-start gap-2 py-2 px-3 rounded-xl bg-white/[0.03] border border-white/[0.04] group/c"
                        >
                          {c.timestamp_seconds != null && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#0083F7]/10 text-[#0083F7] text-[11px] font-mono font-bold shrink-0 mt-px">
                              {formatTimestamp(c.timestamp_seconds)}
                            </span>
                          )}
                          <span className="text-sm text-white/60 flex-1 leading-snug">{c.comment_text}</span>
                          <button
                            onClick={() => handleDeleteComment(c.id)}
                            className="opacity-0 group-hover/c:opacity-100 p-1 -mr-1 rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-all shrink-0"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}

                  {/* Feedback toggle / input */}
                  <AnimatePresence mode="wait">
                    {showFeedback ? (
                      <motion.div
                        key="input"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 space-y-2.5">
                          {/* Timestamp badge */}
                          <div className="flex items-center gap-2">
                            {commentTimestamp != null ? (
                              <button
                                onClick={() => setCommentTimestamp(null)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#0083F7]/15 text-[#0083F7] text-xs font-mono font-bold hover:bg-[#0083F7]/25 transition-colors"
                              >
                                <Clock className="h-3 w-3" />
                                {formatTimestamp(commentTimestamp)}
                                <X className="h-3 w-3 opacity-60" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleCaptureTimestamp(currentPiece.id)}
                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/[0.04] text-white/30 text-xs hover:bg-white/[0.08] hover:text-white/50 transition-colors"
                              >
                                <Clock className="h-3 w-3" />
                                <span>Zeitstempel</span>
                              </button>
                            )}
                            <div className="flex-1" />
                            <button
                              onClick={() => { setShowFeedback(false); setCommentText(""); setCommentTimestamp(null); }}
                              className="p-1 rounded-lg text-white/20 hover:text-white/50 hover:bg-white/5 transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>

                          {/* Text input */}
                          <div className="flex gap-2">
                            <Textarea
                              value={commentText}
                              onChange={(e) => setCommentText(e.target.value)}
                              placeholder="Was soll geändert werden?"
                              className="min-h-[44px] max-h-[120px] text-sm bg-transparent border-0 text-white/80 placeholder:text-white/15 resize-none p-0 focus-visible:ring-0 shadow-none"
                              rows={2}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  handleAddComment(currentPiece.id);
                                }
                              }}
                            />
                            <Button
                              size="sm"
                              onClick={() => handleAddComment(currentPiece.id)}
                              disabled={addingComment || !commentText.trim()}
                              className="self-end shrink-0 bg-[#0083F7] hover:bg-[#0083F7]/80 text-white rounded-lg h-9 w-9 p-0"
                            >
                              {addingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.button
                        key="toggle"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowFeedback(true)}
                        className="w-full py-2.5 rounded-xl border border-dashed border-white/[0.06] text-white/25 text-sm hover:border-white/10 hover:text-white/40 hover:bg-white/[0.02] transition-all flex items-center justify-center gap-2"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Feedback hinzufügen
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Bottom action bar - fixed on mobile */}
            <div className="sticky bottom-0 z-40 bg-gradient-to-t from-[#111115] via-[#111115] to-[#111115]/0 pt-6 pb-5 sm:pb-6">
              <div className="max-w-3xl mx-auto px-4 sm:px-6">
                <div className="flex gap-2.5">
                  {/* Reject button - only if there are comments */}
                  {currentComments.length > 0 && (
                    <Button
                      variant="outline"
                      className="gap-2 border-white/[0.08] text-white/60 hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/20 h-[52px] rounded-2xl px-5 font-medium"
                      onClick={() => currentPiece && handleAction(currentPiece.id, "reject")}
                      disabled={isCurrentLoading}
                    >
                      {isCurrentLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                      <span className="hidden sm:inline">Überarbeiten</span>
                      <span className="sm:hidden">Zurück</span>
                      <span className="text-xs opacity-50">({currentComments.length})</span>
                    </Button>
                  )}

                  {/* Approve button */}
                  <Button
                    className="flex-1 gap-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-semibold h-[52px] rounded-2xl shadow-xl shadow-emerald-500/20 text-base active:scale-[0.98] transition-transform"
                    onClick={() => currentPiece && handleAction(currentPiece.id, "approve")}
                    disabled={isCurrentLoading}
                  >
                    {isCurrentLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                    Freigeben
                  </Button>
                </div>

                {/* Bulk approve */}
                {pieces.length > 1 && (
                  <button
                    onClick={handleBulkApprove}
                    disabled={bulkApproving}
                    className="w-full mt-2.5 py-2.5 text-center text-xs text-white/20 hover:text-white/40 transition-colors flex items-center justify-center gap-1.5 active:scale-[0.98]"
                  >
                    {bulkApproving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCheck className="h-3.5 w-3.5" />
                    )}
                    Alle {pieces.length} freigeben
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer - only when all done */}
      {pieces.length === 0 && (
        <div className="py-6 text-center">
          <span className="text-[11px] text-white/10 tracking-wider">MARKETLAB MEDIA</span>
        </div>
      )}
    </div>
  );
};

export default ClientApproval;
