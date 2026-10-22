import { describe, expect, it } from 'vitest';
import { deadlineFromDate, isExpired, validAcceptance } from './offer-acceptance';
import { parsePdfOfferFields } from './pdf-offer-fields';

describe('offer acceptance rules', () => {
  it('requires a company function', () => {
    expect(validAcceptance('', 'A')).toBe(false);
    expect(validAcceptance('Geschäftsführer', 'A')).toBe(true);
  });
  it('requires one of the two payment variants', () => {
    expect(validAcceptance('Geschäftsführer', '')).toBe(false);
    expect(validAcceptance('Geschäftsführer', 'C')).toBe(false);
    expect(validAcceptance('Geschäftsführer', 'A')).toBe(true);
    expect(validAcceptance('Geschäftsführer', 'B')).toBe(true);
  });
  it('expires after the complete validity day in Berlin', () => {
    const deadline = deadlineFromDate('2026-10-22');
    expect(deadline).toBe('2026-10-22T21:59:59.999Z');
    expect(isExpired(deadline, Date.parse('2026-10-22T21:59:59.999Z'))).toBe(false);
    expect(isExpired(deadline, Date.parse('2026-10-22T22:00:00.000Z'))).toBe(true);
    expect(deadlineFromDate('2026-12-12')).toBe('2026-12-12T22:59:59.999Z');
  });
  it('reads validity from the explicit date line', () => {
    expect(parsePdfOfferFields('Gültig bis 22.10.2026').validUntil).toBe('2026-10-22');
    expect(parsePdfOfferFields('Gültig bis 31.02.2026').validUntil).toBeNull();
    expect(parsePdfOfferFields('Angebotsdatum 22.10.2026').validUntil).toBeNull();
  });
  it('reads the net total rather than a larger unrelated amount', () => {
    expect(parsePdfOfferFields('Budget 99.999,00 € Gesamt (6 Monate, netto): 33.000,00 € Brutto 39.270,00 €').amount).toBe(33000);
    expect(parsePdfOfferFields('Gesamt (Laufzeit, netto): 33 000,50 EUR').amount).toBe(33000.5);
    expect(parsePdfOfferFields('Brutto 39.270,00 €').amount).toBeNull();
  });
});