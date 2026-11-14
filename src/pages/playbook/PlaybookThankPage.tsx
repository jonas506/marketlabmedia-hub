import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { Check, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PlaybookAction from './PlaybookAction';
import { supabase } from '@/integrations/supabase/client';
import PlaybookShell from './PlaybookShell';
import { BERATER, UMSATZ } from './model';
import { track } from './tracking';
import cover from '@/assets/playbook-cover-mockup.png.asset.json';

type Lead = { first_name: string; last_name: string; email: string; berater_typ: string | null; umsatz_stufe: string | null; step2_completed_at: string | null };
const example: Lead = { first_name: 'Maximilian', last_name: 'Mustermann', email: 'max@beispiel.de', berater_typ: null, umsatz_stufe: null, step2_completed_at: null };

export default function PlaybookThankPage() {
  const { token = '' } = useParams();
  const location = useLocation();
  const preview = token === 'vorschau';
  const [lead, setLead] = useState<Lead | null>(preview ? example : null);
  const [error, setError] = useState('');
  const [advisor, setAdvisor] = useState('');
  const [revenue, setRevenue] = useState('');
  const [done, setDone] = useState(preview && new URLSearchParams(location.search).get('fertig') === '1');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (preview) return;
    supabase.functions.invoke('playbook?action=lead', { body: { token } }).then(({ data, error: requestError }) => {
      if (requestError || data?.error) setError('Dieser Playbook-Link ist ungültig.');
      else { setLead(data); setDone(!!data.step2_completed_at); setAdvisor(data.berater_typ || ''); setRevenue(data.umsatz_stufe || ''); }
    });
  }, [token, preview]);

  async function step2() {
    if (!advisor || !revenue) { setError('Bitte beantworte beide Fragen oder überspringe diesen Schritt.'); return; }
    setError(''); setSending(true);
    if (preview) { setDone(true); setSending(false); return; }
    const { data, error: requestError } = await supabase.functions.invoke('playbook?action=step2', { body: { token, berater_typ: advisor, umsatz_stufe: revenue } });
    if (requestError || data?.error) setError('Das hat nicht geklappt. Bitte erneut versuchen.');
    else { setDone(true); track('schritt2'); }
    setSending(false);
  }
  async function skip() {
    if (preview) { setDone(true); return; }
    setSending(true);
    await supabase.functions.invoke('playbook?action=skip', { body: { token } });
    track('uebersprungen'); setDone(true); setSending(false);
  }
  function download() { track('download'); }

  return <PlaybookShell noindex followup><main className="pb-thanks">
    {error && !lead && <><h1>Link nicht gefunden</h1><p className="pb-thanks-intro">{error}</p></>}
    {!lead && !error && <p className="pb-thanks-intro">Dein Playbook wird geladen …</p>}
    {lead && !done && <section className="pb-step-card">
      <p className="pb-thanks-kicker"><svg viewBox="0 0 19 14" fill="none" aria-hidden="true"><path d="M1 13 13 1M6 13 18 1" stroke="currentColor" strokeWidth="1.6" /></svg>Schritt 2 von 2</p>
      <h1>{lead.first_name}, noch zwei kurze Fragen.</h1>
      <p className="pb-thanks-intro">Damit wir dir die passenden Beispiele schicken.</p>
      <p className="pb-question-kicker">Frage 1 von 2</p><h2>Was für ein Berater bist du?</h2>
      <div className="pb-answers">{BERATER.map((item) => <Button type="button" aria-pressed={advisor === item} className={`pb-answer ${advisor === item ? 'selected' : ''}`} key={item} onClick={() => setAdvisor(item)}><span>{item}{advisor === item && <Check aria-hidden="true" />}</span></Button>)}</div>
      <p className="pb-question-kicker">Frage 2 von 2</p><h2>Wie viel Umsatz machst du im Monat durchschnittlich?</h2>
      <div className="pb-answers">{UMSATZ.map((item) => <Button type="button" aria-pressed={revenue === item} className={`pb-answer ${revenue === item ? 'selected' : ''}`} key={item} onClick={() => setRevenue(item)}><span>{item}{revenue === item && <Check aria-hidden="true" />}</span></Button>)}</div>
      {error && <p className="pb-error">{error}</p>}
      <PlaybookAction onClick={step2} disabled={sending}>{sending ? 'Wird gespeichert …' : 'Weiter zu meinem Playbook'}</PlaybookAction>
      <Button variant="link" className="pb-skip" type="button" onClick={skip} disabled={sending}>Überspringen</Button>
    </section>}
    {lead && done && <>
      <h1>Danke, {lead.first_name}. Dein Playbook ist fertig.</h1>
      <img className="pb-final-book" src={cover.url} alt="Dein Leads-Playbook 2027" />
      <PlaybookAction href={`/playbook/download/${token}`} onClick={download} subtitle={`PDF · 20 Seiten · persönliche Ausgabe für ${lead.first_name} ${lead.last_name}`}>Playbook herunterladen</PlaybookAction>
      <p className="pb-thanks-note">Wir haben es dir auch an {lead.email} geschickt.</p>
      <aside className="pb-call-note"><Phone aria-hidden="true" /><div><h2>Wir rufen dich an</h2><p>Jonas oder jemand aus seinem Team meldet sich kurz telefonisch bei dir und schaut mit dir, welche der 7 Phasen dir noch fehlt. Kein Verkaufsgespräch, wenn du das nicht willst.</p></div></aside>
    </>}
  </main></PlaybookShell>;
}
