import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Video,
  Users,
  ShieldCheck,
  MessageSquare,
  Handshake,
  ArrowRight,
  Check,
  Minus,
  Sparkles,
  Eye,
  TrendingUp,
  Calculator,
  X,
} from "lucide-react";
import logo from "@/assets/logo-light.png";
import { useAuth } from "@/contexts/AuthContext";
import OfferConfigurator from "@/components/pricing/OfferConfigurator";
import { Wand2 } from "lucide-react";

const BRAND = {
  blue: "#0083F7",
  purple: "#21089B",
  ink: "#1E1E24",
  bg: "#0a0a0f",
};

type Plan = {
  key: string;
  name: string;
  tagline: string;
  price3: number;
  price12: number;
  setup: number;
  highlights: string[];
  popular?: boolean;
};

const PLANS: Plan[] = [
  {
    key: "basic_lite",
    name: "Basic Lite",
    tagline: "Einstieg in den organischen Aufbau",
    price3: 1500,
    price12: 1350,
    setup: 2000,
    highlights: [
      "30 Testreels / Overlayposts / Monat",
      "Posting & Strategie",
      "~360 neue Follower / Monat",
    ],
  },
  {
    key: "basic",
    name: "Basic",
    tagline: "Volle Frequenz für planbares Wachstum",
    price3: 2500,
    price12: 2250,
    setup: 2000,
    highlights: [
      "45 Testreels + 5 Carousels / Monat",
      "Posting & Strategie",
      "~540 neue Follower / Monat",
    ],
  },
  {
    key: "standard",
    name: "Standard",
    tagline: "Multi-Format für mehr Engagement",
    price3: 3500,
    price12: 3150,
    setup: 2000,
    popular: true,
    highlights: [
      "45 Testreels + 10 Carousels",
      "Story-Sequenzen",
      "~600 Follower + mehr Engagement",
    ],
  },
  {
    key: "plus",
    name: "Plus",
    tagline: "Reichweite + Drehtag-Content",
    price3: 4500,
    price12: 4050,
    setup: 2000,
    highlights: [
      "45 Testreels + 20 Drehtag-Reels + 10 Carousels",
      "Monatlicher Drehtag inkl.",
      "Carousels & Storys",
    ],
  },
];


// Comparison table data
type Cell = string | number | boolean;
type Row = { label: string; values: Cell[] };
type TableSection = { title: string; rows: Row[] };

const COMPARISON: TableSection[] = [
  {
    title: "Content-Produktion",
    rows: [
      { label: "Testreels pro Monat", values: [30, 45, 45, 45] },
      { label: "Reels mit Drehtag", values: ["—", "—", "—", 20] },
      { label: "Carousels pro Monat", values: ["—", 5, 10, 10] },
      { label: "Story-Sequenzen", values: [false, false, true, true] },
      { label: "Cover-Design & On-Screen-Text", values: [true, true, true, true] },
      { label: "Untertitel & Sounddesign", values: [true, true, true, true] },
    ],
  },
  {
    title: "Drehtag-Setup",
    rows: [
      { label: "Drehtage pro Monat", values: ["—", "—", "—", 1] },
      { label: "Equipment (Kamera, Licht, Ton)", values: [false, false, false, true] },
      { label: "Regie & Hook-Coaching am Set", values: [false, false, false, true] },
      { label: "B-Roll & Cutaway-Material", values: [false, false, false, true] },
    ],
  },
  {
    title: "Distribution",
    rows: [
      { label: "Posting & Veröffentlichung", values: [true, true, true, true] },
      { label: "Caption-Texting inkl. CTA", values: [true, true, true, true] },
      { label: "Hashtag- & SEO-Optimierung", values: [true, true, true, true] },
      { label: "Reporting-Dashboard", values: [true, true, true, true] },
    ],
  },
  {
    title: "Strategie & Steuerung",
    rows: [
      { label: "Datengetriebene Content-Strategie", values: [true, true, true, true] },
      { label: "Monatliche Performance-Analyse", values: [true, true, true, true] },
      { label: "Hook- & Format-Testing", values: [true, true, true, true] },
      { label: "Kurs: Aktueller Markt & Handy-Filming", values: [true, true, true, true] },
      { label: "Eigener Ansprechpartner", values: [true, true, true, true] },
    ],
  },
  {
    title: "Kommerziell",
    rows: [
      { label: "Einmaliges Setup", values: ["2.000 €", "2.000 €", "2.000 €", "2.000 €"] },
      { label: "Mindestlaufzeit", values: ["3 Monate", "3 Monate", "3 Monate", "3 Monate"] },
      { label: "Rabatt bei 12 Monaten", values: ["10 %", "10 %", "10 %", "10 %"] },
    ],
  },
];


const ADDONS = [
  { name: "Exposé-Bilder (pro Wohnung / Haus)", price: "150 € + Anfahrt" },
  { name: "Drehtag on top (ohne Editing)", price: "1.500 €" },
  { name: "Halbtag (ohne Editing)", price: "800 €" },
  { name: "Testimonial (inkl. 2–3 Clips)", price: "700 € + 0,40 €/km" },
  { name: "VSL (aufwändiger Schnitt)", price: "600 €" },
  { name: "Reel Basic (Schnitt)", price: "50 €" },
  { name: "Reel Animation (hochwertig)", price: "100 €" },
  { name: "Longform-Editing bis 10 Min", price: "300 €" },
  { name: "Longform-Editing über 10 Min", price: "500 €" },
];

const FUNNEL = [
  { icon: Video, title: "Content", desc: "Täglich Reels die in deiner Nische viral gehen" },
  { icon: Users, title: "Reichweite", desc: "Follower die zu deiner Zielgruppe passen" },
  { icon: ShieldCheck, title: "Vertrauen", desc: "Sie sehen dich täglich — du wirst zur Autorität" },
  { icon: MessageSquare, title: "Anfragen", desc: "Interessenten melden sich von selbst" },
  { icon: Handshake, title: "Kunden", desc: "Aus Gesprächen werden Abschlüsse" },
];

const EXPECTATIONS = [
  { icon: Eye, value: "23.000", label: "Reichweite pro Testreel", sub: "Durchschnitt über alle Nischen" },
  { icon: TrendingUp, value: "12", label: "Follower pro Reel", sub: "Datengetriebene Testreel-Strategie" },
  { icon: Users, value: "360+", label: "Neue Follower pro Monat", sub: "Bei 30 Reels — planbar" },
];

const formatEUR = (n: number) => new Intl.NumberFormat("de-DE").format(n);

const Pricing = () => {
  const [annual, setAnnual] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [cplOpen, setCplOpen] = useState(false);
  const [adSpend, setAdSpend] = useState(30);
  const { role } = useAuth();
  const isAdmin = role === "admin";

  useEffect(() => {
    document.title = "Pakete & Preise — Marketlab Media";
    const id = "manrope-font";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap";
      document.head.appendChild(link);
    }
  }, []);

  return (
    <div
      className="min-h-screen w-full text-white"
      style={{ background: BRAND.bg, fontFamily: "'Manrope', system-ui, sans-serif" }}
    >
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(0,131,247,0.18) 0%, rgba(33,8,155,0.10) 35%, transparent 70%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-16 md:py-24">
        {/* PACKAGES — HERO HEADLINE */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <img
            src={logo}
            alt="Marketlab Media Logo"
            className="mb-6 h-10 w-auto object-contain"
          />
          <p
            className="mb-4 text-sm font-semibold uppercase tracking-[0.18em]"
            style={{ color: BRAND.blue }}
          >
            Social Media Wachstum als System
          </p>
          <h1 className="max-w-4xl text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
            Unsere Pakete —{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: `linear-gradient(90deg, ${BRAND.blue}, #7B5CFF)` }}
            >
              planbar, skalierbar, für organisches Wachstum.
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-white/60 md:text-xl">
            Mindestlaufzeit 3 Monate · 12-Monats-Laufzeit ={" "}
            <span className="font-semibold text-white">10 % Rabatt</span> ·
            Einmaliges Setup <span className="font-semibold text-white">2.000 €</span>
            <span className="text-white/40"> · Alle Preise sind Nettopreise.</span>
          </p>
        </motion.section>

        {/* PACKAGES — 5 COLUMN CARDS */}
        <section className="mt-12">
          <div className="flex items-center justify-end">
            <BillingToggle annual={annual} onChange={setAnnual} />
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {PLANS.map((p, i) => (
              <PlanCard key={p.key} plan={p} annual={annual} index={i} />
            ))}
          </div>
        </section>


        {/* QUICK FIX PRO — 3 MONTH SPRINT */}
        <section className="mt-20">
          <SectionHeader eyebrow="3-Monats-Sprint" title="Quick Fix Pro — Leads für die Kapitalanlage" />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5 }}
            className="mt-10 overflow-hidden rounded-2xl border p-8 md:p-10"
            style={{
              borderColor: `${BRAND.purple}66`,
              background: `linear-gradient(135deg, ${BRAND.purple}18, ${BRAND.blue}10)`,
              boxShadow: `0 20px 60px -25px ${BRAND.purple}77`,
            }}
          >
            <div className="grid grid-cols-1 gap-10 md:grid-cols-[1.2fr_1fr] md:items-start">
              <div>
                <div
                  className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white"
                  style={{ background: `linear-gradient(135deg, ${BRAND.purple}, ${BRAND.blue})` }}
                >
                  <Sparkles className="h-3 w-3" /> 3 Monate Laufzeit
                </div>
                <h3 className="text-2xl font-extrabold md:text-3xl">
                  Planbare Leads für 30–50 € in der Kapitalanlage
                </h3>
                <p className="mt-3 text-white/60">
                  Kompakter Sprint über 3 Monate: Strategie, Drehtag, Bearbeitung und
                  laufende Kampagnen­verwaltung — abgestimmt auf die Kapitalanlagen­branche.
                  Ziel: qualifizierte Leads zwischen 30 und 50 € Cost per Lead.
                </p>
                <ul className="mt-6 flex flex-col gap-2">
                  {[
                    "Strategie & Setup inkl. Landingpage (Zielgruppe, Funnel, Tracking)",
                    "1 Drehtag: 21 Videos",
                    "Optional: 21 Bild-Creatives",
                    "Komplette Bearbeitung aller Assets",
                    "Laufende Kampagnen­verwaltung & Optimierung",
                    "Monatliches Reporting mit CPL-Auswertung",
                  ].map((h) => (
                    <li key={h} className="flex items-start gap-2 text-sm text-white/85">
                      <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: BRAND.blue }} />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col gap-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/70">Strategie & Setup inkl. Landingpage</span>
                    <span className="text-base font-bold">3.000 €</span>
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/70">Drehtag (21 Videos)</span>
                    <span className="text-base font-bold">1.500 €</span>
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/70">Bearbeitung</span>
                    <span className="text-base font-bold">1.000 €</span>
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/70">Verwaltung (3× monatlich)</span>
                    <span className="text-base font-bold">1.000 € / Monat</span>
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/70">Optional: 21 Bild-Creatives</span>
                    <span className="text-base font-bold">50 € / Stück</span>
                  </div>
                </div>

                <button
                  onClick={() => setCplOpen(true)}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/[0.08]"
                >
                  <Calculator className="h-4 w-4" style={{ color: BRAND.blue }} />
                  CPL-Rechner: Was kostet ein Lead?
                </button>
                <div
                  className="rounded-xl p-5"
                  style={{ background: `linear-gradient(135deg, ${BRAND.blue}22, ${BRAND.purple}22)`, border: `1px solid ${BRAND.blue}44` }}
                >
                  <div className="text-xs uppercase tracking-wider text-white/60">Gesamt 3 Monate</div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold tracking-tight">8.500</span>
                    <span className="text-lg text-white/60">€</span>
                  </div>
                </div>
                <p className="text-[11px] text-white/40">
                  Werbebudget wird separat direkt an die Plattform gezahlt. 21 Bild-Creatives
                  optional zubuchbar (50 € pro Motiv).
                </p>

              </div>
            </div>
          </motion.div>
        </section>





        {/* ADD-ONS — DIRECTLY UNDER PACKAGES */}
        <section className="mt-20">
          <SectionHeader eyebrow="Add-Ons" title="Jederzeit zubuchbar" />
          <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ADDONS.map((a) => (
              <div
                key={a.name}
                className="rounded-xl border border-white/10 bg-white/[0.02] p-5 transition-colors hover:border-white/20"
              >
                <div className="text-sm text-white/70">{a.name}</div>
                <div className="mt-3 text-lg font-bold" style={{ color: BRAND.blue }}>
                  {a.price}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* COMPARISON TABLE */}
        <section className="mt-28">
          <SectionHeader eyebrow="Vergleich" title="Alles im Detail" />
          <ComparisonTable annual={annual} />
        </section>

        {/* FUNNEL */}
        <section className="mt-28">
          <SectionHeader eyebrow="Funnel" title="So entsteht aus Content ein Kunde" />
          <div className="mt-12 flex flex-col items-stretch gap-4 md:flex-row md:items-center">
            {FUNNEL.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="flex flex-1 items-center gap-4 md:flex-col md:gap-0">
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.08 }}
                    className="flex-1 rounded-xl border border-white/10 bg-white/[0.02] p-5"
                  >
                    <div
                      className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg"
                      style={{
                        background: `linear-gradient(135deg, ${BRAND.blue}33, ${BRAND.purple}33)`,
                        color: BRAND.blue,
                      }}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="text-base font-semibold">{step.title}</div>
                    <div className="mt-1 text-sm text-white/50">{step.desc}</div>
                  </motion.div>
                  {i < FUNNEL.length - 1 && (
                    <ArrowRight className="hidden h-5 w-5 shrink-0 text-white/30 md:block" />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* EXPECTATIONS */}
        <section className="mt-28">
          <SectionHeader eyebrow="Was zu erwarten ist" title="Realistische Benchmarks" />
          <p className="mt-3 max-w-2xl text-white/60">
            Durchschnittswerte aus unseren laufenden Accounts — keine Best-Cases,
            sondern das, womit du planen kannst.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
            {EXPECTATIONS.map((m, i) => {
              const Icon = m.icon;
              return (
                <motion.div
                  key={m.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.45, delay: i * 0.07 }}
                  className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-7"
                >
                  <div
                    className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{
                      background: `linear-gradient(135deg, ${BRAND.blue}33, ${BRAND.purple}33)`,
                      color: BRAND.blue,
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div
                    className="bg-clip-text text-5xl font-extrabold tracking-tight text-transparent md:text-6xl"
                    style={{ backgroundImage: `linear-gradient(180deg, #ffffff 0%, ${BRAND.blue} 130%)` }}
                  >
                    {m.value}
                  </div>
                  <div className="mt-4 text-base font-semibold">{m.label}</div>
                  <div className="mt-1 text-sm text-white/50">{m.sub}</div>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* CLOSING */}
        <section className="mt-32 mb-12 text-center">
          <p
            className="mx-auto max-w-3xl bg-clip-text text-2xl font-semibold text-transparent md:text-4xl"
            style={{ backgroundImage: `linear-gradient(90deg, #ffffff, ${BRAND.blue})` }}
          >
            Kein Werbebudget nötig. Kein Risiko. Nur ein System das funktioniert.
          </p>
        </section>
      </div>

      <AnimatePresence>
        {cplOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            style={{ background: "rgba(10,10,15,0.85)", backdropFilter: "blur(8px)" }}
            onClick={() => setCplOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: 0.25 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg overflow-hidden rounded-2xl border p-6 md:p-8"
              style={{
                borderColor: `${BRAND.blue}44`,
                background: `linear-gradient(135deg, ${BRAND.purple}20, ${BRAND.blue}12)`,
              }}
            >
              <div className="mb-6 flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-extrabold">Quick Fix Pro — CPL-Rechner</h3>
                  <p className="mt-1 text-sm text-white/55">
                    Geschätzte Leads & Gesamt-CPL bei deinem Werbebudget
                  </p>
                </div>
                <button
                  onClick={() => setCplOpen(false)}
                  className="rounded-full p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-white/70">Tägliches Werbebudget</span>
                  <span className="text-lg font-bold" style={{ color: BRAND.blue }}>
                    {adSpend} €
                  </span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={100}
                  step={5}
                  value={adSpend}
                  onChange={(e) => setAdSpend(Number(e.target.value))}
                  className="w-full accent-[#0083F7]"
                  style={{ accentColor: BRAND.blue }}
                />
                <div className="mt-1 flex justify-between text-[11px] text-white/40">
                  <span>20 € / Tag</span>
                  <span>100 € / Tag</span>
                </div>
              </div>

              <CplResults adSpend={adSpend} />

              <p className="mt-5 text-[11px] leading-relaxed text-white/40">
                Annahme: Cost per Lead zwischen 30 € und 50 €. Die 1.000 €/Monat Verwaltung
                und das einmalige Setup (4.500 €) sind im Gesamt-CPL eingerechnet.
                Werbebudget zahlst du direkt an die Plattform.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {isAdmin && (
        <>
          <button
            onClick={() => setConfigOpen(true)}
            className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white shadow-2xl transition-transform hover:scale-105"
            style={{ background: `linear-gradient(135deg, ${BRAND.blue}, ${BRAND.purple})`, boxShadow: `0 20px 40px -10px ${BRAND.blue}88` }}
          >
            <Wand2 className="h-4 w-4" /> Angebot konfigurieren
          </button>
          <OfferConfigurator
            open={configOpen}
            onClose={() => setConfigOpen(false)}
            plans={PLANS.map((p) => ({ key: p.key, name: p.name, price3: p.price3, price12: p.price12, setup: p.setup }))}
            addons={ADDONS}
          />
        </>
      )}
    </div>
  );
};

const CplResults = ({ adSpend }: { adSpend: number }) => {
  const monthlyAdSpend = adSpend * 30;
  const management = 1000;
  const setupTotal = 5500; // Strategie & Setup inkl. Landingpage 3.000 + Drehtag 1.500 + Bearbeitung 1.000
  const setupPerMonth = setupTotal / 3;
  const totalMonthly = monthlyAdSpend + management + setupPerMonth;
  const leadsAt30 = Math.round(monthlyAdSpend / 30);
  const leadsAt50 = Math.round(monthlyAdSpend / 50);
  const cplAt30 = leadsAt30 > 0 ? Math.round(totalMonthly / leadsAt30) : 0;
  const cplAt50 = leadsAt50 > 0 ? Math.round(totalMonthly / leadsAt50) : 0;

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
        <div className="text-[11px] uppercase tracking-wider text-white/50">Monatliches Budget</div>
        <div className="mt-1 text-2xl font-extrabold">{formatEUR(monthlyAdSpend)} €</div>
        <div className="text-[11px] text-white/40">Werbung + 1.000 € Verwaltung</div>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
        <div className="text-[11px] uppercase tracking-wider text-white/50">Gesamtkosten / Monat</div>
        <div className="mt-1 text-2xl font-extrabold">{formatEUR(totalMonthly)} €</div>
        <div className="text-[11px] text-white/40">Inkl. Verwaltung + Setup anteilig</div>
      </div>
      <div
        className="rounded-xl border p-4"
        style={{ borderColor: `${BRAND.blue}44`, background: `${BRAND.blue}10` }}
      >
        <div className="text-[11px] uppercase tracking-wider text-white/60">Bei 30 € CPL</div>
        <div className="mt-1 text-3xl font-extrabold" style={{ color: BRAND.blue }}>
          {leadsAt30}
        </div>
        <div className="text-[11px] text-white/60">Leads / Monat</div>
        <div className="mt-2 text-sm font-semibold">Gesamt-CPL ~{cplAt30} €</div>
      </div>
      <div
        className="rounded-xl border p-4"
        style={{ borderColor: `${BRAND.blue}44`, background: `${BRAND.blue}10` }}
      >
        <div className="text-[11px] uppercase tracking-wider text-white/60">Bei 50 € CPL</div>
        <div className="mt-1 text-3xl font-extrabold" style={{ color: BRAND.blue }}>
          {leadsAt50}
        </div>
        <div className="text-[11px] text-white/60">Leads / Monat</div>
        <div className="mt-2 text-sm font-semibold">Gesamt-CPL ~{cplAt50} €</div>
      </div>
    </div>
  );
};

const SectionHeader = ({ eyebrow, title }: { eyebrow: string; title: string }) => (
  <div>
    <div
      className="text-xs font-semibold uppercase tracking-[0.18em]"
      style={{ color: BRAND.blue }}
    >
      {eyebrow}
    </div>
    <h2 className="mt-2 text-3xl font-extrabold tracking-tight md:text-5xl">{title}</h2>
  </div>
);

const BillingToggle = ({
  annual,
  onChange,
}: {
  annual: boolean;
  onChange: (v: boolean) => void;
}) => (
  <div className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1">
    {[
      { label: "3 Monate", value: false },
      { label: "12 Monate · -10 %", value: true },
    ].map((opt) => {
      const active = annual === opt.value;
      return (
        <button
          key={opt.label}
          type="button"
          onClick={() => onChange(opt.value)}
          className="relative rounded-full px-5 py-2 text-sm font-semibold transition-colors"
          style={{
            color: active ? "#fff" : "rgba(255,255,255,0.55)",
            background: active
              ? `linear-gradient(135deg, ${BRAND.blue}, ${BRAND.purple})`
              : "transparent",
          }}
        >
          {opt.label}
        </button>
      );
    })}
  </div>
);

const PlanCard = ({ plan, annual, index }: { plan: Plan; annual: boolean; index: number }) => {
  const price = annual ? plan.price12 : plan.price3;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.45, delay: index * 0.06 }}
      className="group relative flex flex-col rounded-2xl border bg-white/[0.02] p-6 transition-all hover:-translate-y-1.5"
      style={{
        borderColor: plan.popular ? BRAND.blue : "rgba(255,255,255,0.1)",
        boxShadow: plan.popular ? `0 20px 60px -20px ${BRAND.blue}66` : undefined,
      }}
    >
      {plan.popular && (
        <div
          className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white"
          style={{ background: `linear-gradient(135deg, ${BRAND.blue}, ${BRAND.purple})` }}
        >
          <Sparkles className="h-3 w-3" /> Beliebt
        </div>
      )}

      <div className="text-lg font-bold">{plan.name}</div>
      <div className="mt-1 min-h-[34px] text-xs text-white/55">{plan.tagline}</div>

      <div className="mt-5 flex items-baseline gap-1">
        <span className="text-4xl font-extrabold tracking-tight">
          {formatEUR(price)}
          <span className="text-base text-white/50"> €</span>
        </span>
      </div>
      <div className="text-xs text-white/45">
        / Monat · {annual ? "12 Mon." : "3 Mon."}
      </div>
      <div className="mt-2 text-[11px] text-white/40">
        + {formatEUR(plan.setup)} € Setup einmalig
      </div>

      <div className="my-5 h-px w-full bg-white/10" />

      <ul className="flex flex-col gap-2">
        {plan.highlights.map((h) => (
          <li key={h} className="flex items-start gap-2 text-sm text-white/80">
            <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: BRAND.blue }} />
            <span>{h}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
};

const renderCell = (v: Cell) => {
  if (v === true)
    return <Check className="mx-auto h-5 w-5" style={{ color: BRAND.blue }} />;
  if (v === false)
    return <Minus className="mx-auto h-4 w-4 text-white/20" />;
  return <span className="text-sm text-white/85">{v}</span>;
};

const ComparisonTable = ({ annual }: { annual: boolean }) => {
  return (
    <div className="mt-10 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
      <table className="w-full min-w-[860px] border-collapse">
        <thead>
          <tr className="border-b border-white/10">
            <th className="sticky left-0 z-10 w-[280px] bg-[#0a0a0f] p-5 text-left align-bottom" />
            {PLANS.map((p) => (
              <th
                key={p.key}
                className="p-5 text-center align-bottom"
                style={{
                  background: p.popular
                    ? `linear-gradient(180deg, ${BRAND.blue}14, transparent)`
                    : undefined,
                }}
              >
                <div className="flex flex-col items-center gap-1">
                  {p.popular && (
                    <span
                      className="mb-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
                      style={{
                        background: `linear-gradient(135deg, ${BRAND.blue}, ${BRAND.purple})`,
                      }}
                    >
                      <Sparkles className="h-2.5 w-2.5" /> Beliebt
                    </span>
                  )}
                  <div className="text-base font-bold">{p.name}</div>
                  <div className="text-xs text-white/45">
                    {formatEUR(annual ? p.price12 : p.price3)} € / Mon.
                  </div>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARISON.map((section) => (
            <>
              <tr key={`${section.title}-h`}>
                <td
                  colSpan={PLANS.length + 1}
                  className="border-t border-white/10 bg-white/[0.03] px-5 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-white/55"
                >
                  {section.title}
                </td>
              </tr>
              {section.rows.map((row, i) => (
                <tr
                  key={`${section.title}-${row.label}`}
                  className="border-t border-white/5 transition-colors hover:bg-white/[0.02]"
                >
                  <td className="sticky left-0 z-10 bg-[#0a0a0f] px-5 py-4 text-sm text-white/75">
                    {row.label}
                  </td>
                  {row.values.map((v, idx) => (
                    <td
                      key={idx}
                      className="px-5 py-4 text-center"
                      style={{
                        background: PLANS[idx]?.popular
                          ? "rgba(0,131,247,0.04)"
                          : undefined,
                      }}
                    >
                      {renderCell(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Pricing;
