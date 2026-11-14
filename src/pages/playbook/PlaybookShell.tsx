import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { chooseConsent, readConsent, type Choice } from './tracking';
import logo from '@/assets/marketlab-logo-weiss.png.asset.json';
import cover from '@/assets/playbook-cover-mockup.png.asset.json';
import './playbook.css';

function Consent({ current, onDecide }: { current: Choice | null; onDecide: (choice: Choice) => void }) {
  return <div className="pb-consent" role="dialog" aria-modal="false" aria-labelledby="pb-consent-title">
    <h2 id="pb-consent-title">Datenschutz-Einstellungen</h2>
    <p>Mit deiner Zustimmung nutzen wir das Meta Pixel und die Meta Conversions API, um unsere Werbung zu messen, sowie eine eigene pseudonyme Besuchsstatistik dieser Seite. Ohne Zustimmung setzen wir nur technisch notwendige Speicherungen ein – das Playbook funktioniert in beiden Fällen. Du kannst deine Entscheidung jederzeit über „Cookie-Einstellungen“ im Footer ändern. Mehr in der <a href="/playbook/datenschutz">Datenschutzerklärung</a>.</p>
    {current && <p>Aktuelle Auswahl: {current === 'all' ? 'Alle akzeptiert' : 'Nur notwendige'}</p>}
    <div className="pb-consent-actions"><Button variant="outline" onClick={() => onDecide('necessary')}>Nur notwendige</Button><Button variant="outline" onClick={() => onDecide('all')}>Alle akzeptieren</Button></div>
  </div>;
}

export default function PlaybookShell({ children, noindex = false, home = false }: { children: React.ReactNode; noindex?: boolean; home?: boolean }) {
  const [consent, setConsent] = useState<Choice | null>(() => readConsent()?.choice ?? null);
  const [bannerOpen, setBannerOpen] = useState(() => !readConsent());
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500&display=swap'; document.head.append(link);
    const previous = document.title;
    document.title = home ? 'Das Leads-Playbook 2027 · Marketlab Media' : 'Dein Leads-Playbook 2027 · Marketlab Media';
    const meta = document.createElement('meta'); meta.name = 'robots'; meta.content = noindex ? 'noindex, nofollow' : 'index, follow'; document.head.append(meta);
    const description = document.createElement('meta'); description.name = 'description'; description.content = 'Das Leads-Playbook 2027: Social Media meistern und über den Marktführer-Funnel eigene Leads gewinnen.'; document.head.append(description);
    const tags = [
      ['og:title', home ? 'Das Leads-Playbook 2027 · Marketlab Media' : 'Dein Leads-Playbook 2027'],
      ['og:description', 'Social Media in 2027 meistern. Die Komplettanleitung auf 20 Seiten.'],
      ['og:type', 'website'], ['og:image', `https://hub.marketlab-media.de${cover.url}`], ['twitter:card', 'summary_large_image'],
    ].map(([property, content]) => { const tag = document.createElement('meta'); tag.setAttribute(property.startsWith('twitter') ? 'name' : 'property', property); tag.content = content; document.head.append(tag); return tag; });
    return () => { link.remove(); meta.remove(); description.remove(); tags.forEach((tag) => tag.remove()); document.title = previous; };
  }, [home, noindex]);
  function decide(choice: Choice) { setConsent(choice); setBannerOpen(false); chooseConsent(choice).catch(() => undefined); }
  return <div className="pb">
    <header className="pb-header"><a href="/playbook" aria-label="Marketlab Media – Leads-Playbook"><img src={logo.url} alt="Marketlab Media" /></a></header>
    {children}
    <footer className="pb-footer"><span>© 2026 Marketlab Media</span><a href="/playbook/datenschutz">Datenschutz</a><a href="https://marketlab-media.de/impressum" target="_blank" rel="noreferrer">Impressum</a><button type="button" onClick={() => setBannerOpen(true)}>Cookie-Einstellungen</button></footer>
    {bannerOpen && <Consent current={consent} onDecide={decide} />}
  </div>;
}
