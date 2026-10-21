import { useMemo } from "react";
import { Users, CalendarClock, CalendarDays, Snowflake } from "lucide-react";
import { useCrmContacts, useCrmEvents, useCrmEventGuests } from "@/hooks/useCrmContacts";
import { isFollowupDue, isWarmStale } from "@/lib/crm-contacts";
import { eventStats } from "./EventsTab";

export default function CrmStatsTiles() {
  const { data: contacts = [] } = useCrmContacts();
  const { data: events = [] } = useCrmEvents();
  const { data: guests = [] } = useCrmEventGuests();

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const due = contacts.filter(c => isFollowupDue(c));
    const next = events.filter(e => e.date && e.date >= today).sort((a, b) => a.date!.localeCompare(b.date!))[0];
    return {
      total: contacts.length,
      today: due.filter(c => c.next_followup_date === today).length,
      overdue: due.filter(c => c.next_followup_date! < today).length,
      next, nextStats: next ? eventStats(next, guests) : null,
      stale: contacts.filter(c => isWarmStale(c)).length,
    };
  }, [contacts, events, guests]);

  const tiles = [
    { icon: Users, label: "Kontakte gesamt", value: String(stats.total) },
    { icon: CalendarClock, label: "Follow-ups heute / überfällig", value: `${stats.today} / ${stats.overdue}` },
    { icon: CalendarDays, label: stats.next ? `Nächstes Event: ${stats.next.name}` : "Nächstes Event", value: stats.next ? `${stats.nextStats!.seats}${stats.next.capacity ? `/${stats.next.capacity}` : ""} Zusagen` : "—" },
    { icon: Snowflake, label: "Ohne Kontakt seit 30+ Tagen (warm)", value: String(stats.stale) },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {tiles.map(t => (
        <div key={t.label} className="bg-card border border-border rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate"><t.icon className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{t.label}</span></div>
          <p className="text-xl font-bold mt-1">{t.value}</p>
        </div>
      ))}
    </div>
  );
}
