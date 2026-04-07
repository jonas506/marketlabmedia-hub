import { useState, useMemo } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
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
  const [hours, setHours] = useState<string>("1");
  const [minutes, setMinutes] = useState<string>("0");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const sortedClients = useMemo(() => 
    [...clients].sort((a, b) => a.name.localeCompare(b.name)), 
    [clients]
  );

  const handleSubmit = async () => {
    if (!user || !activityType) {
      toast.error("Bitte alle Pflichtfelder ausfüllen");
      return;
    }
    const h = parseFloat(hours);
    if (isNaN(h) || h <= 0 || h > 24) {
      toast.error("Stunden müssen zwischen 0.25 und 24 liegen");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("time_entries").insert({
      user_id: user.id,
      client_id: clientId === "__intern__" ? null : clientId,
      date: format(date, "yyyy-MM-dd"),
      hours: h,
      activity_type: activityType,
      note: note.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error("Fehler beim Speichern");
      return;
    }
    toast.success(`${h}h erfasst`);
    setClientId("__intern__");
    setActivityType("");
    setHours("1");
    setNote("");
    onEntryAdded();
  };

  return (
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

      {/* Hours */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Stunden</label>
        <Input type="number" min="0.17" max="24" step="0.17" value={hours} onChange={e => setHours(e.target.value)} />
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
  );
}
