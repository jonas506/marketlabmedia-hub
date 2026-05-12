import { useState } from "react";
import { format, differenceInCalendarDays } from "date-fns";
import { de } from "date-fns/locale";
import { CalendarIcon, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export default function SickDayQuickButton() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<{ from?: Date; to?: Date }>({ from: new Date(), to: new Date() });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!user || !range.from) return;
    const start = range.from;
    const end = range.to || range.from;
    const days = Math.max(1, differenceInCalendarDays(end, start) + 1);
    setSaving(true);
    const { error } = await supabase.from("vacation_requests").insert({
      user_id: user.id,
      type: "sick",
      start_date: format(start, "yyyy-MM-dd"),
      end_date: format(end, "yyyy-MM-dd"),
      days,
      status: "pending",
      reason: null,
    } as any);
    setSaving(false);
    if (error) {
      toast.error("Fehler beim Eintragen");
      return;
    }
    toast.success(`Krankmeldung für ${days} Tag${days > 1 ? "e" : ""} eingereicht`);
    qc.invalidateQueries({ queryKey: ["vacation-requests"] });
    qc.invalidateQueries({ queryKey: ["absences-approved"] });
    setOpen(false);
  };

  const label = range.from
    ? range.to && format(range.from, "yyyy-MM-dd") !== format(range.to, "yyyy-MM-dd")
      ? `${format(range.from, "dd.MM.")} – ${format(range.to, "dd.MM.yyyy")}`
      : format(range.from, "dd.MM.yyyy")
    : "Datum wählen";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Stethoscope className="h-3.5 w-3.5" />
          Krank melden
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3 space-y-3" align="end">
        <div className="text-xs font-medium text-muted-foreground">Zeitraum</div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {label}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={range as any}
              onSelect={(r: any) => setRange(r || {})}
              locale={de}
              numberOfMonths={1}
            />
          </PopoverContent>
        </Popover>
        <Button onClick={submit} disabled={saving || !range.from} className="w-full" size="sm">
          {saving ? "…" : "Krankmeldung einreichen"}
        </Button>
        <div className="text-[11px] text-muted-foreground">
          Wird nach Freigabe als 8h/Tag in den Stunden gezählt.
        </div>
      </PopoverContent>
    </Popover>
  );
}
