import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { format, addDays, isSameDay, isToday, startOfDay } from "date-fns";
import { de } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

interface ScheduledPiece {
  id: string;
  title: string | null;
  type: string;
  phase: string;
  client_id: string;
  client_name: string;
  scheduled_post_date: string;
}

const TYPE_EMOJI: Record<string, string> = {
  reel: "🎬",
  carousel: "📸",
  story: "📱",
  ad: "📢",
  youtube_longform: "🎥",
};

const TYPE_COLOR: Record<string, string> = {
  reel: "bg-primary/15 text-primary border-primary/20",
  carousel: "bg-violet-500/15 text-violet-400 border-violet-500/20",
  story: "bg-pink-500/15 text-pink-400 border-pink-500/20",
  ad: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  youtube_longform: "bg-red-500/15 text-red-400 border-red-500/20",
};

interface PostingCalendarProps {
  filterUserId?: string;
}

export default function PostingCalendar({ filterUserId }: PostingCalendarProps = {}) {
  const today = startOfDay(new Date());
  const endDate = addDays(today, 30);

  const { data: pieces, isLoading } = useQuery({
    queryKey: ["posting-calendar", filterUserId],
    queryFn: async (): Promise<ScheduledPiece[]> => {
      let query = supabase
        .from("content_pieces")
        .select("id, title, type, phase, client_id, scheduled_post_date, assigned_to")
        .not("scheduled_post_date", "is", null)
        .gte("scheduled_post_date", format(today, "yyyy-MM-dd"))
        .lte("scheduled_post_date", format(endDate, "yyyy-MM-dd"))
        .order("scheduled_post_date", { ascending: true });
      if (filterUserId) {
        query = query.eq("assigned_to", filterUserId);
      }
      const { data, error } = await query;
      if (error) throw error;

      // Fetch client names
      const clientIds = [...new Set((data || []).map((p) => p.client_id))];
      if (clientIds.length === 0) return [];

      const { data: clients } = await supabase
        .from("clients")
        .select("id, name")
        .in("id", clientIds);

      const clientMap = new Map((clients || []).map((c) => [c.id, c.name]));

      return (data || []).map((p) => ({
        ...p,
        client_name: clientMap.get(p.client_id) || "—",
        scheduled_post_date: p.scheduled_post_date!,
      }));
    },
  });

  // Group by day
  const days = useMemo(() => {
    const result: { date: Date; pieces: ScheduledPiece[] }[] = [];
    for (let i = 0; i <= 30; i++) {
      const day = addDays(today, i);
      const dayPieces = (pieces || []).filter((p) =>
        isSameDay(new Date(p.scheduled_post_date), day)
      );
      // Only show days that have content or are today/tomorrow/in next 7 days
      if (dayPieces.length > 0 || i < 7) {
        result.push({ date: day, pieces: dayPieces });
      }
    }
    return result;
  }, [pieces, today]);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <CalendarIcon className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-display font-bold">Posting-Kalender</h2>
        </div>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-muted/40" />
          ))}
        </div>
      </div>
    );
  }

  const totalScheduled = (pieces || []).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-border bg-card overflow-hidden"
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-surface-elevated">
        <CalendarIcon className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-display font-bold">Posting-Kalender</h2>
        <span className="ml-auto text-[10px] font-mono text-muted-foreground">
          Nächste 30 Tage · {totalScheduled} Posts geplant
        </span>
      </div>

      <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
        {days.map(({ date, pieces: dayPieces }) => {
          const isCurrentDay = isToday(date);
          const dayName = format(date, "EEE", { locale: de });
          const dayNum = format(date, "d");
          const monthName = format(date, "MMM", { locale: de });

          return (
            <div
              key={date.toISOString()}
              className={cn(
                "flex items-start gap-3 px-4 py-2.5 transition-colors",
                isCurrentDay && "bg-primary/5",
                dayPieces.length === 0 && "opacity-50"
              )}
            >
              {/* Date column */}
              <div className={cn(
                "flex flex-col items-center w-12 shrink-0 pt-0.5",
                isCurrentDay && "text-primary"
              )}>
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  {dayName}
                </span>
                <span className={cn(
                  "text-lg font-display font-bold leading-none",
                  isCurrentDay && "text-primary"
                )}>
                  {dayNum}
                </span>
                <span className="text-[9px] font-mono text-muted-foreground">
                  {monthName}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {dayPieces.length === 0 ? (
                  <span className="text-[11px] text-muted-foreground/50 font-mono italic">
                    {isCurrentDay ? "Heute keine Posts" : "—"}
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {dayPieces.map((piece) => (
                      <Link
                        key={piece.id}
                        to={`/client/${piece.client_id}`}
                        className={cn(
                          "inline-flex items-center gap-1.5 text-[11px] font-mono rounded-md border px-2 py-1 transition-all hover:scale-105",
                          TYPE_COLOR[piece.type] || "bg-muted/40 text-foreground border-border"
                        )}
                      >
                        <span>{TYPE_EMOJI[piece.type] || "📄"}</span>
                        <span className="truncate max-w-[120px]">
                          {piece.title || piece.client_name}
                        </span>
                        <span className="text-[9px] opacity-60 hidden sm:inline">
                          {piece.client_name}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
