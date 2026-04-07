import { useState, useMemo } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { CalendarIcon, Clock, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ACTIVITY_TYPES } from "@/lib/time-tracking-constants";
import { cn } from "@/lib/utils";

interface Client {
  id: string;
  name: string;
}

interface TimeEntryFormProps {
  clients: Client[];
  onEntryAdded: () => void;
}

export default function TimeEntryForm({ clients, onEntryAdded }: TimeEntryFormProps) {
  const { user } = useAuth();
  const [date, setDate] = useState<Date>(new Date());
  const [clientId, setClientId] = useState<string>("__intern__");
  const [activityType, setActivityType] = useState<string>("");
  const [entryMode, setEntryMode] = useState<"duration" | "time_range">("duration");
  const [hours, setHours] = useState<string>("1");
  const [minutes, setMinutes] = useState<string>("0");
  const [startTime, setStartTime] = useState<string>("09:00");
  const [endTime, setEndTime] = useState<string>("10:00");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const sortedClients = useMemo(() => 
    [...clients].sort((a, b) => a.name.localeCompare(b.name)), 
    [clients]
  );

  const calculateTimeRangeHours = (start: string, end: string): number => {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    const diff = endMin - startMin;
    return diff > 0 ? diff / 60 : 0;
  };

  const handleSubmit = async () => {
    if (!user || !activityType) {
      toast.error("Bitte alle Pflichtfelder ausfüllen");
      return;
    }

    let total: number;
    if (entryMode === "duration") {
      const h = parseInt(hours) || 0;
      const m = parseInt(minutes) || 0;
      total = h + m / 60;
    } else {
      total = calculateTimeRangeHours(startTime, endTime);
    }

    if (total <= 0 || total > 24) {
      toast.error(entryMode === "time_range" ? "Endzeit muss nach Startzeit liegen" : "Bitte eine gültige Zeit eingeben");
      return;
    }

    setSaving(true);
    const insertData: any = {
      user_id: user.id,
      client_id: clientId === "__intern__" ? null : clientId,
      date: format(date, "yyyy-MM-dd"),
      hours: Math.round(total * 100) / 100,
      activity_type: activityType,
      note: note.trim() || null,
      entry_mode: entryMode,
    };

    if (entryMode === "time_range") {
      insertData.start_time = startTime;
      insertData.end_time = endTime;
    }

    const { error } = await supabase.from("time_entries").insert(insertData);
    setSaving(false);
    if (error) {
      toast.error("Fehler beim Speichern");
      return;
    }
    const displayH = Math.floor(total);
    const displayM = Math.round((total - displayH) * 60);
    toast.success(`${displayH}h ${displayM > 0 ? displayM + 'min ' : ''}erfasst`);
    setClientId("__intern__");
    setActivityType("");
    setHours("1");
    setMinutes("0");
    setStartTime("09:00");
    setEndTime("10:00");
    setNote("");
    onEntryAdded();
  };

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={entryMode === "duration" ? "default" : "outline"}
          onClick={() => setEntryMode("duration")}
          className="gap-1.5"
        >
          <Timer className="h-3.5 w-3.5" />
          Dauer
        </Button>
        <Button
          type="button"
          size="sm"
          variant={entryMode === "time_range" ? "default" : "outline"}
          onClick={() => setEntryMode("time_range")}
          className="gap-1.5"
        >
          <Clock className="h-3.5 w-3.5" />
          Uhrzeit
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
        {/* Date */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Datum</label>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(date, "dd.MM.yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={date} onSelect={(d) => { if (d) setDate(d); setCalendarOpen(false); }} locale={de} />
            </PopoverContent>
          </Popover>
        </div>

        {/* Client */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Kunde</label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__intern__">— Intern —</SelectItem>
              {sortedClients.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Activity */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Tätigkeit</label>
          <Select value={activityType} onValueChange={setActivityType}>
            <SelectTrigger><SelectValue placeholder="Wählen…" /></SelectTrigger>
            <SelectContent>
              {ACTIVITY_TYPES.map(a => (
                <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Duration or Time Range */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            {entryMode === "duration" ? "Dauer" : "Von – Bis"}
          </label>
          {entryMode === "duration" ? (
            <div className="flex gap-2 items-center">
              <Input type="number" min="0" max="24" step="1" value={hours} onChange={e => setHours(e.target.value)} className="w-16" />
              <span className="text-xs text-muted-foreground">h</span>
              <Select value={minutes} onValueChange={setMinutes}>
                <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["0","10","20","30","40","50"].map(m => (
                    <SelectItem key={m} value={m}>{m} min</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="flex gap-1.5 items-center">
              <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-[110px]" />
              <span className="text-xs text-muted-foreground">–</span>
              <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-[110px]" />
            </div>
          )}
        </div>

        {/* Note */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Notiz</label>
          <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Optional…" />
        </div>

        {/* Submit */}
        <div>
          <Button onClick={handleSubmit} disabled={saving || !activityType} className="w-full">
            {saving ? "…" : "Erfassen"}
          </Button>
        </div>
      </div>
    </div>
  );
}
