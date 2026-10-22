import * as pdfjsLib from "pdfjs-dist";
import { parsePdfOfferFields } from './pdf-offer-fields';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";

export interface ScanResult {
  amount: number | null;
  source: string | null;
  text: string;
  validUntil: string | null;
}

export async function scanPdfAmount(file: File): Promise<ScanResult> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  try {
    const page = await pdf.getPage(1);
    const content = await page.getTextContent();
    const text =
      content.items
        .map((i) => ("str" in i ? (i as { str: string }).str : ""))
        .join(" ");
    return { ...parsePdfOfferFields(text), text };
  } finally {
    await pdf.destroy();
  }
}
