import { useState, useMemo } from "react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, getISOWeek, addDays, isToday, isSameDay } from "date-fns";
import { de } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Pencil, Trash2, Check, X, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ACTIVITY_TYPES } from "@/lib/time-tracking-constants";
import { cn } from "@/lib/utils";

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
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editHours, setEditHours] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editActivity, setEditActivity] = useState("");

  const weekStart = startOfWeek(weekRef, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weekRef, { weekStartsOn: 1 });
  const kw = getISOWeek(weekRef);

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const weekEntries = useMemo(() =>
    entries
      .filter(e => e.date >= format(weekStart, "yyyy-MM-dd") && e.date <= format(weekEnd, "yyyy-MM-dd"))
      .sort((a, b) => a.date.localeCompare(b.date)),
    [entries, weekStart, weekEnd]
  );

  const dayEntries = useMemo(() => {
    if (!selectedDay) return [];
    const dayStr = format(selectedDay, "yyyy-MM-dd");
    return weekEntries.filter(e => e.date === dayStr);
  }, [weekEntries, selectedDay]);

  const totalHours = weekEntries.reduce((s, e) => s + Number(e.hours), 0);

  const hoursPerDay = useMemo(() => {
    const map: Record<string, number> = {};
    weekEntries.forEach(e => {
      map[e.date] = (map[e.date] || 0) + Number(e.hours);
    });
    return map;
  }, [weekEntries]);

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
  const activityColor = (val: string) => ACTIVITY_TYPES.find(a => a.value === val)?.color ?? 'bg-muted text-muted-foreground';

  const changeWeek = (direction: "prev" | "next") => {
    const newWeek = direction === "prev" ? subWeeks(weekRef, 1) : addWeeks(weekRef, 1);
    setWeekRef(newWeek);
    setSelectedDay(null);
  };

  const renderEntryTable = (entriesToShow: TimeEntry[], showDate: boolean) => (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            {showDate && <TableHead className="w-24">Datum</TableHead>}
            <TableHead>Kunde</TableHead>
            <TableHead>Tätigkeit</TableHead>
            <TableHead className="w-20 text-right">Stunden</TableHead>
            <TableHead>Notiz</TableHead>
            <TableHead className="w-20"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entriesToShow.length === 0 && (
            <TableRow><TableCell colSpan={showDate ? 6 : 5} className="text-center text-muted-foreground py-8">Keine Einträge</TableCell></TableRow>
          )}
          {entriesToShow.map(entry => (
            <TableRow key={entry.id}>
              {showDate && <TableCell className="text-sm">{format(new Date(entry.date + "T00:00:00"), "EEE dd.MM.", { locale: de })}</TableCell>}
              <TableCell className="text-sm">{entry.clients?.name || "Intern"}</TableCell>
              <TableCell className="text-sm">
                {editingId === entry.id ? (
                  <Select value={editActivity} onValueChange={setEditActivity}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{ACTIVITY_TYPES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
                  </Select>
                ) : <span className={cn("inline-block px-2 py-0.5 rounded-full text-xs font-medium", activityColor(entry.activity_type))}>{activityLabel(entry.activity_type)}</span>}
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
  );

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => changeWeek("prev")}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium">
            KW {kw}, {format(weekStart, "dd.MM.")} – {format(weekEnd, "dd.MM.yyyy")}
          </span>
          <Button variant="ghost" size="icon" onClick={() => changeWeek("next")}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <span className="text-sm font-semibold">{totalHours.toFixed(1)}h diese Woche</span>
      </div>

      {/* Day selector pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <Button
          variant={selectedDay === null ? "default" : "outline"}
          size="sm"
          className="shrink-0 gap-1.5"
          onClick={() => setSelectedDay(null)}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          Woche
        </Button>
        {weekDays.map(day => {
          const dayStr = format(day, "yyyy-MM-dd");
          const dayHours = hoursPerDay[dayStr] || 0;
          const isSelected = selectedDay && isSameDay(day, selectedDay);
          return (
            <Button
              key={dayStr}
              variant={isSelected ? "default" : "outline"}
              size="sm"
              className={cn(
                "shrink-0 flex-col h-auto py-1.5 px-3 min-w-[56px]",
                isToday(day) && !isSelected && "border-primary/50"
              )}
              onClick={() => setSelectedDay(day)}
            >
              <span className="text-[10px] uppercase leading-none">{format(day, "EEE", { locale: de })}</span>
              <span className="text-xs font-semibold leading-none mt-0.5">{format(day, "dd.")}</span>
              {dayHours > 0 && (
                <span className={cn("text-[10px] leading-none mt-0.5", isSelected ? "text-primary-foreground/70" : "text-muted-foreground")}>
                  {dayHours.toFixed(1)}h
                </span>
              )}
            </Button>
          );
        })}
      </div>

      {/* Day view or week view */}
      {selectedDay ? (
        <div>
          <h3 className="text-sm font-semibold mb-2">
            {format(selectedDay, "EEEE, dd. MMMM yyyy", { locale: de })}
            {dayEntries.length > 0 && (
              <span className="text-muted-foreground font-normal ml-2">
                — {dayEntries.reduce((s, e) => s + Number(e.hours), 0).toFixed(1)}h
              </span>
            )}
          </h3>
          {renderEntryTable(dayEntries, false)}
        </div>
      ) : (
        renderEntryTable(weekEntries, true)
      )}
    </div>
  );
}
