# Positionierungs-Analyse Landingpage

## Ziel
Eine neue öffentliche Funnel-Seite für Marketlab Media unter `/positionierungs-analyse`, exakt nach der gelieferten Vorgabe und mit den hochgeladenen Kundenbildern und Logos.

## Umsetzung
- Dunkle, hochwertige Einseiten-Landingpage mit zentriertem Logo, Video-Einstieg, Vertrauensleiste, drei Kundenfällen, Zielgruppen-Abgleich, Jonas-Bereich, Terminformular und Footer.
- Hochgeladene Fotos und Logos über den Projekt-Medienservice einbinden; bereits vorhandene weitere Kundennamen ergänzen, bis deren Bildmarken vorliegen.
- Mobile und Desktop sauber abstimmen, dezente Bewegungen einbauen und reduzierte Bewegung respektieren.
- Formular zweistufig umsetzen: Kontaktdaten erfassen, danach den Google-Terminplaner öffnen; Rückkehr zur Bearbeitung ermöglichen.
- Neue Anfragen sicher im CRM ablegen, ohne internen Zugang zu benötigen, und als Quelle der Positionierungs-Analyse kennzeichnen.
- Öffentlichen Seitenpfad ergänzen und Seitentitel sowie Beschreibung beim Aufruf passend setzen.

## Technische Details
- Neue, isolierte React-Komponenten und eine zentrale Inhaltsdatei für Fälle, Logos und Listen.
- Eigene semantische Gestaltungstokens für die Funnel-Seite, ohne das bestehende interne System optisch zu verändern.
- Separate öffentliche Anfrage-Tabelle mit eingeschränkter Schreibberechtigung; interne Nutzer können die Daten lesen.
- Video-Einbettung als konfigurierbarer Platzhalter, bis eine endgültige Video-URL vorliegt.
- Browserprüfung bei 375 px und 1440 px inklusive Formularablauf, Kalenderansicht und Überlaufkontrolle.

## Annahmen
- Fehlende weitere Logos erscheinen zunächst wie vorgegeben als dezente Textmarken.
- Die hochgeladenen Bilder dienen direkt als Kundenfälle; das hochgeladene Marketlab-Logo wird für Kopf und Footer verwendet.
