import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, CheckSquare, FileText, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import PlaybookShell from './PlaybookShell';
import TrustpilotBadge from './TrustpilotBadge';
import { playbookFormSchema, isTestEmail } from './model';
import { mountTracking, track, submitTracking, trackLead } from './tracking';
import cover from '@/assets/playbook-cover-mockup.png.asset.json';

type Settings = { aktion_bis: string | null; cover_bild_url: string | null; trustpilot_score: number; trustpilot_reviews: number };
type Fields = { first_name: string; last_name: string; email: string; phone: string; privacy: boolean };
const empty: Fields = { first_name: '', last_name: '', email: '', phone: '', privacy: false };

export default function PlaybookPage() {
  const navigate = useNavigate();
  const variant = useMemo(() => new URLSearchParams(location.search).get('v'), []);
  const [settings, setSettings] = useState<Settings>({ aktion_bis: null, cover_bild_url: cover.url, trustpilot_score: 4.4, trustpilot_reviews: 11 });
  const [fields, setFields] = useState<Fields>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const requestId = useRef(crypto.randomUUID());
  const started = useRef(false);

  useEffect(() => {
    supabase.functions.invoke('playbook?action=settings', { body: {} }).then(({ data }) => {
      if (data && !data.error) setSettings({ aktion_bis: data.aktion_bis, cover_bild_url: data.cover_bild_url || cover.url, trustpilot_score: Number(data.trustpilot_score), trustpilot_reviews: Number(data.trustpilot_reviews) });
    });
    return mountTracking(() => track('besuch', variant || undefined));
  }, [variant]);

  function formStarted() {
    if (started.current) return;
    started.current = true;
    track('formular_start', variant || undefined);
  }
  function update<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '', general: '' }));
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = playbookFormSchema.safeParse(fields);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) if (!next[String(issue.path[0])]) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    setSending(true); setErrors({});
    const tracking = submitTracking();
    try {
      const { data, error } = await supabase.functions.invoke('playbook?action=submit', {
        body: { ...parsed.data, request_id: requestId.current, variant: variant || null, ...tracking },
      });
      if (error || !data?.token) throw new Error(data?.error || 'Bitte versuche es erneut.');
      if (data.tracked) trackLead(tracking.event_id, isTestEmail(parsed.data.email));
      navigate(`/playbook/danke/${data.token}`, { replace: true });
    } catch (error) {
      setErrors({ general: error instanceof Error ? error.message : 'Das hat nicht geklappt. Bitte erneut versuchen.' });
    } finally { setSending(false); }
  }

  const field = (key: 'first_name' | 'last_name' | 'email' | 'phone', label: string, type = 'text', autoComplete: string = key) => <div className="pb-field">
    <label className="pb-sr" htmlFor={`pb-${key}`}>{label}</label>
    <div className="pb-input-shell">
      {key === 'phone' && <span className="pb-phone-prefix" aria-hidden="true">+49</span>}
      <input id={`pb-${key}`} name={key} type={type} inputMode={key === 'phone' ? 'tel' : undefined} autoComplete={autoComplete} placeholder={label} value={fields[key]} onChange={(event) => update(key, event.target.value)} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `pb-${key}-error` : undefined} />
    </div>
    {errors[key] && <p className="pb-error" id={`pb-${key}-error`}>{errors[key]}</p>}
  </div>;

  return <PlaybookShell home>
    <main className="pb-home">
      <section className="pb-hero" aria-labelledby="pb-title">
        <p className="pb-kicker"><svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m2 9 2-6 2 4 2-6 2 6 2-4 2 6-2 6H4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>Dein kostenloses Playbook für 2027</p>
        {settings.aktion_bis && <p className="pb-cost">Nur bis {settings.aktion_bis.split('-').reverse().join('.')} kostenfrei:</p>}
        <h1 className="pb-title" id="pb-title">Social Media in 2027 meistern.<strong>Die Komplettanleitung auf 20 Seiten.</strong></h1>
        <p className="pb-subtitle">So kommst du 2027 über Social Media an Leads, die nur dir gehören.</p>
        <div className="pb-chips"><span><FileText />20 Seiten</span><span className="pb-chip-dot" /><span><CheckSquare />7 Phasen</span><span className="pb-chip-dot" /><span><Clock />Sofort als PDF</span></div>
      </section>
      <div className="pb-offer">
        <figure className="pb-book"><img src={settings.cover_bild_url || cover.url} alt="Buch-Mockup: Social Media in 2027 meistern – der Marktführer-Funnel" /></figure>
        <div className="pb-form-shell">
          <form className="pb-form" onSubmit={submit} onFocusCapture={formStarted} noValidate>
            {field('first_name', 'Vorname', 'text', 'given-name')}
            {field('last_name', 'Nachname', 'text', 'family-name')}
            {field('email', 'E-Mail-Adresse', 'email', 'email')}
            {field('phone', 'Telefonnummer', 'tel', 'tel')}
            <label className="pb-checkbox"><input type="checkbox" checked={fields.privacy} onChange={(event) => update('privacy', event.target.checked)} aria-describedby={errors.privacy ? 'pb-privacy-error' : undefined} /><span>Ich habe die <a href="/playbook/datenschutz" target="_blank">Datenschutzerklärung</a> gelesen. Marketlab Media darf mich zum Playbook per E-Mail und telefonisch kontaktieren.</span></label>
            {errors.privacy && <p className="pb-error" id="pb-privacy-error">{errors.privacy}</p>}
            <div className="pb-button-shell"><button className="pb-button" type="submit" disabled={sending}>{sending ? 'Playbook wird vorbereitet …' : 'Jetzt kostenlos sichern →'}</button></div>
            <p className="pb-note">Kein Abo. Keine versteckten Kosten. Nur das Playbook und ein kurzer Anruf von uns.</p>
            {errors.general && <p className="pb-error" role="alert">{errors.general}</p>}
            <TrustpilotBadge score={settings.trustpilot_score} reviews={settings.trustpilot_reviews} />
          </form>
        </div>
      </div>
    </main>
  </PlaybookShell>;
}
