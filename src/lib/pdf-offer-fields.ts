import { parseGermanDate } from './offer-acceptance';

export function parsePdfOfferFields(firstPageText: string) {
  const validity = firstPageText.match(/Gültig\s+bis\s*:?\s*(\d{2}\.\d{2}\.\d{4})/i);
  const total = firstPageText.match(/Gesamt\s*\([^)]*\bnetto\s*\)\s*:\s*(?:€|EUR)?\s*(\d+(?:[.\s]\d{3})*(?:,\d{2})?)/i);
  const amount = total ? Number(total[1].replace(/[.\s]/g, '').replace(',', '.')) : null;
  return {
    amount: amount !== null && Number.isFinite(amount) ? amount : null,
    source: total ? 'Gesamt (netto), Seite 1' : null,
    validUntil: validity ? parseGermanDate(validity[1]) : null,
  };
}