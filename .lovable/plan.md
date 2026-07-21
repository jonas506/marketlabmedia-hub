## Neues Aufgaben-System

Die Tabelle `tasks` bleibt bestehen (hat schon alle nötigen Felder: `status`, `priority`, `deadline`, `assigned_to`, `client_id`). Nur die UI wird komplett neu.

### Ansicht `/tasks` — Team-Kanban

Vier Spalten:

```text
Offen  →  In Arbeit  →  Review  →  Erledigt
```

- Drag & Drop zwischen Spalten aktualisiert `status`.
- Erledigte Aufgaben verschwinden nach 24h automatisch aus der Ansicht (bleiben in der DB).
- Karten zeigen: Titel, Kunde (Farb-Chip), Assignee-Avatar, Deadline-Chip, Prioritäts-Flag.
- Deadline-Chip färbt sich rot wenn überfällig, orange wenn heute/morgen, grau sonst.
- Prioritäts-Flag: klein oben rechts (⚑ Normal / Hoch / Dringend).

### Filter-Leiste oben

- **Person**: Alle / Nur ich / einzelner Mitarbeiter
- **Kunde**: Alle / einzelner Kunde
- **Priorität**: Alle / Hoch+ 
- **Suche** (Titel)

Filter werden in URL gespeichert (persistent beim Tab-Wechsel).

### Neue Aufgabe erstellen

Ein einziger „+ Neue Aufgabe" Button oben. Öffnet ein schmales Sheet mit:

- Titel (Pflicht)
- **Quick-Templates** als Chips über dem Titelfeld — Klick füllt den Titel vor:
  - „Reel posten"
  - „Carousel posten"  
  - „Skript schreiben"
  - „Schnitt"
  - „Feedback einholen"
  - „Setting Call"
  - „Follow-up"
- Kunde (optional)
- Zuweisen an (Pflicht)
- Deadline (Datum + optional Uhrzeit)
- Priorität (Normal/Hoch/Dringend)
- Notiz (optional)

Nach Speichern: Slack-DM geht automatisch an den Assignee (Trigger `trg_notify_task_assignment_slack` läuft bereits).

### Aufgaben-Details

Klick auf Karte → gleiches Sheet, aber mit Verlauf, Notizen bearbeitbar, „Erledigen" Button.

### Ansicht `/my-todos` — Meine Woche

Persönliche Fokus-Ansicht bleibt schlank:

- Heute (nach Deadline sortiert)
- Diese Woche
- Später
- Ohne Deadline

Nur meine Aufgaben, kein Kunden-Filter nötig.

### Was rausfliegt

- `MergedGroupCard`, `TaskGroupCard`, `TaskGroupSection`, `SubtaskItem` — die ganze automatische Gruppierungs-Logik.
- `CompletedTasksView` als separater Tab — Erledigte werden inline gedimmt und dann ausgeblendet.
- Alte Filter/Toggles in `Tasks.tsx`.

### Technisch

- Neue Komponenten: `TaskKanbanBoard.tsx`, `TaskKanbanCard.tsx`, `TaskFilterBar.tsx`, `NewTaskSheet.tsx` mit Template-Chips.
- `Tasks.tsx` wird komplett neu geschrieben (Team-Kanban).
- `MyTodos.tsx` wird vereinfacht (nur die 4 Zeit-Sektionen).
- Drag & Drop via bestehendes `@dnd-kit` (schon im Projekt).
- Keine DB-Migration nötig.
