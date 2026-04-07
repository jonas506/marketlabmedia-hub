import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  MEAL_ALLOWANCE_FULL_DAY,
  MEAL_ALLOWANCE_PARTIAL,
  TRANSPORT_LABELS,
  round2,
} from "./travel-expense-utils";

interface TravelExpense {
  destination: string;
  purpose: string;
  departure_date: string;
  departure_time: string;
  return_date: string;
  return_time: string;
  transport: string;
  km_driven: number;
  km_rate: number;
  overnight_count: number;
  overnight_rate: number;
  meals_total: number;
  extras_description: string | null;
  extras_amount: number;
  total_amount: number;
}

const COMPANY = "Marketlab Media UG (haftungsbeschränkt)";

const MONTHS_DE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

function fmtEur(n: number): string {
  return n.toFixed(2).replace(".", ",") + " €";
}

function fmtDate(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
}

function calcAbsenceHours(dep: string, depTime: string, ret: string, retTime: string): number {
  const d1 = new Date(`${dep}T${depTime}`);
  const d2 = new Date(`${ret}T${retTime}`);
  return round2((d2.getTime() - d1.getTime()) / (1000 * 60 * 60));
}

/** Returns array of { date, label, amount } for per-day meal breakdown */
function getMealDays(dep: string, depTime: string, ret: string, retTime: string) {
  const days: { date: string; label: string; amount: number }[] = [];

  if (dep === ret) {
    const hrs = calcAbsenceHours(dep, depTime, ret, retTime);
    if (hrs > 8) {
      days.push({ date: fmtDate(dep), label: `Eintagsreise (${hrs.toFixed(1)} Std.)`, amount: MEAL_ALLOWANCE_PARTIAL });
    }
    return days;
  }

  const depDate = new Date(dep);
  const retDate = new Date(ret);
  const diffDays = Math.round((retDate.getTime() - depDate.getTime()) / (1000 * 60 * 60 * 24));

  days.push({ date: fmtDate(dep), label: "Anreisetag", amount: MEAL_ALLOWANCE_PARTIAL });

  for (let i = 1; i < diffDays; i++) {
    const d = new Date(depDate);
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().split("T")[0];
    days.push({ date: fmtDate(iso), label: "24 Std.", amount: MEAL_ALLOWANCE_FULL_DAY });
  }

  days.push({ date: fmtDate(ret), label: "Abreisetag", amount: MEAL_ALLOWANCE_PARTIAL });
  return days;
}

export async function generateTravelExpensePdf(
  employeeName: string,
  month: number,
  year: number,
  expenses: TravelExpense[],
): Promise<Blob> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 15;

  // --- HEADER ---
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("REISEKOSTENABRECHNUNG Inland", 14, y);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Reisekostenabrechnung – ${COMPANY}`, 14, y + 6);
  doc.text("Seite 1", pageW - 14, y, { align: "right" });
  y += 14;

  // --- SECTION 1: General info ---
  autoTable(doc, {
    startY: y,
    head: [["Feld", "Angabe"]],
    body: [
      ["Firma / Arbeitgeber", COMPANY],
      ["Name, Vorname", employeeName],
      ["Personalnummer", ""],
      ["Abteilung", ""],
      ["Monat / Jahr", `${MONTHS_DE[month - 1]} ${year}`],
    ],
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [60, 60, 60] },
    columnStyles: { 0: { cellWidth: 50 } },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // --- SECTION 2: Individual trips ---
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Einzelne Reisen", 14, y);
  y += 4;

  const tripRows = expenses.map((e, i) => [
    String(i + 1),
    e.destination,
    e.purpose,
    `${fmtDate(e.departure_date)} ${e.departure_time}`,
    `${fmtDate(e.return_date)} ${e.return_time}`,
    TRANSPORT_LABELS[e.transport] || e.transport,
    `${calcAbsenceHours(e.departure_date, e.departure_time, e.return_date, e.return_time).toFixed(1)} Std.`,
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Nr", "Reiseziel", "Anlass", "Anreise", "Abreise", "Verkehr", "Abwesenheit"]],
    body: tripRows,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [60, 60, 60] },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // --- SECTION 3: Meals ---
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Verpflegungsmehraufwand", 14, y);
  y += 4;

  const mealRows: string[][] = [];
  let mealCounter = 0;
  let totalMeals = 0;
  expenses.forEach((e) => {
    const days = getMealDays(e.departure_date, e.departure_time, e.return_date, e.return_time);
    days.forEach((d) => {
      mealCounter++;
      totalMeals += d.amount;
      mealRows.push([String(mealCounter), d.date, d.label, fmtEur(d.amount), fmtEur(d.amount)]);
    });
  });
  mealRows.push(["", "", "", "Summe Verpflegung:", fmtEur(totalMeals)]);

  autoTable(doc, {
    startY: y,
    head: [["Nr", "Datum", "Abwesenheit", "Pauschale", "Betrag"]],
    body: mealRows,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [60, 60, 60] },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // --- SECTION 4: KM costs ---
  const kmExpenses = expenses.filter((e) => e.transport === "car" && Number(e.km_driven) > 0);
  if (kmExpenses.length > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Fahrtkosten", 14, y);
    y += 4;

    let totalKm = 0;
    const kmRows = kmExpenses.map((e, i) => {
      const cost = round2(Number(e.km_driven) * Number(e.km_rate));
      totalKm += cost;
      return [`PKW-Nutzung Reise ${i + 1} (${e.destination})`, String(e.km_driven), fmtEur(Number(e.km_rate)) + "/km", fmtEur(cost)];
    });
    kmRows.push(["", "", "Summe Fahrtkosten:", fmtEur(totalKm)]);

    autoTable(doc, {
      startY: y,
      head: [["Beschreibung", "KM", "Pauschale", "Betrag"]],
      body: kmRows,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [60, 60, 60] },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // --- SECTION 5: Overnight ---
  const overnightExpenses = expenses.filter((e) => Number(e.overnight_count) > 0);
  if (overnightExpenses.length > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Übernachtungspauschale", 14, y);
    y += 4;

    let totalOvernight = 0;
    const oRows = overnightExpenses.map((e, i) => {
      const cost = round2(Number(e.overnight_count) * Number(e.overnight_rate));
      totalOvernight += cost;
      return [`Reise ${i + 1} (${e.destination})`, String(e.overnight_count), fmtEur(Number(e.overnight_rate)) + "/Nacht", fmtEur(cost)];
    });
    oRows.push(["", "", "Summe Übernachtungen:", fmtEur(totalOvernight)]);

    autoTable(doc, {
      startY: y,
      head: [["Beschreibung", "Nächte", "Pauschale", "Betrag"]],
      body: oRows,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [60, 60, 60] },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // --- SECTION 6: Extras ---
  const extrasExpenses = expenses.filter((e) => Number(e.extras_amount) > 0);
  if (extrasExpenses.length > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Nebenkosten", 14, y);
    y += 4;

    let totalExtras = 0;
    const eRows = extrasExpenses.map((e) => {
      totalExtras += Number(e.extras_amount);
      return [e.extras_description || "Nebenkosten", fmtEur(Number(e.extras_amount))];
    });
    eRows.push(["Summe Nebenkosten:", fmtEur(totalExtras)]);

    autoTable(doc, {
      startY: y,
      head: [["Beschreibung", "Betrag"]],
      body: eRows,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [60, 60, 60] },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // --- SECTION 7: Grand total ---
  const sumMeals = expenses.reduce((s, e) => s + Number(e.meals_total), 0);
  const sumKm = expenses.reduce((s, e) => s + round2(Number(e.km_driven) * Number(e.km_rate)), 0);
  const sumOvernight = expenses.reduce((s, e) => s + round2(Number(e.overnight_count) * Number(e.overnight_rate)), 0);
  const sumExtras = expenses.reduce((s, e) => s + Number(e.extras_amount), 0);
  const grandTotal = round2(sumMeals + sumKm + sumOvernight + sumExtras);

  // Check if we need a new page
  if (y > 240) {
    doc.addPage();
    y = 15;
  }

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Gesamtabrechnung", 14, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    body: [
      ["Verpflegungsmehraufwand", fmtEur(sumMeals)],
      ["Fahrtkosten", fmtEur(sumKm)],
      ["Übernachtungspauschale", fmtEur(sumOvernight)],
      ["Nebenkosten", fmtEur(sumExtras)],
      ["GESAMTBETRAG", fmtEur(grandTotal)],
    ],
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 80 }, 1: { halign: "right" } },
    didParseCell: (data: any) => {
      if (data.row.index === 4) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fontSize = 11;
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 12;

  // --- SECTION 8: Signatures ---
  if (y > 240) {
    doc.addPage();
    y = 15;
  }

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(
    "Ich bestätige die Richtigkeit und Vollständigkeit der Angaben. Belege sind beigefügt.",
    14, y,
  );
  y += 12;

  doc.text("Datum, Unterschrift Mitarbeiter/in:", 14, y);
  doc.line(14, y + 8, 90, y + 8);

  doc.text("Datum, Unterschrift Vorgesetzte/r:", pageW / 2 + 5, y);
  doc.line(pageW / 2 + 5, y + 8, pageW - 14, y + 8);

  y += 18;
  doc.setFontSize(7);
  doc.text(
    "Alle Originalbelege sind nummeriert beizufügen. Die steuerlichen Pauschalen entsprechen dem Stand 2025/2026 (Inland).",
    14, y,
  );

  return doc.output("blob");
}
