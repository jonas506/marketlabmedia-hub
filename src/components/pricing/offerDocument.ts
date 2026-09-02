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

export type ProductType = "content" | "trial" | "ads";

type BuildInput = {
  offerNumber: string;
  productType: ProductType;
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

const CONTENT_POSITIONS = (
  planName: string,
  setupPrice: number,
  monthlyPrice: number,
  durationMonths: number,
): OfferPosition[] => {
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
  return positions;
};

const TRIAL_POSITIONS = (): OfferPosition[] => [
  {
    id: uid(),
    title: "Testmonat",
    description:
      "30 Tage Einstieg inkl. Research, Positionierung, Profil-Optimierung, ManyChat-Automation, Freebie, 30 Testreels im Overlay-Format und Reporting.",
    calc: "einmalig, pauschal",
    amount: 2000,
  },
];

const ADS_POSITIONS = (setupPrice: number, monthlyPrice: number, durationMonths: number): OfferPosition[] => {
  const positions: OfferPosition[] = [];
  if (setupPrice > 0) {
    positions.push({
      id: uid(),
      title: "Kampagnen-Setup",
      description:
        "Einrichtung der Werbekonten, Pixel/Conversion-Tracking, Zielgruppenrecherche, Erstellung der Creatives und Aufbau der ersten Kampagnen.",
      calc: "einmalig, pauschal",
      amount: setupPrice,
    });
  }
  positions.push({
    id: uid(),
    title: "Ads Verwaltung",
    description:
      "Laufende Optimierung von Budget, Zielgruppen, Creatives und Bidding. Monatliches Reporting zu Spend, Reichweite, Klicks und Conversions.",
    calc: `${durationMonths} × ${eur(monthlyPrice)}`,
    amount: monthlyPrice * durationMonths,
  });
  return positions;
};

export function buildDefaultDocument(input: BuildInput): OfferDoc {
  const {
    offerNumber, productType, planName, monthlyPrice, setupPrice, durationMonths,
    addons, recipientCompany, recipientContact, recipientAddressLines,
  } = input;

  let positions: OfferPosition[] = [];
  let headerKicker = "ORGANISCHER CONTENT & LEADGENERIERUNG";
  let eyebrow = "SOCIAL MEDIA · CONTENT-SYSTEM";
  let titleMain = "Content & Leadgenerierung.";
  let scopeLines: string[] = [`${durationMonths} Monate`, planName, "inkl. Setup und Automatisierung"];
  let recurringLabel = "Laufende Kosten ab Monat 2";
  let recurringValue = `${eur(monthlyPrice)} / Monat`;
  let footnotes: string[] = [
    "Alle Preise netto, zzgl. 19 % USt.",
    "Ein Werbebudget ist in dieser Phase nicht vorgesehen – der Aufbau läuft zunächst rein organisch.",
  ];
  let splitLeftText =
    "Strategie, Themenfindung, Skripting, Schnitt, Automatisierung und Veröffentlichung. Im Hintergrund arbeiten drei Personen an dem Projekt.";
  let splitRightText =
    "Hintergrund-Videos vom Smartphone – ein Videokurs von ca. 30 Minuten erklärt Kamera, Licht und Ton. Dazu die fachliche Freigabe der Posts, ein Klick pro Beitrag.";
  let included: string[] = [
    "Strategie-Meeting zu USP, Zielgruppe und Positionierung",
    "Optimierung des Instagram-Profils",
    "Skripting, Schnitt und Untertitel für jedes Format",
    "Feedbackschleife und Freigabe vor jeder Veröffentlichung",
    "Posten und Terminierung übernehmen wir komplett",
    "Monatliches Reporting zu Reichweite, Interaktionen und Anfragen",
  ];
  let conditions: ConditionRow[] = [
    { id: uid(), label: "Laufzeit", value: `${durationMonths} Monate` },
    { id: uid(), label: "Verlängerung", value: "optional 12 Monate" },
    { id: uid(), label: "Zahlungsziel", value: "7 Tage" },
  ];
  let paymentFootnote = "Setup zu Beginn, danach gleichbleibende Monatsrate.";

  if (productType === "trial") {
    positions = TRIAL_POSITIONS();
    headerKicker = "TESTMONAT · EINSTIEGSPAKET";
    eyebrow = "SOCIAL MEDIA · TESTMONAT";
    titleMain = "Testmonat.";
    scopeLines = ["30 Tage", "Testmonat", "Setup inklusive"];
    recurringLabel = "Keine laufenden Kosten";
    recurringValue = "einmalig";
    footnotes = [
      "Alle Preise netto, zzgl. 19 % USt.",
      "Keine Laufzeit. Nach 30 Tagen entscheidest du, ob es in Stufe 1 weiterläuft.",
    ];
    splitLeftText =
      "Research, Positionierung, Profil-Optimierung, ManyChat-Automation, Freebie-Anpassung, 30 Testreels im Overlay-Format und Reporting.";
    splitRightText =
      "Ein Strategie-Gespräch von etwa einer Stunde und die fachliche Freigabe der Posts – ein Klick pro Beitrag.";
    included = [
      "Research zu Zielgruppe, Wettbewerb und Themen",
      "Positionierung und Content-Strategie",
      "Instagram-Profil komplett aufgesetzt",
      "ManyChat-Automation eingerichtet",
      "Freebie aus unserer Vorlage, auf dich angepasst",
      "30 Testreels im Overlay-Format mit Freebie-CTA",
      "Reporting am Ende der 30 Tage",
    ];
    conditions = [
      { id: uid(), label: "Laufzeit", value: "30 Tage" },
      { id: uid(), label: "Verlängerung", value: "optional in Stufe 1" },
      { id: uid(), label: "Zahlungsziel", value: "7 Tage" },
    ];
    paymentFootnote = "Einmalige Zahlung zu Vertragsbeginn.";
  } else if (productType === "ads") {
    positions = ADS_POSITIONS(setupPrice, monthlyPrice, durationMonths);
    headerKicker = "WERBEANZEIGEN · ADS MANAGEMENT";
    eyebrow = "PAID ADS · META / GOOGLE";
    titleMain = "Ads Management.";
    scopeLines = [`${durationMonths} Monate`, "Ads Management", "Setup inklusive"];
    recurringLabel = "Laufende Verwaltung";
    recurringValue = `${eur(monthlyPrice)} / Monat`;
    footnotes = [
      "Alle Preise netto, zzgl. 19 % USt.",
      "Das Werbebudget wird zusätzlich fällig und direkt an die Plattform gezahlt. Für eine grundlegende Kampagne empfehlen wir ca. 20–40 € pro Tag.",
    ];
    splitLeftText =
      "Kampagnen-Setup, Conversion-Tracking, Zielgruppenrecherche, Erstellung der Creatives, laufende Optimierung und monatliches Reporting.";
    splitRightText =
      "Freigabe der Creatives und Zielgruppen vor Live-Schaltung sowie der Zugriff auf Werbekonto und Pixel, falls noch nicht vorhanden.";
    included = [
      "Kampagnen-Setup einmalig",
      "Laufende Verwaltung inkl. Optimierung",
      "Zielgruppenrecherche und Testing",
      "Erstellung von Ad-Creatives",
      "Conversion-Tracking und Pixel-Einrichtung",
      "Monatliches Reporting zu Spend und Conversions",
    ];
    conditions = [
      { id: uid(), label: "Laufzeit", value: `${durationMonths} Monate` },
      { id: uid(), label: "Mindestlaufzeit", value: "3 Monate" },
      { id: uid(), label: "Zahlungsziel", value: "7 Tage" },
    ];
    paymentFootnote = "Setup zu Beginn, danach monatliche Verwaltung. Werbebudget separat.";
  } else {
    positions = CONTENT_POSITIONS(planName, setupPrice, monthlyPrice, durationMonths);
  }

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

  const firstPayment = positions.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const hasMonthly = monthlyPrice > 0 && durationMonths > 1;
  const paymentRows: PaymentRow[] = [];

  if (productType === "trial") {
    paymentRows.push({ id: uid(), label: "Testmonat", amount: eur(2000) });
  } else {
    paymentRows.push({
      id: uid(),
      label: "Vertragsstart",
      sub: setupPrice > 0 ? "Setup & Strategie, Monat 1" : "Monat 1",
      amount: eur(setupPrice + monthlyPrice),
    });
    for (let i = 2; i <= durationMonths; i++) {
      paymentRows.push({ id: uid(), label: `Monat ${i}`, amount: eur(monthlyPrice) });
    }
  }

  const total = sumPositions(positions);

  return {
    offerNumber,
    dateLabel: germanDate(),
    headerKicker,
    eyebrow,
    titleTop: "Angebot",
    titleMain,

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
    scopeLines,

    positionsTitle: "Kostenstruktur",
    positions,

    vatRate: 19,
    totalLabel: "Gesamt netto",
    recurringLabel,
    recurringValue,

    optionalEnabled: false,
    optionalLabel: "OPTIONAL",
    optionalTitle: "Zusatzleistung",
    optionalSubtitle: "Beschreibung der optionalen Leistung",
    optionalPrice: "150 € / Stück",

    footnotes,

    splitEnabled: true,
    splitLeftTitle: "WAS WIR ÜBERNEHMEN",
    splitLeftText,
    splitRightTitle: "WAS DU BEISTEUERST",
    splitRightText,

    includedTitle: "Enthalten",
    included,

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
    paymentFootnote,

    conditionsLabel: "KONDITIONEN",
    conditionsTitle: "Überblick",
    conditions: [
      ...conditions,
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
