import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight, Check, Eye, Video, Instagram, Youtube, Linkedin,
  CalendarCheck, Quote, Star, Euro, Zap, Target, Flame, ChevronLeft, ChevronRight,
} from "lucide-react";
import jonasImg from "@/assets/team-jonas.png.asset.json";
import alexanderImg from "@/assets/team-alexander.png.asset.json";
import marenImg from "@/assets/team-maren.png.asset.json";
import moritzImg from "@/assets/team-moritz.png.asset.json";

export const BRAND = {
  bg: "#06070F",
  card: "#0D1018",
  secondary: "#13161F",
  muted: "#181B23",
  border: "#181C24",
  blue: "#1E7CF0",
  blueSoft: "#0083F7",
  fg: "#FFFFFF",
  mutedFg: "#9CA3AF",
};

export const CALL_LINK = "https://cal.com/marketlab-media/erstgespraech";
const TRUSTPILOT_URL = "https://de.trustpilot.com/review/marketlab-media.de";

const IMPRESSIONS_ANCHOR_MS = Date.UTC(2026, 5, 17, 0, 0, 0);
const IMPRESSIONS_BASE = 9_000_000;
const IMPRESSIONS_PER_DAY = 50_000;
const IMPRESSIONS_PER_MS = IMPRESSIONS_PER_DAY / 86_400_000;
const getLiveImpressions = () =>
  Math.floor(IMPRESSIONS_BASE + Math.max(0, Date.now() - IMPRESSIONS_ANCHOR_MS) * IMPRESSIONS_PER_MS);

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
  { icon: Zap, title: "Speed", points: ["Schnellste Umsetzung im Markt", "Erste Ergebnisse innerhalb 48h", "Prozesse einfach, schlank & effizient"] },
  { icon: Target, title: "Klarheit", points: ["Kein Bla Bla", "Fokus liegt immer auf Outcome, nicht Input", "Du zahlst für Ergebnisse, nicht für Likes"] },
  { icon: Flame, title: "Drive", points: ["Mission: Geilste Agentur in der Branche", "Jeder Auftrag ist eine neue Referenz", "Wir challengen uns & dich"] },
];

const REVIEWS = [
  { name: "Joel H.", date: "16. Jan. 2026", title: "Business-Shooting 10/10", rating: 5, text: "Ich habe Jonas im persönlichen Rahmen für ein Business-Shooting organisiert und kann am Ende zu den Ergebnissen nur sagen: Das waren mit die besten Bilder, die ich bis dato zu Gesicht bekommen habe. Der emotionale Aspekt in den Bildern ist genial. Die Fotos wirken nicht gestellt, sondern hoch professionell – und auch was Kameraqualität und Kameraführung betrifft, sind die Aufnahmen alle 1A. Jonas hat sich Zeit genommen, die Bilder zu perfektionieren, ist zu 100 % auf meine Wünsche eingegangen." },
  { name: "Julia Ganzert", date: "16. Okt. 2025", title: "Licht am Ende des Tunnels.", rating: 5, text: "Auf dem Markt gibt es wirklich viele Menschen, die die Welt versprechen, aber nichts liefern. Jonas hat mir gezeigt wie es anders geht, er trägt wunderbare Werte, sein Team und er liefern top Performance. Er war immer top erreichbar, haben Vollgas gegeben und overdelivert. Konnte durch die Zusammenarbeit selbst viel lernen und hatte endlich jemanden an der Hand, der von seinem Werk echt Ahnung hat. Danke für Alles!" },
  { name: "Max", date: "17. Okt. 2025", title: "Ich arbeite sehr gerne mit Jonas", rating: 5, text: "Ich arbeite sehr gerne mit Jonas, da von der Planung bis zur Umsetzung alles strukturiert und in hoher Qualität abläuft. Bei gemeinsamen Projekten weiß ich zu jeder Zeit, dass ich mich voll darauf verlassen kann. Kann ich nur empfehlen. Vielen Dank." },
  { name: "julia", date: "24. Juni 2025", title: "Super Erlebnis beim Fotoshooting", rating: 5, text: "Super Erlebnis beim Fotoshooting mit Market Lab Media! Das Team war professionell, freundlich und hat eine entspannte Atmosphäre geschaffen. Die Videos sind fantastisch geworden – genau so, wie ich sie mir vorgestellt habe. Absolut empfehlenswert!" },
  { name: "Darius Fisch", date: "16. Okt. 2025", title: "Sehr klares und professionelles Auftreten", rating: 5, text: "Vom ersten Moment an sehr klares und professionelles Auftreten. Ich habe direkt gespürt, der Mann weiß was er da macht! Durch das Einbeziehen der Darsteller hat er einen Raum für Co-Kreation eröffnet. Er bringt kreative Ideen ein, lässt aber auch den Darstellern Raum sich kreativ einzubringen. Klare Empfehlung. Freue mich auf weitere Projekte!" },
  { name: "Jan Henke", date: "15. Aug. 2025", title: "Bombenjob abgeliefert", rating: 5, text: "Ich habe mit Jonas an einer Ad gearbeitet und trotz meiner Befürchtungen und Nervosität hat er nen Bombenjob abgeliefert mir die Zeit zu geben die Texte aufzusagen. Er war freundlich, zuvorkommend und super kreativ. Am Ende hat er aus den Aufnahmen unglaublich gute Ads gezaubert." },
  { name: "Marisa Dittrich", date: "18. Sept. 2025", title: "Absolute Empfehlung!", rating: 5, text: "Absolute Empfehlung! Gute Planung und Umsetzung, unkomplizierte Arbeitsweise und sehr professionell. Ich freue mich sehr über eine weitere Zusammenarbeit :)" },
  { name: "ls", date: "11. Feb. 2026", title: "Professionell!", rating: 5, text: "Ich durfte im Rahmen eines Model-/Moderationsjobs mit Marketlab Media arbeiten und kann nur positives berichten. Absolut professionell-authentisch und zuverlässig. Freue mich schon auf die nächsten Projekte. Gerne wieder!" },
  { name: "Nina Engert", date: "26. Okt. 2025", title: "5 Sterne", rating: 5, text: "Die Zusammenarbeit mit Jonas hat sehr gut funktioniert. Deswegen von mir 5 Sterne!" },
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

export const NOISE_SVG_URI =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>`,
  );

export const accentStyle: React.CSSProperties = {
  fontFamily: "'Playfair Display', serif",
  color: BRAND.blue,
  textShadow: `0 0 24px ${BRAND.blue}66, 0 0 48px ${BRAND.blue}33`,
};
const accent = "italic font-semibold";

export const SectionEyebrow = ({ children }: { children: React.ReactNode }) => (
  <div className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: BRAND.blueSoft }}>
    {children}
  </div>
);

export const AgencySections = () => {
  const [reviewIdx, setReviewIdx] = useState(0);
  const [impressions, setImpressions] = useState<number>(() => getLiveImpressions());

  useEffect(() => {
    const t = setInterval(() => setReviewIdx((i) => (i + 1) % REVIEWS.length), 6000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const t = setInterval(() => setImpressions(getLiveImpressions()), 80);
    return () => clearInterval(t);
  }, []);

  return (
    <>
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

    </>
  );
};

export const FinalCta = ({ referrerName }: { referrerName?: string | null }) => (
  <section className="mt-24 mb-12">
    <div
      className="relative overflow-hidden rounded-3xl border p-10 text-center md:p-14"
      style={{
        background: "radial-gradient(60% 80% at 50% 0%, rgba(30,124,240,0.20), transparent 70%), #0D1018",
        borderColor: `${BRAND.blue}33`,
        boxShadow: `0 0 60px -20px ${BRAND.blue}66`,
      }}
    >
      <h2 className="mx-auto max-w-3xl text-3xl font-extrabold tracking-tight md:text-5xl">
        Lass uns <span className={accent} style={accentStyle}>30 Minuten</span> reden.
      </h2>
      <p className="mx-auto mt-4 max-w-2xl text-white/60 md:text-lg">
        Wir schauen uns deine Situation an, geben dir eine ehrliche Einschätzung und du entscheidest, ob das ein Fit ist. Kein Druck.
      </p>
      <a
        href={CALL_LINK}
        target="_blank"
        rel="noreferrer"
        className="mt-8 inline-flex items-center gap-2 rounded-2xl px-7 py-4 text-base font-bold text-white transition-all hover:scale-[1.03] active:scale-[0.98]"
        style={{ background: BRAND.blue, boxShadow: `0 0 40px -10px ${BRAND.blue}AA, 0 12px 40px -10px ${BRAND.blue}99` }}
      >
        <CalendarCheck className="h-5 w-5" />
        Erstgespräch buchen
        <ArrowRight className="h-4 w-4" />
      </a>
      <div className="mt-5 text-xs text-white/40">
        Empfohlen von {referrerName || "einem unserer Kunden"}
      </div>
    </div>
  </section>
);
