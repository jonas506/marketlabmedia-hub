import { useEffect, useState } from 'react';
import { ConsentBanner } from './ConsentBanner';
import { chooseConsent, readConsent, type Choice } from './tracking';
import logo from '@/assets/positioning/logo-marketlab-media-white.png.asset.json';
import './check.css';

export default function CheckShell({ children, result = false }: { children: React.ReactNode; result?: boolean }) {
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;600;700;800&display=swap';
    document.head.append(link);
    const previous = document.title;
    document.title = result ? 'Eure persönliche Auswertung | Marketlab Media' : 'Vertriebs-Check für Immobilien- und Finanzvertriebe | Marketlab Media';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = result ? 'noindex, nofollow' : 'index, follow';
    document.head.append(meta);
    return () => { link.remove(); meta.remove(); document.title = previous; };
  }, [result]);
  const [consent, setConsent] = useState<Choice | null>(() => readConsent()?.choice ?? null);
  const [bannerOpen, setBannerOpen] = useState(() => !readConsent());
  function decide(c: Choice) { setConsent(c); setBannerOpen(false); chooseConsent(c).catch(() => undefined); }
  return (
    <div className="vc">
      <header className="vc-header"><a href="/check" aria-label="Marketlab Media – Vertriebs-Check"><img src={logo.url} alt="Marketlab Media" /></a></header>
      {children}
      <footer className="vc-footer">
        <span>© {new Date().getFullYear()} Marketlab Media</span>
        <a href="https://marketlab-media.de/impressum" target="_blank" rel="noreferrer">Impressum</a>
        <a href="/check/datenschutz">Datenschutz</a>
        <button type="button" className="vc-footer-link" onClick={() => setBannerOpen(true)}>Cookie-Einstellungen</button>
      </footer>
      {bannerOpen && <ConsentBanner current={consent} onDecide={decide} />}
    </div>
  );
}
