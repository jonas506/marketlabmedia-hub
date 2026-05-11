import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, ExternalLink } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateDe, formatEur } from "@/lib/finanzen-utils";

interface Props {
  clientId: string;
}

export default function ClientContractsCard({ clientId }: Props) {
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const { data } = useQuery({
    enabled: isAdmin,
    queryKey: ["client-contracts", clientId],
    queryFn: async () => {
      const { data: contracts, error } = await supabase
        .from("client_contracts")
        .select("*")
        .eq("client_id", clientId)
        .order("start_date", { ascending: false });
      if (error) throw error;

      const ids = (contracts ?? []).map((c: any) => c.id);
      if (ids.length === 0) return [];

      const { data: months } = await supabase
        .from("client_contract_months")
        .select("contract_id, amount_netto, invoice_status")
        .in("contract_id", ids);

      return (contracts ?? []).map((c: any) => {
        const ms = (months ?? []).filter((m: any) => m.contract_id === c.id);
        const total = ms.reduce((s: number, m: any) => s + Number(m.amount_netto), 0);
        const paid = ms.filter((m: any) => m.invoice_status === "paid").reduce((s: number, m: any) => s + Number(m.amount_netto), 0);
        return { ...c, total, paid, monthsCount: ms.length };
      });
    },
  });

  if (!isAdmin) return null;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Verträge & Rechnungen
        </div>
        <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
          <Link to="/finanzen"><ExternalLink className="h-3 w-3 mr-1" /> Finanzen</Link>
        </Button>
      </div>

      {!data || data.length === 0 ? (
        <div className="text-xs text-muted-foreground italic">Noch kein Vertrag im Finanzmodul angelegt.</div>
      ) : (
        <div className="space-y-2">
          {data.map((c: any) => (
            <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2">
              <div className="min-w-0">
                <div className="text-sm">
                  {formatDateDe(c.start_date)} – {formatDateDe(c.end_date)}{" "}
                  <span className="text-muted-foreground">({c.duration_months} Mo)</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {formatEur(c.paid)} bezahlt von {formatEur(c.total)} · {c.monthsCount} Monate
                </div>
              </div>
              <Badge variant={c.status === "active" ? "default" : "secondary"} className="text-[10px]">
                {c.status === "active" ? "Aktiv" : c.status === "completed" ? "Abgeschlossen" : "Beendet"}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
