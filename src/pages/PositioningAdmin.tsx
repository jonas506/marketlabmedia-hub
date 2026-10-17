import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { APPOINTMENT_STATUSES, INDUSTRY_OPTIONS, REVENUE_OPTIONS, STATUSES, gradeFor, scoreLead } from "./positioning/scoring";

const ADMIN_EMAIL = "jonas@marketlab-media.de";
type Range = "1" | "7" | "30" | "90" | "all" | "custom";
const RANGES: [Range, string][] = [["1", "24 Std."], ["7", "7 Tage"], ["30", "30 Tage"], ["90", "90 Tage"], ["all", "Gesamt"], ["custom", "Eigener"]];
const STEPS = [["besuch", "Seite besucht"], ["video", "Video gestartet"], ["formular", "Formular begonnen"], ["eingetragen", "Eingetragen"]] as const;
const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2, 160 60% 45%))", "hsl(var(--chart-3, 40 90% 55%))", "hsl(var(--chart-4, 0 70% 60%))", "hsl(var(--muted-foreground))"];

function Distribution({ title, data }: { title: string; data: { name: string; value: number }[] }) {
  const [mode, setMode] = useState<"bar" | "pie">("bar");
  const total = data.reduce((s, d) => s + d.value, 0);
  return <Card className="p-4">
    <div className="flex items-center justify-between mb-3"><h3 className="font-semibold">{title}</h3>
      <Button size="sm" variant="ghost" onClick={() => setMode(mode === "bar" ? "pie" : "bar")}>{mode === "bar" ? "Kreis" : "Balken"}</Button></div>
    {total === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">Noch keine Daten im Zeitraum</p> : <>
      <div className="h-48"><ResponsiveContainer>{mode === "bar"
        ? <BarChart data={data}><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} width={24} /><Tooltip /><Bar dataKey="value" fill="hsl(var(--primary))" radius={4} /></BarChart>
        : <PieChart><Pie data={data} dataKey="value" nameKey="name" outerRadius={70}>{data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart>}
      </ResponsiveContainer></div>
      <ul className="text-xs mt-2 space-y-1">{data.map(d => <li key={d.name} className="flex justify-between"><span>{d.name}</span><span className="text-muted-foreground">{d.value} · {Math.round(d.value / total * 100)} %</span></li>)}</ul>
    </>}
  </Card>;
}

export default function PositioningAdmin() {
  const { user, loading, signOut } = useAuth();
  const qc = useQueryClient();
  const [range, setRange] = useState<Range>(() => new URLSearchParams(window.location.search).get("range") === "all" ? "all" : "30");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("alle");

  useEffect(() => {
    const m = document.createElement("meta"); m.name = "robots"; m.content = "noindex, nofollow"; document.head.appendChild(m);
    const t = document.title; document.title = "Admin · Positionierungs-Analyse";
    return () => { m.remove(); document.title = t; };
  }, []);

  const bounds = useMemo(() => {
    if (range === "all") return { start: null as string | null, end: null as string | null };
    if (range === "custom") return { start: from ? new Date(from + "T00:00:00").toISOString() : null, end: to ? new Date(to + "T23:59:59").toISOString() : null };
    return { start: new Date(Date.now() - Number(range) * 86400000).toISOString(), end: null };
  }, [range, from, to]);

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;
  const { data } = useQuery({
    queryKey: ["pa-admin", bounds], enabled: !!isAdmin,
    queryFn: async () => {
      let l = supabase.from("positioning_analysis_leads").select("*").order("created_at", { ascending: false });
      let e = supabase.from("positioning_funnel_events").select("session_id, step");
      if (bounds.start) { l = l.gte("created_at", bounds.start); e = e.gte("created_at", bounds.start); }
      if (bounds.end) { l = l.lte("created_at", bounds.end); e = e.lte("created_at", bounds.end); }
      const [leads, events] = await Promise.all([l, e]);
      if (leads.error) throw leads.error;
      return { leads: leads.data ?? [], events: events.data ?? [] };
    },
  });

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <div className="min-h-screen grid place-items-center bg-background text-foreground p-6 text-center"><div><p className="mb-4">Kein Zugriff auf dieses Adminpanel.</p><Button onClick={signOut}>Abmelden</Button></div></div>;

  const leads = (data?.leads ?? []).map(l => { const score = scoreLead(l.monthly_revenue, l.industry); return { ...l, score, grade: gradeFor(score) }; });
  const sessions = (step: string) => new Set((data?.events ?? []).filter(e => e.step === step).map(e => e.session_id)).size;
  const visitors = sessions("besuch");
  const avg = leads.length ? Math.round(leads.reduce((s, l) => s + l.score, 0) / leads.length) : null;
  const highShare = leads.length ? Math.round(leads.filter(l => l.grade === "A" || l.grade === "B").length / leads.length * 100) : null;
  const appts = leads.filter(l => APPOINTMENT_STATUSES.includes(l.status)).length;
  const deals = leads.filter(l => l.status === "abschluss").length;
  const count = (opts: string[], key: "monthly_revenue" | "industry" | "grade") => [
    ...opts.map(o => ({ name: o, value: leads.filter(l => l[key] === o).length })),
    ...(leads.some(l => !opts.includes(l[key])) ? [{ name: "Keine Angabe", value: leads.filter(l => !opts.includes(l[key])).length }] : []),
  ];
  const sourceOpts = [...new Set(leads.map(l => l.utm_source || "Direkt / unbekannt"))];
  const shown = statusFilter === "alle" ? leads : leads.filter(l => l.status === statusFilter);

  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from("positioning_analysis_leads").update({ status }).eq("id", id);
    if (error) toast.error("Status konnte nicht gespeichert werden"); else qc.invalidateQueries({ queryKey: ["pa-admin"] });
  }

  const kpis: [string, string][] = [
    ["Leads", String(leads.length)], ["Ø Score", avg === null ? "–" : String(avg)], ["A/B-Anteil", highShare === null ? "–" : `${highShare} %`],
    ["Termine", String(appts)], ["Abschlüsse", String(deals)], ["Besucher", visitors ? String(visitors) : "–"],
    ["Conversion", visitors ? `${(sessions("eingetragen") / visitors * 100).toFixed(1)} %` : "–"],
  ];

  return <div className="min-h-screen bg-background text-foreground">
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">Positionierungs-Analyse · Leads</h1><p className="text-sm text-muted-foreground">Zeitzone Europe/Berlin</p></div>
        <Button variant="ghost" onClick={signOut} className="min-h-11"><LogOut className="h-4 w-4 mr-2" />Abmelden</Button>
      </header>

      <div className="flex flex-wrap gap-2 items-center">
        {RANGES.map(([v, label]) => <Button key={v} size="sm" className="min-h-11" variant={range === v ? "default" : "outline"} onClick={() => setRange(v)}>{label}</Button>)}
        {range === "custom" && <><Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-auto" /><Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-auto" /></>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {kpis.map(([k, v]) => <Card key={k} className="p-4"><p className="text-xs text-muted-foreground">{k}</p><p className="text-2xl font-semibold mt-1">{v}</p></Card>)}
      </div>

      <Card className="p-4">
        <h3 className="font-semibold mb-3">Funnel</h3>
        {!visitors ? <p className="text-sm text-muted-foreground">Besucher werden ab jetzt gemessen – noch keine Daten im Zeitraum.</p> :
          <div className="space-y-2">{STEPS.map(([key, label], i) => {
            const n = sessions(key); const prev = i ? sessions(STEPS[i - 1][0]) : n; const drop = prev - n;
            return <div key={key}><div className="flex justify-between text-sm"><span>{label}</span><span className="text-muted-foreground">{n} · {Math.round(n / visitors * 100)} %{i > 0 && ` · −${drop} (${prev ? Math.round(drop / prev * 100) : 0} %)`}</span></div>
              <div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${n / visitors * 100}%` }} /></div></div>;
          })}</div>}
      </Card>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Distribution title="Qualitätsklasse" data={count(["A", "B", "C", "D"], "grade")} />
        <Distribution title="Monatlicher Umsatz" data={count(REVENUE_OPTIONS, "monthly_revenue")} />
        <Distribution title="Branche" data={count(INDUSTRY_OPTIONS, "industry")} />
        <Distribution title="Quelle" data={sourceOpts.map(s => ({ name: s, value: leads.filter(l => (l.utm_source || "Direkt / unbekannt") === s).length }))} />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3"><h3 className="font-semibold">Leads ({shown.length})</h3>
          <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="alle">Alle Status</SelectItem>{STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
        {shown.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">Keine Leads im Zeitraum.</p> :
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="text-left text-muted-foreground"><tr><th className="p-2">Datum</th><th className="p-2">Kontakt</th><th className="p-2">Firma / Branche</th><th className="p-2">Umsatz</th><th className="p-2">Score</th><th className="p-2">Quelle</th><th className="p-2">Status</th></tr></thead>
            <tbody>{shown.map(l => <tr key={l.id} id={`lead-${l.id}`} className="border-t border-border align-top">
              <td className="p-2 whitespace-nowrap">{new Date(l.created_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" })}</td>
              <td className="p-2"><div className="font-medium">{l.contact_name}</div><a className="text-primary block" href={`mailto:${l.email}`}>{l.email}</a><a className="text-muted-foreground" href={`tel:${l.phone}`}>{l.phone}</a></td>
              <td className="p-2"><div>{l.company}</div><div className="text-muted-foreground">{l.industry}</div></td>
              <td className="p-2 whitespace-nowrap">{l.monthly_revenue}</td>
              <td className="p-2 whitespace-nowrap"><span className="font-semibold">{l.grade}</span> · {l.score}</td>
              <td className="p-2">{l.utm_source || "–"}{l.utm_campaign && <div className="text-muted-foreground text-xs">{l.utm_campaign}</div>}</td>
              <td className="p-2"><Select value={l.status} onValueChange={v => setStatus(l.id, v)}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></td>
            </tr>)}</tbody></table></div>}
      </Card>
    </div>
  </div>;
}
