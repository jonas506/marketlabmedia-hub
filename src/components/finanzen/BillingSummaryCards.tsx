import { Card } from "@/components/ui/card";
import { formatEur } from "@/lib/finanzen-utils";
import { AlertTriangle, FileCheck, Hourglass, Wallet } from "lucide-react";

interface Bucket {
  total: number;
  count: number;
}

interface Props {
  due: Bucket;
  sent: Bucket;
  paid: Bucket;
  overdue: Bucket;
}

const cards = [
  { key: "due" as const, label: "Offen", icon: Hourglass, color: "text-yellow-600 dark:text-yellow-400" },
  { key: "sent" as const, label: "Gestellt", icon: FileCheck, color: "text-blue-600 dark:text-blue-400" },
  { key: "paid" as const, label: "Bezahlt", icon: Wallet, color: "text-green-600 dark:text-green-400" },
  { key: "overdue" as const, label: "Überfällig", icon: AlertTriangle, color: "text-red-600 dark:text-red-400" },
];

export default function BillingSummaryCards(props: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map(({ key, label, icon: Icon, color }) => {
        const bucket = props[key];
        const isDanger = key === "overdue" && bucket.count > 0;
        return (
          <Card
            key={key}
            className={`p-4 ${isDanger ? "border-red-500/40 bg-red-500/5" : ""}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{label}</span>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <div className="mt-2 text-xl font-semibold">{formatEur(bucket.total)}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {bucket.count} {bucket.count === 1 ? "Rechnung" : "Rechnungen"}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
