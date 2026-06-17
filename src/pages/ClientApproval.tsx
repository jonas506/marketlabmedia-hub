import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, CheckCheck, MessageSquare, X, Play, ExternalLink, Loader2, Clock, Trash2, ChevronLeft, ChevronRight, Send, AlertCircle, Calendar, Pencil, ChevronDown, Layers, Trophy, Sparkles, ArrowRight, Gift, Copy, Share2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Toaster as Sonner } from "@/components/ui/sonner";
import confetti from "canvas-confetti";
import logoDark from "@/assets/logo-light.png";
import { useIsMobile } from "@/hooks/use-mobile";

type CommentCategory = "video" | "caption" | "general";

interface TimestampComment {
  id: string;
  content_piece_id: string;
  timestamp_seconds: number | null;
  comment_text: string;
  category?: CommentCategory;
  created_at: string;
}

const CATEGORY_META: Record<CommentCategory, { label: string; classes: string }> = {
  video: { label: "Video", classes: "bg-[#0083F7]/15 text-[#0083F7]" },
  caption: { label: "Caption", classes: "bg-fuchsia-500/15 text-fuchsia-300" },
  general: { label: "Allgemein", classes: "bg-white/10 text-white/60" },
};

interface Piece {
  id: string;
  title: string | null;
  type: string;
  phase: string;
  preview_link: string | null;
  client_comment: string | null;
  team_reply?: string | null;
  script_text?: string | null;
  caption?: string | null;
  slide_images?: string[] | null;
  revision_count?: number;
}

interface ClientInfo {
  id: string;
  name: string;
  logo_url: string | null;
}

interface MarketingSummary {
  ad_spend: number;
  new_followers: number;
  dm_sent: number;
  new_conversations: number;
  appointments_booked: number;
  appointments_attended: number;
  closings: number;
  revenue_net: number;
  days_tracked: number;
  month: number;
  year: number;
}

interface UpcomingPost {
  id: string;
  title: string | null;
  type: string;
  scheduled_post_date: string;
  preview_link: string | null;
}

interface InProgressPiece {
  id: string;
  title: string | null;
  type: string;
  phase: string;
  scheduled_post_date: string | null;
  updated_at: string;
}

interface ApprovalPayload {
  client: ClientInfo;
  pieces: Piece[];
  comments: TimestampComment[];
  marketing: MarketingSummary | null;
  upcoming_posts: UpcomingPost[];
  in_progress: InProgressPiece[];
  pipeline_summary: Record<string, number>;
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

const getGoogleDriveFileId = (url: string): string | null => {
  if (!url) return null;
  const match1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match1) return match1[1];
  const match2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match2) return match2[1];
  return null;
};

const getGoogleDriveEmbedUrl = (url: string): string | null => {
  const fileId = getGoogleDriveFileId(url);
  return fileId ? `https://drive.google.com/file/d/${fileId}/preview` : null;
};

const getGoogleDriveVideoUrl = (url: string, token: string): string | null => {
  const fileId = getGoogleDriveFileId(url);
  if (!fileId || !token) return null;
  const base = import.meta.env.VITE_SUPABASE_URL;
  return `${base}/functions/v1/client-video-proxy?token=${encodeURIComponent(token)}&file_id=${encodeURIComponent(fileId)}`;
};

const CaptionBlock = ({
  pieceId,
  initialCaption,
  token,
  onSaved,
}: {
  pieceId: string;
  initialCaption: string;
  token: string;
  onSaved: (newCaption: string) => void;
}) => {
  const [value, setValue] = useState(initialCaption);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const dirty = value !== initialCaption;

  const save = async () => {
    if (!dirty) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc("update_client_piece_caption", {
        _token: token,
        _piece_id: pieceId,
        _caption: value,
      });
      if (error) throw error;
      onSaved(value);
      toast.success("Caption gespeichert");
      setEditing(false);
    } catch (err: any) {
      toast.error(err.message || "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  const characterCount = value.length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mt-3 rounded-2xl bg-white/[0.03] border border-white/[0.05] overflow-hidden"
    >
      <div className="flex items-center justify-between px-3.5 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">
            Caption
          </span>
          <span className="text-[10px] font-mono text-white/20 tabular-nums">{characterCount}</span>
        </div>
        {editing ? (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setValue(initialCaption); setEditing(false); }}
              disabled={saving}
              className="h-7 min-h-7 px-2 text-xs text-white/40 hover:text-white/80"
            >
              Abbrechen
            </Button>
            <Button
              size="sm"
              onClick={save}
              disabled={saving || !dirty}
              className="h-7 min-h-7 px-3 text-xs bg-[#0083F7] hover:bg-[#0083F7]/90 text-white"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Speichern"}
            </Button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 text-[11px] text-white/40 hover:text-[#0083F7] transition-colors px-2 py-0.5 rounded-md hover:bg-white/[0.04]"
          >
            <Pencil className="h-3 w-3" />
            Bearbeiten
          </button>
        )}
      </div>
      {editing ? (
        <div className="px-3.5 pb-3.5">
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={8}
            autoFocus
            className="text-sm bg-transparent border-white/10 text-white/85 leading-relaxed resize-y focus-visible:ring-[#0083F7]/40 whitespace-pre-wrap"
            placeholder="Caption bearbeiten…"
          />
        </div>
      ) : (
        <div className="px-3.5 pb-3.5">
          <p className="text-[13px] text-white/65 leading-relaxed whitespace-pre-wrap">
            {value || <span className="text-white/25 italic">Keine Caption</span>}
          </p>
        </div>
      )}
    </motion.div>
  );
};

/**
 * Mobile-first video player.
 * Tries a native <video> element first (we control loop / inline / no oversized Drive overlays).
 * Falls back to the Google Drive iframe if the direct stream fails.
 */
const PreviewVideoPlayer = ({
  videoSrc,
  embedSrc,
  title,
  videoRef,
}: {
  videoSrc: string | null;
  embedSrc: string;
  title: string;
  videoRef?: (el: HTMLVideoElement | null) => void;
}) => {
  const [useFallback, setUseFallback] = useState(!videoSrc);

  if (useFallback) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black p-6 text-center">
        <p className="text-sm text-white/80">
          Video konnte nicht geladen werden.
        </p>
        <a
          href={embedSrc}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary underline"
        >
          In Google Drive öffnen
        </a>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      src={videoSrc!}
      className="absolute inset-0 h-full w-full object-contain bg-black"
      controls
      controlsList="nodownload"
      loop
      playsInline
      preload="auto"
      onError={() => setUseFallback(true)}
    />
  );
};





const ClientApproval = () => {
  const { token } = useParams<{ token: string }>();
  useIsMobile();
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [comments, setComments] = useState<TimestampComment[]>([]);
  const [marketing, setMarketing] = useState<MarketingSummary | null>(null);
  const [upcomingPosts, setUpcomingPosts] = useState<UpcomingPost[]>([]);
  const [inProgress, setInProgress] = useState<InProgressPiece[]>([]);
  const [pipelineSummary, setPipelineSummary] = useState<Record<string, number>>({});
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [showReferral, setShowReferral] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [commentTimestamp, setCommentTimestamp] = useState<number | null>(null);
  const [commentCategory, setCommentCategory] = useState<CommentCategory>("video");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [addingComment, setAddingComment] = useState(false);
  const [approvedCount, setApprovedCount] = useState(0);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingCommentRef = useRef<{ pieceId: string; text: string; timestamp: number | null; category: CommentCategory } | null>(null);

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
      const payload = data as unknown as ApprovalPayload;
      setClient(payload.client);
      setPieces(payload.pieces || []);
      setComments(payload.comments || []);
      setMarketing(payload.marketing || null);
      setUpcomingPosts(payload.upcoming_posts || []);
      setInProgress(payload.in_progress || []);
      setPipelineSummary(payload.pipeline_summary || {});
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

  const flushPendingComment = useCallback(async () => {
    const pending = pendingCommentRef.current;
    if (!pending || !pending.text.trim()) return;
    pendingCommentRef.current = null;
    try {
      const { data, error } = await supabase.rpc("add_client_piece_comment", {
        _token: token,
        _piece_id: pending.pieceId,
        _comment: pending.text.trim(),
        _timestamp_seconds: pending.timestamp,
        _category: pending.category,
      } as any);
      if (error) throw error;
      setComments((prev) => [...prev, data as unknown as TimestampComment]);
      setCommentText("");
      setCommentTimestamp(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  }, [token]);

  const handleAddComment = async (pieceId: string) => {
    if (!commentText.trim()) return;
    pendingCommentRef.current = null;
    setAddingComment(true);
    try {
      const { data, error } = await supabase.rpc("add_client_piece_comment", {
        _token: token,
        _piece_id: pieceId,
        _comment: commentText.trim(),
        _timestamp_seconds: commentTimestamp,
        _category: commentCategory,
      } as any);
      if (error) throw error;
      setComments((prev) => [...prev, data as unknown as TimestampComment]);
      setCommentText("");
      setCommentTimestamp(null);
      toast.success(
        commentTimestamp != null
          ? `${CATEGORY_META[commentCategory].label}-Feedback bei ${formatTimestamp(commentTimestamp)} hinzugefügt`
          : `${CATEGORY_META[commentCategory].label}-Feedback hinzugefügt`
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
        _comments: (action === "reject" ? pc : []) as unknown as Json,
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
          _comments: [] as unknown as Json,
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
          <h1 className="text-xl font-semibold text-white mb-2" style={{ fontFamily: "Inter, sans-serif" }}>
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
  const hasSlideImages = (currentPiece?.slide_images || []).length > 0;
  const isCarousel = currentPiece?.type === "carousel" || (currentPiece?.type === "story" && hasSlideImages);
  const carouselSlides = currentPiece?.slide_images || [];
  const currentEmbed = !isCarousel && currentPiece?.preview_link ? getGoogleDriveEmbedUrl(currentPiece.preview_link) : null;
  const currentVideoSrc = !isCarousel && currentPiece?.preview_link && token ? getGoogleDriveVideoUrl(currentPiece.preview_link, token) : null;
  const currentPreviewLink = currentPiece?.preview_link ?? null;
  const allPreviewLinks = (currentPiece?.preview_link ?? "").split("\n").map(l => l.trim()).filter(Boolean);
  const isCurrentLoading = currentPiece ? actionLoading === currentPiece.id : false;
  const isRevisionBlocked = (currentPiece?.revision_count ?? 0) >= 2;
  const isTyping = showFeedback && commentText.trim().length > 0;
  const hasEmbedPreview = !!currentEmbed;

  return (
    <div className="min-h-[100dvh] bg-[#111115] text-white flex flex-col" style={{ fontFamily: "Inter, sans-serif" }}>
      <Sonner />

      {/* Header - slim & clean */}
      <div className="sticky top-0 z-50 bg-[#111115]/90 backdrop-blur-2xl border-b border-white/[0.04]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 sm:h-14 flex items-center gap-2 sm:gap-3">
          <img src={logoDark} alt="Marketlab Media" className="h-5 opacity-60 hidden sm:block" />
          <div className="w-px h-5 bg-white/10 hidden sm:block" />
          {client.logo_url ? (
            <img src={client.logo_url} alt={client.name} className="h-7 w-7 rounded-lg object-contain bg-white p-0.5 ring-1 ring-white/10" />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#0083F7] to-[#21089B] text-[11px] font-bold">
              {client.name.charAt(0)}
            </div>
          )}
          <span className="font-medium text-sm truncate min-w-0 flex-1">{client.name}</span>


          <div className="flex items-center gap-2 rounded-full bg-white/[0.04] px-2.5 py-1">
            <div className="h-1.5 w-12 sm:w-24 bg-white/[0.06] rounded-full overflow-hidden">
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

      {marketing && marketing.days_tracked > 0 && (
        <MarketingSummaryBar marketing={marketing} />
      )}

      {(upcomingPosts.length > 0 || inProgress.length > 0 || pieces.length > 0) && (
        <OverviewPanel
          open={overviewOpen}
          onToggle={() => setOverviewOpen((v) => !v)}
          upcoming={upcomingPosts}
          inProgress={inProgress}
          pipeline={pipelineSummary}
          reviewCount={pieces.length}
        />
      )}

      <div className="flex-1 flex flex-col sm:flex-row" ref={scrollRef}>
        {pieces.length === 0 ? (
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
            <div className="max-w-2xl sm:max-w-6xl mx-auto w-full px-3 sm:px-6 pt-2 sm:pt-6 pb-4 flex-1 flex flex-col sm:grid sm:grid-cols-[1fr_380px] sm:gap-8 sm:items-start">
              <div className="flex flex-col min-w-0">
                <div className="flex items-center justify-between gap-3 mb-2 sm:mb-5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-semibold uppercase tracking-wider border bg-gradient-to-r ${TYPE_COLORS[currentPiece.type] || "from-white/5 to-white/5 text-white/50 border-white/10"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${TYPE_DOT[currentPiece.type] || "bg-white/30"}`} />
                    {TYPE_LABELS[currentPiece.type] || currentPiece.type}
                  </span>
                  <span className="text-white/30 text-xs font-mono tabular-nums">
                    {currentIndex + 1}/{pieces.length}
                  </span>
                </div>

                <div className="flex items-center gap-1 rounded-full bg-white/[0.04] border border-white/[0.06] p-0.5">
                  <button
                    onClick={() => { flushPendingComment(); setCurrentIndex(Math.max(0, currentIndex - 1)); setShowFeedback(false); setCommentText(""); setCommentTimestamp(null); setConfirmApprove(false); }}
                    disabled={currentIndex === 0}
                    className="p-2 rounded-full hover:bg-white/10 disabled:opacity-20 transition-all active:scale-90"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => { flushPendingComment(); setCurrentIndex(Math.min(pieces.length - 1, currentIndex + 1)); setShowFeedback(false); setCommentText(""); setCommentTimestamp(null); setConfirmApprove(false); }}
                    disabled={currentIndex === pieces.length - 1}
                    className="p-2 rounded-full hover:bg-white/10 disabled:opacity-20 transition-all active:scale-90"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.h2
                  key={currentPiece.id + "-title"}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="mb-2 sm:mb-5 text-sm sm:text-2xl font-semibold sm:font-bold tracking-tight leading-tight break-words line-clamp-1 sm:line-clamp-none text-white/75 sm:text-white"
                >
                  {currentPiece.title || "Ohne Titel"}
                </motion.h2>
              </AnimatePresence>

              <AnimatePresence mode="wait">
                <motion.div
                  key={currentPiece.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25 }}
                  className="rounded-2xl sm:rounded-[28px] overflow-hidden border border-white/[0.05] bg-[#17181d] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]"
                >
                  {/* Carousel slides gallery */}
                  {isCarousel && carouselSlides.length > 0 ? (
                    <CarouselSlideGallery slides={carouselSlides} scriptText={currentPiece?.script_text} />
                  ) : currentEmbed ? (
                    <>
                      <div className="p-1.5 sm:p-3">
                        <div
                          className="mx-auto relative aspect-[9/16] bg-black rounded-2xl sm:rounded-[24px] ring-1 ring-white/10 overflow-hidden sm:max-h-[85vh]"
                          style={{
                            height: "min(calc(100dvh - 180px), calc((100vw - 24px) * 16 / 9))",
                          }}
                        >

                          <PreviewVideoPlayer
                            videoSrc={currentVideoSrc}
                            embedSrc={currentEmbed}
                            title={currentPiece.title || "Preview"}
                            videoRef={(el) => {
                              videoRefs.current[currentPiece.id] = el;
                            }}
                          />
                          {allPreviewLinks.length > 1 && (
                            <div className="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-none">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-white text-[10px] font-mono">
                                <Layers className="h-2.5 w-2.5" />
                                {allPreviewLinks.length} Varianten
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {allPreviewLinks.length > 1 && (
                        <div className="border-t border-white/[0.05] px-3 py-2.5 sm:px-4 flex gap-1.5 overflow-x-auto">
                          {allPreviewLinks.map((link, i) => (
                            <a
                              key={i}
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white/60 hover:bg-white/[0.06] hover:text-white/80 transition-colors"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Variante {i + 1}
                            </a>
                          ))}
                        </div>
                      )}
                    </>
                  ) : currentPreviewLink ? (
                    <a
                      href={currentPreviewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center justify-center gap-4 py-16 sm:py-24 hover:bg-white/[0.02] transition-colors"
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
                    <div className="flex items-center justify-center py-16 sm:py-24">
                      <span className="text-sm text-white/20">Kein Preview verfügbar</span>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {pieces.length > 1 && (
                <div className="flex justify-center gap-1.5 mt-4">
                  {pieces.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => { flushPendingComment(); setCurrentIndex(i); setShowFeedback(false); setCommentText(""); setCommentTimestamp(null); setConfirmApprove(false); }}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === currentIndex ? "w-7 bg-[#0083F7]" : "w-1.5 bg-white/10 hover:bg-white/20"
                      }`}
                    />
                  ))}
                </div>
              )}
              </div>

              {/* RIGHT COLUMN: Actions */}
              <div className="flex flex-col min-w-0">

              {currentPiece && currentPiece.caption != null && (
                <CaptionBlock
                  key={currentPiece.id}
                  pieceId={currentPiece.id}
                  initialCaption={currentPiece.caption ?? ""}
                  token={token!}
                  onSaved={(newCaption) =>
                    setPieces((prev) =>
                      prev.map((p) => (p.id === currentPiece.id ? { ...p, caption: newCaption } : p))
                    )
                  }
                />
              )}

              {currentPiece && (
                <div className="mt-4 sm:mt-5">
                  {currentComments.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mb-3 space-y-2"
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
                          className="flex items-start gap-2.5 py-2.5 px-3 rounded-2xl bg-white/[0.03] border border-white/[0.04] group/c"
                        >
                          {(() => {
                            const cat = (c.category ?? "video") as CommentCategory;
                            return (
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide shrink-0 mt-px ${CATEGORY_META[cat].classes}`}>
                                {CATEGORY_META[cat].label}
                              </span>
                            );
                          })()}
                          {c.timestamp_seconds != null && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#0083F7]/10 text-[#0083F7] text-[11px] font-mono font-bold shrink-0 mt-px">
                              {formatTimestamp(c.timestamp_seconds)}
                            </span>
                          )}
                          <span className="text-sm text-white/60 flex-1 leading-snug">{c.comment_text}</span>
                          <button
                            onClick={() => handleDeleteComment(c.id)}
                            className="opacity-60 sm:opacity-0 group-hover/c:opacity-100 p-1.5 -mr-0.5 rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-all shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}

                  {/* Team reply to previous feedback */}
                  {currentPiece.team_reply && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mb-3 rounded-2xl bg-[#0083F7]/5 border border-[#0083F7]/10 p-3"
                    >
                      <span className="text-[11px] font-semibold text-[#0083F7]/50 uppercase tracking-widest block mb-1.5">
                        Antwort von Marketlab Media
                      </span>
                      <p className="text-sm text-white/70 leading-snug">{currentPiece.team_reply}</p>
                    </motion.div>
                  )}


                  {isRevisionBlocked ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="rounded-2xl border border-amber-500/15 bg-amber-500/5 p-4 flex items-start gap-3"
                    >
                      <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-300">Maximale Revisionen erreicht</p>
                        <p className="text-xs text-white/35 mt-1 leading-relaxed">
                          Du hast bereits 2× Feedback gegeben. Bitte kontaktiere dein Marketlab-Team direkt für weitere Änderungen.
                        </p>
                      </div>
                    </motion.div>
                  ) : (
                    <AnimatePresence mode="wait">
                      {showFeedback ? (
                        <motion.div
                          key="input"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-3 space-y-2.5">
                            {(currentPiece?.revision_count ?? 0) === 1 && (
                              <div className="flex items-center gap-2 text-amber-400/70 text-[11px] font-medium px-1">
                                <AlertCircle className="h-3 w-3" />
                                Letzte Revision — danach bitte direkt mit dem Team sprechen
                              </div>
                            )}
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

                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] uppercase tracking-widest text-white/25 font-semibold mr-0.5">Tag</span>
                              {(["video", "caption", "general"] as CommentCategory[]).map((cat) => {
                                const active = commentCategory === cat;
                                return (
                                  <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setCommentCategory(cat)}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                                      active
                                        ? CATEGORY_META[cat].classes
                                        : "bg-white/[0.04] text-white/30 hover:bg-white/[0.08] hover:text-white/50"
                                    }`}
                                  >
                                    {CATEGORY_META[cat].label}
                                  </button>
                                );
                              })}
                            </div>


                            <div className="flex gap-2">
                              <Textarea
                                value={commentText}
                                onChange={(e) => {
                                  setCommentText(e.target.value);
                                  if (currentPiece && e.target.value.trim()) {
                                    pendingCommentRef.current = { pieceId: currentPiece.id, text: e.target.value, timestamp: commentTimestamp, category: commentCategory };
                                  } else {
                                    pendingCommentRef.current = null;
                                  }
                                }}
                                placeholder="Was soll geändert werden?"
                                className="min-h-[44px] max-h-[120px] text-sm bg-transparent border-0 text-white/80 placeholder:text-white/15 resize-none p-0 focus-visible:ring-0 shadow-none"
                                rows={2}
                                autoFocus
                                onBlur={() => {
                                  if (commentText.trim() && currentPiece) {
                                    handleAddComment(currentPiece.id);
                                  }
                                }}
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
                                className="self-end shrink-0 bg-[#0083F7] hover:bg-[#0083F7]/80 text-white rounded-xl h-10 w-10 p-0"
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
                          className="w-full py-3 rounded-2xl border border-dashed border-white/[0.06] text-white/25 text-sm hover:border-white/10 hover:text-white/40 hover:bg-white/[0.02] transition-all flex items-center justify-center gap-2"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          Feedback hinzufügen
                          {(currentPiece?.revision_count ?? 0) > 0 && (
                            <span className="text-[10px] opacity-50">({currentPiece?.revision_count}/2)</span>
                          )}
                        </motion.button>
                      )}
                    </AnimatePresence>
                  )}
                </div>
              )}

              {/* Desktop Buttons */}
              <div className="hidden sm:block mt-6 space-y-2">
                {!confirmApprove ? (
                  <>
                    <div className="flex gap-2">
                      {isTyping ? (
                        <div className="flex-1 flex items-center justify-center h-[52px] rounded-[20px] border border-dashed border-white/[0.06] text-white/20 text-xs gap-2">
                          <Send className="h-3.5 w-3.5" />
                          Kommentar wird automatisch gespeichert
                        </div>
                      ) : currentComments.length > 0 && !isRevisionBlocked ? (
                        <>
                          {currentPiece?.team_reply ? (
                            <>
                              <Button
                                className="flex-1 gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-semibold h-[52px] rounded-[20px] shadow-xl shadow-emerald-500/20 text-base active:scale-[0.98] transition-transform"
                                onClick={() => setConfirmApprove(true)}
                                disabled={isCurrentLoading}
                              >
                                <Check className="h-5 w-5" />
                                Freigeben
                              </Button>
                              <Button
                                variant="outline"
                                className="min-w-[6rem] gap-1.5 border-white/[0.08] text-white/40 hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/20 h-[52px] rounded-[20px] px-4 font-medium text-sm"
                                onClick={() => currentPiece && handleAction(currentPiece.id, "reject")}
                                disabled={isCurrentLoading}
                              >
                                {isCurrentLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                                Überarbeiten
                                <span className="text-xs opacity-60">({currentComments.length})</span>
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                className="flex-1 gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white font-semibold h-[52px] rounded-[20px] shadow-xl shadow-amber-500/20 text-base active:scale-[0.98] transition-transform"
                                onClick={() => currentPiece && handleAction(currentPiece.id, "reject")}
                                disabled={isCurrentLoading}
                              >
                                {isCurrentLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                                Überarbeiten
                                <span className="text-xs opacity-60">({currentComments.length})</span>
                              </Button>
                              <Button
                                variant="outline"
                                className="min-w-[6rem] gap-1.5 border-white/[0.08] text-white/40 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/20 h-[52px] rounded-[20px] px-4 font-medium text-sm"
                                onClick={() => setConfirmApprove(true)}
                                disabled={isCurrentLoading}
                              >
                                <Check className="h-4 w-4" />
                                Freigeben
                              </Button>
                            </>
                          )}
                        </>
                      ) : (
                        <Button
                          className="flex-1 gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-semibold h-[52px] rounded-[20px] shadow-xl shadow-emerald-500/20 text-base active:scale-[0.98] transition-transform"
                          onClick={() => currentPiece && handleAction(currentPiece.id, "approve")}
                          disabled={isCurrentLoading}
                        >
                          {isCurrentLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                          Freigeben
                        </Button>
                      )}
                    </div>
                    {pieces.length > 1 && (
                      <button
                        onClick={handleBulkApprove}
                        disabled={bulkApproving}
                        className="w-full mt-1.5 py-2.5 text-center text-xs text-white/25 hover:text-white/45 transition-colors flex items-center justify-center gap-1.5 active:scale-[0.98]"
                      >
                        {bulkApproving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
                        Alle {pieces.length} freigeben
                      </button>
                    )}
                  </>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3"
                  >
                    <div className="flex items-start gap-2 mb-3">
                      <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-200/80">
                        Du hast {currentComments.length} Kommentar{currentComments.length > 1 ? "e" : ""} geschrieben. Trotzdem freigeben? Kommentare werden gelöscht.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1 h-10 rounded-xl border-white/10 text-white/60 text-xs"
                        onClick={() => setConfirmApprove(false)}
                      >
                        Abbrechen
                      </Button>
                      <Button
                        className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                        onClick={() => { setConfirmApprove(false); currentPiece && handleAction(currentPiece.id, "approve"); }}
                        disabled={isCurrentLoading}
                      >
                        {isCurrentLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Ja, freigeben
                      </Button>
                    </div>
                  </motion.div>
                )}
              </div>
              </div>
            </div>

            {/* MOBILE sticky buttons */}
            <div className="sticky bottom-0 z-40 bg-gradient-to-t from-[#111115] via-[#111115] to-[#111115]/0 pt-4 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:hidden">
              <div className="max-w-2xl mx-auto px-4 sm:px-6">
                <div className="rounded-[28px] border border-white/[0.06] bg-white/[0.03] p-2 backdrop-blur-xl sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0">
                  {/* Confirm approve dialog when comments exist */}
                  <AnimatePresence>
                    {confirmApprove && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        className="mb-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3"
                      >
                        <div className="flex items-start gap-2 mb-3">
                          <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-200/80">
                            Du hast {currentComments.length} Kommentar{currentComments.length > 1 ? "e" : ""} geschrieben. Trotzdem freigeben? Kommentare werden gelöscht.
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            className="flex-1 h-10 rounded-xl border-white/10 text-white/60 text-xs"
                            onClick={() => setConfirmApprove(false)}
                          >
                            Abbrechen
                          </Button>
                          <Button
                            className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                            onClick={() => {
                              setConfirmApprove(false);
                              currentPiece && handleAction(currentPiece.id, "approve");
                            }}
                            disabled={isCurrentLoading}
                          >
                            {isCurrentLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            Ja, freigeben
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {!confirmApprove && (
                    <>
                      <div className="flex gap-2">
                        {isTyping ? (
                          /* While typing: only show hint to submit */
                          <div className="flex-1 flex items-center justify-center h-12 sm:h-[52px] rounded-[20px] border border-dashed border-white/[0.06] text-white/20 text-xs gap-2">
                            <Send className="h-3.5 w-3.5" />
                            Kommentar wird automatisch gespeichert
                          </div>
                        ) : currentComments.length > 0 && !isRevisionBlocked ? (
                          <>
                            {currentPiece?.team_reply ? (
                              <>
                                <Button
                                  className="flex-1 gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-semibold h-12 sm:h-[52px] rounded-[20px] shadow-xl shadow-emerald-500/20 text-sm sm:text-base active:scale-[0.98] transition-transform"
                                  onClick={() => {
                                    setConfirmApprove(true);
                                  }}
                                  disabled={isCurrentLoading}
                                >
                                  <Check className="h-5 w-5" />
                                  Freigeben
                                </Button>
                                <Button
                                  variant="outline"
                                  className="min-w-[6rem] gap-1.5 border-white/[0.08] text-white/40 hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/20 h-12 sm:h-[52px] rounded-[20px] px-3 sm:px-4 font-medium text-xs sm:text-sm"
                                  onClick={() => currentPiece && handleAction(currentPiece.id, "reject")}
                                  disabled={isCurrentLoading}
                                >
                                  {isCurrentLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                                  Überarbeiten
                                  <span className="text-xs opacity-60">({currentComments.length})</span>
                                </Button>
                              </>
                            ) : (
                              <>
                                {/* When comments exist: Überarbeiten is primary/big, Freigeben is secondary/small */}
                                <Button
                                  className="flex-1 gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white font-semibold h-12 sm:h-[52px] rounded-[20px] shadow-xl shadow-amber-500/20 text-sm sm:text-base active:scale-[0.98] transition-transform"
                                  onClick={() => currentPiece && handleAction(currentPiece.id, "reject")}
                                  disabled={isCurrentLoading}
                                >
                                  {isCurrentLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                                  Überarbeiten
                                  <span className="text-xs opacity-60">({currentComments.length})</span>
                                </Button>
                                <Button
                                  variant="outline"
                                  className="min-w-[6rem] gap-1.5 border-white/[0.08] text-white/40 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/20 h-12 sm:h-[52px] rounded-[20px] px-3 sm:px-4 font-medium text-xs sm:text-sm"
                                  onClick={() => {
                                    setConfirmApprove(true);
                                  }}
                                  disabled={isCurrentLoading}
                                >
                                  <Check className="h-4 w-4" />
                                  Freigeben
                                </Button>
                              </>
                            )}
                          </>
                        ) : (
                          /* No comments: Freigeben is primary/big */
                          <Button
                            className="flex-1 gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-semibold h-12 sm:h-[52px] rounded-[20px] shadow-xl shadow-emerald-500/20 text-sm sm:text-base active:scale-[0.98] transition-transform"
                            onClick={() => currentPiece && handleAction(currentPiece.id, "approve")}
                            disabled={isCurrentLoading}
                          >
                            {isCurrentLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                            Freigeben
                          </Button>
                        )}
                      </div>

                      {pieces.length > 1 && (
                        <button
                          onClick={handleBulkApprove}
                          disabled={bulkApproving}
                          className="w-full mt-1.5 py-2.5 text-center text-xs text-white/25 hover:text-white/45 transition-colors flex items-center justify-center gap-1.5 active:scale-[0.98]"
                        >
                          {bulkApproving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCheck className="h-3.5 w-3.5" />
                          )}
                          Alle {pieces.length} freigeben
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Floating Referral Badge - bottom right */}
      <motion.button
        initial={{ opacity: 0, y: 20, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.6, type: "spring", damping: 20 }}
        onClick={() => setShowReferral(true)}
        className="group fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center gap-2 rounded-full pl-3 pr-4 py-2.5 text-xs font-semibold transition-all duration-300 hover:scale-105 active:scale-95"
        style={{
          background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 45%, #b45309 100%)",
          color: "#1a1208",
          boxShadow:
            "0 0 0 1px rgba(252, 211, 77, 0.4), 0 8px 24px -4px rgba(245, 158, 11, 0.5), 0 0 40px -8px rgba(251, 191, 36, 0.6), inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(120,53,15,0.3)",
        }}
      >
        <span
          className="absolute inset-0 rounded-full opacity-60 blur-xl -z-10 animate-pulse"
          style={{ background: "radial-gradient(circle, #fbbf24, transparent 70%)" }}
        />
        <Trophy className="h-3.5 w-3.5" />
        <span className="tracking-tight">1.000€ sparen</span>
        <ArrowRight className="h-3 w-3 opacity-70 group-hover:translate-x-0.5 transition-transform" />
      </motion.button>

      {/* Referral Dialog */}
      <AnimatePresence>
        {showReferral && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center px-4"
            onClick={() => setShowReferral(false)}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md rounded-[28px] border border-amber-500/20 overflow-hidden shadow-2xl"
              style={{
                background: "linear-gradient(180deg, #1a1508 0%, #0f0c05 100%)",
                boxShadow: "0 0 60px rgba(245, 158, 11, 0.15), 0 25px 50px -12px rgba(0,0,0,0.8)",
              }}
            >
              {/* Glowing top border */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />

              {/* Sparkle background effect */}
              <div className="absolute top-4 right-4">
                <Sparkles className="h-5 w-5 text-amber-400/40 animate-pulse" />
              </div>
              <div className="absolute top-12 left-6">
                <Sparkles className="h-3 w-3 text-amber-400/25 animate-pulse" style={{ animationDelay: "0.5s" }} />
              </div>

              <div className="p-6 sm:p-8">
                {/* Header */}
                <div className="flex items-center gap-3 mb-5">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-2xl"
                    style={{
                      background: "linear-gradient(135deg, #f59e0b, #d97706)",
                      boxShadow: "0 0 20px rgba(245, 158, 11, 0.3)",
                    }}
                  >
                    <Gift className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Empfiehl uns weiter</h3>
                    <p className="text-sm text-amber-400/80">und spar bares Geld</p>
                  </div>
                </div>

                {/* Description */}
                <p className="text-[13px] text-white/50 leading-relaxed mb-6">
                  Für jede Person, die du uns empfiehlst und die einen Vertrag bei uns unterschreibt, bekommst du eine Gutschrift auf deine nächste Rechnung. Sofort. Ohne Haken.
                </p>

                {/* Reward tiers */}
                <div className="space-y-2.5 mb-6">
                  {[
                    { label: "1. Empfehlung", reward: "1.000€ Gutschrift", color: "from-amber-500/20 to-amber-600/10", border: "border-amber-500/15", text: "text-amber-300" },
                    { label: "2. Empfehlung", reward: "1.500€ Gutschrift", color: "from-amber-500/25 to-amber-600/15", border: "border-amber-500/20", text: "text-amber-200" },
                    { label: "3. Empfehlung", reward: "Nächster Monat gratis", color: "from-amber-500/30 to-amber-600/20", border: "border-amber-500/25", text: "text-amber-100 font-semibold" },
                  ].map((tier, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.1 }}
                      className={`flex items-center justify-between rounded-xl border ${tier.border} bg-gradient-to-r ${tier.color} px-4 py-3`}
                    >
                      <span className="text-xs text-white/40">{tier.label}</span>
                      <ArrowRight className="h-3 w-3 text-white/20" />
                      <span className={`text-sm ${tier.text}`}>{tier.reward}</span>
                    </motion.div>
                  ))}
                </div>

                {/* CTA hint */}
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3 mb-5">
                  <p className="text-[11px] text-white/30 text-center leading-relaxed">
                    Sprich uns einfach an — wir kümmern uns um den Rest.
                  </p>
                </div>

                {/* Close button */}
                <button
                  onClick={() => setShowReferral(false)}
                  className="w-full rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white/60 hover:text-white text-sm font-medium py-3 transition-all active:scale-[0.98]"
                >
                  Verstanden
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const PHASE_LABELS: Record<string, string> = {
  idea: "Idee",
  script: "Skript",
  shooting: "Dreh",
  editing: "Schnitt",
  review: "Freigabe",
  approved: "Freigegeben",
};

const TYPE_DOT_BG: Record<string, string> = {
  reel: "bg-blue-400",
  story: "bg-purple-400",
  carousel: "bg-amber-400",
  ad: "bg-violet-400",
  youtube_longform: "bg-red-400",
};

function OverviewPanel({
  open,
  onToggle,
  upcoming,
  inProgress,
  pipeline,
  reviewCount,
}: {
  open: boolean;
  onToggle: () => void;
  upcoming: UpcomingPost[];
  inProgress: InProgressPiece[];
  pipeline: Record<string, number>;
  reviewCount: number;
}) {
  const internalReviewCount = inProgress.filter((p) => p.phase === "internal_review").length;

  // Build mini calendar covering current + next month, mark scheduled posts
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const postsByDay = new Map<string, UpcomingPost[]>();
  for (const p of upcoming) {
    const d = new Date(p.scheduled_post_date);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const arr = postsByDay.get(key) || [];
    arr.push(p);
    postsByDay.set(key, arr);
  }

  const renderMonth = (year: number, month: number) => {
    const first = new Date(year, month, 1);
    const startWeekday = (first.getDay() + 6) % 7; // Monday=0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return (
      <div>
        <div className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-1.5 text-center">
          {MONTH_NAMES[month + 1]} {year}
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center mb-0.5">
          {["M", "D", "M", "D", "F", "S", "S"].map((w, i) => (
            <div key={i} className="text-[9px] text-white/25 font-mono">{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((d, i) => {
            if (!d) return <div key={i} className="aspect-square" />;
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            const posts = postsByDay.get(key) || [];
            const isToday = d.getTime() === today.getTime();
            const hasPosts = posts.length > 0;
            return (
              <div
                key={i}
                title={posts.map(p => p.title || "Ohne Titel").join("\n")}
                className={`aspect-square rounded-md flex flex-col items-center justify-center text-[10px] font-mono tabular-nums relative ${
                  hasPosts
                    ? "bg-[#0083F7]/15 text-white border border-[#0083F7]/40"
                    : isToday
                    ? "bg-white/[0.04] text-white/70 border border-white/10"
                    : "text-white/30"
                }`}
              >
                <span>{d.getDate()}</span>
                {posts.length > 1 && (
                  <span className="text-[8px] text-[#0083F7] leading-none">{posts.length}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const nextMonth = today.getMonth() === 11 ? 0 : today.getMonth() + 1;
  const nextYear = today.getMonth() === 11 ? today.getFullYear() + 1 : today.getFullYear();

  return (
    <div className="border-b border-white/[0.04]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-2.5">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between gap-3 text-left group"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-[#0083F7]/70" />
              <span className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">
                Übersicht
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-white/40 truncate">
              <span><span className="text-white/70 font-semibold">{internalReviewCount}</span> in Arbeit</span>
              <span className="text-white/15">·</span>
              <span><span className="text-white/70 font-semibold">{reviewCount}</span> zur Freigabe</span>
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 text-white/30 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pt-3 pb-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {renderMonth(today.getFullYear(), today.getMonth())}
                {renderMonth(nextYear, nextMonth)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const MONTH_NAMES = ["", "Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];


function MarketingSummaryBar({ marketing }: { marketing: MarketingSummary }) {
  const cpf = marketing.new_followers > 0 ? (marketing.ad_spend / marketing.new_followers) : null;
  const stats = [
    { label: "Ad Spend", value: `${marketing.ad_spend.toFixed(0)} €`, color: "text-rose-400" },
    { label: "Follower", value: `+${marketing.new_followers}`, color: "text-violet-400" },
    { label: "€/Follower", value: cpf ? `${cpf.toFixed(2)} €` : "–", color: "text-violet-400" },
    { label: "DMs", value: String(marketing.dm_sent), color: "text-sky-400" },
    { label: "Termine", value: String(marketing.appointments_booked), color: "text-amber-400" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-b border-white/[0.04]"
    >
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-[10px] font-semibold text-white/25 uppercase tracking-widest">
            Marketing {MONTH_NAMES[marketing.month]} {marketing.year}
          </span>
          <span className="text-[10px] text-white/15 font-mono">{marketing.days_tracked} Tage</span>
        </div>
        <div className="flex gap-4 overflow-x-auto">
          {stats.map((s) => (
            <div key={s.label} className="shrink-0">
              <div className={`text-sm font-bold font-mono ${s.color}`}>{s.value}</div>
              <div className="text-[9px] text-white/20 uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function CarouselSlideGallery({ slides, scriptText }: { slides: string[]; scriptText?: string | null }) {
  const [activeSlide, setActiveSlide] = useState(0);

  return (
    <div>
      {/* Main slide */}
      <div className="relative bg-black">
        <AnimatePresence mode="wait">
          <motion.img
            key={activeSlide}
            src={slides[activeSlide]}
            alt={`Slide ${activeSlide + 1}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-h-[75vh] object-contain mx-auto"
          />
        </AnimatePresence>

        {/* Slide counter */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md text-white text-[11px] font-mono px-2.5 py-1 rounded-full">
          {activeSlide + 1} / {slides.length}
        </div>

        {/* Nav arrows */}
        {slides.length > 1 && (
          <>
            {activeSlide > 0 && (
              <button
                onClick={() => setActiveSlide(activeSlide - 1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white/70 hover:text-white hover:bg-black/60 transition-all"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            {activeSlide < slides.length - 1 && (
              <button
                onClick={() => setActiveSlide(activeSlide + 1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white/70 hover:text-white hover:bg-black/60 transition-all"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {slides.length > 1 && (
        <div className="flex gap-1.5 p-3 overflow-x-auto justify-center">
          {slides.map((url, idx) => (
            <button
              key={idx}
              onClick={() => setActiveSlide(idx)}
              className={`shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                idx === activeSlide
                  ? "border-[#0083F7] ring-1 ring-[#0083F7]/30"
                  : "border-white/10 opacity-50 hover:opacity-80"
              }`}
            >
              <img src={url} alt={`Slide ${idx + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

    </div>
  );
}

export default ClientApproval;

