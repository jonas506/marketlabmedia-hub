import { useState, useMemo, useEffect } from "react";
import { addMonths, format } from "date-fns";
import { de } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import type { Contract, ClientLite } from "@/hooks/useFinanzenData";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: ClientLite[];
  existingContracts: Contract[];
  /** When provided, edits this contract */
  editContract?: Contract | null;
}

export default function ContractForm({ open, onOpenChange, clients, existingContracts, editContract }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [clientId, setClientId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [billingStartDate, setBillingStartDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [duration, setDuration] = useState<number>(6);
  const [note, setNote] = useState<string>("");
  const [amounts, setAmounts] = useState<number[]>(Array(6).fill(2500));

  // Bulk-fill helpers
  const [bulkAmount, setBulkAmount] = useState<string>("");
  const [splitPoint, setSplitPoint] = useState<string>("3");
  const [splitA, setSplitA] = useState<string>("");
  const [splitB, setSplitB] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    if (editContract) {
      setClientId(editContract.client_id);
      setStartDate(editContract.start_date);
      setBillingStartDate(editContract.billing_start_date ?? editContract.start_date);
      setDuration(editContract.duration_months);
      setNote(editContract.note ?? "");
      const sorted = [...editContract.months].sort((a, b) => a.month_number - b.month_number);
      setAmounts(sorted.map((m) => m.amount_netto));
    } else {
      setClientId("");
      const today = format(new Date(), "yyyy-MM-dd");
      setStartDate(today);
      setBillingStartDate(today);
      setDuration(6);
      setNote("");
      setAmounts(Array(6).fill(2500));
    }
  }, [open, editContract]);

  // Resize amounts when duration changes
  useEffect(() => {
    setAmounts((prev) => {
      if (prev.length === duration) return prev;
      if (prev.length > duration) return prev.slice(0, duration);
      const last = prev[prev.length - 1] ?? 2500;
      return [...prev, ...Array(duration - prev.length).fill(last)];
    });
  }, [duration]);

  const months = useMemo(() => {
    const arr: { num: number; label: string }[] = [];
    const start = new Date(billingStartDate || startDate);
    for (let i = 0; i < duration; i++) {
      const d = addMonths(start, i);
      arr.push({ num: i + 1, label: format(d, "LLL yyyy", { locale: de }) });
    }
    return arr;
  }, [billingStartDate, startDate, duration]);

  const availableClients = useMemo(() => {
    const blocked = new Set(
      existingContracts
        .filter((c) => c.status === "active" && (!editContract || c.id !== editContract.id))
        .map((c) => c.client_id),
    );
    return clients.filter((c) => !blocked.has(c.id));
  }, [clients, existingContracts, editContract]);

  const total = amounts.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);

  const applyBulk = () => {
    const v = parseFloat(bulkAmount.replace(",", "."));
    if (!Number.isFinite(v)) return;
    setAmounts(Array(duration).fill(v));
  };

  const applySplit = () => {
    const sp = parseInt(splitPoint, 10);
    const a = parseFloat(splitA.replace(",", "."));
    const b = parseFloat(splitB.replace(",", "."));
    if (!Number.isFinite(sp) || !Number.isFinite(a) || !Number.isFinite(b)) return;
    setAmounts(amounts.map((_, i) => (i + 1 <= sp ? a : b)));
  };

  const handleSave = async () => {
    if (!clientId) {
      toast({ title: "Bitte Kunde wählen", variant: "destructive" });
      return;
    }
    if (amounts.some((a) => !Number.isFinite(a) || a < 0)) {
      toast({ title: "Ungültige Beträge", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const start = new Date(startDate);
      const billingStart = new Date(billingStartDate || startDate);
      const end = addMonths(billingStart, duration);
      end.setDate(end.getDate() - 1);
      const endStr = format(end, "yyyy-MM-dd");

      let contractId = editContract?.id;

      if (editContract) {
        const { error } = await supabase
          .from("client_contracts")
          .update({
            client_id: clientId,
            start_date: startDate,
            billing_start_date: billingStartDate || startDate,
            end_date: endStr,
            duration_months: duration,
            note: note || null,
          })
          .eq("id", editContract.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("client_contracts")
          .insert({
            client_id: clientId,
            start_date: startDate,
            billing_start_date: billingStartDate || startDate,
            end_date: endStr,
            duration_months: duration,
            note: note || null,
            status: "active",
          })
          .select("id")
          .single();
        if (error) throw error;
        contractId = data.id;
      }

      // Replace months entirely
      if (editContract) {
        await supabase.from("client_contract_months").delete().eq("contract_id", contractId!);
      }

      const monthRows = amounts.map((amount, i) => {
        const d = addMonths(billingStart, i);
        return {
          contract_id: contractId!,
          month_number: i + 1,
          billing_month: d.getMonth() + 1,
          billing_year: d.getFullYear(),
          amount_netto: amount,
          invoice_status: "upcoming",
        };
      });

      // Preserve old status if editing
      if (editContract) {
        const oldByNum = new Map(editContract.months.map((m) => [m.month_number, m]));
        for (const row of monthRows) {
          const old = oldByNum.get(row.month_number);
          if (old) {
            (row as any).invoice_status = old.invoice_status;
            (row as any).invoice_sent_at = old.invoice_sent_at;
            (row as any).invoice_paid_at = old.invoice_paid_at;
          }
        }
      }

      const { error: insErr } = await supabase.from("client_contract_months").insert(monthRows);
      if (insErr) throw insErr;

      toast({ title: editContract ? "Vertrag aktualisiert" : "Vertrag angelegt" });
      qc.invalidateQueries({ queryKey: ["finanzen-data"] });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editContract ? "Vertrag bearbeiten" : "Neuen Vertrag anlegen"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Kunde</Label>
              <Select value={clientId} onValueChange={setClientId} disabled={!!editContract}>
                <SelectTrigger><SelectValue placeholder="Kunde wählen" /></SelectTrigger>
                <SelectContent>
                  {availableClients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Startdatum</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Laufzeit (Monate)</Label>
              <Input
                type="number"
                min={1}
                max={36}
                value={duration}
                onChange={(e) => setDuration(Math.max(1, Math.min(36, parseInt(e.target.value || "1", 10))))}
              />
            </div>
            <div>
              <Label className="text-xs">Notiz</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
            </div>
          </div>

          <div className="rounded-lg border bg-card p-3 space-y-2">
            <div className="text-xs font-medium">Monatliche Beträge (netto)</div>
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {months.map((m, idx) => (
                <div key={m.num} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-32">Monat {m.num} ({m.label})</span>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={amounts[idx] ?? ""}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setAmounts((prev) => prev.map((p, i) => (i === idx ? (Number.isFinite(v) ? v : 0) : p)));
                    }}
                    className="h-8 w-32"
                  />
                  <span className="text-xs text-muted-foreground">€ netto</span>
                </div>
              ))}
            </div>

            <div className="border-t pt-2 mt-2 space-y-2">
              <div className="text-[11px] text-muted-foreground">💡 Schnellausfüllung</div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="number"
                  placeholder="Alle gleich (€)"
                  value={bulkAmount}
                  onChange={(e) => setBulkAmount(e.target.value)}
                  className="h-8 w-40"
                />
                <Button type="button" size="sm" variant="outline" onClick={applyBulk}>Alle setzen</Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Staffelung: bis Monat</span>
                <Input
                  type="number"
                  min={1}
                  max={duration - 1}
                  value={splitPoint}
                  onChange={(e) => setSplitPoint(e.target.value)}
                  className="h-8 w-16"
                />
                <Input type="number" placeholder="Betrag A" value={splitA} onChange={(e) => setSplitA(e.target.value)} className="h-8 w-28" />
                <span className="text-xs text-muted-foreground">danach</span>
                <Input type="number" placeholder="Betrag B" value={splitB} onChange={(e) => setSplitB(e.target.value)} className="h-8 w-28" />
                <Button type="button" size="sm" variant="outline" onClick={applySplit}>Anwenden</Button>
              </div>
            </div>

            <div className="border-t pt-2 text-sm font-medium">
              Gesamtwert: {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(total)}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Speichert…" : editContract ? "Speichern" : "Vertrag anlegen"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

