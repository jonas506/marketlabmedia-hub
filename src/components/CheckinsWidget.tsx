import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircleHeart, ArrowRight } from "lucide-react";
import { WEEK_CONFIGS, getCurrentWeekFocus, getISOWeek } from "@/lib/checkin-constants";
import { cn } from "@/lib/utils";

export default function CheckinsWidget() {
  const focus = getCurrentWeekFocus();
  const { week, year } = getISOWeek(new Date());
  const cfg = WEEK_CONFIGS[focus];

  const { data } = useQuery({
    queryKey: ["checkins-widget", week, year],
    queryFn: async () => {
      const [clientsRes, checkinsRes] = await Promise.all([
        supabase.from("clients").select("id,name").neq("status", "archived"),
        supabase
          .from("client_checkins")
          .select("client_id")
          .eq("calendar_week", week)
          .eq("year", year),
      ]);
      const done = new Set((checkinsRes.data ?? []).map((c: any) => c.client_id));
      const missing = (clientsRes.data ?? []).filter((c: any) => !done.has(c.id));
      return { total: clientsRes.data?.length ?? 0, done: done.size, missing };
    },
    staleTime: 60_000,
  });

  const total = data?.total ?? 0;
  const done = data?.done ?? 0;
  const missing = data?.missing ?? [];

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center border", cfg.accent)}>
            <MessageCircleHeart className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium font-heading">Kunden-Check-ins</p>
            <p className="text-xs text-muted-foreground">
              KW {week} · {cfg.badge} · {cfg.title}
            </p>
          </div>
        </div>
        <Link to="/checkins">
          <Button variant="ghost" size="sm" className="gap-1 text-xs">
            Alle <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4 mb-3">
        <div>
          <p className="text-2xl font-semibold font-heading">{done}/{total}</p>
          <p className="text-xs text-muted-foreground">diese Woche erledigt</p>
        </div>
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: total ? `${(done / total) * 100}%` : "0%" }}
          />
        </div>
      </div>

      {missing.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {missing.slice(0, 6).map((c: any) => (
            <Link
              key={c.id}
              to={`/client/${c.id}?m=checkins`}
              className="text-xs px-2 py-1 rounded-md bg-muted hover:bg-primary/15 hover:text-primary transition-colors"
            >
              {c.name}
            </Link>
          ))}
          {missing.length > 6 && (
            <span className="text-xs text-muted-foreground px-2 py-1">+{missing.length - 6} mehr</span>
          )}
        </div>
      )}
    </Card>
  );
}
