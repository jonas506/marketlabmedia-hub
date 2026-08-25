import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CalendarCheck, Phone, Quote, Sparkles, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  AgencySections,
  FinalCta,
  BRAND,
  NOISE_SVG_URI,
  SectionEyebrow,
  accentStyle as sharedAccentStyle,
} from "@/components/referral/AgencySections";

const DEFAULT_CAL = "https://cal.com/marketlab-media/erstgespraech";


interface MediaItem {
  id: string;
  type: string;
  url: string;
  caption?: string | null;
}

interface PageData {
  slug: string;
  client_name: string;
  headline_name: string;
  role_title?: string | null;
  photo_url?: string | null;
  intro_text?: string | null;
  results_text?: string | null;
  stats: { label: string; value: string }[];
  quote?: string | null;
  phone?: string | null;
  cal_link?: string | null;
  media: MediaItem[];
}

export const signReferralAsset = async (path?: string | null) => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const { data } = await supabase.storage
    .from("referral-assets")
    .createSignedUrl(path, 60 * 60 * 12);
  return data?.signedUrl ?? null;
};

const ReferralLanding = () => {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [photo, setPhoto] = useState<string | null>(null);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const load = async () => {
      if (!slug) return;
      const { data } = await supabase.rpc("get_referral_page", { _slug: slug });
      const p = data as unknown as PageData | null;
      setPage(p);
      setLoading(false);
      if (p) {
        document.title = `${p.headline_name} empfiehlt Marketlab Media`;
        const meta = document.querySelector('meta[name="description"]');
        if (meta) {
          meta.setAttribute(
            "content",
            `${p.headline_name} über die Zusammenarbeit mit Marketlab Media — Ergebnisse, persönliches Feedback und direkte Terminbuchung.`,
          );
        }
        setPhoto(await signReferralAsset(p.photo_url));
        const entries = await Promise.all(
          (p.media || []).map(async (m) => [m.id, (await signReferralAsset(m.url)) || ""] as const),
        );
        setMediaUrls(Object.fromEntries(entries));
      }
    };
    load();
  }, [slug]);

  useEffect(() => {
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

  const calLink = page?.cal_link || DEFAULT_CAL;
  const calEmbedSrc = useMemo(() => {
    try {
      const u = new URL(calLink);
      u.searchParams.set("embed", "true");
      u.searchParams.set("theme", "dark");
      return u.toString();
    } catch {
      return calLink;
    }
  }, [calLink]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: BRAND.bg }}>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  if (!page) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center text-white"
        style={{ background: BRAND.bg, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
      >
        <h1 className="text-2xl font-bold">Diese Seite ist nicht verfügbar</h1>
        <p className="text-white/50">Der Link ist ungültig oder die Seite wurde deaktiviert.</p>
      </div>
    );
  }

  const images = page.media.filter((m) => m.type === "image");
  const audios = page.media.filter((m) => m.type === "audio");
  const videos = page.media.filter((m) => m.type === "video");

  const accentStyle = sharedAccentStyle;

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
          transition={{ duration: 0.6 }}
          className="flex flex-col items-start gap-8 md:flex-row md:items-center"
        >
          {photo && (
            <img
              src={photo}
              alt={`${page.headline_name}, Kunde von Marketlab Media`}
              className="h-32 w-32 shrink-0 rounded-2xl object-cover md:h-44 md:w-44"
              style={{ boxShadow: `0 0 60px -20px ${BRAND.blue}` }}
            />
          )}
          <div>
            <div
              className="mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ borderColor: `${BRAND.blue}4D`, background: `${BRAND.blue}14`, color: BRAND.blue }}
            >
              <Sparkles className="h-3.5 w-3.5" /> Persönliche Empfehlung
            </div>
            <h1 className="text-3xl font-extrabold leading-[1.08] tracking-tight md:text-5xl">
              {page.headline_name}{" "}
              <span className="text-white/60">empfiehlt</span>{" "}
              <span className="italic font-semibold" style={accentStyle}>
                Marketlab Media
              </span>
            </h1>
            {page.role_title && (
              <p className="mt-3 text-sm text-white/50">{page.role_title}</p>
            )}
            {page.intro_text && (
              <p className="mt-5 max-w-2xl text-base text-white/70 md:text-lg">{page.intro_text}</p>
            )}
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a
                href="#termin"
                className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold text-white transition-transform hover:scale-[1.03]"
                style={{ background: BRAND.blue, boxShadow: `0 10px 30px -10px ${BRAND.blue}` }}
              >
                <CalendarCheck className="h-4 w-4" /> Termin buchen
              </a>
              {page.phone && (
                <a
                  href={`tel:${page.phone.replace(/\s/g, "")}`}
                  className="inline-flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-semibold text-white/80 transition-colors hover:text-white"
                  style={{ borderColor: BRAND.border, background: BRAND.card }}
                >
                  <Phone className="h-4 w-4" /> {page.phone}
                </a>
              )}
            </div>
          </div>
        </motion.section>

        {/* ERGEBNISSE */}
        {(page.results_text || page.stats?.length > 0) && (
          <section className="mt-20">
            <SectionEyebrow>Ergebnisse</SectionEyebrow>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">

              Was wir für {page.headline_name}{" "}
              <span className="italic font-semibold" style={accentStyle}>
                gemacht
              </span>{" "}
              haben
            </h2>
            {page.results_text && (
              <p className="mt-5 whitespace-pre-line text-base leading-relaxed text-white/70">
                {page.results_text}
              </p>
            )}
            {page.stats?.length > 0 && (
              <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
                {page.stats.map((s, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: i * 0.06 }}
                    className="rounded-2xl border p-4"
                    style={{ borderColor: BRAND.border, background: BRAND.card }}
                  >
                    <p className="text-2xl font-extrabold" style={{ color: BRAND.blue }}>
                      {s.value}
                    </p>
                    <p className="mt-1 text-xs text-white/50">{s.label}</p>
                  </motion.div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* FEEDBACK */}
        {(page.quote || page.media.length > 0) && (
          <section className="mt-20">
            <SectionEyebrow>Feedback</SectionEyebrow>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">
              Persönliches Feedback von {page.headline_name}

            </h2>

            {page.quote && (
              <div
                className="mt-6 rounded-2xl border p-6"
                style={{ borderColor: `${BRAND.blue}33`, background: BRAND.card }}
              >
                <Quote className="h-6 w-6" style={{ color: BRAND.blue }} />
                <p className="mt-3 text-lg leading-relaxed text-white/85 md:text-xl">{page.quote}</p>
              </div>
            )}

            {videos.length > 0 && (
              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                {videos.map((m) => (
                  <figure key={m.id} className="rounded-2xl border p-2" style={{ borderColor: BRAND.border, background: BRAND.card }}>
                    <video src={mediaUrls[m.id]} controls playsInline className="w-full rounded-xl" />
                    {m.caption && <figcaption className="px-2 py-2 text-xs text-white/50">{m.caption}</figcaption>}
                  </figure>
                ))}
              </div>
            )}

            {audios.length > 0 && (
              <div className="mt-6 space-y-3">
                {audios.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 rounded-2xl border p-4"
                    style={{ borderColor: BRAND.border, background: BRAND.card }}
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                      style={{ background: `${BRAND.blue}22`, color: BRAND.blue }}
                    >
                      <Play className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <audio src={mediaUrls[m.id]} controls className="w-full" />
                      {m.caption && <p className="mt-1 text-xs text-white/50">{m.caption}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {images.length > 0 && (
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                {images.map((m) => (
                  <figure key={m.id} className="overflow-hidden rounded-2xl border" style={{ borderColor: BRAND.border, background: BRAND.card }}>
                    <img
                      src={mediaUrls[m.id]}
                      alt={m.caption || `Feedback von ${page.headline_name}`}
                      loading="lazy"
                      className="w-full object-cover"
                    />
                    {m.caption && <figcaption className="px-3 py-2 text-xs text-white/50">{m.caption}</figcaption>}
                  </figure>
                ))}
              </div>
            )}
          </section>
        )}

        {/* TERMIN */}
        <section id="termin" className="mt-20 scroll-mt-10">
          <h2 className="text-2xl font-extrabold tracking-tight md:text-3xl">
            Lass uns{" "}
            <span className="italic font-semibold" style={accentStyle}>
              sprechen
            </span>
          </h2>
          <p className="mt-3 text-white/60">
            30 Minuten, unverbindlich. Wir schauen uns deine Situation an und sagen dir ehrlich, ob und wie wir helfen können.
          </p>

          <div
            className="mt-6 overflow-hidden rounded-2xl border"
            style={{ borderColor: BRAND.border, background: BRAND.card }}
          >
            <iframe
              src={calEmbedSrc}
              title="Termin buchen"
              className="h-[680px] w-full"
              style={{ border: "none" }}
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href={calLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold text-white"
              style={{ background: BRAND.blue }}
            >
              <CalendarCheck className="h-4 w-4" /> Termin im neuen Tab buchen
            </a>
            {page.phone && (
              <a
                href={`tel:${page.phone.replace(/\s/g, "")}`}
                className="inline-flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-semibold text-white/80"
                style={{ borderColor: BRAND.border, background: BRAND.card }}
              >
                <Phone className="h-4 w-4" /> Direkt anrufen
              </a>
            )}
          </div>
        </section>

        <p className="mt-16 text-center text-xs text-white/30">Marketlab Media</p>
      </div>
    </div>
  );
};

export default ReferralLanding;
