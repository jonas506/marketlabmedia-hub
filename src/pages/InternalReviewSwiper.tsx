import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Check,
  MessageSquare,
  X,
  Play,
  ExternalLink,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Send,
  ArrowLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Toaster as Sonner } from "@/components/ui/sonner";
import confetti from "canvas-confetti";
import logoDark from "@/assets/logo-dark.png";

interface Piece {
  id: string;
  title: string | null;
  type: string;
  phase: string;
  preview_link: string | null;
  internal_note: string | null;
  script_text: string | null;
  caption: string | null;
  slide_images: string[] | null;
  client_id: string;
  clients?: { id: string; name: string; logo_url: string | null } | null;
}

const TYPE_LABELS: Record<string, string> = {
  reel: "Reel",
  story: "Story Ad",
  carousel: "Karussell",
  ad: "Ad",
  youtube_longform: "YouTube",
};

const TYPE_COLORS: Record<string, string> = {
  reel: "from-blue-500/20 to-blue-600/10 text-blue-400 border-blue-500/20",
  story: "from-purple-500/20 to-purple-600/10 text-purple-400 border-purple-500/20",
  carousel: "from-amber-500/20 to-amber-600/10 text-amber-400 border-amber-500/20",
  ad: "from-violet-500/20 to-violet-600/10 text-violet-400 border-violet-500/20",
  youtube_longform: "from-red-500/20 to-red-600/10 text-red-400 border-red-500/20",
};

const TYPE_DOT: Record<string, string> = {
  reel: "bg-blue-400",
  story: "bg-purple-400",
  carousel: "bg-amber-400",
  ad: "bg-violet-400",
  youtube_longform: "bg-red-400",
};

const getGoogleDriveFileId = (url: string): string | null => {
  if (!url) return null;
  const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  return null;
};
const getGoogleDriveEmbedUrl = (url: string): string | null => {
  const id = getGoogleDriveFileId(url);
  return id ? `https://drive.google.com/file/d/${id}/preview` : null;
};
const getGoogleDriveVideoUrl = (url: string): string | null => {
  const id = getGoogleDriveFileId(url);
  return id ? `https://drive.google.com/uc?export=download&id=${id}` : null;
};

export default function InternalReviewSwiper() {
  const navigate = useNavigate();
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const fetchData = useCallback(async () => {
    const { data, error } = await supabase
      .from("content_pieces")
      .select(
        "id, title, type, phase, preview_link, internal_note, script_text, caption, slide_images, client_id, clients(id, name, logo_url)"
      )
      .eq("phase", "internal_review")
      .order("updated_at", { ascending: true });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    setPieces((data ?? []) as any);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const currentPiece = pieces[currentIndex];

  const goPrev = () => {
    setShowFeedback(false);
    setFeedbackText("");
    setCurrentIndex((i) => Math.max(0, i - 1));
  };
  const goNext = () => {
    setShowFeedback(false);
    setFeedbackText("");
    setCurrentIndex((i) => Math.min(pieces.length - 1, i + 1));
  };

  const handleApprove = async () => {
    if (!currentPiece) return;
    setActionLoading(currentPiece.id);
    try {
      const { error } = await supabase
        .from("content_pieces")
        .update({ phase: "review", phase_changed_at: new Date().toISOString() })
        .eq("id", currentPiece.id);
      if (error) throw error;
      const id = currentPiece.id;
      const newPieces = pieces.filter((p) => p.id !== id);
      setPieces(newPieces);
      setApprovedCount((c) => c + 1);
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#0083F7", "#21089B", "#10B981", "#FAFBFF"],
      });
      toast.success("An Kunde gesendet ✅");
      if (currentIndex >= newPieces.length && newPieces.length > 0) {
        setCurrentIndex(newPieces.length - 1);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendBack = async () => {
    if (!currentPiece) return;
    if (!feedbackText.trim()) {
      toast.error("Bitte Feedback eingeben");
      return;
    }
    setActionLoading(currentPiece.id);
    try {
      // Send back to editing with internal note
      const targetPhase = currentPiece.type === "carousel" || currentPiece.type === "story" ? "script" : "editing";
      const { error } = await supabase
        .from("content_pieces")
        .update({
          phase: targetPhase,
          internal_note: feedbackText.trim(),
          phase_changed_at: new Date().toISOString(),
        })
        .eq("id", currentPiece.id);
      if (error) throw error;

      // Also record as internal comment so team sees it in the pipeline thread
      const { data: authData } = await supabase.auth.getUser();
      const authorId = authData.user?.id;
      if (authorId) {
        await supabase.from("piece_internal_comments").insert({
          content_piece_id: currentPiece.id,
          client_id: currentPiece.client_id,
          author_id: authorId,
          body: feedbackText.trim(),
          mentioned_user_ids: [],
        });
      }
      const id = currentPiece.id;
      const newPieces = pieces.filter((p) => p.id !== id);
      setPieces(newPieces);
      setShowFeedback(false);
      setFeedbackText("");
      toast("Zurück zur Bearbeitung 📝");
      if (currentIndex >= newPieces.length && newPieces.length > 0) {
        setCurrentIndex(newPieces.length - 1);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#111115] flex items-center justify-center">
        <Sonner />
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
      </div>
    );
  }

  const totalPieces = pieces.length + approvedCount;
  const hasSlideImages = (currentPiece?.slide_images || []).length > 0;
  const isCarousel = currentPiece?.type === "carousel" || (currentPiece?.type === "story" && hasSlideImages);
  const carouselSlides = currentPiece?.slide_images || [];
  const currentEmbed =
    !isCarousel && currentPiece?.preview_link ? getGoogleDriveEmbedUrl(currentPiece.preview_link.split("\n")[0]) : null;
  const currentVideoSrc =
    !isCarousel && currentPiece?.preview_link ? getGoogleDriveVideoUrl(currentPiece.preview_link.split("\n")[0]) : null;
  const allPreviewLinks = (currentPiece?.preview_link ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  const isCurrentLoading = currentPiece ? actionLoading === currentPiece.id : false;

  return (
    <div className="min-h-[100dvh] bg-[#111115] text-white flex flex-col" style={{ fontFamily: "Inter, sans-serif" }}>
      <Sonner />

      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#111115]/90 backdrop-blur-2xl border-b border-white/[0.04]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => navigate("/interne-freigabe")}
            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-white/60 hover:text-white"
            title="Zur Liste"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <img src={logoDark} alt="Marketlab Media" className="h-5 opacity-60 hidden sm:block" />
          <div className="w-px h-5 bg-white/10 hidden sm:block" />
          <span className="font-semibold text-sm">Interne Freigabe</span>
          <div className="flex-1" />
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

      <div className="flex-1 flex flex-col">
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
              <p className="text-white/35 text-sm max-w-xs mx-auto mb-6">
                Keine offenen internen Freigaben mehr.
              </p>
              <Button
                onClick={() => navigate("/interne-freigabe")}
                variant="outline"
                className="bg-white/[0.04] border-white/10 hover:bg-white/[0.08] text-white"
              >
                Zur Liste
              </Button>
            </div>
          </motion.div>
        ) : (
          <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 pt-4 sm:pt-6 pb-4 flex-1 flex flex-col">
            {/* Meta row */}
            <div className="flex items-center justify-between gap-3 mb-4 sm:mb-5">
              <div className="flex items-center gap-2.5 min-w-0">
                {currentPiece.clients?.logo_url ? (
                  <img
                    src={currentPiece.clients.logo_url}
                    alt={currentPiece.clients.name}
                    className="h-7 w-7 rounded-lg object-contain bg-white p-0.5 ring-1 ring-white/10 flex-shrink-0"
                  />
                ) : (
                  <div className="h-7 w-7 rounded-lg bg-white/10 flex-shrink-0" />
                )}
                <Link
                  to={`/client/${currentPiece.client_id}`}
                  className="text-sm font-medium text-white/80 hover:text-white truncate"
                >
                  {currentPiece.clients?.name ?? "Unbekannt"}
                </Link>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-semibold uppercase tracking-wider border bg-gradient-to-r ${
                    TYPE_COLORS[currentPiece.type] || "from-white/5 to-white/5 text-white/50 border-white/10"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${TYPE_DOT[currentPiece.type] || "bg-white/30"}`} />
                  {TYPE_LABELS[currentPiece.type] || currentPiece.type}
                </span>
                <span className="text-white/30 text-xs font-mono tabular-nums">
                  {currentIndex + 1}/{pieces.length}
                </span>
              </div>

              <div className="flex items-center gap-1 rounded-full bg-white/[0.04] border border-white/[0.06] p-0.5">
                <button
                  onClick={goPrev}
                  disabled={currentIndex === 0}
                  className="p-2 rounded-full hover:bg-white/10 disabled:opacity-20 transition-all active:scale-90"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={goNext}
                  disabled={currentIndex >= pieces.length - 1}
                  className="p-2 rounded-full hover:bg-white/10 disabled:opacity-20 transition-all active:scale-90"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={currentPiece.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="flex-1 flex flex-col"
              >
                {/* Title */}
                {currentPiece.title && (
                  <h1 className="text-xl sm:text-2xl font-bold mb-4 leading-tight">{currentPiece.title}</h1>
                )}

                {/* Video / Carousel / Preview */}
                <div className="relative rounded-2xl overflow-hidden bg-black/40 border border-white/[0.04] mb-4 aspect-[9/16] max-h-[70vh] mx-auto w-full max-w-md">
                  {isCarousel && carouselSlides.length > 0 ? (
                    <div className="w-full h-full overflow-x-auto snap-x snap-mandatory flex">
                      {carouselSlides.map((src, i) => (
                        <img
                          key={i}
                          src={src}
                          alt={`Slide ${i + 1}`}
                          className="w-full h-full object-contain flex-shrink-0 snap-center"
                        />
                      ))}
                    </div>
                  ) : currentEmbed ? (
                    <iframe
                      key={currentPiece.id}
                      src={currentEmbed}
                      className="w-full h-full"
                      allow="autoplay"
                      allowFullScreen
                    />
                  ) : currentVideoSrc ? (
                    <video
                      ref={videoRef}
                      key={currentPiece.id}
                      src={currentVideoSrc}
                      controls
                      playsInline
                      className="w-full h-full object-contain bg-black"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-white/30 text-sm gap-3">
                      <Play className="h-10 w-10" />
                      <span>Keine Preview verfügbar</span>
                      {allPreviewLinks.length > 0 && (
                        <a
                          href={allPreviewLinks[0]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-[#0083F7] hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" /> Link öffnen
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* External links */}
                {allPreviewLinks.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {allPreviewLinks.map((link, i) => (
                      <a
                        key={i}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-white/60 hover:bg-white/[0.08] hover:text-white"
                      >
                        <ExternalLink className="h-3 w-3" /> Preview {i + 1}
                      </a>
                    ))}
                  </div>
                )}

                {/* Caption / Script */}
                {currentPiece.caption && (
                  <div className="mb-4 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] text-sm text-white/70 whitespace-pre-wrap max-h-40 overflow-auto">
                    <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1.5">Caption</div>
                    {currentPiece.caption}
                  </div>
                )}

                {/* Internal note from previous round */}
                {currentPiece.internal_note && (
                  <div className="mb-4 p-3 rounded-xl bg-amber-500/[0.06] border border-amber-500/20 text-sm text-amber-200/90 whitespace-pre-wrap">
                    <div className="text-[10px] uppercase tracking-wider text-amber-300/70 mb-1.5">Interne Notiz</div>
                    {currentPiece.internal_note}
                  </div>
                )}

                {/* Feedback box */}
                <AnimatePresence>
                  {showFeedback && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-4 overflow-hidden"
                    >
                      <Textarea
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        placeholder="Was muss geändert werden?"
                        className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30 resize-none min-h-[100px]"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </AnimatePresence>

            {/* Actions */}
            <div className="sticky bottom-0 pt-4 pb-4 bg-gradient-to-t from-[#111115] via-[#111115] to-transparent">
              {showFeedback ? (
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowFeedback(false);
                      setFeedbackText("");
                    }}
                    className="flex-1 bg-white/[0.04] hover:bg-white/[0.08] text-white"
                  >
                    Abbrechen
                  </Button>
                  <Button
                    onClick={handleSendBack}
                    disabled={isCurrentLoading || !feedbackText.trim()}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-black gap-1.5"
                  >
                    {isCurrentLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Zurück senden
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    onClick={() => setShowFeedback(true)}
                    variant="ghost"
                    disabled={isCurrentLoading}
                    className="flex-1 bg-white/[0.04] hover:bg-white/[0.08] text-white gap-1.5"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Änderung
                  </Button>
                  <Button
                    onClick={handleApprove}
                    disabled={isCurrentLoading}
                    className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white gap-1.5"
                  >
                    {isCurrentLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Freigeben & an Kunde
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
