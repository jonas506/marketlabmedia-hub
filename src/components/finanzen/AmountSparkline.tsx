import { formatEur, formatMonthDe } from "@/lib/finanzen-utils";
import type { ContractMonth } from "@/hooks/useFinanzenData";
import { cn } from "@/lib/utils";

interface Props {
  months: ContractMonth[];
  className?: string;
}

/** Compact bar chart for monthly contract amounts. Highlights variance. */
export default function AmountSparkline({ months, className }: Props) {
  if (months.length === 0) return null;
  const sorted = [...months].sort((a, b) => a.month_number - b.month_number);
  const values = sorted.map((m) => m.amount_netto);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const isVariable = max - min > 0.01;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-end gap-[3px] h-16">
        {sorted.map((m) => {
          const h = max > 0 ? Math.max(8, (m.amount_netto / max) * 100) : 0;
          const isPaid = m.invoice_status === "paid";
          const isSent = m.invoice_status === "sent";
          return (
            <div
              key={m.id}
              className="group relative flex-1 min-w-[6px] rounded-sm transition-all hover:opacity-80"
              style={{ height: `${h}%` }}
              title={`Monat ${m.month_number} · ${formatMonthDe(m.billing_month, m.billing_year)} · ${formatEur(m.amount_netto)}`}
            >
              <div
                className={cn(
                  "absolute inset-0 rounded-sm",
                  isPaid && "bg-green-500/70",
                  isSent && "bg-blue-500/70",
                  !isPaid && !isSent && "bg-muted-foreground/30",
                )}
              />
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        {isVariable ? (
          <>
            <span>Min <strong className="text-foreground">{formatEur(min)}</strong></span>
            <span>Ø <strong className="text-foreground">{formatEur(avg)}</strong></span>
            <span>Max <strong className="text-foreground">{formatEur(max)}</strong></span>
          </>
        ) : (
          <span>Konstant <strong className="text-foreground">{formatEur(avg)}</strong>/Monat</span>
        )}
      </div>
    </div>
  );
}
