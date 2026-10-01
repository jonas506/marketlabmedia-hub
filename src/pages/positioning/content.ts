import hpyPhoto from "@/assets/positioning/hpy-immo.jpg.asset.json";
import hpyLogo from "@/assets/positioning/hpy-immo-white.png.asset.json";
import schorerPhoto from "@/assets/positioning/schorer.jpg.asset.json";
import schorerLogo from "@/assets/positioning/schorer-white.png.asset.json";
import pearlcapPhoto from "@/assets/positioning/pearlcap.jpg.asset.json";
import pearlcapLogo from "@/assets/positioning/pearlcap-white.png.asset.json";

export const trustMarks = [
  { name: "Hpy & Immo", logo: hpyLogo.url },
  { name: "Schorer Immobilien", logo: schorerLogo.url },
  { name: "Pearlcap", logo: pearlcapLogo.url },
  { name: "Real Estate Concierge" },
  { name: "Immo Know How" },
  { name: "Porta Vita" },
  { name: "Dahoam Wohnen" },
  { name: "SicherheitsKompass" },
  { name: "Alexander Tsasakos" },
];

export const cases = [
  {
    name: "Hpy & Immo",
    image: hpyPhoto.url,
    logo: hpyLogo.url,
    quote: "Reels gezielt an Nicht-Follower ausgespielt. Von ein paar hundert Aufrufen zu einem planbaren System.",
    stats: [["3 Mio.", "Reichweite in 30 Tagen"], ["100+", "Anfragen"], ["3", "Notartermine"]],
  },
  {
    name: "Schorer Immobilien",
    image: schorerPhoto.url,
    logo: schorerLogo.url,
    imageRight: true,
    quote: "Komplette Transparenz. Alle Zahlen eines Objekts offengelegt, mit individueller Berechnung für jeden Interessenten.",
    stats: [["35", "Leads mit Kaufabsicht"], ["1.000+", "Neue Follower"], ["~100 %", "Show-up-Rate"]],
  },
  {
    name: "Pearlcap",
    image: pearlcapPhoto.url,
    logo: pearlcapLogo.url,
    quote: "Ein Guide, der zeigt, welche Immobilie zu wem passt. Möglich nur mit ihrem Bestand.",
    stats: [["250 bis 300", "Leads pro Monat"], ["37,11 €", "Pro Lead"]],
  },
];

export const fitItems = [
  "als Kapitalanlagevertrieb oder Finanzdienstleister konstant mindestens 20.000 € im Monat verdienst.",
  "einen stehenden Vertrieb hast, der mehr qualifizierte Anfragen gebrauchen kann.",
  "nicht mehr davon abhängig sein willst, ob diesen Monat eine Empfehlung reinkommt.",
];

export const noFitItems = [
  "dein Vertrieb noch nicht steht.",
  "dich fünf neue Anfragen am Tag überfordern würden.",
];