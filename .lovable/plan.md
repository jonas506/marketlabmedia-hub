## Videokurs für Kunden

### Idee kurz
- **Ein globaler Kurs** mit Modulen (= Kapitel/Videos), den du im Adminbereich pflegst.
- **Kunden bekommen einen echten Login** (E-Mail + Passwort). Du lädst sie ein → sie setzen ihr Passwort → sie landen unter `/kurs` und sehen alle Module.
- **Videos liegen auf Google Drive** – gestreamt über eine geschützte Edge Function (wie die Freigabe-Videos), damit die Drive-Links nirgends im Browser stehen.
- **Fortschritt** wird pro User pro Modul gespeichert: Play-Position + „abgeschlossen". Oben ein Prozentbalken.

### Was gebaut wird

**1. Datenbank**
- `course_modules` — id, title, description, drive_file_id, thumbnail_url, sort_order, duration_seconds, resources (jsonb für PDFs/Links), is_published
- `course_students` — verknüpft `auth.users` mit einem Kunden. Wer hier drin steht = darf in den Kurs.
- `course_progress` — user_id, module_id, last_position_seconds, completed_at
- RLS: Studenten sehen nur veröffentlichte Module + eigenen Fortschritt. Admins verwalten alles.

**2. Edge Function `course-video-proxy`**
Streamt Drive-Videos, aber prüft: eingeloggt + in `course_students` eingetragen. Kein Token, sondern JWT.

**3. Edge Function `invite-course-student`**
Admin gibt E-Mail + wählt Kunde → Function erstellt Auth-User via Service-Role, schickt Passwort-Setzen-Mail (nutzt bestehende Recovery-Template).

**4. Frontend – Kunde**
- `/kurs` — Modul-Übersicht: Karten mit Thumbnail, Titel, Dauer, „✓ abgeschlossen" oder Progress-Ring. Oben: Gesamt-Fortschritt.
- `/kurs/:moduleId` — Videoplayer (custom, speichert alle 5s Position), Beschreibung, Ressourcen-Downloads, „Nächstes Modul"-Button.

**5. Frontend – Admin**
- `/admin/kurs` (nur Admin) — Modul-Liste mit Drag-to-Reorder, „Neu"-Dialog: Titel + Drive-URL + Beschreibung + optional Thumbnail-Upload + Ressourcen (Upload/Link). Toggle „Veröffentlicht".
- Tab „Teilnehmer" — Liste eingeladener User mit Fortschritt %, „Einladen"-Button (E-Mail + Kunde wählen).

**6. Login-Flow**
- Login-Seite bleibt wie sie ist. Kurs-User loggen sich normal ein.
- Nach Login: wenn User in `course_students` steht → automatisch auf `/kurs` (Admins/Teammitglieder bleiben in ihrem Dashboard).
- „Passwort vergessen" funktioniert schon.

### Branding
Alles im bestehenden Dark-Look mit den Marketlab-Blau-Akzenten – konsistent zum Hub.

### Nicht enthalten (kann später kommen)
- Quiz / Zertifikate
- Kommentare/Diskussion
- Individuelle Modul-Freischaltung pro Kunde (du wolltest global – lässt sich später über `course_students.allowed_module_ids` erweitern)
- Live-Sessions