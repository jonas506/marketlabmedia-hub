// Zentrale Datenstruktur für das Angebotsdokument (1:1 Nachbau der Marketlab-PDF)

export type OfferPosition = {
  id: string;
  title: string;
  description: string;
  calc: string;
  amount: number;
};

export type TimelineStep = {
  id: string;
  when: string;
  title: string;
  text: string;
  highlight?: boolean;
};

export type PaymentRow = { id: string; label: string; sub?: string; amount: string };
export type ConditionRow = { id: string; label: string; value: string };

export type OfferDoc = {
  offerNumber: string;
  dateLabel: string;
  headerKicker: string; // rechts oben, z.B. ORGANISCHER CONTENT & LEADGENERIERUNG
  eyebrow: string; // z.B. BAUFINANZIERUNG · INSTAGRAM-AUFBAU
  titleTop: string; // "Angebot"
  titleMain: string; // "Content & Leadgenerierung."

  fromTitle: string;
  fromName: string;
  fromLines: string[];

  toTitle: string;
  toName: string;
  toLines: string[];

  scopeTitle: string;
  scopeLines: string[];

  positionsTitle: string;
  positions: OfferPosition[];

  vatRate: number;
  totalLabel: string;
  recurringLabel: string;
  recurringValue: string;

  optionalEnabled: boolean;
  optionalLabel: string;
  optionalTitle: string;
  optionalSubtitle: string;
  optionalPrice: string;

  footnotes: string[];

  splitEnabled: boolean;
  splitLeftTitle: string;
  splitLeftText: string;
  splitRightTitle: string;
  splitRightText: string;

  includedTitle: string;
  included: string[];

  timelineEnabled: boolean;
  timelineTitle: string;
  timeline: TimelineStep[];

  paymentTitle: string;
  paymentPlanLabel: string;
  paymentPlanTitle: string;
  paymentRows: PaymentRow[];
  paymentTotalLabel: string;
  paymentTotalValue: string;
  paymentFootnote: string;

  conditionsLabel: string;
  conditionsTitle: string;
  conditions: ConditionRow[];
  validLabel: string;
  validValue: string;
  validNote: string;

  notes: string;

  footerCompany: string;
  footerAddress: string;
  footerLegal1: string;
  footerLegal2: string;
  footerContact1: string;
  footerContact2: string;
};

export const uid = () => Math.random().toString(36).slice(2, 10);

export const eur = (n: number) =>
  `${n.toLocaleString("de-DE", { maximumFractionDigits: 0 })} €`;

export const eur2 = (n: number) =>
  `${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

export const sumPositions = (positions: OfferPosition[]) =>
  positions.reduce((s, p) => s + (Number(p.amount) || 0), 0);

export const germanDate = (d = new Date()) =>
  d.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" }).toUpperCase();

export const germanDateShort = (d: Date) =>
  d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

type BuildInput = {
  offerNumber: string;
  planName: string;
  monthlyPrice: number;
  setupPrice: number;
  durationMonths: number;
  discountPct: number;
  addons: { name: string; price_text: string; qty: number }[];
  recipientCompany: string;
  recipientContact: string;
  recipientAddressLines: string[];
};

export function buildDefaultDocument(input: BuildInput): OfferDoc {
  const {
    offerNumber, planName, monthlyPrice, setupPrice, durationMonths,
    addons, recipientCompany, recipientContact, recipientAddressLines,
  } = input;

  const positions: OfferPosition[] = [];
  if (setupPrice > 0) {
    positions.push({
      id: uid(),
      title: "Setup & Strategie",
      description:
        "Strategie-Meeting zur Ausarbeitung von USP, Zielgruppe und Content-Strategie. Profil-Optimierung, Aufbau der Automatisierung für die Leadgenerierung, Anbindung von Freebie und Lead-Formular.",
      calc: "einmalig, pauschal",
      amount: setupPrice,
    });
  }
  positions.push({
    id: uid(),
    title: planName,
    description:
      "Monatliche Content-Produktion inkl. Themenrecherche, Skripting, Schnitt, Untertitel, Feedbackschleife und Veröffentlichung nach deiner Freigabe.",
    calc: `${durationMonths} × ${eur(monthlyPrice)}`,
    amount: monthlyPrice * durationMonths,
  });
  addons.forEach((a) => {
    positions.push({
      id: uid(),
      title: a.name,
      description: "Add-on – wird bei Nutzung nach tatsächlichem Verbrauch abgerechnet.",
      calc: a.qty > 1 ? `${a.qty} × ${a.price_text}` : a.price_text,
      amount: 0,
    });
  });

  const valid = new Date();
  valid.setDate(valid.getDate() + 30);

  const firstPayment = setupPrice + monthlyPrice;
  const paymentRows: PaymentRow[] = [
    { id: uid(), label: "Vertragsstart", sub: setupPrice > 0 ? "Setup & Strategie, Monat 1" : "Monat 1", amount: eur(firstPayment) },
  ];
  for (let i = 2; i <= durationMonths; i++) {
    paymentRows.push({ id: uid(), label: `Monat ${i}`, amount: eur(monthlyPrice) });
  }

  const total = sumPositions(positions);

  return {
    offerNumber,
    dateLabel: germanDate(),
    headerKicker: "ORGANISCHER CONTENT & LEADGENERIERUNG",
    eyebrow: "SOCIAL MEDIA · CONTENT-SYSTEM",
    titleTop: "Angebot",
    titleMain: "Content & Leadgenerierung.",

    fromTitle: "VON",
    fromName: "Marketlab Media UG",
    fromLines: ["(haftungsbeschränkt)", "Koloniestraße 36 · 86399 Bobingen"],

    toTitle: "FÜR",
    toName: recipientCompany || recipientContact || "—",
    toLines: [
      ...(recipientContact && recipientCompany ? [`z. Hd. ${recipientContact}`] : []),
      ...recipientAddressLines.filter(Boolean),
    ],

    scopeTitle: "UMFANG",
    scopeLines: [`${durationMonths} Monate`, planName, "inkl. Setup und Automatisierung"],

    positionsTitle: "Kostenstruktur",
    positions,

    vatRate: 19,
    totalLabel: "Gesamt netto",
    recurringLabel: "Laufende Kosten ab Monat 2",
    recurringValue: `${eur(monthlyPrice)} / Monat`,

    optionalEnabled: false,
    optionalLabel: "OPTIONAL",
    optionalTitle: "Zusatzleistung",
    optionalSubtitle: "Beschreibung der optionalen Leistung",
    optionalPrice: "150 € / Stück",

    footnotes: [
      "Alle Preise netto, zzgl. 19 % USt.",
      "Ein Werbebudget ist in dieser Phase nicht vorgesehen – der Aufbau läuft zunächst rein organisch.",
    ],

    splitEnabled: true,
    splitLeftTitle: "WAS WIR ÜBERNEHMEN",
    splitLeftText:
      "Strategie, Themenfindung, Skripting, Schnitt, Automatisierung und Veröffentlichung. Im Hintergrund arbeiten drei Personen an dem Projekt.",
    splitRightTitle: "WAS DU BEISTEUERST",
    splitRightText:
      "Hintergrund-Videos vom Smartphone – ein Videokurs von ca. 30 Minuten erklärt Kamera, Licht und Ton. Dazu die fachliche Freigabe der Posts, ein Klick pro Beitrag.",

    includedTitle: "Enthalten",
    included: [
      "Strategie-Meeting zu USP, Zielgruppe und Positionierung",
      "Optimierung des Instagram-Profils",
      "Skripting, Schnitt und Untertitel für jedes Format",
      "Feedbackschleife und Freigabe vor jeder Veröffentlichung",
      "Posten und Terminierung übernehmen wir komplett",
      "Monatliches Reporting zu Reichweite, Interaktionen und Anfragen",
    ],

    timelineEnabled: false,
    timelineTitle: "Vorgehensweise",
    timeline: [
      { id: uid(), when: "Woche 1", title: "Kickoff & Strategie", text: "Strategie-Meeting, Zielgruppe, Themenplan." },
      { id: uid(), when: "Woche 2", title: "Produktion", text: "Skripting, Dreh und Schnitt der ersten Formate." },
    ],

    paymentTitle: "Zahlungsmodalitäten",
    paymentPlanLabel: "ZAHLUNGSPLAN",
    paymentPlanTitle: "Zahlungsplan",
    paymentRows,
    paymentTotalLabel: "Gesamt netto",
    paymentTotalValue: eur(total),
    paymentFootnote: "Setup zu Beginn, danach gleichbleibende Monatsrate.",

    conditionsLabel: "KONDITIONEN",
    conditionsTitle: "Überblick",
    conditions: [
      { id: uid(), label: "Laufzeit", value: `${durationMonths} Monate` },
      { id: uid(), label: "Verlängerung", value: "optional 12 Monate" },
      { id: uid(), label: "Zahlungsziel", value: "7 Tage" },
      { id: uid(), label: "Gesamt brutto", value: eur2(total * 1.19) },
    ],
    validLabel: "Angebot gültig bis",
    validValue: germanDateShort(valid),
    validNote:
      "Nach der vereinbarten Laufzeit entscheiden wir gemeinsam über die Fortsetzung – keine automatische Verlängerung.",

    notes:
      "Alle Preise netto zzgl. 19 % USt. Die Veröffentlichung erfolgt erst nach fachlicher Freigabe durch den Auftraggeber; für die inhaltliche Richtigkeit fachlicher Aussagen ist der Auftraggeber verantwortlich. Es gilt ein Dienstvertrag nach § 611 BGB; vergütet wird die Leistungserbringung, ein bestimmter Erfolg wird nicht zugesagt.",

    footerCompany: "Marketlab Media UG (haftungsbeschränkt)",
    footerAddress: "Koloniestraße 36 · 86399 Bobingen",
    footerLegal1: "GF: Jonas Wilhelm Fesser",
    footerLegal2: "HRB 41551 · Amtsgericht Augsburg",
    footerContact1: "marketlab-media.de",
    footerContact2: "Instagram: @marketlabmedia",
  };
}
