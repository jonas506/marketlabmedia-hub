import { useEffect, useMemo, useRef, useState } from "react";
import { Undo2 } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ToastAction } from "@/components/ui/toast";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  effectiveStatus,
  formatEur,
  STATUS_LABEL,
  type InvoiceStatus,
} from "@/lib/finanzen-utils";
import type { ClientLite, Contract, ContractMonth } from "@/hooks/useFinanzenData";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  clients: ClientLite[];
  contracts: Contract[];
}

const MONTHS_VISIBLE = 12;

const CELL_STYLES: Record<InvoiceStatus | "empty", string> = {
  empty: "bg-muted/30 text-muted-foreground/50",
  upcoming: "bg-muted/60 text-muted-foreground hover:bg-muted",
  due: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/25 ring-1 ring-yellow-500/30",
  sent: "bg-blue-500/15 text-blue-700 dark:text-blue-400 hover:bg-blue-500/25 ring-1 ring-blue-500/30",
  paid: "bg-green-500/15 text-green-700 dark:text-green-400 hover:bg-green-500/25 ring-1 ring-green-500/30",
  overdue: "bg-red-500/20 text-red-700 dark:text-red-400 hover:bg-red-500/30 ring-1 ring-red-500/40",
};

export default function MonthlyOverview({ clients, contracts }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const today = new Date();
  const [offset, setOffset] = useState(-2); // start 2 months before current

  // Build month columns
  const months = useMemo(() => {
    const arr: { month: number; year: number; label: string; isCurrent: boolean }[] = [];
    for (let i = 0; i < MONTHS_VISIBLE; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + offset + i, 1);
      arr.push({
        month: d.getMonth() + 1,
        year: d.getFullYear(),
        label: format(d, "LLL yy", { locale: de }),
        isCurrent: d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear(),
      });
    }
    return arr;
  }, [offset]);

  // Build lookup: clientId -> "year-month" -> ContractMonth
  const lookup = useMemo(() => {
    const map = new Map<string, Map<string, ContractMonth>>();
    for (const c of contracts) {
      let cm = map.get(c.client_id);
      if (!cm) {
        cm = new Map();
        map.set(c.client_id, cm);
      }
      for (const m of c.months) {
        cm.set(`${m.billing_year}-${m.billing_month}`, m);
      }
    }
    return map;
  }, [contracts]);

  // Only show clients with at least one contract month
  const visibleClients = useMemo(
    () => clients.filter((c) => lookup.has(c.id)),
    [clients, lookup],
  );

  // Column totals
  const columnTotals = useMemo(() => {
    return months.map((col) => {
      let total = 0;
      let paid = 0;
      let open = 0;
      for (const c of visibleClients) {
        const m = lookup.get(c.id)?.get(`${col.year}-${col.month}`);
        if (!m) continue;
        total += m.amount_netto;
        if (m.invoice_status === "paid") paid += m.amount_netto;
        else open += m.amount_netto;
      }
      return { total, paid, open };
    });
  }, [months, visibleClients, lookup]);

  const applyPatch = async (id: string, patch: Partial<ContractMonth>) => {
    const { error } = await supabase.from("client_contract_months").update(patch).eq("id", id);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return false;
    }
    qc.invalidateQueries({ queryKey: ["finanzen-data"] });
    return true;
  };

  const cycleStatus = async (m: ContractMonth) => {
    // Cycle: upcoming/due → sent → paid → upcoming
    const todayStr = format(new Date(), "yyyy-MM-dd");
    let patch: Partial<ContractMonth> = {};
    if (m.invoice_status === "paid") {
      patch = { invoice_status: "upcoming", invoice_sent_at: null, invoice_paid_at: null };
    } else if (m.invoice_status === "sent") {
      patch = { invoice_status: "paid", invoice_paid_at: todayStr };
    } else {
      patch = { invoice_status: "sent", invoice_sent_at: todayStr };
    }
    const prevPatch: Partial<ContractMonth> = {
      invoice_status: m.invoice_status,
      invoice_sent_at: m.invoice_sent_at,
      invoice_paid_at: m.invoice_paid_at,
    };
    const ok = await applyPatch(m.id, patch);
    if (!ok) return;
    toast({
      title: `Status: ${STATUS_LABEL[patch.invoice_status as InvoiceStatus]}`,
      description: `${STATUS_LABEL[m.invoice_status]} → ${STATUS_LABEL[patch.invoice_status as InvoiceStatus]}`,
      action: (
        <ToastAction altText="Rückgängig" onClick={() => applyPatch(m.id, prevPatch)}>
          Rückgängig
        </ToastAction>
      ),
    });
  };

  return (
    <div className="rounded-lg border bg-card">
      {/* Header controls */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b">
        <div>
          <h2 className="text-sm font-semibold">Monatsübersicht</h2>
          <p className="text-xs text-muted-foreground">Klick auf eine Zelle wechselt den Status.</p>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => setOffset((o) => o - 3)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOffset(-2)} className="text-xs">
            Heute
          </Button>
          <Button size="sm" variant="outline" onClick={() => setOffset((o) => o + 3)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <TooltipProvider delayDuration={200}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-card text-left font-medium px-3 py-2 border-b min-w-[180px]">
                  Kunde
                </th>
                {months.map((col) => (
                  <th
                    key={`${col.year}-${col.month}`}
                    className={cn(
                      "text-center font-medium px-2 py-2 border-b min-w-[78px]",
                      col.isCurrent && "bg-primary/5 text-primary",
                    )}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleClients.length === 0 ? (
                <tr>
                  <td colSpan={months.length + 1} className="text-center text-muted-foreground py-8">
                    Keine Verträge vorhanden.
                  </td>
                </tr>
              ) : (
                visibleClients.map((c) => (
                  <tr key={c.id} className="group">
                    <td className="sticky left-0 z-10 bg-card group-hover:bg-muted/30 px-3 py-1.5 border-b font-medium truncate max-w-[200px]">
                      {c.name}
                    </td>
                    {months.map((col) => {
                      const m = lookup.get(c.id)?.get(`${col.year}-${col.month}`);
                      if (!m) {
                        return (
                          <td
                            key={`${col.year}-${col.month}`}
                            className={cn("border-b p-1", col.isCurrent && "bg-primary/[0.03]")}
                          >
                            <div className={cn("h-9 rounded flex items-center justify-center", CELL_STYLES.empty)}>
                              –
                            </div>
                          </td>
                        );
                      }
                      const eff = effectiveStatus({
                        storedStatus: m.invoice_status,
                        billingMonth: m.billing_month,
                        billingYear: m.billing_year,
                        invoiceSentAt: m.invoice_sent_at,
                      });
                      return (
                        <td
                          key={`${col.year}-${col.month}`}
                          className={cn("border-b p-1", col.isCurrent && "bg-primary/[0.03]")}
                        >
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => cycleStatus(m)}
                                className={cn(
                                  "h-9 w-full rounded flex flex-col items-center justify-center transition-colors px-1 leading-tight",
                                  CELL_STYLES[eff],
                                )}
                              >
                                <span className="font-medium tabular-nums">
                                  {m.amount_netto > 0 ? formatEur(m.amount_netto).replace(",00", "") : "—"}
                                </span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              <div className="font-medium">{c.name} · {col.label}</div>
                              <div>Status: {STATUS_LABEL[eff]}</div>
                              <div>Betrag: {formatEur(m.amount_netto)}</div>
                              {m.invoice_sent_at && <div>Gestellt: {m.invoice_sent_at}</div>}
                              {m.invoice_paid_at && <div>Bezahlt: {m.invoice_paid_at}</div>}
                              <div className="text-muted-foreground mt-1">Klick: nächster Status</div>
                            </TooltipContent>
                          </Tooltip>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
            {visibleClients.length > 0 && (
              <tfoot>
                <tr>
                  <td className="sticky left-0 z-10 bg-card px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground border-t">
                    Summe
                  </td>
                  {columnTotals.map((t, i) => (
                    <td
                      key={i}
                      className={cn(
                        "text-center px-1 py-2 border-t",
                        months[i].isCurrent && "bg-primary/[0.03]",
                      )}
                    >
                      <div className="text-[11px] font-semibold tabular-nums">
                        {t.total > 0 ? formatEur(t.total).replace(",00", "") : "—"}
                      </div>
                      {t.open > 0 && (
                        <div className="text-[10px] text-muted-foreground tabular-nums">
                          offen {formatEur(t.open).replace(",00", "")}
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </TooltipProvider>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-t text-[11px] text-muted-foreground">
        <LegendDot className="bg-muted" label="Nicht gestellt" />
        <LegendDot className="bg-yellow-500/40" label="Fällig" />
        <LegendDot className="bg-blue-500/40" label="Gestellt" />
        <LegendDot className="bg-green-500/40" label="Bezahlt" />
        <LegendDot className="bg-red-500/40" label="Überfällig" />
      </div>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-sm", className)} />
      {label}
    </span>
  );
}
