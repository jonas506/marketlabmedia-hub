import { z } from 'zod';

export const PLAYBOOK_PRIVACY_TEXT = 'Ich habe die Datenschutzerklärung gelesen. Marketlab Media darf mich zum Playbook per E-Mail und telefonisch kontaktieren.';
export const BERATER = ['Makler', 'Finanzberater', 'Versicherungsmakler', 'Kapitalanlage-Vertrieb', 'Sonstiges'] as const;
export const UMSATZ = ['Unter 5.000 €', '5.000 bis 15.000 €', '15.000 bis 50.000 €', '50.000 bis 150.000 €', 'Über 150.000 €'] as const;

export function cleanName(value: string) {
  let name = value.trim().replace(/\s+/g, ' ').replace(/[^\p{L}\p{M} .'-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 100);
  if (name && (name === name.toLowerCase() || name === name.toUpperCase())) {
    name = name.toLocaleLowerCase('de-DE').replace(/(^|[\s'-])(\p{L})/gu, (_match, prefix: string, letter: string) => prefix + letter.toLocaleUpperCase('de-DE'));
  }
  return name;
}

export function normalizePhone(value: string) {
  const raw = value.trim().replace(/[\s()/-]/g, '');
  if (raw.startsWith('+') && !raw.startsWith('+49') && !raw.startsWith('+490')) return `+${raw.slice(1).replace(/\D/g, '')}`;
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0049')) digits = `49${digits.slice(4)}`;
  else if (digits.startsWith('490')) digits = `49${digits.slice(3)}`;
  else if (digits.startsWith('0')) digits = `49${digits.slice(1)}`;
  else if (!digits.startsWith('49')) digits = `49${digits}`;
  return `+${digits}`;
}

const name = (label: string) => z.string({ required_error: `Bitte gib deinen ${label} an.` }).trim().min(1, `Bitte gib deinen ${label} an.`).max(100).transform(cleanName).refine(Boolean, `Bitte gib deinen ${label} an.`);
export const playbookFormSchema = z.object({
  first_name: name('Vornamen'),
  last_name: name('Nachnamen'),
  email: z.string({ required_error: 'Bitte gib deine E-Mail-Adresse an.' }).trim().min(1, 'Bitte gib deine E-Mail-Adresse an.').email('Bitte gib eine gültige E-Mail-Adresse an.').max(255).transform((value) => value.toLowerCase()),
  phone: z.string({ required_error: 'Bitte gib deine Telefonnummer an.' }).trim().min(1, 'Bitte gib deine Telefonnummer an.').transform(normalizePhone).refine((value) => /^\+[0-9]{7,15}$/.test(value), 'Bitte gib eine gültige Telefonnummer an.'),
  privacy: z.literal(true, { errorMap: () => ({ message: 'Bitte bestätige die Datenschutzerklärung.' }) }),
});
export type PlaybookForm = z.infer<typeof playbookFormSchema>;
export const isTestEmail = (email: string) => email.trim().toLowerCase().endsWith('@example.com');

export function actionLabel(date: string | null, today = new Date()) {
  if (!date) return 'Kostenfrei:';
  const end = new Date(`${date}T23:59:59+01:00`);
  if (Number.isNaN(end.getTime()) || end <= today) return 'Kostenfrei:';
  const [year, month, day] = date.split('-');
  return `Nur bis ${day}.${month}.${year} kostenfrei:`;
}

export function hasActionExpired(date: string | null, today = new Date()) {
  if (!date) return false;
  const end = new Date(`${date}T23:59:59+01:00`);
  return !Number.isNaN(end.getTime()) && end <= today;
}
