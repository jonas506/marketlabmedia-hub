import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";

const parseDe = (raw: string): number | null => {
  let s = raw.replace(/[^\d.,]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/\.\d{3}(\D|$)/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

export interface ScanResult {
  amount: number | null;
  /** how the amount was found: "total" line, "netto" line or largest amount */
  source: string | null;
  text: string;
}

const AMOUNT_RE = /(?:€|EUR)?\s*(\d{1,3}(?:[.\s]\d{3})+(?:,\d{2})?|\d+(?:,\d{2}))\s*(?:€|EUR)?/gi;

export async function scanPdfAmount(file: File): Promise<ScanResult> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let text = "";
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    text +=
      content.items
        .map((i) => ("str" in i ? (i as { str: string }).str : ""))
        .join(" ") + "\n";
  }

  const lines = text
    .split(/\n|(?=Gesamt|Summe|Netto|Investition)/gi)
    .map((l) => l.trim())
    .filter(Boolean);

  const priority: { re: RegExp; label: string }[] = [
    { re: /(gesamtsumme|gesamtbetrag|gesamt netto|summe netto|nettosumme)/i, label: "Gesamtsumme (netto)" },
    { re: /(gesamt|summe|investition|angebotssumme|auftragswert)/i, label: "Gesamt-/Summenzeile" },
    { re: /netto/i, label: "Netto-Zeile" },
  ];

  for (const { re, label } of priority) {
    const hits: number[] = [];
    for (const line of lines) {
      if (!re.test(line)) continue;
      if (/brutto|mwst|umsatzsteuer|ust\./i.test(line)) continue;
      for (const m of line.matchAll(AMOUNT_RE)) {
        const v = parseDe(m[1]);
        if (v && v >= 50) hits.push(v);
      }
    }
    if (hits.length) return { amount: Math.max(...hits), source: label, text };
  }

  const all: number[] = [];
  for (const m of text.matchAll(AMOUNT_RE)) {
    const v = parseDe(m[1]);
    if (v && v >= 50) all.push(v);
  }
  if (all.length) return { amount: Math.max(...all), source: "größter erkannter Betrag", text };

  return { amount: null, source: null, text };
}
