export const PAYMENT_VARIANTS = {
  A: 'A – Vorauszahlung mit 5 % Rabatt',
  B: 'B – monatlich (Setup sofort, Monatsgebühr im Voraus)',
} as const;

export type PaymentVariant = keyof typeof PAYMENT_VARIANTS;
export const CONSENT_TEXT = 'Ich habe das Dokument gelesen und nehme es hiermit verbindlich an und wähle die oben angegebene Zahlungsvariante. Mit dieser Bestätigung kommt ein rechtsgültiger Vertrag zustande.';

export function isPaymentVariant(value: unknown): value is PaymentVariant {
  return value === 'A' || value === 'B';
}

export function validAcceptance(role: unknown, payment: unknown): boolean {
  return typeof role === 'string' && role.trim().length >= 2 && role.trim().length <= 120 && isPaymentVariant(payment);
}

export function parseGermanDate(value: string): string | null {
  const match = value.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
}

/** A date-only deadline remains valid through the whole calendar day in Berlin. */
export function deadlineFromDate(date: string): string {
  const nextDay = new Date(`${date}T00:00:00Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', hourCycle: 'h23' }).formatToParts(nextDay);
  const offsetHours = Number(parts.find((part) => part.type === 'hour')?.value ?? 1);
  return new Date(nextDay.getTime() - offsetHours * 3600000 - 1).toISOString();
}

export function isExpired(deadline: string | null | undefined, now = Date.now()): boolean {
  return Boolean(deadline && now > new Date(deadline).getTime());
}

export function paymentLabel(value: string | null | undefined): string {
  return isPaymentVariant(value) ? PAYMENT_VARIANTS[value] : '—';
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
}