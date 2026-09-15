# Cutter-Zugriffe steuern + Schnitt-Briefing pro Kunde

## 1. Wer sieht welchen Kunden

Heute sieht jedes interne Teammitglied alle Kunden. Neu:

- Pro Kunde eine Liste zugewiesener Cutter.
- **Admin** und **Head of Content** sehen weiterhin alles.
- **Cutter** sehen nur Kunden, die ihnen zugewiesen sind — in der Kundenliste, im Dashboard, in der Suche, im Posting-Kalender, in Aufgaben und in allen Kundeninhalten (Pipeline, Skripte, Boards, Dateien).
- Die Einschränkung wird direkt in der Datenbank durchgesetzt, nicht nur in der Oberfläche. Ein nicht zugewiesener Kunde ist für den Cutter auch über direkte Links nicht erreichbar.

**Zuweisen** an zwei Stellen:
- In den Einstellungen → Team: pro Person eine Mehrfachauswahl der Kunden.
- Auf der Kundenseite: Abschnitt „Zugriff" mit den zugewiesenen Cuttern zum Hinzufügen/Entfernen.

Neue Cutter starten ohne Zuweisung und sehen damit zunächst nichts — bewusst so, damit nichts versehentlich offen liegt.

## 2. Schnitt-Briefing pro Kunde

Neuer Tab „Schnitt-Briefing" in der Kundenansicht, für Cutter lesbar, von Admin/Head of Content bearbeitbar. Inhalte:

- **Marke**: Primär-, Sekundär-, Akzentfarbe, helle/dunkle Textfarbe (farbige Felder mit Hex-Wert zum Kopieren) — nutzt die bereits vorhandenen Markenfarben des Kunden.
- **Typografie**: Schriftart Untertitel, Schriftart Einblendungen, Größe/Gewicht, Groß-/Kleinschreibung.
- **Untertitel**: Stil, Position, Hervorfarbe, maximale Zeilenlänge, Animationsart.
- **Schnittstil**: Tempo, Cut-Frequenz, Zoom/Bewegung, erlaubte Übergänge, B-Roll-Regeln.
- **Sound**: Musikrichtung, Lautstärke, Soundeffekte erlaubt ja/nein.
- **Intro/Outro**: Hook-Regeln, Logo-Einsatz, Call-to-Action am Ende.
- **Export**: Format, Auflösung, Framerate, Dateibenennung.
- **Do's & Don'ts**: zwei freie Listen.
- **Referenzen**: Links zu Beispielvideos und den bestehenden Drive-Ordnern (Branding, Logo, Styleguide).
- **Freitext**: zusätzliche Hinweise.

Jedes Feld ist frei änderbar, leere Felder werden ausgeblendet. Es gibt eine Ansicht „Als Briefing anzeigen" — saubere, kompakte Darstellung zum Nebenherlaufen beim Schneiden, plus Druck-/PDF-Export.

Optional beim Anlegen eines neuen Kunden: Briefing aus einer Vorlage vorbelegen.

## Technische Details

- Neue Tabelle `client_assignments` (client_id, user_id) mit Grants und RLS; Security-Definer-Funktion `has_client_access(uid, client_id)` (true für admin/head_of_content, sonst nur bei Zuweisung).
- RLS-Policies auf `clients` und allen kundenbezogenen Tabellen (content_pieces, tasks, shoot_days, checklists, strategy_boards, story_sequences, clips, client_* Tabellen) von `is_internal()` auf `has_client_access()` umstellen — nur für die SELECT/Schreibpfade der Rolle `cutter`; Admin/HoC-Policies bleiben unverändert.
- Neue Tabelle `client_edit_briefings` (1:1 zum Kunden, strukturierte Spalten + JSONB für Listen), gleiche Zugriffslogik.
- Frontend: `useClientAssignments`-Hook, Zuweisungs-UI in `TeamOverview.tsx` und `ClientInfoPanel.tsx`, neues Modul `ClientEditBriefing.tsx` im Kunden-Sidebar-Menü mit Bearbeiten-/Briefing-Ansicht.
