import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, TrendingUp, ChevronLeft, ChevronRight, MessageSquare, Calendar, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, subDays, startOfYear, endOfYear, subYears } from "date-fns";
import { de } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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
  cost_per_appointment: number | null;
  sales_today: number;
  appointments_total: number;
  show_rate: number | null;
  appointments_attended: number;
  offer_quote: number | null;
  offers_presented: number;
  closing_rate: number | null;
  closings: number;
  revenue_net: number;
}

interface Props {
  clientId: string;
  canEdit: boolean;
}

const COLUMNS: {
  key: keyof TrackingRow;
  label: string;
  computed?: boolean;
  type?: "currency" | "number" | "percent" | "text";
  colorClass: string;
  headerBg: string;
}[] = [
  {
    key: "tracking_date",
    label: "Datum",
    type: "text",
    colorClass: "bg-slate-500/[0.04]",
    headerBg: "bg-slate-500/10 text-slate-300",
  },
  {
    key: "ad_spend",
    label: "Ausgegeben",
    type: "currency",
    colorClass: "bg-rose-500/[0.04]",
    headerBg: "bg-rose-500/10 text-rose-300",
  },
  {
    key: "new_followers",
    label: "Neue Follower",
    type: "number",
    colorClass: "bg-violet-500/[0.04]",
    headerBg: "bg-violet-500/10 text-violet-300",
  },
  {
    key: "cost_per_follower",
    label: "Kosten/Follower",
    computed: true,
    type: "currency",
    colorClass: "bg-violet-500/[0.04]",
    headerBg: "bg-violet-500/10 text-violet-300",
  },
  {
    key: "dm_sent",
    label: "Nachrichten geschrieben",
    type: "number",
    colorClass: "bg-sky-500/[0.04]",
    headerBg: "bg-sky-500/10 text-sky-300",
  },
  {
    key: "new_conversations",
    label: "Neue Konversationen",
    type: "number",
    colorClass: "bg-emerald-500/[0.04]",
    headerBg: "bg-emerald-500/10 text-emerald-300",
  },
  {
    key: "appointments_booked",
    label: "Termine gebucht",
    type: "number",
    colorClass: "bg-amber-500/[0.04]",
    headerBg: "bg-amber-500/10 text-amber-300",
  },
];

const formatVal = (val: number | string | null, type?: string) => {
  if (val === null || val === undefined) return "–";
  if (type === "currency") return `${Number(val).toFixed(2)} €`;
  if (type === "percent") return `${Number(val).toFixed(1)}%`;
  return String(val);
};

type TimeRange = "month" | "90d" | "365d" | "last_year" | "all";

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: "month", label: "Dieser Monat" },
  { value: "90d", label: "90 Tage" },
  { value: "365d", label: "365 Tage" },
  { value: "last_year", label: "Letztes Jahr" },
  { value: "all", label: "Gesamt" },
];

function getDateRange(range: TimeRange): { from: string; to: string } | null {
  const today = new Date();
  const fmt = (d: Date) => format(d, "yyyy-MM-dd");
  switch (range) {
    case "month": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { from: fmt(start), to: fmt(end) };
    }
    case "90d":
      return { from: fmt(subDays(today, 90)), to: fmt(today) };
    case "365d":
      return { from: fmt(subDays(today, 365)), to: fmt(today) };
    case "last_year": {
      const ly = subYears(today, 1);
      return { from: fmt(startOfYear(ly)), to: fmt(endOfYear(ly)) };
    }
    case "all":
      return null;
  }
}

function computeSummary(rows: TrackingRow[]) {
  const days = rows.length;
  const ad_spend = rows.reduce((s, r) => s + Number(r.ad_spend || 0), 0);
  const new_followers = rows.reduce((s, r) => s + Number(r.new_followers || 0), 0);
  const dm_sent = rows.reduce((s, r) => s + Number(r.dm_sent || 0), 0);
  const new_conversations = rows.reduce((s, r) => s + Number(r.new_conversations || 0), 0);
  const appointments_booked = rows.reduce((s, r) => s + Number(r.appointments_booked || 0), 0);
  const appointments_attended = rows.reduce((s, r) => s + Number(r.appointments_attended || 0), 0);
  const closings = rows.reduce((s, r) => s + Number(r.closings || 0), 0);
  const revenue_net = rows.reduce((s, r) => s + Number(r.revenue_net || 0), 0);
  const cpf = new_followers > 0 ? ad_spend / new_followers : null;
  const show_rate = appointments_booked > 0 ? (appointments_attended / appointments_booked) * 100 : null;
  const closing_rate = appointments_attended > 0 ? (closings / appointments_attended) * 100 : null;

  return { days, ad_spend, new_followers, dm_sent, new_conversations, appointments_booked, appointments_attended, closings, revenue_net, cpf, show_rate, closing_rate };
}

export default function MarketingTracking({ clientId, canEdit }: Props) {
  const qc = useQueryClient();
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return { month: now.getMonth(), year: now.getFullYear() };
  });
  const [summaryRange, setSummaryRange] = useState<TimeRange>("month");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["marketing-tracking", clientId, viewMonth.month, viewMonth.year],
    queryFn: async () => {
      const startDate = new Date(viewMonth.year, viewMonth.month, 1);
      const endDate = new Date(viewMonth.year, viewMonth.month + 1, 0);
      const { data, error } = await supabase
        .from("marketing_tracking")
        .select("*")
        .eq("client_id", clientId)
        .gte("tracking_date", format(startDate, "yyyy-MM-dd"))
        .lte("tracking_date", format(endDate, "yyyy-MM-dd"))
        .order("tracking_date", { ascending: true });
      if (error) throw error;
      return data as TrackingRow[];
    },
  });

  // Fetch data for the selected summary range
  const dateRange = useMemo(() => getDateRange(summaryRange), [summaryRange]);
  const { data: summaryRows = [] } = useQuery({
    queryKey: ["marketing-tracking-summary", clientId, summaryRange],
    queryFn: async () => {
      let query = supabase
        .from("marketing_tracking")
        .select("*")
        .eq("client_id", clientId)
        .order("tracking_date", { ascending: true });
      if (dateRange) {
        query = query.gte("tracking_date", dateRange.from).lte("tracking_date", dateRange.to);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as TrackingRow[];
    },
  });

  const summary = useMemo(() => computeSummary(summaryRows), [summaryRows]);

  const addRow = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("marketing_tracking").insert({
        client_id: clientId,
        tracking_date: format(new Date(), "yyyy-MM-dd"),
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing-tracking", clientId] });
      toast.success("Neuer Eintrag hinzugefügt");
    },
  });

  const updateCell = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: any }) => {
      const { error } = await supabase
        .from("marketing_tracking")
        .update({ [field]: value } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing-tracking", clientId] });
      qc.invalidateQueries({ queryKey: ["marketing-tracking-summary", clientId] });
    },
  });

  const deleteRow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketing_tracking").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing-tracking", clientId] });
      qc.invalidateQueries({ queryKey: ["marketing-tracking-summary", clientId] });
      toast.success("Eintrag gelöscht");
    },
  });

  const handleBlur = useCallback(
    (id: string, field: string, value: string, type?: string) => {
      let parsed: any = value;
      if (type === "currency" || type === "percent") {
        parsed = parseFloat(value.replace(",", ".").replace("€", "").replace("%", "").trim()) || 0;
      } else if (type === "number") {
        parsed = parseInt(value, 10) || 0;
      }
      updateCell.mutate({ id, field, value: parsed });
    },
    [updateCell]
  );

  const saveNote = useCallback(
    (id: string, note: string) => {
      updateCell.mutate({ id, field: "notes", value: note || null });
    },
    [updateCell]
  );

  const shiftMonth = (dir: number) =>
    setViewMonth((v) => {
      const d = new Date(v.year, v.month + dir);
      return { month: d.getMonth(), year: d.getFullYear() };
    });

  const monthLabel = format(new Date(viewMonth.year, viewMonth.month), "MMMM yyyy", { locale: de });

  const summaryCards: { label: string; value: string; sub?: string; color: string }[] = [
    { label: "Ad Spend", value: `${summary.ad_spend.toFixed(2)} €`, sub: `${summary.days} Tage`, color: "bg-rose-500/10 text-rose-300" },
    { label: "Neue Follower", value: String(summary.new_followers), sub: summary.cpf !== null ? `Ø ${summary.cpf.toFixed(2)} €/F` : undefined, color: "bg-violet-500/10 text-violet-300" },
    { label: "Nachrichten", value: String(summary.dm_sent), sub: `${summary.new_conversations} Konv.`, color: "bg-sky-500/10 text-sky-300" },
    { label: "Termine", value: String(summary.appointments_booked), sub: summary.show_rate !== null ? `Show-Rate ${summary.show_rate.toFixed(0)}%` : undefined, color: "bg-amber-500/10 text-amber-300" },
    { label: "Abschlüsse", value: String(summary.closings), sub: summary.closing_rate !== null ? `Close-Rate ${summary.closing_rate.toFixed(0)}%` : undefined, color: "bg-emerald-500/10 text-emerald-300" },
    { label: "Umsatz (netto)", value: `${summary.revenue_net.toFixed(2)} €`, color: "bg-teal-500/10 text-teal-300" },
  ];

  return (
    <div className="space-y-4">
      {/* Summary Overview */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-violet-500/10">
              <BarChart3 className="h-4.5 w-4.5 text-violet-500" />
            </div>
            <h3 className="font-display text-base font-semibold tracking-tight">Übersicht</h3>
          </div>
          <div className="flex gap-1 bg-muted/30 rounded-lg p-0.5">
            {TIME_RANGES.map((tr) => (
              <button
                key={tr.value}
                onClick={() => setSummaryRange(tr.value)}
                className={cn(
                  "px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider rounded-md transition-all",
                  summaryRange === tr.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tr.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-4">
          {summaryCards.map((card) => (
            <div key={card.label} className={cn("rounded-lg p-3", card.color.split(" ")[0])}>
              <div className={cn("text-[10px] font-mono uppercase opacity-70", card.color.split(" ")[1])}>
                {card.label}
              </div>
              <div className={cn("text-lg font-bold font-mono mt-0.5", card.color.split(" ")[1])}>
                {card.value}
              </div>
              {card.sub && (
                <div className="text-[9px] font-mono text-muted-foreground mt-0.5">{card.sub}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Daily Tracking Table */}
      <div className="rounded-xl border border-border bg-card">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-emerald-500/10">
              <TrendingUp className="h-4.5 w-4.5 text-emerald-500" />
            </div>
            <h3 className="font-display text-base font-semibold tracking-tight">Tages-Tracking</h3>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => shiftMonth(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-mono min-w-[120px] text-center">{monthLabel}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => shiftMonth(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>

            {canEdit && (
              <Button variant="outline" size="sm" className="gap-1.5 ml-3 text-xs" onClick={() => addRow.mutate()} disabled={addRow.isPending}>
                <Plus className="h-3.5 w-3.5" /> Eintrag
              </Button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-12 font-body">
              Noch keine Tracking-Einträge für {monthLabel}
            </div>
          ) : (
            <table className="w-full text-xs font-mono border-collapse">
              <thead>
                <tr>
                  <th className="w-8 px-1 py-2.5 text-[11px] font-semibold border-b border-border bg-muted/20">
                    <MessageSquare className="h-3 w-3 mx-auto text-muted-foreground" />
                  </th>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className={cn(
                        "px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap border-b border-border",
                        col.headerBg
                      )}
                    >
                      {col.label}
                    </th>
                  ))}
                  {canEdit && <th className="w-8 border-b border-border bg-muted/20" />}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIdx) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "transition-colors hover:brightness-125",
                      rowIdx % 2 === 1 && "bg-muted/[0.02]"
                    )}
                  >
                    {/* Notes popover */}
                    <td className="px-1 py-2 border-b border-border/30 bg-muted/[0.02]">
                      <NotePopover
                        note={row.notes}
                        canEdit={canEdit}
                        onSave={(note) => saveNote(row.id, note)}
                      />
                    </td>
                    {COLUMNS.map((col) => {
                      const val = row[col.key];
                      if (col.computed) {
                        return (
                          <td
                            key={col.key}
                            className={cn(
                              "px-3 py-2 text-muted-foreground border-b border-border/30",
                              col.colorClass
                            )}
                          >
                            {formatVal(val as any, col.type)}
                          </td>
                        );
                      }
                      if (col.key === "tracking_date") {
                        return (
                          <td
                            key={col.key}
                            className={cn("px-3 py-2 border-b border-border/30", col.colorClass)}
                          >
                            {canEdit ? (
                              <Input
                                type="date"
                                defaultValue={String(val)}
                                className="h-7 text-xs font-mono bg-transparent border-none px-0 focus-visible:ring-1"
                                onBlur={(e) => handleBlur(row.id, col.key, e.target.value, "text")}
                              />
                            ) : (
                              format(new Date(String(val)), "dd.MM.yyyy")
                            )}
                          </td>
                        );
                      }
                      return (
                        <td
                          key={col.key}
                          className={cn("px-3 py-2 border-b border-border/30", col.colorClass)}
                        >
                          {canEdit ? (
                            <Input
                              defaultValue={val !== null && val !== undefined ? String(val) : ""}
                              placeholder="0"
                              className="h-7 text-xs font-mono bg-transparent border-none px-0 focus-visible:ring-1 w-full"
                              onBlur={(e) => handleBlur(row.id, col.key, e.target.value, col.type)}
                            />
                          ) : (
                            formatVal(val as any, col.type)
                          )}
                        </td>
                      );
                    })}
                    {canEdit && (
                      <td className="px-1 py-2 border-b border-border/30 bg-muted/[0.02]">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteRow.mutate(row.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function NotePopover({ note, canEdit, onSave }: { note: string | null; canEdit: boolean; onSave: (note: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(note || "");
  const hasNote = !!note && note.trim().length > 0;

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setText(note || ""); }}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "h-6 w-6 rounded flex items-center justify-center transition-all mx-auto",
            hasNote
              ? "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25"
              : "text-muted-foreground/30 hover:text-muted-foreground hover:bg-muted/50"
          )}
        >
          <MessageSquare className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" side="right" align="start">
        {canEdit ? (
          <div className="space-y-2">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Notiz hinzufügen..."
              rows={3}
              className="text-xs min-h-[60px] resize-none"
            />
            <div className="flex justify-end gap-1">
              {hasNote && (
                <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive"
                  onClick={() => { onSave(""); setOpen(false); }}>
                  Löschen
                </Button>
              )}
              <Button size="sm" className="h-7 text-xs"
                onClick={() => { onSave(text); setOpen(false); }}>
                Speichern
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground whitespace-pre-wrap">{note || "Keine Notiz"}</p>
        )}
      </PopoverContent>
    </Popover>
  );
}