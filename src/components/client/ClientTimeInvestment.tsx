import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Users, Activity } from "lucide-react";
import { ACTIVITY_TYPES, ACTIVITY_BAR_COLORS, formatHoursMinutes } from "@/lib/time-tracking-constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  clientId: string;
}

interface Entry {
  id: string;
  user_id: string;
  date: string;
  hours: number;
  activity_type: string;
}

const MONTHS_DE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

function isoWeek(d: Date): { week: number; year: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { week, year: date.getUTCFullYear() };
}

function weekRange(year: number, week: number): { start: Date; end: Date } {
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dow = simple.getUTCDay();
  const start = new Date(simple);
  start.setUTCDate(simple.getUTCDate() - ((dow + 6) % 7));
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { start, end };
}

const fmtDate = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.`;

export default function ClientTimeInvestment({ clientId }: Props) {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());

  const { data: entries, isLoading } = useQuery({
    queryKey: ["client-time-entries", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select("id, user_id, date, hours, activity_type")
        .eq("client_id", clientId)
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Entry[];
    },
  });

  const userIds = useMemo(() => Array.from(new Set((entries ?? []).map((e) => e.user_id))), [entries]);

  const { data: profiles } = useQuery({
    enabled: userIds.length > 0,
    queryKey: ["profiles-for-time", userIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, name, email")
        .in("user_id", userIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const nameFor = (uid: string) => {
    const p = (profiles ?? []).find((x: any) => x.user_id === uid);
    return p?.name || p?.email || "Unbekannt";
  };
  const activityLabel = (t: string) => ACTIVITY_TYPES.find((a) => a.value === t)?.label ?? t;

  const stats = useMemo(() => {
    if (!entries) return null;
    const monthly: Record<string, number> = {};
    const weekly: Record<string, number> = {};
    let total = 0;
    for (const e of entries) {
      const d = new Date(e.date);
      const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
      monthly[monthKey] = (monthly[monthKey] ?? 0) + Number(e.hours);
      const w = isoWeek(d);
      const weekKey = `${w.year}-${String(w.week).padStart(2, "0")}`;
      weekly[weekKey] = (weekly[weekKey] ?? 0) + Number(e.hours);
      total += Number(e.hours);
    }
    return { monthly, weekly, total };
  }, [entries]);

  const selectedMonthEntries = useMemo(() => {
    if (!entries) return [];
    return entries.filter((e) => {
      const d = new Date(e.date);
      return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
    });
  }, [entries, selectedYear, selectedMonth]);

  const selectedMonthByUser = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of selectedMonthEntries) map[e.user_id] = (map[e.user_id] ?? 0) + Number(e.hours);
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [selectedMonthEntries]);

  const selectedMonthByActivity = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of selectedMonthEntries) map[e.activity_type] = (map[e.activity_type] ?? 0) + Number(e.hours);
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [selectedMonthEntries]);

  const selectedMonthTotal = selectedMonthEntries.reduce((s, e) => s + Number(e.hours), 0);

  const recentWeeks = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.weekly)
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 8)
      .map(([key, hours]) => {
        const [y, w] = key.split("-").map(Number);
        const { start, end } = weekRange(y, w);
        return { key, year: y, week: w, hours, label: `KW ${w} (${fmtDate(start)}–${fmtDate(end)})` };
      });
  }, [stats]);

  const recentMonths = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.monthly)
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 12)
      .map(([key, hours]) => {
        const [y, m] = key.split("-").map(Number);
        return { key, year: y, month: m, hours, label: `${MONTHS_DE[m]} ${y}` };
      });
  }, [stats]);

  const years = useMemo(() => {
    const ys = new Set<number>([now.getFullYear()]);
    for (const e of entries ?? []) ys.add(new Date(e.date).getFullYear());
    return Array.from(ys).sort((a, b) => b - a);
  }, [entries]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Lade Zeiten…</div>;
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-card p-8 text-center">
        <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <div className="text-sm text-muted-foreground">Noch keine Zeiten auf diesen Kunden gebucht.</div>
      </div>
    );
  }

  const maxMonth = Math.max(...recentMonths.map((m) => m.hours), 1);
  const maxWeek = Math.max(...recentWeeks.map((w) => w.hours), 1);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground mb-1">Gesamt investiert</div>
          <div className="text-2xl font-semibold">{formatHoursMinutes(stats?.total ?? 0)}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground mb-1">Dieser Monat</div>
          <div className="text-2xl font-semibold">
            {formatHoursMinutes(stats?.monthly[`${now.getFullYear()}-${now.getMonth()}`] ?? 0)}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground mb-1">Diese Woche</div>
          <div className="text-2xl font-semibold">
            {(() => {
              const w = isoWeek(now);
              return formatHoursMinutes(stats?.weekly[`${w.year}-${String(w.week).padStart(2, "0")}`] ?? 0);
            })()}
          </div>
        </div>
      </div>

      {/* Monthly bars */}
      <div className="rounded-lg border bg-card p-4">
        <div className="text-sm font-medium mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" /> Pro Monat
        </div>
        <div className="space-y-2">
          {recentMonths.map((m) => (
            <button
              key={m.key}
              onClick={() => { setSelectedYear(m.year); setSelectedMonth(m.month); }}
              className={`w-full flex items-center gap-3 group ${selectedYear === m.year && selectedMonth === m.month ? "" : ""}`}
            >
              <div className="w-28 text-xs text-left text-muted-foreground group-hover:text-foreground">{m.label}</div>
              <div className="flex-1 h-5 rounded bg-muted/40 overflow-hidden">
                <div
                  className={`h-full ${selectedYear === m.year && selectedMonth === m.month ? "bg-primary" : "bg-primary/60 group-hover:bg-primary/80"} transition-colors`}
                  style={{ width: `${(m.hours / maxMonth) * 100}%` }}
                />
              </div>
              <div className="w-20 text-right text-xs font-medium tabular-nums">{formatHoursMinutes(m.hours)}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Weekly bars */}
      <div className="rounded-lg border bg-card p-4">
        <div className="text-sm font-medium mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" /> Letzte Wochen
        </div>
        <div className="space-y-2">
          {recentWeeks.map((w) => (
            <div key={w.key} className="flex items-center gap-3">
              <div className="w-44 text-xs text-muted-foreground">{w.label}</div>
              <div className="flex-1 h-5 rounded bg-muted/40 overflow-hidden">
                <div className="h-full bg-emerald-500/70" style={{ width: `${(w.hours / maxWeek) * 100}%` }} />
              </div>
              <div className="w-20 text-right text-xs font-medium tabular-nums">{formatHoursMinutes(w.hours)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Monat-Details */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <div className="text-sm font-medium">Monatsdetail</div>
          <div className="flex items-center gap-2">
            <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
              <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS_DE.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
              <SelectTrigger className="h-8 w-[90px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="text-xs text-muted-foreground mb-3">
          Gesamt im Monat: <span className="font-medium text-foreground">{formatHoursMinutes(selectedMonthTotal)}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-medium mb-2 flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Mitarbeiter</div>
            {selectedMonthByUser.length === 0 ? (
              <div className="text-xs text-muted-foreground italic">Keine Buchungen</div>
            ) : (
              <div className="space-y-1.5">
                {selectedMonthByUser.map(([uid, h]) => (
                  <div key={uid} className="flex items-center justify-between text-xs gap-2 rounded bg-muted/30 px-2 py-1.5">
                    <span className="truncate">{nameFor(uid)}</span>
                    <span className="font-medium tabular-nums">{formatHoursMinutes(h)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="text-xs font-medium mb-2 flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" /> Tätigkeiten</div>
            {selectedMonthByActivity.length === 0 ? (
              <div className="text-xs text-muted-foreground italic">Keine Buchungen</div>
            ) : (
              <div className="space-y-1.5">
                {selectedMonthByActivity.map(([t, h]) => (
                  <div key={t} className="flex items-center gap-2 text-xs">
                    <span className={`h-2 w-2 rounded-full ${ACTIVITY_BAR_COLORS[t] ?? "bg-gray-400"}`} />
                    <span className="flex-1 truncate">{activityLabel(t)}</span>
                    <span className="font-medium tabular-nums">{formatHoursMinutes(h)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
