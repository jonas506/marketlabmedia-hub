import { useMemo, useState } from "react";
import { X, Plus, Minus, Search, ArrowRight, Sparkles, Megaphone, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import OfferDocumentEditor from "./OfferDocumentEditor";
import { buildDefaultDocument, OfferDoc, ProductType } from "./offerDocument";


export type ConfigPlan = {
  key: string;
  name: string;
  price3: number;
  price12: number;
  setup: number;
};

export type ConfigAddon = {
  name: string;
  price_text: string;
  qty: number;
};

interface Props {
  open: boolean;
  onClose: () => void;
  plans: ConfigPlan[];
  addons: { name: string; price: string }[];
}

const PRODUCTS: { key: ProductType; label: string; sub: string; icon: typeof Sparkles; color: string }[] = [
  { key: "content", label: "Content-Paket", sub: "Stufe 1–4", icon: Sparkles, color: "#0083F7" },
  { key: "trial", label: "Testmonat", sub: "30 Tage · 2.000 €", icon: CalendarCheck, color: "#F5B93B" },
  { key: "ads", label: "Ads Management", sub: "Setup + Verwaltung", icon: Megaphone, color: "#7B5CFF" },
];

const BRAND = { blue: "#0083F7", purple: "#21089B" };

export default function OfferConfigurator({ open, onClose, plans, addons }: Props) {
  const { toast } = useToast();
  const [planKey, setPlanKey] = useState<string>(plans[1]?.key ?? plans[0].key);
  const [annual, setAnnual] = useState(false);
  const [discountPct, setDiscountPct] = useState(0);
  const [selectedAddons, setSelectedAddons] = useState<Record<string, number>>({});
  const [leadSearch, setLeadSearch] = useState("");
  const [pickedLead, setPickedLead] = useState<any | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draftOfferId, setDraftOfferId] = useState<string | null>(null);
  const [draftDoc, setDraftDoc] = useState<OfferDoc | null>(null);
  const [draftSubject, setDraftSubject] = useState("");
  const [draftRecipient, setDraftRecipient] = useState({ email: "", name: "", company: "", address: "" });
  const [manualCompany, setManualCompany] = useState("");
  const [manualContact, setManualContact] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [manualAddress, setManualAddress] = useState("");


  const plan = plans.find((p) => p.key === planKey)!;
  const basePrice = annual ? plan.price12 : plan.price3;
  const monthlyPrice = Math.round(basePrice * (1 - discountPct / 100));
  const duration = annual ? 12 : 3;
  const totalLaufzeit = monthlyPrice * duration + plan.setup;

  const { data: leads } = useQuery({
    enabled: open,
    queryKey: ["offer-leads", leadSearch],
    queryFn: async () => {
      let q = supabase.from("crm_leads").select("id, name, contact_name, contact_email").order("updated_at", { ascending: false }).limit(15);
      if (leadSearch.trim()) {
        q = q.or(`name.ilike.%${leadSearch}%,contact_name.ilike.%${leadSearch}%,contact_email.ilike.%${leadSearch}%`);
      }
      const { data } = await q;
      return data ?? [];
    },
  });

  const addonList: ConfigAddon[] = useMemo(
    () => addons
      .filter((a) => (selectedAddons[a.name] ?? 0) > 0)
      .map((a) => ({ name: a.name, price_text: a.price, qty: selectedAddons[a.name] })),
    [selectedAddons, addons],
  );

  const bumpAddon = (name: string, delta: number) => {
    setSelectedAddons((prev) => {
      const next = Math.max(0, (prev[name] ?? 0) + delta);
      const copy = { ...prev };
      if (next === 0) delete copy[name];
      else copy[name] = next;
      return copy;
    });
  };

  const handleCreateDraft = async () => {
    const company = manualCompany || pickedLead?.name || "";
    const contact = manualContact || pickedLead?.contact_name || "";
    const email = manualEmail || pickedLead?.contact_email || "";
    const address = manualAddress;

    if (!email) {
      toast({ title: "E-Mail fehlt", description: "Lead auswählen oder E-Mail eintragen.", variant: "destructive" });
      return;
    }

    let offerNumber = "";
    try {
      const { data: num } = await (supabase as any).rpc("next_offer_number");
      offerNumber = (num as string) || "";
    } catch { /* Nummer optional */ }

    const doc = buildDefaultDocument({
      offerNumber,
      planName: plan.name,
      monthlyPrice,
      setupPrice: plan.setup,
      durationMonths: duration,
      discountPct,
      addons: addonList,
      recipientCompany: company,
      recipientContact: contact,
      recipientAddressLines: address.split("\n"),
    });

    const subject = `Dein Angebot ${offerNumber || ""} — Marketlab Media`.replace("  ", " ");

    const { data: user } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("offers").insert({
      lead_id: pickedLead?.id ?? null,
      plan_key: plan.key,
      plan_name: plan.name,
      duration_months: duration,
      monthly_price: monthlyPrice,
      setup_price: plan.setup,
      discount_pct: discountPct,
      addons: addonList,
      subject,
      custom_body: "",
      document: doc as any,
      offer_number: offerNumber,
      recipient_email: email,
      recipient_name: contact || company,
      recipient_company: company,
      recipient_address: address,
      status: "draft",
      created_by: user.user?.id,
    } as any).select("id").single();
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }
    setDraftOfferId(data.id);
    setDraftDoc(doc);
    setDraftSubject(subject);
    setDraftRecipient({ email, name: contact, company, address });
    setEditorOpen(true);
  };


  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside
        className="fixed right-0 top-0 z-[101] flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-white/10 bg-[#0a0a0f] text-white shadow-2xl"
        style={{ fontFamily: "'Manrope', system-ui, sans-serif" }}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#0a0a0f]/95 px-6 py-4 backdrop-blur">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: BRAND.blue }}>
              Angebots-Konfigurator
            </div>
            <div className="text-lg font-bold">Live im Call konfigurieren</div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-6 px-6 py-6">
          {/* Plan */}
          <section>
            <Label className="text-xs uppercase tracking-wider text-white/50">Paket</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {plans.map((p) => {
                const active = p.key === planKey;
                return (
                  <button
                    key={p.key}
                    onClick={() => setPlanKey(p.key)}
                    className="rounded-lg border p-3 text-left transition-all"
                    style={{
                      borderColor: active ? BRAND.blue : "rgba(255,255,255,0.1)",
                      background: active ? `${BRAND.blue}15` : "transparent",
                    }}
                  >
                    <div className="text-sm font-bold">{p.name}</div>
                    <div className="text-xs text-white/50">
                      ab {p.price12.toLocaleString("de-DE")} € / Mon.
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Laufzeit */}
          <section>
            <Label className="text-xs uppercase tracking-wider text-white/50">Laufzeit</Label>
            <div className="mt-2 inline-flex rounded-full border border-white/10 bg-white/5 p-1">
              {[
                { label: "3 Monate", value: false },
                { label: "12 Monate · -10 %", value: true },
              ].map((o) => (
                <button
                  key={o.label}
                  onClick={() => setAnnual(o.value)}
                  className="rounded-full px-4 py-1.5 text-xs font-semibold transition"
                  style={{
                    background: annual === o.value
                      ? `linear-gradient(135deg,${BRAND.blue},${BRAND.purple})`
                      : "transparent",
                    color: annual === o.value ? "#fff" : "rgba(255,255,255,0.6)",
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </section>

          {/* Rabatt */}
          <section>
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wider text-white/50">Zusätzlicher Rabatt</Label>
              <span className="text-sm font-bold" style={{ color: BRAND.blue }}>{discountPct} %</span>
            </div>
            <Slider
              className="mt-3"
              value={[discountPct]}
              onValueChange={(v) => setDiscountPct(v[0])}
              max={30}
              step={1}
            />
            <p className="mt-1 text-[11px] text-white/40">Wird auf den monatlichen Preis angewendet (Setup bleibt unberührt).</p>
          </section>

          {/* Add-ons */}
          <section>
            <Label className="text-xs uppercase tracking-wider text-white/50">Add-ons ins Angebot aufnehmen</Label>
            <p className="mb-2 mt-1 text-[11px] text-white/40">Wird bei Nutzung nach tatsächlichem Verbrauch abgerechnet.</p>
            <div className="space-y-1.5">
              {addons.map((a) => {
                const qty = selectedAddons[a.name] ?? 0;
                return (
                  <div key={a.name} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{a.name}</div>
                      <div className="text-[11px]" style={{ color: BRAND.blue }}>{a.price}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => bumpAddon(a.name, -1)} disabled={qty === 0}>
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="w-6 text-center text-sm font-bold">{qty}</span>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => bumpAddon(a.name, 1)}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Lead-Auswahl */}
          <section>
            <Label className="text-xs uppercase tracking-wider text-white/50">Empfänger (CRM-Lead)</Label>
            {pickedLead ? (
              <div className="mt-2 flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{pickedLead.name || pickedLead.contact_name}</div>
                  <div className="truncate text-xs text-white/50">{pickedLead.contact_email || "keine E-Mail"}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setPickedLead(null)}>Ändern</Button>
              </div>
            ) : (
              <>
                <div className="relative mt-2">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-white/40" />
                  <Input
                    value={leadSearch}
                    onChange={(e) => setLeadSearch(e.target.value)}
                    placeholder="Lead suchen..."
                    className="border-white/10 bg-white/[0.03] pl-8 text-white placeholder:text-white/30"
                  />
                </div>
                <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.02] p-1">
                  {(leads ?? []).map((l: any) => (
                    <button
                      key={l.id}
                      onClick={() => setPickedLead(l)}
                      className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-white/10"
                    >
                      <span className="truncate">{l.name || l.contact_name || "—"}</span>
                      <span className="truncate text-xs text-white/40">{l.contact_email || ""}</span>
                    </button>
                  ))}
                  {(leads ?? []).length === 0 && (
                    <div className="p-3 text-center text-xs text-white/40">Keine Leads gefunden</div>
                  )}
                </div>
              </>
            )}
          </section>

          {/* Kundendaten (optional, überschreibt Lead) */}
          <section>
            <Label className="text-xs uppercase tracking-wider text-white/50">Kundendaten fürs Angebot</Label>
            <p className="mb-2 mt-1 text-[11px] text-white/40">Kann auch ohne Lead ausgefüllt werden – im nächsten Schritt jederzeit änderbar.</p>
            <div className="grid grid-cols-2 gap-2">
              <Input value={manualCompany} onChange={(e) => setManualCompany(e.target.value)} placeholder="Firma" className="border-white/10 bg-white/[0.03] text-white placeholder:text-white/30" />
              <Input value={manualContact} onChange={(e) => setManualContact(e.target.value)} placeholder="Ansprechpartner" className="border-white/10 bg-white/[0.03] text-white placeholder:text-white/30" />
            </div>
            <Input value={manualEmail} onChange={(e) => setManualEmail(e.target.value)} placeholder="E-Mail" type="email" className="mt-2 border-white/10 bg-white/[0.03] text-white placeholder:text-white/30" />
            <textarea
              value={manualAddress}
              onChange={(e) => setManualAddress(e.target.value)}
              rows={2}
              placeholder={"Straße Nr.\nPLZ Ort"}
              className="mt-2 w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/30"
            />
          </section>
        </div>


        {/* Summary + CTA */}
        <footer className="sticky bottom-0 border-t border-white/10 bg-[#0a0a0f]/95 px-6 py-4 backdrop-blur">
          <div className="mb-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-white/60">Monatlich</span><span className="font-bold">{monthlyPrice.toLocaleString("de-DE")} € netto</span></div>
            <div className="flex justify-between"><span className="text-white/60">Setup einmalig</span><span className="font-bold">{plan.setup.toLocaleString("de-DE")} € netto</span></div>
            <div className="flex justify-between border-t border-white/10 pt-1"><span className="text-white/60">Gesamtinvest {duration} Monate</span><span className="font-extrabold" style={{ color: BRAND.blue }}>{totalLaufzeit.toLocaleString("de-DE")} € netto</span></div>
          </div>
          <Button
            className="h-11 w-full font-bold text-white"
            style={{ background: `linear-gradient(135deg,${BRAND.blue},${BRAND.purple})` }}
            onClick={handleCreateDraft}
          >
            Weiter zum Angebotsdokument <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </footer>
      </aside>

      <OfferDocumentEditor
        open={editorOpen}
        onClose={() => { setEditorOpen(false); setDraftOfferId(null); setDraftDoc(null); onClose(); }}
        offerId={draftOfferId}
        initialDoc={draftDoc}
        initialRecipient={draftRecipient}
        subjectDefault={draftSubject}
      />

    </>
  );
}
