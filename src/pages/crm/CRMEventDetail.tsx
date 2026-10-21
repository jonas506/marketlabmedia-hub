import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { ArrowLeft, CalendarDays, MapPin, Search, Trash2, ExternalLink, UserPlus } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCrmContacts, useCrmEvents, useCrmEventGuests } from "@/hooks/useCrmContacts";
import { GUEST_STATUSES, CHANNELS, labelOf, colorOf } from "@/lib/crm-contacts";
import { eventStats } from "@/components/crm/EventsTab";

const ALL = "__all";

export default function CRMEventDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { data: events = [] } = useCrmEvents();
  const { data: guests = [] } = useCrmEventGuests();
  const { data: contacts = [] } = useCrmContacts();
  const [statusF, setStatusF] = useState(ALL);
  const [q, setQ] = useState("");
  const [add, setAdd] = useState("");

  const event = events.find(e => e.id === id);
  const contactById = useMemo(() => new Map(contacts.map(c => [c.id, c])), [contacts]);
  const mine = guests.filter(g => g.event_id === id);
  const guestIds = new Set(mine.map(g => g.contact_id));
  const shown = mine
    .filter(g => statusF === ALL || g.status === statusF)
    .filter(g => { const c = contactById.get(g.contact_id); return !q || [c?.full_name, c?.company].some(v => v?.toLowerCase().includes(q.toLowerCase())); })
    .sort((a, b) => (contactById.get(a.contact_id)?.full_name ?? "").localeCompare(contactById.get(b.contact_id)?.full_name ?? "", "de"));
  const suggestions = add.trim().length < 2 ? [] : contacts
    .filter(c => !guestIds.has(c.id) && [c.full_name, c.company, c.email].some(v => v?.toLowerCase().includes(add.toLowerCase())))
    .slice(0, 8);

  const refresh = () => qc.invalidateQueries({ queryKey: ["crm-event-guests"] });
  const update = async (gid: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from("crm_event_guests").update(patch as never).eq("id", gid);
    if (error) toast.error("Speichern fehlgeschlagen"); else refresh();
  };
  const addGuest = async (cid: string) => {
    const { error } = await supabase.from("crm_event_guests").insert({ event_id: id!, contact_id: cid, status: "eingeladen" });
    if (error) toast.error("Gast konnte nicht hinzugefügt werden"); else { setAdd(""); refresh(); }
  };
  const remove = async (gid: string) => {
    const { error } = await supabase.from("crm_event_guests").delete().eq("id", gid);
    if (!error) refresh();
  };

  if (!event) return <AppLayout><div className="py-12 text-center text-muted-foreground">Event wird geladen…</div></AppLayout>;
  const s = eventStats(event, guests);

  return (
    <AppLayout>
      <div className="space-y-4">
        <Link to="/crm?tab=events" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Events</Link>
        <div className="bg-card border border-border rounded-lg p-4 flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">{event.name}</h1>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><CalendarDays className="h-4 w-4" />
              {event.date ? format(new Date(event.date), "EEEE, dd.MM.yyyy", { locale: de }) : "Datum offen"}{event.start_time ? ` · ${event.start_time} Uhr` : ""}
            </p>
            {event.location && <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="h-4 w-4" />{event.location}</p>}
            {event.description && <p className="text-sm text-muted-foreground">{event.description}</p>}
            {event.landing_url && <a href={event.landing_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary"><ExternalLink className="h-3.5 w-3.5" />Landingpage</a>}
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Sitzplätze</p>
            <p className="text-2xl font-bold">{s.seats}{event.capacity ? `/${event.capacity}` : ""} <span className="text-sm font-normal text-muted-foreground">belegt</span></p>
            {Number(event.price_net) > 0 && <p className="text-xs text-muted-foreground">{Number(event.price_net).toLocaleString("de-DE")} € netto</p>}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {GUEST_STATUSES.map(st => {
            const n = mine.filter(g => g.status === st.value).length;
            return (
              <button key={st.value} onClick={() => setStatusF(statusF === st.value ? ALL : st.value)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-colors ${statusF === st.value ? "border-primary" : "border-transparent"}`}
                style={{ background: st.color + "22", color: st.color }}>
                {st.label} {n}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9 h-9" placeholder="Gast suchen…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div className="relative w-full sm:w-80">
            <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9 h-9" placeholder="Gast hinzufügen (Kontaktsuche)…" value={add} onChange={e => setAdd(e.target.value)} />
            {suggestions.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg">
                {suggestions.map(c => (
                  <button key={c.id} onClick={() => addGuest(c.id)} className="block w-full text-left px-3 py-2 text-sm hover:bg-muted/50">
                    {c.full_name}{c.company ? <span className="text-muted-foreground"> · {c.company}</span> : null}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border border-border rounded-lg overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Gast</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Eingeladen via</th>
                <th className="px-3 py-2 font-medium">+ Begleitung</th>
                <th className="px-3 py-2 font-medium">Notiz</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map(g => {
                const c = contactById.get(g.contact_id);
                return (
                  <tr key={g.id} className="hover:bg-muted/20">
                    <td className="px-3 py-2">
                      <Link to={`/crm/kontakt/${g.contact_id}`} className="font-medium hover:text-primary">{c?.full_name ?? "—"}</Link>
                      {c?.company && <span className="text-xs text-muted-foreground"> · {c.company}</span>}
                    </td>
                    <td className="px-3 py-2">
                      <Select value={g.status} onValueChange={v => update(g.id, { status: v, responded_at: ["angefragt", "eingeladen"].includes(v) ? null : new Date().toISOString() })}>
                        <SelectTrigger className="h-8 w-[140px] text-xs" style={{ color: colorOf(GUEST_STATUSES, g.status) }}><SelectValue /></SelectTrigger>
                        <SelectContent>{GUEST_STATUSES.map(st => <SelectItem key={st.value} value={st.value}>{st.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2">
                      <Select value={g.invited_via ?? "none"} onValueChange={v => update(g.id, { invited_via: v === "none" ? null : v })}>
                        <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          {CHANNELS.map(ch => <SelectItem key={ch.value} value={ch.value}>{ch.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2">
                      <Input type="number" min={0} className="h-8 w-16 text-xs" defaultValue={g.plus_ones}
                        onBlur={e => Number(e.target.value) !== g.plus_ones && update(g.id, { plus_ones: Math.max(0, Number(e.target.value) || 0) })} />
                    </td>
                    <td className="px-3 py-2">
                      <Input className="h-8 text-xs min-w-[160px]" defaultValue={g.note ?? ""} placeholder="Notiz"
                        onBlur={e => e.target.value !== (g.note ?? "") && update(g.id, { note: e.target.value || null })} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => remove(g.id)} aria-label="Entfernen"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </td>
                  </tr>
                );
              })}
              {shown.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Keine Gäste {statusF !== ALL ? `mit Status „${labelOf(GUEST_STATUSES, statusF)}“` : ""}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
