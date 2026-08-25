import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, CalendarCheck, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  AgencySections,
  FinalCta,
  BRAND,
  CALL_LINK,
  NOISE_SVG_URI,
  accentStyle,
} from "@/components/referral/AgencySections";

const accent = "italic font-semibold" as const;

const Referral = () => {
  const { token } = useParams<{ token: string }>();
  const [referrerName, setReferrerName] = useState<string>("Ein Kunde von uns");
  const [loading, setLoading] = useState(true);

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

  return (
    <div
      className="min-h-screen w-full text-white"
      style={{ background: BRAND.bg, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(30,124,240,0.18) 0%, rgba(30,124,240,0.06) 35%, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-0"
        style={{
          backgroundImage: "radial-gradient(rgba(156,163,175,0.12) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage: "radial-gradient(ellipse at 50% 0%, black 0%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 0%, black 0%, transparent 70%)",
        }}
      />
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
            <span className="font-semibold text-white">Marketlab Media</span> und ist so happy
            mit den Ergebnissen, dass er dich darauf aufmerksam machen wollte. Wir bauen mit
            Unternehmern <span className={accent} style={accentStyle}>planbare</span> Reichweite
            & Kundenanfragen über Social Media auf — komplett organisch.
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

        <AgencySections />

        <FinalCta referrerName={loading ? null : referrerName} />
      </div>
    </div>
  );
};

export default Referral;
