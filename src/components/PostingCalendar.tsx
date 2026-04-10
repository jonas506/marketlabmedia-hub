import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  format,
  addDays,
  subDays,
  isSameDay,
  isToday,
  startOfDay,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addWeeks,
  subWeeks,
  isSameMonth,
} from "date-fns";
import { de } from "date-fns/locale";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

interface ScheduledPiece {
  id: string;
  title: string | null;
  type: string;
  phase: string;
  client_id: string;
  client_name: string;
  scheduled_post_date: string;
  logo_url: string | null;
}

const TYPE_EMOJI: Record<string, string> = {
  reel: "🎬",
  carousel: "📸",
  story: "📱",
  ad: "📢",
  youtube_longform: "🎥",
};

const TYPE_LABELS: Record<string, string> = {
  reel: "Reel",
  carousel: "Karussell",
  story: "Story",
  ad: "Ad",
  youtube_longform: "YouTube",
};

// Deterministic color for each client (hue from name hash)
function clientHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

interface PostingCalendarProps {
  filterUserId?: string;
}

export default function PostingCalendar({ filterUserId }: PostingCalendarProps = {}) {
  const [weekOffset, setWeekOffset] = useState(0);

  const baseMonday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const currentMonday = weekOffset === 0 ? baseMonday : addWeeks(baseMonday, weekOffset);
  const weekDays = eachDayOfInterval({
    start: currentMonday,
    end: endOfWeek(currentMonday, { weekStartsOn: 1 }),
  });

  // Fetch 6 weeks of data around the view
  const rangeStart = subDays(currentMonday, 7);
  const rangeEnd = addDays(currentMonday, 42);

  const { data: pieces, isLoading } = useQuery({
    queryKey: ["posting-calendar-v2", filterUserId, format(rangeStart, "yyyy-MM-dd")],
    queryFn: async (): Promise<ScheduledPiece[]> => {
      let query = supabase
        .from("content_pieces")
        .select("id, title, type, phase, client_id, scheduled_post_date, assigned_to")
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

  // 4-week grid
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

  const getPiecesForDay = (day: Date) =>
    (pieces || []).filter((p) => isSameDay(new Date(p.scheduled_post_date), day));

  // Client stats: group all visible pieces by client
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

  return (
    <TooltipProvider delayDuration={200}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border border-border bg-card overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-surface-elevated">
          <CalendarIcon className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-display font-bold">Posting-Kalender</h2>
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setWeekOffset((w) => w - 4)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button
              onClick={() => setWeekOffset(0)}
              className="text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors px-2"
            >
              {weekOffset === 0 ? "Heute" : currentMonth}
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setWeekOffset((w) => w + 4)}
            >
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
            {/* Client legend */}
            {clientStats.length > 0 && (
              <div className="flex flex-wrap gap-2 px-4 py-2.5 border-b border-border bg-muted/20">
                {clientStats.map((c) => {
                  const hue = clientHue(c.name);
                  return (
                    <Link
                      key={c.client_id}
                      to={`/client/${c.client_id}`}
                      className="inline-flex items-center gap-1.5 text-[11px] font-mono rounded-full px-2.5 py-1 transition-all hover:scale-105 border"
                      style={{
                        backgroundColor: `hsl(${hue} 60% 95%)`,
                        borderColor: `hsl(${hue} 50% 75%)`,
                        color: `hsl(${hue} 50% 30%)`,
                      }}
                    >
                      {c.logo_url && (
                        <img
                          src={c.logo_url}
                          alt=""
                          className="h-3.5 w-3.5 rounded-full object-cover"
                        />
                      )}
                      <span className="truncate max-w-[100px]">{c.name}</span>
                      <span className="opacity-60">{c.count}</span>
                    </Link>
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
                        className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground py-2 text-center w-[14.28%] border-b border-border"
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
                              "border border-border align-top p-1.5 h-24 transition-colors relative",
                              today && "bg-primary/5 ring-1 ring-inset ring-primary/30",
                              !thisMonth && "opacity-40"
                            )}
                          >
                            <div
                              className={cn(
                                "text-[11px] font-mono font-bold mb-1",
                                today ? "text-primary" : "text-muted-foreground"
                              )}
                            >
                              {format(day, "d")}
                            </div>
                            <div className="space-y-0.5">
                              {dayPieces.slice(0, 3).map((piece) => {
                                const hue = clientHue(piece.client_name);
                                return (
                                  <Tooltip key={piece.id}>
                                    <TooltipTrigger asChild>
                                      <Link
                                        to={`/client/${piece.client_id}`}
                                        className="flex items-center gap-1 text-[10px] font-mono rounded px-1.5 py-0.5 truncate transition-all hover:scale-[1.03] border"
                                        style={{
                                          backgroundColor: `hsl(${hue} 55% 93%)`,
                                          borderColor: `hsl(${hue} 45% 80%)`,
                                          color: `hsl(${hue} 50% 28%)`,
                                        }}
                                      >
                                        <span className="shrink-0">
                                          {TYPE_EMOJI[piece.type] || "📄"}
                                        </span>
                                        <span className="truncate">
                                          {piece.client_name}
                                        </span>
                                      </Link>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="text-xs max-w-[200px]">
                                      <div className="font-semibold">
                                        {piece.client_name}
                                      </div>
                                      <div className="text-muted-foreground">
                                        {TYPE_LABELS[piece.type] || piece.type}
                                        {piece.title ? ` · ${piece.title}` : ""}
                                      </div>
                                      <div className="text-muted-foreground capitalize">
                                        Phase: {piece.phase}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              })}
                              {dayPieces.length > 3 && (
                                <div className="text-[9px] font-mono text-muted-foreground pl-1">
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
    </TooltipProvider>
  );
}
