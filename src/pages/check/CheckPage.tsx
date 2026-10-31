import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, CheckCircle, Lock, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import preview from '@/assets/check/vorschau.jpg.asset.json';
import CheckShell from './CheckShell';
import TrustpilotBadge from './TrustpilotBadge';
import ClientLogos from './ClientLogos';
import { VC, heroFor, heroBullets, contactSchema, type Weg } from './model';
import { mountTracking, track, submitTracking, trackRegistration, permitted } from './tracking';

type Screen = 'start' | 'weiche' | 'q' | 'stop' | 'form';
const VARIANT_KEY = 'vc_v';

export default function CheckPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // The variant is kept in browser storage only with tracking consent; otherwise it lives in page state.
  const [variant, setVariant] = useState<string>(() => (permitted() && sessionStorage.getItem(VARIANT_KEY)) || '');
  useEffect(() => {
    const v = params.get('v');
    if (v !== null) { const clean = v.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40); if (permitted()) sessionStorage.setItem(VARIANT_KEY, clean); setVariant(clean); }
  }, [params]);
  useEffect(() => mountTracking(() => { if (variant && permitted()) sessionStorage.setItem(VARIANT_KEY, variant); track('besuch', { variant }); }), [variant]);
  const requestRef = useRef<string>(crypto.randomUUID());
  const hero = heroFor(variant);

  const [screen, setScreen] = useState<Screen>('start');
  const [weg, setWeg] = useState<Weg | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [qi, setQi] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState({ first_name: '', company: '', phone: '', email: '', whatsapp_consent: false, email_consent: false, privacy: false });

  useEffect(() => { window.scrollTo({ top: 0 }); }, [screen, qi]);

  function chooseWeg(i: number) {
    if (i === 2) { track('kein_meta', { variant }); setScreen('stop'); return; }
    const next: Weg = i === 0 ? 'a' : 'b';
    track('check_start', { weg: next, variant });
    if (next !== weg) setAnswers([]); // switching ways discards old answers
    setWeg(next); setQi(0); setScreen('q');
  }
  function answer(i: number) {
    const next = [...answers.slice(0, qi), i];
    setAnswers(next);
    if (qi < 4) setQi(qi + 1); else { setScreen('form'); track('formular', { weg, variant }); }
  }
  function back() {
    if (screen === 'form') { setScreen('q'); setQi(4); return; }
    if (screen === 'q') { if (qi === 0) setScreen('weiche'); else setQi(qi - 1); return; }
    if (screen === 'weiche') setScreen('start');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = contactSchema.safeParse(fields);
    if (!v.success) { setError(v.error.issues[0]?.message || 'Bitte prüft eure Angaben.'); return; }
    if (!weg || answers.length !== 5) { setError('Bitte beantwortet zuerst alle Fragen.'); return; }
    setBusy(true); setError('');
    const requestId = requestRef.current;
    const t = submitTracking();
    try {
      const { data, error: err } = await supabase.functions.invoke('vertriebs-check', { body: { ...v.data, weg, answers, variant: variant || null, request_id: requestId, ...t } });
      if (err || !data?.token) throw err || new Error('no token');
      if (data.tracked && 'event_id' in t) trackRegistration(t.event_id);
      requestRef.current = crypto.randomUUID();
      navigate(`/check/auswertung/${data.token}`);
    } catch {
      setError('Das hat gerade nicht geklappt. Bitte prüft eure Verbindung und versucht es noch einmal.');
    } finally { setBusy(false); }
  }

  const step = screen === 'weiche' ? 1 : screen === 'q' ? qi + 2 : 6;
  const progress = (screen === 'weiche' || screen === 'q') && (
    <>
      <div className="vc-progress">
        <Button variant="ghost" size="icon" aria-label="Zurück" onClick={back}><ArrowLeft size={18} /></Button>
        <span>Frage {step} von 6</span>
      </div>
      <div className="vc-bar" aria-hidden><span style={{ width: `${(step / 6) * 100}%` }} /></div>
    </>
  );

  return (
    <CheckShell>
      {screen === 'start' && (
        <main className="vc-main">
          <section className="vc-hero">
            <div>
              <p className="vc-kicker">Für Immobilien- und Finanzvertriebe</p>
              <h1 className="vc-h1"><span className="l">{hero.l}</span><span className="b">{hero.b}</span></h1>
              <p className="mb-3 text-lg">{hero.t}</p>
              <ul className="vc-list">{heroBullets.map(t => <li key={t}><Check size={16} />{t}</li>)}</ul>
              <Button className="vc-pill" onClick={() => setScreen('weiche')}>Check starten →</Button>
              <ul className="vc-trust-line">
                <li><span className="vc-trust-ico"><Lock size={10} /></span>DSGVO-konform</li>
                <li><span className="vc-trust-ico"><CheckCircle size={10} /></span>Kein Weiterverkauf eurer Daten</li>
                <li><span className="vc-trust-ico"><Zap size={10} /></span>Ergebnis sofort</li>
              </ul>
              <TrustpilotBadge />
            </div>
            <div className="vc-hero-img"><img src={preview.url} alt="Vorschau der persönlichen Vertriebs-Check-Auswertung" width={1100} height={1000} /></div>
          </section>
          <ClientLogos />
        </main>
      )}

      {screen === 'weiche' && (
        <main className="vc-main vc-narrow">
          {progress}
          <h2 className="vc-q">{VC.weiche.q}</h2>
          <div className="vc-options">{VC.weiche.a.map((a, i) => <Button key={a} variant="outline" className="vc-answer" onClick={() => chooseWeg(i)}>{a}<ArrowRight size={18} /></Button>)}</div>
        </main>
      )}

      {screen === 'q' && weg && (() => { const q = VC.wege[weg].questions[qi]; return (
        <main className="vc-main vc-narrow" key={q.key}>
          {progress}
          <h2 className="vc-q">{q.q}</h2>
          <div className="vc-options">{q.a.map((a, i) => <Button key={a} variant="outline" className="vc-answer" aria-pressed={answers[qi] === i} onClick={() => answer(i)}>{a}<ArrowRight size={18} /></Button>)}</div>
        </main>
      ); })()}

      {screen === 'stop' && (
        <main className="vc-main vc-narrow vc-stop">
          <h2 className="vc-q mb-4">Dann passt der Check gerade nicht.</h2>
          <p className="mb-8">Der Vertriebs-Check zeigt, wie ihr über Anzeigen auf Instagram und Facebook mehr Kunden gewinnt. Wenn das für euch kein Thema ist, sparen wir euch die restlichen Fragen.</p>
          <Button className="vc-pill" onClick={() => setScreen('weiche')}>Doch, wir überlegen es uns →</Button>
        </main>
      )}

      {screen === 'form' && (
        <main className="vc-main vc-narrow">
          <div className="vc-progress"><Button variant="ghost" size="icon" aria-label="Zurück" onClick={back}><ArrowLeft size={18} /></Button><span>Alle 6 Fragen beantwortet</span></div>
          <div className="vc-bar" aria-hidden><span style={{ width: '100%' }} /></div>
          <h2 className="vc-h2"><span className="l">Fast geschafft.</span><span className="b">Wohin dürfen wir eure Auswertung schicken?</span></h2>
          <form className="vc-form vc-card" onSubmit={submit} noValidate>
            <div className="vc-fields">
              {([
                { key: 'first_name', label: 'Vorname', type: 'text', max: 100, auto: 'given-name' },
                { key: 'company', label: 'Firma', type: 'text', max: 200, auto: 'organization' },
                { key: 'phone', label: 'Handynummer', type: 'tel', max: 32, auto: 'tel' },
                { key: 'email', label: 'E-Mail', type: 'email', max: 255, auto: 'email' },
              ] as const).map(f => (
                <div className="vc-field" key={f.key}>
                  <label htmlFor={`vc-${f.key}`}>{f.label}</label>
                  <Input id={`vc-${f.key}`} type={f.type} autoComplete={f.auto} maxLength={f.max} required value={fields[f.key]} onChange={e => setFields({ ...fields, [f.key]: e.target.value })} />
                </div>
              ))}
            </div>
            <label className="vc-check"><Checkbox checked={fields.whatsapp_consent} onCheckedChange={v => setFields({ ...fields, whatsapp_consent: v === true })} /><span>Schickt mir meine Auswertung auch per WhatsApp.</span></label>
            <label className="vc-check"><Checkbox checked={fields.email_consent} onCheckedChange={v => setFields({ ...fields, email_consent: v === true })} /><span>Ich möchte weitere Tipps zu meiner Auswertung per E-Mail, jederzeit abbestellbar.</span></label>
            <label className="vc-check"><Checkbox checked={fields.privacy} onCheckedChange={v => setFields({ ...fields, privacy: v === true })} /><span>Ich habe die <a href="/check/datenschutz" target="_blank" rel="noreferrer">Datenschutzerklärung</a> gelesen.</span></label>
            {error && <p className="vc-error" role="alert">{error}</p>}
            <Button type="submit" className="vc-pill w-full" disabled={busy}>{busy ? 'Wird ausgewertet …' : 'Auswertung anzeigen →'}</Button>
            <p className="vc-sub">Jonas meldet sich anschließend kurz bei euch und geht die Auswertung mit euch durch.</p>
            <TrustpilotBadge />
          </form>
        </main>
      )}
    </CheckShell>
  );
}
