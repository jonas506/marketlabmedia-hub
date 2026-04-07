import { useState, useMemo } from "react";
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ChevronLeft, ChevronRight, Trash2, Send, Check } from "lucide-react";
import { toast } from "sonner";
import {
  calculateMeals,
  calculateTotalAmount,
  round2,
  KM_RATE,
  OVERNIGHT_RATE,
  TRANSPORT_LABELS,
} from "@/lib/travel-expense-utils";

interface Props {
  isAdmin: boolean;
  profiles: { user_id: string; name: string | null }[];
  memberFilter: string;
}

export default function TravelExpensesTab({ isAdmin, profiles, memberFilter }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  // Form state
  const [destination, setDestination] = useState("");
  const [purpose, setPurpose] = useState("");
  const [depDate, setDepDate] = useState("");
  const [depTime, setDepTime] = useState("08:00");
  const [retDate, setRetDate] = useState("");
  const [retTime, setRetTime] = useState("18:00");
  const [transport, setTransport] = useState("car");
  const [kmDriven, setKmDriven] = useState("");
  const [overnightCount, setOvernightCount] = useState("0");
  const [extrasDesc, setExtrasDesc] = useState("");
  const [extrasAmount, setExtrasAmount] = useState("");
  const [note, setNote] = useState("");

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const monthLabel = new Date(year, month - 1).toLocaleDateString("de-DE", { month: "long", year: "numeric" });

  const queryKey = ["travel-expenses", month, year, user?.id, isAdmin, memberFilter];

  const { data: expenses = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!user) return [];
      let q = supabase
        .from("travel_expenses")
        .select("*")
        .eq("month", month)
        .eq("year", year)
        .order("departure_date", { ascending: true });

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

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not logged in");
      if (!destination || !purpose || !depDate || !retDate) {
        throw new Error("Bitte Pflichtfelder ausfüllen");
      }

      const km = transport === "car" ? parseFloat(kmDriven) || 0 : 0;
      const nights = parseInt(overnightCount) || 0;
      const extras = parseFloat(extrasAmount) || 0;
      const meals = calculateMeals(depDate, depTime, retDate, retTime);
      const total = calculateTotalAmount({
        meals_total: meals,
        km_driven: km,
        km_rate: KM_RATE,
        overnight_count: nights,
        overnight_rate: OVERNIGHT_RATE,
        extras_amount: extras,
      });

      const { error } = await supabase.from("travel_expenses").insert({
        user_id: user.id,
        month,
        year,
        destination,
        purpose,
        departure_date: depDate,
        departure_time: depTime,
        return_date: retDate,
        return_time: retTime,
        transport,
        km_driven: km,
        km_rate: KM_RATE,
        overnight_count: nights,
        overnight_rate: OVERNIGHT_RATE,
        meals_total: meals,
        extras_description: extrasDesc || null,
        extras_amount: extras,
        total_amount: total,
        note: note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reise erfasst");
      qc.invalidateQueries({ queryKey });
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("travel_expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Gelöscht"); qc.invalidateQueries({ queryKey }); },
    onError: (e: any) => toast.error(e.message),
  });

  const submitMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("travel_expenses").update({ status: "submitted" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Eingereicht"); qc.invalidateQueries({ queryKey }); },
    onError: (e: any) => toast.error(e.message),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("travel_expenses").update({ status: "approved" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Genehmigt"); qc.invalidateQueries({ queryKey }); },
    onError: (e: any) => toast.error(e.message),
  });

  const submitAllDrafts = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const drafts = expenses.filter((e: any) => e.status === "draft" && e.user_id === user.id);
      if (drafts.length === 0) throw new Error("Keine offenen Reisen");
      const { error } = await supabase
        .from("travel_expenses")
        .update({ status: "submitted" })
        .eq("user_id", user.id)
        .eq("month", month)
        .eq("year", year)
        .eq("status", "draft");
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Alle Reisen eingereicht"); qc.invalidateQueries({ queryKey }); },
    onError: (e: any) => toast.error(e.message),
  });

  const resetForm = () => {
    setDestination(""); setPurpose(""); setDepDate(""); setRetDate("");
    setDepTime("08:00"); setRetTime("18:00"); setTransport("car");
    setKmDriven(""); setOvernightCount("0"); setExtrasDesc("");
    setExtrasAmount(""); setNote("");
  };

  const summary = useMemo(() => {
    const s = { count: 0, km: 0, meals: 0, overnight: 0, extras: 0, total: 0 };
    expenses.forEach((e: any) => {
      s.count++;
      s.km += round2(Number(e.km_driven) * Number(e.km_rate));
      s.meals += Number(e.meals_total);
      s.overnight += round2(Number(e.overnight_count) * Number(e.overnight_rate));
      s.extras += Number(e.extras_amount);
      s.total += Number(e.total_amount);
    });
    return s;
  }, [expenses]);

  const fmt = (n: number) => n.toFixed(2).replace(".", ",") + " €";
  const fmtDate = (d: string) => new Date(d + "T00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });

  const statusBadge = (status: string) => {
    if (status === "draft") return <Badge variant="secondary">Entwurf</Badge>;
    if (status === "submitted") return <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-300">Eingereicht</Badge>;
    return <Badge className="bg-green-500/20 text-green-700 border-green-300">Genehmigt</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Month navigation */}
      <div className="flex items-center justify-center gap-4">
        <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="text-sm font-semibold min-w-[140px] text-center capitalize">{monthLabel}</span>
        <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      {/* Quick entry form */}
      <Card className="p-4 space-y-4">
        <h3 className="text-sm font-semibold">Dienstreise erfassen</h3>

        {/* Row 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Reiseziel *</Label>
            <Input value={destination} onChange={e => setDestination(e.target.value)} placeholder="z.B. Bobingen" />
          </div>
          <div>
            <Label className="text-xs">Reiseanlass *</Label>
            <Input value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="z.B. Social Media Dreh" />
          </div>
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Anreise Datum *</Label>
            <Input type="date" value={depDate} onChange={e => setDepDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Anreise Uhrzeit</Label>
            <Input type="time" value={depTime} onChange={e => setDepTime(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Abreise Datum *</Label>
            <Input type="date" value={retDate} onChange={e => setRetDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Abreise Uhrzeit</Label>
            <Input type="time" value={retTime} onChange={e => setRetTime(e.target.value)} />
          </div>
        </div>

        {/* Row 3 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Verkehrsmittel</Label>
            <Select value={transport} onValueChange={setTransport}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="car">PKW</SelectItem>
                <SelectItem value="train">Bahn</SelectItem>
                <SelectItem value="plane">Flug</SelectItem>
                <SelectItem value="other">Sonstige</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {transport === "car" && (
            <div>
              <Label className="text-xs">KM gefahren</Label>
              <Input type="number" min="0" step="0.1" value={kmDriven} onChange={e => setKmDriven(e.target.value)} placeholder="0" />
            </div>
          )}
          <div>
            <Label className="text-xs">Übernachtungen</Label>
            <Input type="number" min="0" value={overnightCount} onChange={e => setOvernightCount(e.target.value)} />
          </div>
        </div>

        {/* Row 4 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Nebenkosten Beschreibung</Label>
            <Input value={extrasDesc} onChange={e => setExtrasDesc(e.target.value)} placeholder="Taxi, Parkgebühren, etc." />
          </div>
          <div>
            <Label className="text-xs">Nebenkosten Betrag (€)</Label>
            <Input type="number" min="0" step="0.01" value={extrasAmount} onChange={e => setExtrasAmount(e.target.value)} placeholder="0,00" />
          </div>
        </div>

        {/* Row 5 */}
        <div>
          <Label className="text-xs">Notiz</Label>
          <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Optional" />
        </div>

        <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
          {addMutation.isPending ? "Speichern…" : "Reise erfassen"}
        </Button>
      </Card>

      {/* Expenses table */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Laden…</p>
      ) : expenses.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Keine Reisen in diesem Monat.</p>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Zeitraum</TableHead>
                <TableHead className="text-xs">Ziel</TableHead>
                <TableHead className="text-xs">Anlass</TableHead>
                <TableHead className="text-xs">Verkehr</TableHead>
                <TableHead className="text-xs text-right">KM</TableHead>
                <TableHead className="text-xs text-right">Verpfl.</TableHead>
                <TableHead className="text-xs text-right">Übern.</TableHead>
                <TableHead className="text-xs text-right">Extras</TableHead>
                <TableHead className="text-xs text-right">Gesamt</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {fmtDate(e.departure_date)}–{fmtDate(e.return_date)}
                  </TableCell>
                  <TableCell className="text-xs">{e.destination}</TableCell>
                  <TableCell className="text-xs">{e.purpose}</TableCell>
                  <TableCell className="text-xs">{TRANSPORT_LABELS[e.transport] || e.transport}</TableCell>
                  <TableCell className="text-xs text-right">{fmt(round2(Number(e.km_driven) * Number(e.km_rate)))}</TableCell>
                  <TableCell className="text-xs text-right">{fmt(Number(e.meals_total))}</TableCell>
                  <TableCell className="text-xs text-right">{fmt(round2(Number(e.overnight_count) * Number(e.overnight_rate)))}</TableCell>
                  <TableCell className="text-xs text-right">{fmt(Number(e.extras_amount))}</TableCell>
                  <TableCell className="text-xs text-right font-semibold">{fmt(Number(e.total_amount))}</TableCell>
                  <TableCell>{statusBadge(e.status)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {e.status === "draft" && (
                        <>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => submitMutation.mutate(e.id)} title="Einreichen">
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Reise löschen?</AlertDialogTitle>
                                <AlertDialogDescription>Diese Aktion kann nicht rückgängig gemacht werden.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(e.id)}>Löschen</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                      {isAdmin && e.status === "submitted" && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={() => approveMutation.mutate(e.id)} title="Genehmigen">
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Monthly summary */}
      {expenses.length > 0 && (
        <Card className="p-4 space-y-3">
          <h3 className="text-sm font-semibold">Monats-Zusammenfassung</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">Anzahl Reisen</span>
              <p className="font-medium">{summary.count}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">KM-Kosten</span>
              <p className="font-medium">{fmt(summary.km)}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Verpflegung</span>
              <p className="font-medium">{fmt(summary.meals)}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Übernachtungen</span>
              <p className="font-medium">{fmt(summary.overnight)}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Nebenkosten</span>
              <p className="font-medium">{fmt(summary.extras)}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Gesamtbetrag</span>
              <p className="font-bold text-base">{fmt(summary.total)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" size="sm" disabled>
              PDF herunterladen (demnächst)
            </Button>
            <Button size="sm" onClick={() => submitAllDrafts.mutate()} disabled={submitAllDrafts.isPending || !expenses.some((e: any) => e.status === "draft")}>
              Abrechnung einreichen
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
