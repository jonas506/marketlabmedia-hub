import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { de } from "date-fns/locale";
import { Search, Download, Tag, Users2, CalendarPlus, CalendarClock, Copy, X, Ban, MessageCircle, Linkedin, Mail, Instagram, Phone, FileText, User, ArrowUpDown, SlidersHorizontal, BookmarkPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCrmContacts, useCrmEvents, useCrmEventGuests, useContactLeads, isOpenLeadStage } from "@/hooks/useCrmContacts";
import { SEGMENTS, RELATIONSHIPS, GUEST_STATUSES, labelOf, colorOf, isFollowupDue, isWarmStale, toCsv } from "@/lib/crm-contacts";
import { cn } from "@/lib/utils";
import DuplicateFinder from "./DuplicateFinder";
import ContactImportDialog from "./ContactImportDialog";
import type { CrmContact } from "@/hooks/useCrmContacts";

export const CHANNEL_ICON: Record<string, typeof Mail> = {
  whatsapp: MessageCircle, linkedin: Linkedin, mail: Mail, instagram: Instagram, telefon: Phone, brief: FileText, persoenlich: User,
};

const ALL = "__all";

interface Filters {
  segment: string; rel: string; region: string; tag: string;
  eventF: string; eventStatus: string; staleDays: string; followupDue: boolean; dnc: string;
}
const EMPTY_FILTERS: Filters = { segment: ALL, rel: ALL, region: "", tag: ALL, eventF: ALL, eventStatus: ALL, staleDays: "", followupDue: false, dnc: ALL };

interface SavedView { name: string; filters: Filters }

const PRESET_VIEWS: { name: string; filters: Partial<Filters> }[] = [
  { name: "Alle", filters: {} },
  { name: "Follow-up fällig", filters: { followupDue: true } },
  { name: "Ins Schwarze Kandidaten", filters: { tag: "ins-schwarze-kandidat" } },
  { name: "Immo & Finanz", filters: { segment: "immo_finanz" } },
  { name: "Kunden", filters: { rel: "kunde" } },
];

const LS_KEY = "crm-contact-views";

type SortKey = "full_name" | "company" | "segment" | "region" | "last_contact_at" | "next_followup_date";

export default function ContactsTab() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data: contacts = [], isLoading } = useCrmContacts();
  const { data: events = [] } = useCrmEvents();
  const { data: guests = [] } = useCrmEventGuests();
  const { data: leads = [] } = useContactLeads();

  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [activeView, setActiveView] = useState("Alle");
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]"); } catch { return []; }
  });
  const [sortKey, setSortKey] = useState<SortKey>("full_name");
  const [sortAsc, setSortAsc] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<null | "tag" | "segment" | "event" | "followup">(null);
  const [bulkValue, setBulkValue] = useState("");
  const [dupOpen, setDupOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [viewName, setViewName] = useState("");

  const setF = (patch: Partial<Filters>) => { setFilters(f => ({ ...f, ...patch })); setActiveView(""); };
  const applyView = (name: string, patch: Partial<Filters>) => { setFilters({ ...EMPTY_FILTERS, ...patch }); setActiveView(name); };

  const mittelstandswerk = events.find(e => /mittelstandswerk/i.test(e.name));
  const dynamicViews = mittelstandswerk
    ? [{ name: "Mittelstandswerk Zusagen", filters: { eventF: mittelstandswerk.id, eventStatus: "zusage" } }]
    : [];

  const eventById = useMemo(() => new Map(events.map(e => [e.id, e])), [events]);
  const guestsByContact = useMemo(() => {
    const m = new Map<string, typeof guests>();
    guests.forEach(g => m.set(g.contact_id, [...(m.get(g.contact_id) ?? []), g]));
    return m;
  }, [guests]);
  const openLeadsByContact = useMemo(() => {
    const m = new Map<string, number>();
    leads.forEach(l => { if (l.contact_id && isOpenLeadStage(l.stage)) m.set(l.contact_id, (m.get(l.contact_id) ?? 0) + 1); });
    return m;
  }, [leads]);
  const allTags = useMemo(() => Array.from(new Set(contacts.flatMap(c => c.tags ?? []))).sort(), [contacts]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const r = filters.region.trim().toLowerCase();
    const days = Number(filters.staleDays);
    const list = contacts.filter(c => {
      if (s && ![c.full_name, c.company, c.email, c.city, c.region].some(v => v?.toLowerCase().includes(s))) return false;
      if (filters.segment !== ALL && c.segment !== filters.segment) return false;
      if (filters.rel !== ALL && c.relationship !== filters.rel) return false;
      if (r && !(c.region?.toLowerCase().includes(r) || c.city?.toLowerCase().includes(r))) return false;
      if (filters.tag !== ALL && !(c.tags ?? []).includes(filters.tag)) return false;
      if (filters.eventF !== ALL) {
        const g = (guestsByContact.get(c.id) ?? []).find(x => x.event_id === filters.eventF);
        if (!g || (filters.eventStatus !== ALL && g.status !== filters.eventStatus)) return false;
      }
      if (days > 0 && c.last_contact_at && Date.now() - new Date(c.last_contact_at).getTime() < days * 86400000) return false;
      if (filters.followupDue && !isFollowupDue(c)) return false;
      if (filters.dnc === "yes" && !c.do_not_contact) return false;
      if (filters.dnc === "no" && c.do_not_contact) return false;
      return true;
    });
    const val = (c: CrmContact) => (c[sortKey] ?? "") as string;
    list.sort((a, b) => {
      const cmp = String(val(a)).localeCompare(String(val(b)), "de");
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [contacts, q, filters, guestsByContact, sortKey, sortAsc]);

  const toggle = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = filtered.length > 0 && filtered.every(c => selected.has(c.id));
  const refresh = () => { qc.invalidateQueries({ queryKey: ["crm-contacts"] }); qc.invalidateQueries({ queryKey: ["crm-event-guests"] }); };

  const applyBulk = async () => {
    const ids = Array.from(selected);
    if (!ids.length || !bulkValue) return;
    let error: unknown = null;
    if (bulk === "tag") {
      for (const c of contacts.filter(c => selected.has(c.id))) {
        const tags = Array.from(new Set([...(c.tags ?? []), bulkValue.trim()]));
        const r = await supabase.from("crm_contacts").update({ tags }).eq("id", c.id);
        if (r.error) error = r.error;
      }
    } else if (bulk === "segment") {
      ({ error } = await supabase.from("crm_contacts").update({ segment: bulkValue as any }).in("id", ids));
    } else if (bulk === "followup") {
      ({ error } = await supabase.from("crm_contacts").update({ next_followup_date: bulkValue }).in("id", ids));
    } else if (bulk === "event") {
      const existing = new Set(guests.filter(g => g.event_id === bulkValue).map(g => g.contact_id));
      const rows = ids.filter(id => !existing.has(id)).map(id => ({ event_id: bulkValue, contact_id: id, status: "eingeladen" as const }));
      if (rows.length) ({ error } = await supabase.from("crm_event_guests").insert(rows));
    }
    if (error) { toast.error("Aktion fehlgeschlagen"); return; }
    toast.success(`${ids.length} Kontakte aktualisiert`);
    setBulk(null); setBulkValue(""); refresh();
  };

  const exportCsv = () => {
    const rows = contacts.filter(c => selected.has(c.id));
    const header = ["Name", "Vorname", "Firma", "Rolle", "E-Mail", "Telefon", "WhatsApp", "LinkedIn", "Ort", "Region", "Segment", "Beziehung", "Tags", "Quelle", "Letzter Kontakt", "Follow-up", "Nicht kontaktieren"];
    const csv = toCsv([header, ...rows.map(c => [c.full_name, c.first_name, c.company, c.role, c.email, c.phone, c.whatsapp, c.linkedin_url, c.city, c.region, labelOf(SEGMENTS, c.segment), labelOf(RELATIONSHIPS, c.relationship), (c.tags ?? []).join(", "), c.source, c.last_contact_at?.slice(0, 10), c.next_followup_date, c.do_not_contact ? "ja" : ""])]);
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `kontakte-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const saveView = () => {
    const name = viewName.trim();
    if (!name) return;
    const next = [...savedViews.filter(v => v.name !== name), { name, filters }];
    setSavedViews(next);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
    setActiveView(name);
    setSaveViewOpen(false); setViewName("");
    toast.success(`Ansicht „${name}“ gespeichert`);
  };

  const activeFilterCount = Object.entries(filters).filter(([k, v]) => {
    const empty = EMPTY_FILTERS[k as keyof Filters];
    return v !== empty;
  }).length;

  const sel = (value: string, onChange: (v: string) => void, placeholder: string, items: { value: string; label: string }[]) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-full text-xs"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}: alle</SelectItem>
        {items.map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  const SortTh = ({ field, children, className }: { field: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={cn("px-3 py-2 font-medium cursor-pointer hover:text-foreground select-none", className)}
      onClick={() => { if (sortKey === field) setSortAsc(!sortAsc); else { setSortKey(field); setSortAsc(true); } }}>
      <span className="inline-flex items-center gap-1">
        {children}
        {sortKey === field && <ArrowUpDown className="h-3 w-3" />}
      </span>
    </th>
  );

  return (
    <div className="space-y-3">
      {/* Gespeicherte Ansichten */}
      <div className="flex flex-wrap items-center gap-1.5">
        {[...PRESET_VIEWS, ...dynamicViews].map(v => (
          <button key={v.name} onClick={() => applyView(v.name, v.filters)}
            className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors border",
              activeView === v.name ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
            {v.name}
          </button>
        ))}
        {savedViews.map(v => (
          <button key={v.name} onClick={() => applyView(v.name, v.filters)}
            className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors border",
              activeView === v.name ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
            {v.name}
          </button>
        ))}
        <button onClick={() => setSaveViewOpen(true)} title="Aktuelle Filter als Ansicht speichern"
          className="rounded-full px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border inline-flex items-center gap-1">
          <BookmarkPlus className="h-3 w-3" />Speichern
        </button>
      </div>

      {/* Filterleiste */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Name, Firma, E-Mail, Ort…" value={q} onChange={e => setQ(e.target.value)} className="pl-9 h-9" />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs">
              <SlidersHorizontal className="h-3.5 w-3.5" />Filter{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ""}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 space-y-2 p-3">
            {sel(filters.segment, v => setF({ segment: v }), "Segment", [...SEGMENTS])}
            {sel(filters.rel, v => setF({ rel: v }), "Beziehung", [...RELATIONSHIPS])}
            <Input placeholder="Region / Ort" value={filters.region} onChange={e => setF({ region: e.target.value })} className="h-8 text-xs" />
            {sel(filters.tag, v => setF({ tag: v }), "Tag", allTags.map(t => ({ value: t, label: t })))}
            {sel(filters.eventF, v => setF({ eventF: v, eventStatus: ALL }), "Event", events.map(e => ({ value: e.id, label: e.name })))}
            {filters.eventF !== ALL && sel(filters.eventStatus, v => setF({ eventStatus: v }), "Status", [...GUEST_STATUSES])}
            <Input type="number" min={0} placeholder="Kein Kontakt seit X Tagen" value={filters.staleDays} onChange={e => setF({ staleDays: e.target.value })} className="h-8 text-xs" />
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
              <Checkbox checked={filters.followupDue} onCheckedChange={v => setF({ followupDue: !!v })} /> Follow-up fällig
            </label>
            {sel(filters.dnc, v => setF({ dnc: v }), "Nicht kontaktieren", [{ value: "yes", label: "Nur gesperrte" }, { value: "no", label: "Ohne gesperrte" }])}
            <Button variant="ghost" size="sm" className="w-full h-7 text-xs" onClick={() => { setFilters(EMPTY_FILTERS); setActiveView("Alle"); }}>
              Filter zurücksetzen
            </Button>
          </PopoverContent>
        </Popover>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setDupOpen(true)}><Copy className="h-3.5 w-3.5 mr-1" />Dubletten</Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>Importieren</Button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
          <span className="font-medium">{selected.size} ausgewählt</span>
          <Button size="sm" variant="ghost" onClick={() => setBulk("tag")}><Tag className="h-3.5 w-3.5 mr-1" />Tag setzen</Button>
          <Button size="sm" variant="ghost" onClick={() => setBulk("segment")}><Users2 className="h-3.5 w-3.5 mr-1" />Segment</Button>
          <Button size="sm" variant="ghost" onClick={() => setBulk("event")}><CalendarPlus className="h-3.5 w-3.5 mr-1" />Zu Event einladen</Button>
          <Button size="sm" variant="ghost" onClick={() => setBulk("followup")}><CalendarClock className="h-3.5 w-3.5 mr-1" />Follow-up</Button>
          <Button size="sm" variant="ghost" onClick={exportCsv}><Download className="h-3.5 w-3.5 mr-1" />CSV-Export</Button>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}><X className="h-3.5 w-3.5" /></Button>
        </div>
      )}

      <div className="border border-border rounded-lg overflow-auto max-h-[70vh]">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 sticky top-0 z-10">
            <tr className="text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 w-8"><Checkbox checked={allSelected} onCheckedChange={v => setSelected(v ? new Set(filtered.map(c => c.id)) : new Set())} /></th>
              <SortTh field="full_name">Name</SortTh>
              <SortTh field="company">Firma</SortTh>
              <SortTh field="segment">Segment</SortTh>
              <SortTh field="region">Region</SortTh>
              <SortTh field="last_contact_at">Letzter Kontakt</SortTh>
              <SortTh field="next_followup_date">Follow-up</SortTh>
              <th className="px-3 py-2 font-medium">Events</th>
              <th className="px-3 py-2 font-medium">Leads</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map(c => {
              const Icon = c.last_channel ? CHANNEL_ICON[c.last_channel] : null;
              const due = isFollowupDue(c);
              return (
                <tr key={c.id} onClick={() => nav(`/crm/kontakt/${c.id}`)} className="hover:bg-muted/20 transition-colors cursor-pointer">
                  <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                    <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-medium inline-flex items-center gap-1.5">
                      {c.full_name}
                      {c.do_not_contact && <Ban className="h-3 w-3 text-destructive" aria-label="Nicht kontaktieren" />}
                    </span>
                    {isWarmStale(c) && <span className="ml-1.5 text-[10px] text-amber-400">30+ Tage still</span>}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{c.company || "—"}</td>
                  <td className="px-3 py-2.5">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: colorOf(SEGMENTS, c.segment) + "22", color: colorOf(SEGMENTS, c.segment) }}>
                      {labelOf(SEGMENTS, c.segment)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground text-xs">{c.region || c.city || "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground text-xs">
                    {c.last_contact_at ? (
                      <span className="inline-flex items-center gap-1.5">
                        {Icon && <Icon className="h-3.5 w-3.5" />}
                        {formatDistanceToNow(new Date(c.last_contact_at), { addSuffix: true, locale: de })}
                      </span>
                    ) : "—"}
                  </td>
                  <td className={`px-3 py-2.5 text-xs ${due ? "text-amber-400 font-medium" : "text-muted-foreground"}`}>
                    {c.next_followup_date ? format(new Date(c.next_followup_date), "dd.MM.yyyy") : "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {(guestsByContact.get(c.id) ?? []).map(g => (
                        <span key={g.id} title={`${eventById.get(g.event_id)?.name}: ${labelOf(GUEST_STATUSES, g.status)}`}
                          className="text-[10px] px-1.5 py-0.5 rounded-full font-medium max-w-[120px] truncate"
                          style={{ background: colorOf(GUEST_STATUSES, g.status) + "22", color: colorOf(GUEST_STATUSES, g.status) }}>
                          {eventById.get(g.event_id)?.name.split(" ").slice(0, 2).join(" ")} · {labelOf(GUEST_STATUSES, g.status)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs">{openLeadsByContact.get(c.id) ?? "—"}</td>
                </tr>
              );
            })}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">Keine Kontakte gefunden</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">{filtered.length} von {contacts.length} Kontakten</p>

      <Dialog open={!!bulk} onOpenChange={o => { if (!o) { setBulk(null); setBulkValue(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>
            {bulk === "tag" ? "Tag setzen" : bulk === "segment" ? "Segment setzen" : bulk === "event" ? "Zu Event einladen" : "Follow-up-Datum setzen"}
          </DialogTitle></DialogHeader>
          {bulk === "tag" && <Input autoFocus placeholder="Tag" value={bulkValue} onChange={e => setBulkValue(e.target.value)} list="crm-tags" />}
          <datalist id="crm-tags">{allTags.map(t => <option key={t} value={t} />)}</datalist>
          {bulk === "followup" && <Input type="date" value={bulkValue} onChange={e => setBulkValue(e.target.value)} />}
          {(bulk === "segment" || bulk === "event") && (
            <Select value={bulkValue} onValueChange={setBulkValue}>
              <SelectTrigger><SelectValue placeholder="Auswählen…" /></SelectTrigger>
              <SelectContent>
                {(bulk === "segment" ? SEGMENTS.map(s => ({ value: s.value, label: s.label })) : events.map(e => ({ value: e.id, label: e.name })))
                  .map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <DialogFooter><Button onClick={applyBulk} disabled={!bulkValue}>Für {selected.size} übernehmen</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={saveViewOpen} onOpenChange={setSaveViewOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Ansicht speichern</DialogTitle></DialogHeader>
          <Input autoFocus placeholder="Name der Ansicht" value={viewName} onChange={e => setViewName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && saveView()} />
          <DialogFooter><Button onClick={saveView} disabled={!viewName.trim()}>Speichern</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <DuplicateFinder open={dupOpen} onOpenChange={setDupOpen} />
      <ContactImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
