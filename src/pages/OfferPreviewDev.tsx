import OfferDocumentView from "@/components/pricing/OfferDocumentView";
import { buildDefaultDocument } from "@/components/pricing/offerDocument";

const doc = buildDefaultDocument({
  offerNumber: "A-2026-020",
  planName: "Overlay-Reels",
  monthlyPrice: 1500,
  setupPrice: 2000,
  durationMonths: 3,
  discountPct: 0,
  addons: [],
  recipientCompany: "Schneider Finanzierungen GmbH",
  recipientContact: "Christoph Goertz",
  recipientAddressLines: ["Bahnstraße 1 · 40878 Ratingen"],
});
doc.optionalEnabled = true;
doc.timelineEnabled = true;

export default function OfferPreviewDev() {
  return (
    <div style={{ background: "#eef1f6", padding: 24 }}>
      <div id="offer-print-area" className="mx-auto w-fit">
        <OfferDocumentView doc={doc} />
      </div>
    </div>
  );
}
