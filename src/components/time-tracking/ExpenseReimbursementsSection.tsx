import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, Send, Check, Paperclip, Receipt, Upload, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  isAdmin: boolean;
  profiles: { user_id: string; name: string | null }[];
  memberFilter: string;
  month: number;
  year: number;
}

const CATEGORIES: { value: string; label: string }[] = [
  { value: "equipment", label: "Equipment" },
  { value: "office", label: "Büromaterial" },
  { value: "gifts", label: "Geschenke / Blumen" },
  { value: "software", label: "Software / Abos" },
  { value: "food", label: "Verpflegung Team" },
  { value: "sonstiges", label: "Sonstiges" },
];

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.map(c => [c.value, c.label])
);

export default function ExpenseReimbursementsSection({ isAdmin, profiles, memberFilter, month, year }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const today = new Date().toISOString().split("T")[0];
  const [expenseDate, setExpenseDate] = useState(today);
  const [category, setCategory] = useState("equipment");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [vendor, setVendor] = useState("");
  const [note, setNote] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const queryKey = ["expense-reimbursements", month, year, user?.id, isAdmin, memberFilter];

  const { data: items = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!user) return [];
      let q = supabase
        .from("expense_reimbursements")
        .select("*")
        .eq("month", month)
        .eq("year", year)
        .order("expense_date", { ascending: false });

      if (!isAdmin) {
        q = q.eq("user_id", user.id);
      } else if (memberFilter !== "__all__") {
        q = q.eq("user_id", memberFilter);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const profileMap = useMemo(() => {
    const m: Record<string, string> = {};
    profiles.forEach(p => { if (p.name) m[p.user_id] = p.name; });
    return m;
  }, [profiles]);

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Nicht angemeldet");
      if (!description.trim()) throw new Error("Beschreibung fehlt");
      const amt = parseFloat(amount);
      if (!amt || amt <= 0) throw new Error("Betrag muss > 0 sein");

      let receipt_url: string | null = null;
      if (receiptFile) {
        const ext = receiptFile.name.split(".").pop() || "jpg";
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("expense-receipts")
          .upload(path, receiptFile, { upsert: false });
        if (upErr) throw upErr;
        receipt_url = path;
      }

      const { error } = await supabase.from("expense_reimbursements").insert({
        user_id: user.id,
        month,
        year,
        expense_date: expenseDate,
        category,
        description: description.trim(),
        amount: amt,
        vendor: vendor.trim() || null,
        receipt_url,
        note: note.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Auslage erfasst");
      qc.invalidateQueries({ queryKey });
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (item: any) => {
      if (item.receipt_url) {
        await supabase.storage.from("expense-receipts").remove([item.receipt_url]);
      }
      const { error } = await supabase.from("expense_reimbursements").delete().eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Gelöscht"); qc.invalidateQueries({ queryKey }); },
    onError: (e: any) => toast.error(e.message),
  });

  const submitMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expense_reimbursements").update({ status: "submitted" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Eingereicht"); qc.invalidateQueries({ queryKey }); },
    onError: (e: any) => toast.error(e.message),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expense_reimbursements").update({
        status: "approved",
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Genehmigt"); qc.invalidateQueries({ queryKey }); },
    onError: (e: any) => toast.error(e.message),
  });

  const resetForm = () => {
    setExpenseDate(today);
    setCategory("equipment");
    setDescription("");
    setAmount("");
    setVendor("");
    setNote("");
    setReceiptFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const total = useMemo(() => items.reduce((s: number, i: any) => s + Number(i.amount), 0), [items]);

  // Admin overview: Summen pro Mitarbeiter & Status
  const overview = useMemo(() => {
    if (!isAdmin) return null;
    const perUser: Record<string, { total: number; draft: number; submitted: number; approved: number; count: number }> = {};
    items.forEach((i: any) => {
      const uid = i.user_id;
      if (!perUser[uid]) perUser[uid] = { total: 0, draft: 0, submitted: 0, approved: 0, count: 0 };
      const amt = Number(i.amount);
      perUser[uid].total += amt;
      perUser[uid].count++;
      if (i.status === "draft") perUser[uid].draft += amt;
      else if (i.status === "submitted") perUser[uid].submitted += amt;
      else if (i.status === "approved") perUser[uid].approved += amt;
    });
    const totals = { draft: 0, submitted: 0, approved: 0, total: 0 };
    Object.values(perUser).forEach(v => {
      totals.draft += v.draft;
      totals.submitted += v.submitted;
      totals.approved += v.approved;
      totals.total += v.total;
    });
    return { perUser, totals };
  }, [items, isAdmin]);

  const fmt = (n: number) => n.toFixed(2).replace(".", ",") + " €";
  const fmtDate = (d: string) => new Date(d + "T00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });

  const statusBadge = (status: string) => {
    if (status === "draft") return <Badge variant="secondary">Entwurf</Badge>;
    if (status === "submitted") return <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-300">Eingereicht</Badge>;
    return <Badge className="bg-green-500/20 text-green-700 border-green-300">Genehmigt</Badge>;
  };

  const openReceipt = async (path: string) => {
    const { data, error } = await supabase.storage.from("expense-receipts").createSignedUrl(path, 60);
    if (error) { toast.error("Beleg konnte nicht geladen werden"); return; }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pt-2">
        <Receipt className="h-4 w-4 text-primary" />
        <h2 className="text-base font-semibold">Auslagen / Spesen</h2>
        <span className="text-xs text-muted-foreground">— Firmen-Einkäufe (z.B. SD-Karten, Blumen, Büromaterial)</span>
      </div>

      {/* Quick-Entry */}
      <Card className="p-4 space-y-4">
        <h3 className="text-sm font-semibold">Auslage erfassen</h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Datum *</Label>
            <Input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Kategorie</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Betrag (€) *</Label>
            <Input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" />
          </div>
          <div>
            <Label className="text-xs">Händler / Geschäft</Label>
            <Input value={vendor} onChange={e => setVendor(e.target.value)} placeholder="z.B. MediaMarkt" />
          </div>
        </div>

        <div>
          <Label className="text-xs">Beschreibung *</Label>
          <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="z.B. 2x SanDisk SD-Karte 128GB" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Notiz</Label>
            <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <Label className="text-xs">Beleg-Foto (optional)</Label>
            <div className="flex items-center gap-2">
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={e => setReceiptFile(e.target.files?.[0] || null)}
                className="text-xs"
              />
              {receiptFile && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setReceiptFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
          <Upload className="h-4 w-4 mr-2" />
          {addMutation.isPending ? "Speichern…" : "Auslage erfassen"}
        </Button>
      </Card>

      {/* List */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-6">Laden…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Keine Auslagen in diesem Monat.</p>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Datum</TableHead>
                {isAdmin && <TableHead className="text-xs">Mitarbeiter</TableHead>}
                <TableHead className="text-xs">Kategorie</TableHead>
                <TableHead className="text-xs">Beschreibung</TableHead>
                <TableHead className="text-xs">Händler</TableHead>
                <TableHead className="text-xs text-right">Betrag</TableHead>
                <TableHead className="text-xs">Beleg</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs whitespace-nowrap">{fmtDate(e.expense_date)}</TableCell>
                  {isAdmin && <TableCell className="text-xs">{profileMap[e.user_id] || "—"}</TableCell>}
                  <TableCell className="text-xs">{CATEGORY_LABEL[e.category] || e.category}</TableCell>
                  <TableCell className="text-xs">
                    <div className="font-medium">{e.description}</div>
                    {e.note && <div className="text-muted-foreground text-[10px] mt-0.5">{e.note}</div>}
                  </TableCell>
                  <TableCell className="text-xs">{e.vendor || "—"}</TableCell>
                  <TableCell className="text-xs text-right font-semibold">{fmt(Number(e.amount))}</TableCell>
                  <TableCell>
                    {e.receipt_url ? (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openReceipt(e.receipt_url)} title="Beleg ansehen">
                        <Paperclip className="h-3.5 w-3.5" />
                      </Button>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell>{statusBadge(e.status)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {e.status === "draft" && e.user_id === user?.id && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => submitMutation.mutate(e.id)} title="Einreichen">
                          <Send className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {isAdmin && e.status === "submitted" && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={() => approveMutation.mutate(e.id)} title="Genehmigen">
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {(e.user_id === user?.id || isAdmin) && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Auslage löschen?</AlertDialogTitle>
                              <AlertDialogDescription>Diese Aktion kann nicht rückgängig gemacht werden.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMutation.mutate(e)}>Löschen</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {items.length > 0 && (
        <div className="flex justify-end items-center gap-3 px-2">
          <span className="text-xs text-muted-foreground">{items.length} Auslagen</span>
          <span className="text-sm font-semibold">Summe: {fmt(total)}</span>
        </div>
      )}
    </div>
  );
}
