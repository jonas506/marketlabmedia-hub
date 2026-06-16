import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Video,
  Users,
  ShieldCheck,
  MessageSquare,
  Handshake,
  ArrowRight,
  Check,
  Sparkles,
} from "lucide-react";

const BRAND = {
  blue: "#0083F7",
  purple: "#21089B",
  ink: "#1E1E24",
  bg: "#0a0a0f",
};

type Plan = {
  name: string;
  highlight: string;
  price3: number;
  price12: number;
  features: string[];
  popular?: boolean;
};

const PLANS: Plan[] = [
  {
    name: "Basic Lite",
    highlight: "~180 neue Follower / Monat",
    price3: 1500,
    price12: 1350,
    features: [
      "15 Testreels pro Monat",
      "Posting & Veröffentlichung",
      "Datengetriebene Content-Strategie",
    ],
  },
  {
    name: "Basic",
    highlight: "~360 neue Follower / Monat",
    price3: 2500,
    price12: 2250,
    features: [
      "30 Testreels pro Monat",
      "Posting & Veröffentlichung",
      "Datengetriebene Content-Strategie",
    ],
  },
  {
    name: "Standard",
    highlight: "~360 Follower / Monat + mehr Engagement",
    price3: 3500,
    price12: 3150,
    popular: true,
    features: [
      "30 Testreels pro Monat",
      "10 Carousels pro Monat",
      "Storys",
      "Posting & Veröffentlichung",
    ],
  },
  {
    name: "Plus",
    highlight: "Reichweite + professioneller Video-Content",
    price3: 4500,
    price12: 4050,
    features: [
      "30 Testreels pro Monat",
      "20 Reels inkl. Drehtag",
      "10 Carousels pro Monat",
      "Storys",
      "Posting & Veröffentlichung",
    ],
  },
  {
    name: "Elite",
    highlight: "Maximale Reichweite + bezahlte Verstärkung",
    price3: 6500,
    price12: 5850,
    features: [
      "30 Testreels pro Monat",
      "20 Reels inkl. Drehtag",
      "10 Carousels pro Monat",
      "Storys",
      "Posting & Veröffentlichung",
      "Ads schalten & verwalten",
    ],
  },
];

const ADDONS = [
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

const formatEUR = (n: number) =>
  new Intl.NumberFormat("de-DE").format(n);

const Pricing = () => {
  const [annual, setAnnual] = useState(false);

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
      style={{
        background: BRAND.bg,
        fontFamily: "'Manrope', system-ui, sans-serif",
      }}
    >
      {/* glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(0,131,247,0.18) 0%, rgba(33,8,155,0.10) 35%, transparent 70%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-20 md:py-28">
        {/* Logo / Wordmark */}
        <div className="mb-16 flex items-center gap-2 text-sm font-semibold tracking-wide">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: BRAND.blue }}
          />
          <span className="text-white/80">marketlab media</span>
        </div>

        {/* HERO */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl"
        >
          <p
            className="mb-4 text-sm font-semibold uppercase tracking-[0.18em]"
            style={{ color: BRAND.blue }}
          >
            Social Media Wachstum als System
          </p>
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
            Was du bekommst:{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(90deg, ${BRAND.blue}, #7B5CFF)`,
              }}
            >
              Reichweite, Vertrauen, qualifizierte Termine.
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-white/60 md:text-xl">
            Wir bauen dir eine Content-Maschine die planbar Follower aufbaut —
            und daraus echte Kundenanfragen macht. Organisch, ohne Werbebudget.
          </p>
        </motion.section>

        {/* OUTPUT */}
        <section className="mt-28">
          <SectionHeader eyebrow="Output" title="Das Ergebnis" />
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              {
                value: "12",
                label: "Follower pro Reel",
                sub: "Im Schnitt — datengetriebene Testreel-Strategie",
              },
              {
                value: "360+",
                label: "Neue Follower pro Monat",
                sub: "Bei 30 Reels — kontinuierlich, planbar",
              },
              {
                value: "1 Kunde",
                label: "pro 1.000 Follower",
                sub: "Aus aufgebauter Reichweite werden Anfragen",
              },
            ].map((m, i) => (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-8 backdrop-blur-sm transition-all hover:-translate-y-1 hover:border-white/20"
              >
                <div
                  aria-hidden
                  className="absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-20 blur-3xl transition-opacity group-hover:opacity-40"
                  style={{
                    background: `linear-gradient(135deg, ${BRAND.blue}, ${BRAND.purple})`,
                  }}
                />
                <div
                  className="relative bg-clip-text text-7xl font-extrabold leading-none tracking-tight text-transparent md:text-8xl"
                  style={{
                    backgroundImage: `linear-gradient(180deg, #ffffff 0%, ${BRAND.blue} 120%)`,
                  }}
                >
                  {m.value}
                </div>
                <div className="relative mt-6 text-base font-semibold text-white">
                  {m.label}
                </div>
                <div className="relative mt-2 text-sm text-white/50">
                  {m.sub}
                </div>
              </motion.div>
            ))}
          </div>
          <p className="mx-auto mt-10 max-w-2xl text-center text-white/60">
            Je mehr hochwertigen Content wir produzieren, desto mehr Reichweite
            baust du auf — und desto mehr qualifizierte Anfragen entstehen.
            Das ist kein Zufall, das ist ein System.
          </p>
        </section>

        {/* FUNNEL */}
        <section className="mt-32">
          <SectionHeader
            eyebrow="Funnel"
            title="So entsteht aus Content ein Kunde"
          />
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
                    <ArrowRight
                      className="hidden h-5 w-5 shrink-0 text-white/30 md:block"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* PACKAGES */}
        <section className="mt-32">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
            <div>
              <SectionHeader eyebrow="Pakete" title="Pakete" />
              <p className="mt-3 text-white/60">
                Mindestlaufzeit 3 Monate. 12-Monats-Laufzeit ={" "}
                <span className="font-semibold text-white">10 % Rabatt</span>.
              </p>
            </div>
            <BillingToggle annual={annual} onChange={setAnnual} />
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-5">
            {PLANS.map((p, i) => (
              <PlanCard key={p.name} plan={p} annual={annual} index={i} />
            ))}
          </div>
        </section>

        {/* ADDONS */}
        <section className="mt-32">
          <SectionHeader
            eyebrow="Add-Ons"
            title="Add-Ons — jederzeit zubuchbar"
          />
          <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ADDONS.map((a) => (
              <div
                key={a.name}
                className="rounded-xl border border-white/10 bg-white/[0.02] p-5 transition-colors hover:border-white/20"
              >
                <div className="text-sm text-white/70">{a.name}</div>
                <div
                  className="mt-3 text-lg font-bold"
                  style={{ color: BRAND.blue }}
                >
                  {a.price}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CLOSING */}
        <section className="mt-32 mb-12 text-center">
          <p
            className="mx-auto max-w-3xl bg-clip-text text-2xl font-semibold text-transparent md:text-4xl"
            style={{
              backgroundImage: `linear-gradient(90deg, #ffffff, ${BRAND.blue})`,
            }}
          >
            Kein Werbebudget nötig. Kein Risiko. Nur ein System das funktioniert.
          </p>
        </section>
      </div>
    </div>
  );
};

const SectionHeader = ({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) => (
  <div>
    <div
      className="text-xs font-semibold uppercase tracking-[0.18em]"
      style={{ color: BRAND.blue }}
    >
      {eyebrow}
    </div>
    <h2 className="mt-2 text-3xl font-extrabold tracking-tight md:text-5xl">
      {title}
    </h2>
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

const PlanCard = ({
  plan,
  annual,
  index,
}: {
  plan: Plan;
  annual: boolean;
  index: number;
}) => {
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
        boxShadow: plan.popular
          ? `0 20px 60px -20px ${BRAND.blue}66`
          : undefined,
      }}
    >
      {plan.popular && (
        <div
          className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white"
          style={{
            background: `linear-gradient(135deg, ${BRAND.blue}, ${BRAND.purple})`,
          }}
        >
          <Sparkles className="h-3 w-3" /> Beliebt
        </div>
      )}

      <div className="text-base font-bold">{plan.name}</div>
      <div className="mt-1 min-h-[36px] text-xs text-white/55">
        {plan.highlight}
      </div>

      <div className="mt-6 flex items-baseline gap-1">
        <span className="text-4xl font-extrabold tracking-tight">
          {formatEUR(price)}
          <span className="text-base text-white/50"> €</span>
        </span>
      </div>
      <div className="text-xs text-white/45">
        / Monat · {annual ? "12 Mon. Laufzeit" : "3 Mon. Laufzeit"}
      </div>

      <div className="my-6 h-px w-full bg-white/10" />

      <ul className="flex flex-col gap-3">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-white/75">
            <Check
              className="mt-0.5 h-4 w-4 shrink-0"
              style={{ color: BRAND.blue }}
            />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
};

export default Pricing;
