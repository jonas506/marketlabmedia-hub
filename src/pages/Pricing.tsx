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
  Megaphone,
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
  gold: "#F5B93B",
  goldDeep: "#C98A12",
};


type Plan = {
  key: string;
  name: string;
  tagline: string;
  monthly: number;
  highlights: string[];
  popular?: boolean;
  note?: string;
};

type Cell = string | number | boolean;
type Row = { label: string; values: Cell[] };
type TableSection = { title: string; rows: Row[] };

/* =========================================================================
   ZENTRALE KONFIGURATION — hier alle Preise & Paketinhalte pflegen
   ========================================================================= */
const PRICING = {
  hero: {
    eyebrow: "Social Media Wachstum als System",
    titleLead: "Unsere Pakete —",
    titleAccent: "planbar, skalierbar, für organisches Wachstum.",
    subline:
      "Mindestlaufzeit 6 Monate · Setup entfällt beim Start über den Testmonat · Alle Preise netto",
  },

  plans: [
    {
      key: "stufe_1",
      name: "Stufe 1",
      tagline: "Reichweite und erste Anfragen",
      monthly: 2000,
      highlights: [
        "30 Testreels pro Monat",
        "ManyChat-Automation",
        "Freebie zur Lead-Erfassung",
        "Posting, Captions und Reporting",
      ],
    },
    {
      key: "stufe_2",
      name: "Stufe 2",
      tagline: "Aus Reichweite werden Gespräche",
      monthly: 3000,
      popular: true,
      highlights: [
        "Alles aus Stufe 1",
        "4 Carousels pro Monat",
        "Wöchentliche Story-Sequenz",
      ],
    },
    {
      key: "stufe_3",
      name: "Stufe 3",
      tagline: "Dein Gesicht im Content",
      monthly: 4000,
      highlights: [
        "Alles aus Stufe 2",
        "20 zusätzliche Reels aus deinem Material",
        "Anleitung zur Aufnahme mit dem Smartphone",
      ],
    },
    {
      key: "stufe_4",
      name: "Stufe 4",
      tagline: "Wir drehen, du gibst frei",
      monthly: 5000,
      highlights: [
        "Alles aus Stufe 3",
        "Ein Drehtag pro Monat bei dir vor Ort",
        "Equipment, Regie und B-Roll inklusive",
      ],
      note: "Drehtage im Umkreis von 2 Stunden inklusive, darüber Zonenzuschlag. Begrenzte Verfügbarkeit.",
    },
  ] as Plan[],

  ads: {
    eyebrow: "Werbeanzeigen",
    title: "Werbeanzeigen — separat zubuchbar",
    text:
      "Ads verstärken ein System, das schon läuft. Deshalb buchbar ab Stufe 1, wenn der Lead-Mechanismus steht.",
    items: [
      { label: "Funnel-Setup einmalig", value: "2.500 €" },
      { label: "Laufende Kampagnensteuerung", value: "2.500 € / Monat" },
      { label: "Mindestlaufzeit", value: "3 Monate" },
      { label: "Werbebudget", value: "ab 1.500 € / Monat, direkt an die Plattform" },
    ],
    note:
      "Ab 3.000 € monatlichem Werbebudget +600 €, ab 7.000 € +1.200 € Steuerungsaufwand.",
  },

  comparison: [
    {
      title: "Content",
      rows: [
        { label: "Testreels pro Monat", values: [30, 30, 30, 30] },
        { label: "Carousels pro Monat", values: ["—", 4, 4, 4] },
        { label: "Story-Sequenz wöchentlich", values: [false, true, true, true] },
        { label: "Zusätzliche Reels", values: ["—", "—", 20, 20] },
        { label: "Material kommt von", values: ["—", "—", "dir", "uns"] },
      ],
    },
    {
      title: "Lead-Mechanik",
      rows: [
        { label: "ManyChat-Automation", values: [true, true, true, true] },
        { label: "Freebie", values: [true, true, true, true] },
        { label: "Reporting-Dashboard", values: [true, true, true, true] },
      ],
    },
    {
      title: "Distribution",
      rows: [
        { label: "Posting und Veröffentlichung", values: [true, true, true, true] },
        { label: "Captions inklusive CTA", values: [true, true, true, true] },
        { label: "Hashtag- und SEO-Optimierung", values: [true, true, true, true] },
      ],
    },
    {
      title: "Drehtag",
      rows: [
        { label: "Drehtage pro Monat", values: ["—", "—", "—", 1] },
        { label: "Equipment (Kamera, Licht, Ton)", values: [false, false, false, true] },
        { label: "Regie und Hook-Coaching am Set", values: [false, false, false, true] },
        { label: "B-Roll und Cutaway-Material", values: [false, false, false, true] },
      ],
    },
    {
      title: "Strategie",
      rows: [
        { label: "Datengetriebene Content-Strategie", values: [true, true, true, true] },
        { label: "Monatliche Performance-Analyse", values: [true, true, true, true] },
        { label: "Hook- und Format-Testing", values: [true, true, true, true] },
        { label: "Zugang zur Academy", values: [true, true, true, true] },
        { label: "Eigener Ansprechpartner", values: [true, true, true, true] },
      ],
    },
    {
      title: "Kommerziell",
      rows: [
        { label: "Mindestlaufzeit", values: ["6 Monate", "6 Monate", "6 Monate", "6 Monate"] },
        {
          label: "Setup einmalig",
          values: [
            "entfällt mit Testmonat",
            "entfällt mit Testmonat",
            "entfällt mit Testmonat",
            "entfällt mit Testmonat",
          ],
        },
      ],
    },
  ] as TableSection[],

  addons: [
    { name: "Exposé-Bilder (pro Wohnung / Haus)", price: "150 € + Anfahrt" },
    { name: "Drehtag on top (ohne Editing)", price: "1.500 €" },
    { name: "Halbtag (ohne Editing)", price: "800 €" },
    { name: "Testimonial (inkl. 2–3 Clips)", price: "700 € + 0,40 €/km" },
    { name: "VSL (aufwändiger Schnitt)", price: "600 €" },
    { name: "Reel Basic (Schnitt)", price: "50 €" },
    { name: "Reel Animation (hochwertig)", price: "100 €" },
    { name: "Longform-Editing bis 10 Min", price: "300 €" },
    { name: "Longform-Editing über 10 Min", price: "500 €" },
  ],

  funnel: [
    { icon: Video, title: "Content", desc: "Täglich ein Reel, das Nicht-Follower erreicht" },
    { icon: Users, title: "Reichweite", desc: "Follower die zu deiner Zielgruppe passen" },
    { icon: ShieldCheck, title: "Vertrauen", desc: "Sie sehen dich täglich — du wirst zur Autorität" },
    { icon: MessageSquare, title: "Anfragen", desc: "Interessenten melden sich von selbst" },
    { icon: Handshake, title: "Kunden", desc: "Aus Gesprächen werden Abschlüsse" },
  ],

  trial: {
    bannerText: "Erst testen: 30 Tage, 2.000 € — Setup inklusive",
    bannerCta: "Testmonat ansehen",
    cardLink: "Setup entfällt beim Start über den Testmonat",
    title: "Testmonat",
    subtitle: "30 Tage · 2.000 € netto · einmalig, keine Laufzeit",
    intro:
      "Du entscheidest nicht über sechs Monate, sondern über dreißig Tage. In dieser Zeit steht das komplette System — danach siehst du an echten Zahlen, ob es für dich funktioniert.",
    build: {
      title: "Was wir aufbauen",
      items: [
        "Research zu Zielgruppe, Wettbewerb und Themen",
        "Positionierung und Content-Strategie",
        "Instagram-Profil komplett aufgesetzt",
        "ManyChat-Automation eingerichtet",
        "Freebie aus unserer Vorlage, auf dich angepasst",
        "30 Testreels im Overlay-Format mit Freebie-CTA",
        "Reporting am Ende der 30 Tage",
      ],
    },
    yours: {
      title: "Was du beisteuerst",
      items: [
        "Ein Strategie-Gespräch, etwa eine Stunde",
        "Fachliche Freigabe der Posts, ein Klick pro Beitrag",
      ],
    },
    after: {
      title: "Was danach passiert",
      text:
        "Nach dreißig Tagen entscheidest du, ob es weiterläuft. Wenn ja, geht es ohne Setup-Kosten in Stufe 1 über — zum gleichen Monatspreis. Wenn nicht, ist es beendet und alles Aufgebaute bleibt bei dir.",
    },
    highlight:
      "Der Direkteinstieg in einen Retainer kostet 2.000 € Setup. Über den Testmonat entfällt das — du bekommst denselben Aufbau plus 30 Reels zum gleichen Preis.",
    availability: {
      title: "Aktuelle Verfügbarkeit",
      text: "Wir starten maximal zwei Testmonate gleichzeitig, damit die Qualität stimmt.",
    },
    cta: "Testmonat anfragen",
  },

  closing: "Kein Werbebudget nötig. Kein Risiko. Nur ein System das funktioniert.",

};

const formatEUR = (n: number) => new Intl.NumberFormat("de-DE").format(n);

const Pricing = () => {
  const [configOpen, setConfigOpen] = useState(false);
  const [trialOpen, setTrialOpen] = useState(false);

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
        {/* HERO */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <img src={logo} alt="Marketlab Media Logo" className="mb-6 h-10 w-auto object-contain" />
          <p
            className="mb-4 text-sm font-semibold uppercase tracking-[0.18em]"
            style={{ color: BRAND.blue }}
          >
            {PRICING.hero.eyebrow}
          </p>
          <h1 className="max-w-4xl text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
            {PRICING.hero.titleLead}{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: `linear-gradient(90deg, ${BRAND.blue}, #7B5CFF)` }}
            >
              {PRICING.hero.titleAccent}
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-white/60 md:text-xl">
            {PRICING.hero.subline}
          </p>
        </motion.section>

        {/* TESTMONAT BANNER */}
        <motion.button
          type="button"
          onClick={() => setTrialOpen(true)}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mt-10 flex w-full flex-col items-start gap-4 rounded-2xl border p-5 text-left transition-all hover:-translate-y-0.5 sm:flex-row sm:items-center sm:justify-between"
          style={{
            borderColor: `${BRAND.gold}66`,
            background: `linear-gradient(120deg, ${BRAND.gold}1f, ${BRAND.goldDeep}0f)`,
            boxShadow: `0 18px 40px -22px ${BRAND.gold}99`,
          }}
        >
          <span className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 shrink-0" style={{ color: BRAND.gold }} />
            <span className="text-base font-bold md:text-lg" style={{ color: BRAND.gold }}>
              {PRICING.trial.bannerText}
            </span>
          </span>
          <span
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold"
            style={{ background: BRAND.gold, color: "#1a1200" }}
          >
            {PRICING.trial.bannerCta} <ArrowRight className="h-4 w-4" />
          </span>
        </motion.button>

        {/* PLAN CARDS */}
        <section className="mt-12">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {PRICING.plans.map((p, i) => (
              <PlanCard key={p.key} plan={p} index={i} onTrial={() => setTrialOpen(true)} />

            ))}
          </div>
        </section>

        {/* WERBEANZEIGEN */}
        <section className="mt-20">
          <SectionHeader eyebrow={PRICING.ads.eyebrow} title={PRICING.ads.title} />
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
            <div className="grid grid-cols-1 gap-10 md:grid-cols-[1.1fr_1fr] md:items-start">
              <div>
                <div
                  className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white"
                  style={{ background: `linear-gradient(135deg, ${BRAND.purple}, ${BRAND.blue})` }}
                >
                  <Megaphone className="h-3 w-3" /> Separat zubuchbar
                </div>
                <p className="max-w-xl text-white/70">{PRICING.ads.text}</p>
                <p className="mt-6 text-[11px] leading-relaxed text-white/40">
                  {PRICING.ads.note}
                </p>
              </div>

              <div className="flex flex-col gap-3">
                {PRICING.ads.items.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-white/70">{item.label}</span>
                      <span className="text-right text-base font-bold">{item.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </section>

        {/* ADD-ONS */}
        <section className="mt-20">
          <SectionHeader eyebrow="Add-Ons" title="Jederzeit zubuchbar" />
          <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PRICING.addons.map((a) => (
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
          <ComparisonTable />
        </section>

        {/* FUNNEL */}
        <section className="mt-28">
          <SectionHeader eyebrow="Funnel" title="So entsteht aus Content ein Kunde" />
          <div className="mt-12 flex flex-col items-stretch gap-4 md:flex-row md:items-center">
            {PRICING.funnel.map((step, i) => {
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
                  {i < PRICING.funnel.length - 1 && (
                    <ArrowRight className="hidden h-5 w-5 shrink-0 text-white/30 md:block" />
                  )}
                </div>
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
            {PRICING.closing}
          </p>
        </section>
      </div>

      <TrialModal
        open={trialOpen}
        onClose={() => setTrialOpen(false)}
        onCta={() => {
          setTrialOpen(false);
          setConfigOpen(true);
        }}
      />


      {isAdmin && (
        <>
          <button
            onClick={() => setConfigOpen(true)}
            className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white shadow-2xl transition-transform hover:scale-105"
            style={{
              background: `linear-gradient(135deg, ${BRAND.blue}, ${BRAND.purple})`,
              boxShadow: `0 20px 40px -10px ${BRAND.blue}88`,
            }}
          >
            <Wand2 className="h-4 w-4" /> Angebot konfigurieren
          </button>
          <OfferConfigurator
            open={configOpen}
            onClose={() => setConfigOpen(false)}
            plans={PRICING.plans.map((p) => ({
              key: p.key,
              name: p.name,
              price3: p.monthly,
              price12: p.monthly,
              setup: 0,
            }))}
            addons={PRICING.addons}
          />
        </>
      )}
    </div>
  );
};

const TrialModal = ({
  open,
  onClose,
  onCta,
}: {
  open: boolean;
  onClose: () => void;
  onCta: () => void;
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const t = PRICING.trial;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-0 sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{ background: "rgba(4,4,10,0.78)", backdropFilter: "blur(6px)" }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t.title}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl border p-6 text-white sm:rounded-2xl md:p-8"
            style={{
              background: `linear-gradient(180deg, ${BRAND.gold}12, rgba(10,10,15,0.98) 30%)`,
              borderColor: `${BRAND.gold}55`,
              fontFamily: "'Manrope', system-ui, sans-serif",
              boxShadow: `0 40px 80px -30px ${BRAND.goldDeep}aa`,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Schließen"
              className="absolute right-4 top-4 rounded-full p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" style={{ color: BRAND.gold }} />
              <h2 className="text-2xl font-extrabold tracking-tight md:text-3xl">{t.title}</h2>
            </div>
            <p className="mt-1 text-sm font-semibold" style={{ color: BRAND.gold }}>
              {t.subtitle}
            </p>
            <p className="mt-4 text-sm leading-relaxed text-white/70">{t.intro}</p>

            <TrialList title={t.build.title} items={t.build.items} />
            <TrialList title={t.yours.title} items={t.yours.items} />

            <div className="mt-6">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                {t.after.title}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-white/70">{t.after.text}</p>
            </div>

            <div
              className="mt-6 rounded-xl border p-4 text-sm leading-relaxed"
              style={{
                borderColor: `${BRAND.gold}55`,
                background: `${BRAND.gold}14`,
                color: "#FBE3AE",
              }}
            >
              {t.highlight}
            </div>

            <div className="mt-6">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                {t.availability.title}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-white/70">{t.availability.text}</p>
            </div>

            <button
              type="button"
              onClick={onCta}
              className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold transition-transform hover:scale-[1.01]"
              style={{
                background: `linear-gradient(135deg, ${BRAND.gold}, ${BRAND.goldDeep})`,
                color: "#1a1200",
                boxShadow: `0 20px 40px -18px ${BRAND.gold}aa`,
              }}
            >
              {t.cta} <ArrowRight className="h-4 w-4" />
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const TrialList = ({ title, items }: { title: string; items: string[] }) => (
  <div className="mt-6">
    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">{title}</div>
    <ul className="mt-3 flex flex-col gap-2">
      {items.map((i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-white/80">
          <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: BRAND.gold }} />
          <span>{i}</span>
        </li>
      ))}
    </ul>
  </div>
);


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

const PlanCard = ({
  plan,
  index,
  onTrial,
}: {
  plan: Plan;
  index: number;
  onTrial?: () => void;
}) => (

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
        {formatEUR(plan.monthly)}
        <span className="text-base text-white/50"> €</span>
      </span>
    </div>
    <div className="text-xs text-white/45">/ Monat</div>

    {onTrial && (
      <button
        type="button"
        onClick={onTrial}
        className="mt-3 inline-flex items-center gap-1.5 self-start rounded-lg px-2 py-1 text-left text-[11px] font-semibold underline-offset-2 transition-colors hover:underline"
        style={{ color: BRAND.gold, background: `${BRAND.gold}14` }}
      >
        <Sparkles className="h-3 w-3 shrink-0" />
        {PRICING.trial.cardLink}
      </button>
    )}


    <div className="my-5 h-px w-full bg-white/10" />

    <ul className="flex flex-col gap-2">
      {plan.highlights.map((h) => (
        <li key={h} className="flex items-start gap-2 text-sm text-white/80">
          <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: BRAND.blue }} />
          <span>{h}</span>
        </li>
      ))}
    </ul>

    {plan.note && (
      <p className="mt-4 text-[11px] leading-relaxed text-white/40">{plan.note}</p>
    )}
  </motion.div>
);

const renderCell = (v: Cell) => {
  if (v === true) return <Check className="mx-auto h-5 w-5" style={{ color: BRAND.blue }} />;
  if (v === false) return <Minus className="mx-auto h-4 w-4 text-white/20" />;
  return <span className="text-sm text-white/85">{v}</span>;
};

const ComparisonTable = () => (
  <div className="mt-10 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
    <table className="w-full min-w-[860px] border-collapse">
      <thead>
        <tr className="border-b border-white/10">
          <th className="sticky left-0 z-10 w-[280px] bg-[#0a0a0f] p-5 text-left align-bottom" />
          {PRICING.plans.map((p) => (
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
                    style={{ background: `linear-gradient(135deg, ${BRAND.blue}, ${BRAND.purple})` }}
                  >
                    <Sparkles className="h-2.5 w-2.5" /> Beliebt
                  </span>
                )}
                <div className="text-base font-bold">{p.name}</div>
                <div className="text-xs text-white/45">{formatEUR(p.monthly)} € / Mon.</div>
              </div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {PRICING.comparison.map((section) => (
          <>
            <tr key={`${section.title}-h`}>
              <td
                colSpan={PRICING.plans.length + 1}
                className="border-t border-white/10 bg-white/[0.03] px-5 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-white/55"
              >
                {section.title}
              </td>
            </tr>
            {section.rows.map((row) => (
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
                      background: PRICING.plans[idx]?.popular ? "rgba(0,131,247,0.04)" : undefined,
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

export default Pricing;
