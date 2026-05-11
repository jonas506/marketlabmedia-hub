import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ContractMonth {
  id: string;
  contract_id: string;
  month_number: number;
  billing_month: number;
  billing_year: number;
  amount_netto: number;
  invoice_status: "upcoming" | "due" | "sent" | "paid" | "overdue";
  invoice_sent_at: string | null;
  invoice_paid_at: string | null;
  note: string | null;
}

export interface Contract {
  id: string;
  client_id: string;
  start_date: string;
  billing_start_date: string | null;
  end_date: string;
  duration_months: number;
  status: "active" | "completed" | "cancelled";
  note: string | null;
  months: ContractMonth[];
}

export interface ClientProject {
  id: string;
  client_id: string;
  name: string;
  amount_netto: number;
  invoice_status: "upcoming" | "sent" | "paid";
  due_date: string | null;
  invoice_sent_at: string | null;
  invoice_paid_at: string | null;
  note: string | null;
}

export interface ClientLite {
  id: string;
  name: string;
}

export function useFinanzenData() {
  return useQuery({
    queryKey: ["finanzen-data"],
    queryFn: async () => {
      const [{ data: clients, error: e1 }, { data: contracts, error: e2 }, { data: months, error: e3 }, { data: projects, error: e4 }] =
        await Promise.all([
          supabase.from("clients").select("id, name").order("name"),
          supabase.from("client_contracts").select("*").order("start_date", { ascending: false }),
          supabase.from("client_contract_months").select("*").order("month_number"),
          supabase.from("client_projects").select("*").order("created_at", { ascending: false }),
        ]);
      if (e1) throw e1;
      if (e2) throw e2;
      if (e3) throw e3;
      if (e4) throw e4;

      const monthsByContract = new Map<string, ContractMonth[]>();
      (months ?? []).forEach((m: any) => {
        const arr = monthsByContract.get(m.contract_id) ?? [];
        arr.push({ ...m, amount_netto: Number(m.amount_netto) });
        monthsByContract.set(m.contract_id, arr);
      });

      const enrichedContracts: Contract[] = (contracts ?? []).map((c: any) => ({
        ...c,
        months: (monthsByContract.get(c.id) ?? []).sort((a, b) => a.month_number - b.month_number),
      }));

      return {
        clients: (clients ?? []) as ClientLite[],
        contracts: enrichedContracts,
        projects: ((projects ?? []) as any[]).map((p) => ({ ...p, amount_netto: Number(p.amount_netto) })) as ClientProject[],
      };
    },
  });
}
