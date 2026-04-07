import { useState, useMemo } from "react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, getISOWeek } from "date-fns";
import { de } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ACTIVITY_TYPES } from "@/lib/time-tracking-constants";

interface TimeEntry {
  id: string;
  date: string;
  hours: number;
  activity_type: string;
  note: string | null;
  client_id: string | null;
  clients?: { name: string } | null;
}

interface WeeklyViewProps {
  entries: TimeEntry[];
  onRefresh: () => void;
}

export default function WeeklyView({ entries, onRefresh }: WeeklyViewProps) {
  const [weekRef, setWeekRef] = useState(new Date());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editHours, setEditHours] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editActivity, setEditActivity] = useState("");

  const weekStart = startOfWeek(weekRef, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weekRef, { weekStartsOn: 1 });
  const kw = getISOWeek(weekRef);

  const weekEntries = useMemo(() =>
    entries
      .filter(e => e.date >= format(weekStart, "yyyy-MM-dd") && e.date <= format(weekEnd, "yyyy-MM-dd"))
      .sort((a, b) => a.date.localeCompare(b.date)),
    [entries, weekStart, weekEnd]
  );

  const totalHours = weekEntries.reduce((s, e) => s + Number(e.hours), 0);

  const startEdit = (entry: TimeEntry) => {
    setEditingId(entry.id);
    setEditHours(String(entry.hours));
    setEditNote(entry.note || "");
    setEditActivity(entry.activity_type);
  };

  const saveEdit = async (id: string) => {
    const h = parseFloat(editHours);
    if (isNaN(h) || h <= 0 || h > 24) { toast.error("Ungültige Stunden"); return; }
    const { error } = await supabase.from("time_entries").update({
      hours: h,
      note: editNote.trim() || null,
      activity_type: editActivity,
    } as any).eq("id", id);
    if (error) { toast.error("Fehler"); return; }
    setEditingId(null);
    onRefresh();
  };

  const deleteEntry = async (id: string) => {
    await supabase.from("time_entries").delete().eq("id", id);
    onRefresh();
    toast.success("Eintrag gelöscht");
  };

  const activityLabel = (val: string) => ACTIVITY_TYPES.find(a => a.value === val)?.label ?? val;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setWeekRef(subWeeks(weekRef, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium">
            KW {kw}, {format(weekStart, "dd.MM.")} – {format(weekEnd, "dd.MM.yyyy")}
          </span>
          <Button variant="ghost" size="icon" onClick={() => setWeekRef(addWeeks(weekRef, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <span className="text-sm font-semibold">{totalHours.toFixed(1)}h diese Woche</span>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Datum</TableHead>
              <TableHead>Kunde</TableHead>
              <TableHead>Tätigkeit</TableHead>
              <TableHead className="w-20 text-right">Stunden</TableHead>
              <TableHead>Notiz</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {weekEntries.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Keine Einträge diese Woche</TableCell></TableRow>
            )}
            {weekEntries.map(entry => (
              <TableRow key={entry.id}>
                <TableCell className="text-sm">{format(new Date(entry.date + "T00:00:00"), "EEE dd.MM.", { locale: de })}</TableCell>
                <TableCell className="text-sm">{entry.clients?.name || "Intern"}</TableCell>
                <TableCell className="text-sm">
                  {editingId === entry.id ? (
                    <Select value={editActivity} onValueChange={setEditActivity}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{ACTIVITY_TYPES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : activityLabel(entry.activity_type)}
                </TableCell>
                <TableCell className="text-right text-sm font-medium">
                  {editingId === entry.id ? (
                    <Input type="number" className="h-8 w-20 text-xs" step="0.25" min="0.25" max="24" value={editHours} onChange={e => setEditHours(e.target.value)} />
                  ) : `${Number(entry.hours).toFixed(2)}h`}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {editingId === entry.id ? (
                    <Input className="h-8 text-xs" value={editNote} onChange={e => setEditNote(e.target.value)} />
                  ) : (entry.note || "—")}
                </TableCell>
                <TableCell>
                  {editingId === entry.id ? (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => saveEdit(entry.id)}><Check className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="h-3.5 w-3.5" /></Button>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(entry)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Eintrag löschen?</AlertDialogTitle>
                            <AlertDialogDescription>Dieser Zeiteintrag wird unwiderruflich gelöscht.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteEntry(entry.id)}>Löschen</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
