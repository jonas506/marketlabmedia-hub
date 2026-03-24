import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import AppLayout from "@/components/AppLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Users, DollarSign, MessageSquare, CalendarCheck, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { de } from "date-fns/locale";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface TrackingRow {
  id: string;
  client_id: string;
  tracking_date: string;
  notes: string | null;
  ad_spend: number;
  new_followers: number;
  cost_per_follower: number | null;
  dm_sent: number;
  new_conversations: number;
  appointments_booked: number;
}

interface Client {
  id: string;
  name: string;
  logo_url: string | null;
}

export default function MarketingDashboard() {
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return { month: now.getMonth(), year: now.getFullYear() };
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name, logo_url").eq("status", "active").order("name");
      return (data ?? []) as Client[];
    },
  });

  // Fetch current month data
  const currentStart = format(new Date(viewMonth.year, viewMonth.month, 1), "yyyy-MM-dd");
  const currentEnd = format(endOfMonth(new Date(viewMonth.year, viewMonth.month, 1)), "yyyy-MM-dd");
  const prevDate = subMonths(new Date(viewMonth.year, viewMonth.month, 1), 1);
  const prevStart = format(startOfMonth(prevDate), "yyyy-MM-dd");
  const prevEnd = format(endOfMonth(prevDate), "yyyy-MM-dd");

  const { data: currentRows = [], isLoading } = useQuery({
    queryKey: ["mkt-dash", selectedClient, viewMonth.month, viewMonth.year],
    queryFn: async () => {
      let q = supabase
        .from("marketing_tracking")
        .select("*")
        .gte("tracking_date", currentStart)
        .lte("tracking_date", currentEnd)
        .order("tracking_date", { ascending: true });
      if (selectedClient !== "all") q = q.eq("client_id", selectedClient);
      const { data } = await q;
      return (data ?? []) as TrackingRow[];
    },
  });

  const { data: prevRows = [] } = useQuery({
    queryKey: ["mkt-dash-prev", selectedClient, viewMonth.month, viewMonth.year],
    queryFn: async () => {
      let q = supabase
        .from("marketing_tracking")
        .select("*")
        .gte("tracking_date", prevStart)
        .lte("tracking_date", prevEnd);
      if (selectedClient !== "all") q = q.eq("client_id", selectedClient);
      const { data } = await q;
      return (data ?? []) as TrackingRow[];
    },
  });

  // All-time data for trend chart
  const { data: allRows = [] } = useQuery({
    queryKey: ["mkt-dash-all", selectedClient],
    queryFn: async () => {
      let q = supabase
        .from("marketing_tracking")
        .select("*")
        .order("tracking_date", { ascending: true });
      if (selectedClient !== "all") q = q.eq("client_id", selectedClient);
      const { data } = await q;
      return (data ?? []) as TrackingRow[];
    },
  });

  const sum = (rows: TrackingRow[], key: keyof TrackingRow) =>
    rows.reduce((a, r) => a + Number(r[key] || 0), 0);

  const currentTotals = useMemo(() => ({
    ad_spend: sum(currentRows, "ad_spend"),
    new_followers: sum(currentRows, "new_followers"),
    dm_sent: sum(currentRows, "dm_sent"),
    new_conversations: sum(currentRows, "new_conversations"),
    appointments_booked: sum(currentRows, "appointments_booked"),
  }), [currentRows]);

  const prevTotals = useMemo(() => ({
    ad_spend: sum(prevRows, "ad_spend"),
    new_followers: sum(prevRows, "new_followers"),
    dm_sent: sum(prevRows, "dm_sent"),
    new_conversations: sum(prevRows, "new_conversations"),
    appointments_booked: sum(prevRows, "appointments_booked"),
  }), [prevRows]);

  const avgCPF = currentTotals.new_followers > 0 ? currentTotals.ad_spend / currentTotals.new_followers : null;

  const pctChange = (curr: number, prev: number) => {
    if (prev === 0) return null;
    return ((curr - prev) / prev) * 100;
  };

  // Daily chart data
  const dailyChart = useMemo(() =>
    currentRows.map((r) => ({
      date: format(new Date(r.tracking_date), "dd.MM"),
      followers: Number(r.new_followers || 0),
      spend: Number(r.ad_spend || 0),
      dms: Number(r.dm_sent || 0),
      conversations: Number(r.new_conversations || 0),
      appointments: Number(r.appointments_booked || 0),
    })),
    [currentRows]
  );

  // Monthly aggregation for trend
  const monthlyTrend = useMemo(() => {
    const map = new Map<string, { spend: number; followers: number; dms: number; conversations: number; appointments: number }>();
    allRows.forEach((r) => {
      const key = r.tracking_date.substring(0, 7); // YYYY-MM
      const existing = map.get(key) || { spend: 0, followers: 0, dms: 0, conversations: 0, appointments: 0 };
      existing.spend += Number(r.ad_spend || 0);
      existing.followers += Number(r.new_followers || 0);
      existing.dms += Number(r.dm_sent || 0);
      existing.conversations += Number(r.new_conversations || 0);
      existing.appointments += Number(r.appointments_booked || 0);
      map.set(key, existing);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => ({
        month: format(new Date(key + "-01"), "MMM yy", { locale: de }),
        ...val,
        cpf: val.followers > 0 ? +(val.spend / val.followers).toFixed(2) : 0,
      }));
  }, [allRows]);

  const shiftMonth = (dir: number) =>
    setViewMonth((v) => {
      const d = new Date(v.year, v.month + dir);
      return { month: d.getMonth(), year: d.getFullYear() };
    });

  const monthLabel = format(new Date(viewMonth.year, viewMonth.month), "MMMM yyyy", { locale: de });

  const KpiCard = ({ title, value, prevValue, icon: Icon, color, suffix = "" }: {
    title: string; value: number; prevValue: number; icon: any; color: string; suffix?: string;
  }) => {
    const change = pctChange(value, prevValue);
    const positive = change !== null && change >= 0;
    return (
      <div className={`rounded-xl border border-border bg-card p-5 relative overflow-hidden`}>
        <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-[80px] opacity-10 ${color}`} />
        <div className="flex items-start justify-between mb-3">
          <div className={`flex items-center justify-center h-10 w-10 rounded-xl ${color} bg-opacity-15`}>
            <Icon className="h-5 w-5 text-current" />
          </div>
          {change !== null && (
            <div className={`flex items-center gap-0.5 text-xs font-mono ${positive ? "text-emerald-400" : "text-rose-400"}`}>
              {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(change).toFixed(1)}%
            </div>
          )}
        </div>
        <div className="text-2xl font-bold font-mono tracking-tight">
          {typeof value === "number" && suffix === "€" ? value.toFixed(2) : value}{suffix}
        </div>
        <div className="text-xs text-muted-foreground mt-1">{title}</div>
      </div>
    );
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border border-border bg-card/95 backdrop-blur-sm p-3 shadow-lg">
        <div className="text-xs font-mono text-muted-foreground mb-2">{label}</div>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2 text-xs">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-muted-foreground">{p.name}:</span>
            <span className="font-mono font-semibold">{p.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <AppLayout>
      <ErrorBoundary level="section">
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight">Marketing Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">Gesamtübersicht über alle Marketing-KPIs</p>
          </div>

          <div className="flex items-center gap-3">
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger className="w-[200px] h-9 text-xs">
                <SelectValue placeholder="Alle Kunden" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Kunden</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1 bg-card border border-border rounded-lg px-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => shiftMonth(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs font-mono min-w-[110px] text-center">{monthLabel}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => shiftMonth(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard title="Ad Spend" value={currentTotals.ad_spend} prevValue={prevTotals.ad_spend} icon={DollarSign} color="bg-rose-500" suffix=" €" />
          <KpiCard title="Neue Follower" value={currentTotals.new_followers} prevValue={prevTotals.new_followers} icon={Users} color="bg-violet-500" />
          <KpiCard title="Ø Kosten/Follower" value={avgCPF !== null ? +avgCPF.toFixed(2) : 0} prevValue={prevTotals.new_followers > 0 ? +(prevTotals.ad_spend / prevTotals.new_followers).toFixed(2) : 0} icon={TrendingUp} color="bg-violet-500" suffix=" €" />
          <KpiCard title="Nachrichten" value={currentTotals.dm_sent} prevValue={prevTotals.dm_sent} icon={MessageSquare} color="bg-sky-500" />
          <KpiCard title="Termine gebucht" value={currentTotals.appointments_booked} prevValue={prevTotals.appointments_booked} icon={CalendarCheck} color="bg-amber-500" />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Follower Chart */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold mb-4">Neue Follower pro Tag</h3>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyChart}>
                  <defs>
                    <linearGradient id="fillFollowers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(267, 84%, 60%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(267, 84%, 60%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="followers" name="Follower" stroke="hsl(267, 84%, 60%)" fill="url(#fillFollowers)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Ad Spend Chart */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold mb-4">Ad Spend pro Tag</h3>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="spend" name="Spend €" fill="hsl(350, 89%, 60%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* DMs + Conversations */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Outreach: Nachrichten & Konversationen</h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="dms" name="DMs gesendet" stroke="hsl(199, 89%, 48%)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="conversations" name="Neue Konversationen" stroke="hsl(160, 84%, 39%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Trend */}
        {monthlyTrend.length > 1 && (
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold mb-4">Monatlicher Trend</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="followers" name="Follower" fill="hsl(267, 84%, 60%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="dms" name="DMs" fill="hsl(199, 89%, 48%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="conversations" name="Konversationen" fill="hsl(160, 84%, 39%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="appointments" name="Termine" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Cost per Follower Trend */}
        {monthlyTrend.length > 1 && (
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold mb-4">Kosten pro Follower – Monatlich</h3>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" unit=" €" />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="cpf" name="€/Follower" stroke="hsl(267, 84%, 60%)" strokeWidth={2.5} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
