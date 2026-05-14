## Referenz-Datenbank — Implementierungsplan

### Schritt 1 — Datenbank-Migration
- Neue Tabelle `content_formats` (name, tag, funnel_stage, emoji, description, sort_order, is_active, created_by) mit UNIQUE(tag, funnel_stage)
- Neue Tabelle `format_references` (format_id FK CASCADE, url, title, source_type, thumbnail_url, is_own, sort_order)
- RLS: Read für alle authentifizierten, Write nur Admin (`has_role`)
- Storage Bucket `reference-thumbnails` (public, 512KB Limit) + RLS Policies (read public, write Admin)
- Spalte `content_pieces.format_id` (FK SET NULL)
- Validation Triggers für `funnel_stage IN ('tofu','mofu','bofu')` und `source_type IN ('instagram','tiktok','youtube','drive','other')`

### Schritt 2 — Hauptseite `/referenzen`
- `src/pages/Referenzen.tsx`: Header, Filter-Toggle (Alle/TOFU/MOFU/BOFU), gruppiertes Format-Grid pro Funnel-Stufe
- Farbschema: TOFU blau, MOFU lila, BOFU grün (semantische Tokens)
- `FormatCard.tsx`: Emoji + Name + Referenz-Anzahl + "Öffnen"-Link
- Route in `App.tsx`: `/referenzen` und `/referenzen/:formatId`
- Sidebar-Eintrag in `AppLayout.tsx` mit `Library`-Icon

### Schritt 3 — Format-Detail `/referenzen/:formatId`
- `FormatDetail.tsx`: Header mit Zurück-Button, Emoji + Name + Funnel-Badge, Edit-Button (Admin), Beschreibung
- Referenz-Grid mit `ReferenceCard.tsx`
- Drag & Drop Sortierung (HTML5 native — kein neues Package)
- Eigene Produktionen oben mit blauer Border + ⭐ Badge

### Schritt 4 — `AddReferenceDialog.tsx`
- URL-Input mit Auto-Detection (Regex), Titel, "Eigene Produktion"-Toggle, Thumbnail-Upload (max 512KB → Storage `{format_id}/{reference_id}.jpg`)
- Plattform-Icon-Mapping: Instagram, TikTok, YouTube (lucide), Drive, Link

### Schritt 5 — `AddFormatDialog.tsx`
- Emoji, Name, Tag (Auto-Slug, editierbar), Funnel-Stufe (3 farbige Radios), Beschreibung
- Edit-Mode mit `is_active`-Toggle

### Schritt 6 — Pipeline-Verknüpfung
- `FormatPicker.tsx`: Gruppiertes Select (TOFU/MOFU/BOFU)
- Integration in `PieceDetailDialog.tsx`: setzt `format_id`, fügt Tag zu `tags` hinzu
- "X Referenzen verfügbar · Referenzen ansehen →" mit Popover (kompakte Mini-Liste)

### Schritt 7 — Briefing-PDF
- `BriefingGenerator` erweitern: pro Piece mit `format_id` Referenzen laden und im PDF auflisten (Format-Name + alle Links, klickbar)

### Hinweis
Sehr großer Scope (8 neue Dateien, 1 Migration, 3 Bestands-Edits). Implementierung in mehreren Schritten — Migration zuerst, dann Hauptseite + Detail, dann Pipeline-Integration, dann PDF.

### Offen
Existiert `BriefingGenerator.tsx` schon? Falls nicht, lasse ich Schritt 7 weg und liefere ihn nach, sobald du die Datei nennst.
