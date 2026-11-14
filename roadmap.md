# Roadmap

## Playbook Heartbeat-Vorlage (14.11.2026)
- [x] Opt-in-Aufbau und exakte Texte, Desktop 1512×771 und 1440×900 sowie Handy 390 px geprüft, Vergleichsscreenshots erstellt
- [x] Schritt-2-/Überspringen-Aktivität zuverlässig gespeichert und mit zwei markierten @example.com-Einträgen end-to-end geprüft; ursprünglichen Test-Lead einmal ergänzt und erhalten. Neun Tests bestanden; nicht veröffentlicht.

## Letzte Playbook-Korrekturen (14.11.2026)
- [x] Schrift, kompakter Einstieg, Schritt 2 und Abschluss sowie Download nach Vorgabe
- [x] Test-Lead nur gelesen und erhalten; Antworten, PDF, Consent und Erstkontakt bestätigt, Anforderungsaktivität vorhanden, Schritt-2-Aktivität fehlt. Keine Mail-/Meta-Protokolle, Slack-Testguard aktiv. Screenshots Desktop/Handy geprüft; acht Tests bestanden, nicht veröffentlicht.

## Playbook-Korrekturen (14.11.2026)
- [x] Exakte Kopf- und Formulartexte, Icons, kompakte Desktop-/Handy-Anordnung nur auf /playbook
- [x] Desktop 1440×900 und 1512×771 sowie Handy 390 px geprüft, Screenshots bereitgestellt; nicht veröffentlicht. Lokale Logo-Auslieferung für Screenshots mit Originaldatei überbrückt; acht Tests bestanden, Formular nicht abgesendet.

## Leads-Playbook 2027 (14.11.2026)
- [x] Opt-in /playbook mit eigenem Design, Formular, Trustpilot und Consent
- [x] Serverseitige CRM-Anlage, Token, Tracking, Slack und E-Mail
- [x] Danke-Seite mit Schritt 2, Abschluss und signiertem Download
- [x] Persönliche PDF-Erzeugung, privater Bucket und Upload-/Status-API
- [x] Adminseite, Statistik-Erweiterung und Datenschutztext
- [x] Regeltests, Beispielansichten und Mail-Vorschau; nicht veröffentlicht

## Vertriebs-Check Trust (31.10.2026)
- [x] Statisches Trustpilot-Badge mit administrierbarer Bewertung und Anzahl ergänzen
- [x] Neun hochgeladene Logos auf Start- und Auswertungsseite anzeigen
- [x] Desktop-/Handy-Screenshots, Admin-Speichern und öffentliche Anzeige geprüft; 24 Tests bestanden; nicht veröffentlicht

## Vertriebs-Check (31.10.2026, neue Fassung)
- [x] Startseite /check mit Varianten (v), Weiche + Weg A/B je 5 Fragen, Nein-Seite
- [x] Formular mit Pflichtfeldern und Einwilligungen; Speicherung in Kontakt, Lead (Zusammenarbeit/Erstkontakt), Aktivität; CRM-Fehler blockieren nicht
- [x] Auswertung /check/auswertung/{token} mit Tacho, Leck, Typ, Karten, PLZ-Hinweis, Video, Kalender; Vorschau ohne Speichern
- [x] Adminseite /vertriebs-check/admin für Video, Kalender, PLZ-Gebiete
- [x] Tracking: Banner, Standard-Events Browser+Server, CRM-Status-Events, Funnel-Events, Herkunft, ads-stats, Protokoll
- [ ] Meta-Testereignisse und Slack — warten auf Testcode und Slack-Webhook (Formular abgelehnt)
- [ ] Echter Test-Eintrag — auf Wunsch nicht abgeschickt
- [ ] Veröffentlichung nur nach Freigabe — wartet auf Jonas

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
