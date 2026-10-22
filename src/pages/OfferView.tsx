import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import OfferDocumentView from "@/components/pricing/OfferDocumentView";
import type { OfferDoc } from "@/components/pricing/offerDocument";
import AcceptanceFields from '@/components/documents/AcceptanceFields';
import { CONSENT_TEXT, deadlineFromDate, isExpired, parseGermanDate, paymentLabel, validAcceptance } from '@/lib/offer-acceptance';


const BRAND = { blue: "#0083F7", purple: "#21089B", bg: "#0a0a0f" };
const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/offer-public`;

interface Offer {
  id: string;
  plan_name: string;
  duration_months: number;
  monthly_price: number;
  setup_price: number;
  discount_pct: number;
  addons: { name: string; price_text: string; qty: number }[];
  subject: string;
  custom_body: string;
  recipient_name: string | null;
  status: string;
  accepted_at: string | null;
  document?: OfferDoc | null;
  company_role: string | null;
  payment_variant: string | null;
}

export default function OfferView() {
  const { token } = useParams<{ token: string }>();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companyRole, setCompanyRole] = useState('');
  const [payment, setPayment] = useState('');
  const [now, setNow] = useState(Date.now());
  const date = offer?.document?.validValue ? parseGermanDate(offer.document.validValue) : null;
  const expired = isExpired(date ? deadlineFromDate(date) : null, now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    document.title = "Dein Angebot — Marketlab Media";
    (async () => {
      try {
        const res = await fetch(`${FN_URL}?token=${token}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Angebot nicht gefunden");
        setOffer(data);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleAccept = async () => {
    if (!token || expired || !validAcceptance(companyRole, payment)) return;
    setConfirmOpen(false);
    setAccepting(true);
    try {
      const res = await fetch(FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, company_role: companyRole.trim(), payment_variant: payment, consent: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fehler bei der Bestätigung");
      setOffer((o) => o ? { ...o, status: "accepted", accepted_at: data.accepted_at ?? new Date().toISOString(), company_role: companyRole.trim(), payment_variant: payment } : o);
    } catch (e: any) {
      alert("Fehler: " + e.message);
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-white" style={{ background: BRAND.bg }}>
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error || !offer) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-white" style={{ background: BRAND.bg }}>
        <div className="max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <div className="text-xl font-bold">Angebot nicht verfügbar</div>
          <p className="mt-2 text-sm text-white/60">{error || "Der Link ist ungültig oder abgelaufen."}</p>
        </div>
      </div>
    );
  }

  const accepted = offer.status === "accepted";
  const totalLaufzeit = offer.monthly_price * offer.duration_months + offer.setup_price;

  const doc = offer.document;
  const hasDoc = doc && Array.isArray(doc.positions);

  const confirmation = <ConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen} onConfirm={handleAccept} companyRole={companyRole} onCompanyRoleChange={setCompanyRole} payment={payment} onPaymentChange={setPayment} expired={expired} />;
  const protocol = accepted && <dl className="mt-4 space-y-2 text-sm text-muted-foreground">
    <div><dt>Funktion</dt><dd>{offer.company_role ?? '—'}</dd></div>
    <div><dt>Zahlungsvariante</dt><dd>{paymentLabel(offer.payment_variant)}</dd></div>
  </dl>;

  if (hasDoc && doc) {
    return (
      <div className="min-h-screen bg-[#eef1f6] py-8">
        <div id="offer-print-area" className="mx-auto w-fit max-w-full overflow-x-auto px-3">
          <div className="offer-doc-shadow">
            <OfferDocumentView doc={doc} />
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-[794px] px-3 text-center">
          {accepted ? (
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-5 py-3 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-semibold">Angebot angenommen — willkommen an Bord!</span>
            </div>
          ) : (
            <>
              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={accepting || expired}
                className="h-14 w-full max-w-md px-10 text-base font-bold text-white"
                style={{ background: `linear-gradient(135deg,${BRAND.blue},${BRAND.purple})` }}
              >
                {accepting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ShieldCheck className="mr-2 h-5 w-5" />}
                Angebot verbindlich annehmen
              </Button>
              <p className="mt-3 text-xs text-slate-500">
                Mit einem Klick bestätigst du das Angebot rechtsverbindlich. Du erhältst anschließend eine Bestätigung.
              </p>
            </>
          )}
          {expired && !accepted && <p className="mt-3 text-sm text-destructive">Dieses Angebot ist abgelaufen.</p>}
          {protocol}
          <button onClick={() => window.print()} className="mt-6 block w-full text-xs text-slate-400 underline">
            Als PDF speichern / drucken
          </button>
        </div>
        {confirmation}
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white" style={{ background: BRAND.bg, fontFamily: "'Manrope', system-ui, sans-serif" }}>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-0"
        style={{ background: "radial-gradient(60% 50% at 50% 0%, rgba(0,131,247,0.18) 0%, transparent 70%)" }}
      />
      <div className="relative z-10 mx-auto max-w-3xl px-6 py-16 md:py-24">
        <div className="mb-6 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: BRAND.blue }}>
          Marketlab Media · Angebot
        </div>
        <h1 className="text-3xl font-extrabold md:text-4xl">{offer.subject}</h1>

        <article
          className="prose prose-invert mt-8 max-w-none rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8"
          dangerouslySetInnerHTML={{ __html: offer.custom_body }}
        />

        {/* Summary */}
        <div className="mt-8 rounded-2xl border p-6" style={{ borderColor: `${BRAND.blue}55`, background: `linear-gradient(135deg,${BRAND.blue}14,${BRAND.purple}14)` }}>
          <div className="text-xs uppercase tracking-wider text-white/50">Zusammenfassung</div>
          <div className="mt-3 space-y-2 text-sm">
            <Row label="Paket" value={offer.plan_name} />
            <Row label="Laufzeit" value={`${offer.duration_months} Monate`} />
            <Row label="Monatlich" value={`${offer.monthly_price.toLocaleString("de-DE")} € netto`} />
            <Row label="Einmaliges Setup" value={`${offer.setup_price.toLocaleString("de-DE")} € netto`} />
            <div className="my-2 h-px bg-white/10" />
            <Row label="Gesamtinvest Laufzeit" value={`${totalLaufzeit.toLocaleString("de-DE")} € netto`} bold />
          </div>
        </div>


        {/* CTA */}
        <div className="mt-10 text-center">
          {accepted ? (
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-5 py-3 text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-semibold">Angebot angenommen — willkommen an Bord!</span>
            </div>
          ) : (
            <>
              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={accepting || expired}
                className="h-14 px-10 text-base font-bold text-white"
                style={{ background: `linear-gradient(135deg,${BRAND.blue},${BRAND.purple})` }}
              >
                {accepting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ShieldCheck className="mr-2 h-5 w-5" />}
                Verbindlich annehmen
              </Button>
              <p className="mt-3 text-xs text-white/40">Mit einem Klick bestätigst du das Angebot rechtsverbindlich.</p>
            </>
          )}
          {expired && !accepted && <p className="mt-3 text-sm text-destructive">Dieses Angebot ist abgelaufen.</p>}
          {protocol}
        </div>
      </div>
      {confirmation}
    </div>
  );
}

const Row = ({ label, value, bold }: { label: string; value: string; bold?: boolean }) => (
  <div className="flex items-center justify-between gap-4">
    <span className="text-white/60">{label}</span>
    <span className={bold ? "text-lg font-extrabold" : "font-semibold"} style={bold ? { color: BRAND.blue } : undefined}>{value}</span>
  </div>
);

const ConfirmDialog = ({ open, onOpenChange, onConfirm, companyRole, onCompanyRoleChange, payment, onPaymentChange, expired }: {
  open: boolean; onOpenChange: (v: boolean) => void; onConfirm: () => void;
  companyRole: string; onCompanyRoleChange: (v: string) => void;
  payment: string; onPaymentChange: (v: string) => void; expired: boolean;
}) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent className="max-h-[90vh] overflow-y-auto">
      <AlertDialogHeader>
        <AlertDialogTitle>Angebot verbindlich annehmen?</AlertDialogTitle>
        <AlertDialogDescription>
          Mit der Bestätigung kommt ein Vertrag zwischen dir und der Marketlab Media UG (haftungsbeschränkt)
          zu den im Angebot genannten Konditionen zustande. Du erhältst anschließend eine Bestätigung per E-Mail.
          {' '}{CONSENT_TEXT}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AcceptanceFields role={companyRole} onRoleChange={onCompanyRoleChange} payment={payment} onPaymentChange={onPaymentChange} />
      <AlertDialogFooter>
        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
        <AlertDialogAction disabled={expired || !validAcceptance(companyRole, payment)} onClick={onConfirm}>Verbindlich annehmen</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
