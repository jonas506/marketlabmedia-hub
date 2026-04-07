import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import TimeEntryForm from "@/components/time-tracking/TimeEntryForm";
import WeeklyView from "@/components/time-tracking/WeeklyView";
import MonthlyStats from "@/components/time-tracking/MonthlyStats";
import VacationTab from "@/components/time-tracking/VacationTab";

export default function TimeTracking() {
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const [memberFilter, setMemberFilter] = useState<string>("__all__");

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name").eq("status", "active").order("name");
      return data || [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-all"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, name");
      return data || [];
    },
  });

  const { data: entries = [], refetch: refetchEntries } = useQuery({
    queryKey: ["time-entries", user?.id, isAdmin, memberFilter],
    queryFn: async () => {
      if (!user) return [];
      let q = supabase.from("time_entries").select("*, clients(name)").order("date", { ascending: false });
      if (!isAdmin) {
        q = q.eq("user_id", user.id);
      } else if (memberFilter !== "__all__") {
        q = q.eq("user_id", memberFilter);
      }
      const { data } = await q.limit(500);
      return data || [];
    },
    enabled: !!user,
  });

  const filteredEntries = useMemo(() => entries as any[], [entries]);

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Zeiterfassung</h1>
          </div>
        </div>

        <Tabs defaultValue="zeiten">
          <TabsList>
            <TabsTrigger value="zeiten">Zeiten</TabsTrigger>
            <TabsTrigger value="urlaub">Urlaub</TabsTrigger>
          </TabsList>

          <TabsContent value="zeiten" className="space-y-6 mt-4">
            {/* Admin filter */}
            {isAdmin && (
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-muted-foreground">Team-Mitglied:</label>
                <Select value={memberFilter} onValueChange={setMemberFilter}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Alle</SelectItem>
                    {profiles.map(p => (
                      <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Quick entry */}
            <div className="rounded-lg border bg-card p-4">
              <h3 className="text-sm font-semibold mb-3">Schnelleingabe</h3>
              <TimeEntryForm clients={clients} onEntryAdded={() => refetchEntries()} />
            </div>

            {/* Weekly view */}
            <WeeklyView entries={filteredEntries} onRefresh={() => refetchEntries()} />

            {/* Monthly stats */}
            <MonthlyStats entries={filteredEntries} isAdmin={isAdmin} profiles={profiles} />
          </TabsContent>

          <TabsContent value="urlaub" className="mt-4">
            <VacationTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
