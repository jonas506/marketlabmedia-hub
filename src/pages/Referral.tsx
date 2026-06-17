import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Eye,
  Users,
  TrendingUp,
  Video,
  Instagram,
  Youtube,
  Linkedin,
  Sparkles,
  CalendarCheck,
  ShieldCheck,
  Quote,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const BRAND = {
  blue: "#0083F7",
  purple: "#21089B",
  bg: "#0a0a0f",
};

// Calendly / Cal.com link for booking a discovery call.
// Replace with the real link when available.
const CALL_LINK = "https://cal.com/marketlab-media/erstgespraech";

const KPIS = [
  { icon: Eye, value: "23.000", label: "Reichweite pro Testreel" },
  { icon: TrendingUp, value: "+360", label: "Neue Follower / Monat" },
  { icon: Video, value: "30+", label: "Reels / Monat pro Kunde" },
  { icon: Users, value: "40+", label: "Aktive Kunden-Accounts" },
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
        // Silently fall back to default text
      } finally {
        setLoading(false);
      }
    };
    fetchReferrer();
  }, [token]);

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
          <div
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-amber-300"
          >
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
            über Social Media auf — komplett organisch, ohne Werbebudget.
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

        {/* KPIs */}
        <section className="mt-20">
          <SectionEyebrow>Was unsere Kunden erreichen</SectionEyebrow>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {KPIS.map((m, i) => {
              const Icon = m.icon;
              return (
                <motion.div
                  key={m.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.06 }}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
                >
                  <div
                    className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-lg"
                    style={{
                      background: `linear-gradient(135deg, ${BRAND.blue}33, ${BRAND.purple}33)`,
                      color: BRAND.blue,
                    }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div
                    className="bg-clip-text text-3xl font-extrabold tracking-tight text-transparent md:text-4xl"
                    style={{
                      backgroundImage: `linear-gradient(180deg, #fff 0%, ${BRAND.blue} 130%)`,
                    }}
                  >
                    {m.value}
                  </div>
                  <div className="mt-2 text-sm text-white/60">{m.label}</div>
                </motion.div>
              );
            })}
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

        {/* QUOTE / SOCIAL PROOF */}
        <section className="mt-20">
          <div
            className="relative overflow-hidden rounded-2xl border border-white/10 p-8 md:p-10"
            style={{
              background:
                "linear-gradient(135deg, rgba(0,131,247,0.08), rgba(33,8,155,0.06))",
            }}
          >
            <Quote className="absolute right-6 top-6 h-10 w-10 text-white/10" />
            <p className="max-w-3xl text-lg font-medium text-white/85 md:text-xl">
              „Wir liefern wirklich geile Ergebnisse — und genau deswegen hat{" "}
              {loading ? "dein Kontakt" : referrerName} dich an uns weiterempfohlen.
              Das einzige, was du tun musst, ist 30 Minuten reden und schauen, ob's
              passt."
            </p>
            <div className="mt-6 flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full text-white"
                style={{ background: `linear-gradient(135deg, ${BRAND.blue}, ${BRAND.purple})` }}
              >
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold">Marketlab Media</div>
                <div className="text-xs text-white/50">Die Social-Media-Agentur für Wachstum</div>
              </div>
            </div>
          </div>
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
