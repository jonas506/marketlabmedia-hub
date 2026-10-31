import { describe, it, expect } from 'vitest';
import { VC, evaluate, contactSchema, heroFor, sequenceDays, maySendSequence } from './model';

describe('Vertriebs-Check rules', () => {
  it('each way has 5 questions', () => { expect(VC.wege.a.questions).toHaveLength(5); expect(VC.wege.b.questions).toHaveLength(5); });
  it('answer positions score 0,1,2', () => { expect(evaluate('a', [0, 1, 2, 0, 1]).total).toBe(4); });
  it('score = sum / 10 * 100 rounded', () => { expect(evaluate('a', [0, 1, 2, 0, 1]).score).toBe(40); expect(evaluate('b', [2, 2, 2, 2, 2]).score).toBe(100); });
  it('Weg A types: ≤3 Blindflug, ≤7 Lead-Hamsterrad, else Kurz vor Marktführer', () => {
    expect(evaluate('a', [1, 1, 1, 0, 0]).type.name).toBe('Blindflug');
    expect(evaluate('a', [2, 2, 2, 1, 0]).type.name).toBe('Lead-Hamsterrad');
    expect(evaluate('a', [2, 2, 2, 2, 0]).type.name).toBe('Kurz vor Marktführer');
  });
  it('Weg B types: Erst Grundlagen / Fast startklar / Startklar', () => {
    expect(evaluate('b', [0, 0, 1, 1, 1]).type.name).toBe('Erst Grundlagen');
    expect(evaluate('b', [2, 2, 2, 1, 0]).type.name).toBe('Fast startklar');
    expect(evaluate('b', [2, 2, 2, 2, 0]).type.name).toBe('Startklar');
  });
  it('cards red, then yellow, then green; ties keep question order', () => {
    expect(evaluate('a', [2, 0, 1, 0, 1]).cards.map(c => c.key)).toEqual(['cockpit', 'vertrauen', 'filter', 'tempo', 'anzeigen']);
  });
  it('weakest station: first question wins on tie', () => { expect(evaluate('a', [1, 0, 2, 0, 1]).weakest?.key).toBe('cockpit'); });
  it('no weakest station when all green', () => { expect(evaluate('b', [2, 2, 2, 2, 2]).weakest).toBeNull(); });
  it('hero by v, unknown falls back', () => { expect(heroFor('ads').b).toBe('Aber sind sie gut?'); expect(heroFor('xyz').b).toBe('Wo steht euer Vertrieb?'); expect(heroFor(null).b).toBe('Wo steht euer Vertrieb?'); });
  const base = { first_name: 'Jonas', company: 'Marketlab Test', postcode: '12345', phone: '+491234567890', email: 'test@example.org', privacy: true as const, whatsapp_consent: false, email_consent: false };
  it('postcode exactly 5 digits', () => { expect(contactSchema.safeParse(base).success).toBe(true); for (const postcode of ['1234', '123456', 'abcde']) expect(contactSchema.safeParse({ ...base, postcode }).success).toBe(false); });
  for (const field of ['first_name', 'company', 'phone', 'email']) it(`${field} required`, () => expect(contactSchema.safeParse({ ...base, [field]: '' }).success).toBe(false));
  it('privacy required', () => expect(contactSchema.safeParse({ ...base, privacy: false }).success).toBe(false));
  it('follow-up days 1,2,4,6,9,14', () => expect(sequenceDays).toEqual([1, 2, 4, 6, 9, 14]));
  it('follow-up stops without consent, on status change and unsubscribe', () => { expect(maySendSequence(true, 'neu', false)).toBe(true); expect(maySendSequence(false, 'neu', false)).toBe(false); expect(maySendSequence(true, 'angerufen', false)).toBe(false); expect(maySendSequence(true, 'neu', true)).toBe(false); });
});
