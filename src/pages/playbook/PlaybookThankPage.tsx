import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { Download } from 'lucide-react';
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
    if (!advisor || !revenue) { setError('Bitte beantworte beide Fragen – oder überspringe diesen Schritt.'); return; }
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

  return <PlaybookShell noindex><main className="pb-thanks">
    {error && !lead && <><h1>Link nicht gefunden</h1><p className="pb-thanks-intro">{error}</p></>}
    {!lead && !error && <p className="pb-thanks-intro">Dein Playbook wird geladen …</p>}
    {lead && !done && <>
      <p className="pb-thanks-greeting">Hallo, {lead.first_name}.</p>
      <p className="pb-thanks-kicker">Fast geschafft</p>
      <h1>Dein Playbook ist unterwegs.</h1>
      <p className="pb-thanks-intro">Wir haben deine Ausgabe an <strong>{lead.email}</strong> geschickt. Der Download ist unten schon bereit.</p>
      <div className="pb-button-shell"><a className="pb-button" href={`/playbook/download/${token}`} onClick={download}><Download />Jetzt herunterladen</a></div>
      <p className="pb-thanks-note">Damit dein Gespräch mit uns direkt konkret wird, sag uns noch kurz zwei Dinge über dich.</p>
      <p className="pb-question-kicker">Frage 1 von 2</p><h2>Was machst du?</h2>
      <div className="pb-answers">{BERATER.map((item) => <button type="button" className={`pb-answer ${advisor === item ? 'selected' : ''}`} key={item} onClick={() => setAdvisor(item)}><span>{item}</span></button>)}</div>
      <p className="pb-question-kicker">Frage 2 von 2</p><h2>Wo stehst du gerade mit dem Monatsumsatz?</h2>
      <div className="pb-answers">{UMSATZ.map((item) => <button type="button" className={`pb-answer ${revenue === item ? 'selected' : ''}`} key={item} onClick={() => setRevenue(item)}><span>{item}</span></button>)}</div>
      {error && <p className="pb-error">{error}</p>}
      <div className="pb-button-shell"><button className="pb-button" onClick={step2} disabled={sending}>{sending ? 'Wird gespeichert …' : 'Weiter zum Download →'}</button></div>
      <button className="pb-skip" type="button" onClick={skip} disabled={sending}>Überspringen und direkt zum Download</button>
    </>}
    {lead && done && <>
      <p className="pb-thanks-kicker">Viel Erfolg beim Umsetzen!</p>
      <h1>Deine nächsten 5 Minuten könnten dein <strong>2027 verändern.</strong></h1>
      <img className="pb-final-book" src={cover.url} alt="Dein Leads-Playbook 2027" />
      <p className="pb-thanks-intro">Dein Leads-Playbook 2027 ist bereit.</p>
      <div className="pb-button-shell"><a className="pb-button" href={`/playbook/download/${token}`} onClick={download}><Download />Playbook herunterladen</a></div>
      <p className="pb-thanks-note">Der Download-Link liegt auch in deiner Mail. Wir melden uns in den nächsten Tagen kurz bei dir.</p>
    </>}
  </main></PlaybookShell>;
}
