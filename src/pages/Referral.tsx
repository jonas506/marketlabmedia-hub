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

const BRAND = {
  blue: "#0083F7",
  purple: "#21089B",
  bg: "#0a0a0f",
};

// Cal.com link for booking a discovery call. Replace once final link is set.
const CALL_LINK = "https://cal.com/marketlab-media/erstgespraech";
const TRUSTPILOT_URL = "https://de.trustpilot.com/review/marketlab-media.de";

// Live-Impressionen-Counter:
// Anker auf 17.06.2026 00:00 UTC mit 9.000.000 Impressionen.
// Wächst 24/7 mit Ø 50.000 / Tag (≈ 0,5787 / ms).
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
      "Fokus liegt immer auf OUTCOME, nicht Input",
      "Kunden zahlen für Ergebnisse, nicht für Likes",
    ],
  },
  {
    icon: Flame,
    title: "Drive",
    points: [
      "Mission: Geilste Agentur in der Branche",
      "Jeder Auftrag ist eine neue Referenz",
      "Wir challengen uns & unsere Kunden",
    ],
  },
];

// Placeholder Trustpilot reviews — Trustpilot blockt Scraping.
// Bitte mit den Originaltexten von https://de.trustpilot.com/review/marketlab-media.de ersetzen.
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
  "Planbare Reichweite & Follower-Aufbau in deiner Zielgruppe",
];

const CHANNELS = [
  { icon: Instagram, name: "Instagram", handle: "@marketlab.media", url: "https://instagram.com/marketlab.media" },
  { icon: Youtube, name: "YouTube", handle: "@marketlabmedia", url: "https://youtube.com/@marketlabmedia" },
  { icon: Linkedin, name: "LinkedIn", handle: "Marketlab Media", url: "https://linkedin.com/company/marketlab-media" },
];

const Referral = () => {
  const { token } = useParams<{ token: string }>();
  const [referrerName, setReferrerName] = useState<string>("Ein Kunde von uns");
  const [loading, setLoading] = useState(true);
  const [reviewIdx, setReviewIdx] = useState(0);

  useEffect(() => {
    document.title = "Empfehlung — Marketlab Media";
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
        // fall back silently
      } finally {
        setLoading(false);
      }
    };
    fetchReferrer();
  }, [token]);

  // Auto-rotate reviews
  useEffect(() => {
    const t = setInterval(() => setReviewIdx((i) => (i + 1) % REVIEWS.length), 6000);
    return () => clearInterval(t);
  }, []);

  // Live impressions counter — tickt alle 80ms hoch
  const [impressions, setImpressions] = useState<number>(() => getLiveImpressions());
  useEffect(() => {
    const t = setInterval(() => setImpressions(getLiveImpressions()), 80);
    return () => clearInterval(t);
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
            "radial-gradient(60% 50% at 50% 0%, rgba(0,131,247,0.20) 0%, rgba(33,8,155,0.12) 35%, transparent 70%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-5xl px-6 py-16 md:py-24">
        {/* HERO */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
            <Sparkles className="h-3.5 w-3.5" /> Persönliche Empfehlung
          </div>

          <h1 className="max-w-4xl text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
            <span className="text-white">{loading ? "..." : referrerName}</span>{" "}
            <span className="text-white/60">hat an dich gedacht.</span>
          </h1>

          <p className="mt-6 max-w-3xl text-lg text-white/65 md:text-xl">
            {loading ? "..." : referrerName} ist Kunde bei{" "}
            <span className="font-semibold text-white">Marketlab Media</span> und ist
            so happy mit den Ergebnissen, dass er dich darauf aufmerksam machen
            wollte. Wir bauen mit Unternehmern planbare Reichweite & Kundenanfragen
            über Social Media auf — komplett organisch.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <a
              href={CALL_LINK}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-base font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: `linear-gradient(135deg, ${BRAND.blue}, ${BRAND.purple})`,
                boxShadow: `0 10px 30px -10px ${BRAND.blue}88`,
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
            Was wir in den letzten 12 Monaten geliefert haben
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {KPIS.map((m, i) => {
              const Icon = m.icon;
              return (
                <motion.div
                  key={m.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.06 }}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-6"
                >
                  <div
                    className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{
                      background: `linear-gradient(135deg, ${BRAND.blue}33, ${BRAND.purple}33)`,
                      color: BRAND.blue,
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
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
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
                    Echte Bewertungen unserer Kunden
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
          <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
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
            Die Menschen hinter Marketlab Media
          </h2>
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            {TEAM.map((p) => (
              <div
                key={p.name}
                className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01]"
              >
                <div
                  className="relative aspect-[3/4] overflow-hidden"
                  style={{
                    background:
                      "radial-gradient(60% 50% at 50% 40%, rgba(0,131,247,0.35) 0%, rgba(33,8,155,0.15) 50%, transparent 80%), #0a0a14",
                  }}
                >
                  <img
                    src={p.img}
                    alt={p.name}
                    className="absolute inset-0 h-full w-full object-cover object-top"
                    loading="lazy"
                  />
                </div>
                <div className="p-4">
                  <div className="text-sm font-bold">{p.name}</div>
                  <div className="mt-0.5 text-xs text-white/55">{p.role}</div>
                  <div
                    className="mt-2 h-0.5 w-8 rounded-full"
                    style={{ background: BRAND.blue }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* JONAS — VALUES */}
        <section className="mt-20">
          <div
            className="overflow-hidden rounded-3xl border border-white/10"
            style={{
              background:
                "linear-gradient(135deg, rgba(0,131,247,0.10), rgba(33,8,155,0.08))",
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-[260px_1fr]">
              <div
                className="relative hidden md:block"
                style={{
                  background:
                    "radial-gradient(60% 50% at 50% 40%, rgba(0,131,247,0.40) 0%, rgba(33,8,155,0.20) 50%, transparent 80%)",
                }}
              >
                <img
                  src={jonasImg.url}
                  alt="Jonas Fesser"
                  className="absolute bottom-0 left-1/2 h-full w-auto -translate-x-1/2 object-contain"
                />
              </div>
              <div className="p-8 md:p-10">
                <div className="flex items-center gap-3">
                  <img
                    src={jonasImg.url}
                    alt="Jonas Fesser"
                    className="h-12 w-12 rounded-full object-cover object-top md:hidden"
                    style={{ background: "#1a1a24" }}
                  />
                  <div>
                    <div className="text-sm font-semibold text-white">Jonas Fesser</div>
                    <div className="text-xs text-white/55">Geschäftsführer Marketlab Media</div>
                  </div>
                </div>
                <p className="mt-5 text-lg font-medium text-white/85 md:text-xl">
                  „Wir bauen Marketlab nach 3 klaren Werten. Daran misst sich jede
                  Entscheidung, jeder Dreh, jedes Reel — und genau deswegen liefern
                  wir Ergebnisse, die andere nicht hinkriegen."
                </p>

                <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
                  {VALUES.map((v) => {
                    const Icon = v.icon;
                    return (
                      <div
                        key={v.title}
                        className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
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
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: `linear-gradient(90deg, ${BRAND.blue}, #7B5CFF)` }}
            >
              planbares System.
            </span>
          </h2>
          <ul className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-2">
            {BENEFITS.map((b) => (
              <li
                key={b}
                className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white/80"
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
                  className="group flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-4 transition-all hover:border-white/25 hover:bg-white/[0.04]"
                >
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{
                      background: `linear-gradient(135deg, ${BRAND.blue}22, ${BRAND.purple}22)`,
                      color: BRAND.blue,
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
            className="relative overflow-hidden rounded-3xl border border-white/10 p-10 text-center md:p-14"
            style={{
              background:
                "radial-gradient(60% 80% at 50% 0%, rgba(0,131,247,0.18), transparent 70%), #0d0d14",
            }}
          >
            <h2 className="mx-auto max-w-3xl text-3xl font-extrabold tracking-tight md:text-5xl">
              Lass uns 30 Minuten reden.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-white/60 md:text-lg">
              Wir schauen uns deine Situation an, geben dir eine ehrliche Einschätzung
              und du entscheidest, ob das ein Fit ist. Kein Druck.
            </p>
            <a
              href={CALL_LINK}
              target="_blank"
              rel="noreferrer"
              className="mt-8 inline-flex items-center gap-2 rounded-full px-7 py-4 text-base font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: `linear-gradient(135deg, ${BRAND.blue}, ${BRAND.purple})`,
                boxShadow: `0 12px 40px -10px ${BRAND.blue}99`,
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
    style={{ color: BRAND.blue }}
  >
    {children}
  </div>
);

export default Referral;
