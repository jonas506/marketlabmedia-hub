// Erzeugt aus dem Angebots-JSON ein schlankes, sauber lesbares PDF (Helvetica/WinAnsi).
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';

const A4: [number, number] = [595.28, 841.89];
const M = 48;
const BLUE = rgb(0.184, 0.42, 1);
const DARK = rgb(0.043, 0.043, 0.06);
const GREY = rgb(0.353, 0.388, 0.467);
const LINE = rgb(0.894, 0.914, 0.949);

const clean = (v: unknown) =>
  String(v ?? '')
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/[^\x20-\x7E\u00A1-\u00FF]/g, '');

export async function buildOfferPdf(doc: any, meta: {
  acceptedAt: string;
  acceptedBy: string;
  acceptedEmail: string;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage(A4);
  let y = A4[1] - M;
  const W = A4[0] - M * 2;

  const nl = (h: number) => {
    if (y - h < M + 40) {
      page = pdf.addPage(A4);
      y = A4[1] - M;
    }
    y -= h;
  };

  const wrap = (text: string, font: any, size: number, width: number) => {
    const out: string[] = [];
    for (const para of clean(text).split('\n')) {
      let line = '';
      for (const word of para.split(/\s+/)) {
        const test = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(test, size) > width && line) {
          out.push(line);
          line = word;
        } else line = test;
      }
      out.push(line);
    }
    return out;
  };

  const text = (
    s: string,
    o: { size?: number; font?: any; color?: any; x?: number; width?: number; gap?: number } = {},
  ) => {
    const size = o.size ?? 10;
    const font = o.font ?? reg;
    const lines = wrap(s, font, size, o.width ?? W);
    for (const l of lines) {
      nl(size + 4);
      page.drawText(l, { x: o.x ?? M, y, size, font, color: o.color ?? DARK });
    }
    if (o.gap) nl(o.gap);
  };

  const right = (s: string, o: { size?: number; font?: any; color?: any } = {}) => {
    const size = o.size ?? 10;
    const font = o.font ?? reg;
    const str = clean(s);
    page.drawText(str, {
      x: A4[0] - M - font.widthOfTextAtSize(str, size),
      y,
      size,
      font,
      color: o.color ?? DARK,
    });
  };

  const rule = () => {
    nl(10);
    page.drawLine({ start: { x: M, y }, end: { x: A4[0] - M, y }, thickness: 0.7, color: LINE });
  };

  const heading = (s: string) => {
    nl(18);
    page.drawText(clean(s), { x: M, y, size: 12, font: bold, color: DARK });
    nl(4);
  };

  // Kopf
  text(clean(doc?.headerKicker || 'MARKETLAB MEDIA'), { size: 8, font: bold, color: BLUE });
  text(`${clean(doc?.titleTop || 'Angebot')} ${clean(doc?.offerNumber || '')}`.trim(), {
    size: 22,
    font: bold,
  });
  text(clean(doc?.titleMain || ''), { size: 14, font: bold, color: GREY });
  text(clean(doc?.dateLabel || ''), { size: 9, color: GREY, gap: 6 });

  // Empfänger
  heading(clean(doc?.toTitle || 'Angebot für'));
  text(clean(doc?.toName || ''), { size: 10, font: bold });
  for (const l of (doc?.toLines || []) as string[]) text(l, { size: 10, color: GREY });

  // Umfang
  if (Array.isArray(doc?.scopeLines) && doc.scopeLines.filter(Boolean).length) {
    heading(clean(doc?.scopeTitle || 'Umfang'));
    for (const l of doc.scopeLines.filter(Boolean)) text(`- ${clean(l)}`, { size: 10 });
  }

  // Positionen
  const positions: any[] = Array.isArray(doc?.positions) ? doc.positions : [];
  if (positions.length) {
    heading(clean(doc?.positionsTitle || 'Positionen'));
    for (const p of positions) {
      nl(14);
      page.drawText(clean(p.title), { x: M, y, size: 10.5, font: bold, color: DARK });
      right(Number(p.amount) > 0 ? fmt(Number(p.amount)) : '-', { size: 10.5, font: bold });
      if (p.description) text(clean(p.description), { size: 9, color: GREY, width: W - 90 });
      if (p.calc) text(clean(p.calc), { size: 8.5, color: BLUE });
      rule();
    }
    const total = positions.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const vat = Number(doc?.vatRate ?? 19);
    nl(20);
    page.drawText(clean(doc?.totalLabel || 'Gesamt netto'), { x: M, y, size: 12, font: bold });
    right(fmt(total), { size: 14, font: bold });
    text(`zzgl. ${vat}% USt. - brutto ${fmt2(total * (1 + vat / 100))}`, { size: 9, color: GREY });
    if (doc?.recurringLabel) {
      text(`${clean(doc.recurringLabel)}: ${clean(doc.recurringValue)}`, { size: 10, font: bold });
    }
  }

  if (doc?.optionalEnabled) {
    heading(clean(doc?.optionalTitle || 'Optional'));
    text(clean(doc?.optionalSubtitle || ''), { size: 9.5, color: GREY });
    text(clean(doc?.optionalPrice || ''), { size: 10, font: bold });
  }

  if (Array.isArray(doc?.included) && doc.included.filter(Boolean).length) {
    heading(clean(doc?.includedTitle || 'Enthalten'));
    for (const l of doc.included.filter(Boolean)) text(`- ${clean(l)}`, { size: 9.5 });
  }

  if (doc?.timelineEnabled && Array.isArray(doc?.timeline) && doc.timeline.length) {
    heading(clean(doc?.timelineTitle || 'Vorgehensweise'));
    for (const s of doc.timeline) {
      text(`${clean(s.when)} - ${clean(s.title)}`, { size: 10, font: bold });
      if (s.text) text(clean(s.text), { size: 9, color: GREY });
    }
  }

  const paymentRows: any[] = Array.isArray(doc?.paymentRows) ? doc.paymentRows : [];
  if (paymentRows.length) {
    heading(clean(doc?.paymentPlanTitle || doc?.paymentTitle || 'Zahlungsplan'));
    for (const r of paymentRows) {
      nl(13);
      page.drawText(clean(r.label), { x: M, y, size: 10, font: reg });
      right(clean(r.amount), { size: 10, font: bold });
      if (r.sub) text(clean(r.sub), { size: 8.5, color: GREY });
    }
    if (doc?.paymentTotalValue) {
      nl(15);
      page.drawText(clean(doc.paymentTotalLabel || 'Summe'), { x: M, y, size: 10.5, font: bold });
      right(clean(doc.paymentTotalValue), { size: 11, font: bold });
    }
    if (doc?.paymentFootnote) text(clean(doc.paymentFootnote), { size: 8.5, color: GREY });
  }

  const conditions: any[] = Array.isArray(doc?.conditions) ? doc.conditions : [];
  if (conditions.length) {
    heading(clean(doc?.conditionsTitle || 'Konditionen'));
    for (const c of conditions) {
      nl(13);
      page.drawText(clean(c.label), { x: M, y, size: 10 });
      right(clean(c.value), { size: 10, font: bold });
    }
  }

  if (doc?.notes) {
    heading('Hinweise');
    text(clean(doc.notes), { size: 9, color: GREY });
  }

  // Annahmebestätigung
  nl(24);
  page.drawRectangle({
    x: M,
    y: y - 66,
    width: W,
    height: 78,
    color: rgb(0.945, 0.965, 1),
    borderColor: BLUE,
    borderWidth: 1,
  });
  nl(4);
  page.drawText('ANGEBOT VERBINDLICH ANGENOMMEN', {
    x: M + 14,
    y,
    size: 9,
    font: bold,
    color: BLUE,
  });
  nl(16);
  page.drawText(clean(`Angenommen von: ${meta.acceptedBy} (${meta.acceptedEmail})`), {
    x: M + 14,
    y,
    size: 9.5,
    font: reg,
    color: DARK,
  });
  nl(14);
  page.drawText(clean(`Zeitpunkt: ${meta.acceptedAt}`), {
    x: M + 14,
    y,
    size: 9.5,
    font: reg,
    color: DARK,
  });
  nl(14);
  page.drawText(
    clean('Die Annahme erfolgte elektronisch ueber den persoenlichen Angebotslink.'),
    { x: M + 14, y, size: 8.5, font: reg, color: GREY },
  );

  // Footer auf jeder Seite
  const footer = clean(
    [doc?.footerCompany, doc?.footerAddress, doc?.footerContact1].filter(Boolean).join(' - '),
  );
  for (const p of pdf.getPages()) {
    p.drawText(footer, { x: M, y: 28, size: 7.5, font: reg, color: GREY });
  }

  return await pdf.save();
}

const fmt = (n: number) => `${n.toLocaleString('de-DE', { maximumFractionDigits: 0 })} EUR`;
const fmt2 = (n: number) =>
  `${n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
