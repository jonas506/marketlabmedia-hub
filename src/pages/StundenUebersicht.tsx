import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Clock, ArrowUpDown, TrendingUp, Users, ExternalLink } from "lucide-react";
import { ACTIVITY_TYPES, ACTIVITY_BAR_COLORS, formatHoursMinutes } from "@/lib/time-tracking-constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const MONTHS_DE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

function isoWeek(d: Date): { week: number; year: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { week, year: date.getUTCFullYear() };
}

type SortKey = "hours" | "name" | "eurPerHour" | "delta";

export default function StundenUebersicht() {
  const { role } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [sortBy, setSortBy] = useState<SortKey>("hours");
  const [scope, setScope] = useState<"month" | "week">("month");

  const { data: clients } = useQuery({
    queryKey: ["all-clients-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, logo_url, monthly_price, status")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Date range depending on scope
  const { fromDate, toDate, periodLabel } = useMemo(() => {
    if (scope === "month") {
      const from = new Date(year, month, 1);
      const to = new Date(year, month + 1, 0);
      return { fromDate: from, toDate: to, periodLabel: `${MONTHS_DE[month]} ${year}` };
    }
    // current week (ISO Monday)
    const today = new Date();
    const dow = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((dow + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const w = isoWeek(today);
    return { fromDate: monday, toDate: sunday, periodLabel: `KW ${w.week} (${monday.toLocaleDateString("de-DE")} – ${sunday.toLocaleDateString("de-DE")})` };
  }, [scope, year, month]);

  const { data: entries, isLoading } = useQuery({
    queryKey: ["all-time-entries", fromDate.toISOString().slice(0, 10), toDate.toISOString().slice(0, 10)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select("id, user_id, client_id, date, hours, activity_type")
        .gte("date", fromDate.toISOString().slice(0, 10))
        .lte("date", toDate.toISOString().slice(0, 10));
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["all-profiles-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, name, email");
      if (error) throw error;
      return data ?? [];
    },
  });

  const nameFor = (uid: string) => {
    const p = (profiles ?? []).find((x: any) => x.user_id === uid);
    return p?.name || p?.email || "Unbekannt";
  };

  // Aggregate
  const rows = useMemo(() => {
    if (!clients || !entries) return [];
    const map = new Map<string, { hours: number; userIds: Set<string>; byUser: Record<string, number>; byActivity: Record<string, number> }>();
    let unassigned = 0;
    for (const e of entries) {
      if (!e.client_id) { unassigned += Number(e.hours); continue; }
      let row = map.get(e.client_id);
      if (!row) { row = { hours: 0, userIds: new Set(), byUser: {}, byActivity: {} }; map.set(e.client_id, row); }
      row.hours += Number(e.hours);
      row.userIds.add(e.user_id);
      row.byUser[e.user_id] = (row.byUser[e.user_id] ?? 0) + Number(e.hours);
      row.byActivity[e.activity_type] = (row.byActivity[e.activity_type] ?? 0) + Number(e.hours);
    }
    const out = clients
      .filter((c) => map.has(c.id))
      .map((c) => {
        const r = map.get(c.id)!;
        const monthlyPrice = Number(c.monthly_price ?? 0);
        const eurPerHour = scope === "month" && r.hours > 0 && monthlyPrice > 0 ? monthlyPrice / r.hours : null;
        return { client: c, ...r, monthlyPrice, eurPerHour };
      });
    return { rows: out, unassigned };
  }, [clients, entries, scope]) as any;

  const sortedRows = useMemo(() => {
    const arr = [...(rows.rows ?? [])];
    arr.sort((a: any, b: any) => {
      if (sortBy === "name") return a.client.name.localeCompare(b.client.name);
      if (sortBy === "eurPerHour") return (a.eurPerHour ?? Infinity) - (b.eurPerHour ?? Infinity);
      if (sortBy === "delta") {
        const av = a.monthlyPrice > 0 ? a.hours / Math.max(a.monthlyPrice, 1) : 0;
        const bv = b.monthlyPrice > 0 ? b.hours / Math.max(b.monthlyPrice, 1) : 0;
        return bv - av;
      }
      return b.hours - a.hours;
    });
    return arr;
  }, [rows, sortBy]);

  const totals = useMemo(() => {
    const totalHours = (rows.rows ?? []).reduce((s: number, r: any) => s + r.hours, 0) + (rows.unassigned ?? 0);
    const totalRevenue = (rows.rows ?? []).reduce((s: number, r: any) => s + (r.monthlyPrice || 0), 0);
    const totalAssigned = (rows.rows ?? []).reduce((s: number, r: any) => s + r.hours, 0);
    return { totalHours, totalRevenue, totalAssigned, unassigned: rows.unassigned ?? 0 };
  }, [rows]);

  // Per user across all clients
  const byUser = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of entries ?? []) m[e.user_id] = (m[e.user_id] ?? 0) + Number(e.hours);
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [entries]);

  const byActivity = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of entries ?? []) m[e.activity_type] = (m[e.activity_type] ?? 0) + Number(e.hours);
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [entries]);

  const years = useMemo(() => {
    const ys = new Set<number>([now.getFullYear(), now.getFullYear() - 1]);
    return Array.from(ys).sort((a, b) => b - a);
  }, []);

  const maxHours = Math.max(...sortedRows.map((r: any) => r.hours), 1);
  const activityLabel = (t: string) => ACTIVITY_TYPES.find((a) => a.value === t)?.label ?? t;

  if (role !== "admin") {
    return (
      <AppLayout>
        <div className="p-8 text-center text-muted-foreground">Diese Seite ist nur für Admins.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Clock className="h-6 w-6 text-primary" />
              Stunden-Übersicht
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Pro Kunde investierte Zeit — für Auslastung, Kosten und Koordination.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-md border bg-card p-0.5">
              <button onClick={() => setScope("month")} className={`px-3 py-1.5 text-xs rounded ${scope === "month" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>Monat</button>
              <button onClick={() => setScope("week")} className={`px-3 py-1.5 text-xs rounded ${scope === "week" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>Diese Woche</button>
            </div>
            {scope === "month" && (
              <>
                <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                  <SelectTrigger className="h-9 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS_DE.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                  <SelectTrigger className="h-9 w-[90px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </>
            )}
          </div>
        </div>

        <div className="text-xs text-muted-foreground">Zeitraum: <span className="font-medium text-foreground">{periodLabel}</span></div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-card p-4">
            <div className="text-xs text-muted-foreground mb-1">Gesamtstunden</div>
            <div className="text-2xl font-semibold">{formatHoursMinutes(totals.totalHours)}</div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-xs text-muted-foreground mb-1">Aktive Kunden</div>
            <div className="text-2xl font-semibold">{sortedRows.length}</div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-xs text-muted-foreground mb-1">{scope === "month" ? "Vertragsumsatz" : "Team aktiv"}</div>
            <div className="text-2xl font-semibold">{scope === "month" ? `${totals.totalRevenue.toLocaleString("de-DE")} €` : byUser.length}</div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-xs text-muted-foreground mb-1">Ohne Kunde</div>
            <div className="text-2xl font-semibold">{formatHoursMinutes(totals.unassigned)}</div>
          </div>
        </div>

        {/* Two columns: team & activities */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm font-medium mb-3 flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /> Team-Auslastung</div>
            {byUser.length === 0 ? (
              <div className="text-xs text-muted-foreground italic">Keine Buchungen.</div>
            ) : (
              <div className="space-y-1.5">
                {byUser.map(([uid, h]) => {
                  const max = Math.max(...byUser.map(([, v]) => v as number), 1);
                  return (
                    <div key={uid} className="flex items-center gap-3 text-xs">
                      <div className="w-32 truncate">{nameFor(uid)}</div>
                      <div className="flex-1 h-4 rounded bg-muted/40 overflow-hidden">
                        <div className="h-full bg-primary/70" style={{ width: `${((h as number) / max) * 100}%` }} />
                      </div>
                      <div className="w-16 text-right tabular-nums font-medium">{formatHoursMinutes(h as number)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm font-medium mb-3 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-muted-foreground" /> Tätigkeiten</div>
            {byActivity.length === 0 ? (
              <div className="text-xs text-muted-foreground italic">Keine Buchungen.</div>
            ) : (
              <div className="space-y-1.5">
                {byActivity.map(([t, h]) => (
                  <div key={t} className="flex items-center gap-2 text-xs">
                    <span className={`h-2.5 w-2.5 rounded-full ${ACTIVITY_BAR_COLORS[t] ?? "bg-gray-400"}`} />
                    <span className="flex-1 truncate">{activityLabel(t)}</span>
                    <span className="tabular-nums font-medium">{formatHoursMinutes(h as number)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Client table */}
        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="text-sm font-medium">Kunden ({sortedRows.length})</div>
            <Select value={sortBy} onValueChange={(v: SortKey) => setSortBy(v)}>
              <SelectTrigger className="h-8 w-[180px] text-xs"><ArrowUpDown className="h-3 w-3 mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hours">Stunden ↓</SelectItem>
                <SelectItem value="name">Name A-Z</SelectItem>
                {scope === "month" && <SelectItem value="eurPerHour">€/Std (günstig)</SelectItem>}
                {scope === "month" && <SelectItem value="delta">Auslastung (Std/€)</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Lade…</div>
          ) : sortedRows.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Keine Zeiten in diesem Zeitraum gebucht.</div>
          ) : (
            <div className="divide-y">
              {sortedRows.map((r: any) => {
                const topUsers = Object.entries(r.byUser).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 3);
                return (
                  <div key={r.client.id} className="px-4 py-3 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-7 h-7 rounded bg-muted shrink-0 overflow-hidden flex items-center justify-center text-[10px] font-medium text-muted-foreground">
                        {r.client.logo_url ? <img src={r.client.logo_url} alt="" className="w-full h-full object-cover" /> : r.client.name.slice(0, 2).toUpperCase()}
                      </div>
                      <Link to={`/client/${r.client.id}`} className="font-medium text-sm hover:text-primary flex items-center gap-1 truncate">
                        {r.client.name}
                        <ExternalLink className="h-3 w-3 opacity-50" />
                      </Link>
                      <div className="flex-1 h-2 rounded bg-muted/40 overflow-hidden mx-2 min-w-[60px]">
                        <div className="h-full bg-primary" style={{ width: `${(r.hours / maxHours) * 100}%` }} />
                      </div>
                      <div className="text-sm font-semibold tabular-nums w-20 text-right">{formatHoursMinutes(r.hours)}</div>
                      {scope === "month" && r.monthlyPrice > 0 && (
                        <div className="text-xs text-muted-foreground tabular-nums w-24 text-right">
                          {r.eurPerHour ? `${Math.round(r.eurPerHour)} €/Std` : "—"}
                          <div className="text-[10px]">{r.monthlyPrice.toLocaleString("de-DE")} €/Mo</div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground pl-10 flex-wrap">
                      <span>{r.userIds.size} {r.userIds.size === 1 ? "Person" : "Personen"}</span>
                      {topUsers.map(([uid, h]) => (
                        <span key={uid} className="rounded bg-muted/40 px-1.5 py-0.5">
                          {nameFor(uid)} · {formatHoursMinutes(h as number)}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
