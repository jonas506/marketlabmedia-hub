import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_TRUST, trustSettingsSchema } from './trust-settings';

function TrustStar() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 1 2.6 8H23l-6.8 5 2.6 8L12 17l-6.8 5 2.6-8L1 9h8.4Z" fill="currentColor" /></svg>;
}

export default function TrustpilotBadge() {
  const [settings, setSettings] = useState(DEFAULT_TRUST);
  useEffect(() => {
    let active = true;
    void supabase.functions.invoke('vertriebs-check?action=trust', { body: {} }).then(({ data }) => {
      const parsed = trustSettingsSchema.safeParse(data);
      if (active && parsed.success) setSettings(parsed.data);
    });
    return () => { active = false; };
  }, []);
  return (
    <a className="vc-trust" href="https://de.trustpilot.com/review/marketlab-media.de" target="_blank" rel="noopener noreferrer">
      <span className="vc-trust-brand"><TrustStar /><span>Trustpilot</span></span>
      <span className="vc-trust-stars" aria-label="5 grüne Sterne">{Array.from({ length: 5 }, (_, i) => <span key={i}><TrustStar /></span>)}</span>
      <span className="vc-trust-caption">{settings.trustpilot_score.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} · {settings.trustpilot_reviews.toLocaleString('de-DE')} Bewertungen auf Trustpilot</span>
    </a>
  );
}