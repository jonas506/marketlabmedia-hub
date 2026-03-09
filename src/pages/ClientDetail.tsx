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
import TaskList from "@/components/client/TaskList";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { motion } from "framer-motion";

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

  const { data: contentPieces } = useQuery({
    queryKey: ["content-pieces", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_pieces")
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
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        </div>
      </AppLayout>
    );
  }

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
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        {/* Back link */}
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground font-body mb-6 transition-colors group">
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          Dashboard
        </Link>

        {/* Client info panel */}
        <div className="mb-8">
          <ClientInfoPanel client={client} canEdit={canEdit} />
        </div>

        {/* Month selector */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10">
              <CalendarDays className="h-4 w-4 text-primary" />
            </div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Monatszyklus</h2>
          </div>
          <Select value={`${selectedMonth}-${selectedYear}`} onValueChange={(v) => {
            const [m, y] = v.split("-").map(Number);
            setSelectedMonth(m);
            setSelectedYear(y);
          }}>
            <SelectTrigger className="w-52 h-10 text-sm bg-card border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Sections */}
        <div className="space-y-6">
          <KontingentTracker client={client} contentPieces={contentPieces ?? []} month={selectedMonth} year={selectedYear} />
          <MonthlyShootDays clientId={client.id} shootDays={shootDays ?? []} month={selectedMonth} year={selectedYear} canEdit={canEdit} />
          <MonthlyPipeline clientId={client.id} contentPieces={contentPieces ?? []} month={selectedMonth} year={selectedYear} canEdit={canEdit} />
          <MonthlyChecklist clientId={client.id} month={selectedMonth} year={selectedYear} canEdit={canEdit} />
        </div>

        {/* Aufgaben — always visible */}
        <div className="mt-6">
          <TaskList clientId={client.id} canEdit={canEdit} />
        </div>
      </motion.div>
    </AppLayout>
  );
};

export default ClientDetail;
