// Pauschalen (leicht änderbar bei Steueränderungen)
export const MEAL_ALLOWANCE_FULL_DAY = 28.0; // €/Tag bei 24h Abwesenheit
export const MEAL_ALLOWANCE_PARTIAL = 14.0;  // €/Tag An-/Abreisetag oder >8h Eintagsreise
export const KM_RATE = 0.36;                  // €/km
export const OVERNIGHT_RATE = 20.0;           // €/Nacht

/**
 * Berechnet den Verpflegungsmehraufwand nach deutschem Steuerrecht.
 */
export function calculateMeals(
  departureDate: string,
  departureTime: string,
  returnDate: string,
  returnTime: string
): number {
  const dep = new Date(`${departureDate}T${departureTime}`);
  const ret = new Date(`${returnDate}T${returnTime}`);

  if (isNaN(dep.getTime()) || isNaN(ret.getTime())) return 0;

  const diffMs = ret.getTime() - dep.getTime();
  if (diffMs <= 0) return 0;

  const diffHours = diffMs / (1000 * 60 * 60);

  // Eintagsreise (gleicher Tag)
  if (departureDate === returnDate) {
    if (diffHours > 8) return MEAL_ALLOWANCE_PARTIAL;
    return 0;
  }

  // Mehrtägige Reise
  // Anreisetag: 14€, Abreisetag: 14€
  // Volle Tage dazwischen: 28€
  const depDate = new Date(departureDate);
  const retDate = new Date(returnDate);
  const daysDiff = Math.round((retDate.getTime() - depDate.getTime()) / (1000 * 60 * 60 * 24));

  // daysDiff = 1 means next day -> 0 full days between
  const fullDaysBetween = Math.max(0, daysDiff - 1);

  return (
    MEAL_ALLOWANCE_PARTIAL + // Anreisetag
    fullDaysBetween * MEAL_ALLOWANCE_FULL_DAY + // Volle Tage
    MEAL_ALLOWANCE_PARTIAL // Abreisetag
  );
}

/**
 * Berechnet den Gesamtbetrag einer Dienstreise.
 */
export function calculateTotalAmount(params: {
  meals_total: number;
  km_driven: number;
  km_rate: number;
  overnight_count: number;
  overnight_rate: number;
  extras_amount: number;
}): number {
  const kmCosts = round2(params.km_driven * params.km_rate);
  const overnightCosts = round2(params.overnight_count * params.overnight_rate);
  return round2(params.meals_total + kmCosts + overnightCosts + params.extras_amount);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export const TRANSPORT_LABELS: Record<string, string> = {
  car: "PKW",
  train: "Bahn",
  plane: "Flug",
  other: "Sonstige",
};
