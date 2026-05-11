import { addMonths, differenceInDays, format } from "date-fns";
import { de } from "date-fns/locale";

export type InvoiceStatus = "upcoming" | "due" | "sent" | "paid" | "overdue";

export const STATUS_LABEL: Record<InvoiceStatus, string> = {
  upcoming: "Upcoming",
  due: "Offen",
  sent: "Gestellt",
  paid: "Bezahlt",
  overdue: "Überfällig",
};

export const STATUS_BADGE: Record<InvoiceStatus, string> = {
  upcoming: "bg-muted text-muted-foreground",
  due: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
  sent: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
  paid: "bg-green-500/20 text-green-700 dark:text-green-400",
  overdue: "bg-red-500/20 text-red-700 dark:text-red-400",
};

export function formatEur(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDateDe(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "dd.MM.yyyy");
}

export function formatMonthDe(month: number, year: number): string {
  const d = new Date(year, month - 1, 1);
  return format(d, "LLL yyyy", { locale: de });
}

export function billingDateForMonth(startDate: string, monthNumber: number): { month: number; year: number } {
  const d = addMonths(new Date(startDate), monthNumber - 1);
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

/**
 * Compute the *effective* status considering due/overdue heuristics.
 * Stored upcoming → due if billing month already started.
 * Stored sent → overdue if invoice_sent_at + 14d < today.
 */
export function effectiveStatus(args: {
  storedStatus: InvoiceStatus;
  billingMonth?: number;
  billingYear?: number;
  invoiceSentAt?: string | null;
}): InvoiceStatus {
  const { storedStatus, billingMonth, billingYear, invoiceSentAt } = args;
  const now = new Date();

  if (storedStatus === "upcoming" && billingMonth && billingYear) {
    const billingDate = new Date(billingYear, billingMonth - 1, 1);
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    if (billingDate <= currentMonthStart) return "due";
  }

  if (storedStatus === "sent" && invoiceSentAt) {
    if (differenceInDays(now, new Date(invoiceSentAt)) > 14) return "overdue";
  }

  return storedStatus;
}
