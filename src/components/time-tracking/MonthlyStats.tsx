import { useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { de } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Download, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ACTIVITY_TYPES, ACTIVITY_BAR_COLORS } from "@/lib/time-tracking-constants";

interface TimeEntry {
  id: string;
  date: string;
  hours: number;
  activity_type: string;
  note: string | null;
  client_id: string | null;
  user_id: string;
  clients?: { name: string } | null;
  profiles?: { name: string } | null;
}

interface MonthlyStatsProps {
  entries: TimeEntry[];
  isAdmin: boolean;
  profiles?: { user_id: string; name: string }[];
}

export default function MonthlyStats({ entries, isAdmin, profiles }: MonthlyStatsProps) {
  const [monthRef, setMonthRef] = useState(new Date());
  const [open, setOpen] = useState(true);

  const mStart = format(startOfMonth(monthRef), "yyyy-MM-dd");
  const mEnd = format(endOfMonth(monthRef), "yyyy-MM-dd");

  const monthEntries = useMemo(() =>
    entries.filter(e => e.date >= mStart && e.date <= mEnd),
    [entries, mStart, mEnd]
  );

  const totalHours = monthEntries.reduce((s, e) => s + Number(e.hours), 0);

  // By client
  const byClient = useMemo(() => {
    const map: Record<string, { name: string; hours: number }> = {};
    monthEntries.forEach(e => {
      const key = e.client_id || "__intern__";
      const name = e.clients?.name || "Intern";
      if (!map[key]) map[key] = { name, hours: 0 };
      map[key].hours += Number(e.hours);
    });
    return Object.values(map).sort((a, b) => b.hours - a.hours);
  }, [monthEntries]);

  // By activity
  const byActivity = useMemo(() => {
    const map: Record<string, number> = {};
    monthEntries.forEach(e => {
      map[e.activity_type] = (map[e.activity_type] || 0) + Number(e.hours);
    });
    return Object.entries(map)
      .map(([key, hours]) => ({ key, label: ACTIVITY_TYPES.find(a => a.value === key)?.label ?? key, hours }))
      .sort((a, b) => b.hours - a.hours);
  }, [monthEntries]);

  // By team member (admin only)
  const byMember = useMemo(() => {
    if (!isAdmin) return [];
    const map: Record<string, { name: string; hours: number }> = {};
    monthEntries.forEach(e => {
      if (!map[e.user_id]) {
        const p = profiles?.find(p => p.user_id === e.user_id);
        map[e.user_id] = { name: p?.name || "Unbekannt", hours: 0 };
      }
      map[e.user_id].hours += Number(e.hours);
    });
    return Object.values(map).sort((a, b) => b.hours - a.hours);
  }, [monthEntries, isAdmin, profiles]);

  const exportCSV = () => {
    const rows = [["Datum", "Mitarbeiter", "Kunde", "Tätigkeit", "Stunden", "Notiz"]];
    monthEntries.forEach(e => {
      const p = profiles?.find(p => p.user_id === e.user_id);
      rows.push([
        e.date,
        p?.name || "—",
        e.clients?.name || "Intern",
        ACTIVITY_TYPES.find(a => a.value === e.activity_type)?.label ?? e.activity_type,
        String(e.hours),
        e.note || "",
      ]);
    });
    const csv = rows.map(r => r.map(c => `"${c}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zeiterfassung_${format(monthRef, "yyyy-MM")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const Bar = ({ value, max, label, hours, barColor }: { value: number; max: number; label: string; hours: number; barColor?: string }) => (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-28 truncate text-muted-foreground">{label}</span>
      <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", barColor || "bg-primary/70")} style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
      </div>
      <span className="w-16 text-right font-medium">{hours.toFixed(1)}h</span>
      <span className="w-12 text-right text-muted-foreground">{totalHours > 0 ? ((hours / totalHours) * 100).toFixed(0) : 0}%</span>
    </div>
  );

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex items-center justify-between">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="gap-2 text-sm font-semibold px-0 hover:bg-transparent">
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Monatsauswertung
          </Button>
        </CollapsibleTrigger>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMonthRef(subMonths(monthRef, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium w-28 text-center">{format(monthRef, "MMMM yyyy", { locale: de })}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMonthRef(addMonths(monthRef, 1))}><ChevronRight className="h-4 w-4" /></Button>
          {isAdmin && (
            <Button variant="outline" size="sm" className="ml-2 gap-1.5" onClick={exportCSV}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          )}
        </div>
      </div>
      <CollapsibleContent className="mt-4 space-y-6">
        <div className="text-2xl font-bold">{totalHours.toFixed(1)}h <span className="text-sm font-normal text-muted-foreground">gesamt</span></div>

        {/* By Client */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nach Kunde</h4>
          {byClient.map(c => <Bar key={c.name} value={c.hours} max={Math.max(...byClient.map(x => x.hours))} label={c.name} hours={c.hours} />)}
        </div>

        {/* By Activity */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nach Tätigkeit</h4>
          {byActivity.map(a => <Bar key={a.key} value={a.hours} max={Math.max(...byActivity.map(x => x.hours))} label={a.label} hours={a.hours} barColor={ACTIVITY_BAR_COLORS[a.key]} />)}
        </div>

        {/* By Member (Admin) */}
        {isAdmin && byMember.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nach Mitarbeiter</h4>
            {byMember.map(m => <Bar key={m.name} value={m.hours} max={Math.max(...byMember.map(x => x.hours))} label={m.name} hours={m.hours} />)}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
