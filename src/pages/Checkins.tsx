import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import ProzesseTabs from "@/components/ProzesseTabs";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  WEEK_CONFIGS,
  getCurrentWeekFocus,
  getISOWeek,
  MOOD_OPTIONS,
  type WeekFocus,
} from "@/lib/checkin-constants";
import { format, parseISO, differenceInDays } from "date-fns";
import { de } from "date-fns/locale";
import { AlertTriangle, TrendingUp, CheckCircle2, Clock } from "lucide-react";

interface Client { id: string; name: string; logo_url: string | null; status: string | null }
interface CheckinRow {
  id: string; client_id: string; checkin_date: string; calendar_week: number; year: number;
  week_focus: number; mood: string | null; nps: number | null; escalated: boolean; upsell_flag: boolean;
}

export default function Checkins() {
  const focus = getCurrentWeekFocus();
  const { week, year } = getISOWeek(new Date());
  const cfg = WEEK_CONFIGS[focus];

  const { data: clients } = useQuery({
    queryKey: ["checkins-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id,name,logo_url,status")
        .neq("status", "archived")
        .order("name");
      if (error) throw error;
      return data as Client[];
    },
  });

  const { data: checkins } = useQuery({
    queryKey: ["checkins-overview"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_checkins")
        .select("id,client_id,checkin_date,calendar_week,year,week_focus,mood,nps,escalated,upsell_flag")
        .order("checkin_date", { ascending: false });
      if (error) throw error;
      return data as CheckinRow[];
    },
  });

  const byClient = new Map<string, CheckinRow[]>();
  (checkins ?? []).forEach((c) => {
    if (!byClient.has(c.client_id)) byClient.set(c.client_id, []);
    byClient.get(c.client_id)!.push(c);
  });

  const rows = (clients ?? []).map((client) => {
    const list = byClient.get(client.id) ?? [];
    const last = list[0];
    const thisWeek = list.find((c) => c.calendar_week === week && c.year === year);
    const daysSince = last ? differenceInDays(new Date(), parseISO(last.checkin_date)) : null;
    const openEscalation = list.slice(0, 3).some((c) => c.escalated);
    const openUpsell = list.slice(0, 3).some((c) => c.upsell_flag);
    const npsList = list.filter((c) => c.nps !== null).slice(0, 3);
    const avgNps = npsList.length
      ? Math.round((npsList.reduce((s, c) => s + (c.nps ?? 0), 0) / npsList.length) * 10) / 10
      : null;

    let status: "green" | "yellow" | "red" = "green";
    if (openEscalation || (avgNps !== null && avgNps < 7)) status = "red";
    else if (!thisWeek && (daysSince === null || daysSince > 7)) status = "yellow";

    return { client, last, thisWeek, daysSince, openEscalation, openUpsell, avgNps, status };
  });

  // Sort: red → yellow → green
  const order = { red: 0, yellow: 1, green: 2 };
  rows.sort((a, b) => order[a.status] - order[b.status]);

  const dueThisWeek = rows.filter((r) => !r.thisWeek);

  return (
    <AppLayout>
      <div className="mb-4">
        <h1 className="text-xl font-semibold font-heading">Prozesse</h1>
      </div>
      <ProzesseTabs />

      <div className="space-y-6">
        <Card className={cn("p-4 border", cfg.accent)}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-xs opacity-80">Diese Woche · KW {week} · {cfg.badge}</div>
              <h2 className="text-lg font-semibold font-heading text-foreground mt-0.5">{cfg.title}</h2>
              <p className="text-xs text-muted-foreground">{cfg.subtitle}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-semibold font-heading">{dueThisWeek.length}</p>
              <p className="text-xs text-muted-foreground">Kunden fällig</p>
            </div>
          </div>
        </Card>

        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Kunden-Ampel</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {rows.map(({ client, last, thisWeek, daysSince, openEscalation, openUpsell, avgNps, status }) => (
              <Link
                key={client.id}
                to={`/client/${client.id}?m=checkins`}
                className="group"
              >
                <Card className={cn(
                  "p-3 flex items-center gap-3 transition-all hover:border-primary/40 border-l-4",
                  status === "red" && "border-l-red-500",
                  status === "yellow" && "border-l-amber-500",
                  status === "green" && "border-l-emerald-500"
                )}>
                  {client.logo_url ? (
                    <img src={client.logo_url} alt="" className="h-8 w-8 rounded-md bg-white object-contain p-0.5" />
                  ) : (
                    <div className="h-8 w-8 rounded-md bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">
                      {client.name.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{client.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      {thisWeek ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> diese Woche ✓
                        </span>
                      ) : last ? (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> vor {daysSince}d
                        </span>
                      ) : (
                        <span className="text-amber-400">noch nie</span>
                      )}
                      {last?.mood && (
                        <span>{MOOD_OPTIONS.find((m) => m.value === last.mood)?.emoji}</span>
                      )}
                      {avgNps !== null && (
                        <span className={cn(
                          "px-1.5 py-0.5 rounded",
                          avgNps >= 9 ? "bg-emerald-500/15 text-emerald-400"
                          : avgNps >= 7 ? "bg-amber-500/15 text-amber-400"
                          : "bg-red-500/15 text-red-400"
                        )}>NPS {avgNps}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {openEscalation && <AlertTriangle className="h-4 w-4 text-red-400" />}
                    {openUpsell && <TrendingUp className="h-4 w-4 text-amber-400" />}
                  </div>
                </Card>
              </Link>
            ))}
            {!rows.length && (
              <p className="text-sm text-muted-foreground p-4">Keine Kunden vorhanden.</p>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
