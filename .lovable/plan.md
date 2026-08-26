# E-Mail-Zustellung: Gmail-Warnung beseitigen

## Was die DNS-Prüfung zeigt

Live abgefragt (nicht nur Screenshot):

- `send.marketlabmedia.de` → `v=spf1 include:amazonses.com ~all` (korrekt, das ist der Return-Path von Resend)
- `send.marketlabmedia.de` MX → `feedback-smtp.eu-west-1.amazonses.com` (korrekt)
- `resend._domainkey.marketlabmedia.de` → DKIM-Key vorhanden (korrekt)
- Root `marketlabmedia.de` → `v=spf1 include:_smtp.udag.de ~all` (nur Postfach-Versand, für Resend nicht nötig)
- `_dmarc.marketlabmedia.de` → `v=DMARC1; p=none; pct=100; rua=mailto:dmarcreports@lovable.dev`
- Zusätzlich existiert ein zweites Setup: `notify.marketlabmedia.de` → `v=spf1 include:mailgun.org ~all`

Fazit: Die Resend-Zustellung ist DNS-seitig grundsätzlich korrekt aufgesetzt. SPF und DKIM sollten passen. Die Gmail-Warnung kam sehr wahrscheinlich vom früheren Absender-Header (variable Namen mit Sonderzeichen), der bereits auf einen festen ASCII-Absender umgestellt wurde — das ist noch nicht mit einer frischen Mail verifiziert.

## Schritte

1. **Verifizieren statt raten**: Testmail an `jonas@marketlab-media.de` auslösen und in Gmail über „Original anzeigen“ prüfen, ob `spf=pass`, `dkim=pass` und `dmarc=pass` stehen und ob die Warnung noch erscheint.
2. **Falls DMARC nicht aligned ist**: prüfen, ob Resend die Domain `marketlabmedia.de` als verifiziert führt und ob der Return-Path wirklich auf `send.marketlabmedia.de` zeigt.
3. **DMARC aufräumen** (Registrar): `rua` auf eine eigene Adresse ändern, z. B. `v=DMARC1; p=none; pct=100; rua=mailto:dmarc@marketlabmedia.de; adkim=r; aspf=r`. Nach 1–2 Wochen sauberer Reports auf `p=quarantine` erhöhen.
4. **Altes Setup entscheiden**: Wenn `notify.marketlabmedia.de` (Mailgun/Lovable-Emails) nicht mehr genutzt wird, diese Records entfernen, damit nur ein Versandweg existiert.
5. **Optional**: Root-SPF nicht anfassen — Resend braucht ihn nicht, ein zweites `v=spf1` auf der Root wäre sogar schädlich.

## Technische Details

- Keine Code-Änderung nötig, sofern der Test sauber durchläuft; die Edge Functions senden bereits mit festem Absender `Marketlab Media <noreply@marketlabmedia.de>` und Plaintext-Teil.
- Getestet wird über eine bestehende Funktion (z. B. `document-send` oder `send-test-invite`) an die Testadresse.
- DNS-Änderungen erfolgen beim Registrar, nicht im Projekt.
