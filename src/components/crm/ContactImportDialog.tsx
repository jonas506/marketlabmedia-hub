import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useCrmEvents } from "@/hooks/useCrmContacts";
import { CONTACT_FIELDS, parseCsv, SEGMENTS, RELATIONSHIPS, CHANNELS } from "@/lib/crm-contacts";

const SKIP = "__skip";
const FIELD_LABEL: Record<string, string> = {
  full_name: "Name (Pflicht)", first_name: "Vorname", company: "Firma", role: "Rolle", email: "E-Mail", phone: "Telefon",
  whatsapp: "WhatsApp", linkedin_url: "LinkedIn-URL", instagram_handle: "Instagram", website: "Website", city: "Ort",
  region: "Region", segment: "Segment", relationship: "Beziehung", tags: "Tags (Komma-getrennt)", source: "Quelle",
  last_contact_at: "Letzter Kontakt", last_channel: "Letzter Kanal", next_followup_date: "Follow-up", notes: "Notizen",
  do_not_contact: "Nicht kontaktieren", lat: "Breitengrad", lon: "Längengrad", external_ref: "Externe Referenz",
};
const GUESS: Record<string, string[]> = {
  full_name: ["name", "full_name", "vollständiger name", "kontakt"], first_name: ["vorname", "first_name"], company: ["firma", "company", "unternehmen"],
  role: ["rolle", "position", "role"], email: ["email", "e-mail", "mail"], phone: ["telefon", "phone", "tel"], whatsapp: ["whatsapp"],
  linkedin_url: ["linkedin"], instagram_handle: ["instagram"], website: ["website", "webseite", "url"], city: ["ort", "stadt", "city"],
  region: ["region"], segment: ["segment"], tags: ["tags"], source: ["quelle", "source"], notes: ["notiz", "notizen", "notes"], external_ref: ["external_ref", "ref"],
};

const matchEnum = (list: readonly { value: string; label: string }[], v: string) => {
  const s = v.trim().toLowerCase();
  return list.find(x => x.value === s || x.label.toLowerCase() === s)?.value ?? null;
};

export default function ContactImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const { data: events = [] } = useCrmEvents();
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<string[]>([]);
  const [tag, setTag] = useState("");
  const [eventId, setEventId] = useState(SKIP);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; failed: number } | null>(null);

  const header = rows[0] ?? [];
  const body = rows.slice(1);

  const onFile = async (f?: File) => {
    if (!f) return;
    const parsed = parseCsv(await f.text());
    setRows(parsed);
    setResult(null);
    setMapping((parsed[0] ?? []).map(h => {
      const k = h.trim().toLowerCase();
      return Object.entries(GUESS).find(([, names]) => names.includes(k))?.[0] ?? SKIP;
    }));
  };

  const toContact = (r: string[]) => {
    const c: Record<string, unknown> = {};
    mapping.forEach((field, i) => {
      const v = (r[i] ?? "").trim();
      if (field === SKIP || !v) return;
      if (field === "tags") c.tags = v.split(/[,|]/).map(t => t.trim()).filter(Boolean);
      else if (field === "segment") c.segment = matchEnum(SEGMENTS, v);
      else if (field === "relationship") c.relationship = matchEnum(RELATIONSHIPS, v);
      else if (field === "last_channel") c.last_channel = matchEnum(CHANNELS, v);
      else if (field === "do_not_contact") c.do_not_contact = /^(1|ja|true|x|yes)$/i.test(v);
      else if (field === "lat" || field === "lon") c[field] = Number(v.replace(",", ".")) || null;
      else c[field] = v;
    });
    if (!c.full_name && c.first_name) c.full_name = c.first_name;
    if (tag.trim()) c.tags = [...((c.tags as string[]) ?? []), tag.trim()];
    return c;
  };

  const preview = useMemo(() => body.slice(0, 5).map(toContact), [body, mapping, tag]); // eslint-disable-line react-hooks/exhaustive-deps
  const hasName = mapping.includes("full_name") || mapping.includes("first_name");

  const run = async () => {
    setBusy(true);
    let created = 0, updated = 0, failed = 0;
    const ids: string[] = [];
    for (const r of body) {
      const c = toContact(r);
      if (!c.full_name) { failed++; continue; }
      const { data, error } = await supabase.rpc("crm_upsert_contact", { _c: c as any });
      if (error || !data) { failed++; continue; }
      const res = data as { id: string; status: string };
      ids.push(res.id);
      res.status === "created" ? created++ : updated++;
    }
    if (eventId !== SKIP && ids.length) {
      const rowsToAdd = Array.from(new Set(ids)).map(id => ({ event_id: eventId, contact_id: id, status: "eingeladen" as const }));
      await supabase.from("crm_event_guests").upsert(rowsToAdd, { onConflict: "event_id,contact_id", ignoreDuplicates: true });
    }
    setResult({ created, updated, failed });
    setBusy(false);
    ["crm-contacts", "crm-event-guests"].forEach(k => qc.invalidateQueries({ queryKey: [k] }));
    toast.success(`${created} neu, ${updated} aktualisiert`);
  };

  return (
    <Dialog open={open} onOpenChange={o => { onOpenChange(o); if (!o) { setRows([]); setResult(null); } }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Kontakte importieren (CSV)</DialogTitle></DialogHeader>
        {rows.length === 0 ? (
          <label className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-10 cursor-pointer hover:border-primary/50">
            <Upload className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm">CSV-Datei auswählen (Komma oder Semikolon)</span>
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
          </label>
        ) : (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-2">Spalten zuordnen ({body.length} Zeilen)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {header.map((h, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs w-32 truncate text-muted-foreground" title={h}>{h || `Spalte ${i + 1}`}</span>
                    <Select value={mapping[i]} onValueChange={v => setMapping(m => m.map((x, j) => (j === i ? v : x)))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SKIP}>— ignorieren —</SelectItem>
                        {CONTACT_FIELDS.map(f => <SelectItem key={f} value={f}>{FIELD_LABEL[f]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Input className="h-9 w-48" placeholder="Optional: Tag setzen" value={tag} onChange={e => setTag(e.target.value)} />
              <Select value={eventId} onValueChange={setEventId}>
                <SelectTrigger className="h-9 w-64"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={SKIP}>Kein Event</SelectItem>
                  {events.map(e => <SelectItem key={e.id} value={e.id}>Einladen zu: {e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">Vorschau</h3>
              <div className="border border-border rounded-lg overflow-auto text-xs">
                <table className="w-full">
                  <thead className="bg-muted/40"><tr>{["Name", "Firma", "E-Mail", "Telefon", "Region", "Tags"].map(h => <th key={h} className="text-left px-2 py-1.5 font-medium text-muted-foreground">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-border">
                    {preview.map((c, i) => (
                      <tr key={i}>{[c.full_name, c.company, c.email, c.phone, c.region ?? c.city, ((c.tags as string[]) ?? []).join(", ")].map((v, j) => <td key={j} className="px-2 py-1.5">{(v as string) || "—"}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Abgleich mit bestehenden Kontakten: externe Referenz → E-Mail → LinkedIn → Telefon → Name + Firma. Leere Werte überschreiben nichts.</p>
            </div>
            {result && <p className="text-sm">{result.created} neu · {result.updated} aktualisiert · {result.failed} übersprungen</p>}
          </div>
        )}
        <DialogFooter>
          {rows.length > 0 && (
            <Button onClick={run} disabled={busy || !hasName || !!result}>
              {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}{body.length} Kontakte importieren
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
