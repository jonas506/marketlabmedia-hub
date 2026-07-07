
# Interaktiver Paket-Konfigurator & Angebots-Workflow

## Ablauf (End-to-End)

```text
1) Call mit Lead (Screen-Share auf /pakete)
   Admin klickt „Konfigurator öffnen" → Panel überlagert die Seite
   → Paket wählen · Laufzeit (3/12 Mo) · Add-ons anklicken · Rabatt in %
   → Live-Summe unten (Setup, monatlich, Gesamt Laufzeit)

2) „Angebot erstellen" → Lead aus CRM auswählen (Suche)
   → Angebot wird in DB gespeichert (Status: draft)
   → Rich-Text-Editor öffnet sich mit vorbefülltem Angebotstext
     (Anrede, Paket-Zusammenfassung, Add-ons, Preise, CTA-Button-Platzhalter)

3) Admin editiert frei → „An Kunde senden"
   → E-Mail via Resend (bestehende crm-send-email Infrastruktur)
     mit eingebettetem HTML + „Angebot annehmen"-Button
   → Status: sent · Aktivität im Lead-Timeline

4) Kunde klickt Button → öffnet /angebot/:token (public)
   → Zeigt Angebot read-only + „Verbindlich annehmen"
   → Bei Klick: Status: accepted · Vertrag + Monatsraten in
     client_contracts / client_contract_months automatisch angelegt
     (Client wird aus Lead promoted falls noch nicht existiert)
   → Slack/Notification an Admin
```

## Datenbank

Neue Tabelle `offers`:

```text
id              uuid pk
lead_id         uuid → crm_leads (nullable falls direkt Client)
client_id       uuid → clients (nullable, gesetzt nach Annahme)
plan_key        text     (basic_lite | basic | standard | plus)
plan_name       text
duration_months int      (3 oder 12)
monthly_price   numeric  (nach Rabatt)
setup_price     numeric  (2000, ggf. rabattiert)
discount_pct    numeric  (0-100, angewendet auf monthly)
addons          jsonb    ([{name, price_text, monthly:false, qty:1}])
custom_body     text     (Rich-Text HTML, editierbar)
subject         text
recipient_email text
recipient_name  text
status          text     (draft | sent | viewed | accepted | rejected | expired)
token           text unique  (für /angebot/:token)
sent_at         timestamptz
viewed_at       timestamptz
accepted_at     timestamptz
created_by      uuid
created_at, updated_at
```

Grants + RLS: Admins full access · public SELECT nur via token (edge function).

## Komponenten (neu)

- `src/components/pricing/OfferConfigurator.tsx` — Slide-over Panel auf /pakete, öffnet mit Button „Konfigurator" (nur wenn `role === admin`). Paket-Auswahl, Add-on-Chips mit Menge, Rabatt-Slider, Live-Summe.
- `src/components/pricing/OfferEditorDialog.tsx` — Nach „Angebot erstellen": Lead-Search (Combobox aus crm_leads), Betreff, Rich-Text-Editor (nutzt vorhandenes Editor-Setup — sonst `contentEditable` + Toolbar leichtgewichtig). Buttons „Als Entwurf speichern" · „Senden".
- `src/pages/OfferView.tsx` — Public Route `/angebot/:token`, holt Angebot über Edge Function, zeigt es und Button „Verbindlich annehmen".

## Edge Functions (neu)

- `supabase/functions/offer-send/index.ts` — validiert Admin, generiert Token, updated status→sent, ruft Resend-Gateway (analog `crm-send-email`) mit HTML-Template inkl. `${APP_URL}/angebot/${token}` Button.
- `supabase/functions/offer-public/index.ts` (`verify_jwt = false`) — GET `?token=` liefert Angebot (Statuswechsel viewed), POST `{token, action:'accept'}` legt Client (falls nicht vorhanden) + `client_contracts` + `client_contract_months` an, Status accepted.

## Routing

- App.tsx: neue public Route `/angebot/:token` → `OfferView`.

## Wichtige Details

- Monatsraten-Anlage: `monthly_price` als konstanter Betrag über `duration_months`, `billing_start_date` = heute, analog `ContractForm`.
- Rabatt gilt nur auf `monthly_price` (Setup unberührt) — bestätigen können wir während des Baus falls anders gewünscht.
- Add-ons werden nicht in Vertragsmonate umgerechnet, sondern als Notiz + Freitext in `client_contracts.note` übernommen (werden bei Nutzung separat abgerechnet, so wie du es beschrieben hast).
- Aktivitäts-Logging in `crm_activities` bei jedem Statuswechsel.
- E-Mail: nutzt bestehende `noreply@marketlabmedia.de` Absender-Konfig.

## Nicht enthalten (bewusst)

- Kein PDF-Anhang (E-Mail-HTML reicht laut Antworten).
- Keine E-Signature/Rechtsklausel-Engine — der Bestätigungs-Klick ist die dokumentierte Zustimmung.
- Kein Öffentliches Anzeigen des Konfigurators für Nicht-Admins.

Sag Bescheid, wenn ich starten soll — oder was noch angepasst werden soll (z. B. Rabatt auch auf Setup, Angebot mit Ablaufdatum, etc.).
