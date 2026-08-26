# Dokument-Freigabe: PDF rausschicken, per Klick rechtsverbindlich annehmen

Ein eigenes Modul unter `/dokumente`, unabhängig vom bestehenden Angebots-Konfigurator. Du lädst eine fertige PDF hoch, wählst einen Empfänger (CRM-Lead oder frei eingegeben), verschickst per Mail — der Empfänger öffnet einen Link, liest die PDF im Browser, tippt seinen Namen, setzt einen Haken und bestätigt. Danach ist die Annahme dokumentiert und beide Seiten bekommen die Bestätigung per Mail.

## Ablauf

```text
Du: PDF hochladen → Empfänger wählen → Betreff/Text → "Senden"
                                  ↓
Empfänger: E-Mail → Link /dokument/:token
           PDF-Viewer im Browser + Download
           Name eintippen + Checkbox "Ich nehme verbindlich an"
           Button "Verbindlich annehmen"
                                  ↓
System: Protokoll speichern (Name, Zeit, IP, Browser, PDF-Prüfsumme)
        Bestätigungs-Mail an Empfänger + an dich (PDF-Link + Protokoll)
        Status im Modul: Gesendet → Angesehen → Angenommen
```

## Was du im Tool siehst

- **Übersicht** aller versendeten Dokumente mit Status-Badges (Entwurf, Gesendet, Angesehen, Angenommen, Abgelaufen) und Datum.
- **Neues Dokument**: PDF-Upload (Drag & Drop), Titel, Empfänger (Lead-Auswahl mit Suche oder Name + E-Mail manuell), Betreff und E-Mail-Text, optional Ablaufdatum.
- **Detailansicht** je Dokument: PDF-Vorschau, Annahme-Protokoll (Name, Zeitstempel, IP, Gerät), Link zum Kopieren, "Erinnerung senden", "Zurückziehen".

## Was der Empfänger sieht

Eine schlichte, gebrandete Seite im Marketlab-Look: Titel, dein Begleittext, die PDF direkt eingebettet mit Download-Button, darunter der Annahme-Block. Vor der Annahme muss der Name eingetippt und die Checkbox gesetzt sein — sonst bleibt der Button deaktiviert. Nach der Annahme wird eine Bestätigung mit Zeitstempel angezeigt; ein erneuter Klick ist nicht möglich.

## Rechtliche Absicherung

Gespeichert wird beim Klick: eingetippter Name, exakter Zeitstempel (UTC), IP-Adresse, User-Agent, der exakte Zustimmungstext im Wortlaut sowie ein SHA-256-Hash der PDF-Datei. Der Hash beweist, dass genau diese Datei angenommen wurde und danach nicht getauscht wurde. Das Protokoll ist unveränderlich (kein Update/Delete für normale Nutzer) und wird in der Bestätigungsmail an beide Seiten mitgeschickt.

Hinweis: Das erfüllt die "Textform" (§ 126b BGB) und reicht für Angebote/Auftragsbestätigungen. Für Fälle mit gesetzlicher Schriftform (z. B. Kündigungen) wäre eine qualifizierte elektronische Signatur nötig — das leistet dieses Modul bewusst nicht.

## Technische Umsetzung

**Storage**: privater Bucket `documents`. Empfänger sehen die PDF nur über eine signierte URL, die die Edge Function pro Aufruf erzeugt — der Bucket bleibt sonst dicht.

**Tabellen** (Migration, mit GRANTs + RLS):
- `signature_documents`: `id`, `title`, `file_path`, `file_hash`, `file_size`, `recipient_name`, `recipient_email`, `lead_id` (nullable FK `crm_leads`), `client_id` (nullable), `subject`, `message_body`, `token` (unique, zufällig), `status` (`draft|sent|viewed|accepted|revoked|expired`), `expires_at`, `sent_at`, `viewed_at`, `accepted_at`, `created_by`, `created_at`. Policies: nur `authenticated` mit Admin-Rolle; kein `anon`-Zugriff (läuft über Edge Function mit Service Role).
- `signature_acceptances`: `id`, `document_id`, `typed_name`, `consent_text`, `ip_address`, `user_agent`, `file_hash`, `accepted_at`. Insert nur über Service Role, kein Update/Delete.

**Edge Functions**:
- `document-public` (`verify_jwt = false`): GET liefert Metadaten + signierte PDF-URL und setzt Status auf `viewed`; POST prüft Token, Ablauf und Status, validiert Eingaben mit Zod (Name min. 2 Zeichen, Checkbox true), schreibt das Protokoll, setzt `accepted`, stößt beide Mails an. Rate-Limit pro Token.
- `document-send` (Admin-only, prüft `user_roles`): verschickt die Einladungsmail über die bestehende Resend-Anbindung (wie `offer-send`) mit Link auf `https://hub.marketlab-media.de/dokument/:token`.

**Frontend**:
- `src/pages/Documents.tsx` — Übersicht + Erstellen-Dialog, Route `/dokumente` (Admin-geschützt, Eintrag in der Sidebar).
- `src/pages/DocumentSign.tsx` — öffentliche Route `/dokument/:token`, PDF via `<iframe>` auf die signierte URL, Annahme-Block, Erfolgszustand.
- `src/components/documents/DocumentUpload.tsx`, `RecipientPicker.tsx`, `DocumentDetailSheet.tsx`.

**Mails**: Da Anhänge nicht unterstützt werden, enthalten Einladungs- und Bestätigungsmail jeweils einen Download-Link (signierte URL, 7 Tage gültig) statt der PDF im Anhang. Die Bestätigungsmail enthält zusätzlich das vollständige Annahme-Protokoll als Textblock.
