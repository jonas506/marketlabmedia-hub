import { useState } from "react";
import { Link } from "react-router-dom";
import { format, addDays, nextMonday } from "date-fns";
import { CalendarClock, CheckCircle2, Circle, Plus, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { GUEST_STATUSES, labelOf, colorOf } from "@/lib/crm-contacts";
import type { CrmEvent, CrmEventGuest } from "@/hooks/useCrmContacts";

const Card = ({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) => (
  <section className="bg-card border border-border rounded-lg p-4 space-y-2.5">
    <div className="flex items-center justify-between">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {action}
    </div>
    {children}
  </section>
);

export function NextStepCard({
  date, text, overdue, onSave,
}: {
  date: string | null; text: string | null; overdue?: boolean;
  onSave: (date: string | null, text: string | null) => void;
}) {
  const [draft, setDraft] = useState(text ?? "");
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = overdue ?? (!!date && date < today);
  const quick = [
    { label: "Morgen", d: addDays(new Date(), 1) },
    { label: "In 3 Tagen", d: addDays(new Date(), 3) },
    { label: "Nächste Woche", d: nextMonday(new Date()) },
  ];
  return (
    <Card title="Nächster Schritt">
      <div className="flex flex-wrap gap-1.5">
        {quick.map(q => (
          <button key={q.label} onClick={() => onSave(format(q.d, "yyyy-MM-dd"), draft || text)}
            className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-primary/50">
            {q.label}
          </button>
        ))}
        <Popover>
          <PopoverTrigger asChild>
            <button className={cn("rounded-full border px-2.5 py-1 text-xs inline-flex items-center gap-1",
              isOverdue ? "border-destructive/50 text-destructive" : "border-border text-muted-foreground hover:text-foreground")}>
              <CalendarClock className="h-3 w-3" />
              {date ? format(new Date(date), "dd.MM.yyyy") : "Datum"}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={date ? new Date(date) : undefined}
              onSelect={d => onSave(d ? format(d, "yyyy-MM-dd") : null, draft || text)} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
      </div>
      {isOverdue && <p className="text-xs text-destructive font-medium">Überfällig</p>}
      <Input key={text ?? ""} defaultValue={text ?? ""} placeholder="Was ist der nächste Schritt?"
        onChange={e => setDraft(e.target.value)}
        onBlur={e => { if (e.target.value.trim() !== (text ?? "")) onSave(date, e.target.value.trim() || null); }}
        className="h-8 text-xs bg-background" />
    </Card>
  );
}

export interface CrmTaskLite {
  id: string; title: string; due_date: string | null; is_completed: boolean;
}

export function TasksCard({ tasks, onChanged, leadId, contactId }: {
  tasks: CrmTaskLite[]; onChanged: () => void; leadId?: string | null; contactId?: string | null;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const today = new Date().toISOString().slice(0, 10);

  const add = async () => {
    if (!title.trim() || !user) return;
    const { error } = await supabase.from("crm_tasks").insert({
      title: title.trim(), assigned_to: user.id,
      ...(leadId ? { lead_id: leadId } : {}), ...(contactId ? { contact_id: contactId } : {}),
    } as any);
    if (error) { toast.error("To-do konnte nicht gespeichert werden"); return; }
    setTitle(""); onChanged();
  };
  const toggle = async (t: CrmTaskLite) => {
    await supabase.from("crm_tasks").update({ is_completed: !t.is_completed, completed_at: !t.is_completed ? new Date().toISOString() : null }).eq("id", t.id);
    onChanged();
  };

  const open = tasks.filter(t => !t.is_completed);
  return (
    <Card title={`To-dos${open.length ? ` · ${open.length}` : ""}`}>
      {tasks.length === 0 && <p className="text-xs text-muted-foreground">Keine To-dos.</p>}
      {tasks.map(t => (
        <button key={t.id} onClick={() => toggle(t)} className="flex w-full items-center gap-2 text-sm text-left">
          {t.is_completed ? <CheckCircle2 className="h-4 w-4 text-primary shrink-0" /> : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />}
          <span className={cn("flex-1 truncate", t.is_completed && "line-through text-muted-foreground")}>{t.title}</span>
          {t.due_date && (
            <span className={cn("text-xs shrink-0", !t.is_completed && t.due_date < today ? "text-destructive" : "text-muted-foreground")}>
              {format(new Date(t.due_date), "dd.MM.")}
            </span>
          )}
        </button>
      ))}
      <div className="flex gap-2 pt-1">
        <Input className="h-8 text-xs bg-background" placeholder="Neues To-do" value={title}
          onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} />
        <Button size="sm" variant="outline" className="h-8 px-2" onClick={add} disabled={!title.trim()}><Plus className="h-3.5 w-3.5" /></Button>
      </div>
    </Card>
  );
}

export function EventsCard({ guests, events, contactId, onChanged }: {
  guests: CrmEventGuest[]; events: CrmEvent[]; contactId: string; onChanged: () => void;
}) {
  const memberIds = new Set(guests.map(g => g.event_id));
  const available = events.filter(e => !memberIds.has(e.id));

  const setStatus = async (guestId: string, status: string) => {
    await supabase.from("crm_event_guests").update({ status: status as any }).eq("id", guestId);
    onChanged();
  };
  const addTo = async (eventId: string) => {
    const { error } = await supabase.from("crm_event_guests").insert({ event_id: eventId, contact_id: contactId, status: "eingeladen" as any });
    if (error) { toast.error("Konnte nicht hinzugefügt werden"); return; }
    onChanged();
  };

  return (
    <Card title="Events" action={available.length > 0 && (
      <Select onValueChange={addTo}>
        <SelectTrigger className="h-7 w-auto gap-1 border-none bg-transparent px-1 text-xs text-primary shadow-none focus:ring-0">
          <Plus className="h-3 w-3" /><span>Zu Event hinzufügen</span>
        </SelectTrigger>
        <SelectContent>
          {available.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
        </SelectContent>
      </Select>
    )}>
      {guests.length === 0 && <p className="text-xs text-muted-foreground">Noch bei keinem Event.</p>}
      {guests.map(g => {
        const e = events.find(x => x.id === g.event_id);
        return (
          <div key={g.id} className="flex items-center justify-between gap-2">
            <Link to={`/crm/event/${g.event_id}`} className="text-sm truncate hover:text-primary">{e?.name ?? "Event"}</Link>
            <Select value={g.status} onValueChange={v => setStatus(g.id, v)}>
              <SelectTrigger className="h-6 w-auto gap-1 border-none bg-transparent px-1 text-xs shadow-none focus:ring-0"
                style={{ color: colorOf(GUEST_STATUSES, g.status) }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GUEST_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        );
      })}
    </Card>
  );
}

export function OffersCard({ documents }: {
  documents: { id: string; title: string; status: string; amount_net: number | null }[];
}) {
  const openTotal = documents.filter(d => ["draft", "sent", "viewed"].includes(d.status)).reduce((s, d) => s + Number(d.amount_net || 0), 0);
  const statusLabel: Record<string, string> = { accepted: "angenommen", revoked: "zurückgezogen", draft: "Entwurf", sent: "versendet", viewed: "angesehen" };
  return (
    <Card title="Angebote" action={openTotal > 0 && (
      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{openTotal.toLocaleString("de-DE")} € offen</span>
    )}>
      {documents.length === 0 && (
        <p className="text-xs text-muted-foreground">Noch kein Angebot. <Link to="/dokumente" className="text-primary hover:underline">Dokumente öffnen</Link></p>
      )}
      {documents.map(doc => (
        <Link key={doc.id} to="/dokumente" className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-2.5 py-2 hover:border-primary/50 transition-colors">
          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs">{doc.title}</div>
            <div className="text-[10px] text-muted-foreground">{statusLabel[doc.status] ?? doc.status}</div>
          </div>
          {doc.amount_net != null && <span className="shrink-0 text-xs font-semibold">{Number(doc.amount_net).toLocaleString("de-DE")} €</span>}
        </Link>
      ))}
    </Card>
  );
}

export { Card };
