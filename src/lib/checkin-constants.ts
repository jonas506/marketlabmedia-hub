// Weekly customer check-in — SOP definition
// Rotation is automatic by ISO calendar week: (week - 1) mod 4 + 1

export type WeekFocus = 1 | 2 | 3 | 4;

export interface WeekConfig {
  focus: WeekFocus;
  title: string;
  subtitle: string;
  questions: string[];
  accent: string; // tailwind class
  badge: string; // short label
}

export const WEEK_CONFIGS: Record<WeekFocus, WeekConfig> = {
  1: {
    focus: 1,
    title: "Zahlen & Ergebnisse",
    subtitle: "Was bringt's konkret? Lieferung verankern.",
    badge: "W1",
    accent: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
    questions: [
      "Sind in den letzten zwei Wochen Anfragen über die DMs reingekommen? Wie war die Qualität?",
      'Hat sich jemand gemeldet, von dem du dachtest „den hätte ich sonst nie erreicht"?',
      "Gibt's einen Lead oder Termin, der gerade besonders heiß ist?",
    ],
  },
  2: {
    focus: 2,
    title: "Content & Außenwirkung",
    subtitle: "Wie fühlt sich der Kunde mit dem, was draußen läuft?",
    badge: "W2",
    accent: "text-sky-400 border-sky-500/30 bg-sky-500/10",
    questions: [
      "Hat dich jemand aus deinem Umfeld auf deine Reels oder dein Profil angesprochen?",
      "Gibt's ein Thema, das du unbedingt nach außen tragen willst, das wir noch nicht abgedeckt haben?",
      "Fühlst du dich bei dem, was online über dich läuft, gut repräsentiert?",
    ],
  },
  3: {
    focus: 3,
    title: "Wünsche & Ausbau",
    subtitle: "Upsell-Woche — Wo ist der größte Hebel? Immer an Jonas spiegeln.",
    badge: "W3 · Upsell",
    accent: "text-amber-400 border-amber-500/30 bg-amber-500/10",
    questions: [
      "Wenn wir in den nächsten 30 Tagen eine Sache zusätzlich machen könnten — was hätte den größten Impact?",
      "Gibt's was bei deinen Mitbewerbern, das dir auffällt und das du auch willst?",
      'Was würde dich sagen lassen: „Das war die beste Entscheidung, mit Marketlab zu arbeiten"?',
    ],
  },
  4: {
    focus: 4,
    title: "Beziehung & Zusammenarbeit",
    subtitle: "Reibung früh erkennen + NPS messen.",
    badge: "W4 · NPS",
    accent: "text-purple-400 border-purple-500/30 bg-purple-500/10",
    questions: [
      "Läuft die Abstimmung mit uns smooth, oder gibt's irgendwo Reibung?",
      "Fühlst du dich gut auf dem Laufenden, oder hättest du gern mehr / weniger Updates?",
      "Skala 0–10: Wie wahrscheinlich empfiehlst du uns einem Kollegen weiter? (NPS)",
    ],
  },
};

export function getISOWeek(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { week, year: d.getUTCFullYear() };
}

export function getCurrentWeekFocus(date: Date = new Date()): WeekFocus {
  const { week } = getISOWeek(date);
  return (((week - 1) % 4) + 1) as WeekFocus;
}

export const MOOD_OPTIONS: { value: "happy" | "neutral" | "unhappy"; emoji: string; label: string; color: string }[] = [
  { value: "happy", emoji: "😀", label: "Zufrieden", color: "text-emerald-400" },
  { value: "neutral", emoji: "😐", label: "Neutral", color: "text-amber-400" },
  { value: "unhappy", emoji: "😟", label: "Unzufrieden", color: "text-red-400" },
];
