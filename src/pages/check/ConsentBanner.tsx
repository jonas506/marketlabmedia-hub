import { Button } from '@/components/ui/button';
import type { Choice } from './tracking';

/** Both choices are equally prominent; nothing is preselected. */
export function ConsentBanner({ current, onDecide }: { current: Choice | null; onDecide: (c: Choice) => void }) {
  return (
    <div className="vc-consent" role="dialog" aria-modal="false" aria-labelledby="vc-consent-title">
      <h3 id="vc-consent-title">Datenschutz-Einstellungen</h3>
      <p>Mit deiner Zustimmung nutzen wir das Meta Pixel und die Meta Conversions API, um unsere Werbung zu messen, sowie eine eigene pseudonyme Besuchsstatistik dieser Seite. Ohne Zustimmung setzen wir nur technisch notwendige Speicherungen ein – der Check funktioniert in beiden Fällen. Du kannst deine Entscheidung jederzeit über „Cookie-Einstellungen" im Footer ändern. Mehr in der <a href="/check/datenschutz">Datenschutzerklärung</a>.</p>
      {current && <p>Aktuelle Auswahl: {current === 'all' ? 'Alle akzeptiert' : 'Nur notwendige'}</p>}
      <div className="vc-consent-actions">
        <Button variant="outline" onClick={() => onDecide('necessary')}>Nur notwendige</Button>
        <Button variant="outline" onClick={() => onDecide('all')}>Alle akzeptieren</Button>
      </div>
    </div>
  );
}
