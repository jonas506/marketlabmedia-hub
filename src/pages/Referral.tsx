import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Eye,
  Video,
  Instagram,
  Youtube,
  Linkedin,
  Sparkles,
  CalendarCheck,
  Quote,
  Star,
  Euro,
  ChevronLeft,
  ChevronRight,
  Zap,
  Target,
  Flame,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import jonasImg from "@/assets/team-jonas.png.asset.json";
import alexanderImg from "@/assets/team-alexander.png.asset.json";
import marenImg from "@/assets/team-maren.png.asset.json";
import moritzImg from "@/assets/team-moritz.png.asset.json";

// Marketlab Brand Tokens (Dark Theme — siehe Branding Spec)
const BRAND = {
  bg: "#06070F",        // --background
  card: "#0D1018",      // --card
  secondary: "#13161F", // --secondary
  muted: "#181B23",     // --muted
  border: "#181C24",
  blue: "#1E7CF0",      // --primary / --accent / --ring (≈ #0083F7)
  blueSoft: "#0083F7",
  fg: "#FFFFFF",
  mutedFg: "#9CA3AF",
};

const CALL_LINK = "https://cal.com/marketlab-media/erstgespraech";
const TRUSTPILOT_URL = "https://de.trustpilot.com/review/marketlab-media.de";

// Live-Impressionen: Anker 17.06.2026 00:00 UTC @ 9.000.000, +50.000 / Tag
const IMPRESSIONS_ANCHOR_MS = Date.UTC(2026, 5, 17, 0, 0, 0);
const IMPRESSIONS_BASE = 9_000_000;
const IMPRESSIONS_PER_DAY = 50_000;
const IMPRESSIONS_PER_MS = IMPRESSIONS_PER_DAY / 86_400_000;
const getLiveImpressions = () =>
  Math.floor(
    IMPRESSIONS_BASE + Math.max(0, Date.now() - IMPRESSIONS_ANCHOR_MS) * IMPRESSIONS_PER_MS,
  );

const STATIC_KPIS = [
  { icon: Euro, value: "1 Mio. €", label: "Umsatz, den wir reingeholt haben" },
  { icon: Video, value: "1.100+", label: "Kurzvideos in den letzten 365 Tagen" },
];

const TEAM = [
  { name: "Jonas Fesser", role: "Gesellschafter & Geschäftsführer", img: jonasImg.url },
  { name: "Alexander Schnapka", role: "Gesellschafter", img: alexanderImg.url },
  { name: "Maren Mayer", role: "Head of Content", img: marenImg.url },
  { name: "Moritz Riedl", role: "Cutter", img: moritzImg.url },
];

const VALUES = [
  {
    icon: Zap,
    title: "Speed",
    points: [
      "Schnellste Umsetzung im Markt",
      "Erste Ergebnisse innerhalb 48h",
      "Prozesse einfach, schlank & effizient",
    ],
  },
  {
    icon: Target,
    title: "Klarheit",
    points: [
      "Kein Bla Bla",
      "Fokus liegt immer auf Outcome, nicht Input",
      "Du zahlst für Ergebnisse, nicht für Likes",
    ],
  },
  {
    icon: Flame,
    title: "Drive",
    points: [
      "Mission: Geilste Agentur in der Branche",
      "Jeder Auftrag ist eine neue Referenz",
      "Wir challengen uns & dich",
    ],
  },
];

// Platzhalter — Trustpilot blockt Scraping. Bitte mit Originaltexten ersetzen.
const REVIEWS = [
  {
    name: "Tobias K.",
    text: "Endlich eine Agentur, die liefert. Innerhalb von 8 Wochen hatten wir die ersten qualifizierten Anfragen über Instagram — komplett organisch. Hammer Team!",
    rating: 5,
  },
  {
    name: "Stefanie M.",
    text: "Strategie, Dreh, Schnitt — alles aus einer Hand und auf einem Level, das ich vorher nicht kannte. Kommunikation ist direkt und ehrlich.",
    rating: 5,
  },
  {
    name: "Markus W.",
    text: "Wir haben in 6 Monaten mehr Reichweite aufgebaut als in den 2 Jahren davor mit einer anderen Agentur. Ergebnisse sprechen für sich.",
    rating: 5,
  },
  {
    name: "Lisa B.",
    text: "Professionell, schnell, transparent. Man merkt sofort, dass die für ihr Handwerk brennen. Ergebnisse kamen schneller als erwartet.",
    rating: 5,
  },
];

const BENEFITS = [
  "Komplett-Setup: Strategie, Dreh, Schnitt, Posting — alles aus einer Hand",
  "Datengetriebene Testreel-Strategie statt Bauchgefühl",
  "Eigener Ansprechpartner & monatliche Performance-Analyse",
  "Kein Werbebudget nötig — rein organisches Wachstum",
  "Planbare Reichweite & Anfragen in deiner Zielgruppe",
];

const CHANNELS = [
  { icon: Instagram, name: "Instagram", handle: "@marketlab.media", url: "https://instagram.com/marketlab.media" },
  { icon: Youtube, name: "YouTube", handle: "@marketlabmedia", url: "https://youtube.com/@marketlabmedia" },
  { icon: Linkedin, name: "LinkedIn", handle: "Marketlab Media", url: "https://linkedin.com/company/marketlab-media" },
];

// Noise SVG für globales Overlay (siehe Brand Spec: opacity 0.03, fixed, z 9999)
const NOISE_SVG_URI =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>`,
  );

const Referral = () => {
  const { token } = useParams<{ token: string }>();
  const [referrerName, setReferrerName] = useState<string>("Ein Kunde von uns");
  const [loading, setLoading] = useState(true);
  const [reviewIdx, setReviewIdx] = useState(0);

  useEffect(() => {
    document.title = "Empfehlung — Marketlab Media";
    const id = "marketlab-brand-fonts";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@1,500;1,600&display=swap";
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    const fetchReferrer = async () => {
      if (!token || token === ":token") {
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase.rpc("get_client_approval_data", {
          _token: token,
        });
        if (!error && data && (data as any).client?.name) {
          setReferrerName((data as any).client.name);
        }
      } catch (e) {
        // silent
      } finally {
        setLoading(false);
      }
    };
    fetchReferrer();
  }, [token]);

  useEffect(() => {
    const t = setInterval(() => setReviewIdx((i) => (i + 1) % REVIEWS.length), 6000);
    return () => clearInterval(t);
  }, []);

  const [impressions, setImpressions] = useState<number>(() => getLiveImpressions());
  useEffect(() => {
    const t = setInterval(() => setImpressions(getLiveImpressions()), 80);
    return () => clearInterval(t);
  }, []);

  // Helper: emotionaler Italic-Accent (Playfair Display + Brand Blue Glow)
  const accent = "italic font-semibold" as const;
  const accentStyle: React.CSSProperties = {
    fontFamily: "'Playfair Display', serif",
    color: BRAND.blue,
    textShadow: `0 0 24px ${BRAND.blue}66, 0 0 48px ${BRAND.blue}33`,
  };

  return (
    <div
      className="min-h-screen w-full text-white"
      style={{ background: BRAND.bg, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      {/* Hero radial glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(30,124,240,0.18) 0%, rgba(30,124,240,0.06) 35%, transparent 70%)",
        }}
      />
      {/* Dot pattern */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-0"
        style={{
          backgroundImage:
            "radial-gradient(rgba(156,163,175,0.12) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage:
            "radial-gradient(ellipse at 50% 0%, black 0%, transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at 50% 0%, black 0%, transparent 70%)",
        }}
      />
      {/* Globales Noise Overlay (Brand Spec) */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: `url("${NOISE_SVG_URI}")`,
          opacity: 0.03,
          zIndex: 9999,
          mixBlendMode: "overlay",
        }}
      />

      <div className="relative z-10 mx-auto max-w-5xl px-6 py-16 md:py-24">
        {/* HERO */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <div
            className="mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em]"
            style={{
              borderColor: `${BRAND.blue}4D`,
              background: `${BRAND.blue}14`,
              color: BRAND.blueSoft,
            }}
          >
            <Sparkles className="h-3.5 w-3.5" /> Persönliche Empfehlung
          </div>

          <h1 className="max-w-4xl text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
            <span className="text-white">{loading ? "..." : referrerName}</span>{" "}
            <span className="text-white/60">hat an</span>{" "}
            <span className={accent} style={accentStyle}>dich</span>{" "}
            <span className="text-white/60">gedacht.</span>
          </h1>

          <p className="mt-6 max-w-3xl text-lg text-white/65 md:text-xl">
            {loading ? "..." : referrerName} ist Kunde bei{" "}
            <span className="font-semibold text-white">Marketlab Media</span> und ist
            so happy mit den Ergebnissen, dass er dich darauf aufmerksam machen
            wollte. Wir bauen mit Unternehmern{" "}
            <span className={accent} style={accentStyle}>planbare</span>{" "}
            Reichweite & Kundenanfragen über Social Media auf — komplett organisch.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <a
              href={CALL_LINK}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-2 rounded-2xl px-6 py-3.5 text-base font-bold text-white transition-all hover:scale-[1.03] active:scale-[0.98]"
              style={{
                background: BRAND.blue,
                boxShadow: `0 0 40px -10px ${BRAND.blue}66, 0 10px 30px -10px ${BRAND.blue}88`,
              }}
            >
              <CalendarCheck className="h-5 w-5" />
              Kostenfreies Erstgespräch buchen
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <span className="text-sm text-white/40">
              30 Min · unverbindlich · keine Verkaufsmasche
            </span>
          </div>
        </motion.section>

        {/* AGENTUR-KPIs */}
        <section className="mt-20">
          <SectionEyebrow>Marketlab in Zahlen</SectionEyebrow>
          <h2 className="mt-2 max-w-3xl text-3xl font-extrabold tracking-tight md:text-4xl">
            Was wir in den letzten 12 Monaten{" "}
            <span className={accent} style={accentStyle}>geliefert</span> haben
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Live impressions */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="relative overflow-hidden rounded-2xl border p-6"
              style={{
                borderColor: `${BRAND.blue}4D`,
                background: BRAND.card,
                boxShadow: `0 0 40px -10px ${BRAND.blue}40`,
              }}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl"
                style={{ background: `${BRAND.blue}33` }}
              />
              <div className="relative flex items-center justify-between">
                <div
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{
                    background: `${BRAND.blue}26`,
                    color: BRAND.blueSoft,
                  }}
                >
                  <Eye className="h-5 w-5" />
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/70">
                  <span
                    className="h-1.5 w-1.5 animate-pulse rounded-full"
                    style={{ background: BRAND.blue, boxShadow: `0 0 8px ${BRAND.blue}` }}
                  />
                  Live
                </div>
              </div>
              <div
                className="relative mt-4 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent tabular-nums md:text-5xl"
                style={{
                  backgroundImage: `linear-gradient(180deg, #fff 0%, ${BRAND.blue} 130%)`,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {impressions.toLocaleString("de-DE")}
              </div>
              <div className="relative mt-2 text-sm text-white/65">
                Impressionen für unsere Kunden
              </div>
            </motion.div>

            {STATIC_KPIS.map((m, i) => {
              const Icon = m.icon;
              return (
                <motion.div
                  key={m.label}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, ease: "easeOut", delay: (i + 1) * 0.08 }}
                  className="rounded-2xl border p-6"
                  style={{
                    background: BRAND.card,
                    borderColor: `${BRAND.blue}33`,
                  }}
                >
                  <div
                    className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{
                      background: `${BRAND.blue}26`,
                      color: BRAND.blueSoft,
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div
                    className="bg-clip-text text-4xl font-extrabold tracking-tight text-transparent md:text-5xl"
                    style={{
                      backgroundImage: `linear-gradient(180deg, #fff 0%, ${BRAND.blue} 130%)`,
                    }}
                  >
                    {m.value}
                  </div>
                  <div className="mt-2 text-sm text-white/65">{m.label}</div>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* TRUSTPILOT */}
        <section className="mt-20">
          <a
            href={TRUSTPILOT_URL}
            target="_blank"
            rel="noreferrer"
            className="group block"
          >
            <div
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-6 transition-all hover:scale-[1.01]"
              style={{
                background: BRAND.card,
                borderColor: `${BRAND.blue}33`,
              }}
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="flex h-8 w-8 items-center justify-center rounded"
                      style={{ background: "#00B67A" }}
                    >
                      <Star className="h-5 w-5 fill-white text-white" />
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-lg font-bold">Exzellent auf Trustpilot</div>
                  <div className="text-sm text-white/55">
                    Echte Kundenstimmen in Textform
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold text-white/70 transition-colors group-hover:text-white">
                Alle Bewertungen ansehen
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </div>
            </div>
          </a>

          {/* Review carousel */}
          <div
            className="mt-6 overflow-hidden rounded-2xl border"
            style={{ background: BRAND.card, borderColor: `${BRAND.blue}26` }}
          >
            <div className="relative p-8 md:p-10">
              <Quote className="absolute right-6 top-6 h-10 w-10 text-white/10" />
              <motion.div
                key={reviewIdx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <div className="mb-3 flex items-center gap-1">
                  {Array.from({ length: REVIEWS[reviewIdx].rating }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-4 w-4"
                      style={{ fill: "#00B67A", color: "#00B67A" }}
                    />
                  ))}
                </div>
                <p className="text-lg font-medium text-white/85 md:text-xl">
                  „{REVIEWS[reviewIdx].text}"
                </p>
                <div className="mt-5 text-sm font-semibold text-white/70">
                  — {REVIEWS[reviewIdx].name}
                </div>
              </motion.div>

              <div className="mt-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {REVIEWS.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setReviewIdx(i)}
                      aria-label={`Bewertung ${i + 1}`}
                      className="h-1.5 rounded-full transition-all"
                      style={{
                        width: i === reviewIdx ? 24 : 8,
                        background: i === reviewIdx ? BRAND.blue : "rgba(255,255,255,0.2)",
                      }}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setReviewIdx((i) => (i - 1 + REVIEWS.length) % REVIEWS.length)
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/70 transition-colors hover:bg-white/5 hover:text-white"
                    aria-label="Vorherige Bewertung"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setReviewIdx((i) => (i + 1) % REVIEWS.length)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/70 transition-colors hover:bg-white/5 hover:text-white"
                    aria-label="Nächste Bewertung"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TEAM */}
        <section className="mt-20">
          <SectionEyebrow>Das Team</SectionEyebrow>
          <h2 className="mt-2 max-w-3xl text-3xl font-extrabold tracking-tight md:text-4xl">
            Die Menschen{" "}
            <span className={accent} style={accentStyle}>hinter</span>{" "}
            Marketlab Media
          </h2>
          <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
            {TEAM.map((p, i) => (
              <motion.div
                key={p.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, ease: "easeOut", delay: i * 0.08 }}
                className="flex flex-col items-center text-center"
              >
                <div
                  className="relative h-28 w-28 overflow-hidden rounded-full ring-2 md:h-32 md:w-32"
                  style={{
                    background:
                      "radial-gradient(circle at 50% 35%, rgba(30,124,240,0.28), #06070F 70%)",
                    boxShadow: `0 0 30px -10px ${BRAND.blue}66`,
                  }}
                >
                  <img
                    src={p.img}
                    alt={p.name}
                    className="h-full w-full object-cover object-top"
                    loading="lazy"
                  />
                </div>
                <div className="mt-4 text-sm font-bold">{p.name}</div>
                <div className="mt-0.5 text-xs text-white/55">{p.role}</div>
                <div
                  className="mt-2 h-0.5 w-6 rounded-full"
                  style={{ background: BRAND.blue }}
                />
              </motion.div>
            ))}
          </div>
        </section>

        {/* JONAS — VALUES */}
        <section className="mt-20">
          <div
            className="overflow-hidden rounded-3xl border"
            style={{
              background: BRAND.card,
              borderColor: `${BRAND.blue}33`,
              boxShadow: `0 0 60px -20px ${BRAND.blue}55`,
            }}
          >
            <div className="flex flex-col items-center gap-6 p-8 md:flex-row md:gap-10 md:p-10">
              <div className="flex flex-col items-center text-center md:items-start md:text-left">
                <div
                  className="relative h-36 w-36 overflow-hidden rounded-full ring-2 md:h-44 md:w-44"
                  style={{
                    background:
                      "radial-gradient(circle at 50% 35%, rgba(30,124,240,0.32), #06070F 70%)",
                    boxShadow: `0 0 40px -10px ${BRAND.blue}66`,
                  }}
                >
                  <img
                    src={jonasImg.url}
                    alt="Jonas Fesser"
                    className="h-full w-full object-cover object-top"
                  />
                </div>
                <div className="mt-4 text-sm font-bold">Jonas Fesser</div>
                <div className="mt-0.5 text-xs text-white/55">Geschäftsführer Marketlab Media</div>
              </div>

              <div className="flex-1">
                <p className="text-lg font-medium text-white/85 md:text-xl">
                  „Wir bauen Marketlab nach 3{" "}
                  <span className={accent} style={accentStyle}>klaren</span>{" "}
                  Werten. Daran misst sich jede Entscheidung, jeder Dreh, jedes Reel —
                  und genau deswegen liefern wir Ergebnisse, die andere nicht hinkriegen."
                </p>

                <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
                  {VALUES.map((v) => {
                    const Icon = v.icon;
                    return (
                      <div
                        key={v.title}
                        className="rounded-2xl border p-4"
                        style={{
                          background: BRAND.secondary,
                          borderColor: `${BRAND.blue}26`,
                        }}
                      >
                        <div
                          className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg"
                          style={{
                            background: `${BRAND.blue}26`,
                            color: BRAND.blueSoft,
                          }}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="text-base font-bold">{v.title}</div>
                        <ul className="mt-2 space-y-1.5">
                          {v.points.map((pt) => (
                            <li
                              key={pt}
                              className="flex items-start gap-2 text-xs leading-relaxed text-white/65"
                            >
                              <Check
                                className="mt-0.5 h-3 w-3 shrink-0"
                                style={{ color: BRAND.blue }}
                              />
                              <span>{pt}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* WHY US */}
        <section className="mt-20">
          <SectionEyebrow>Warum Marketlab Media</SectionEyebrow>
          <h2 className="mt-2 max-w-3xl text-3xl font-extrabold tracking-tight md:text-4xl">
            Social Media Wachstum als{" "}
            <span className={accent} style={accentStyle}>planbares</span>{" "}
            System.
          </h2>
          <ul className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-2">
            {BENEFITS.map((b) => (
              <li
                key={b}
                className="flex items-start gap-3 rounded-2xl border p-4 text-sm text-white/80"
                style={{
                  background: BRAND.card,
                  borderColor: `${BRAND.blue}26`,
                }}
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: BRAND.blue }} />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* CHANNELS */}
        <section className="mt-20">
          <SectionEyebrow>Schau dich erst um</SectionEyebrow>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight md:text-3xl">
            Unsere eigenen Kanäle
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
            {CHANNELS.map((c) => {
              const Icon = c.icon;
              return (
                <a
                  key={c.name}
                  href={c.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center gap-4 rounded-2xl border p-4 transition-all hover:scale-[1.03]"
                  style={{
                    background: BRAND.card,
                    borderColor: `${BRAND.blue}33`,
                  }}
                >
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{
                      background: `${BRAND.blue}26`,
                      color: BRAND.blueSoft,
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{c.name}</div>
                    <div className="text-xs text-white/50">{c.handle}</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-white/30 transition-transform group-hover:translate-x-0.5" />
                </a>
              );
            })}
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="mt-24 mb-12">
          <div
            className="relative overflow-hidden rounded-3xl border p-10 text-center md:p-14"
            style={{
              background:
                "radial-gradient(60% 80% at 50% 0%, rgba(30,124,240,0.20), transparent 70%), #0D1018",
              borderColor: `${BRAND.blue}33`,
              boxShadow: `0 0 60px -20px ${BRAND.blue}66`,
            }}
          >
            <h2 className="mx-auto max-w-3xl text-3xl font-extrabold tracking-tight md:text-5xl">
              Lass uns{" "}
              <span className={accent} style={accentStyle}>30 Minuten</span>{" "}
              reden.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-white/60 md:text-lg">
              Wir schauen uns deine Situation an, geben dir eine ehrliche Einschätzung
              und du entscheidest, ob das ein Fit ist. Kein Druck.
            </p>
            <a
              href={CALL_LINK}
              target="_blank"
              rel="noreferrer"
              className="mt-8 inline-flex items-center gap-2 rounded-2xl px-7 py-4 text-base font-bold text-white transition-all hover:scale-[1.03] active:scale-[0.98]"
              style={{
                background: BRAND.blue,
                boxShadow: `0 0 40px -10px ${BRAND.blue}AA, 0 12px 40px -10px ${BRAND.blue}99`,
              }}
            >
              <CalendarCheck className="h-5 w-5" />
              Erstgespräch buchen
              <ArrowRight className="h-4 w-4" />
            </a>
            <div className="mt-5 text-xs text-white/40">
              Empfohlen von {loading ? "einem unserer Kunden" : referrerName}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

const SectionEyebrow = ({ children }: { children: React.ReactNode }) => (
  <div
    className="text-xs font-semibold uppercase tracking-[0.18em]"
    style={{ color: "#0083F7" }}
  >
    {children}
  </div>
);

export default Referral;
