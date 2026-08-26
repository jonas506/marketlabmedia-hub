# Gmail-Spam-Warnung bei Mails abstellen

Ziel: Die rote Gmail-Warnung ("Diese Nachricht könnte gefährlich sein / Spoofing") bei Mails von `noreply@marketlabmedia.de` verschwindet.

## Was ich geprüft habe

- Alle System-Mails (Dokumente, Angebote, CRM, Review-Digest, Urlaub, Reisekosten) gehen über Resend mit Absender `... <noreply@marketlabmedia.de>`.
- DNS der Domain:
  - SPF auf `marketlabmedia.de`: nur `include:_smtp.udag.de` — Resend/Amazon SES ist dort **nicht** enthalten.
  - DKIM für Resend (`resend._domainkey`) ist vorhanden.
  - DMARC ist auf `p=none` gesetzt, Reports gehen an eine fremde Adresse (`dmarcreports@lovable.dev`).
  - Parallel existiert ein zweites, konkurrierendes Mail-Setup auf `notify.marketlabmedia.de` (Mailgun).
- Der Anzeigename im Absender wird ungeprüft aus dem Nutzerprofil übernommen (`${senderName} <noreply@...>`). Enthält ein Profilname Komma, Punkt, Klammern, Umlaute oder Emojis, wird der From-Header formal fehlerhaft — genau das meldet Gmail als "ungewöhnliche Zeichen".

## Vorgehen

### 1. Absender-Anzeigename sauber setzen (Code)
- Anzeigename immer korrekt in Anführungszeichen setzen und Sonderzeichen entfernen bzw. escapen.
- Einheitlich fester Anzeigename "Marketlab Media" (Name der Person geht in `reply_to` und in die Signatur, nicht in den From-Header).
- Gilt für: `document-send`, `document-public`, `offer-send`, `crm-send-email`, `send-review-digest`, `notify-vacation-request`, `send-travel-expense-report`, `send-test-invite`.

### 2. Zustellbarkeits-Standards ergänzen (Code)
- Zu jeder HTML-Mail eine Plaintext-Variante mitschicken (fehlender Text-Teil ist ein starkes Spam-Signal).
- `reply_to` überall auf eine echte, existierende Postfachadresse.
- Bei Massen-/Digest-Mails `List-Unsubscribe`-Header setzen.

### 3. DNS korrigieren (du beim Registrar, ich liefere die exakten Werte)
- SPF von `marketlabmedia.de` um Resend erweitern: `v=spf1 include:_smtp.udag.de include:amazonses.com ~all`.
- Resend-Domain-Status prüfen: DKIM + Return-Path (`send.marketlabmedia.de`) müssen in Resend als "verified" stehen.
- DMARC-Reports auf eine eigene Adresse umstellen und nach der Prüfphase von `p=none` auf `p=quarantine` heben.

### 4. Doppeltes Mail-Setup entwirren
Aktuell laufen zwei Absendewege über dieselbe Domain (Resend auf Root, Mailgun/Lovable-Mails auf `notify.`). Entscheidung nötig: alles über Resend, oder Auth-Mails weiter über `notify.`. Vermischte Signale schaden der Domain-Reputation.

### 5. Verifizieren
- Testmail an `jonas@marketlab-media.de` senden.
- In Gmail über "Original anzeigen" die `Authentication-Results` prüfen: SPF, DKIM und DMARC müssen alle auf `pass` stehen.

## Offene Frage
Falls SPF/DKIM/DMARC im Header bereits alle auf `pass` stehen, ist die Ursache eindeutig der Anzeigename bzw. der fehlende Plaintext-Teil — dann greifen Schritt 1 und 2 allein.
