import { Fragment, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Phone, Quote, Sparkles, Play, Check, X, ArrowDown, Calendar } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  AgencySections,
  BRAND,
  NOISE_SVG_URI,
  SectionEyebrow,
  accentStyle as sharedAccentStyle,
} from "@/components/referral/AgencySections";



type ResultBlock =
  | { kind: "heading"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "text"; text: string };

const parseResults = (raw: string): ResultBlock[] => {
  const blocks: ResultBlock[] = [];
  raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line) => {
      const bullet = line.replace(/^[•\-–*]\s*/, "");
      if (/^[•\-–*]\s*/.test(line)) {
        const last = blocks[blocks.length - 1];
        if (last && last.kind === "bullets") last.items.push(bullet);
        else blocks.push({ kind: "bullets", items: [bullet] });
      } else if (line.endsWith(":") && line.length < 80) {
        const heading = line.replace(/:$/, "");
        if (!/^was wir f(ü|ue)r/i.test(heading)) blocks.push({ kind: "heading", text: heading });
      } else {
        blocks.push({ kind: "text", text: line });
      }
    });
  return blocks;
};





interface MediaItem {
  id: string;
  type: string;
  url: string;
  caption?: string | null;
  category?: string | null;
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
  const [lightbox, setLightbox] = useState<{ src: string; caption?: string | null } | null>(null);


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
  const cat = (c: string) => images.filter((m) => (m.category || "other") === c);
  const websiteImages = cat("website");
  const socialImages = cat("social");
  const adsImages = cat("ads");
  const feedbackImages = [...cat("feedback"), ...cat("other")];

  const resultBlocks = page.results_text ? parseResults(page.results_text) : [];
  const hasResultImages = websiteImages.length + socialImages.length + adsImages.length > 0;

  const accentStyle = sharedAccentStyle;

  const MediaHeading = ({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) => (
    <div className="pt-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: BRAND.blue }}>
        {eyebrow}
      </p>
      <h3 className="mt-1.5 text-xl font-extrabold tracking-tight md:text-2xl">{children}</h3>
    </div>
  );

  const websiteBlock = websiteImages.length > 0 && (
    <div className="space-y-5">
      <MediaHeading eyebrow="Website">Website überarbeitet</MediaHeading>
      {websiteImages.map((m) => (
        <motion.figure
          key={m.id}
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          onClick={() => mediaUrls[m.id] && setLightbox({ src: mediaUrls[m.id], caption: m.caption })}
          className="cursor-zoom-in overflow-hidden rounded-3xl border"
          style={{ borderColor: BRAND.border, background: BRAND.card }}
        >
          <div className="flex items-center gap-1.5 border-b px-4 py-2.5" style={{ borderColor: BRAND.border }}>
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          </div>
          <img
            src={mediaUrls[m.id]}
            alt={m.caption || `Website von ${page.headline_name}`}
            loading="lazy"
            className="w-full object-contain"
          />
          {m.caption && (
            <figcaption className="px-5 py-4 text-sm leading-relaxed text-white/55">{m.caption}</figcaption>
          )}
        </motion.figure>
      ))}
    </div>
  );

  const socialBlock = socialImages.length > 0 && (
    <div className="space-y-5">
      <MediaHeading eyebrow="Social Media">Social Media überarbeitet</MediaHeading>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {socialImages.map((m, i) => (
          <motion.figure
            key={m.id}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: (i % 2) * 0.06 }}
            onClick={() => mediaUrls[m.id] && setLightbox({ src: mediaUrls[m.id], caption: m.caption })}
            className="cursor-zoom-in overflow-hidden rounded-2xl border transition-transform hover:-translate-y-1"
            style={{ borderColor: BRAND.border, background: BRAND.card }}
          >
            <div className="flex items-center justify-center bg-black/30 p-3">
              <img
                src={mediaUrls[m.id]}
                alt={m.caption || `Social Media von ${page.headline_name}`}
                loading="lazy"
                className="max-h-[520px] w-full rounded-xl object-contain"
              />
            </div>
            {m.caption && (
              <figcaption className="px-4 py-3 text-sm leading-relaxed text-white/55">{m.caption}</figcaption>
            )}
          </motion.figure>
        ))}
      </div>
    </div>
  );

  const adsBlock = adsImages.length > 0 && (
    <div className="space-y-5">
      <MediaHeading eyebrow="Performance">Ergebnisse über Ads</MediaHeading>
      <p className="max-w-2xl text-sm leading-relaxed text-white/50">
        Echte Screenshots aus dem Werbekonto – inklusive Kosten pro Ergebnis.
      </p>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {adsImages.map((m, i) => (
          <motion.figure
            key={m.id}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: (i % 2) * 0.06 }}
            onClick={() => mediaUrls[m.id] && setLightbox({ src: mediaUrls[m.id], caption: m.caption })}
            className="flex cursor-zoom-in flex-col overflow-hidden rounded-2xl border"
            style={{ borderColor: `${BRAND.blue}33`, background: BRAND.card }}
          >
            {m.caption && (
              <figcaption
                className="border-b px-5 py-4 text-base font-bold leading-snug text-white md:text-lg"
                style={{ borderColor: BRAND.border }}
              >
                {m.caption}
              </figcaption>
            )}
            <div className="flex flex-1 items-center justify-center bg-black/30 p-3">
              <img
                src={mediaUrls[m.id]}
                alt={m.caption || `Werbeergebnisse von ${page.headline_name}`}
                loading="lazy"
                className="max-h-[460px] w-full rounded-xl object-contain"
              />
            </div>
          </motion.figure>
        ))}
      </div>
    </div>
  );




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

      <div className="relative z-10 mx-auto max-w-5xl px-6 py-12 md:py-16">

        {/* HERO */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="grid items-center gap-10 md:grid-cols-[minmax(0,1fr)_auto]"
        >
          <div className="order-2 md:order-1">
            <div
              className="mb-5 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] backdrop-blur"
              style={{ borderColor: `${BRAND.blue}4D`, background: `${BRAND.blue}14`, color: BRAND.blue }}
            >
              <Sparkles className="h-3.5 w-3.5" /> Persönliche Empfehlung
            </div>
            <h1 className="text-4xl font-extrabold leading-[1.03] tracking-tight md:text-6xl">
              {page.headline_name}
              <br />
              <span className="text-white/45">empfiehlt</span>{" "}
              <span className="italic font-semibold" style={accentStyle}>
                Marketlab Media
              </span>
            </h1>
            {page.role_title && (
              <p className="mt-4 text-sm font-medium uppercase tracking-[0.14em] text-white/40">
                {page.role_title}
              </p>
            )}
            {page.intro_text && (
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/70 md:text-lg">
                {page.intro_text}
              </p>
            )}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#termin"
                className="inline-flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-bold text-white transition-all hover:scale-[1.03]"
                style={{
                  background: `linear-gradient(135deg, ${BRAND.blue}, ${BRAND.blueSoft})`,
                  boxShadow: `0 18px 46px -18px ${BRAND.blue}`,
                }}
              >
                <Calendar className="h-4 w-4" /> Kostenloses Erstgespräch
              </a>
              {page.phone && (
                <a
                  href={`tel:${page.phone.replace(/\s/g, "")}`}
                  className="inline-flex items-center gap-2 rounded-2xl border px-5 py-3.5 text-sm font-semibold text-white/75 transition-colors hover:text-white"
                  style={{ borderColor: BRAND.border, background: BRAND.card }}
                >
                  <Phone className="h-4 w-4" /> {page.phone}
                </a>
              )}
            </div>
          </div>

          {photo && (
            <div className="relative order-1 md:order-2">
              <div
                aria-hidden
                className="absolute -inset-6 rounded-[2.5rem] blur-2xl"
                style={{ background: `radial-gradient(circle at 50% 40%, ${BRAND.blue}33, transparent 70%)` }}
              />
              <div
                className="relative overflow-hidden rounded-[1.75rem] border p-1.5"
                style={{ borderColor: `${BRAND.blue}33`, background: BRAND.card }}
              >
                <img
                  src={photo}
                  alt={`${page.headline_name}, Kunde von Marketlab Media`}
                  className="h-44 w-44 rounded-[1.4rem] object-cover md:h-60 md:w-60"
                />
              </div>
            </div>
          )}
        </motion.section>

        {page.stats?.length > 0 && (
          <div className="mt-14 grid grid-cols-2 gap-3 md:grid-cols-4">
            {page.stats.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.07 }}
                className="relative overflow-hidden rounded-2xl border p-5 transition-colors"
                style={{
                  borderColor: BRAND.border,
                  background: `linear-gradient(160deg, ${BRAND.card}, ${BRAND.bg})`,
                }}
              >
                <div
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-px"
                  style={{ background: `linear-gradient(90deg, transparent, ${BRAND.blue}80, transparent)` }}
                />
                <p className="text-2xl font-extrabold tracking-tight md:text-3xl" style={{ color: BRAND.blue }}>
                  {s.value}
                </p>
                <p className="mt-1.5 text-xs leading-snug text-white/45">{s.label}</p>
              </motion.div>
            ))}
          </div>
        )}

        {/* ERGEBNISSE + PASSENDE BILDER */}
        {(resultBlocks.length > 0 || hasResultImages) && (
          <section className="mt-16">
            <SectionEyebrow>Ergebnisse</SectionEyebrow>
            <h2 className="mt-2 max-w-3xl text-3xl font-extrabold tracking-tight md:text-4xl">
              Was wir für {page.headline_name}{" "}
              <span className="italic font-semibold" style={accentStyle}>
                gemacht
              </span>{" "}
              haben
            </h2>

            <div className="mt-8 space-y-10">
              {hasResultImages ? (
                <>
                  {websiteBlock}
                  {socialBlock}
                  {adsBlock}
                </>
              ) : (
                <div className="space-y-6">
                  {resultBlocks.map((b, i) => {
                    if (b.kind === "heading")
                      return (
                        <h3
                          key={i}
                          className="pt-2 text-[11px] font-bold uppercase tracking-[0.2em] text-white/40"
                        >
                          {b.text}
                        </h3>
                      );
                    if (b.kind === "text")
                      return (
                        <p key={i} className="max-w-3xl text-base leading-relaxed text-white/70">
                          {b.text}
                        </p>
                      );
                    return (
                      <div key={i} className="grid gap-3 md:grid-cols-2">
                        {b.items.map((item, j) => (
                          <motion.div
                            key={j}
                            initial={{ opacity: 0, y: 14 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.45, delay: j * 0.05 }}
                            className="flex gap-3 rounded-2xl border p-4"
                            style={{ borderColor: BRAND.border, background: BRAND.card }}
                          >
                            <span
                              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                              style={{ background: `${BRAND.blue}1F`, color: BRAND.blue }}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </span>
                            <p className="text-sm leading-relaxed text-white/75">{item}</p>
                          </motion.div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}


        {/* FEEDBACK */}
        {(page.quote || feedbackImages.length > 0 || videos.length > 0 || audios.length > 0) && (
          <section className="mt-24">
            <SectionEyebrow>Feedback</SectionEyebrow>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">
              Feedback von{" "}
              <span className="italic font-semibold" style={accentStyle}>
                {page.headline_name}
              </span>
            </h2>

            {page.quote && (
              <figure
                className="relative mt-8 overflow-hidden rounded-3xl border p-7 md:p-10"
                style={{
                  borderColor: `${BRAND.blue}2E`,
                  background: `linear-gradient(140deg, ${BRAND.card}, ${BRAND.bg} 70%)`,
                }}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-10 -top-12 text-[10rem] font-black leading-none opacity-[0.07]"
                  style={{ color: BRAND.blue, fontFamily: "'Playfair Display', serif" }}
                >
                  ”
                </div>
                <Quote className="h-7 w-7" style={{ color: BRAND.blue }} />
                <blockquote className="relative mt-4 text-lg leading-relaxed text-white/90 md:text-2xl md:leading-relaxed">
                  {page.quote}
                </blockquote>
                <figcaption className="mt-5 text-sm text-white/45">
                  — {page.headline_name}
                  {page.role_title ? `, ${page.role_title}` : ""}
                </figcaption>
              </figure>
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

            {feedbackImages.length > 0 && (
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {feedbackImages.map((m, i) => (
                  <motion.figure
                    key={m.id}
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: (i % 2) * 0.06 }}
                    onClick={() => mediaUrls[m.id] && setLightbox({ src: mediaUrls[m.id], caption: m.caption })}
                    className="group flex cursor-zoom-in flex-col overflow-hidden rounded-2xl border transition-transform hover:-translate-y-1"
                    style={{ borderColor: BRAND.border, background: BRAND.card }}
                  >
                    <div className="flex items-center justify-center bg-black/30 p-3">
                      <img
                        src={mediaUrls[m.id]}
                        alt={m.caption || `Feedback von ${page.headline_name}`}
                        loading="lazy"
                        className="max-h-[520px] w-full rounded-xl object-contain"
                      />
                    </div>
                    {m.caption && (
                      <figcaption className="px-4 py-3 text-sm leading-relaxed text-white/55">{m.caption}</figcaption>
                    )}
                  </motion.figure>
                ))}
              </div>
            )}

            <div className="mt-10 flex justify-center">
              <a
                href="#termin"
                className="inline-flex items-center gap-2 text-sm font-semibold text-white/60 transition-colors hover:text-white"
              >
                <ArrowDown className="h-4 w-4" /> Jetzt selbst Termin sichern
              </a>
            </div>
          </section>
        )}



        <AgencySections />

        {/* TERMIN */}
        <section id="termin" className="mt-20 scroll-mt-10">
          <SectionEyebrow>Termin</SectionEyebrow>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">
            Lass uns{" "}
            <span className="italic font-semibold" style={accentStyle}>
              sprechen
            </span>
          </h2>
          <p className="mt-3 text-white/60">
            30 Minuten, unverbindlich. Wir schauen uns deine Situation an und sagen dir ehrlich, ob und wie wir helfen können.
          </p>

          <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
            <div className="p-6 text-center md:p-10">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Calendar className="h-7 w-7" />
              </div>
              <h3 className="mt-5 text-xl font-bold text-slate-900 md:text-2xl">Kostenloses Erstgespräch buchen</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                Wähle direkt einen passenden Slot im Kalender aus – ohne Hin-und-Her per Mail.
              </p>
            </div>
            <iframe
              src={
                page.cal_link ||
                "https://calendar.google.com/calendar/appointments/schedules/AcZssZ1g8kUjplXlZ8xfSYs5M2vC3oSMuKwauzD2vZX9W00914jUnGeTmXu2oDaHCn5isEsYOeS-xZ7B?gv=true"
              }
              style={{ border: 0 }}
              width="100%"
              height="600"
              frameBorder="0"
              title="Terminbuchung"
            />
            <div className="flex flex-wrap items-center justify-center gap-3 border-t border-slate-100 p-6">
              {page.phone && (
                <a
                  href={`tel:${page.phone.replace(/\s/g, "")}`}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                >
                  <Phone className="h-4 w-4" /> {page.phone}
                </a>
              )}
            </div>
          </div>
        </section>

        <p className="mt-12 text-center text-xs text-white/30">Marketlab Media</p>
      </div>

      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightbox(null)}
            className="fixed inset-0 z-[9998] flex cursor-zoom-out flex-col items-center justify-center gap-4 p-6 backdrop-blur-sm"
            style={{ background: "rgba(3,4,10,0.92)" }}
          >
            <motion.img
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              src={lightbox.src}
              alt={lightbox.caption || "Feedback"}
              className="max-h-[82vh] max-w-full rounded-2xl object-contain"
            />
            {lightbox.caption && (
              <p className="max-w-xl text-center text-sm text-white/60">{lightbox.caption}</p>
            )}
            <button
              type="button"
              aria-label="Schließen"
              className="absolute right-5 top-5 rounded-full border p-2 text-white/70 transition-colors hover:text-white"
              style={{ borderColor: BRAND.border, background: BRAND.card }}
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>

  );
};

export default ReferralLanding;
