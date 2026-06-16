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
  Eye,
  TrendingUp,
} from "lucide-react";

const BRAND = {
  blue: "#0083F7",
  purple: "#21089B",
  ink: "#1E1E24",
  bg: "#0a0a0f",
};

type FeatureGroup = {
  title: string;
  items: string[];
};

type Plan = {
  name: string;
  tagline: string;
  highlight: string;
  price3: number;
  price12: number;
  setup: number;
  groups: FeatureGroup[];
  popular?: boolean;
};

const STRATEGY_BLOCK: FeatureGroup = {
  title: "Strategie & Steuerung",
  items: [
    "Datengetriebene Content-Strategie",
    "Monatliche Performance-Analyse",
    "Hook- & Format-Testing",
    "Eigener Ansprechpartner",
  ],
};

const POSTING_BLOCK: FeatureGroup = {
  title: "Posting & Distribution",
  items: [
    "Posting & Veröffentlichung",
    "Caption-Texting inkl. CTA",
    "Hashtag- & SEO-Optimierung",
    "Reporting-Dashboard",
  ],
};

const PLANS: Plan[] = [
  {
    name: "Basic Lite",
    tagline: "Einstieg in den organischen Aufbau",
    highlight: "~180 neue Follower / Monat",
    price3: 1500,
    price12: 1350,
    setup: 2000,
    groups: [
      {
        title: "Content-Produktion",
        items: [
          "15 Testreels pro Monat",
          "Hochwertiger Schnitt & Sounddesign",
          "Untertitel & On-Screen-Text",
        ],
      },
      POSTING_BLOCK,
      STRATEGY_BLOCK,
    ],
  },
  {
    name: "Basic",
    tagline: "Volle Frequenz für planbares Wachstum",
    highlight: "~360 neue Follower / Monat",
    price3: 2500,
    price12: 2250,
    setup: 2000,
    groups: [
      {
        title: "Content-Produktion",
        items: [
          "30 Testreels pro Monat",
          "Hochwertiger Schnitt & Sounddesign",
          "Untertitel & On-Screen-Text",
          "Cover-Design für jedes Reel",
        ],
      },
      POSTING_BLOCK,
      STRATEGY_BLOCK,
    ],
  },
  {
    name: "Standard",
    tagline: "Multi-Format für mehr Engagement",
    highlight: "~360 Follower / Monat + mehr Engagement",
    price3: 3500,
    price12: 3150,
    setup: 2000,
    popular: true,
    groups: [
      {
        title: "Content-Produktion",
        items: [
          "30 Testreels pro Monat",
          "10 Carousels pro Monat (Edu/Hook)",
          "Story-Sequenzen für Reichweiten-Push",
          "Cover-Design & On-Screen-Text",
        ],
      },
      POSTING_BLOCK,
      STRATEGY_BLOCK,
    ],
  },
  {
    name: "Plus",
    tagline: "Reichweite + professioneller Drehtag-Content",
    highlight: "Reichweite + professioneller Video-Content",
    price3: 4500,
    price12: 4050,
    setup: 2000,
    groups: [
      {
        title: "Content-Produktion",
        items: [
          "30 Testreels pro Monat",
          "20 Reels inkl. Drehtag (Kamera, Licht, Ton)",
          "10 Carousels pro Monat",
          "Story-Sequenzen",
        ],
      },
      {
        title: "Drehtag-Setup",
        items: [
          "1 Drehtag pro Monat inkl. Equipment",
          "Regie & Hook-Coaching am Set",
          "B-Roll & Cutaway-Material",
        ],
      },
      POSTING_BLOCK,
      STRATEGY_BLOCK,
    ],
  },
  {
    name: "Elite",
    tagline: "Maximale Reichweite + bezahlte Verstärkung",
    highlight: "Maximale Reichweite + bezahlte Verstärkung",
    price3: 6500,
    price12: 5850,
    setup: 2000,
    groups: [
      {
        title: "Content-Produktion",
        items: [
          "30 Testreels pro Monat",
          "20 Reels inkl. Drehtag (Kamera, Licht, Ton)",
          "10 Carousels pro Monat",
          "Story-Sequenzen",
        ],
      },
      {
        title: "Drehtag-Setup",
        items: [
          "1 Drehtag pro Monat inkl. Equipment",
          "Regie & Hook-Coaching am Set",
          "B-Roll & Cutaway-Material",
        ],
      },
      {
        title: "Paid Ads",
        items: [
          "Ads schalten & laufend optimieren",
          "Creative-Testing der Top-Reels",
          "Audience- & Retargeting-Setup",
        ],
      },
      POSTING_BLOCK,
      STRATEGY_BLOCK,
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

const EXPECTATIONS = [
  {
    icon: Eye,
    value: "23.000",
    label: "Reichweite pro Testreel",
    sub: "Durchschnittlicher Impressions-Wert über alle Nischen",
  },
  {
    icon: TrendingUp,
    value: "12",
    label: "Follower pro Reel",
    sub: "Im Schnitt — datengetriebene Testreel-Strategie",
  },
  {
    icon: Users,
    value: "360+",
    label: "Neue Follower pro Monat",
    sub: "Bei 30 Reels — kontinuierlich, planbar",
  },
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
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(0,131,247,0.18) 0%, rgba(33,8,155,0.10) 35%, transparent 70%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-20 md:py-28">
        <div className="mb-16 flex items-center gap-2 text-sm font-semibold tracking-wide">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: BRAND.blue }} />
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
                    style={{
                      backgroundImage: `linear-gradient(180deg, #ffffff 0%, ${BRAND.blue} 130%)`,
                    }}
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

        {/* PACKAGES */}
        <section className="mt-32">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
            <div>
              <SectionHeader eyebrow="Pakete" title="Pakete" />
              <p className="mt-3 text-white/60">
                Mindestlaufzeit 3 Monate. 12-Monats-Laufzeit ={" "}
                <span className="font-semibold text-white">10 % Rabatt</span>.
                Einmaliges Setup{" "}
                <span className="font-semibold text-white">2.000 €</span> in
                jedem Paket.
              </p>
            </div>
            <BillingToggle annual={annual} onChange={setAnnual} />
          </div>

          <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-5">
            {PLANS.map((p, i) => (
              <PlanCard key={p.name} plan={p} annual={annual} index={i} />
            ))}
          </div>
        </section>

        {/* ADDONS */}
        <section className="mt-32">
          <SectionHeader eyebrow="Add-Ons" title="Add-Ons — jederzeit zubuchbar" />
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
        boxShadow: plan.popular ? `0 20px 60px -20px ${BRAND.blue}66` : undefined,
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

      <div className="text-lg font-bold">{plan.name}</div>
      <div className="mt-1 min-h-[36px] text-xs text-white/55">{plan.tagline}</div>

      <div className="mt-5 flex items-baseline gap-1">
        <span className="text-4xl font-extrabold tracking-tight">
          {formatEUR(price)}
          <span className="text-base text-white/50"> €</span>
        </span>
      </div>
      <div className="text-xs text-white/45">
        / Monat · {annual ? "12 Mon. Laufzeit" : "3 Mon. Laufzeit"}
      </div>
      <div className="mt-2 inline-flex w-fit items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] font-medium text-white/65">
        + {formatEUR(plan.setup)} € Setup (einmalig)
      </div>

      <div
        className="mt-5 rounded-lg px-3 py-2 text-xs font-semibold"
        style={{
          background: `linear-gradient(135deg, ${BRAND.blue}1f, ${BRAND.purple}1f)`,
          color: "#cfe5ff",
          border: `1px solid ${BRAND.blue}40`,
        }}
      >
        {plan.highlight}
      </div>

      <div className="my-6 h-px w-full bg-white/10" />

      <div className="flex flex-col gap-5">
        {plan.groups.map((g) => (
          <div key={g.title}>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/40">
              {g.title}
            </div>
            <ul className="flex flex-col gap-2">
              {g.items.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-white/80">
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0"
                    style={{ color: BRAND.blue }}
                  />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default Pricing;
