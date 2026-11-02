import alexander from '@/assets/check/logos/alexander-tsasakos.png.asset.json';
import dahoam from '@/assets/check/logos/dahoam-wohnen.png.asset.json';
import hpy from '@/assets/check/logos/hpy-immo.png.asset.json';
import immo from '@/assets/check/logos/immo-know-how.png.asset.json';
import porta from '@/assets/check/logos/porta-vita.png.asset.json';
import concierge from '@/assets/check/logos/real-estate-concierge.png.asset.json';
import renovierhelden from '@/assets/check/logos/renovierhelden.png.asset.json';
import schorer from '@/assets/check/logos/schorer-immobilien.png.asset.json';
import sicherheitskompass from '@/assets/check/logos/sicherheitskompass.png.asset.json';

const logos = [
  { asset: alexander, name: 'Alexander Tsasakos' },
  { asset: dahoam, name: 'Dahoam Wohnen' },
  { asset: hpy, name: 'Hpy&Immo' },
  { asset: immo, name: 'Immo Know How' },
  { asset: porta, name: 'Porta Vita' },
  { asset: concierge, name: 'Real Estate Concierge' },
  { asset: renovierhelden, name: 'Die Renovierhelden' },
  { asset: schorer, name: 'Schorer Immobilien' },
  { asset: sicherheitskompass, name: 'SicherheitsKompass' },
];

export default function ClientLogos() {
  return (
    <section className="vc-client-logos" aria-label="Kunden von Marketlab Media">
      <p className="vc-kicker">Diese Makler und Vertriebe vertrauen uns schon</p>
      <div className="vc-logo-window">
        <div className="vc-logo-track">
          {[false, true].map(duplicate => <div className={`vc-logo-group${duplicate ? ' vc-logo-duplicate' : ''}`} key={String(duplicate)} aria-hidden={duplicate || undefined}>
            {logos.map(({ asset, name }) => <img key={name} src={asset.url} alt={duplicate ? '' : name} height={28} />)}
          </div>)}
        </div>
      </div>
    </section>
  );
}