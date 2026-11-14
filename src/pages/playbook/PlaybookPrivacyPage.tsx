import PlaybookShell from './PlaybookShell';

export default function PlaybookPrivacyPage() {
  return <PlaybookShell noindex><main className="pb-simple">
    <h1>Datenschutzerklärung Leads-Playbook 2027</h1>
    <p>Verantwortlich: Marketlab Media, Jonas Fesser. Diese ergänzende Erklärung gilt für /playbook einschließlich der Danke- und Download-Seiten. Es gelten außerdem die <a href="https://marketlab-media.de/datenschutz" target="_blank" rel="noreferrer">allgemeinen Datenschutzinformationen von Marketlab Media</a>.</p>
    <h2>Einwilligungen und Nachweise</h2>
    <p>Wir speichern deinen Playbook-Eintrag mit dem Wortlaut der Datenschutz-Einwilligung, dem Zeitpunkt, einer anonymisierten IP und dem User-Agent als Nachweis. Eine Einwilligung in Werbe-Tracking ist gesondert und freiwillig. Du kannst deine Auswahl jederzeit über „Cookie-Einstellungen“ ändern. Ein Widerruf lässt die bisherige Verarbeitung unberührt; bereits versandte Meta-Ereignisse können dadurch nicht zurückgeholt werden.</p>
    <h2>Meta Pixel und Conversions API</h2>
    <p>Erst nach „Alle akzeptieren“ laden wir das Meta Pixel mit der Pixel-ID 2349392999129892. Wir senden dann PageView und nach einem Eintrag Lead. Optional gleichen wir Termine und Abschlüsse serverseitig als Schedule und Purchase ab. Dabei nutzen wir dieselbe event_id im Browser und serverseitig zur Deduplizierung. Ohne Einwilligung finden kein Pixel-Laden und kein CAPI-Versand statt. In Canada-Quebec rufen wir den notwendigen Consent-Modus.</p>
    <h2>Pseudonyme Statistik</h2>
    <p>Nur mit deiner Einwilligung speichern wir eine zufällige Browser-Session-ID und die Schritte Besuch, Formularbeginn, Eintrag, Schritt 2, Überspringen und Download. Dadurch können wir den Funnel auswerten, ohne deinen Namen in dieser Statistik zu verwenden.</p>
    <h2>Kampagnen-Parameter</h2>
    <p>Wir übernehmen First-Touch-Parameter utm_source, utm_medium, utm_campaign, utm_content, utm_term und fbclid. Ohne Tracking-Einwilligung werden sie nur für den aktuellen Eintrag verarbeitet; dauerhafte Tracking-Speicherung erfolgt erst nach Einwilligung.</p>
    <h2>Persönliches PDF und Speicherung</h2>
    <p>Vor- und Nachname werden in deine persönliche PDF-Ausgabe gesetzt. Die Datei liegt in einem privaten Storage-Bucket. Öffentlich erreichbar ist sie nicht. Der Download erfolgt über einen tokenisierten Link mit einer signierten URL, die höchstens 60 Minuten gültig ist. Schlägt die Personalisierung fehl, kann eine Ausgabe ohne Namen als Fallback bereitstehen.</p>
    <h2>Mail und CRM</h2>
    <p>Wir versenden den Download-Link transaktional per E-Mail und legen oder aktualisieren einen Kontakt und Lead im CRM von Marketlab Media. Vorname, Firma und Anfragen aus dem Playbook können für die Kontaktaufnahme verwendet werden. Es findet kein Weiterverkauf deiner Daten statt.</p>
    <h2>Slack-Benachrichtigung</h2>
    <p>Intern erhalten wir optional eine datensparsame Slack-Nachricht mit Vorname, Quelle und CRM-Link. Nachname, E-Mail-Adresse und Telefonnummer werden dabei nicht übertragen.</p>
    <h2>Externe Schriften</h2>
    <p>Die Seite lädt Plus Jakarta Sans von Google Fonts. Beim Abruf kann deine IP-Adresse technisch an Google übermittelt werden. Im PDF werden die Schriftdateien von unserem Server verarbeitet.</p>
    <h2>Deine Rechte</h2>
    <p>Du hast im gesetzlichen Rahmen Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch. Zur Ausübung oder für Fragen kannst du Marketlab Media über die im Impressum genannten Kontaktdaten erreichen. Außerdem besteht ein Beschwerderecht bei einer Datenschutzaufsichtsbehörde.</p>
  </main></PlaybookShell>;
}
