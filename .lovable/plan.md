# Vertriebs-Check für Kapitalanlage-Vertriebe

## Ziel
Ein öffentlicher Check unter `/check` mit sechs Fragen, persönlicher Auswertung und direkter CRM-Verknüpfung. Bestehende Hub-Abläufe bleiben unverändert. Keine Veröffentlichung ohne Jonas' ausdrückliche Freigabe.

## Bereits vorhanden
- Positionierungs-Analyse mit Consent-Banner, Meta Pixel, Conversions API und Kampagnendaten.
- CRM-Kontakte, Leads, Aktivitäten und gemeinsame Kontakt-Zuordnung.
- Geschützte Ads-Statistik mit Berliner Tagesgrenzen und eindeutigen Sitzungen.
- Verifizierter Mailversand und bestehender WhatsApp-Versand für eine andere Nachrichtenvorlage.
- Google-Terminlink der Positionierungs-Analyse. Ein eigenständiger Pearlcap-Funnel wurde nicht gefunden.

## Was gebaut wird
### 1. Check und Kontaktformular
- Dunkles Navy, Akzent `#1C6FF3`, Plus Jakarta Sans und Playfair Display Italic; auf kleine Bildschirme ausgelegt, ohne Einfluss auf das Hub-Design.
- Exakte Fragen, Antworttexte und Reihenfolge aus dem hochgeladenen Briefing. Große Antwortflächen, sofortiger Schrittwechsel, Zurück-Pfeil und Fortschritt.
- Antworten über Neuladen erhalten; personenbezogene Formulardaten nicht dauerhaft im Browser speichern.
- Pflichtfelder Vorname, Firma, fünfstellige PLZ, Handy und E-Mail; verpflichtende Datenschutzbestätigung.
- WhatsApp- und Tipps-Mail-Einwilligung freiwillig, nicht vorausgewählt; Wortlaut und Zeitpunkt serverseitig dokumentieren.

### 2. CRM und persönliche Auswertung
- Sichere öffentliche Abgabe mit Prüfung aller Angaben; Kontaktabgleich ausdrücklich E-Mail, danach Telefon, über die gemeinsame CRM-Zuordnung.
- Kontakt, Lead mit Quelle `vertriebs-check` und eigenem Status `neu`, Antworten, Stationspunkten, Gesamtpunktzahl, Typ, PLZ, Einwilligungen und erlaubten Kampagnendaten gemeinsam speichern.
- CRM-Aktivität „Vertriebs-Check ausgefüllt“ mit Ampel-Kurzfassung und Verknüpfung zur Auswertung.
- Zufälliger, nicht erratbarer Ergebnis-Token; `/check/auswertung/{token}` mit `noindex`. Öffentliche Antwort enthält nur die für die Auswertung nötigen Daten, keine Kontaktinformationen.
- 0–4 Empfehlungs-Vertrieb, 5–8 Lead-Hamsterrad, 9–12 Kurz vor Marktführer. Exakte Auswertungstexte, rote Stationen zuerst, dann gelbe und grüne.
- Gebietsprüfung über dreistelligen PLZ-Bereich: unbekannt/frei = verfügbar, vergeben = Warteliste.
- Video-Platzhalter und Terminbereich „Auswertung mit Jonas durchgehen (30 Min)“.

### 3. Pflege im Hub
- Nur für Admins zugänglicher Vertriebs-Check-Bereich: Gebiete pflegen, Video-URL setzen, Leads/Status und Versandstände ansehen.
- Bearbeitbare Tipps-Mail-Platzhalter für Tag 1, 2, 4, 6, 9 und 14; zunächst ohne automatische Aussendung.
- Sequenzberechtigung nur mit Einwilligung und Status `neu`; Abmeldung und Statuswechsel stoppen zukünftige Schritte.

### 4. Nachrichten
- Sofortige Ergebnis-Mail mit persönlichem Link an den Interessenten über den bestehenden App-Mailversand.
- Sofortige Benachrichtigung an Jonas mit Vorname, Firma, PLZ, Telefon, Typ, roten Stationen und CRM-Link; zusätzlich bestehende interne Benachrichtigung nutzen, soweit passend.
- Versandnachweise und wiederholbare, gegen Doppelversand geschützte Zustellung; ein Mailfehler verliert keinen Lead.
- WhatsApp nur mit Häkchen. Den bestehenden Versand nur mit einer passenden freigegebenen Vorlage verbinden; bis dahin eine geschützte Warteschlange mit sichtbarem Status vorbereiten. Die Positionierungs-Nachricht unverändert lassen.
- Die Tipps-Sequenz ist Marketing und darf nicht über Lovables App-Maildienst versendet werden. Struktur und Abmeldung vorbereiten; Aktivierung wartet auf Texte und einen geeigneten Marketing-Maildienst.

### 5. Tracking und Statistik
- Bestehende Consent-Logik verwenden, mit eigenen Vertriebs-Check-Ereignissen: `besuch`, `check_gestartet`, `frage_1` bis `frage_6`, `eingetragen`, `auswertung_geoeffnet` und bestätigtes `termin_gebucht`.
- Ohne Zustimmung kein Pixel, keine CAPI, keine Funnel-Ereignisse und keine Tracking-Sitzungs-ID; Check und Auswertung funktionieren trotzdem.
- Pixel und CAPI teilen je Ereignis dieselbe UUID: PageView, CheckGestartet, Lead sowie Schedule nur bei bestätigter Buchung. Gehashte Kontaktdaten und Meta-Kennungen nur bei Tracking-Einwilligung.
- Bestehenden Meta-Zugang wiederverwenden; fehlenden Token ausschließlich über das sichere Secret-Formular erfragen.
- Ads-Statistik abwärtskompatibel um die Auswahl `vertriebs-check` erweitern. Bisherige Felder und Standardantwort bleiben gleich; neue Zähler je Berliner Kalendertag nach eindeutiger `session_id`, einschließlich Tagen mit null.
- Zuerst die vorhandene API-Adresse nutzen; falls `/api/public/ads-stats` derzeit nicht existiert, keine ungeprüfte Adresse versprechen und den tatsächlich verfügbaren Zugang dokumentieren.

## Bestehende Grenzen / offene Anschlüsse
- Der vorhandene Google-Kalender bietet in der App derzeit weder belegte Vorausfüllung noch eine Buchungsrückmeldung. Terminlink wiederverwenden; keine Buchung aus einem Klick oder iframe-Ereignis ableiten. Vorausfüllung/automatischer Statuswechsel bleiben bis zu einem geeigneten Kalenderanschluss ausdrücklich offen.
- Die Auswertung kann ohne Video starten; Jonas trägt die Video-URL später ein.
- WhatsApp wartet gegebenenfalls auf eine passende Nachrichtenvorlage; die Tipps-Sequenz auf Inhalte und Marketing-Maildienst.
- Da Vorschau und veröffentlichter Hub dieselbe Cloud nutzen, Änderungen nur ergänzend und funnel-spezifisch durchführen; neue Seiten nicht veröffentlichen.

## Technische Umsetzung
- Eigenes Seitenverzeichnis und scoped Styles; geteilte reine Funktionen für Fragen, Punkte, Typen, Reihenfolge und Validierung.
- Additive Datenbankänderungen: geschützte Check-Abgaben/Ergebnis-Tokens, Gebiete, Einstellungen, Ereignisse, Einwilligungsnachweise und ausstehende WhatsApp-/Sequenzaufgaben; explizite Grants und Admin-RLS. Kein anonymer Zugriff auf interne CRM-Daten.
- Serverfunktion erstellt Abgabe, CRM-Verknüpfungen und Aktivität atomar. Ergebnisabruf nur über den Token; Rate-Limits und Input-Längenlimits für öffentliche Endpunkte.
- Shared CRM-Matching um einen auf diesen Funnel begrenzten E-Mail/Telefon-Modus ergänzen, ohne bisherige Matchingregeln zu verändern.
- Neue Ergebnis- und Owner-Mailvorlagen registrieren und über den gemeinsamen App-Mailversand senden. Bestehende Infrastruktur nicht ersetzen.
- Architekturregeln in `AGENTS.md` und Aufgabenstand in der Roadmap festhalten.

## Prüfung und Abschluss
- Regeltests für alle sechs Stationspunkte, drei Typgrenzen, Ampelreihenfolge, PLZ, Pflichtfelder, Einwilligungen, Sequenz-Stopp und Consent-Sperre.
- Check mit gemischten Antworten und „Test Vertriebs-Check“ / „Marketlab Test“ auf Desktop und Mobil durchspielen; echtes Speichern und tokenbasierte Auswertung prüfen.
- Kontakt, Lead und Aktivität zurücklesen; richtige Ampeln/Reihenfolge und Gebiets-/Videopflege überprüfen.
- Jonas-Benachrichtigung und Ergebnis-Mail anhand erfolgreicher Versandnachweise bestätigen. Für die Ergebnis-Mail eine eigene kontrollierte Testadresse verwenden, keine erfundene oder fremde Empfängeradresse.
- Ads-Statistik für heute abrufen, nur aggregierte Antwort zeigen; Testeinträge gezielt entfernen oder eindeutig markieren.
- Abschluss: wiederverwendete/neue Teile, belegte Tests, offene Anschlüsse und Datenschutz-Prüfliste für Check/CRM, Einwilligungen, WhatsApp, Tipps-Sequenz, Pixel/CAPI, Speicherdauer und Widerruf.