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
  LayoutGrid,
  Rows3,
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

const TYPE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  reel: { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/30" },
  carousel: { bg: "bg-violet-500/20", text: "text-violet-400", border: "border-violet-500/30" },
  story: { bg: "bg-pink-500/20", text: "text-pink-400", border: "border-pink-500/30" },
  ad: { bg: "bg-amber-500/20", text: "text-amber-400", border: "border-amber-500/30" },
  youtube_longform: { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/30" },
};

const CLIENT_COLORS = [
  { bg: "bg-blue-500/15", border: "border-blue-500/30", text: "text-blue-400" },
  { bg: "bg-emerald-500/15", border: "border-emerald-500/30", text: "text-emerald-400" },
  { bg: "bg-violet-500/15", border: "border-violet-500/30", text: "text-violet-400" },
  { bg: "bg-amber-500/15", border: "border-amber-500/30", text: "text-amber-400" },
  { bg: "bg-pink-500/15", border: "border-pink-500/30", text: "text-pink-400" },
  { bg: "bg-cyan-500/15", border: "border-cyan-500/30", text: "text-cyan-400" },
  { bg: "bg-orange-500/15", border: "border-orange-500/30", text: "text-orange-400" },
  { bg: "bg-rose-500/15", border: "border-rose-500/30", text: "text-rose-400" },
  { bg: "bg-teal-500/15", border: "border-teal-500/30", text: "text-teal-400" },
  { bg: "bg-indigo-500/15", border: "border-indigo-500/30", text: "text-indigo-400" },
];

function getClientColor(clientId: string) {
  let hash = 0;
  for (let i = 0; i < clientId.length; i++) hash = clientId.charCodeAt(i) + ((hash << 5) - hash);
  return CLIENT_COLORS[Math.abs(hash) % CLIENT_COLORS.length];
}

type ViewMode = "calendar" | "timeline";

interface PostingCalendarProps {
  filterUserId?: string;
}

export default function PostingCalendar({ filterUserId }: PostingCalendarProps = {}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedPiece, setSelectedPiece] = useState<ScheduledPiece | null>(null);
  const [activeClientFilter, setActiveClientFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");

  const baseMonday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const currentMonday = weekOffset === 0 ? baseMonday : addWeeks(baseMonday, weekOffset);

  const rangeStart = subDays(currentMonday, 7);
  const rangeEnd = addDays(currentMonday, 35);

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
      if (filterUserId) query = query.eq("assigned_to", filterUserId);
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

  // Calendar grid: 4 weeks
  const weeks = useMemo(() => {
    const result: Date[][] = [];
    for (let w = 0; w < 4; w++) {
      const monday = addWeeks(currentMonday, w);
      result.push(eachDayOfInterval({ start: monday, end: endOfWeek(monday, { weekStartsOn: 1 }) }));
    }
    return result;
  }, [currentMonday]);

  // Timeline: 28 days flat
  const timelineDays = useMemo(
    () => eachDayOfInterval({ start: currentMonday, end: addDays(currentMonday, 27) }),
    [currentMonday]
  );

  const filteredPieces = useMemo(() => {
    if (!activeClientFilter) return pieces || [];
    return (pieces || []).filter((p) => p.client_id === activeClientFilter);
  }, [pieces, activeClientFilter]);

  const clientStats = useMemo(() => {
    if (!pieces?.length) return [];
    const map = new Map<string, { name: string; count: number; logo_url: string | null; client_id: string }>();
    for (const p of pieces) {
      const existing = map.get(p.client_id);
      if (existing) existing.count++;
      else map.set(p.client_id, { name: p.client_name, count: 1, logo_url: p.logo_url, client_id: p.client_id });
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [pieces]);

  const clientRows = useMemo(() => {
    if (!filteredPieces.length) return [];
    const map = new Map<string, { name: string; logo_url: string | null; client_id: string; pieces: ScheduledPiece[] }>();
    for (const p of filteredPieces) {
      const existing = map.get(p.client_id);
      if (existing) existing.pieces.push(p);
      else map.set(p.client_id, { name: p.client_name, logo_url: p.logo_url, client_id: p.client_id, pieces: [p] });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredPieces]);

  const getPiecesForDay = (day: Date) =>
    filteredPieces.filter((p) => isSameDay(new Date(p.scheduled_post_date), day));

  const currentMonth = format(currentMonday, "MMMM yyyy", { locale: de });
  const weekdayHeaders = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const weekStarts = new Set([0, 7, 14, 21]);

  const previewLinks = selectedPiece?.preview_link
    ? selectedPiece.preview_link.split("\n").filter((l) => l.trim())
    : [];

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border border-border bg-card overflow-hidden flex-1 min-w-0"
      >
        {/* Header */}
        <div className="flex flex-wrap items-center gap-2 px-3 py-3 sm:px-4 border-b border-border">
          <CalendarIcon className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Posting-Kalender</h2>

          {/* View toggle */}
          <div className="order-3 flex w-full items-center rounded-md border border-border overflow-hidden sm:order-none sm:ml-3 sm:w-auto">
            <button
              onClick={() => setViewMode("calendar")}
              className={cn(
                "flex min-h-[44px] flex-1 items-center justify-center gap-1 px-3 py-2 text-xs transition-colors sm:min-h-0 sm:flex-none sm:px-2 sm:py-1 sm:text-[10px]",
                viewMode === "calendar"
                  ? "bg-primary/15 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              )}
            >
              <LayoutGrid className="h-3 w-3" />
              Kalender
            </button>
            <button
              onClick={() => setViewMode("timeline")}
              className={cn(
                "flex min-h-[44px] flex-1 items-center justify-center gap-1 px-3 py-2 text-xs border-l border-border transition-colors sm:min-h-0 sm:flex-none sm:px-2 sm:py-1 sm:text-[10px]",
                viewMode === "timeline"
                  ? "bg-primary/15 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              )}
            >
              <Rows3 className="h-3 w-3" />
              Kunden
            </button>
          </div>

          {/* Type legend (timeline only) */}
          {viewMode === "timeline" && (
            <div className="hidden sm:flex items-center gap-3 ml-3">
              {Object.entries(TYPE_STYLES).map(([type, style]) => {
                const Icon = TYPE_ICON[type];
                return (
                  <div key={type} className={cn("flex items-center gap-1 text-[10px]", style.text)}>
                    <Icon className="h-3 w-3" />
                    <span>{TYPE_LABELS[type]}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-7 sm:w-7 sm:min-h-7" onClick={() => setWeekOffset((w) => w - 4)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button
              onClick={() => setWeekOffset(0)}
              className="min-h-[44px] text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50 sm:min-h-0"
            >
              {weekOffset === 0 ? "Heute" : currentMonth}
            </button>
            <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-7 sm:w-7 sm:min-h-7" onClick={() => setWeekOffset((w) => w + 4)}>
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
            {/* Client filter chips (calendar view) */}
            {viewMode === "calendar" && clientStats.length > 0 && (
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
                      {c.logo_url && <img src={c.logo_url} alt="" className="h-3.5 w-3.5 rounded-full object-cover" />}
                      <span className="truncate max-w-[100px]">{c.name}</span>
                      <span className="opacity-50">{c.count}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* ===== CALENDAR VIEW ===== */}
            {viewMode === "calendar" && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[600px]">
                  <thead>
                    <tr>
                      {weekdayHeaders.map((d) => (
                        <th key={d} className="text-[10px] uppercase tracking-wider text-muted-foreground py-2 text-center w-[14.28%] border-b border-border font-medium">
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
                              <div className={cn("text-[11px] font-medium mb-1", today ? "text-primary" : "text-muted-foreground/70")}>
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
                                  <div className="text-[9px] text-muted-foreground/60 pl-1">+{dayPieces.length - 3} weitere</div>
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
            )}

            {/* ===== TIMELINE / SWIMLANE VIEW ===== */}
            {viewMode === "timeline" && (
              clientRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/50">
                  <CalendarIcon className="h-10 w-10 mb-3" />
                  <p className="text-sm">Keine geplanten Posts in diesem Zeitraum</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse" style={{ minWidth: `${180 + timelineDays.length * 36}px` }}>
                    <thead>
                      <tr>
                        <th className="sticky left-0 z-10 bg-card w-[180px] min-w-[180px] border-b border-r border-border" />
                        {timelineDays.map((day, i) => {
                          const today = isToday(day);
                          const isWeekStart = weekStarts.has(i) && i > 0;
                          return (
                            <th
                              key={day.toISOString()}
                              className={cn(
                                "text-center border-b border-border px-0 py-1.5 w-9 min-w-[36px]",
                                isWeekStart && "border-l-2 border-l-border",
                                today && "bg-primary/8"
                              )}
                            >
                              <div className={cn("text-[9px] uppercase tracking-wider", today ? "text-primary font-semibold" : "text-muted-foreground/60")}>
                                {format(day, "EE", { locale: de }).slice(0, 2)}
                              </div>
                              <div className={cn("text-[11px] font-medium leading-none mt-0.5", today ? "text-primary" : "text-muted-foreground/80")}>
                                {format(day, "d")}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {clientRows.map((client) => (
                        <tr key={client.client_id} className="group hover:bg-muted/10 transition-colors">
                          <td className="sticky left-0 z-10 bg-card group-hover:bg-muted/10 transition-colors border-b border-r border-border px-3 py-2">
                            <Link to={`/client/${client.client_id}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                              {client.logo_url ? (
                                <img src={client.logo_url} alt="" className="h-6 w-6 rounded-full object-cover shrink-0 border border-border" />
                              ) : (
                                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                                  {client.name.charAt(0)}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-xs font-medium truncate max-w-[120px]">{client.name}</p>
                                <p className="text-[9px] text-muted-foreground">{client.pieces.length} Post{client.pieces.length !== 1 ? "s" : ""}</p>
                              </div>
                            </Link>
                          </td>
                          {timelineDays.map((day, i) => {
                            const dayPieces = client.pieces.filter((p) => isSameDay(new Date(p.scheduled_post_date), day));
                            const today = isToday(day);
                            const isWeekStart = weekStarts.has(i) && i > 0;
                            return (
                              <td key={day.toISOString()} className={cn("border-b border-border text-center px-0 py-1", isWeekStart && "border-l-2 border-l-border", today && "bg-primary/5")}>
                                {dayPieces.length > 0 && (
                                  <div className="flex flex-col items-center gap-0.5">
                                    {dayPieces.map((piece) => {
                                      const style = TYPE_STYLES[piece.type] || TYPE_STYLES.reel;
                                      const Icon = TYPE_ICON[piece.type] || FileText;
                                      const isSelected = selectedPiece?.id === piece.id;
                                      return (
                                        <button
                                          key={piece.id}
                                          onClick={() => setSelectedPiece(isSelected ? null : piece)}
                                          className={cn(
                                            "h-6 w-6 rounded-md flex items-center justify-center transition-all border",
                                            style.bg, style.text, style.border,
                                            isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-card scale-110",
                                            "hover:scale-110 hover:brightness-125"
                                          )}
                                          title={`${TYPE_LABELS[piece.type]} · ${piece.title || "Ohne Titel"}`}
                                        >
                                          <Icon className="h-3 w-3" />
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </>
        )}
      </motion.div>

      {/* Detail Panel */}
      <AnimatePresence>
        {selectedPiece && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="w-[320px] shrink-0 rounded-lg border border-border bg-card overflow-hidden self-start sticky top-6"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2 min-w-0">
                {selectedPiece.logo_url && <img src={selectedPiece.logo_url} alt="" className="h-6 w-6 rounded-full object-cover shrink-0" />}
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
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-muted/30 px-3 py-2">
                  <p className="text-muted-foreground text-[10px]">Datum</p>
                  <p className="font-medium">{format(new Date(selectedPiece.scheduled_post_date), "dd. MMM yyyy", { locale: de })}</p>
                </div>
                <div className="rounded-md bg-muted/30 px-3 py-2">
                  <p className="text-muted-foreground text-[10px]">Phase</p>
                  <p className="font-medium">{PHASE_LABELS[selectedPiece.phase] || selectedPiece.phase}</p>
                </div>
              </div>

              {selectedPiece.type === "carousel" && selectedPiece.slide_images && selectedPiece.slide_images.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Slides</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {selectedPiece.slide_images.map((src, i) => (
                      <a key={i} href={src} target="_blank" rel="noopener noreferrer" className="block rounded-md overflow-hidden border border-border hover:border-primary/50 transition-colors">
                        <img src={src} alt={`Slide ${i + 1}`} className="w-full aspect-[4/5] object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {previewLinks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Vorschau</p>
                  <div className="space-y-1.5">
                    {previewLinks.map((link, i) => (
                      <a key={i} href={link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs rounded-md bg-muted/30 px-3 py-2.5 text-primary hover:bg-muted/50 transition-colors border border-border">
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{previewLinks.length > 1 ? `Variante ${i + 1}` : "Vorschau öffnen"}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {selectedPiece.caption && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Caption</p>
                  <p className="text-xs text-foreground/80 whitespace-pre-line bg-muted/20 rounded-md px-3 py-2 border border-border max-h-32 overflow-y-auto">
                    {selectedPiece.caption}
                  </p>
                </div>
              )}

              {previewLinks.length === 0 && !(selectedPiece.type === "carousel" && selectedPiece.slide_images?.length) && !selectedPiece.caption && (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50">
                  <FileText className="h-8 w-8 mb-2" />
                  <p className="text-xs">Keine Vorschau verfügbar</p>
                </div>
              )}

              <Link to={`/client/${selectedPiece.client_id}`} className="flex items-center justify-center gap-2 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/15 border border-primary/20 rounded-md px-3 py-2.5 transition-colors w-full">
                Zum Kunden →
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
