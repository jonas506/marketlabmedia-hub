import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  format,
  addDays,
  subDays,
  isSameDay,
  isToday,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addWeeks,
  isSameMonth,
} from "date-fns";
import { de } from "date-fns/locale";
import {
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Film,
  Images,
  Smartphone,
  Megaphone,
  Youtube,
  FileText,
  X,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

interface ScheduledPiece {
  id: string;
  title: string | null;
  type: string;
  phase: string;
  client_id: string;
  client_name: string;
  scheduled_post_date: string;
  logo_url: string | null;
  preview_link: string | null;
  slide_images: string[] | null;
  caption: string | null;
}

const TYPE_ICON: Record<string, React.ComponentType<any>> = {
  reel: Film,
  carousel: Images,
  story: Smartphone,
  ad: Megaphone,
  youtube_longform: Youtube,
};

const TYPE_LABELS: Record<string, string> = {
  reel: "Reel",
  carousel: "Karussell",
  story: "Story",
  ad: "Ad",
  youtube_longform: "YouTube",
};

const PHASE_LABELS: Record<string, string> = {
  script: "Skript",
  filmed: "Gedreht",
  editing: "Schnitt",
  feedback: "Feedback",
  review: "Freigabe",
  approved: "Freigegeben",
  handed_over: "Geplant",
};

// Curated color palette for clients (dark-mode friendly)
const CLIENT_COLORS = [
  { bg: "bg-blue-500/15", border: "border-blue-500/30", text: "text-blue-400", dot: "bg-blue-400" },
  { bg: "bg-emerald-500/15", border: "border-emerald-500/30", text: "text-emerald-400", dot: "bg-emerald-400" },
  { bg: "bg-violet-500/15", border: "border-violet-500/30", text: "text-violet-400", dot: "bg-violet-400" },
  { bg: "bg-amber-500/15", border: "border-amber-500/30", text: "text-amber-400", dot: "bg-amber-400" },
  { bg: "bg-pink-500/15", border: "border-pink-500/30", text: "text-pink-400", dot: "bg-pink-400" },
  { bg: "bg-cyan-500/15", border: "border-cyan-500/30", text: "text-cyan-400", dot: "bg-cyan-400" },
  { bg: "bg-orange-500/15", border: "border-orange-500/30", text: "text-orange-400", dot: "bg-orange-400" },
  { bg: "bg-rose-500/15", border: "border-rose-500/30", text: "text-rose-400", dot: "bg-rose-400" },
  { bg: "bg-teal-500/15", border: "border-teal-500/30", text: "text-teal-400", dot: "bg-teal-400" },
  { bg: "bg-indigo-500/15", border: "border-indigo-500/30", text: "text-indigo-400", dot: "bg-indigo-400" },
];

function getClientColor(clientId: string) {
  let hash = 0;
  for (let i = 0; i < clientId.length; i++) {
    hash = clientId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CLIENT_COLORS[Math.abs(hash) % CLIENT_COLORS.length];
}

interface PostingCalendarProps {
  filterUserId?: string;
}

export default function PostingCalendar({ filterUserId }: PostingCalendarProps = {}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedPiece, setSelectedPiece] = useState<ScheduledPiece | null>(null);
  const [activeClientFilter, setActiveClientFilter] = useState<string | null>(null);

  const baseMonday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const currentMonday = weekOffset === 0 ? baseMonday : addWeeks(baseMonday, weekOffset);

  const rangeStart = subDays(currentMonday, 7);
  const rangeEnd = addDays(currentMonday, 42);

  const { data: pieces, isLoading } = useQuery({
    queryKey: ["posting-calendar-v2", filterUserId, format(rangeStart, "yyyy-MM-dd")],
    queryFn: async (): Promise<ScheduledPiece[]> => {
      let query = supabase
        .from("content_pieces")
        .select("id, title, type, phase, client_id, scheduled_post_date, assigned_to, preview_link, slide_images, caption")
        .not("scheduled_post_date", "is", null)
        .gte("scheduled_post_date", format(rangeStart, "yyyy-MM-dd"))
        .lte("scheduled_post_date", format(rangeEnd, "yyyy-MM-dd"))
        .order("scheduled_post_date", { ascending: true });
      if (filterUserId) {
        query = query.eq("assigned_to", filterUserId);
      }
      const { data, error } = await query;
      if (error) throw error;

      const clientIds = [...new Set((data || []).map((p) => p.client_id))];
      if (clientIds.length === 0) return [];

      const { data: clients } = await supabase
        .from("clients")
        .select("id, name, logo_url")
        .in("id", clientIds);

      const clientMap = new Map(
        (clients || []).map((c) => [c.id, { name: c.name, logo_url: c.logo_url }])
      );

      return (data || []).map((p) => ({
        ...p,
        client_name: clientMap.get(p.client_id)?.name || "—",
        logo_url: clientMap.get(p.client_id)?.logo_url || null,
        scheduled_post_date: p.scheduled_post_date!,
      }));
    },
  });

  const weeks = useMemo(() => {
    const result: Date[][] = [];
    for (let w = 0; w < 4; w++) {
      const monday = addWeeks(currentMonday, w);
      result.push(
        eachDayOfInterval({
          start: monday,
          end: endOfWeek(monday, { weekStartsOn: 1 }),
        })
      );
    }
    return result;
  }, [currentMonday]);

  const filteredPieces = useMemo(() => {
    if (!activeClientFilter) return pieces || [];
    return (pieces || []).filter((p) => p.client_id === activeClientFilter);
  }, [pieces, activeClientFilter]);

  const getPiecesForDay = (day: Date) =>
    filteredPieces.filter((p) => isSameDay(new Date(p.scheduled_post_date), day));

  const clientStats = useMemo(() => {
    if (!pieces?.length) return [];
    const map = new Map<string, { name: string; count: number; logo_url: string | null; client_id: string }>();
    for (const p of pieces) {
      const existing = map.get(p.client_id);
      if (existing) {
        existing.count++;
      } else {
        map.set(p.client_id, { name: p.client_name, count: 1, logo_url: p.logo_url, client_id: p.client_id });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [pieces]);

  const weekdayHeaders = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const currentMonth = format(currentMonday, "MMMM yyyy", { locale: de });

  const previewLinks = selectedPiece?.preview_link
    ? selectedPiece.preview_link.split("\n").filter((l) => l.trim())
    : [];

  return (
    <div className="flex gap-4">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "rounded-lg border border-border bg-card overflow-hidden transition-all flex-1",
          selectedPiece && "max-w-[calc(100%-340px)]"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <CalendarIcon className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Posting-Kalender</h2>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWeekOffset((w) => w - 4)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button
              onClick={() => setWeekOffset(0)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50"
            >
              {weekOffset === 0 ? "Heute" : currentMonth}
            </button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWeekOffset((w) => w + 4)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded bg-muted/40" />
            ))}
          </div>
        ) : (
          <>
            {/* Client filter chips */}
            {clientStats.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-4 py-2.5 border-b border-border">
                <button
                  onClick={() => setActiveClientFilter(null)}
                  className={cn(
                    "inline-flex items-center gap-1.5 text-[11px] rounded-full px-2.5 py-1 transition-all border",
                    !activeClientFilter
                      ? "bg-primary/15 border-primary/30 text-primary font-medium"
                      : "bg-muted/30 border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  Alle
                </button>
                {clientStats.map((c) => {
                  const color = getClientColor(c.client_id);
                  const isActive = activeClientFilter === c.client_id;
                  return (
                    <button
                      key={c.client_id}
                      onClick={() => setActiveClientFilter(isActive ? null : c.client_id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 text-[11px] rounded-full px-2.5 py-1 transition-all border",
                        isActive
                          ? `${color.bg} ${color.border} ${color.text} font-medium`
                          : "bg-muted/30 border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      {c.logo_url && (
                        <img src={c.logo_url} alt="" className="h-3.5 w-3.5 rounded-full object-cover" />
                      )}
                      <span className="truncate max-w-[100px]">{c.name}</span>
                      <span className="opacity-50">{c.count}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Calendar grid */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[600px]">
                <thead>
                  <tr>
                    {weekdayHeaders.map((d) => (
                      <th
                        key={d}
                        className="text-[10px] uppercase tracking-wider text-muted-foreground py-2 text-center w-[14.28%] border-b border-border font-medium"
                      >
                        {d}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((week, wi) => (
                    <tr key={wi}>
                      {week.map((day) => {
                        const dayPieces = getPiecesForDay(day);
                        const today = isToday(day);
                        const thisMonth = isSameMonth(day, currentMonday);

                        return (
                          <td
                            key={day.toISOString()}
                            className={cn(
                              "border border-border align-top p-1.5 h-[100px] transition-colors relative",
                              today && "bg-primary/5 ring-1 ring-inset ring-primary/20",
                              !thisMonth && "opacity-30"
                            )}
                          >
                            <div
                              className={cn(
                                "text-[11px] font-medium mb-1",
                                today ? "text-primary" : "text-muted-foreground/70"
                              )}
                            >
                              {format(day, "d")}
                            </div>
                            <div className="space-y-0.5">
                              {dayPieces.slice(0, 3).map((piece) => {
                                const color = getClientColor(piece.client_id);
                                const Icon = TYPE_ICON[piece.type] || FileText;
                                const isSelected = selectedPiece?.id === piece.id;
                                return (
                                  <button
                                    key={piece.id}
                                    onClick={() => setSelectedPiece(isSelected ? null : piece)}
                                    className={cn(
                                      "flex items-center gap-1 w-full text-[10px] rounded px-1.5 py-0.5 truncate transition-all border text-left",
                                      color.bg, color.border, color.text,
                                      isSelected && "ring-1 ring-primary scale-[1.02]",
                                      "hover:brightness-125"
                                    )}
                                  >
                                    <Icon className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{piece.client_name}</span>
                                  </button>
                                );
                              })}
                              {dayPieces.length > 3 && (
                                <div className="text-[9px] text-muted-foreground/60 pl-1">
                                  +{dayPieces.length - 3} weitere
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </motion.div>

      {/* Detail / Preview Panel */}
      <AnimatePresence>
        {selectedPiece && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="w-[320px] shrink-0 rounded-lg border border-border bg-card overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2 min-w-0">
                {selectedPiece.logo_url && (
                  <img src={selectedPiece.logo_url} alt="" className="h-6 w-6 rounded-full object-cover shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{selectedPiece.client_name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {TYPE_LABELS[selectedPiece.type] || selectedPiece.type}
                    {selectedPiece.title ? ` · ${selectedPiece.title}` : ""}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setSelectedPiece(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-4 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
              {/* Meta info */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-muted/30 px-3 py-2">
                  <p className="text-muted-foreground text-[10px]">Datum</p>
                  <p className="font-medium">
                    {format(new Date(selectedPiece.scheduled_post_date), "dd. MMM yyyy", { locale: de })}
                  </p>
                </div>
                <div className="rounded-md bg-muted/30 px-3 py-2">
                  <p className="text-muted-foreground text-[10px]">Phase</p>
                  <p className="font-medium">{PHASE_LABELS[selectedPiece.phase] || selectedPiece.phase}</p>
                </div>
              </div>

              {/* Preview: slide images for carousels */}
              {selectedPiece.type === "carousel" && selectedPiece.slide_images && selectedPiece.slide_images.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Slides</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {selectedPiece.slide_images.map((src, i) => (
                      <a
                        key={i}
                        href={src}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-md overflow-hidden border border-border hover:border-primary/50 transition-colors"
                      >
                        <img src={src} alt={`Slide ${i + 1}`} className="w-full aspect-[4/5] object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview links for reels/videos */}
              {previewLinks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Vorschau</p>
                  <div className="space-y-1.5">
                    {previewLinks.map((link, i) => (
                      <a
                        key={i}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs rounded-md bg-muted/30 px-3 py-2.5 text-primary hover:bg-muted/50 transition-colors border border-border"
                      >
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{previewLinks.length > 1 ? `Variante ${i + 1}` : "Vorschau öffnen"}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Caption */}
              {selectedPiece.caption && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Caption</p>
                  <p className="text-xs text-foreground/80 whitespace-pre-line bg-muted/20 rounded-md px-3 py-2 border border-border max-h-32 overflow-y-auto">
                    {selectedPiece.caption}
                  </p>
                </div>
              )}

              {/* No preview available */}
              {previewLinks.length === 0 &&
                !(selectedPiece.type === "carousel" && selectedPiece.slide_images?.length) &&
                !selectedPiece.caption && (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50">
                    <FileText className="h-8 w-8 mb-2" />
                    <p className="text-xs">Keine Vorschau verfügbar</p>
                  </div>
                )}

              {/* Link to client */}
              <Link
                to={`/client/${selectedPiece.client_id}`}
                className="flex items-center justify-center gap-2 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/15 border border-primary/20 rounded-md px-3 py-2.5 transition-colors w-full"
              >
                Zum Kunden →
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
