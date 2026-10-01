import { FormEvent, useEffect, useState } from "react";
import { Check, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import jonasPhoto from "@/assets/positioning/jonas-fesser.webp.asset.json";
import marketlabLogo from "@/assets/positioning/logo-marketlab-media-white.png.asset.json";
import { cases, fitItems, noFitItems, trustMarks } from "./positioning/content";
import "./positioning/positioning-analysis.css";

const CTA = "Jetzt Positionierungs-Analyse sichern";

function SectionLabel({ number, children }: { number: string; children: string }) {
  return <div className="pa-label"><span>{number}</span><i /><b>{children}</b></div>;
}

function Header() {
  return <header className="pa-header"><span /><img src={marketlabLogo.url} alt="Marketlab Media" /><span /></header>;
}

function Hero() {
  const goToBooking = () => document.getElementById("termin")?.scrollIntoView({ behavior: "smooth" });
  return <section className="pa-hero">
    <p className="pa-eyebrow">Für Kapitalanlagevertriebe & Finanzdienstleister</p>
    <h1>Wie du 2026 Anfragen bekommst, die sich wie <em>Empfehlungen</em> anfühlen.</h1>
    <p className="pa-subline">Das System hinter über 2.000 Reels und Ads für die Immobilien- und Finanzbranche. Kurz erklärt im Video.</p>
    <div className="pa-video-shell">
      <div className="pa-video" aria-label="Video folgt">
        <button type="button" className="pa-play" aria-label="Video abspielen"><span><Play fill="currentColor" /></span></button>
      </div>
    </div>
    <Button type="button" className="pa-cta" onClick={goToBooking}>{CTA}</Button>
    <div className="pa-qualifiers"><span>Kostenlos</span><span>Kein Preis, kein Paket</span><span>Ehrliche Einschätzung</span></div>
  </section>;
}

function LogoMarquee() {
  const marks = [...trustMarks, ...trustMarks];
  return <section className="pa-marquee-wrap" aria-label="Ausgewählte Kunden">
    <p>Vertrauen uns bereits</p>
    <div className="pa-marquee"><div className="pa-marquee-track">
      {marks.map((mark, index) => mark.logo
        ? <img key={`${mark.name}-${index}`} src={mark.logo} alt={index < trustMarks.length ? mark.name : ""} />
        : <span key={`${mark.name}-${index}`}>{mark.name}</span>)}
    </div></div>
  </section>;
}

function StatRow({ stats }: { stats: string[][] }) {
  return <div className="pa-stats">{stats.map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>;
}

function CaseRow({ item, index }: { item: typeof cases[number]; index: number }) {
  const image = <div className="pa-case-image"><img src={item.image} alt={`${item.name} Kundenergebnis`} /><span>Case 0{index + 1}</span></div>;
  const copy = <div className="pa-case-copy"><img src={item.logo} alt={item.name} /><p>{item.quote}</p><StatRow stats={item.stats} /></div>;
  return <article className={`pa-case ${item.imageRight ? "pa-case-reverse" : ""}`}>{image}{copy}</article>;
}

function Results() {
  return <section className="pa-section pa-results"><SectionLabel number="01">Ergebnisse</SectionLabel>
    <h2>Drei Kunden. Drei Wege zur <em>Monopol-Positionierung</em>.</h2>
    <div>{cases.map((item, index) => <CaseRow key={item.name} item={item} index={index} />)}</div>
  </section>;
}

function FitColumn({ title, items, positive }: { title: string; items: string[]; positive?: boolean }) {
  const Icon = positive ? Check : X;
  return <div className="pa-fit-column"><h3>{title}</h3>{items.map(item => <div className="pa-fit-item" key={item}>
    <span className={positive ? "is-positive" : "is-negative"}><Icon /></span><p>{item}</p>
  </div>)}</div>;
}

function FitSection() {
  return <section className="pa-section"><SectionLabel number="02">Für wen</SectionLabel>
    <h2>Der Termin ist nicht für <em>jeden</em>.</h2>
    <div className="pa-fit-grid"><FitColumn title="Passt, wenn du …" items={fitItems} positive /><FitColumn title="Passt nicht, wenn …" items={noFitItems} /></div>
  </section>;
}

function FounderBlock() {
  return <section className="pa-section pa-founder">
    <div className="pa-founder-image"><img src={jonasPhoto.url} alt="Jonas Fesser, Gründer von Marketlab Media" /><div><strong>Jonas Fesser</strong><span>Gründer · Marketlab Media</span></div></div>
    <div className="pa-founder-copy"><SectionLabel number="03">Dein Gespräch</SectionLabel>
      <h2>Wir fangen nie mit Ads an. Sondern mit deiner <em>Stärke</em>.</h2>
      <p>In der kostenlosen Positionierungs-Analyse schauen wir uns an, wo du heute vergleichbar bist und was dich unvergleichbar machen würde. Wenn wir dir nicht helfen können, sagen wir dir das ehrlich.</p>
      <StatRow stats={[["2.000+", "Reels und Ads"], ["1 Mio. €+", "Kundenumsatz"], ["30 Mio.", "Reichweite"]]} />
      <Button type="button" className="pa-cta" onClick={() => document.getElementById("termin")?.scrollIntoView({ behavior: "smooth" })}>{CTA}</Button>
    </div>
  </section>;
}

type FormData = { industry: string; revenue: string; company: string; name: string; email: string; phone: string };
const emptyForm: FormData = { industry: "", revenue: "", company: "", name: "", email: "", phone: "" };

function BookingForm() {
  const [form, setForm] = useState(emptyForm);
  const [step, setStep] = useState(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const update = (key: keyof FormData, value: string) => setForm(current => ({ ...current, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (Object.values(form).some(value => !value.trim())) { setError("Bitte fülle alle Felder aus."); return; }
    setPending(true); setError("");
    const { error: saveError } = await supabase.from("positioning_analysis_leads").insert({
      industry: form.industry, monthly_revenue: form.revenue, company: form.company,
      contact_name: form.name, email: form.email, phone: form.phone,
    });
    setPending(false);
    if (saveError) { setError("Das hat noch nicht geklappt. Bitte versuche es erneut."); return; }
    if (typeof window.fbq === "function") window.fbq("track", "Lead");
    setStep(2);
    requestAnimationFrame(() => document.getElementById("termin")?.scrollIntoView({ behavior: "smooth" }));
  }

  return <section id="termin" className="pa-booking pa-section">
    <p className="pa-eyebrow">Schritt {step} von 2 · {step === 1 ? "Kurz vorstellen" : "Termin wählen"}</p>
    <h2>Hol dir deine kostenlose <em>Positionierungs-Analyse</em>.</h2>
    <div className="pa-booking-card">
      {step === 1 ? <form onSubmit={submit} noValidate>
        <div className="pa-form-grid">
          <label><span>Branche</span><select required value={form.industry} onChange={e => update("industry", e.target.value)}><option value="">Bitte wählen</option><option>Kapitalanlagevertrieb</option><option>Finanzdienstleister</option><option>Immobilienmakler</option><option>Sonstiges</option></select></label>
          <label><span>Monatlicher Umsatz</span><select required value={form.revenue} onChange={e => update("revenue", e.target.value)}><option value="">Bitte wählen</option><option>Unter 20.000 €</option><option>20.000 bis 50.000 €</option><option>50.000 bis 100.000 €</option><option>Über 100.000 €</option></select></label>
          <label><span>Firma</span><input required value={form.company} onChange={e => update("company", e.target.value)} /></label>
          <label><span>Name</span><input required value={form.name} onChange={e => update("name", e.target.value)} /></label>
          <label><span>E-Mail</span><input type="email" required value={form.email} onChange={e => update("email", e.target.value)} /></label>
          <label><span>Telefon</span><input type="tel" required value={form.phone} onChange={e => update("phone", e.target.value)} /></label>
        </div>
        {error && <p className="pa-form-error" role="alert">{error}</p>}
        <Button className="pa-cta pa-submit" disabled={pending}>{pending ? "Wird gespeichert …" : "Weiter zur Terminauswahl"}</Button>
        <p className="pa-privacy">Deine Daten nutzen wir nur zur Vorbereitung des Termins.</p>
      </form> : <div className="pa-calendar">
        <p>Danke, {form.name.trim().split(" ")[0]}. Wähl jetzt einen Termin, der dir passt.</p>
        <iframe title="Termin für Positionierungs-Analyse wählen" src="https://calendar.app.google/i2jtG5DapbEjzWba6" />
        <div><a href="https://calendar.app.google/i2jtG5DapbEjzWba6" target="_blank" rel="noreferrer">Kalender in neuem Tab öffnen</a><button type="button" onClick={() => setStep(1)}>Angaben ändern</button></div>
      </div>}
    </div>
  </section>;
}

function Footer() {
  return <footer className="pa-footer"><img src={marketlabLogo.url} alt="Marketlab Media" /><div><span>© 2026 Marketlab Media UG</span><a href="https://marketlab-media.de/impressum">Impressum</a><a href="https://marketlab-media.de/datenschutz">Datenschutz</a></div></footer>;
}

declare global { interface Window { fbq?: (...args: unknown[]) => void } }

export default function PositioningAnalysis() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Kostenlose Positionierungs-Analyse · Marketlab Media";
    const description = document.querySelector('meta[name="description"]');
    const previousDescription = description?.getAttribute("content");
    description?.setAttribute("content", "Kostenlose Positionierungs-Analyse für Kapitalanlagevertriebe und Finanzdienstleister mit Marketlab Media.");
    return () => { document.title = previousTitle; if (description && previousDescription) description.setAttribute("content", previousDescription); };
  }, []);
  return <main className="pa-page"><Header /><Hero /><LogoMarquee /><Results /><FitSection /><FounderBlock /><BookingForm /><Footer /></main>;
}