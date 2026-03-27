import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, startOfWeek, addWeeks, parseISO, differenceInWeeks } from "date-fns";
import { de } from "date-fns/locale";
import {
  Plus, TrendingUp, MessageCircle, Calendar, Trophy, Pause, Play, Trash2, ChevronDown, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";

type Campaign = {
  id: string;
  name: string;
  description: string | null;
  channel: string;
  status: string;
  created_by: string;
  created_at: string;
};

type Entry = {
  id: string;
  campaign_id: string;
  week_start: string;
  messages_sent: number;
  replies: number;
  appointments: number;
  second_appointments: number;
  closings: number;
  revenue: number;
  notes: string | null;
};

const METRICS = [
  { key: "messages_sent", label: "Nachrichten", color: "#818CF8", icon: MessageCircle },
  { key: "replies", label: "Antworten", color: "#34D399", icon: MessageCircle },
  { key: "appointments", label: "Termine", color: "#FBBF24", icon: Calendar },
  { key: "second_appointments", label: "2. Termine", color: "#F97316", icon: Calendar },
  { key: "closings", label: "Abschlüsse", color: "#EC4899", icon: Trophy },
] as const;

export default function CRMCampaigns() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Entry form state
  const [entryForm, setEntryForm] = useState<Partial<Entry>>({});
  const [savingEntry, setSavingEntry] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: c }, { data: e }] = await Promise.all([
      supabase.from("crm_campaigns" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("crm_campaign_entries" as any).select("*").order("week_start", { ascending: true }),
    ]);
    setCampaigns((c as any) || []);
    setEntries((e as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const createCampaign = async () => {
    if (!newName.trim() || !user) return;
    const { error } = await supabase.from("crm_campaigns" as any).insert({
      name: newName.trim(),
      description: newDesc.trim() || null,
      channel: "linkedin",
      created_by: user.id,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Kampagne erstellt");
    setNewName("");
    setNewDesc("");
    setShowCreate(false);
    fetchAll();
  };

  const toggleStatus = async (c: Campaign) => {
    const newStatus = c.status === "active" ? "paused" : "active";
    await supabase.from("crm_campaigns" as any).update({ status: newStatus } as any).eq("id", c.id);
    fetchAll();
  };

  const deleteCampaign = async (id: string) => {
    if (!confirm("Kampagne wirklich löschen?")) return;
    await supabase.from("crm_campaigns" as any).delete().eq("id", id);
    fetchAll();
  };

  const currentWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");

  const openEntry = (campaignId: string) => {
    const existing = entries.find(e => e.campaign_id === campaignId && e.week_start === currentWeekStart);
    if (existing) {
      setEntryForm(existing);
    } else {
      setEntryForm({
        campaign_id: campaignId,
        week_start: currentWeekStart,
        messages_sent: 0, replies: 0, appointments: 0, second_appointments: 0, closings: 0, revenue: 0, notes: "",
      });
    }
    setExpandedId(campaignId);
  };

  const saveEntry = async () => {
    if (!entryForm.campaign_id) return;
    setSavingEntry(true);
    const payload = {
      campaign_id: entryForm.campaign_id,
      week_start: entryForm.week_start,
      messages_sent: entryForm.messages_sent || 0,
      replies: entryForm.replies || 0,
      appointments: entryForm.appointments || 0,
      second_appointments: entryForm.second_appointments || 0,
      closings: entryForm.closings || 0,
      revenue: entryForm.revenue || 0,
      notes: entryForm.notes || null,
    };

    if ((entryForm as any).id) {
      await supabase.from("crm_campaign_entries" as any).update(payload as any).eq("id", (entryForm as any).id);
    } else {
      await supabase.from("crm_campaign_entries" as any).insert(payload as any);
    }
    toast.success("Woche gespeichert");
    setSavingEntry(false);
    fetchAll();
  };

  const getCampaignEntries = (campaignId: string) =>
    entries.filter(e => e.campaign_id === campaignId);

  const getCampaignTotals = (campaignId: string) => {
    const ce = getCampaignEntries(campaignId);
    return {
      messages_sent: ce.reduce((s, e) => s + e.messages_sent, 0),
      replies: ce.reduce((s, e) => s + e.replies, 0),
      appointments: ce.reduce((s, e) => s + e.appointments, 0),
      second_appointments: ce.reduce((s, e) => s + e.second_appointments, 0),
      closings: ce.reduce((s, e) => s + e.closings, 0),
      revenue: ce.reduce((s, e) => s + (e.revenue || 0), 0),
      weeks: ce.length,
    };
  };

  const getChartData = (campaignId: string) => {
    return getCampaignEntries(campaignId).map(e => ({
      week: "KW " + format(parseISO(e.week_start), "w", { locale: de }),
      ...e,
    }));
  };

  const getConversionData = (campaignId: string) => {
    const t = getCampaignTotals(campaignId);
    if (!t.messages_sent) return [];
    return [
      { name: "Nachrichten", value: t.messages_sent, pct: 100 },
      { name: "Antworten", value: t.replies, pct: Math.round((t.replies / t.messages_sent) * 100) },
      { name: "Termine", value: t.appointments, pct: Math.round((t.appointments / t.messages_sent) * 100) },
      { name: "2. Termine", value: t.second_appointments, pct: Math.round((t.second_appointments / t.messages_sent) * 100) },
      { name: "Abschlüsse", value: t.closings, pct: Math.round((t.closings / t.messages_sent) * 100) },
    ];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#FAFBFF]">Kampagnen</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Outreach-Kampagnen tracken & auswerten</p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Neue Kampagne
        </Button>
      </div>

      {/* Campaign List */}
      {loading ? (
        <div className="text-center text-muted-foreground py-12 text-sm">Lade...</div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-16">
          <TrendingUp className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Noch keine Kampagnen</p>
          <Button onClick={() => setShowCreate(true)} variant="outline" size="sm" className="mt-3 gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Erste Kampagne starten
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => {
            const totals = getCampaignTotals(c.id);
            const isExpanded = expandedId === c.id;
            const chartData = getChartData(c.id);
            const conversionData = getConversionData(c.id);

            return (
              <motion.div
                key={c.id}
                layout
                className="rounded-xl border border-[#3A3A44] bg-[#2A2A32] overflow-hidden"
              >
                {/* Campaign Header */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#3A3A44]/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-[#FAFBFF]">{c.name}</span>
                      <Badge variant={c.status === "active" ? "default" : "secondary"} className="text-[10px] h-5">
                        {c.status === "active" ? "Aktiv" : "Pausiert"}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] h-5 capitalize">{c.channel}</Badge>
                    </div>
                    {c.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{c.description}</p>}
                  </div>

                  {/* Quick stats */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{totals.weeks} Wochen</span>
                    <span>{totals.messages_sent} Nachr.</span>
                    <span>{totals.appointments} Termine</span>
                    <span className="text-emerald-400 font-medium">{totals.closings} Abschlüsse</span>
                  </div>

                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleStatus(c)}>
                      {c.status === "active" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive" onClick={() => deleteCampaign(c.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Expanded Content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-[#3A3A44]"
                    >
                      <div className="p-4 space-y-5">
                        {/* Weekly Entry Form */}
                        <div className="rounded-lg bg-[#1E1E24] border border-[#3A3A44] p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                              KW {format(parseISO(currentWeekStart), "w", { locale: de })} — {format(parseISO(currentWeekStart), "dd.MM.", { locale: de })}
                            </h3>
                            <Button size="sm" onClick={() => { openEntry(c.id); }} variant="outline" className="h-7 text-xs">
                              Woche bearbeiten
                            </Button>
                          </div>

                          {entryForm.campaign_id === c.id && (
                            <div className="space-y-3">
                              <div className="grid grid-cols-5 gap-3">
                                {METRICS.map(m => (
                                  <div key={m.key}>
                                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">{m.label}</label>
                                    <Input
                                      type="number"
                                      min={0}
                                      value={(entryForm as any)[m.key] || 0}
                                      onChange={e => setEntryForm(p => ({ ...p, [m.key]: parseInt(e.target.value) || 0 }))}
                                      className="h-8 bg-[#2A2A32] border-[#3A3A44] text-sm"
                                    />
                                  </div>
                                ))}
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Umsatz (€)</label>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={entryForm.revenue || 0}
                                    onChange={e => setEntryForm(p => ({ ...p, revenue: parseFloat(e.target.value) || 0 }))}
                                    className="h-8 bg-[#2A2A32] border-[#3A3A44] text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Notizen</label>
                                  <Input
                                    value={entryForm.notes || ""}
                                    onChange={e => setEntryForm(p => ({ ...p, notes: e.target.value }))}
                                    placeholder="Optional..."
                                    className="h-8 bg-[#2A2A32] border-[#3A3A44] text-sm"
                                  />
                                </div>
                              </div>
                              <Button size="sm" onClick={saveEntry} disabled={savingEntry} className="w-full">
                                {savingEntry ? "Speichert..." : "Woche speichern"}
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Conversion Funnel */}
                        {conversionData.length > 0 && (
                          <div className="rounded-lg bg-[#1E1E24] border border-[#3A3A44] p-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Conversion Funnel (Gesamt)</h3>
                            <div className="flex items-end gap-2">
                              {conversionData.map((d, i) => (
                                <div key={d.name} className="flex-1 text-center">
                                  <div className="text-lg font-bold text-[#FAFBFF]">{d.value}</div>
                                  <div className="text-[10px] text-muted-foreground">{d.name}</div>
                                  <div
                                    className="mt-1 mx-auto rounded-t"
                                    style={{
                                      height: `${Math.max(d.pct * 0.8, 4)}px`,
                                      backgroundColor: METRICS[i]?.color || "#818CF8",
                                      width: "100%",
                                      maxWidth: 60,
                                    }}
                                  />
                                  <div className="text-[10px] font-medium mt-1" style={{ color: METRICS[i]?.color || "#818CF8" }}>
                                    {d.pct}%
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Line Chart */}
                        {chartData.length >= 2 && (
                          <div className="rounded-lg bg-[#1E1E24] border border-[#3A3A44] p-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Verlauf</h3>
                            <ResponsiveContainer width="100%" height={250}>
                              <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#3A3A44" />
                                <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#888" }} />
                                <YAxis tick={{ fontSize: 10, fill: "#888" }} />
                                <Tooltip
                                  contentStyle={{ background: "#2A2A32", border: "1px solid #3A3A44", borderRadius: 8, fontSize: 12 }}
                                  labelStyle={{ color: "#FAFBFF" }}
                                />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                {METRICS.map(m => (
                                  <Line
                                    key={m.key}
                                    type="monotone"
                                    dataKey={m.key}
                                    name={m.label}
                                    stroke={m.color}
                                    strokeWidth={2}
                                    dot={{ r: 3 }}
                                  />
                                ))}
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        )}

                        {/* Weekly entries table */}
                        {chartData.length > 0 && (
                          <div className="rounded-lg bg-[#1E1E24] border border-[#3A3A44] overflow-hidden">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-[#3A3A44]">
                                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Woche</th>
                                  {METRICS.map(m => (
                                    <th key={m.key} className="text-right px-3 py-2 font-medium" style={{ color: m.color }}>{m.label}</th>
                                  ))}
                                  <th className="text-right px-3 py-2 text-muted-foreground font-medium">Umsatz</th>
                                </tr>
                              </thead>
                              <tbody>
                                {getCampaignEntries(c.id).map(e => (
                                  <tr key={e.id} className="border-b border-[#3A3A44]/50 hover:bg-[#3A3A44]/20">
                                    <td className="px-3 py-2 text-[#FAFBFF]">
                                      KW {format(parseISO(e.week_start), "w", { locale: de })}
                                      <span className="text-muted-foreground ml-1">
                                        ({format(parseISO(e.week_start), "dd.MM.", { locale: de })})
                                      </span>
                                    </td>
                                    {METRICS.map(m => (
                                      <td key={m.key} className="text-right px-3 py-2 text-[#FAFBFF]">{(e as any)[m.key]}</td>
                                    ))}
                                    <td className="text-right px-3 py-2 text-emerald-400 font-medium">
                                      {e.revenue ? `${Number(e.revenue).toLocaleString("de-DE")} €` : "–"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-[#2A2A32] border-[#3A3A44] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#FAFBFF]">Neue Kampagne</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Name</label>
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="z.B. LinkedIn Immobilien-Makler"
                className="bg-[#1E1E24] border-[#3A3A44]"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Beschreibung (optional)</label>
              <Input
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="Zielgruppe, Strategie..."
                className="bg-[#1E1E24] border-[#3A3A44]"
              />
            </div>
            <Button onClick={createCampaign} disabled={!newName.trim()} className="w-full">
              Kampagne erstellen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
