# Kunden-Empfehlungsseite (Referenz-Landingpage pro Kunde)

Jeder Kunde bekommt eine eigene, öffentlich teilbare Seite unter einem eigenen Link. Der Kunde schickt den Link an Bekannte — die sehen dort, was wir für ihn gemacht haben, sein persönliches Feedback (Bild, Voice, Video) und können direkt einen Termin buchen oder anrufen.

## Seitenstruktur (öffentlich, ohne Login)

```text
1  HERO        "<Kunde> empfiehlt Marketlab Media"
              Foto des Kunden, Name + Position/Firma, kurzer Einleitungssatz
              CTA-Buttons: Termin buchen | Anrufen

2  ERGEBNISSE  "Was wir für <Kunde> gemacht haben"
              Freitext-Beschreibung + bis zu 4 Kennzahlen-Kacheln
              (z. B. "+38.000 Follower", "112 Reels", "24 Anfragen/Monat")

3  FEEDBACK    "Persönliches Feedback von <Kunde>"
              Medien-Galerie: Bilder (Screenshots/Chats), Audio-Player (Voice),
              Video-Player — beliebig viele, sortierbar, je mit optionaler Bildunterschrift
              Optional ein Text-Zitat, groß gesetzt

4  TERMIN      "Lass uns sprechen"
              Cal.com-Embed (Erstgespräch) + gut sichtbarer Telefon-Button
```

Design im bestehenden Marketlab-Dark-Look der aktuellen Empfehlungsseite (Blau-Akzent, Noise-Overlay, Playfair-Akzente). Mobil-optimiert, eigene Route, ohne den langen Agentur-Teil.

## Pflege im Kundenbereich

Neues Modul „Empfehlungsseite" in der Kunden-Detailansicht (nur Admin/Head of Content):

- Foto hochladen, Anzeigename/Position eintragen
- Hero-Text, Ergebnis-Text und Kennzahlen bearbeiten
- Feedback-Medien hochladen (Bild / Audio / Video), Reihenfolge per Drag & Drop, Bildunterschrift, Löschen
- Telefonnummer + Cal.com-Link je Seite überschreibbar (Standard: zentrale Werte)
- Schalter „Seite aktiv" (inaktiv = Link zeigt Hinweisseite)
- Live-Vorschau-Button + Link kopieren

## Technische Umsetzung

- Tabelle `client_referral_pages`: `client_id` (unique), `slug` (öffentlicher, ratefreier Link-Teil), `is_active`, `headline_name`, `role_title`, `photo_url`, `intro_text`, `results_text`, `stats` (jsonb), `quote`, `phone`, `cal_link`, Timestamps. RLS: Schreiben/Lesen nur für interne Rollen, plus GRANTs.
- Tabelle `client_referral_media`: `page_id`, `type` (image|audio|video), `url`, `caption`, `sort_order`. Gleiches RLS-Muster.
- Storage-Bucket `referral-assets` (public read, Upload nur authentifiziert) für Foto und Feedback-Medien.
- Öffentlicher Zugriff über Security-Definer-Funktion `get_referral_page(_slug text)`, die Seite + Medien als JSON liefert und nur aktive Seiten zurückgibt — keine direkte Tabellenfreigabe für Gäste.
- Neue Route `/ref/:slug` mit neuer Seite `src/pages/ReferralPage.tsx` (öffentlich in `App.tsx` registriert), plus `<title>`/Meta-Description pro Kunde.
- Cal.com-Embed via offiziellem Inline-Embed-Script; Telefon als `tel:`-Link.
- Bestehende Seite `/empfehlung/:token` bleibt unverändert bestehen.

## Offene Standardwerte

Zentrale Defaults: Cal.com `marketlab-media/erstgespraech`, Telefonnummer trage ich als Platzhalter ein und du kannst sie pro Seite oder global ändern.
