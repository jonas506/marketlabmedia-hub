import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import preview from '@/assets/check/vorschau.jpg.asset.json';
import CheckShell from './CheckShell';
import ClientLogos from './ClientLogos';
import { evaluate, type Weg } from './model';

const DEFAULT_CALENDAR = 'https://calendar.app.google/i2jtG5DapbEjzWba6';
interface Result { first_name: string; weg: Weg; answers: number[]; postcode_prefix: string; area_status: string; video_url: string | null; calendar_url: string; }

const START = 192, SPAN = 204, CX = 150, CY = 150, R = 118;
const pt = (deg: number, r = R) => { const a = (deg * Math.PI) / 180; return [CX + r * Math.cos(a), CY - r * Math.sin(a)]; };
const arc = (from: number, to: number) => { const [x1, y1] = pt(from), [x2, y2] = pt(to); return `M ${x1} ${y1} A ${R} ${R} 0 ${from - to > 180 ? 1 : 0} 1 ${x2} ${y2}`; };

function Gauge({ score, label }: { score: number; label: string }) {
  const end = START - (SPAN * score) / 100;
  const [kx, ky] = pt(end);
  const ticks = Array.from({ length: 21 }, (_, i) => START - (SPAN * i) / 20);
  return (
    <div className="vc-gauge">
      <svg viewBox="-14 -24 328 236" role="img" aria-label={`${label}: ${score} von 100`}>
        <defs>
          <linearGradient id="vcg" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="hsl(var(--vc-red))" /><stop offset=".3" stopColor="hsl(24 100% 58%)" /><stop offset=".55" stopColor="hsl(var(--vc-yellow))" /><stop offset=".78" stopColor="hsl(100 70% 60%)" /><stop offset="1" stopColor="hsl(var(--vc-green))" />
          </linearGradient>
          <filter id="vcglow"><feGaussianBlur stdDeviation="4" /></filter>
        </defs>
        {ticks.map((d, i) => { const [x1, y1] = pt(d, R + 16), [x2, y2] = pt(d, R + (i % 10 === 0 ? 26 : 21)); return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="hsl(var(--muted-foreground))" strokeOpacity=".5" strokeWidth="1.5" />; })}
        {[[0, START], [50, START - SPAN / 2], [100, START - SPAN]].map(([n, d]) => { const [x, y] = pt(d, R + 38); return <text key={n} x={x} y={y + 4} textAnchor="middle" fontSize="11" fill="hsl(var(--muted-foreground))">{n}</text>; })}
        <path d={arc(START, START - SPAN)} stroke="url(#vcg)" strokeOpacity=".2" strokeWidth="16" fill="none" strokeLinecap="round" />
        {score > 0 && <><path d={arc(START, end)} stroke="url(#vcg)" strokeWidth="16" fill="none" strokeLinecap="round" filter="url(#vcglow)" opacity=".6" /><path d={arc(START, end)} stroke="url(#vcg)" strokeWidth="16" fill="none" strokeLinecap="round" /></>}
        <circle cx={kx} cy={ky} r="13" fill="hsl(var(--foreground))" opacity=".35" filter="url(#vcglow)" />
        <circle cx={kx} cy={ky} r="10" fill="hsl(var(--foreground))" stroke="hsl(var(--background))" strokeWidth="3" />
      </svg>
      <div className="vc-gauge-num"><b>{score}</b><small>/100</small><div>{label}</div></div>
    </div>
  );
}

export function ResultView({ data }: { data: Result }) {
  const r = evaluate(data.weg, data.answers);
  const a = data.weg === 'a';
  const color = ['rot', 'gelb', 'grün'];
  return (
    <main className="vc-main">
      <p className="vc-kicker">Eure persönliche Auswertung</p>
      <h1 className="vc-h1"><span className="l">{data.first_name},</span><span className="b">{a ? 'hier verliert euer Vertrieb Kunden.' : 'was euch für den Start fehlt.'}</span></h1>

      <section className="vc-panel">
        <div className="vc-panel-top"><span>Euer Ergebnis</span><span><i className="vc-dot vc-c2" style={{ width: 8, height: 8 }} />Persönlich ausgewertet</span></div>
        <div className="vc-panel-grid">
          <Gauge score={r.score} label={`Euer ${r.def.score}`} />
          <div>
            <div className="vc-leck">
              <div className="vc-label">{r.def.leck}</div>
              {r.weakest ? <><h3><i className={`vc-dot vc-c${r.weakest.score}`} />{r.weakest.name}</h3><p>{r.weakest.text}</p></> : <h3>Keine – alle Stationen sind grün.</h3>}
            </div>
            <div className="vc-typ"><div className="vc-label">Euer Typ</div><h3>{r.type.name}</h3><p>{r.type.text}</p></div>
          </div>
        </div>
      </section>

      <section className="vc-stations">
        {r.cards.map(c => (
          <article key={c.key} className={`vc-card vc-station vc-c${c.score}`}>
            <h3><i className="vc-dot" />{c.name}<small>{color[c.score]}</small></h3>
            <p>{c.text}</p>
          </article>
        ))}
      </section>

      <div className="vc-note"><MapPin size={20} /><span>{data.area_status === 'vergeben' ? `Euer PLZ-Bereich ${data.postcode_prefix} ist aktuell vergeben. Wir setzen euch auf die Warteliste.` : `Für euren PLZ-Bereich ${data.postcode_prefix} nehmen wir aktuell noch einen Vertrieb auf.`}</span></div>

      <section className="vc-two">
        <div className="vc-card">
          <p className="vc-kicker">{a ? 'So schließen wir die roten Stationen' : 'So startet ihr richtig'}</p>
          <h2>3 Minuten, die euren Vertrieb verändern</h2>
          <div className="vc-video">{data.video_url ? <video src={data.video_url} controls playsInline preload="metadata" poster={preview.url} /> : <img src={preview.url} alt="Vorschau der Auswertung" />}</div>
        </div>
        <div className="vc-card">
          <p className="vc-kicker">Euer nächster Schritt</p>
          <h2>{r.def.call.h}</h2>
          <p>{r.def.call.t}</p>
          <iframe className="vc-calendar" title="Auswertung mit Jonas (30 Min)" src={data.calendar_url} loading="lazy" />
          <p className="mt-3 text-sm"><a className="underline" href={data.calendar_url} target="_blank" rel="noreferrer">Kalender in neuem Tab öffnen</a></p>
        </div>
      </section>
      <ClientLogos />
    </main>
  );
}

function parsePreview(q: URLSearchParams): Result | null {
  const weg = q.get('weg') === 'b' ? 'b' : 'a';
  const answers = (q.get('a') || '0,1,2,0,1').split(',').map(Number);
  if (answers.length !== 5 || answers.some(n => ![0, 1, 2].includes(n))) return null;
  const plz = (q.get('plz') || '12345').replace(/\D/g, '').slice(0, 3);
  return { weg, answers, first_name: (q.get('name') || 'Max').slice(0, 40), postcode_prefix: plz, area_status: q.get('gebiet') === 'vergeben' ? 'vergeben' : 'frei', video_url: null, calendar_url: DEFAULT_CALENDAR };
}

export default function ResultPage() {
  const { token } = useParams();
  const [query] = useSearchParams();
  const isPreview = token === 'vorschau';
  const [data, setData] = useState<Result | null>(() => (isPreview ? parsePreview(query) : null));
  const [error, setError] = useState('');
  useEffect(() => {
    if (isPreview || !token) return;
    void supabase.functions.invoke(`vertriebs-check?action=result&token=${encodeURIComponent(token)}`, { body: { token } }).then(({ data, error }) => {
      if (error || !data?.answers || !data?.weg) { setError('Diese Auswertung wurde nicht gefunden. Bitte prüft euren Link.'); return; }
      setData(data);
    });
  }, [token, isPreview]);
  return (
    <CheckShell result>
      {error ? <main className="vc-main"><p role="alert">{error}</p></main> : data ? <ResultView data={data} /> : <main className="vc-main"><p>Auswertung wird geladen …</p></main>}
    </CheckShell>
  );
}
