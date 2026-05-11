import { useState, useEffect } from "react";
import { addMonths } from "date-fns";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import type { Contract } from "@/hooks/useFinanzenData";
import { formatEur } from "@/lib/finanzen-utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: Contract;
}

export default function ExtendContractDialog({ open, onOpenChange, contract }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [addMonthsCount, setAddMonthsCount] = useState(6);
  const lastAmount = contract.months[contract.months.length - 1]?.amount_netto ?? 2500;
  const [amount, setAmount] = useState<number>(lastAmount);

  useEffect(() => {
    if (open) {
      setAddMonthsCount(6);
      setAmount(lastAmount);
    }
  }, [open, lastAmount]);

  const handleExtend = async () => {
    if (addMonthsCount < 1 || amount < 0) return;
    setSaving(true);
    try {
      const last = contract.months[contract.months.length - 1];
      const lastMonthNum = last?.month_number ?? contract.duration_months;
      // Anchor for next billing month: month after last month
      const anchorDate = last
        ? new Date(last.billing_year, last.billing_month - 1, 1)
        : new Date(contract.start_date);

      const newMonths = Array.from({ length: addMonthsCount }, (_, i) => {
        const d = addMonths(anchorDate, i + 1);
        return {
          contract_id: contract.id,
          month_number: lastMonthNum + i + 1,
          billing_month: d.getMonth() + 1,
          billing_year: d.getFullYear(),
          amount_netto: amount,
          invoice_status: "upcoming" as const,
        };
      });

      const newDuration = contract.duration_months + addMonthsCount;
      const newEnd = addMonths(new Date(contract.end_date), addMonthsCount);

      const { error: e1 } = await supabase.from("client_contract_months").insert(newMonths);
      if (e1) throw e1;

      const { error: e2 } = await supabase
        .from("client_contracts")
        .update({
          duration_months: newDuration,
          end_date: newEnd.toISOString().slice(0, 10),
          status: "active",
        })
        .eq("id", contract.id);
      if (e2) throw e2;

      qc.invalidateQueries({ queryKey: ["finanzen-data"] });
      toast({ title: `Vertrag um ${addMonthsCount} Monate verlängert` });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Vertrag verlängern</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-xs text-muted-foreground">
            Aktuell: {contract.duration_months} Monate. Letzter Monatsbetrag: <strong>{formatEur(lastAmount)}</strong>
          </div>

          <div>
            <Label className="text-xs">Anzahl zusätzlicher Monate</Label>
            <Input
              type="number"
              min={1}
              max={36}
              value={addMonthsCount}
              onChange={(e) => setAddMonthsCount(Math.max(1, parseInt(e.target.value || "1", 10)))}
            />
          </div>

          <div>
            <Label className="text-xs">Betrag pro neuem Monat (€ netto)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Du kannst einzelne Beträge danach im Vertrag bearbeiten.
            </p>
          </div>

          <div className="rounded-md bg-muted/40 p-2 text-xs">
            Neue Laufzeit: <strong>{contract.duration_months + addMonthsCount} Monate</strong> ·
            Zusatzwert: <strong>{formatEur(addMonthsCount * amount)}</strong>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Abbrechen</Button>
          <Button onClick={handleExtend} disabled={saving}>{saving ? "Verlängert…" : "Verlängern"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
