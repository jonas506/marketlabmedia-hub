import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";

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

export default function MarketingTracking({ clientId, canEdit }: Props) {
  const qc = useQueryClient();
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return { month: now.getMonth(), year: now.getFullYear() };
  });

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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing-tracking", clientId] }),
  });

  const deleteRow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketing_tracking").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing-tracking", clientId] });
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

  const shiftMonth = (dir: number) =>
    setViewMonth((v) => {
      const d = new Date(v.year, v.month + dir);
      return { month: d.getMonth(), year: d.getFullYear() };
    });

  // Summaries
  const totals = rows.reduce(
    (acc, r) => ({
      ad_spend: acc.ad_spend + Number(r.ad_spend || 0),
      new_followers: acc.new_followers + Number(r.new_followers || 0),
      dm_sent: acc.dm_sent + Number(r.dm_sent || 0),
      new_conversations: acc.new_conversations + Number(r.new_conversations || 0),
      appointments_booked: acc.appointments_booked + Number(r.appointments_booked || 0),
    }),
    { ad_spend: 0, new_followers: 0, dm_sent: 0, new_conversations: 0, appointments_booked: 0 }
  );
  const avgCPF = totals.new_followers > 0 ? totals.ad_spend / totals.new_followers : null;

  const monthLabel = format(new Date(viewMonth.year, viewMonth.month), "MMMM yyyy", { locale: de });

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-emerald-500/10">
            <TrendingUp className="h-4.5 w-4.5 text-emerald-500" />
          </div>
          <h3 className="font-display text-base font-semibold tracking-tight">Marketing Tracking</h3>
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

      {/* Summary cards */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 border-b border-border">
          <div className="rounded-lg bg-rose-500/10 p-3">
            <div className="text-[10px] font-mono uppercase text-rose-400/80">Ausgaben</div>
            <div className="text-base font-bold font-mono text-rose-300">{totals.ad_spend.toFixed(2)} €</div>
          </div>
          <div className="rounded-lg bg-violet-500/10 p-3">
            <div className="text-[10px] font-mono uppercase text-violet-400/80">Neue Follower</div>
            <div className="text-base font-bold font-mono text-violet-300">{totals.new_followers}</div>
          </div>
          <div className="rounded-lg bg-violet-500/10 p-3">
            <div className="text-[10px] font-mono uppercase text-violet-400/80">Ø €/Follower</div>
            <div className="text-base font-bold font-mono text-violet-300">{avgCPF !== null ? `${avgCPF.toFixed(2)} €` : "–"}</div>
          </div>
          <div className="rounded-lg bg-sky-500/10 p-3">
            <div className="text-[10px] font-mono uppercase text-sky-400/80">Nachrichten</div>
            <div className="text-base font-bold font-mono text-sky-300">{totals.dm_sent}</div>
          </div>
          <div className="rounded-lg bg-amber-500/10 p-3">
            <div className="text-[10px] font-mono uppercase text-amber-400/80">Termine</div>
            <div className="text-base font-bold font-mono text-amber-300">{totals.appointments_booked}</div>
          </div>
        </div>
      )}

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
  );
}
