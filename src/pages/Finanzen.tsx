import { useState, useMemo } from "react";
import { Navigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useFinanzenData } from "@/hooks/useFinanzenData";
import BillingSummaryCards from "@/components/finanzen/BillingSummaryCards";
import ClientBillingTable from "@/components/finanzen/ClientBillingTable";
import ClientBillingDetail from "@/components/finanzen/ClientBillingDetail";
import ContractForm from "@/components/finanzen/ContractForm";
import ProjectForm from "@/components/finanzen/ProjectForm";
import MonthlyOverview from "@/components/finanzen/MonthlyOverview";
import { effectiveStatus, type InvoiceStatus } from "@/lib/finanzen-utils";

const FILTERS: { key: "all" | InvoiceStatus; label: string }[] = [
  { key: "all", label: "Alle" },
  { key: "due", label: "Offen" },
  { key: "sent", label: "Gestellt" },
  { key: "paid", label: "Bezahlt" },
  { key: "overdue", label: "Überfällig" },
];

export default function Finanzen() {
  const { role, loading } = useAuth();
  const { data, isLoading } = useFinanzenData();
  const [filter, setFilter] = useState<"all" | InvoiceStatus>("all");
  const [view, setView] = useState<"list" | "matrix">("matrix");
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [contractFormOpen, setContractFormOpen] = useState(false);
  const [projectFormOpen, setProjectFormOpen] = useState(false);

  const summary = useMemo(() => {
    const buckets = {
      due: { total: 0, count: 0 },
      sent: { total: 0, count: 0 },
      paid: { total: 0, count: 0 },
      overdue: { total: 0, count: 0 },
    };
    if (!data) return buckets;

    const now = new Date();
    const curMonth = now.getMonth() + 1;
    const curYear = now.getFullYear();

    for (const c of data.contracts) {
      for (const m of c.months) {
        const eff = effectiveStatus({
          storedStatus: m.invoice_status,
          billingMonth: m.billing_month,
          billingYear: m.billing_year,
          invoiceSentAt: m.invoice_sent_at,
        });
        if (eff === "due") {
          buckets.due.total += m.amount_netto;
          buckets.due.count++;
        } else if (eff === "sent") {
          buckets.sent.total += m.amount_netto;
          buckets.sent.count++;
        } else if (eff === "overdue") {
          buckets.overdue.total += m.amount_netto;
          buckets.overdue.count++;
        } else if (eff === "paid" && m.invoice_paid_at) {
          const d = new Date(m.invoice_paid_at);
          if (d.getMonth() + 1 === curMonth && d.getFullYear() === curYear) {
            buckets.paid.total += m.amount_netto;
            buckets.paid.count++;
          }
        }
      }
    }
    for (const p of data.projects) {
      const eff = effectiveStatus({ storedStatus: p.invoice_status, invoiceSentAt: p.invoice_sent_at });
      if (eff === "sent") {
        buckets.sent.total += p.amount_netto;
        buckets.sent.count++;
      } else if (eff === "overdue") {
        buckets.overdue.total += p.amount_netto;
        buckets.overdue.count++;
      } else if (eff === "upcoming" && p.due_date) {
        const d = new Date(p.due_date);
        if (d <= now) {
          buckets.due.total += p.amount_netto;
          buckets.due.count++;
        }
      } else if (eff === "paid" && p.invoice_paid_at) {
        const d = new Date(p.invoice_paid_at);
        if (d.getMonth() + 1 === curMonth && d.getFullYear() === curYear) {
          buckets.paid.total += p.amount_netto;
          buckets.paid.count++;
        }
      }
    }
    return buckets;
  }, [data]);

  if (loading) return <AppLayout><div className="p-6 text-sm text-muted-foreground">Lade…</div></AppLayout>;
  if (role !== "admin") return <Navigate to="/" replace />;

  const selectedContract = data?.contracts.find((c) => c.id === selectedContractId) ?? null;
  const selectedClient = selectedContract ? data?.clients.find((c) => c.id === selectedContract.client_id) : null;
  const selectedProjects = selectedContract ? (data?.projects.filter((p) => p.client_id === selectedContract.client_id) ?? []) : [];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Finanzen</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Verträge, Retainer und Rechnungsstatus</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setProjectFormOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Projekt
            </Button>
            <Button size="sm" onClick={() => setContractFormOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Vertrag anlegen
            </Button>
          </div>
        </div>

        <BillingSummaryCards {...summary} />

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={filter === f.key ? "default" : "outline"}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        {isLoading || !data ? (
          <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">Lade Daten…</div>
        ) : (
          <ClientBillingTable
            contracts={data.contracts}
            clients={data.clients}
            filter={filter}
            onSelect={setSelectedContractId}
          />
        )}

        <ClientBillingDetail
          open={!!selectedContractId}
          onOpenChange={(o) => !o && setSelectedContractId(null)}
          contract={selectedContract}
          clientName={selectedClient?.name ?? ""}
          projects={selectedProjects}
          clients={data?.clients ?? []}
          allContracts={data?.contracts ?? []}
        />

        <ContractForm
          open={contractFormOpen}
          onOpenChange={setContractFormOpen}
          clients={data?.clients ?? []}
          existingContracts={data?.contracts ?? []}
        />

        <ProjectForm
          open={projectFormOpen}
          onOpenChange={setProjectFormOpen}
          clients={data?.clients ?? []}
        />
      </div>
    </AppLayout>
  );
}
