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
- [ ] Storage: alle 14 Bucket-Abläufe und Pfade prüfen
- [ ] Offene Storage-Policies durch rollengebundene Regeln ersetzen
- [ ] Rollen und Dateiabläufe testen, Scan neu prüfen und Ergebnistabelle liefern
