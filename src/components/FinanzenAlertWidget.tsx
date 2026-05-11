import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { useFinanzenData } from "@/hooks/useFinanzenData";
import { effectiveStatus } from "@/lib/finanzen-utils";

export default function FinanzenAlertWidget() {
  const { data } = useFinanzenData();
  if (!data) return null;

  let due = 0;
  let overdue = 0;
  for (const c of data.contracts) {
    for (const m of c.months) {
      const eff = effectiveStatus({
        storedStatus: m.invoice_status,
        billingMonth: m.billing_month,
        billingYear: m.billing_year,
        invoiceSentAt: m.invoice_sent_at,
      });
      if (eff === "due") due++;
      else if (eff === "overdue") overdue++;
    }
  }
  for (const p of data.projects) {
    const eff = effectiveStatus({ storedStatus: p.invoice_status, invoiceSentAt: p.invoice_sent_at });
    if (eff === "overdue") overdue++;
  }

  if (due === 0 && overdue === 0) return null;

  return (
    <Link
      to="/finanzen"
      className="flex items-center justify-between gap-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 hover:bg-yellow-500/15 transition-colors"
    >
      <div className="flex items-center gap-2 text-sm">
        <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
        <span>
          {due > 0 && <><span className="font-medium">{due}</span> Rechnung{due === 1 ? "" : "en"} offen</>}
          {due > 0 && overdue > 0 && " · "}
          {overdue > 0 && <span className="text-red-600 dark:text-red-400 font-medium">{overdue} überfällig</span>}
        </span>
      </div>
      <span className="text-xs text-muted-foreground">Finanzen öffnen →</span>
    </Link>
  );
}
