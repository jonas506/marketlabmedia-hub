import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { effectiveStatus, formatEur, formatMonthDe, STATUS_BADGE, STATUS_LABEL, type InvoiceStatus } from "@/lib/finanzen-utils";
import type { Contract, ClientLite, ContractMonth } from "@/hooks/useFinanzenData";
import { Link } from "react-router-dom";

const STATUS_RANK: Record<InvoiceStatus, number> = { overdue: 0, due: 1, sent: 2, upcoming: 3, paid: 4 };

interface Row {
  contract: Contract;
  client: ClientLite | undefined;
  currentMonth: ContractMonth | null;
  status: InvoiceStatus;
}

interface Props {
  contracts: Contract[];
  clients: ClientLite[];
  filter: "all" | InvoiceStatus;
  onSelect: (contractId: string) => void;
}

export default function ClientBillingTable({ contracts, clients, filter, onSelect }: Props) {
  const clientMap = new Map(clients.map((c) => [c.id, c]));

  const rows: Row[] = contracts
    .map((contract) => {
      const now = new Date();
      const curMonthKey = now.getFullYear() * 12 + now.getMonth();
      const sortedMonths = [...contract.months].sort((a, b) => a.month_number - b.month_number);
      // Pick current month: matches current calendar month, else first unpaid, else last
      const matched = sortedMonths.find((m) => (m.billing_year * 12 + (m.billing_month - 1)) === curMonthKey);
      const firstUnpaid = sortedMonths.find((m) => m.invoice_status !== "paid");
      const currentMonth = matched ?? firstUnpaid ?? sortedMonths[sortedMonths.length - 1] ?? null;
      const status = currentMonth
        ? effectiveStatus({
            storedStatus: currentMonth.invoice_status,
            billingMonth: currentMonth.billing_month,
            billingYear: currentMonth.billing_year,
            invoiceSentAt: currentMonth.invoice_sent_at,
          })
        : "upcoming";
      return { contract, client: clientMap.get(contract.client_id), currentMonth, status };
    });

  const filtered = filter === "all" ? rows : rows.filter((r) => r.status === filter);
  filtered.sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);

  if (filtered.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
        Keine Verträge in dieser Kategorie
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground border-b">
          <tr>
            <th className="text-left font-medium px-4 py-2">Kunde</th>
            <th className="text-left font-medium px-4 py-2 whitespace-nowrap">Vertrag</th>
            <th className="text-left font-medium px-4 py-2 whitespace-nowrap">Monat</th>
            <th className="text-right font-medium px-4 py-2 whitespace-nowrap">Betrag</th>
            <th className="text-left font-medium px-4 py-2">Status</th>
            <th className="px-2 py-2 w-10"></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.contract.id} className="border-b last:border-0 hover:bg-muted/30">
              <td className="px-4 py-2">
                <Link to={`/client/${r.contract.client_id}`} className="hover:underline font-medium">
                  {r.client?.name ?? "Unbekannt"}
                </Link>
                {r.contract.status !== "active" && (
                  <Badge variant="secondary" className="ml-2 text-[10px]">
                    {r.contract.status === "completed" ? "Abgeschlossen" : "Beendet"}
                  </Badge>
                )}
              </td>
              <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                {r.contract.duration_months} Mo ({r.currentMonth?.month_number ?? "—"}/{r.contract.duration_months})
              </td>
              <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                {r.currentMonth ? formatMonthDe(r.currentMonth.billing_month, r.currentMonth.billing_year) : "—"}
              </td>
              <td className="px-4 py-2 text-right font-medium whitespace-nowrap">
                {r.currentMonth ? formatEur(r.currentMonth.amount_netto) : "—"}
              </td>
              <td className="px-4 py-2">
                <Badge className={STATUS_BADGE[r.status]} variant="outline">{STATUS_LABEL[r.status]}</Badge>
              </td>
              <td className="px-2 py-2">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onSelect(r.contract.id)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
