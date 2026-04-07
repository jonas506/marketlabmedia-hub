## Redesign der Kundendetailseite

### 1. Neue Struktur
Die aktuelle "alles untereinander"-Seite wird ersetzt durch ein **Zwei-Panel-Layout**:

- **Links**: Schmale Modul-Sidebar (~200px) mit Icons + Labels für alle Module
- **Rechts**: Content-Bereich zeigt das gewählte Modul

### 2. Modul-Sidebar (links)
Klickbare Einträge mit Lucide-Icons:
- 📊 **Dashboard** (Startansicht)
- 📋 **Pipeline** (MonthlyPipeline)
- ✅ **Aufgaben** (TaskList)
- 🎬 **Drehtage** (MonthlyShootDays)
- 📱 **Stories** (StorySequences)
- ✓ **Checklisten** (ClientChecklists)
- 📈 **Marketing** (MarketingTracking)
- 🗺️ **Strategie** (ClientStrategyBoards)
- 📄 **Dokumente** (ClientDocuments)
- ℹ️ **Info** (ClientInfoPanel)

### 3. Dashboard-Startansicht (neue Komponente)
Kompakte Mini-Widgets in einem Grid:
- **Kontingent-Tracker** (bestehend)
- **Pipeline-Fortschritt** (Donut/Balken: wie viel % übergeben)
- **Offene Aufgaben** (Anzahl + Top 3)
- **Vertragsstatus** (Start, Ende, Restlaufzeit mit Ampel)
- **Letzte Aktivitäten** (3-5 Einträge aus activity_log)

### 4. Vertragsdatum-Fix
Das Vertragsdatum im globalen Dashboard-Widget wird korrekt aktualisiert.

### Was NICHT geändert wird
- Keine Supabase-Queries ändern
- Keine Funktionalität entfernen
- Module bleiben identisch, nur die Navigation ändert sich
