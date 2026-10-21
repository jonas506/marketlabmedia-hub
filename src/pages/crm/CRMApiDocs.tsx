import { Link } from "react-router-dom";
import { ArrowLeft, KeyRound } from "lucide-react";
import AppLayout from "@/components/AppLayout";

const URL_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/crm-api`;

const EXAMPLES: { title: string; desc: string; body: unknown }[] = [
  { title: "upsert_contacts", desc: "Bis zu 500 Kontakte. Abgleich: external_ref → email → linkedin_url → phone/whatsapp → full_name + company. Leere Werte überschreiben nichts, Tags werden zusammengeführt.", body: { action: "upsert_contacts", contacts: [{ external_ref: "mw:mail-zaunbau-hellmann", full_name: "Max Hellmann", company: "Zaunbau Hellmann", email: "max@example.de", region: "Bobingen & Umgebung", segment: "mittelstand", relationship: "kalt", tags: ["Mail-Welle"], source: "Mail-Welle Nachbargemeinden" }] } },
  { title: "add_activities", desc: "contact_ref = id, external_ref oder E-Mail. Typen: note, call, email, sms, whatsapp, linkedin, instagram, brief, event. Setzt letzten Kontakt + Kanal.", body: { action: "add_activities", activities: [{ contact_ref: "mw:mail-zaunbau-hellmann", type: "email", title: "Einladung Mittelstandswerk #1", body: "Mail verschickt", occurred_at: "2026-10-21T09:00:00+02:00" }] } },
  { title: "set_event_guests", desc: "Status: angefragt, eingeladen, vielleicht, zusage, spaeter, absage, bounce, erschienen.", body: { action: "set_event_guests", event_slug: "mittelstandswerk-1", guests: [{ contact_ref: "max@example.de", status: "eingeladen", invited_via: "mail" }] } },
  { title: "upsert_leads", desc: "pipeline = Name oder ID, stage = Label der Stage. Bestehender Lead desselben Kontakts in der Pipeline wird aktualisiert.", body: { action: "upsert_leads", leads: [{ contact_ref: "max@example.de", pipeline: "Zusammenarbeit", stage: "Erstkontakt", source: "Mail-Welle", next_step: "Anrufen", next_step_date: "2026-10-28" }] } },
  { title: "search", desc: "Kontakte inkl. Event-Status und letztem Kontakt. limit max. 200.", body: { action: "search", q: "Bobingen", segment: "mittelstand", event_slug: "mittelstandswerk-1", limit: 50 } },
  { title: "list_events", desc: "Alle Events mit Gäste-Zählern pro Status und belegten Plätzen.", body: { action: "list_events" } },
];

export default function CRMApiDocs() {
  return (
    <AppLayout>
      <div className="space-y-4 max-w-3xl">
        <Link to="/team" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Einstellungen</Link>
        <h1 className="text-2xl font-bold">CRM-API</h1>
        <div className="bg-card border border-border rounded-lg p-4 space-y-2 text-sm">
          <p>Alle Aufrufe per <code className="text-primary">POST</code> mit JSON an:</p>
          <pre className="text-xs bg-muted/40 rounded p-2 overflow-x-auto">{URL_BASE}</pre>
          <p className="flex items-start gap-2 text-muted-foreground"><KeyRound className="h-4 w-4 mt-0.5 shrink-0" />Header <code>Authorization: Bearer &lt;CRM_API_KEY&gt;</code>. Der Schlüssel liegt nur in den Secrets und wird hier nicht angezeigt. Ohne gültigen Schlüssel antwortet die API mit 401.</p>
        </div>
        {EXAMPLES.map(e => (
          <div key={e.title} className="bg-card border border-border rounded-lg p-4 space-y-2">
            <h2 className="font-semibold font-mono text-sm">{e.title}</h2>
            <p className="text-xs text-muted-foreground">{e.desc}</p>
            <pre className="text-xs bg-muted/40 rounded p-2 overflow-x-auto">{`curl -X POST "${URL_BASE}" \\
  -H "Authorization: Bearer $CRM_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(e.body, null, 2)}'`}</pre>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
