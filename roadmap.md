# Roadmap

## CRM-Detailseiten-Umbau (abgeschlossen 21.10.2026)
- [x] Notiz-Bug: RLS (nur Admin-Policies) + fehlender `meeting`-Enum → Migration `crm_hoc_access_and_meeting_type`
- [x] Gemeinsame Detail-Komponenten (Header, Details, Aktivität, Side-Cards)
- [x] Kontakt- und Lead-Detailseite im 3-Spalten-Layout
- [x] Kontaktliste: Ansichten-Chips, Sortierung, klickbare Zeilen, „+ Neu"-Dialog
- [x] Verifiziert: Notiz auf Kontakt + Lead speichert & erscheint; 694 Kontakte laden; Filter funktionieren; Build OK

## Angebotsannahme (abgeschlossen 22.10.2026)
- [x] Pflicht-Funktion und Zahlungswahl in beiden Annahmeabläufen, gespeichertes Protokoll und Bestätigungs-Mails
- [x] PDF-Seite 1: explizites Gültigkeitsdatum und Netto-Gesamtbetrag erkennen; Datum manuell bearbeitbar
- [x] Fünf Regeltests bestanden; PDF-Upload, Pflichtangaben, echte Annahme und Protokoll im Browser geprüft
- [x] Ablauf deaktiviert Button und verweigert serverseitige Annahme; Testdaten entfernt

## Offen
- [ ] Echte HoC-/Cutter-Dateiabläufe prüfen — Rollenwechsel zur Testanmeldung wurde abgelehnt
- [ ] Kunden-Login mit eigener Dateizuordnung prüfen — keine Kunden-Login-Zuordnung im bestehenden System
- [ ] Nichtleerer Freigabe-Swiper und veröffentlichte Empfehlungsmedien end-to-end prüfen — bisher nur leeres Portal/Seitenaufruf verifiziert

## Storage-Härtung (umgesetzt 22.10.2026)
- [x] Alle 14 Buckets und App-Dateipfade geprüft; Board-ID wird auf Kunden-ID aufgelöst
- [x] 47 alte Policies durch 56 Rollen-Policies und eine Veröffentlichungspolicy ersetzt; keine offenen Löschregeln
- [x] CRM-Dateien nur Admin, geschützte Downloads statt ungültiger öffentlicher URLs
- [x] Admin: Upload/Download/Update/Signieren/Löschen in allen 14 Buckets getestet; Testobjekte entfernt
- [x] Anonymes Hochladen/Signieren unveröffentlichter Dateien verweigert; öffentliche Objektauslieferung in 7 öffentlichen Buckets geprüft
- [x] Neuer Scan: 0 Storage-Findings; 4 bereits bestehende Warnungen zu E-Mail-Funktionen bleiben
- [x] Download-Pfad-Test bestanden; Seiten fehlerfrei; echte Vertragslink-Ansicht und CRM-Download angeklickt
