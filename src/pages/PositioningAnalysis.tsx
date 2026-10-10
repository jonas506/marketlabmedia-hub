import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import marketlabLogo from "@/assets/positioning/logo-marketlab-media-white.png.asset.json";
import { isStepComplete, type PositioningFormData } from "./positioning/form-steps";
import "./positioning/positioning-analysis.css";
import { getSessionId, getUtm, trackStep } from "./positioning/tracking";

const VSL_URL = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/landing-page-assets/positioning-vsl.mp4`;

const CTA = "Jetzt Positionierungs-Analyse sichern";

function SectionLabel({ number, children }: { number: string; children: string }) {
  return <div className="pa-label"><span>{number}</span><i /><b>{children}</b></div>;
}

function Header() {
  return <header className="pa-header"><span /><img src={marketlabLogo.url} alt="Marketlab Media" /><span /></header>;
}

function Hero({ onStart }: { onStart: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const play = () => { setPlaying(true); videoRef.current?.play(); };
  return <section className="pa-hero">
    <p className="pa-eyebrow">Für Kapitalanlagevertriebe & Finanzdienstleister</p>
    <h1>Wie du 2026 Anfragen bekommst, die sich wie <em>Empfehlungen</em> anfühlen.</h1>
    <p className="pa-subline">Das System hinter über 2.000 Reels und Ads für die Immobilien- und Finanzbranche. Kurz erklärt im Video.</p>
    <div className="pa-video-shell">
      <div className="pa-video" aria-label="Video">
        <video
          ref={videoRef}
          src={VSL_URL}
          preload="metadata"
          playsInline
          controls={playing}
          onPlay={() => { setPlaying(true); trackStep("video"); }}
          onPause={() => setPlaying(false)}
          onClick={() => (playing ? videoRef.current?.pause() : play())}
        />
        {!playing && (
          <Button type="button" className="pa-play" aria-label="Video abspielen" onClick={play}>
            <span><Play fill="currentColor" /></span>
          </Button>
        )}
      </div>
    </div>
    <Button type="button" className="pa-cta" onClick={onStart}>{CTA}</Button>
  </section>;
}

type FormData = PositioningFormData;
const emptyForm: FormData = { industry: "", revenue: "", company: "", name: "", email: "", phone: "" };

function BookingForm() {
  const [form, setForm] = useState(emptyForm);
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const update = (key: keyof FormData, value: string) => setForm(current => ({ ...current, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!isStepComplete(step, form)) {
      setError(step === 1 ? "Bitte wähle deine Branche." : step === 2 ? "Bitte wähle deinen monatlichen Umsatz." : "Bitte fülle alle Kontaktdaten aus und gib eine gültige E-Mail-Adresse an.");
      return;
    }
    setError("");
    if (step < 3) { setStep(step + 1); return; }
    if (![1, 2, 3].every(current => isStepComplete(current, form))) { setStep(1); return; }
    setPending(true); setError("");
    const { error: saveError } = await supabase.from("positioning_analysis_leads").insert({
      industry: form.industry, monthly_revenue: form.revenue, company: form.company,
      contact_name: form.name, email: form.email, phone: form.phone,
      session_id: getSessionId(), ...getUtm(),
    });
    setPending(false);
    if (saveError) { setError("Das hat noch nicht geklappt. Bitte versuche es erneut."); return; }
    trackStep("eingetragen");
    if (typeof window.fbq === "function") window.fbq("track", "Lead");
    setSubmitted(true);
    requestAnimationFrame(() => document.getElementById("termin")?.scrollIntoView({ behavior: "smooth" }));
  }

  return <section id="termin" className="pa-booking pa-section">
    <p className="pa-eyebrow">{submitted ? "Termin wählen" : `Schritt ${step} von 3`}</p>
    <h2>{submitted ? <>Deine <em>Positionierungs-Analyse</em>.</> : step === 1 ? <>In welcher <em>Branche</em> bist du tätig?</> : step === 2 ? <>Wie hoch ist dein monatlicher <em>Umsatz</em>?</> : <>Wie können wir dich <em>erreichen</em>?</>}</h2>
    <div className="pa-booking-card">
      {!submitted ? <form onSubmit={submit} onFocus={() => trackStep("formular")} noValidate>
        <ol className="pa-step-progress" aria-label="Formularfortschritt">
          {["Branche", "Monatlicher Umsatz", "Kontaktdaten"].map((label, index) => <li key={label} className={step >= index + 1 ? "is-current" : ""} aria-current={step === index + 1 ? "step" : undefined}><span>{step > index + 1 ? <Check size={16} /> : index + 1}</span><b>{label}</b></li>)}
        </ol>
        {step < 3 ? <div className="pa-answer-options" role="group" aria-label={step === 1 ? "Branche" : "Monatlicher Umsatz"}>
          {(step === 1 ? ["Kapitalanlagevertrieb", "Finanzdienstleister", "Immobilienmakler", "Sonstiges"] : ["Unter 20.000 €", "20.000 bis 50.000 €", "50.000 bis 100.000 €", "Über 100.000 €"]).map(option => {
            const selected = (step === 1 ? form.industry : form.revenue) === option;
            return <Button type="button" key={option} variant="outline" className={`pa-answer ${selected ? "is-selected" : ""}`} aria-pressed={selected} onClick={() => { update(step === 1 ? "industry" : "revenue", option); setError(""); }}><span>{option}</span>{selected ? <Check size={20} /> : <ArrowRight size={20} />}</Button>;
          })}
        </div> : <div className="pa-form-grid">
          <label><span>Firma</span><input autoComplete="organization" required value={form.company} onChange={e => update("company", e.target.value)} /></label>
          <label><span>Name</span><input autoComplete="name" required value={form.name} onChange={e => update("name", e.target.value)} /></label>
          <label><span>E-Mail</span><input autoComplete="email" type="email" required value={form.email} onChange={e => update("email", e.target.value)} /></label>
          <label><span>Telefon</span><input autoComplete="tel" type="tel" required value={form.phone} onChange={e => update("phone", e.target.value)} /></label>
        </div>}
        {error && <p className="pa-form-error" role="alert">{error}</p>}
        <div className="pa-form-actions">
          {step > 1 && <Button type="button" variant="ghost" className="pa-back" disabled={pending} onClick={() => { setStep(step - 1); setError(""); }}><ArrowLeft size={18} />Zurück</Button>}
          <Button type="submit" className="pa-cta pa-submit" disabled={pending}>{pending ? "Wird gespeichert …" : step < 3 ? "Weiter" : "Weiter zur Terminauswahl"}<ArrowRight size={18} /></Button>
        </div>
        <p className="pa-privacy">Deine Daten nutzen wir nur zur Vorbereitung des Termins.</p>
      </form> : <div className="pa-calendar">
        <p>Danke, {form.name.trim().split(" ")[0]}. Wähl jetzt einen Termin, der dir passt.</p>
        <iframe title="Termin für Positionierungs-Analyse wählen" src="https://calendar.app.google/i2jtG5DapbEjzWba6" />
        <div><a href="https://calendar.app.google/i2jtG5DapbEjzWba6" target="_blank" rel="noreferrer">Kalender in neuem Tab öffnen</a></div>
      </div>}
    </div>
  </section>;
}

function Footer() {
  return <footer className="pa-footer"><img src={marketlabLogo.url} alt="Marketlab Media" /><div><span>© 2026 Marketlab Media UG</span><a href="https://marketlab-media.de/impressum">Impressum</a><a href="https://marketlab-media.de/datenschutz">Datenschutz</a></div></footer>;
}

declare global { interface Window { fbq?: (...args: unknown[]) => void } }

export default function PositioningAnalysis() {
  const [formOpen, setFormOpen] = useState(false);
  const startForm = () => {
    setFormOpen(true);
    trackStep("formular");
    requestAnimationFrame(() => document.getElementById("termin")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }));
  };
  useEffect(() => { getUtm(); trackStep("besuch"); }, []);
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Kostenlose Positionierungs-Analyse · Marketlab Media";
    const description = document.querySelector('meta[name="description"]');
    const previousDescription = description?.getAttribute("content");
    description?.setAttribute("content", "Kostenlose Positionierungs-Analyse für Kapitalanlagevertriebe und Finanzdienstleister mit Marketlab Media.");
    return () => { document.title = previousTitle; if (description && previousDescription) description.setAttribute("content", previousDescription); };
  }, []);
  return <main className="pa-page"><Header /><Hero onStart={startForm} />{formOpen && <BookingForm />}<Footer /></main>;
}