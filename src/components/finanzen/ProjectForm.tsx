import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import type { ClientLite } from "@/hooks/useFinanzenData";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: ClientLite[];
  defaultClientId?: string;
}

export default function ProjectForm({ open, onOpenChange, clients, defaultClientId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [clientId, setClientId] = useState<string>("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setClientId(defaultClientId ?? "");
      setName("");
      setAmount("");
      setDueDate("");
      setNote("");
    }
  }, [open, defaultClientId]);

  const handleSave = async () => {
    const amt = parseFloat(amount.replace(",", "."));
    if (!clientId || !name || !Number.isFinite(amt)) {
      toast({ title: "Bitte alle Pflichtfelder ausfüllen", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("client_projects").insert({
        client_id: clientId,
        name,
        amount_netto: amt,
        due_date: dueDate || null,
        note: note || null,
        invoice_status: "upcoming",
      });
      if (error) throw error;
      toast({ title: "Projekt hinzugefügt" });
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Projekt hinzufügen</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Kunde</Label>
            <Select value={clientId} onValueChange={setClientId} disabled={!!defaultClientId}>
              <SelectTrigger><SelectValue placeholder="Kunde wählen" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Projektname</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Pitch Deck" />
          </div>
          <div>
            <Label className="text-xs">Betrag (€ netto)</Label>
            <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Fällig am (optional)</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Notiz (optional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Speichert…" : "Hinzufügen"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
