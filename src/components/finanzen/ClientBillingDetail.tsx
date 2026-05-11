import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Trash2, Pencil, XCircle, Plus, Clock, CalendarPlus } from "lucide-react";
import { format } from "date-fns";
import {
  effectiveStatus, formatDateDe, formatEur, formatMonthDe, STATUS_BADGE, STATUS_LABEL,
} from "@/lib/finanzen-utils";
import type { ClientLite, ClientProject, Contract, ContractMonth } from "@/hooks/useFinanzenData";
import ContractForm from "./ContractForm";
import ProjectForm from "./ProjectForm";
import ExtendContractDialog from "./ExtendContractDialog";
import AmountSparkline from "./AmountSparkline";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: Contract | null;
  clientName: string;
  projects: ClientProject[];
  clients: ClientLite[];
  allContracts: Contract[];
}

export default function ClientBillingDetail({
  open, onOpenChange, contract, clientName, projects, clients, allContracts,
}: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);

  if (!contract) return null;

  const totalValue = contract.months.reduce((sum, m) => sum + m.amount_netto, 0);
  const paidValue = contract.months.filter((m) => m.invoice_status === "paid").reduce((s, m) => s + m.amount_netto, 0);
  const paidPct = totalValue > 0 ? Math.round((paidValue / totalValue) * 100) : 0;
  const currentMonthNum = contract.months.find((m) => m.invoice_status !== "paid")?.month_number ?? contract.duration_months;
  const hasIssued = contract.months.some((m) => m.invoice_status === "sent" || m.invoice_status === "paid");

  const updateMonth = async (m: ContractMonth, patch: Partial<ContractMonth>) => {
    const { error } = await supabase.from("client_contract_months").update(patch).eq("id", m.id);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["finanzen-data"] });
    toast({ title: "Status aktualisiert" });
  };

  const updateProject = async (p: ClientProject, patch: Partial<ClientProject>) => {
    const { error } = await supabase.from("client_projects").update(patch).eq("id", p.id);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["finanzen-data"] });
    toast({ title: "Status aktualisiert" });
  };

  const deleteProject = async (p: ClientProject) => {
    const { error } = await supabase.from("client_projects").delete().eq("id", p.id);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["finanzen-data"] });
  };

  const cancelContract = async () => {
    const { error } = await supabase.from("client_contracts").update({ status: "cancelled" }).eq("id", contract.id);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["finanzen-data"] });
    toast({ title: "Vertrag beendet" });
  };

  const deleteContract = async () => {
    const { error: e1 } = await supabase.from("client_contract_months").delete().eq("contract_id", contract.id);
    if (e1) {
      toast({ title: "Fehler", description: e1.message, variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("client_contracts").delete().eq("id", contract.id);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["finanzen-data"] });
    toast({ title: "Vertrag gelöscht" });
    onOpenChange(false);
  };

  const today = format(new Date(), "yyyy-MM-dd");

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{clientName}</SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-6">
            {/* Contract Info */}
            <div className="rounded-lg border bg-card p-4 space-y-2">
              <div className="text-sm">
                Vertrag: <span className="font-medium">{formatDateDe(contract.start_date)} – {formatDateDe(contract.end_date)}</span>
                {" "}({contract.duration_months} Monate)
              </div>
              <div className="text-sm flex items-center gap-2">
                Status:
                <Badge variant={contract.status === "active" ? "default" : "secondary"}>
                  {contract.status === "active" ? "Aktiv" : contract.status === "completed" ? "Abgeschlossen" : "Beendet"}
                </Badge>
                <span className="text-muted-foreground">(Monat {currentMonthNum} von {contract.duration_months})</span>
              </div>
              <div className="text-sm">Gesamtwert: <span className="font-medium">{formatEur(totalValue)}</span> netto</div>
              <div className="text-sm">Davon bezahlt: <span className="font-medium">{formatEur(paidValue)}</span> ({paidPct}%)</div>
              <Progress value={paidPct} className="h-2" />
              {contract.note && <div className="text-xs text-muted-foreground italic">„{contract.note}"</div>}

              <div className="pt-3 border-t mt-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">Monatsverlauf</div>
                <AmountSparkline months={contract.months} />
              </div>
            </div>

            {/* Monthly Invoices */}
            <div>
              <div className="text-sm font-medium mb-2">Monatliche Rechnungen</div>
              <div className="space-y-1.5">
                {(() => {
                  const maxAmount = Math.max(...contract.months.map((m) => m.amount_netto), 1);
                  return contract.months.map((m) => {
                    const eff = effectiveStatus({
                      storedStatus: m.invoice_status,
                      billingMonth: m.billing_month,
                      billingYear: m.billing_year,
                      invoiceSentAt: m.invoice_sent_at,
                    });
                    const widthPct = (m.amount_netto / maxAmount) * 100;
                    return (
                  <div key={m.id} className="relative flex items-center gap-2 rounded-md border bg-card px-3 py-2 overflow-hidden">
                    <div
                      className={cn(
                        "absolute inset-y-0 left-0 opacity-[0.07]",
                        m.invoice_status === "paid" ? "bg-green-500" : m.invoice_status === "sent" ? "bg-blue-500" : "bg-foreground",
                      )}
                      style={{ width: `${widthPct}%` }}
                    />
                    <div className="flex-1 min-w-0 relative">
                      <div className="text-sm">
                        Monat {m.month_number} · {formatMonthDe(m.billing_month, m.billing_year)} · <span className="font-medium">{formatEur(m.amount_netto)}</span>
                      </div>
                      {(m.invoice_sent_at || m.invoice_paid_at) && (
                        <div className="text-[11px] text-muted-foreground">
                          {m.invoice_sent_at && <>Gestellt: {formatDateDe(m.invoice_sent_at)} </>}
                          {m.invoice_paid_at && <>· Bezahlt: {formatDateDe(m.invoice_paid_at)}</>}
                        </div>
                      )}
                    </div>
                      <Badge className={STATUS_BADGE[eff]} variant="outline">{STATUS_LABEL[eff]}</Badge>
                      {m.invoice_status !== "paid" && m.invoice_status !== "sent" && (
                        <Button size="sm" variant="outline" onClick={() => updateMonth(m, { invoice_status: "sent", invoice_sent_at: today })}>
                          <Clock className="h-3 w-3 mr-1" /> Gestellt
                        </Button>
                      )}
                      {m.invoice_status === "sent" && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => updateMonth(m, { invoice_status: "upcoming", invoice_sent_at: null })}>
                            Rückgängig
                          </Button>
                          <Button size="sm" onClick={() => updateMonth(m, { invoice_status: "paid", invoice_paid_at: today })}>
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Bezahlt
                          </Button>
                        </>
                      )}
                      {m.invoice_status === "paid" && (
                        <Button size="sm" variant="ghost" onClick={() => updateMonth(m, { invoice_status: "sent", invoice_paid_at: null })}>
                          Rückgängig
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Projects */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium">Zusätzliche Projekte</div>
                <Button size="sm" variant="outline" onClick={() => setProjectFormOpen(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Projekt hinzufügen
                </Button>
              </div>
              {projects.length === 0 ? (
                <div className="text-xs text-muted-foreground italic px-3 py-2">Keine zusätzlichen Projekte</div>
              ) : (
                <div className="space-y-1.5">
                  {projects.map((p) => {
                    const eff = effectiveStatus({
                      storedStatus: p.invoice_status,
                      invoiceSentAt: p.invoice_sent_at,
                    });
                    return (
                      <div key={p.id} className="flex items-center gap-2 rounded-md border bg-card px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate">{p.name} · <span className="font-medium">{formatEur(p.amount_netto)}</span></div>
                          {(p.due_date || p.invoice_sent_at || p.invoice_paid_at) && (
                            <div className="text-[11px] text-muted-foreground">
                              {p.due_date && <>Fällig: {formatDateDe(p.due_date)} </>}
                              {p.invoice_sent_at && <>· Gestellt: {formatDateDe(p.invoice_sent_at)} </>}
                              {p.invoice_paid_at && <>· Bezahlt: {formatDateDe(p.invoice_paid_at)}</>}
                            </div>
                          )}
                        </div>
                        <Badge className={STATUS_BADGE[eff]} variant="outline">{STATUS_LABEL[eff]}</Badge>
                        {p.invoice_status === "upcoming" && (
                          <Button size="sm" variant="outline" onClick={() => updateProject(p, { invoice_status: "sent", invoice_sent_at: today })}>
                            Gestellt
                          </Button>
                        )}
                        {p.invoice_status === "sent" && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => updateProject(p, { invoice_status: "upcoming", invoice_sent_at: null })}>
                              Rückgängig
                            </Button>
                            <Button size="sm" onClick={() => updateProject(p, { invoice_status: "paid", invoice_paid_at: today })}>
                              Bezahlt
                            </Button>
                          </>
                        )}
                        {p.invoice_status === "paid" && (
                          <Button size="sm" variant="ghost" onClick={() => updateProject(p, { invoice_status: "sent", invoice_paid_at: null })}>
                            Rückgängig
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground"><Trash2 className="h-3.5 w-3.5" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Projekt löschen?</AlertDialogTitle>
                              <AlertDialogDescription>„{p.name}" wird unwiderruflich entfernt.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteProject(p)}>Löschen</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="border-t pt-4 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="h-3 w-3 mr-1" /> Vertrag bearbeiten
              </Button>
              {contract.status === "active" && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm"><XCircle className="h-3 w-3 mr-1" /> Vertrag beenden</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Vertrag beenden?</AlertDialogTitle>
                      <AlertDialogDescription>Der Vertrag wird auf "Beendet" gesetzt. Bestehende Rechnungen bleiben erhalten.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                      <AlertDialogAction onClick={cancelContract}>Beenden</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-3 w-3 mr-1" /> Vertrag löschen
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Vertrag wirklich komplett löschen?</AlertDialogTitle>
                    <AlertDialogDescription>Der Vertrag inkl. <strong>aller Monate, gestellten und bezahlten Rechnungen</strong> wird unwiderruflich gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction onClick={deleteContract}>Löschen</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <ContractForm
        open={editOpen}
        onOpenChange={setEditOpen}
        clients={clients}
        existingContracts={allContracts}
        editContract={contract}
      />
      <ProjectForm
        open={projectFormOpen}
        onOpenChange={setProjectFormOpen}
        clients={clients}
        defaultClientId={contract.client_id}
      />
    </>
  );
}
