export const REVENUE_OPTIONS = ["Unter 20.000 €", "20.000 bis 50.000 €", "50.000 bis 100.000 €", "Über 100.000 €"];
export const INDUSTRY_OPTIONS = ["Kapitalanlagevertrieb", "Finanzdienstleister", "Immobilienmakler", "Sonstiges"];

const REVENUE_POINTS: Record<string, number> = { "Unter 20.000 €": 20, "20.000 bis 50.000 €": 50, "50.000 bis 100.000 €": 75, "Über 100.000 €": 100 };
const INDUSTRY_POINTS: Record<string, number> = { Kapitalanlagevertrieb: 100, Finanzdienstleister: 90, Immobilienmakler: 70, Sonstiges: 30 };

/** Score 0–100: 70 % Umsatz, 30 % Branchen-Fit. */
export function scoreLead(revenue: string, industry: string) {
  const r = REVENUE_POINTS[revenue] ?? 0;
  const i = INDUSTRY_POINTS[industry] ?? 0;
  return Math.round(r * 0.7 + i * 0.3);
}

export function gradeFor(score: number): "A" | "B" | "C" | "D" {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "D";
}

export const STATUSES = [
  { value: "neu", label: "Neu" },
  { value: "kontaktiert", label: "Kontaktiert" },
  { value: "termin", label: "Termin" },
  { value: "angebot", label: "Angebot" },
  { value: "abschluss", label: "Abschluss" },
  { value: "unqualifiziert", label: "Unqualifiziert" },
  { value: "doppelt", label: "Doppelt" },
];
/** Termin zählt, sobald der Lead mindestens die Terminphase erreicht hat. */
export const APPOINTMENT_STATUSES = ["termin", "angebot", "abschluss"];
