import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Plus, Trash2, Save, Send, Printer, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import OfferDocumentView from "./OfferDocumentView";
import { OfferDoc, uid, eur, eur2, sumPositions } from "./offerDocument";

interface Props {
  open: boolean;
  onClose: () => void;
  offerId: string | null;
  initialDoc: OfferDoc | null;
  initialRecipient: { email: string; name: string; company: string; address: string };
  subjectDefault: string;
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</Label>
    {children}
  </div>
);

const Section = ({
  title,
  children,
  defaultOpen = false,
}: { title: string; children: React.ReactNode; defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold"
      >
        {title}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="space-y-4 border-t border-border px-4 py-4">{children}</div>}
    </div>
  );
};

export default function OfferDocumentEditor({
  open, onClose, offerId, initialDoc, initialRecipient, subjectDefault,
}: Props) {
  const { toast } = useToast();
  const [doc, setDoc] = useState<OfferDoc | null>(initialDoc);
  const [subject, setSubject] = useState(subjectDefault);
  const [recipient, setRecipient] = useState(initialRecipient);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setDoc(initialDoc); }, [initialDoc]);
  useEffect(() => { setSubject(subjectDefault); }, [subjectDefault]);
  useEffect(() => { setRecipient(initialRecipient); }, [initialRecipient]);

  // Empfängerdaten live ins Dokument spiegeln
  useEffect(() => {
    setDoc((d) => {
      if (!d) return d;
      const lines = [
        ...(recipient.name && recipient.company ? [`z. Hd. ${recipient.name}`] : []),
        ...recipient.address.split("\n").map((l) => l.trim()).filter(Boolean),
      ];
      return { ...d, toName: recipient.company || recipient.name || "—", toLines: lines };
    });
  }, [recipient]);

  if (!open || !doc) return null;

  const set = <K extends keyof OfferDoc>(key: K, value: OfferDoc[K]) =>
    setDoc((d) => (d ? { ...d, [key]: value } : d));

  const total = sumPositions(doc.positions);

  const recalcTotals = () => {
    setDoc((d) => {
      if (!d) return d;
      const t = sumPositions(d.positions);
      return {
        ...d,
        paymentTotalValue: eur(t),
        conditions: d.conditions.map((c) =>
          c.label.toLowerCase().includes("brutto")
            ? { ...c, value: eur2(t * (1 + d.vatRate / 100)) }
            : c,
        ),
      };
    });
  };

  const save = async () => {
    if (!offerId) return;
    setSaving(true);
    const { error } = await supabase.from("offers").update({
      document: doc as any,
      subject,
      offer_number: doc.offerNumber,
      recipient_email: recipient.email.trim(),
      recipient_name: recipient.name || recipient.company,
      recipient_company: recipient.company,
      recipient_address: recipient.address,
      monthly_price: Math.round(total / Math.max(1, doc.timeline.length ? 1 : 1)) || 0,
    }).eq("id", offerId);
    setSaving(false);
    if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); return false; }
    toast({ title: "Angebot gespeichert" });
    return true;
  };

  const print = () => window.print();

  const send = async () => {
    const mail = recipient.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      toast({ title: "E-Mail-Adresse ungültig", description: "Bitte eine gültige Empfänger-Adresse eintragen (z. B. name@firma.de).", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const ok = await save();
      if (!ok) return;
      const { data, error } = await supabase.functions.invoke("offer-send", {
        body: { offerId, appUrl: window.location.origin },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Angebot gesendet", description: `An ${mail}` });
      onClose();
    } catch (e: any) {
      toast({ title: "Senden fehlgeschlagen", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[120] flex flex-col bg-background">
      {/* Topbar */}
      <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            Schritt 2 · Angebot final anpassen
          </div>
          <div className="font-display text-lg font-bold">{doc.offerNumber || "Neues Angebot"}</div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={print}>
            <Printer className="mr-2 h-4 w-4" /> PDF prüfen
          </Button>
          <Button variant="secondary" size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Speichern
          </Button>
          <Button size="sm" onClick={send} disabled={sending}>
            {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} An Kunde senden
          </Button>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Formular */}
        <div className="w-[420px] shrink-0 space-y-3 overflow-y-auto border-r border-border bg-muted/30 p-4">
          <Section title="Kunde & Versand" defaultOpen>
            <Field label="Firma">
              <Input value={recipient.company} onChange={(e) => setRecipient({ ...recipient, company: e.target.value })} />
            </Field>
            <Field label="Ansprechpartner">
              <Input value={recipient.name} onChange={(e) => setRecipient({ ...recipient, name: e.target.value })} />
            </Field>
            <Field label="Adresse (mehrzeilig)">
              <Textarea rows={3} value={recipient.address} onChange={(e) => setRecipient({ ...recipient, address: e.target.value })} />
            </Field>
            <Field label="E-Mail">
              <Input type="email" value={recipient.email} onChange={(e) => setRecipient({ ...recipient, email: e.target.value })} />
            </Field>
            <Field label="Betreff der E-Mail">
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </Field>
          </Section>

          <Section title="Kopf & Titel" defaultOpen>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Angebotsnummer"><Input value={doc.offerNumber} onChange={(e) => set("offerNumber", e.target.value)} /></Field>
              <Field label="Datum"><Input value={doc.dateLabel} onChange={(e) => set("dateLabel", e.target.value)} /></Field>
            </div>
            <Field label="Kopfzeile rechts"><Input value={doc.headerKicker} onChange={(e) => set("headerKicker", e.target.value)} /></Field>
            <Field label="Eyebrow (blau)"><Input value={doc.eyebrow} onChange={(e) => set("eyebrow", e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Titel oben"><Input value={doc.titleTop} onChange={(e) => set("titleTop", e.target.value)} /></Field>
              <Field label="Titel Hauptzeile"><Input value={doc.titleMain} onChange={(e) => set("titleMain", e.target.value)} /></Field>
            </div>
            <Field label="Umfang (eine Zeile pro Punkt)">
              <Textarea rows={3} value={doc.scopeLines.join("\n")} onChange={(e) => set("scopeLines", e.target.value.split("\n"))} />
            </Field>
          </Section>

          <Section title={`Positionen (${doc.positions.length})`} defaultOpen>
            {doc.positions.map((p, i) => (
              <div key={p.id} className="space-y-2 rounded-lg border border-border bg-background p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground">Position {i + 1}</span>
                  <button
                    onClick={() => { set("positions", doc.positions.filter((x) => x.id !== p.id)); setTimeout(recalcTotals, 0); }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <Input
                  value={p.title}
                  placeholder="Titel"
                  onChange={(e) => set("positions", doc.positions.map((x) => x.id === p.id ? { ...x, title: e.target.value } : x))}
                />
                <Textarea
                  rows={3}
                  value={p.description}
                  placeholder="Beschreibung"
                  onChange={(e) => set("positions", doc.positions.map((x) => x.id === p.id ? { ...x, description: e.target.value } : x))}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={p.calc}
                    placeholder="Berechnung"
                    onChange={(e) => set("positions", doc.positions.map((x) => x.id === p.id ? { ...x, calc: e.target.value } : x))}
                  />
                  <Input
                    type="number"
                    value={p.amount}
                    placeholder="Betrag netto"
                    onChange={(e) => set("positions", doc.positions.map((x) => x.id === p.id ? { ...x, amount: Number(e.target.value) } : x))}
                    onBlur={recalcTotals}
                  />
                </div>
              </div>
            ))}
            <Button
              variant="outline" size="sm" className="w-full"
              onClick={() => set("positions", [...doc.positions, { id: uid(), title: "Neue Position", description: "", calc: "pauschal", amount: 0 }])}
            >
              <Plus className="mr-2 h-4 w-4" /> Position hinzufügen
            </Button>
            <div className="rounded-lg bg-muted px-3 py-2 text-sm">
              Gesamt netto: <strong>{eur(total)}</strong> · brutto {eur2(total * (1 + doc.vatRate / 100))}
              <Button variant="ghost" size="sm" className="ml-2 h-6 text-xs" onClick={recalcTotals}>Summen aktualisieren</Button>
            </div>
          </Section>

          <Section title="Summe, Optional & Fußnoten">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bezeichnung Summe"><Input value={doc.totalLabel} onChange={(e) => set("totalLabel", e.target.value)} /></Field>
              <Field label="USt. %"><Input type="number" value={doc.vatRate} onChange={(e) => set("vatRate", Number(e.target.value))} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Zusatzzeile Label"><Input value={doc.recurringLabel} onChange={(e) => set("recurringLabel", e.target.value)} /></Field>
              <Field label="Zusatzzeile Wert"><Input value={doc.recurringValue} onChange={(e) => set("recurringValue", e.target.value)} /></Field>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <span className="text-sm">Optional-Box anzeigen</span>
              <Switch checked={doc.optionalEnabled} onCheckedChange={(v) => set("optionalEnabled", v)} />
            </div>
            {doc.optionalEnabled && (
              <>
                <Field label="Optional Titel"><Input value={doc.optionalTitle} onChange={(e) => set("optionalTitle", e.target.value)} /></Field>
                <Field label="Optional Beschreibung"><Input value={doc.optionalSubtitle} onChange={(e) => set("optionalSubtitle", e.target.value)} /></Field>
                <Field label="Optional Preis"><Input value={doc.optionalPrice} onChange={(e) => set("optionalPrice", e.target.value)} /></Field>
              </>
            )}
            <Field label="Fußnoten (eine pro Zeile)">
              <Textarea rows={3} value={doc.footnotes.join("\n")} onChange={(e) => set("footnotes", e.target.value.split("\n"))} />
            </Field>
          </Section>

          <Section title="Zwei-Spalten-Block">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <span className="text-sm">Block anzeigen</span>
              <Switch checked={doc.splitEnabled} onCheckedChange={(v) => set("splitEnabled", v)} />
            </div>
            {doc.splitEnabled && (
              <>
                <Field label="Linke Überschrift"><Input value={doc.splitLeftTitle} onChange={(e) => set("splitLeftTitle", e.target.value)} /></Field>
                <Field label="Linker Text"><Textarea rows={3} value={doc.splitLeftText} onChange={(e) => set("splitLeftText", e.target.value)} /></Field>
                <Field label="Rechte Überschrift"><Input value={doc.splitRightTitle} onChange={(e) => set("splitRightTitle", e.target.value)} /></Field>
                <Field label="Rechter Text"><Textarea rows={3} value={doc.splitRightText} onChange={(e) => set("splitRightText", e.target.value)} /></Field>
              </>
            )}
          </Section>

          <Section title="Enthalten">
            <Field label="Überschrift"><Input value={doc.includedTitle} onChange={(e) => set("includedTitle", e.target.value)} /></Field>
            <Field label="Punkte (einer pro Zeile)">
              <Textarea rows={8} value={doc.included.join("\n")} onChange={(e) => set("included", e.target.value.split("\n"))} />
            </Field>
          </Section>

          <Section title="Vorgehensweise / Zeitplan">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <span className="text-sm">Abschnitt anzeigen</span>
              <Switch checked={doc.timelineEnabled} onCheckedChange={(v) => set("timelineEnabled", v)} />
            </div>
            {doc.timelineEnabled && (
              <>
                <Field label="Überschrift"><Input value={doc.timelineTitle} onChange={(e) => set("timelineTitle", e.target.value)} /></Field>
                {doc.timeline.map((s, i) => (
                  <div key={s.id} className="space-y-2 rounded-lg border border-border bg-background p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-muted-foreground">Schritt {i + 1}</span>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          Hervorheben
                          <Switch
                            checked={!!s.highlight}
                            onCheckedChange={(v) => set("timeline", doc.timeline.map((x) => x.id === s.id ? { ...x, highlight: v } : x))}
                          />
                        </label>
                        <button onClick={() => set("timeline", doc.timeline.filter((x) => x.id !== s.id))} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input value={s.when} placeholder="Zeitpunkt" onChange={(e) => set("timeline", doc.timeline.map((x) => x.id === s.id ? { ...x, when: e.target.value } : x))} />
                      <Input value={s.title} placeholder="Titel" onChange={(e) => set("timeline", doc.timeline.map((x) => x.id === s.id ? { ...x, title: e.target.value } : x))} />
                    </div>
                    <Textarea rows={2} value={s.text} placeholder="Beschreibung" onChange={(e) => set("timeline", doc.timeline.map((x) => x.id === s.id ? { ...x, text: e.target.value } : x))} />
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full" onClick={() => set("timeline", [...doc.timeline, { id: uid(), when: "", title: "", text: "" }])}>
                  <Plus className="mr-2 h-4 w-4" /> Schritt hinzufügen
                </Button>
              </>
            )}
          </Section>

          <Section title="Zahlungsplan & Konditionen">
            <Field label="Überschrift"><Input value={doc.paymentTitle} onChange={(e) => set("paymentTitle", e.target.value)} /></Field>
            <Field label="Titel Zahlungsplan"><Input value={doc.paymentPlanTitle} onChange={(e) => set("paymentPlanTitle", e.target.value)} /></Field>
            {doc.paymentRows.map((r, i) => (
              <div key={r.id} className="space-y-2 rounded-lg border border-border bg-background p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground">Rate {i + 1}</span>
                  <button onClick={() => set("paymentRows", doc.paymentRows.filter((x) => x.id !== r.id))} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input value={r.label} placeholder="Bezeichnung" onChange={(e) => set("paymentRows", doc.paymentRows.map((x) => x.id === r.id ? { ...x, label: e.target.value } : x))} />
                  <Input value={r.amount} placeholder="Betrag" onChange={(e) => set("paymentRows", doc.paymentRows.map((x) => x.id === r.id ? { ...x, amount: e.target.value } : x))} />
                </div>
                <Input value={r.sub ?? ""} placeholder="Zusatz (optional)" onChange={(e) => set("paymentRows", doc.paymentRows.map((x) => x.id === r.id ? { ...x, sub: e.target.value } : x))} />
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full" onClick={() => set("paymentRows", [...doc.paymentRows, { id: uid(), label: "", amount: "" }])}>
              <Plus className="mr-2 h-4 w-4" /> Rate hinzufügen
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Summe Label"><Input value={doc.paymentTotalLabel} onChange={(e) => set("paymentTotalLabel", e.target.value)} /></Field>
              <Field label="Summe Wert"><Input value={doc.paymentTotalValue} onChange={(e) => set("paymentTotalValue", e.target.value)} /></Field>
            </div>
            <Field label="Fußnote Zahlungsplan"><Input value={doc.paymentFootnote} onChange={(e) => set("paymentFootnote", e.target.value)} /></Field>

            {doc.conditions.map((c) => (
              <div key={c.id} className="flex items-center gap-2">
                <Input value={c.label} onChange={(e) => set("conditions", doc.conditions.map((x) => x.id === c.id ? { ...x, label: e.target.value } : x))} />
                <Input value={c.value} onChange={(e) => set("conditions", doc.conditions.map((x) => x.id === c.id ? { ...x, value: e.target.value } : x))} />
                <button onClick={() => set("conditions", doc.conditions.filter((x) => x.id !== c.id))} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full" onClick={() => set("conditions", [...doc.conditions, { id: uid(), label: "", value: "" }])}>
              <Plus className="mr-2 h-4 w-4" /> Kondition hinzufügen
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Gültig bis Label"><Input value={doc.validLabel} onChange={(e) => set("validLabel", e.target.value)} /></Field>
              <Field label="Gültig bis"><Input value={doc.validValue} onChange={(e) => set("validValue", e.target.value)} /></Field>
            </div>
            <Field label="Hinweis unter Gültigkeit"><Textarea rows={2} value={doc.validNote} onChange={(e) => set("validNote", e.target.value)} /></Field>
          </Section>

          <Section title="Hinweise & Footer">
            <Field label="Hinweise"><Textarea rows={6} value={doc.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Unternehmen"><Input value={doc.footerCompany} onChange={(e) => set("footerCompany", e.target.value)} /></Field>
              <Field label="Adresse"><Input value={doc.footerAddress} onChange={(e) => set("footerAddress", e.target.value)} /></Field>
              <Field label="Rechtliches 1"><Input value={doc.footerLegal1} onChange={(e) => set("footerLegal1", e.target.value)} /></Field>
              <Field label="Rechtliches 2"><Input value={doc.footerLegal2} onChange={(e) => set("footerLegal2", e.target.value)} /></Field>
              <Field label="Kontakt 1"><Input value={doc.footerContact1} onChange={(e) => set("footerContact1", e.target.value)} /></Field>
              <Field label="Kontakt 2"><Input value={doc.footerContact2} onChange={(e) => set("footerContact2", e.target.value)} /></Field>
            </div>
          </Section>
        </div>

        {/* Live-Vorschau */}
        <div className="min-w-0 flex-1 overflow-auto bg-[#eef1f6] p-8" ref={previewRef}>
          <div id="offer-print-area" className="mx-auto w-fit">
            <div className="offer-preview-scale origin-top">
              <OfferDocumentView doc={doc} />
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
