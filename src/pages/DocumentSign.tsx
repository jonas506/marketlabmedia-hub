import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Download, FileText, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

const BRAND = { blue: "#0083F7", purple: "#21089B", bg: "#0a0a0f" };
const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/document-public`;

interface DocData {
  id: string;
  title: string;
  subject: string;
  message_body: string | null;
  recipient_name: string | null;
  file_name: string | null;
  status: string;
  accepted_at: string | null;
  consent_text: string;
  pdf_url: string | null;
  acceptance: { typed_name: string; accepted_at: string } | null;
}

export default function DocumentSign() {
  const { token } = useParams<{ token: string }>();
  const [doc, setDoc] = useState<DocData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Dokument bestätigen — Marketlab Media";
    (async () => {
      try {
        const res = await fetch(`${FN_URL}?token=${token}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Dokument nicht gefunden");
        setDoc(data);
        if (data.recipient_name) setName(data.recipient_name);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleAccept = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, typed_name: name.trim(), consent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fehler bei der Bestätigung");
      setDoc((d) =>
        d
          ? {
              ...d,
              status: "accepted",
              accepted_at: data.accepted_at,
              acceptance: { typed_name: name.trim(), accepted_at: data.accepted_at },
            }
          : d,
      );
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-white" style={{ background: BRAND.bg }}>
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-white" style={{ background: BRAND.bg }}>
        <div className="max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <div className="text-xl font-bold">Dokument nicht verfügbar</div>
          <p className="mt-2 text-sm text-white/60">{error || "Der Link ist ungültig oder abgelaufen."}</p>
        </div>
      </div>
    );
  }

  const accepted = doc.status === "accepted";
  const canSubmit = name.trim().length >= 2 && consent && !submitting;

  return (
    <div className="min-h-screen text-white" style={{ background: BRAND.bg, fontFamily: "'Manrope', system-ui, sans-serif" }}>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-0"
        style={{ background: "radial-gradient(60% 50% at 50% 0%, rgba(0,131,247,0.18) 0%, transparent 70%)" }}
      />
      <div className="relative z-10 mx-auto max-w-3xl px-5 py-12 md:py-20">
        <div className="mb-5 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: BRAND.blue }}>
          Marketlab Media · Dokument
        </div>
        <h1 className="text-3xl font-extrabold md:text-4xl">{doc.title}</h1>

        {doc.message_body && (
          <div className="mt-6 space-y-3 text-sm leading-relaxed text-white/70">
            {doc.message_body.split("\n").map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        )}

        {/* PDF */}
        <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2 text-sm text-white/70">
              <FileText className="h-4 w-4 shrink-0" style={{ color: BRAND.blue }} />
              <span className="truncate">{doc.file_name || "Dokument.pdf"}</span>
            </div>
            {doc.pdf_url && (
              <a
                href={doc.pdf_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10"
              >
                <Download className="h-3.5 w-3.5" /> Herunterladen
              </a>
            )}
          </div>
          {doc.pdf_url && (
            <iframe
              src={`${doc.pdf_url}#view=FitH`}
              title="Dokument"
              className="h-[600px] w-full bg-white"
            />
          )}
        </div>

        {/* Acceptance */}
        <div className="mt-8">
          {accepted ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" />
              <div className="mt-3 text-lg font-bold text-emerald-300">Verbindlich angenommen</div>
              <p className="mt-1 text-sm text-white/60">
                {doc.acceptance?.typed_name ? `Von ${doc.acceptance.typed_name} · ` : ""}
                {doc.accepted_at
                  ? new Date(doc.accepted_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })
                  : ""}
              </p>
              <p className="mt-3 text-xs text-white/40">
                Eine Bestätigung mit Protokoll wurde per E-Mail versendet.
              </p>
            </div>
          ) : (
            <div
              className="rounded-2xl border p-6"
              style={{ borderColor: `${BRAND.blue}55`, background: `linear-gradient(135deg,${BRAND.blue}14,${BRAND.purple}14)` }}
            >
              <div className="text-xs uppercase tracking-wider text-white/50">Verbindliche Annahme</div>

              <label className="mt-4 block text-sm font-semibold text-white/80" htmlFor="typed-name">
                Vollständiger Name
              </label>
              <Input
                id="typed-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                placeholder="Max Mustermann"
                className="mt-2 h-12 border-white/15 bg-white/5 text-white placeholder:text-white/30"
              />

              <div className="mt-4 flex items-start gap-3">
                <Checkbox
                  id="consent"
                  checked={consent}
                  onCheckedChange={(v) => setConsent(v === true)}
                  className="mt-0.5 border-white/30"
                />
                <label htmlFor="consent" className="cursor-pointer text-sm leading-relaxed text-white/70">
                  {doc.consent_text}
                </label>
              </div>

              {submitError && <p className="mt-3 text-sm text-red-400">{submitError}</p>}

              <Button
                onClick={handleAccept}
                disabled={!canSubmit}
                className="mt-6 h-14 w-full text-base font-bold text-white disabled:opacity-40"
                style={{ background: `linear-gradient(135deg,${BRAND.blue},${BRAND.purple})` }}
              >
                {submitting ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <ShieldCheck className="mr-2 h-5 w-5" />
                )}
                Verbindlich annehmen
              </Button>
              <p className="mt-3 text-center text-xs text-white/40">
                Zeitpunkt, IP-Adresse und Gerät werden zur Beweissicherung protokolliert.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
