import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import ClientInfoPanel from "@/components/client/ClientInfoPanel";
import KontingentTracker from "@/components/client/KontingentTracker";
import MonthlyShootDays from "@/components/client/MonthlyShootDays";
import MonthlyPipeline from "@/components/client/MonthlyPipeline";
import MonthlyChecklist from "@/components/client/MonthlyChecklist";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

const ClientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { role } = useAuth();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const canEdit = role === "admin" || role === "head_of_content";

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: clips } = useQuery({
    queryKey: ["clips", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clips")
        .select("*")
        .eq("client_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: shootDays } = useQuery({
    queryKey: ["shoot-days", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shoot_days")
        .select("*")
        .eq("client_id", id!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading || !client) {
    return (
      <AppLayout>
        <div className="flex h-64 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  // Generate month options (6 months back + 6 months forward)
  const monthOptions = Array.from({ length: 13 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 6 + i);
    return {
      month: d.getMonth() + 1,
      year: d.getFullYear(),
      label: format(d, "MMMM yyyy", { locale: de }),
      value: `${d.getMonth() + 1}-${d.getFullYear()}`,
    };
  });

  return (
    <AppLayout>
      {/* Back button */}
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground font-body mb-4">
        <ArrowLeft className="h-4 w-4" />
        Dashboard
      </Link>

      {/* Client Info Panel (collapsible) */}
      <div className="mb-6">
        <ClientInfoPanel client={client} canEdit={canEdit} />
      </div>

      {/* Month selector */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-mono text-sm font-semibold tracking-wider text-muted-foreground">MONATSZYKLUS</h2>
        <Select value={`${selectedMonth}-${selectedYear}`} onValueChange={(v) => {
          const [m, y] = v.split("-").map(Number);
          setSelectedMonth(m);
          setSelectedYear(y);
        }}>
          <SelectTrigger className="w-48 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Monthly sections */}
      <div className="space-y-4">
        <KontingentTracker client={client} clips={clips ?? []} month={selectedMonth} year={selectedYear} />
        <MonthlyShootDays clientId={client.id} shootDays={shootDays ?? []} month={selectedMonth} year={selectedYear} canEdit={canEdit} />
        <MonthlyPipeline clientId={client.id} clips={clips ?? []} month={selectedMonth} year={selectedYear} canEdit={canEdit} />
        <MonthlyChecklist clientId={client.id} month={selectedMonth} year={selectedYear} canEdit={canEdit} />
      </div>
    </AppLayout>
  );
};

export default ClientDetail;
