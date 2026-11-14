import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, User, Mail, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import PlaybookShell from './PlaybookShell';
import { playbookFormSchema, isTestEmail, hasActionExpired } from './model';
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
      <span className="pb-field-icon" aria-hidden="true">{key === 'email' ? <Mail /> : key === 'phone' ? <span className="pb-germany-flag" /> : <User />}</span>
      {key === 'phone' && <span className="pb-phone-prefix" aria-hidden="true">+49</span>}
      <input id={`pb-${key}`} name={key} type={type} inputMode={key === 'phone' ? 'tel' : undefined} autoComplete={autoComplete} placeholder={label} value={fields[key]} onChange={(event) => update(key, event.target.value)} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `pb-${key}-error` : undefined} />
    </div>
    {errors[key] && <p className="pb-error" id={`pb-${key}-error`}>{errors[key]}</p>}
  </div>;

  return <PlaybookShell home>
    <main className="pb-home">
      <section className="pb-hero" aria-labelledby="pb-title">
        <p className="pb-kicker"><svg viewBox="0 0 19 14" fill="none" aria-hidden="true"><path d="M1 13 13 1M6 13 18 1" stroke="currentColor" strokeWidth="1.6" /></svg><span>Für Makler, Finanzberater &amp; Kapitalanlage-Vertriebe</span><svg className="pb-kicker-mirror" viewBox="0 0 19 14" fill="none" aria-hidden="true"><path d="M1 13 13 1M6 13 18 1" stroke="currentColor" strokeWidth="1.6" /></svg></p>
        <h1 className="pb-title" id="pb-title"><span className="pb-title-intro">{hasActionExpired(settings.aktion_bis) ? 'Kostenfrei:' : 'Für kurze Zeit kostenfrei:'}</span><span className="pb-title-product"><span className="pb-title-box">Social Media</span> in 2027 meistern.</span></h1>
        <p className="pb-subtitle">Der schnellste Weg, über Social Media an Leads zu kommen, die nur dir gehören. <strong>Sofort umsetzbar.</strong></p>
        <div className="pb-chips">{['Millionen-Euro-Vertrieb aufbauen', 'Funnel-Handbuch', 'Social-Media-Masterclass'].map((text) => <span key={text}><span className="pb-chip-check"><Check /></span>{text}</span>)}</div>
      </section>
      <div className="pb-offer">
        <figure className="pb-book"><img src={settings.cover_bild_url || cover.url} alt="Buch-Mockup: Social Media in 2027 meistern – der Marktführer-Funnel" /></figure>
        <div className="pb-form-shell">
          <form className="pb-form" onSubmit={submit} onFocusCapture={formStarted} noValidate>
            {field('first_name', 'Vorname *', 'text', 'given-name')}
            {field('last_name', 'Nachname *', 'text', 'family-name')}
            {field('email', 'E-Mail *', 'email', 'email')}
            {field('phone', 'Telefon *', 'tel', 'tel')}
            <label className="pb-checkbox"><input type="checkbox" checked={fields.privacy} onChange={(event) => update('privacy', event.target.checked)} aria-describedby={errors.privacy ? 'pb-privacy-error' : undefined} /><span>Ich habe die <a href="/playbook/datenschutz" target="_blank">Datenschutzerklärung</a> gelesen. Marketlab Media darf mich zum Playbook per E-Mail und telefonisch kontaktieren.</span></label>
            {errors.privacy && <p className="pb-error" id="pb-privacy-error">{errors.privacy}</p>}
            <div className="pb-button-shell"><Button className="pb-button" type="submit" disabled={sending}><span className="pb-button-square" aria-hidden="true"><span /></span><span className="pb-button-copy"><span>{sending ? 'Playbook wird vorbereitet …' : 'Jetzt Playbook kostenfrei sichern'}</span><span>Komplettanleitung auf 20 Seiten</span></span></Button></div>
            {errors.general && <p className="pb-error" role="alert">{errors.general}</p>}
            <a className="pb-trust pb-trust-only" href="https://de.trustpilot.com/review/marketlab-media.de" target="_blank" rel="noopener" aria-label="Alle Bewertungen auf Trustpilot: 5 von 5 Sternen" title="Alle Bewertungen auf Trustpilot: 5 von 5 Sternen"><span className="pb-trust-stars" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <span key={index}><Star fill="currentColor" strokeWidth={0} /></span>)}</span></a>
          </form>
        </div>
      </div>
    </main>
  </PlaybookShell>;
}
