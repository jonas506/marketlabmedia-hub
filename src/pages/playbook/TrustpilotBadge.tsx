function Star() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 1 2.6 8H23l-6.8 5 2.6 8L12 17l-6.8 5 2.6-8L1 9h8.4Z" fill="currentColor" /></svg>; }
export default function TrustpilotBadge({ score = 4.4, reviews = 11 }: { score?: number; reviews?: number }) {
  return <a className="pb-trust" href="https://de.trustpilot.com/review/marketlab-media.de" target="_blank" rel="noopener">
    <span className="pb-trust-brand"><Star /><span>Trustpilot</span></span>
    <span className="pb-trust-stars" aria-label={`${score.toLocaleString('de-DE')} von 5 Sternen`}>{Array.from({ length: 5 }, (_, index) => <span className={index === 4 && score < 5 ? 'pb-trust-half' : ''} key={index}><Star /></span>)}</span>
    <span className="pb-trust-caption">{score.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} · {reviews.toLocaleString('de-DE')} Bewertungen auf Trustpilot</span>
  </a>;
}
