import type { Consent } from "./tracking";

/** Both choices are equally prominent; nothing is preselected. */
export function ConsentBanner({ current, onDecide }: { current: Consent | null; onDecide: (c: Consent) => void }) {
  return <div className="pa-consent" role="dialog" aria-modal="false" aria-labelledby="pa-consent-title">
    <h3 id="pa-consent-title">Datenschutz-Einstellungen</h3>
    <p>Mit deiner Zustimmung nutzen wir das Meta Pixel und die Meta Conversions API, um unsere Werbung zu messen, sowie eine eigene pseudonyme Besuchsstatistik dieser Seite. Ohne Zustimmung setzen wir nur technisch notwendige Speicherungen ein – das Formular funktioniert in beiden Fällen. Du kannst deine Entscheidung jederzeit über „Cookie-Einstellungen" im Footer ändern. Mehr in der <a href="https://marketlab-media.de/datenschutz" target="_blank" rel="noreferrer">Datenschutzerklärung</a>.</p>
    {current && <p style={{ marginTop: 8 }}>Aktuelle Auswahl: {current === "all" ? "Alle akzeptiert" : "Nur notwendige"}</p>}
    <div className="pa-consent-actions">
      <button type="button" onClick={() => onDecide("necessary")}>Nur notwendige</button>
      <button type="button" onClick={() => onDecide("all")}>Alle akzeptieren</button>
    </div>
  </div>;
}
