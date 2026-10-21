import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { CalendarDays, MapPin, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useCrmEvents, useCrmEventGuests, type CrmEvent, type CrmEventGuest } from "@/hooks/useCrmContacts";
import { SEAT_STATUSES, OPEN_STATUSES } from "@/lib/crm-contacts";

export function eventStats(e: CrmEvent, guests: CrmEventGuest[]) {
  const mine = guests.filter(g => g.event_id === e.id);
  const seats = mine.filter(g => SEAT_STATUSES.includes(g.status)).reduce((s, g) => s + 1 + (g.plus_ones ?? 0), 0);
  return { total: mine.length, seats, open: mine.filter(g => OPEN_STATUSES.includes(g.status)).length };
}

const slugify = (s: string) => s.toLowerCase().replace(/[äöüß]/g, c => ({ ä: "ae", ö: "oe", ü: "ue", ß: "ss" }[c]!)).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function EventsTab() {
  const qc = useQueryClient();
  const { data: events = [] } = useCrmEvents();
  const { data: guests = [] } = useCrmEventGuests();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", date: "", start_time: "", location: "", capacity: "", price_net: "" });

  const create = async () => {
    if (!form.name.trim()) return;
    const { error } = await supabase.from("crm_events").insert({
      name: form.name.trim(), slug: `${slugify(form.name)}-${Date.now().toString(36).slice(-4)}`,
      date: form.date || null, start_time: form.start_time || null, location: form.location || null,
      capacity: form.capacity ? Number(form.capacity) : null, price_net: Number(form.price_net) || 0,
    });
    if (error) { toast.error("Event konnte nicht angelegt werden"); return; }
    qc.invalidateQueries({ queryKey: ["crm-events"] });
    setOpen(false);
    setForm({ name: "", date: "", start_time: "", location: "", capacity: "", price_net: "" });
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Event</Button></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {events.map(e => {
          const s = eventStats(e, guests);
          const pct = e.capacity ? Math.min(100, (s.seats / e.capacity) * 100) : 0;
          return (
            <Link key={e.id} to={`/crm/event/${e.id}`} className="block bg-card border border-border rounded-lg p-4 hover:border-primary/40 transition-colors space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold leading-tight">{e.name}</h3>
                {Number(e.price_net) > 0 && <span className="text-xs text-muted-foreground shrink-0">{Number(e.price_net).toLocaleString("de-DE")} € netto</span>}
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />
                  {e.date ? format(new Date(e.date), "EEE, dd.MM.yyyy", { locale: de }) : "Datum offen"}{e.start_time ? ` · ${e.start_time} Uhr` : ""}
                </p>
                {e.location && <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{e.location}</p>}
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Zusagen</span>
                  <span className="font-medium">{s.seats}{e.capacity ? `/${e.capacity}` : ""}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${e.capacity ? pct : 0}%` }} /></div>
              </div>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" />{s.total} eingeladen · {s.open} offen</p>
            </Link>
          );
        })}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neues Event</DialogTitle></DialogHeader>
          <div className="grid gap-2">
            <Input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              <Input placeholder="Uhrzeit (z. B. 18:30)" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} />
            </div>
            <Input placeholder="Ort" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" placeholder="Plätze" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} />
              <Input type="number" placeholder="Preis netto €" value={form.price_net} onChange={e => setForm({ ...form, price_net: e.target.value })} />
            </div>
          </div>
          <DialogFooter><Button onClick={create} disabled={!form.name.trim()}>Anlegen</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
