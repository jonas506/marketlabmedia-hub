import { describe, expect, it } from 'vitest';
import { actionLabel, cleanName, isTestEmail, normalizePhone, playbookFormSchema, BERATER, UMSATZ } from './model';

const valid = { first_name: 'Maximilian', last_name: 'Mustermann', email: 'max@firma.de', phone: '151 23456789', privacy: true as const };

describe('Leads-Playbook Formular', () => {
  it('verlangt alle vier Angaben und den Datenschutz', () => {
    for (const key of ['first_name', 'last_name', 'email', 'phone', 'privacy'] as const) {
      expect(playbookFormSchema.safeParse({ ...valid, [key]: key === 'privacy' ? false : '' }).success).toBe(false);
    }
  });
  it('übernimmt einen vollständigen Eintrag', () => {
    expect(playbookFormSchema.parse(valid).phone).toBe('+4915123456789');
  });
  it('säubert und normalisiert Namen', () => {
    expect(cleanName('  anna-maria   <script> ')).toBe('Anna-Maria Script');
    expect(cleanName('MAXIMILIAN')).toBe('Maximilian');
  });
  it('normalisiert deutsche Rufnummern', () => {
    expect(normalizePhone('0151 23456789')).toBe('+4915123456789');
    expect(normalizePhone('0049 151 23456789')).toBe('+4915123456789');
    expect(normalizePhone('+49 (0)151 23456789')).toBe('+4915123456789');
  });
  it('behält andere internationale Vorwahlen', () => {
    expect(normalizePhone('+41 79 123 45 67')).toBe('+41791234567');
  });
  it('erkennt ausschließlich @example.com als Testadresse', () => {
    expect(isTestEmail('Test@Example.com')).toBe(true);
    expect(isTestEmail('max@example.com.de')).toBe(false);
  });
  it('kennt fünf Berater-Typen und fünf Umsatz-Stufen', () => {
    expect(BERATER).toHaveLength(5);
    expect(UMSATZ).toHaveLength(5);
  });
  it('beendet die Aktion nach ihrem Datum', () => {
    expect(actionLabel('2027-01-01', new Date('2026-11-14T12:00:00Z'))).toBe('Nur bis 01.01.2027 kostenfrei:');
    expect(actionLabel('2026-01-01', new Date('2026-11-14T12:00:00Z'))).toBe('Kostenfrei:');
  });
});
